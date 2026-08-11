---
phase: 12-offline-providers-sync
reviewed: 2026-08-12T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - App.tsx
  - deploy/composite-index.md
  - deploy/firestore.rules
  - firestore.indexes.json
  - jest/firestore-mock.ts
  - jest/sqlite-mock.ts
  - src/categories/CategoriesProvider.tsx
  - src/components/SyncButton.tsx
  - src/db/categories.ts
  - src/db/database.ts
  - src/db/entries.ts
  - src/db/scheduled.ts
  - src/db/schema.ts
  - src/db/seed.ts
  - src/db/syncQueue.ts
  - src/entries/EntriesProvider.tsx
  - src/firebase/queries.ts
  - src/sync/AutoSync.tsx
  - src/sync/__tests__/syncService-test.ts
  - src/sync/idMapping.ts
  - src/sync/syncMetadata.ts
  - src/sync/syncService.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: fixed
fix_status:
  fixed: 5
  skipped: 0
  fixed_at: 2026-08-12T00:00:00Z
  fix_report: 12-REVIEW-FIX.md
---

# Phase 12: Code Review Report

**Reviewed:** 2026-08-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found → fixed (all 5 Warning findings resolved; see [12-REVIEW-FIX.md](12-REVIEW-FIX.md))

## Summary

Reviewed the offline-first providers + sync layer: `src/sync/` (syncService, idMapping, syncMetadata, AutoSync), the SQLite-backed `EntriesProvider`/`CategoriesProvider`, `SyncButton`, `App.tsx` wiring, schema v2 migration (`schema.ts`/`database.ts`), the updated db CRUD modules, seed, Firestore rules/indexes, and the jest mocks + sync test suite.

Overall the implementation is solid: the FIFO drain with temp-id remapping, uid-scoping at the SQL layer, the WR-03 `synced`-flag contract enforcement in the db layer, the schema v2 migration guards, and the Firestore rules/index artifacts are all consistent with the plan and with each other. The two self-fixed bugs during Task 10 (synced flag never flipped; category reconcile deleting the wrong kind) are correctly resolved in the final code, and the syncService test suite covers the main contracts well.

**Verification caveat:** `node_modules` is not installed in this environment, so `npx jest` and `npx tsc --noEmit` could not be re-run here; the executor's claims (120 tests green, tsc exit 0) were taken from 12-01-SUMMARY.md. Findings below are from direct code tracing.

The main concerns are all in the sync **conflict and lifecycle edges** rather than the happy path:

1. **Push overwrites newer cloud state** — a full-doc `setDoc` push of a stale offline edit regresses the cloud doc's `updatedAt`, and the pull-side `>=` tie-break then keeps the stale local copy. A concurrent edit on another device is silently destroyed (WR-01).
2. **Queued offline deletes can be discarded** — a pull merge resurrects a cloud doc that a pending delete op targets, and `removeByDocId` drops the delete op itself (WR-02).
3. **The seed fast-path ignores the syncQueue** — deleting all entries/categories offline, then reopening the app online, re-seeds the deleted rows from the cloud with `synced = 1` (WR-03).

All three (plus the stale badge WR-04 and the mock fidelity gap WR-05) are fixed as of 2026-08-12 — see [12-REVIEW-FIX.md](12-REVIEW-FIX.md). WR-01's approach: the push now fetches the cloud copy before an update and only writes when `local.updatedAt >= cloud updatedAt`; a stale op is dropped and the pull converges the local row to the cloud copy.

## Warnings

### WR-01: Push of a stale offline edit silently destroys a newer cloud edit (LWW regression)

**File:** `src/sync/syncService.ts:263-294` (push update branch), `417` (`local.updatedAt >= cloudUpdatedAt` tie-break), `508`
**Issue:** Updates are pushed as full-doc `setDoc` carrying the **local** row's `updatedAt` (client clock). If device A has a queued offline edit (updatedAt=100) while device B edited the same doc at t=200 and synced, A's next sync: (1) pushes A's stale copy, regressing the cloud doc to updatedAt=100 — B's edit is overwritten; (2) the pull then fetches the doc (100 > watermark), and the `>=` tie-break keeps A's local copy. B's newer edit is permanently lost on both devices and the cloud, and neither device ever sees a conflict. The pull-side LWW (SYNC-02) only protects docs the pushing device did not just write — the push-then-pull ordering makes it mostly cosmetic for the device's own pending edits. No clock skew is even required for the overwrite; skew only decides which copy "wins" arbitrarily.
**Fix:** Never regress the cloud timestamp. Before pushing an update, fetch the cloud doc and only `setDoc` when `local.updatedAt >= cloudUpdatedAt`, else drop the op (cloud wins). Alternatively write `updatedAt` as `serverTimestamp()` for cloud-authoritative LWW. At minimum, change the pull tie-break to `local.updatedAt > cloudUpdatedAt` and make `pushChanges` skip pushing when the cloud copy is newer.

### WR-02: Offline delete can be silently discarded when a newer cloud copy exists

**File:** `src/sync/syncService.ts:414-431` (entry merge), `340` (`removeByDocId` in `replaceEntryFromCloud`; same pattern 361, 388)
**Issue:** When a user deletes an entry offline (row deleted, delete op queued) and the same doc has been updated on the cloud since the last sync (another device edited it), a sync whose push fails mid-drain (e.g., the earlier scheduledEntries op hits the not-yet-deployed rules and `break`s) still runs `pullChanges`. The cloud doc (updatedAt > watermark) has no local row → `replaceEntryFromCloud` re-inserts the row AND `removeByDocId` deletes **all** queued ops for it — including the pending delete. The user's delete is permanently discarded: the entry is resurrected locally and the delete op no longer exists to push. `pushChanges` returning normally on item failure (line 304-312, by design per OFFL-10) makes this reachable whenever a partial failure is followed by a successful pull.
**Fix:** In the pull merge, skip docs that have a queued delete op (or make `removeByDocId` only drop `create`/`update` ops, never `delete`). Also consider making `fullSync` skip the pull when `pushChanges` failed to drain the queue.

### WR-03: Seed fast-path resurrects rows deleted offline (queue not consulted)

**File:** `src/db/seed.ts:83-89`
**Issue:** `seedFromFirestore` skips seeding only when `hasEntries(uid) && hasCategories(uid)`. If the user deleted **all** their entries (or categories) offline, the tables are empty, so the next app launch with connectivity re-fetches the still-existing cloud docs and inserts them with `synced: 1` — the deleted data visibly returns, and the queued delete ops are now disconnected from the rows (they still push, deleting the cloud docs, so the data then vanishes again on the next sync — but if the user re-edits a resurrected row before that sync, the edit op follows the delete op and re-creates the doc). The "is the ledger populated" check must be queue-aware.
**Fix:** Treat a uid with pending queue ops as "populated": `if ((hasEntries || hasQueuedOps(uid)) && (hasCategories || hasQueuedOps(uid))) return { seeded: false, ... }` — or simply skip seeding whenever `getQueue(uid).length > 0`.

### WR-04: SyncButton pending badge is stale after local writes

**File:** `src/components/SyncButton.tsx:43-58`
**Issue:** `refreshStatus` runs only on mount and when `syncing` flips. After the user adds/edits/deletes an entry (queue grows) without syncing, the badge keeps showing the previous count (e.g., 0) until the next sync run or remount — OFFL-09's "pending changes" indicator is wrong exactly when it matters most (offline use). No provider or db layer event triggers a refresh on enqueue.
**Fix:** Expose a `pendingCount` (or a queue-change event/subscription) from the providers — e.g., increment an in-memory counter on `enqueue` and read it in `refreshStatus` — or subscribe to a lightweight queue listener that fires on enqueue/dequeue.

### WR-05: sqlite-mock lacks `ON CONFLICT` upsert support — the syncMeta watermark upsert is untested

**File:** `jest/sqlite-mock.ts:123-159` (INSERT handler); `src/sync/syncMetadata.ts:23-28`
**Issue:** The mock's INSERT parser has no handling for `ON CONFLICT(uid) DO UPDATE`; a second `setLastSync(uid, ...)` for the same uid throws `PRIMARY KEY constraint failed: syncMeta`. Every production sync after the first advances the watermark through this upsert, but no test exercises it (the fullSync tests only call it once per uid; the concurrent-call test is coalesced into one run). A regression in the upsert (e.g., wrong conflict target) would only surface on-device. This is a test-fidelity gap in the phase's own mock that masks the single most frequently executed sync path.
**Fix:** Implement the upsert in the mock (on PK conflict, update the existing row instead of throwing), then add a test that calls `fullSync` twice for the same uid and asserts the watermark advances monotonically.

## Info

### IN-01: Stale comment in App.tsx — providers no longer fall back to Firestore reads

**File:** `App.tsx:30-31`
**Issue:** The `SeedOnSignIn` comment says "providers fall back to Firestore reads" on seed failure, but both providers now read SQLite exclusively; a failed seed means an empty ledger until the next successful sync, not a Firestore fallback.
**Fix:** Update the comment to match the SQLite-only behavior (empty ledger + sync retry), as EntriesProvider.tsx:106 already documents.

### IN-02: Crash window between `mapTempId` and `dequeue` can duplicate or orphan pushes

**File:** `src/sync/idMapping.ts:33-90`; `src/sync/syncService.ts:189-199`
**Issue:** `mapTempId` remaps the SQLite row id and its references, but not the still-queued op's `docId`; the op is dequeued in a separate, later statement. If the app is killed between the two, the next sync finds no row under the temp id and drops the create op — but a queued update op for the same temp id is then also unresolvable and dropped, so the cloud keeps the create-time state while SQLite holds the newer state (silent divergence until the user edits again). A duplicate create is also possible if the kill lands between the cloud `addDoc` and the local remap.
**Fix:** Rewrite `syncQueue.docId` (temp → real) inside the same `mapTempId` transaction.

### IN-03: Different-uid `fullSync` chaining skips the second sync when the in-flight run rejects

**File:** `src/sync/syncService.ts:549-552`
**Issue:** `inFlight.promise.then(() => fullSync(uid))` — if the in-flight run rejects, the `.then` is skipped and the waiting uid's sync never runs (its caller receives the first run's error). Acceptable (the next foreground/manual sync retries) but worth a comment or a `.catch(() => fullSync(uid))` if account-switch-mid-sync is expected to be robust.
**Fix:** Document the behavior, or chain with a catch that still schedules the second uid's sync.

### IN-04: CategoriesProvider state mirror stores untrimmed name

**File:** `src/categories/CategoriesProvider.tsx:229`
**Issue:** The optimistic mirror spreads the raw `updates` (`name` untrimmed), while the db write stores the trimmed name; after a rename with surrounding whitespace the UI shows the untrimmed value until the next reload.
**Fix:** Mirror `name: updates.name ? updates.name.trim() : c.name` instead of spreading `updates`.

### IN-05: scheduledEntries create rule lacks the integer-cents guard

**File:** `deploy/firestore.rules:42-46`
**Issue:** The `entries` create rule enforces `request.resource.data.amountCents is int` (line 27, NFR-03), but the new `scheduledEntries` block does not — the app always writes integers, so this is hardening only, but the server-side invariant is inconsistent across collections.
**Fix:** Add `&& request.resource.data.amountCents is int` to the scheduledEntries create rule to match entries.

---

_Reviewed: 2026-08-12T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
