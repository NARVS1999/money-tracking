---
phase: 13-recurring-entries-data
reviewed: 2026-08-12T06:40:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/frequency.ts
  - src/lib/dates.ts
  - src/scheduled/scheduler.ts
  - src/scheduled/ScheduledEntriesProvider.tsx
  - src/entries/EntriesProvider.tsx
  - App.tsx
  - src/lib/__tests__/frequency-test.ts
  - src/lib/__tests__/dates-test.ts
  - src/scheduled/__tests__/scheduler-test.ts
  - src/scheduled/__tests__/ScheduledEntriesProvider.test.tsx
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-08-12T06:40:00Z
**Depth:** standard
**Files Reviewed:** 10 (6 source, 4 test)
**Status:** issues_found

## Summary

Reviewed the recurring-entries data layer: frequency/date utilities (`src/lib/frequency.ts`, `src/lib/dates.ts`), the auto-generation engine (`src/scheduled/scheduler.ts`), the new `ScheduledEntriesProvider`, the `EntriesProvider.reload()` addition, and `App.tsx` wiring — with cross-file tracing through `src/db/*`, `src/sync/syncService.ts`, `src/sync/AutoSync.tsx`, and `src/sync/idMapping.ts`.

The date/frequency math is well-constructed and thoroughly tested: day-equality monthly rules, leap-day yearly re-anchoring, DST-safe `daysBetween`, and the 5000-day scan bound are all sound and engine-consistent. The provider's offline-first write contract (SQLite + syncQueue mirror, temp ids, `synced = 0` forcing) matches the established EntriesProvider/CategoriesProvider pattern.

However, one **Critical** defect undermines the scheduler's core invariant: `lastGenerated` is advanced locally but **never enqueued for push**, so Firestore never learns how far a template has generated. Any fresh pull of the template (second device, reinstall, DB wipe + reseed) regenerates the entire history — duplicate entries in the ledger. The scheduler is also not crash-safe (kill mid-run duplicates), and the provider has several anchor/state-integrity gaps. Tests are strong but enshrine the missing-push behavior (they assert only the entry creates, never the template update), which is why the suite passes green with the Critical bug present.

## Critical Issues

### CR-01: Scheduler never syncs `lastGenerated` to Firestore — every fresh pull regenerates full history (duplicate entries)

**File:** `src/scheduled/scheduler.ts:122-124` (see also comments 92-95, `src/db/scheduled.ts:87-117`, `src/sync/syncService.ts:153-341`)

**Issue:** After materializing a template's dates, `runScheduler` calls `updateScheduled(uid, template.id, { lastGenerated })` — which forces `synced = 0` locally — but **never calls `enqueue(uid, "scheduledEntries", template.id, "update")`**. Push is strictly queue-driven (`pushChanges` iterates `syncQueue` only; `getUnsyncedScheduled` is dead code referenced solely by tests), so the template's cloud copy keeps its original `lastGenerated` (null for in-app-created templates) forever. The code comment at scheduler.ts:92-95 claims "a data change that also pushes to Firestore through the queue on the next sync (SCHD-05)" — the implementation does not do this.

Consequences:
- **Duplicate-entry generation:** any device or install that pulls the template fresh (second device, reinstall, SQLite wipe + `seedFromFirestore` reseed) sees `lastGenerated = null` and regenerates every occurrence since `start`, inserting and queueing duplicates of entries that already exist on the cloud ledger. For a money tracker this is ledger corruption, not cosmetic.
- **Remote-delete reconciliation permanently disabled for templates:** because the local row's `synced` is forced to 0 by the advancement and never confirmed (`markScheduledSynced` only fires for queued ops), `pullChanges`' reconcile (`syncService.ts:577-580`, which only deletes `synced === 1` rows absent from the cloud) will never propagate a template deletion made on another device.

**Fix:** Enqueue the template update after advancing, and bump `updatedAt` (matching the provider's own `updateScheduled`, which always bumps it — this also keeps the pull-side LWW and the WR-01 push gate (`syncService.ts:306`) on the correct side of the comparison):

```ts
// src/scheduled/scheduler.ts, runScheduler loop tail
await updateScheduled(uid, template.id, {
  lastGenerated: dates[dates.length - 1],
  updatedAt: Date.now(), // template's updatedAt must advance so the cloud copy wins LWW on other devices
});
await enqueue(uid, "scheduledEntries", template.id, "update");
```

Add a scheduler test asserting the queued `scheduledEntries` update op (see IN-04).

## Warnings

### WR-01: `runScheduler` is not crash-safe — kill mid-run duplicates entries on restart

**File:** `src/scheduled/scheduler.ts:103-124`

**Issue:** Per template, the loop inserts each generated entry (`insertEntry`) and enqueues its create **before** `updateScheduled` advances `lastGenerated`. These writes are not transactional. If the app is killed between the first `insertEntry` and the `lastGenerated` update — the exact kill-and-reopen scenario the project's core value and Task 8 manual verification exercise — the next startup re-reads the un-advanced `lastGenerated`, regenerates the same dates with fresh temp ids, and inserts **duplicate entries** (which then also push to Firestore). The "idempotent reruns" claim (scheduler.ts:7, 123) holds only when a run completes.

**Fix:** Wrap each template's generation in a single SQLite transaction so inserts, queueing, and the `lastGenerated` advancement commit atomically:

```ts
import { getDb } from "../db/database";
// ...
const db = await getDb();
await db.withTransactionAsync(async () => {
  for (const date of dates) {
    // insertEntry + enqueue as today
  }
  await updateScheduled(uid, template.id, { lastGenerated: dates[dates.length - 1] });
});
```

### WR-02: Same-uid sign-out → sign-in skips the scheduler for the rest of the app session

**File:** `src/scheduled/ScheduledEntriesProvider.tsx:124-140`

**Issue:** `schedulerRanFor.current` is set to the uid on the first run and never reset when `user` becomes null. Signing out and back in as the **same** account within one app session hits the `schedulerRanFor.current === user.uid` guard and returns early, so occurrences that came due while signed out are never generated until the next app restart. The stated contract ("runs once per sign-in", line 118) is actually "once per uid per app session".

**Fix:** Reset the ref in the signed-out branch:

```ts
useEffect(() => {
  if (!user) {
    schedulerRanFor.current = null;
    return;
  }
  // ...
}, [user, entriesLoading, reloadEntries]);
```

### WR-03: Editing a template's `date`/`frequency` desyncs the generation anchor — `lastGenerated` is not reset

**File:** `src/scheduled/ScheduledEntriesProvider.tsx:250-294` (with anchor semantics in `src/scheduled/scheduler.ts:49-69`, `src/lib/frequency.ts:53-79`)

**Issue:** `updateScheduled` persists `date` and `frequency` but leaves `lastGenerated` untouched. The engine then matches occurrences against the **new** anchor while scanning from the **old** `lastGenerated`: changing the start date shifts the weekly phase (occurrences between the new anchor and old `lastGenerated` are permanently skipped — the scan starts after `lastGenerated` and the engine never backfills), changing the day-of-month (31st → 15th) skips months, and a daily → weekly switch can silently stop generating until dates realign. Users editing a template get silently missing ledger entries.

**Fix:** When `date` or `frequency` changes, reset the generation anchor so the engine re-derives occurrences from the new start:

```ts
if (input.date !== undefined || input.frequency !== undefined) {
  changes.lastGenerated = null; // re-anchor generation from the new start date
}
```

### WR-04: ScheduledEntriesProvider state goes stale after background auto-sync

**File:** `src/sync/AutoSync.tsx:25` (unchanged this phase; integration gap with the new provider; pull path `src/sync/syncService.ts:538-584`)

**Issue:** `AutoSync` only calls `entriesSync()` and `categoriesSync()`. `pullChanges` does write pulled templates into the `scheduledEntries` SQLite table, but the provider's React state refreshes only on its own manual `sync()` or on sign-in — so templates created or edited on another device never appear in the UI after a background sync. The new provider claims to "mirror EntriesProvider/CategoriesProvider" (line 2) but is not wired into the same auto-refresh path.

**Fix:** Add the scheduled sync to AutoSync's settled list:

```tsx
const { sync: scheduledSync } = useScheduledEntries();
// ...
Promise.allSettled([entriesSync(), categoriesSync(), scheduledSync()])
```

## Info

### IN-01: `fromDb` coerces an unknown frequency to "once" while the engine treats it as never-matching

**File:** `src/scheduled/ScheduledEntriesProvider.tsx:96`

**Issue:** A hand-edited/forward-incompatible DB value like `"fortnightly"` is displayed as **"Once"** in the provider state, while `matchesFrequency` (frequency.ts:74-77) deliberately never matches unknown values — so the engine generates nothing. Divergent display vs. engine semantics: the user sees a "Once" template that never generates its start date, and a Phase 14 edit could silently rewrite the DB value to `"once"`. `formatFrequency` (frequency.ts:38-40) already has the correct pass-through behavior.

**Fix:** Pass the raw string through instead of coercing, mirroring `formatFrequency`:
```ts
frequency: isFrequency(row.frequency) ? row.frequency : row.frequency,
```
(or drop the guard and rely on the type narrowing at the UI boundary).

### IN-02: `updateScheduled` state mirror can produce `endDate: undefined` while the DB stores null

**File:** `src/scheduled/ScheduledEntriesProvider.tsx:284-286`

**Issue:** The state mirror `{ ...s, ...input }` spreads an explicitly passed `endDate: undefined` into state, while the DB layer maps it to `null` (`changes.endDate = input.endDate ?? null`). The public type is `endDate: string | null`; state can hold `undefined`, and a later UI render may treat it differently from null.

**Fix:** Mirror the DB normalization:
```ts
prev.map((s) =>
  s.id === id
    ? { ...s, ...input, endDate: input.endDate === undefined ? s.endDate : (input.endDate ?? null) }
    : s,
)
```

### IN-03: `ScheduledInput` date/amount fields are unvalidated

**File:** `src/scheduled/ScheduledEntriesProvider.tsx:195-248` (`addScheduled`/`updateScheduled`)

**Issue:** `date`, `endDate`, and `amount` pass through without checks. An unpadded or garbage date (e.g. `"2026-2-3"`) breaks lexicographic range ordering and `dayOfMonth`'s string slicing (`Number(s.slice(8, 10))` → NaN → silently never matches → generation silently stops). `isValid()` already exists in `src/lib/dates.ts` and is used nowhere here.

**Fix:** Validate before persisting:
```ts
if (!isValid(input.date)) throw new Error("Invalid date");
if (input.endDate && !isValid(input.endDate)) throw new Error("Invalid end date");
```

### IN-04: Test suite enshrines the CR-01 blind spot — no assertion that `lastGenerated` advances reach the queue

**File:** `src/scheduled/__tests__/scheduler-test.ts:173-177`, `src/scheduled/__tests__/ScheduledEntriesProvider.test.tsx:362-367`

**Issue:** Both tests assert exactly the generated entry creates (`queue` length 2 / `enqueue` called once) and never assert a queued `scheduledEntries` update for the template — which is precisely why CR-01 passes CI. The wiring test even checks the local `lastGenerated` advanced (line 374) without checking that the advancement is scheduled for push.

**Fix:** After fixing CR-01, extend both tests to assert an `enqueue(uid, "scheduledEntries", templateId, "update")` op accompanies the entry creates.

---

_Reviewed: 2026-08-12T06:40:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
