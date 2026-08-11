---
phase: 12-offline-providers-sync
verified: 2026-08-12T06:20:00Z
status: human_needed
score: 8/10 must-haves verified
behavior_unverified: 2
overrides_applied: 0
gaps: []
behavior_unverified_items:
  - truth: "Auto-sync on app foreground (AppState) when online; manual SyncButton wired to fullSync with pending count + last sync time (SC6 / SYNC-06 / OFFL-09)"
    test: "On device: sign in, background the app, add an entry, foreground the app — the pending badge should clear and the entry should appear in Firestore without touching the sync button"
    expected: "The AppState 'active' transition triggers entriesSync()/categoriesSync() → fullSync; the syncQueue drains and the badge clears"
    why_human: "The AppState listener → provider sync() → fullSync transition is a runtime state transition that jest cannot exercise (AppState + real provider tree require Expo Go on a device — SUMMARY D6). SyncButton itself is test-covered (SyncButton.test.tsx, 9 tests)."
  - truth: "Offline: add/edit/delete works with no network; kill+reopen offline keeps data; reconnecting syncs to Firestore (SC8 / OFFL-03)"
    test: "On device: turn off wifi → add/edit/delete entries and categories → all work; kill the app → reopen offline → data persists; turn wifi on → tap sync → changes reach Firestore"
    expected: "SQLite writes succeed with zero network; queued ops persist across app restarts (expo-sqlite); a later fullSync drains the queue to Firestore"
    why_human: "Offline CRUD against SQLite is unit-tested via the provider suites, but kill+reopen persistence and reconnect-sync require the real expo-sqlite file on a phone (Tasks 11-12, SUMMARY D9)"
human_verification:
  - test: "Auto-sync on foreground (SYNC-06): background the app, add an entry, foreground the app — the entry syncs to Firestore without pressing the sync button"
    expected: "AppState 'active' fires AutoSync's runSync; the pending badge clears and the entry appears in Firestore"
    why_human: "AppState transitions and the provider tree interaction are only exercisable on a device via Expo Go"
  - test: "Offline CRUD (Task 11): turn off wifi, then add/edit/delete entries and categories; the SyncButton badge shows the pending change count"
    expected: "All writes work instantly from SQLite (no network errors); the badge count matches the queue length"
    why_human: "Requires the user's phone with wifi disabled — not executable under jest"
  - test: "Kill + reopen offline persistence (Task 11): with wifi still off, kill the app and reopen it — entries/categories added offline are still there"
    expected: "SQLite data survives the restart; nothing is lost, queued changes remain queued"
    why_human: "Durable storage across an app kill requires the real expo-sqlite database file on the device"
  - test: "Reconnect sync (Task 11): turn wifi on, tap the sync button (or foreground the app) — queued changes push to Firestore and the badge clears"
    expected: "fullSync drains the queue; Firestore contains the offline edits; last-sync time updates"
    why_human: "End-to-end Firestore round-trip needs the user's Firebase project and a device"
  - test: "New device seed + two-device propagation (Task 12): sign in on device 2 — the ledger seeds from Firestore without duplicates; edit on device 2, sync, then sync device 1"
    expected: "Idempotent seed (OFFL-08) — no duplicated rows; changes propagate both ways via push+pull (SYNC-03)"
    why_human: "Requires two phones / a second Expo Go install; the seed logic itself is unit-tested (seed-test.ts, 14 tests) but the device flow is not"
  - test: "SyncButton visual (OFFL-09): header shows the refresh icon, pending-count badge (red), and 'synced Xm ago' status line in the main tabs header"
    expected: "Layout, badge, and status text render correctly and update after local writes (WR-04)"
    why_human: "Visual header UI needs on-device judgment (SUMMARY D7)"
---

# Phase 12: Offline-First Providers + Sync Verification Report

**Phase Goal:** Entries and Categories providers read/write SQLite first; a sync service pushes syncQueue changes to Firestore and pulls remote changes with last-write-wins; auto-sync on foreground plus manual sync button.
**Verified:** 2026-08-12T06:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Must-haves derive from the 10 ROADMAP Success Criteria (the PLAN declares no `must_haves:` frontmatter; the roadmap is the contract).

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | EntriesProvider reads from SQLite (`getAllEntries`) and writes SQLite + syncQueue for create/update/delete — same external API (SC1 / OFFL-03/04) | ✓ VERIFIED | `src/entries/EntriesProvider.tsx`: loads via `getAllEntries` (L120/145); `insertEntry` + `enqueue(...,"create")` (L163-175), `updateEntryDb` + enqueue update (L212-213), `deleteEntryDb` + enqueue delete (L239-240); zero Firestore calls in the file (grep: no getDocs/addDoc/updateDoc/deleteDoc). External API unchanged (entries/addEntry/updateEntry/deleteEntry/copyEntry/sync/isLoading/isSyncing/lastError). `EntriesProvider.test.tsx` — 11/11 tests pass |
| 2   | CategoriesProvider follows the same SQLite-first pattern (SC2) | ✓ VERIFIED | `src/categories/CategoriesProvider.tsx`: `getAllCategories` (L93), `insertCategory`+enqueue (L167-177), `updateCategoryDb`+enqueue (L221-222), `deleteCategoryDb`+enqueue (L251-252); usageMap derived from local entries (L81-87); no Firestore calls. `CategoriesProvider.test.tsx` — 19/19 tests pass |
| 3   | `src/sync/syncService.ts` provides pushChanges (creates/updates/deletes via queue), pullChanges (since lastSyncTimestamp, LWW by updatedAt), fullSync (push then pull) (SC3 / OFFL-06/07/10, SYNC-01/02/03) | ✓ VERIFIED | 612-line service: FIFO queue drain with `addDoc` creates + temp-id remap, full-doc `setDoc` updates with WR-01 cloud-guard (`cloudUpdatedAtOf`), `deleteDoc` deletes, failure `break` keeps queue (OFFL-10); incremental pull `uid==` + `updatedAt >` with `>=` LWW tie-break, WR-02 pending-delete skip, full-fetch remote-delete reconciliation (SYNC-03); fullSync advances per-uid watermark with in-flight coalescing. `syncService-test.ts` — 36/36 tests pass (incl. LWW, WR-01/02, watermark, coalescing, OFFL-10 failure path) |
| 4   | `src/sync/idMapping.ts` remaps temp IDs to Firestore doc IDs after push (SC4 / SYNC-04) | ✓ VERIFIED | `generateTempId`/`isTempId` (local-*, UUID, negative patterns) + transactional `mapTempId` (row id + categoryId references across entries/scheduledEntries in one `withTransactionAsync`). `idMapping-test.ts` — 10/10 tests pass; remap-after-push also covered in syncService-test |
| 5   | `src/sync/syncMetadata.ts` persists lastSyncTimestamp (SC5) | ✓ VERIFIED | Per-uid `syncMeta` table (schema v2): `getLastSync`/`setLastSync` with `ON CONFLICT(uid) DO UPDATE` upsert. `syncMetadata-test.ts` — 4/4 tests pass, including the upsert path (WR-05 fix) |
| 6   | Auto-sync on app foreground (AppState) when online; manual SyncButton wired to fullSync with pending count + last sync time (SC6 / SYNC-05/06, OFFL-09) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `src/sync/AutoSync.tsx` present + wired in App.tsx (L97, inside EntriesProvider > CategoriesProvider): AppState `active` listener + 1.5s initial sync; failures swallowed for retry. `SyncButton.tsx` wired in MainTabs headerRight: press → both providers' `sync()` → fullSync, badge = `getQueue(uid).length`, last-sync line, WR-04 refresh on provider-state change; 9/9 tests pass. The AppState→sync transition itself is not exercisable under jest (device-only, SUMMARY D6) — see Human Verification |
| 7   | Firestore rules add scheduledEntries (uid-scoped); indexes add scheduledEntries composite (uid, isActive, date) (SC7 / SYNC-07/08) | ✓ VERIFIED | `firestore.rules` + `deploy/firestore.rules` both contain the `match /scheduledEntries/{id}` uid-scoped block; `firestore.indexes.json` contains `entries: uid+updatedAt ASC` (required by the pull query) and `scheduledEntries: uid+isActive+date`; `deploy/composite-index.md` documents both. Note: rules/indexes are **not yet deployed** to the console (user action, documented in SUMMARY "User Setup Required") |
| 8   | Offline: add/edit/delete works with no network; kill+reopen offline keeps data; reconnecting syncs to Firestore (SC8 / OFFL-03) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Offline CRUD path unit-tested (providers write SQLite with zero network dependency; queue persists ops). Kill+reopen persistence and reconnect-sync are on-device flows (Tasks 11-12) — see Human Verification |
| 9   | New device sign-in seeds from Firestore without duplicating (idempotent) (SC9 / OFFL-08) | ✓ VERIFIED | `src/db/seed.ts`: per-table idempotent seed, WR-03 fix — skips seeding entirely when the uid has pending queue ops (`getQueue(uid)` check, L89) so offline deletes are never resurrected; `SeedOnSignIn` wired in App.tsx (L32-54). `seed-test.ts` — 14/14 tests pass (incl. WR-03 queue-aware case). End-to-end new-device flow remains an on-device check — see Human Verification |
| 10  | `npx tsc --noEmit` passes (SC10) | ✓ VERIFIED | Re-run during this verification: exit 0, 0 errors |

**Score:** 8/10 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/sync/syncService.ts` | pushChanges/pullChanges/fullSync, uid-scoped, LWW, delete reconcile | ✓ VERIFIED | 612 lines; all three functions substantive; WR-01/02 guards present |
| `src/sync/idMapping.ts` | generateTempId/isTempId/mapTempId | ✓ VERIFIED | 91 lines; transactional remap across row id + references |
| `src/sync/syncMetadata.ts` | getLastSync/setLastSync | ✓ VERIFIED | 29 lines; syncMeta upsert per uid |
| `src/sync/AutoSync.tsx` | AppState foreground sync | ✓ VERIFIED (behavior on-device) | 50 lines; AppState listener + initial sync; wired in App.tsx L97 |
| `src/entries/EntriesProvider.tsx` | SQLite-first provider, same external API | ✓ VERIFIED | 326 lines; reads/writes SQLite + queue; no Firestore calls |
| `src/categories/CategoriesProvider.tsx` | SQLite-first provider, same external API | ✓ VERIFIED | 295 lines; reads/writes SQLite + queue; no Firestore calls |
| `src/components/SyncButton.tsx` | fullSync trigger + pending badge + last-sync time | ✓ VERIFIED | 153 lines; wired in MainTabs headerRight; 9 tests pass |
| `App.tsx` | AutoSync + providers wiring | ✓ VERIFIED | AutoSync rendered inside EntriesProvider > CategoriesProvider (L95-100) |
| `firestore.rules` / `deploy/firestore.rules` | scheduledEntries uid-scoped block | ✓ VERIFIED | Present in both copies (deploy copy is the tracked one) |
| `firestore.indexes.json` / `deploy/composite-index.md` | entries uid+updatedAt; scheduledEntries uid+isActive+date | ✓ VERIFIED | Both indexes in JSON; documented in composite-index.md |
| `src/db/schema.ts` / `database.ts` | schema v2 (updatedAt + syncMeta) with PRAGMA migration | ✓ VERIFIED | SCHEMA_V2_ALTERS, table_info-guarded, user_version gated |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| EntriesProvider | syncService | `import { fullSync } from "../sync/syncService"` — sync() calls fullSync then reloads | WIRED | L32, L144 |
| CategoriesProvider | syncService | same fullSync import; sync() = fullSync + load | WIRED | L31, L136 |
| EntriesProvider | syncQueue | `enqueue` on every write (create L175, update L213, delete L240) | WIRED | Also copyEntry L272 |
| CategoriesProvider | syncQueue | `enqueue` on every write (create L177, update L222, delete L252) | WIRED | |
| syncService | idMapping | `isTempId`/`mapTempId` in create push; tempToReal map for follow-up ops | WIRED | L63, L203-213 |
| syncService | syncMetadata | `getLastSync` before pull; `setLastSync` after pull in fullSync | WIRED | L603-605 |
| syncService | Firestore | addDoc/setDoc/deleteDoc/getDoc/getDocs with rules-compatible field names (amountCents, Timestamps) | WIRED | L204-326, L443-448 |
| AutoSync | providers | `useEntries().sync` + `useCategories().sync` on AppState active | WIRED | L17-18, L39-41 |
| SyncButton | providers | press → `Promise.allSettled([entriesSync(), categoriesSync()])` → fullSync | WIRED | L70-73; also MainTabs headerRight |
| SyncButton | queue/watermark | `getQueue(uid)` badge + `getLastSync(uid)` status | WIRED | L54-57; WR-04 refresh on provider state change L64-66 |
| SeedOnSignIn / providers | seed | `seedFromFirestore(uid)` on sign-in (App.tsx L38, EntriesProvider L119, CategoriesProvider L92) | WIRED | idempotent + queue-aware (WR-03) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| EntriesProvider | `entries` state | `getAllEntries(uid)` SQLite query after seed/sync | ✓ FLOWING — real SQLite rows; mirrored optimistically on write | ✓ |
| CategoriesProvider | `expenseCategories`/`incomeCategories` | `getAllCategories(uid)` SQLite query | ✓ FLOWING — real rows; kind split by `type` column | ✓ |
| SyncButton | `pending` badge | `getQueue(user.uid)` — real queue length | ✓ FLOWING — refreshed on provider-state change (WR-04) | ✓ |
| SyncButton | `lastSync` line | `getLastSync(user.uid)` — syncMeta table | ✓ FLOWING | ✓ |
| pullChanges | cloud entries | Firestore `where(uid==, updatedAt>)` (needs the composite index) | ✓ FLOWING — real docs; LWW merge + reconcile | ✓ |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Typecheck green (SC10) | `npx tsc --noEmit` | exit 0, 0 errors | ✓ PASS |
| Targeted test suites | `npx jest --testPathPattern="src/sync\|src/entries\|src/categories\|src/components/__tests__/SyncButton"` | 6 suites, **89/89 tests pass** (syncService 36, idMapping 10, syncMetadata 4, EntriesProvider 11, CategoriesProvider 19, SyncButton 9) | ✓ PASS |
| Seed idempotency + WR-03 | `npx jest src/db/__tests__/seed-test.ts` | 14/14 tests pass | ✓ PASS |
| Review-fix commits exist | `git log --all` | 27fab2c (WR-01), c81812f (WR-02), db69a7a (WR-03), c79c1e0 (WR-04), cba6246 (WR-05) all present | ✓ PASS |
| No Firestore calls in providers | `grep -n "getDocs\|addDoc\|updateDoc\|deleteDoc\|onSnapshot"` on both providers | 0 matches — SQLite-exclusive read/write path confirmed | ✓ PASS |

### Probe Execution

SKIPPED — no probe scripts declared in the PLAN/SUMMARY and this is not a migration/tooling phase; automated verification uses tsc + jest per the plan's Task 10.

### Requirements Coverage

All 16 requirement IDs from PLAN frontmatter are accounted for (no orphans; all mapped to Phase 12 in REQUIREMENTS.md).

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| OFFL-03 | 12-01 | App fully functional offline — all screens work with data from last sync | SATISFIED (device flow human) | Providers SQLite-exclusive (SC1/2 verified); on-device "all screens offline" remains a phone check |
| OFFL-04 | 12-01 | All writes go to SQLite first, then queue for Firestore sync | SATISFIED | Both providers: insert/update/delete + enqueue on every write; tested |
| OFFL-05 | 12-01 | syncQueue table tracks pending changes (collection, doc ID, op, timestamp) | SATISFIED | Phase 11 artifact; enqueue wired with collection/docId/op in both providers |
| OFFL-06 | 12-01 | Online: push pending syncQueue items in order (creates, updates, deletes) | SATISFIED | pushChanges FIFO drain; order covered by syncService tests |
| OFFL-07 | 12-01 | Online: pull remote changes since last sync, merge LWW by updatedAt | SATISFIED | pullChanges incremental query + `>=` LWW; WR-01 cloud-guard; tests |
| OFFL-08 | 12-01 | New device sign-in seeds from Firestore, idempotent (no duplicates) | SATISFIED (device flow human) | seed.ts idempotent + queue-aware; seed-test 14/14; device flow in human items |
| OFFL-09 | 12-01 | Sync status indicator shows pending-sync count | SATISFIED (visual human) | SyncButton badge + last-sync line; 9 tests; layout is on-device |
| OFFL-10 | 12-01 | Network errors handled gracefully — queued changes persist until next sync | SATISFIED | pushChanges catch→break keeps queue; failure-path test passes |
| SYNC-01 | 12-01 | Push entries, categories, scheduled entries with correct paths/fields (amountCents) | SATISFIED | entryToCloud/categoryToCloud/scheduledToCloud; scheduled push tests |
| SYNC-02 | 12-01 | Pull merges into SQLite LWW by updatedAt | SATISFIED | Merge loops with `>=` tie-break; LWW tests incl. WR-01 |
| SYNC-03 | 12-01 | Delete sync: local deletes → Firestore; remote deletes → local SQLite | SATISFIED | deleteDoc push; full-fetch reconciliation (entries, both kinds, scheduled); tests |
| SYNC-04 | 12-01 | ID mapping: temp IDs remapped to Firestore doc IDs after push | SATISFIED | mapTempId transactional; remap test in syncService + idMapping suites |
| SYNC-05 | 12-01 | Manual sync button triggers full push+pull cycle | SATISFIED | SyncButton press → both providers' sync() → fullSync; 9 tests |
| SYNC-06 | 12-01 | Auto-sync on app foreground when online | SATISFIED (transition human) | AutoSync AppState listener + initial sync; wiring present; transition needs device |
| SYNC-07 | 12-01 | Firestore rules: scheduledEntries added, same uid-scoping | SATISFIED | rules block verified in both rules copies (deploy pending in console) |
| SYNC-08 | 12-01 | Firestore composite indexes updated for scheduledEntries | SATISFIED | indexes JSON + composite-index.md (deploy pending in console) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| App.tsx | 30-31, 45-46 | Stale comment: "providers fall back to Firestore reads" — providers now read SQLite exclusively (IN-01, review info-finding, out of fix scope) | ℹ️ Info | Comment-only inaccuracy; no runtime impact |
| App.tsx | 31 | Comment contradicts SQLite-only behavior | ℹ️ Info | Same as above |

No TBD/FIXME/XXX/PLACEHOLDER markers in any phase key file. No stub implementations found (no `return null` placeholders, no empty handlers, no hardcoded empty data). ESLint is not runnable in this repo (pre-existing tooling gap documented in SUMMARY — `eslint.config.js` requires `eslint/config`; the plan's hard gate was tsc, which passes).

### Human Verification Required

6 items — all automated checks pass; these are on-device behaviors (phase config `human_verify_mode: end-of-phase`, matching the Phase 11 convention and plan Tasks 11-12):

1. **Auto-sync on foreground (SYNC-06)** — background the app, add an entry, foreground the app; the entry syncs to Firestore without pressing the sync button. Expected: AppState 'active' fires AutoSync → fullSync; badge clears. Why human: AppState + provider tree only exercisable on a device (SUMMARY D6).
2. **Offline CRUD (Task 11)** — wifi off; add/edit/delete entries and categories; SyncButton badge shows the pending count. Expected: all writes work instantly from SQLite. Why human: requires the user's phone with wifi disabled.
3. **Kill + reopen offline persistence (Task 11)** — kill the app with wifi off, reopen; offline-added data is still there. Expected: SQLite survives the restart; queue unchanged. Why human: durable storage across an app kill needs the real device DB.
4. **Reconnect sync (Task 11)** — wifi on; tap sync (or foreground); queued changes push to Firestore and the badge clears. Expected: fullSync drains; last-sync time updates. Why human: end-to-end Firestore round-trip.
5. **New device seed + two-device propagation (Task 12)** — sign in on device 2 (seeds without duplicates); edit on device 2, sync, then sync device 1; changes propagate both ways. Why human: two phones via Expo Go (OFFL-08/SYNC-03).
6. **SyncButton visual (OFFL-09)** — header shows refresh icon, red pending badge, "synced Xm ago" line; updates after local writes (WR-04). Why human: visual layout judgment (SUMMARY D7).

### Gaps Summary

No gaps found. All 10 roadmap success criteria have passing automated evidence (8 fully verified; 2 present-and-wired with on-device behavior pending). All 16 requirement IDs are satisfied at code level. The two behavior-unverified truths and the 6 human items are device flows that cannot run in this environment — they route to the end-of-phase human checkpoint (plan Tasks 11-12, already recorded in `.planning/WINDOWS.md` ids 2-3).

**Before first real sync on-device (user setup, not a code gap):** deploy the Firestore artifacts — composite index `entries: uid ASC, updatedAt ASC` (required, otherwise every pull throws `The query requires an index.`), plus the updated rules and the `scheduledEntries` index (recommended; scheduled sync stays best-effort until then).

---

_Verified: 2026-08-12T06:20:00Z_
_Verifier: the agent (gsd-verifier)_
