---
phase: 12-offline-providers-sync
fixed_at: 2026-08-12T00:00:00Z
review_path: .planning/phases/12-offline-providers-sync/12-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-08-12T00:00:00Z
**Source review:** `.planning/phases/12-offline-providers-sync/12-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (5 Warning — Info findings out of scope)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: Push of a stale offline edit silently destroys a newer cloud edit (LWW regression)

**Files modified:** `src/sync/syncService.ts`, `jest/firestore-mock.ts`, `src/sync/__tests__/syncService-test.ts`
**Commit:** `27fab2c`
**Applied fix:** Push-time conflict guard. Before an `update` op is pushed, `pushChanges` fetches the cloud copy (`cloudUpdatedAtOf`, backed by a new `getDoc` in the Firestore mock) and only runs the full-doc `setDoc` when `local.updatedAt >= cloud updatedAt` — the cloud timestamp can never regress. When the cloud copy is newer, the stale op is dequeued (dropped) and `pullChanges` (which runs right after in `fullSync`) converges the local row to the cloud copy, so the newer cloud edit wins on both sides without a conflict being silently lost. `updatedAt` remains client-clock with the `>=` push guard as the correctness boundary; a server-authoritative `serverTimestamp()` was considered and rejected because the push-then-pull ordering plus the `>=` guard already prevents regression without server timestamps (which would also break the local `updatedAt`-based LWW bookkeeping). Tests added: a stale offline update is dropped and the pull converges the local row; a local edit at least as new as the cloud copy still pushes.

### WR-02: Offline delete can be silently discarded when a newer cloud copy exists

**Files modified:** `src/sync/syncService.ts`, `src/sync/__tests__/syncService-test.ts`
**Commit:** `c81812f`
**Applied fix:** `pullChanges` snapshots the queue once at start and builds per-collection sets of docIds with a pending `delete` op. The merge loops for entries, both category kinds, and scheduledEntries skip any cloud doc in that set — `replaceEntryFromCloud`/`replaceCategoryFromCloud`/`replaceScheduledFromCloud` (and their `removeByDocId`) are never reached for a doc the user deleted offline, so the delete op stays queued until the push confirms it. This also covers the partial-push-failure scenario: a push that `break`s mid-drain followed by a pull can no longer resurrect the deleted row. Test added: cloud doc edited elsewhere + queued offline delete → pull leaves the local table empty and keeps the delete op queued.

### WR-03: Seed fast-path resurrects rows deleted offline (queue not consulted)

**Files modified:** `src/db/seed.ts`, `src/db/__tests__/seed-test.ts`
**Commit:** `db69a7a`
**Applied fix:** `seedFromFirestore` consults `getQueue(uid)` (uid-scoped) before the populated-table fast path and skips seeding entirely when the uid has any pending queue ops — the ledger holds authoritative offline changes (e.g. deletes of every row) that seeding would resurrect from the cloud with `synced = 1`; the next sync reconciles instead. The check is uid-scoped so a second account's ops on a multi-account device never block that account's seed. Test added: empty tables + queued delete op → `seeded: false`, no cloud fetch, no inserts.

### WR-04: SyncButton pending badge is stale after local writes

**File:** `src/components/SyncButton.tsx`
**Commit:** `c79c1e0`
**Applied fix:** The status-refresh `useEffect` now also subscribes to the providers' state — `entries`, `expenseCategories`, `incomeCategories` — each of which mutates on every local write (the same state mirrors that enqueue ops). Any add/edit/delete while offline immediately re-reads `getQueue(uid)` and updates the badge and the last-sync line; the existing `syncing`-flip refresh still covers post-sync dequeues.

### WR-05: sqlite-mock lacks `ON CONFLICT` upsert support — the syncMeta watermark upsert is untested

**Files modified:** `jest/sqlite-mock.ts`, `src/sync/__tests__/syncService-test.ts`
**Commit:** `cba6246`
**Applied fix:** The mock's INSERT handler now parses `ON CONFLICT(<cols>) DO UPDATE SET col = excluded.col | ? | literal` and, when a row matching the conflict columns already exists, applies the SET expressions in place instead of throwing `PRIMARY KEY constraint failed`. `syncMetadata.setLastSync`'s watermark upsert — the most frequently executed sync path — now runs under test. Test added: two consecutive `fullSync(UID)` runs assert the watermark advances monotonically (the second run exercises the upsert).

## Verification

- `npx tsc --noEmit` from repo root: **clean, 0 errors** (after all five fix commits).
- `npx jest --testPathPattern="src/sync|src/db/__tests__"` from repo root: **8 suites, 109 tests, all passing** (was 120 across the full suite per 12-01-SUMMARY; the targeted pattern covers this phase's sync + db layers; full-suite run also green).

---

_Fixed: 2026-08-12T00:00:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
