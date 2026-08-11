---
phase: 12-offline-providers-sync
plan: 01
subsystem: sync
tags: [offline-first, sqlite, firestore, sync, last-write-wins, temp-ids, expo-sqlite]

# Dependency graph
requires:
  - phase: 11-sqlite-local-db
    provides: uid-scoped SQLite CRUD modules (entries/categories/scheduled/syncQueue), idempotent seed, synced-flag contract
provides:
  - SQLite-backed EntriesProvider + CategoriesProvider (same external API as the Firestore versions)
  - Sync service: pushChanges (syncQueue drain with temp-id remap), pullChanges (incremental LWW merge + remote-delete reconcile), fullSync (push→pull→watermark) with in-flight coalescing
  - idMapping (generateTempId/isTempId/mapTempId), syncMetadata (per-uid lastSync watermark)
  - AutoSync on app foreground (AppState) + SyncButton with pending-count badge and last-sync time
  - Firestore rules block for scheduledEntries + composite indexes (entries uid+updatedAt, scheduledEntries uid+isActive+date)
  - Schema v2 migration: updatedAt on categories/scheduledEntries, syncMeta table (PRAGMA user_version)
affects: [13-recurring-entries-data, 14-export-tab-scheduled-ui, 15-homepage-upcoming]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Offline-first provider pattern: SQLite write → syncQueue enqueue → optimistic state mirror; sync() = fullSync + SQLite reload
    - Temp-id lifecycle: local-* ids on offline creates, remapped in-place (row id + categoryId references) on push (mapTempId)
    - Full-doc setDoc for updates (idempotent, immune to missing-doc races) instead of partial updateDoc
    - Incremental pull by updatedAt watermark + full-fetch delete reconciliation (clean rows absent from cloud = remote delete)
    - In-flight fullSync lock: same-uid calls coalesce, account switches serialize
    - Schema evolution via PRAGMA user_version + table_info-guarded ALTER TABLE

key-files:
  created:
    - src/sync/syncService.ts
    - src/sync/idMapping.ts
    - src/sync/syncMetadata.ts
    - src/sync/AutoSync.tsx
    - src/sync/__tests__/syncService-test.ts
    - jest/firestore-mock.ts
  modified:
    - src/entries/EntriesProvider.tsx
    - src/categories/CategoriesProvider.tsx
    - src/components/SyncButton.tsx
    - App.tsx
    - src/db/schema.ts (v2: updatedAt columns, syncMeta table)
    - src/db/database.ts (PRAGMA user_version migration)
    - src/db/categories.ts / scheduled.ts (updatedAt support)
    - src/db/seed.ts (cloud updatedAt fallback)
    - firestore.rules + deploy/firestore.rules (scheduledEntries block)
    - firestore.indexes.json + deploy/composite-index.md (new indexes)
    - jest/sqlite-mock.ts (syncMeta PK + PRAGMA support)
    - src/entries/__tests__/EntriesProvider.test.tsx, src/categories/__tests__/CategoriesProvider.test.tsx (rewritten for SQLite contract)
    - src/db/__tests__/{schema,categories,scheduled,seed}-test.ts (v2 updates)

key-decisions:
  - "Tasks 3-5 (sync service + idMapping + syncMetadata + schema v2) were implemented and committed BEFORE the provider refactors — the providers' sync() contract imports fullSync, so the sync foundation must land first (documented deviation)"
  - "Updates push the row's FULL current state via setDoc, not partial updateDoc — idempotent and immune to 'doc missing on cloud' races"
  - "Remote deletes are propagated by full-fetch reconciliation (clean local rows absent from cloud = deleted elsewhere) since Firestore cannot query deleted docs — SYNC-03 required this beyond the plan's incremental-merge spec"
  - "Categories need an updatedAt column (schema v2) for LWW pulls — added to categories + scheduledEntries via PRAGMA user_version migration"
  - "scheduledEntries pull is best-effort (permission errors swallowed) so entries/categories sync works before the Phase 12 rules deploy"
  - "The plan's own pull query (uid == + updatedAt >) requires the composite index entries uid ASC, updatedAt ASC — added to firestore.indexes.json + deploy docs (Rule 2)"

requirements-completed: [OFFL-03, OFFL-04, OFFL-05, OFFL-06, OFFL-07, OFFL-08, OFFL-09, OFFL-10, SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07, SYNC-08]

coverage:
  - id: D1
    description: "EntriesProvider refactored to SQLite (same external API; offline-first reads/writes; queued writes; sync() = full push+pull + reload)"
    verification:
      - kind: unit
        ref: "src/entries/__tests__/EntriesProvider.test.tsx#amountCents contract, copyEntry, load/mirror"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (passes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CategoriesProvider refactored to SQLite (same external API; type-column split; queued writes; usageMap from local entries)"
    verification:
      - kind: unit
        ref: "src/categories/__tests__/CategoriesProvider.test.tsx (13 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sync service — pushChanges (FIFO drain, temp-id remap, full-doc updates, deleteDoc deletes, failure keeps queue), pullChanges (incremental LWW merge + delete reconciliation), fullSync (watermark, in-flight coalescing)"
    verification:
      - kind: unit
        ref: "src/sync/__tests__/syncService-test.ts (18 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "idMapping — generateTempId/isTempId/mapTempId (row id + categoryId reference remap in one transaction)"
    verification:
      - kind: unit
        ref: "src/sync/__tests__/syncService-test.ts#pushes an offline create... remaps the temp id"
        status: pass
    human_judgment: false
  - id: D5
    description: "syncMetadata — per-uid lastSync watermark on the syncMeta table"
    verification:
      - kind: unit
        ref: "src/sync/__tests__/syncService-test.ts#fullSync ... advances the lastSync watermark"
        status: pass
    human_judgment: false
  - id: D6
    description: "Auto-sync on app foreground (AppState listener + initial sync after mount), wired into App.tsx"
    verification: []
    human_judgment: true
    rationale: "AppState behavior and the provider tree interaction can only be exercised on a device via Expo Go — not runnable under jest"
  - id: D7
    description: "SyncButton wired to the sync service with pending-changes badge and last-sync time (OFFL-09)"
    verification: []
    human_judgment: true
    rationale: "Visual header UI — layout and badge rendering need on-device judgment"
  - id: D8
    description: "Firestore rules (scheduledEntries block) + composite indexes (entries uid+updatedAt, scheduledEntries uid+isActive+date) + deploy docs"
    verification:
      - kind: other
        ref: "deploy/firestore.rules + firestore.indexes.json updated; deploy/composite-index.md documents both indexes"
        status: pass
    human_judgment: false
  - id: D9
    description: "On-device behavior: offline CRUD, kill-and-reopen persistence, wifi sync push, new-device seed, cross-device propagation (Tasks 11-12)"
    verification: []
    human_judgment: true
    rationale: "Requires the user's phone(s) via Expo Go QR — not executable in this environment; recorded in WINDOWS.md ledger (ids 2, 3)"

# Metrics
duration: 39min
completed: 2026-08-11
status: complete
---

# Phase 12 Plan 1: Offline-First Providers + Sync Summary

**SQLite-backed EntriesProvider and CategoriesProvider (same external API), a push/pull/fullSync sync service with temp-id remapping and last-write-wins, foreground auto-sync, sync-status SyncButton, and the Firestore rules/indexes updates that make multi-device sync work**

## Performance

- **Duration:** 39 min
- **Started:** 2026-08-11T20:14:26Z
- **Completed:** 2026-08-11T20:53:00Z
- **Tasks:** 12 (10 executed; Tasks 11-12 are manual on-device verification)
- **Files modified:** 24 (8 created, 16 modified)

## Accomplishments

- **EntriesProvider + CategoriesProvider now read/write SQLite exclusively** — offline CRUD works with zero Firestore dependency in the write path (OFFL-03/04); every write enqueues a create/update/delete op (OFFL-05); external API unchanged so all screens/tests consumers are untouched
- **Sync service** (`src/sync/syncService.ts`): FIFO queue drain (OFFL-06) with temp-id remapping via `addDoc` (SYNC-04), full-doc `setDoc` updates, `deleteDoc` deletes; failure stops the drain and keeps the queue for retry (OFFL-10). Pull merges remote changes with last-write-wins by `updatedAt` (SYNC-02) and reconciles remote deletes (SYNC-03); `fullSync` pushes, pulls, and advances a per-uid watermark with in-flight coalescing
- **Auto-sync on foreground** (SYNC-06): AppState listener + one initial sync after mount; failures swallowed, retried on next foreground
- **SyncButton** (SYNC-05, OFFL-09): triggers the full cycle; shows a pending-count badge (syncQueue length) and relative last-sync time
- **Firestore artifacts** (SYNC-07/08): `scheduledEntries` rules block (uid-scoped, same pattern), composite indexes `entries: uid+updatedAt` (required by the pull query) and `scheduledEntries: uid+isActive+date`, documented in `deploy/composite-index.md`
- **Schema v2 migration**: `updatedAt` on categories/scheduledEntries (LWW support) + `syncMeta` table, applied via `PRAGMA user_version` with table_info-guarded ALTERs — no data loss on upgrade
- **120 unit tests green** across db/sync/provider suites (18 new syncService tests); `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically (Tasks 3-5 first — the providers depend on the sync service):

1. **Task 1: Refactor EntriesProvider to SQLite** - `2200e24` (feat)
2. **Task 2: Refactor CategoriesProvider to SQLite** - `ea70ab5` (feat)
3. **Task 3: Create sync service** - `3696857` (feat — with Tasks 4/5 + schema v2, see deviation 7)
4. **Task 4: Create ID mapping utility** - `3696857` (feat, same commit as Task 3)
5. **Task 5: Create sync metadata storage** - `3696857` (feat, same commit as Task 3)
6. **Task 6: Wire auto-sync on foreground** - `a6ac695` (feat)
7. **Task 7: Wire manual sync button** - `920e488` (feat)
8. **Task 8: Update Firestore rules** - `7ebc1fc` (chore)
9. **Task 9: Update Firestore indexes** - `b704dd4` (chore)
10. **Task 10: Run typecheck + lint** - `8daaa40` (fix — typecheck green, test suites updated, 2 sync bugs fixed)
11. **Task 11: Manual verification — offline** - not executable here (see Next Phase Readiness)
12. **Task 12: Manual verification — new device** - not executable here (see Next Phase Readiness)

## Files Created/Modified

- `src/sync/syncService.ts` - pushChanges/pullChanges/fullSync with uid scoping, LWW merge, delete reconciliation, in-flight lock
- `src/sync/idMapping.ts` - generateTempId/isTempId/mapTempId (transactional row + reference remap)
- `src/sync/syncMetadata.ts` - getLastSync/setLastSync on the syncMeta table
- `src/sync/AutoSync.tsx` - AppState foreground sync component
- `src/entries/EntriesProvider.tsx` - SQLite reads/writes + queue, same external API
- `src/categories/CategoriesProvider.tsx` - SQLite reads/writes + queue, same external API
- `src/components/SyncButton.tsx` - fullSync trigger + pending badge + last-sync time
- `App.tsx` - AutoSync wired inside EntriesProvider > CategoriesProvider
- `src/db/schema.ts` - v2: updatedAt on categories/scheduledEntries, syncMeta table, SCHEMA_V2_ALTERS
- `src/db/database.ts` - PRAGMA user_version migration runner
- `src/db/categories.ts` / `src/db/scheduled.ts` - updatedAt in types/insert/updatable columns
- `src/db/seed.ts` - cloud updatedAt (fallback createdAt) for entries + categories
- `firestore.rules` + `deploy/firestore.rules` - scheduledEntries block (deploy target is gitignored; tracked copy carries the canonical change)
- `firestore.indexes.json` - entries uid+updatedAt, scheduledEntries uid+isActive+date
- `deploy/composite-index.md` - documents both new indexes + deploy status
- `jest/sqlite-mock.ts` - syncMeta table (uid PK), PRAGMA user_version/table_info support
- `jest/firestore-mock.ts` - in-memory Firestore mock (addDoc/setDoc/deleteDoc/getDocs with uid/updatedAt matcher)
- `src/sync/__tests__/syncService-test.ts` - 18 tests covering the sync contract
- `src/entries/__tests__/EntriesProvider.test.tsx`, `src/categories/__tests__/CategoriesProvider.test.tsx` - rewritten for the SQLite contract
- `src/db/__tests__/{schema,categories,scheduled,seed}-test.ts` - updated for schema v2

## Decisions Made

- **Sync foundation committed before provider refactors** (Tasks 3-5 in the first commit): providers' sync() imports fullSync, so the service must exist first; each commit stays typecheck-green
- **Full-doc setDoc for updates**: idempotent, immune to missing-doc races; a queued update for a locally-deleted row is dropped
- **Remote deletes via reconciliation**: Firestore can't query deleted docs, so pull fetches all cloud ids and deletes clean local rows absent from the cloud (SYNC-03) — the plan's incremental-merge alone would never propagate deletes
- **Categories/scheduledEntries got updatedAt (schema v2)**: LWW (SYNC-02) is impossible without it; migration is version-gated and additive
- **scheduledEntries pull is best-effort**: before the Task 8 rules deploy, permission errors must not block entries/categories sync
- **`local-*` temp ids**: simple, collision-safe, recognized by isTempId along with UUID/negative patterns; remap is transactional (row + references)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pushChanges never marked pushed rows as synced**
- **Found during:** Task 10 (new syncService tests)
- **Issue:** After a successful create/update push the local row's `synced` flag stayed 0 forever — violating the WR-03 flag contract and breaking remote-delete reconciliation (clean rows are the only ones eligible for deletion)
- **Fix:** `confirmSynced()` now flips synced=1 after every successful create (temp + non-temp) and update push
- **Files modified:** src/sync/syncService.ts
- **Verification:** syncService-test asserts `rows[0].synced === 1` after push
- **Committed in:** `8daaa40`

**2. [Rule 1 - Bug] Category pull reconcile deleted every category type per kind pass**
- **Found during:** Task 10 (syncService tests)
- **Issue:** `getAllCategories` returns both expense and income rows; the income-kind reconcile pass deleted every local expense category (absent from the income cloud collection) and vice versa
- **Fix:** Reconcile and LWW merge are now scoped to `row.type === categoryTypeOf(kind)`
- **Files modified:** src/sync/syncService.ts
- **Verification:** syncService-test "merges remote category edits and reconciles deletions for both kinds"
- **Committed in:** `8daaa40`

**3. [Rule 2 - Missing Critical] Remote-delete propagation (SYNC-03)**
- **Found during:** Task 3 (sync service design)
- **Issue:** The plan's pull spec ("query entries where updatedAt > lastSync, merge LWW") cannot see deleted docs — cloud deletions would never reach other devices, violating SYNC-03
- **Fix:** Added full-fetch id reconciliation: clean local rows absent from the cloud are deleted locally (entries, both category kinds, scheduledEntries)
- **Files modified:** src/sync/syncService.ts
- **Verification:** syncService-test "deletes a clean local row that is absent from the cloud" / "keeps a local row still pending push"
- **Committed in:** `3696857`

**4. [Rule 2 - Missing Critical] entries uid+updatedAt composite index**
- **Found during:** Task 3 (pull query)
- **Issue:** The plan's own incremental pull query (`uid ==` + `updatedAt >`) requires a composite index Firestore does not auto-create; without it every sync throws `The query requires an index.`
- **Fix:** Added `entries: uid ASC, updatedAt ASC` to firestore.indexes.json + documented in deploy/composite-index.md
- **Files modified:** firestore.indexes.json, deploy/composite-index.md
- **Committed in:** `b704dd4`

**5. [Rule 2 - Missing Critical] updatedAt column for categories (and scheduledEntries)**
- **Found during:** Task 3 (pull LWW)
- **Issue:** The categories table had no updatedAt — LWW merge (SYNC-02) was impossible for categories
- **Fix:** Schema v2 adds updatedAt to categories + scheduledEntries (default 0, backfilled from createdAt on insert) with a versioned ALTER migration; seed reads cloud updatedAt when present
- **Files modified:** src/db/schema.ts, database.ts, categories.ts, scheduled.ts, seed.ts
- **Verification:** 86 db tests green; migration exercised by the sqlite mock's PRAGMA path
- **Committed in:** `3696857`

**6. [Rule 2 - Missing Critical] Scheduled entries sync coverage in the service**
- **Found during:** Task 3
- **Issue:** SYNC-01 lists scheduled entries among the collections to sync; the plan's push/pull specs only described entries
- **Fix:** pushChanges handles scheduledEntries creates/updates/deletes; pullChanges pulls + reconciles them (best-effort until the Task 8 rules deploy)
- **Files modified:** src/sync/syncService.ts
- **Committed in:** `3696857`

**7. [Rule 3 - Blocking] Execution order deviation (Tasks 3-5 before Tasks 1-2)**
- **Found during:** Task 1
- **Issue:** The refactored providers import `fullSync` from src/sync/syncService — a Task-1 commit without the service would fail typecheck
- **Fix:** Committed the sync foundation (Tasks 3-5 + schema v2) first; Task attribution preserved in this summary
- **Committed in:** `3696857` (first commit)

**8. [Rule 3 - Blocking] Root firestore.rules/indexes.json are gitignored**
- **Found during:** Task 8
- **Issue:** `firebase.json` points at the gitignored root files; the tracked rules artifact is `deploy/firestore.rules` (which also carried a newer users-rules version than the stale root copy)
- **Fix:** Applied the scheduledEntries block to the tracked deploy copy (committed), kept the root deploy target in sync (gitignored), and used deploy/composite-index.md as the tracked index record
- **Files modified:** deploy/firestore.rules, deploy/composite-index.md, firestore.rules (gitignored), firestore.indexes.json (gitignored)
- **Committed in:** `7ebc1fc`, `b704dd4`

---

**Total deviations:** 8 auto-fixed (3 bugs, 4 missing-critical, 1 blocking-order)
**Impact on plan:** All fixes were required for sync correctness (SYNC-02/03/04), typecheck-greens, or deploy-artifact handling. No scope creep beyond the collections the plan already names.

## Issues Encountered

- **Jest async act() hang** (react-test-renderer + React 19 + in-flight effect chains): the rewritten provider tests use the original sync-act + macrotask-flush pattern (documented in both test files)
- **jest.mock factory class-transform breakage**: `class MockTimestamp` in the firestore mock became non-constructable under babel-jest — switched to a prototype-based constructor (same fix seed-test.ts documents)
- **ESLint cannot run**: `eslint.config.js` requires `eslint/config` which no installed eslint provides, and `eslint` is not in node_modules (expo lint fails). Pre-existing tooling gap, untouched per scope boundary — the plan's hard verification (`npx tsc --noEmit`) passes and new code follows existing file patterns
- **Pre-existing env-gated suites** (verified failing identically at HEAD~9): 9 suites that transitively load `src/firebase/app.ts` fail with `auth/invalid-api-key` when Firebase env vars are absent — same condition Phase 11 documented; not caused by this plan
- **Temp worktree** at `C:/Users/Admin/AppData/Local/Temp/opencode/mt-head-test` (detached HEAD) was already present — left untouched

## User Setup Required

**Deploy the Firestore artifacts before first sync** (the app degrades gracefully — the queue persists and retries — but sync stays blocked until then):

1. **Required:** create the composite index `entries: uid ASC, updatedAt ASC` (console → Firestore → Indexes, or deploy the updated `firestore.indexes.json` via `firebase deploy --only firestore:indexes`)
2. **Recommended:** deploy the updated rules (`firebase deploy --only firestore:rules` — root `firestore.rules`, now synced with deploy/firestore.rules) and the `scheduledEntries: uid ASC, isActive ASC, date ASC` index — scheduledEntries sync stays best-effort until then

> The old `entries: uid+type+date` and `entries: uid+date` indexes are no longer needed by the app at runtime (tab lists read SQLite) but are harmless to keep.

## Next Phase Readiness

- Phase 13 (`13-recurring-entries-data`) can build the scheduled-entry UI and generation engine directly on SQLite (`getActiveScheduled` already exists) and use the sync service's scheduledEntries push/pull for cloud round-tripping — the rules, indexes, and service plumbing are in place
- Sync status plumbing (pending badge, lastSync watermark) is ready for the Export tab UI
- **Manual verification pending (Tasks 11-12)** — requires the user's phone(s) via Expo Go QR; recorded in `.planning/WINDOWS.md` (ids 2, 3):
  1. Sign in → data loads from SQLite (instant, offline-capable)
  2. Turn off wifi → add/edit/delete entries + categories → all work; badge shows pending count
  3. Kill app → reopen offline → data persists (SQLite)
  4. Turn on wifi → tap sync (or foreground the app) → changes push to Firestore; badge clears
  5. Sign in on device 2 → seed from Firestore → all data appears; edit on device 2 → sync → device 1 receives it
- After manual verification passes, Phase 11's deferred on-device checks (WINDOWS.md id 1) can also be closed

---

*Phase: 12-offline-providers-sync*
*Completed: 2026-08-11*

## Self-Check: PASSED

- All 8 task commits verified in `git log` (`3696857`, `2200e24`, `ea70ab5`, `a6ac695`, `920e488`, `7ebc1fc`, `b704dd4`, `8daaa40`)
- Key files exist on disk: src/sync/syncService.ts, idMapping.ts, syncMetadata.ts, AutoSync.tsx, jest/firestore-mock.ts, src/sync/__tests__/syncService-test.ts
- `npx tsc --noEmit` exits 0
- 120/120 runnable tests pass (db: 86, syncService: 18, EntriesProvider: 3, CategoriesProvider: 13)
- Pre-existing env-gated suites verified failing identically at HEAD~9 (not regressions)
- WINDOWS.md ledger updated with Tasks 11-12 manual-verification items (ids 2, 3)
