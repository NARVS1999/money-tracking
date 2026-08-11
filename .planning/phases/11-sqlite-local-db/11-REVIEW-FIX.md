---
phase: 11-sqlite-local-db
fixed_at: 2026-08-12T05:00:00Z
review_path: .planning/phases/11-sqlite-local-db/11-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-08-12T05:00:00Z
**Source review:** `.planning/phases/11-sqlite-local-db/11-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (2 Critical, 3 Warning — Info findings out of scope)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: syncQueue has no uid column — cross-account sync corruption on account switch

**Files modified:** `src/db/schema.ts`, `src/db/syncQueue.ts`
**Commit:** `171c727`
**Applied fix:** Added `uid TEXT NOT NULL` to the `syncQueue` table and a composite `idx_syncQueue_uid ON syncQueue (uid, id)` index in `SCHEMA_SQL`. Threaded `uid` through the whole queue API — `enqueue(uid, ...)` stores it, and `getQueue(uid)`, `dequeue(uid, id)`, `clearQueue(uid)`, `removeByDocId(uid, ...)` all filter on it. `SyncQueueItem` now carries `uid`. The Phase 12 sync drain cannot touch another account's pending ops, and `clearQueue` no longer wipes both accounts' queues.

### CR-02: getUnsynced* getters are not uid-scoped — Phase 12 drain pushes another account's rows

**Files modified:** `src/db/entries.ts`, `src/db/categories.ts`, `src/db/scheduled.ts`
**Commit:** `369b8af`
**Applied fix:** `getUnsyncedEntries(uid)`, `getUnsyncedCategories(uid)`, and `getUnsyncedScheduled(uid)` now take a required `uid` parameter and run `WHERE uid = ? AND synced = 0`, consistent with every other query in the three modules. A signed-in user's sync drain can only collect that user's own unsynced rows.

### WR-01: update/delete/markSynced target rows by id only — no uid verification

**Files modified:** `src/db/entries.ts`, `src/db/categories.ts`, `src/db/scheduled.ts`
**Commit:** `4f5d528`
**Applied fix:** `updateEntry`/`updateCategory`/`updateScheduled`, `deleteEntry`/`deleteCategory`/`deleteScheduled`, and all three `markSynced` functions now require `uid` as the first parameter and scope their WHERE clause as `id = ? AND uid = ?`, so a stale or cross-uid id cannot silently update/delete another account's local row. This matches the module headers' claim that ownership is enforced at the SQL layer.

### WR-02: seed idempotency check is all-or-nothing and check-then-act (non-atomic)

**File:** `src/db/seed.ts`
**Commit:** `b172297`
**Applied fix:** Replaced the all-or-nothing skip (`alreadyHasEntries || alreadyHasCategories`) with per-table seeding: the fast path returns early only when **both** tables are populated; otherwise the per-table `hasEntries(uid)` / `hasCategories(uid)` checks run **inside** the `withTransactionAsync` block, so a uid with a partial ledger still seeds whichever table is missing. PK conflicts (a concurrent seed's row winning the race) are caught per-row via `isPkConflict()` and skipped, keeping the existing local row authoritative; any other error propagates and rolls the transaction back. `SeedResult` now reports actual inserted counts.

### WR-03: `synced` flag is caller-controlled on updates — silent non-push risk in Phase 12

**Files modified:** `src/db/entries.ts`, `src/db/categories.ts`, `src/db/scheduled.ts`
**Commit:** `ec41063`
**Applied fix:** In all three update functions, `synced` is now reserved for the sync service: callers may only pass `synced: 1` (the sync-confirmation path), any other value is dropped from the column set, and any data-column change forces `synced = 0` in the emitted SQL. A Phase 12 caller that forgets `synced: 0` on an edit can no longer silently leave the row marked as pushed — the edit is always queued for the next drain.

## Verification

- `npx tsc --noEmit` from repo root (worktree): **clean, 0 errors** (run after all five fix commits).
- No DB-layer unit tests exist yet; provider/screen tests mock the providers and are unaffected by the signature changes (no callers of the changed `src/db/*` functions exist outside `seedFromFirestore`, which keeps its `(uid)` signature).

---

_Fixed: 2026-08-12T05:00:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
