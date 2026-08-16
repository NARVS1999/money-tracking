---
phase: 11-sqlite-local-db
plan: 01
subsystem: database
tags: [sqlite, expo-sqlite, offline, firestore, seed, local-first]

# Dependency graph
requires:
  - phase: 10-foundation
    provides: Firebase app singleton (src/firebase/app.ts), uid-scoped query builders (src/firebase/queries.ts)
provides:
  - SQLite schema + connection singleton (entries, categories, scheduledEntries, syncQueue)
  - Uid-scoped CRUD modules for entries, categories, scheduled entries
  - Offline change tracking sync queue (enqueue/dequeue/clear/removeByDocId)
  - Firestore→SQLite idempotent seed with transactional insert
  - App-level seed bootstrap on sign-in
affects: [12-offline-providers-sync, 13-recurring-entries-data, 14-export-tab-scheduled-ui, 15-homepage-upcoming]

# Tech tracking
tech-stack:
  added:
    - expo-sqlite ~57.0.1 (Expo Go SDK 57 bundled pin)
  patterns:
    - Lazy database singleton: getDb() opens + applies idempotent schema on first call
    - Column-whitelist partial updates (SQL injection defense for dynamic SET clauses)
    - Uid-scoped SQL at the query layer (ownership never trusted to callers)
    - Timestamps as INTEGER ms epochs (Firestore Timestamp.toMillis() compatible)
    - synced 0/1 flag per row = local change pending push (Phase 12 drain)

key-files:
  created:
    - src/db/schema.ts
    - src/db/database.ts
    - src/db/entries.ts
    - src/db/categories.ts
    - src/db/scheduled.ts
    - src/db/syncQueue.ts
    - src/db/seed.ts
  modified:
    - App.tsx

key-decisions:
  - "Schema split from connection: schema.ts holds DDL as single source of truth; database.ts is a lazy-init singleton (no module-load side effects — jest-safe)"
  - "Category kind (expense/income) normalized into a `type` column in one table instead of mirroring Firestore's two collections"
  - "Insert uses Firestore doc ids verbatim as TEXT PK — no temp-id mapping needed on the seed path"
  - "Plain npm install for expo-sqlite: `npx expo install` passes --allow-scripts which npm 11.18 rejects under project allowScripts config; package has no install scripts, pin ~57.0.1 is identical"

requirements-completed: [OFFL-01, OFFL-02, NFR-11, NFR-12, NFR-13, NFR-16]

coverage:
  - id: D1
    description: "SQLite schema + connection singleton with idempotent table creation on first run"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (passes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uid-scoped CRUD modules (entries, categories, scheduledEntries) with synced-flag and column-whitelist updates"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (passes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sync queue module (enqueue/dequeue/getQueue/clearQueue/removeByDocId)"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (passes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Idempotent Firestore→SQLite seed (transactional, skips when uid already populated)"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (passes)"
        status: pass
    human_judgment: false
  - id: D5
    description: "App-level seed bootstrap on sign-in (SeedOnSignIn in App.tsx)"
    verification:
      - kind: other
        ref: "npx jest src/__tests__/smoke-test.ts (App module test passes with seed wiring)"
        status: pass
    human_judgment: false
  - id: D6
    description: "On-device behavior: sign-in seeds SQLite; kill/reopen persists offline; new device reseeds idempotently"
    verification: []
    human_judgment: true
    rationale: "Requires the user's phone via Expo Go QR — not executable in this environment; recorded as open item in WINDOWS.md ledger"

# Metrics
duration: 33min
completed: 2026-08-11
status: complete
---

# Phase 11 Plan 1: SQLite Local Database Summary

**Expo-sqlite local-first storage layer: 4-table schema, uid-scoped CRUD for entries/categories/scheduled entries, offline change-tracking sync queue, and an idempotent transactional Firestore→SQLite seed wired to sign-in in App.tsx**

## Performance

- **Duration:** 33 min
- **Started:** 2026-08-11T18:51:41Z
- **Completed:** 2026-08-11T19:08:06Z
- **Tasks:** 11 (10 executed; Task 11 is manual on-device verification)
- **Files modified:** 8 (7 created, 1 modified)

## Accomplishments

- `expo-sqlite@~57.0.1` installed — matches the SDK 57 Expo Go bundled pin (verified against `bundledNativeModules.json`)
- 4-table schema (`entries`, `categories`, `scheduledEntries`, `syncQueue`) with uid indexes, INTEGER ms timestamps, and `synced` push-pending flags
- Lazy-init database singleton (`getDb()`) — opens `money-tracking.db` and applies idempotent DDL on first use; zero module-load side effects
- Uid-scoped CRUD modules for all three data tables with column-whitelist partial updates (SQL-injection-safe dynamic SET)
- Sync queue (FIFO, autoincrement, ms timestamps) ready for the Phase 12 push pipeline
- `seedFromFirestore(uid)` — parallel Firestore fetch (entries + both category collections), transactional insert, idempotent skip when the uid already has local rows
- `SeedOnSignIn` wired into App.tsx: every sign-in ensures the local ledger exists; failures are swallowed (providers still read Firestore) and retried on next sign-in
- `npx tsc --noEmit` passes clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Install expo-sqlite** - `125144a` (chore)
2. **Task 2: Create database module** - `a41b1ab` (feat)
3. **Task 3: Define SQLite schema** - `c10d200` (feat)
4. **Task 4: Create entries CRUD module** - `38ed97e` (feat)
5. **Task 5: Create categories CRUD module** - `61a27f9` (feat)
6. **Task 6: Create scheduled entries CRUD module** - `0630b30` (feat)
7. **Task 7: Create sync queue module** - `c3900c2` (feat)
8. **Task 8: Create Firestore seed function** - `f49b15c` (feat)
9. **Task 9: Wire database init into App.tsx** - `85741af` (feat)
10. **Task 10: Run typecheck + lint** - `118b0a7` (fix, see deviations) — typecheck passes, lint errors are all pre-existing
11. **Task 11: Manual verification** - not executable here (see Next Phase Readiness)

**Plan metadata:** `docs(11-01)` final commit

## Files Created/Modified

- `src/db/schema.ts` - Single source of truth for table DDL (SCHEMA_VERSION 1); entries/categories/scheduledEntries/syncQueue + uid indexes
- `src/db/database.ts` - `getDb()` lazy singleton (open + schema on first call, failure-reset for retry); `resetDbForTesting()`
- `src/db/entries.ts` - `getAllEntries`, `getEntriesByType`, `insertEntry`, `updateEntry`, `deleteEntry`, `getUnsyncedEntries`, `markSynced`, `hasEntries`; DbEntry/DbEntryInput types
- `src/db/categories.ts` - Same surface for categories; `type` column normalizes the two Firestore collections; DbCategory types
- `src/db/scheduled.ts` - Same surface for scheduledEntries (frequency, endDate, lastGenerated, isActive); `getActiveScheduled` for the Phase 13 generation engine
- `src/db/syncQueue.ts` - `enqueue`, `dequeue`, `getQueue`, `clearQueue`, `removeByDocId`; SyncQueueItem type
- `src/db/seed.ts` - `seedFromFirestore(uid)` transactional seed with idempotency check; SeedResult return
- `App.tsx` - Added `SeedOnSignIn` component (seed on auth state change) + `useEffect` import

## Decisions Made

- **Schema as separate module** (`schema.ts`): DDL is a distinct, reviewable deliverable (Task 3) and the connection singleton (Task 2) stays a thin executor — also keeps the jest smoke test safe since importing `database.ts` never touches the native module.
- **One categories table with a `type` column** instead of mirroring Firestore's two collections: simpler queries (`getAllCategories(uid)`), and the seed maps collection → type.
- **Firestore doc ids as TEXT PKs**: the seed path needs no temp-id mapping; Phase 12's offline-create temp ids are handled by its own idMapping layer.
- **Direct `npm install` for expo-sqlite**: `npx expo install` fails under npm 11.18 project-scoped installs (`--allow-scripts` rejected, EALLOWSCRIPTS). expo-sqlite has no install scripts, and the resolved pin (~57.0.1) is exactly the SDK 57 bundled version `expo install` would select — verified with `npx expo install --check`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLiteBindValue type errors in update functions**
- **Found during:** Task 10 (typecheck)
- **Issue:** `db.runAsync(sql, ...spread)` with `Record<string, unknown>` values failed tsc: `unknown` is not assignable to `SQLiteBindValue`
- **Fix:** Build a `SQLiteBindValue[]` params array (typed cast per column) and pass it as a single argument in entries/categories/scheduled update functions
- **Files modified:** src/db/entries.ts, src/db/categories.ts, src/db/scheduled.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `118b0a7` (fix commit after Task 9; code first introduced in Tasks 4-6)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was required for the typecheck gate to pass; no scope creep.

## Issues Encountered

- **`npx expo install` failed with EALLOWSCRIPTS** (npm 11.18 project-scoped installs reject `--allow-scripts`). Resolved by installing the exact SDK 57 pin directly via `npm install expo-sqlite@~57.0.1` — verified identical to the Expo-bundled version.
- **Jest smoke test cannot run without Firebase env vars**, and 2 theme-token assertions fail (`#F7F7F8` expected vs `#FAFAFA` actual). Both are **pre-existing** — verified identical on pristine HEAD before this plan's changes. The App module-load test passes with the new seed wiring when env vars are sourced. Logged to `deferred-items.md` (out of scope).
- **Lint: 5 pre-existing errors** in AuthProvider/EntriesProvider/CategoriesProvider (`react-hooks/set-state-in-effect`) — all in files untouched by this plan. New code (`src/db/*`, App.tsx) is lint-clean. Logged to `deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All SQLite modules Phase 12 needs are in place: `getAllEntries(uid)`, `insertEntry`, `updateEntry(id, changes)`, `deleteEntry(id)` + `enqueue`/`getQueue`/`dequeue`/`markSynced` — the sync service and provider refactors can consume them directly.
- **Manual verification pending (Task 11)** — requires the user's phone via Expo Go QR; recorded as open item in `.planning/WINDOWS.md` (id 1):
  1. Sign in → console should show `[sqlite] seeded N entries, M categories` on first sign-in; subsequent sign-ins skip
  2. Kill app → reopen → data persists from SQLite (offline)
  3. Sign in on a new device → seed runs again (idempotent, no duplicates)
- Phase 12 (`12-offline-providers-sync`) is ready to plan/execute on top of this layer.

---

*Phase: 11-sqlite-local-db*
*Completed: 2026-08-11*

## Self-Check: PASSED

- All 8 task files found on disk (7 created + App.tsx modified)
- All 10 plan commits verified in `git log` (`125144a`, `c10d200`, `a41b1ab`, `38ed97e`, `61a27f9`, `0630b30`, `c3900c2`, `f49b15c`, `85741af`, `118b0a7`)
- `npx tsc --noEmit` exits 0
- New code lint-clean (pre-existing errors logged to deferred-items.md)
- App module-load smoke test passes with seed wiring (env-sourced)
