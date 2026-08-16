---
phase: 13-recurring-entries-data
fixed_at: 2026-08-11T22:47:25Z
review_path: .planning/phases/13-recurring-entries-data/13-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-08-11T22:47:25Z
**Source review:** `.planning/phases/13-recurring-entries-data/13-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (1 Critical, 4 Warning — Info findings out of scope)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Scheduler never syncs `lastGenerated` to Firestore — every fresh pull regenerates full history (duplicate entries)

**Files modified:** `src/scheduled/scheduler.ts`, `src/scheduled/__tests__/scheduler-test.ts`, `src/scheduled/__tests__/ScheduledEntriesProvider.test.tsx`
**Commit:** `a81f26f`
**Applied fix:** `runScheduler` now enqueues a `scheduledEntries` update op for the template immediately after advancing `lastGenerated` (`enqueue(uid, "scheduledEntries", template.id, "update")`), and bumps the template's `updatedAt` to `Date.now()` — matching the provider's own `updateScheduled` so the cloud copy loses last-write-wins to this advancement on other devices and the push-time gate (`syncService.ts:306`) sees the local copy as at-least-as-new. Push is strictly queue-driven, so this op is what propagates the advancement to Firestore; a fresh pull of the template now converges to the advanced anchor instead of regenerating the whole history as duplicate entries. The remote-delete reconciliation gap noted in the finding is also closed: the advancement forces `synced = 0` locally and the queued update op flips it back to `synced = 1` on push confirmation, so `pullChanges`' reconcile can again propagate template deletions made on other devices. Tests updated (IN-04): `scheduler-test.ts` asserts the queue now holds 2 entry creates **plus** a `scheduledEntries`/`update` op for the template (and that `updatedAt` advanced); the provider wiring test asserts both the entries create and the `scheduledEntries` update enqueue.

### WR-01: `runScheduler` is not crash-safe — kill mid-run duplicates entries on restart

**Files modified:** `src/scheduled/scheduler.ts`, `src/scheduled/__tests__/scheduler-test.ts`, `.planning/phases/13-recurring-entries-data/13-01-SUMMARY.md`
**Commit:** `12dc029`
**Applied fix:** Chosen approach (documented in `13-01-SUMMARY.md` key-decisions): each template's generation now runs inside a single SQLite transaction (`db.withTransactionAsync`) covering the entry inserts, their queue ops, and the `lastGenerated` advancement (with its queued update). On any failure — including a kill between an insert and the advancement — everything rolls back, the template stays at its old un-advanced anchor, and the next startup regenerates exactly the same dates (restart-convergence, no duplicates). Advancing-before-inserts was rejected because a failure after the advancement would permanently lose the generated dates; inserting without a transaction is precisely the mid-run-kill window that duplicates entries. Test added: a mid-generation queue-write failure rejects `runScheduler`, leaves `entries`/`syncQueue` empty, and leaves the template's `lastGenerated`/`updatedAt` untouched.

### WR-02: Same-uid sign-out → sign-in skips the scheduler for the rest of the app session

**Files modified:** `src/scheduled/ScheduledEntriesProvider.tsx`, `src/scheduled/__tests__/ScheduledEntriesProvider.test.tsx`
**Commit:** `e56e722`
**Applied fix:** The startup scheduler effect now has an explicit signed-out branch: when `user` is null it resets `schedulerRanFor.current = null` (and returns). A same-uid sign-out → sign-in cycle within one app session therefore re-runs the scheduler on the next sign-in, generating occurrences that came due while signed out. Test added: sign-out clears the provider state, a new due template is inserted, re-sign-in as the **same** uid generates for it (entries table grows), where the pre-fix code skipped generation for the whole session.

### WR-03: Editing a template's `date`/`frequency` desyncs the generation anchor — `lastGenerated` is not reset

**Files modified:** `src/scheduled/ScheduledEntriesProvider.tsx`, `src/scheduled/__tests__/ScheduledEntriesProvider.test.tsx`
**Commit:** `c5588c6`
**Applied fix:** `updateScheduled` now resets `changes.lastGenerated = null` whenever `date` or `frequency` is in the edit input (both the DB update and the state mirror), so the engine re-derives occurrences from the new start date instead of scanning from the old anchor — closing the silent-missing-entries paths (shifted weekly phase, changed day-of-month, daily→weekly switch). Test added: editing `date` and then `frequency` clears `lastGenerated` in both SQLite and provider state, with the queue still receiving the update op.

### WR-04: ScheduledEntriesProvider state goes stale after background auto-sync

**Files modified:** `src/sync/AutoSync.tsx`
**Commit:** `1c4cceb`
**Applied fix:** `AutoSync` now also consumes `useScheduledEntries()` and its `sync()` is included in the settled list: `Promise.allSettled([entriesSync(), categoriesSync(), scheduledSync()])` (dependency array updated). Since `scheduledSync` reloads the provider's state from SQLite after the `fullSync` push+pull (coalesced by the in-flight lock), templates created or edited on another device now appear in the UI after the initial/foreground auto-sync instead of only on sign-in or manual sync. Header comment updated ("both providers" → all three, rendering requirement).

## Verification

- `npx tsc --noEmit` — clean (exit 0)
- `npx jest --testPathPattern="src/scheduled|src/lib|src/db/__tests__"` — **218 passed** (14 suites), including the 3 new tests above and the CR-01 queue-op assertions

## Not Fixed (out of scope — Info findings)

IN-01 (unknown-frequency pass-through), IN-02 (`endDate: undefined` state mirror), IN-03 (date/amount validation in `ScheduledInput`) were not addressed in this pass — the review's in-scope set was Critical + Warning only. They remain candidate work for a follow-up.
