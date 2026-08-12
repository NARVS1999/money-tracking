---
phase: 15-homepage-upcoming
fixed_at: 2026-08-12T01:24:38Z
review_path: .planning/phases/15-homepage-upcoming/15-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-08-12T01:24:38Z
**Source review:** `.planning/phases/15-homepage-upcoming/15-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (2 Warning — Info findings out of scope, per phase-14 convention)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: "Next:" date can be stale (in the past) or skip a pending occurrence

**Files modified:** `src/lib/frequency.ts`, `src/components/UpcomingSection.tsx`, `src/components/ScheduledEntryRow.tsx`, `src/screens/HomeScreen.tsx` (sort path only), `src/lib/__tests__/frequency-test.ts`, `src/components/__tests__/UpcomingSection.test.tsx`, `src/components/__tests__/ScheduledEntryRow.test.tsx`
**Commit:** `89ff6a9`
**Applied fix:** New display variant `getUpcomingOccurrence(startDate, frequency, lastGenerated, endDate, todayStr = today())` in `src/lib/frequency.ts`, used by **both** row components (UpcomingSection + ScheduledEntryRow) and by HomeScreen's `sortUpcoming` so the sort key matches the displayed date — the clamp logic lives in one shared place (IN-01's duplication concern):

1. Compute the engine-consistent next occurrence via the existing `getNextOccurrence`.
2. If it is at/after today, pass it through unchanged.
3. If it is **before today** (stale anchor — session spanning a date boundary), scan forward day-by-day from today for the pattern's first real occurrence (`matchesFrequency` anchored at the **true start date**, exactly like the scheduler's `getDatesToGenerate`, bounded like the engine's scan) — "show today or the next future occurrence" — still bounded by `endDate`.

Deliberate deviation from the review's literal "re-anchor at `max(lastGenerated ?? startDate, today)`" suggestion: re-anchoring changes the pattern's day-of-month / month-day (a monthly template anchored on the 31st would show Sep 12 instead of the real next occurrence Aug 31). The forward scan keeps the engine's day-equality anchoring — verified by the unit test "keeps the pattern's anchor day when clamping a stale monthly next (WR-01)".

`todayStr` is injectable (scheduler pattern) for deterministic unit tests; component tests pin the clock with `jest.useFakeTimers({ now: new Date(2026, 7, 12) })` (repo pattern: syncQueue-test / seed-test).

Tests: frequency unit tests cover pass-through (future next, future start), daily clamp to today, weekly clamp to the next future occurrence, monthly anchor-day preservation, yearly clamp, endDate boundary keep/drop, and once-never; component tests assert the row text ("Daily · Next: Aug 12" / "Weekly · Next: Aug 17") for stale anchors in both UpcomingSection and ScheduledEntryRow.

### WR-02: Exhausted templates never leave the "Upcoming" sections

**Files modified:** `src/screens/HomeScreen.tsx`, `src/screens/__tests__/HomeScreenUpcoming.test.tsx`
**Commit:** `2334f58`
**Applied fix:** New `hasUpcomingOccurrence(entry)` filter in `HomeScreen.tsx`, applied alongside the existing `isActive` filter in both `upcomingExpenses` / `upcomingIncome` memos (both sections share it):

- **once:** kept only while `date >= today` (start date still ahead — genuinely upcoming); a once template whose start date has passed drops out.
- **repeating:** kept only when `getUpcomingOccurrence(...) !== null` — i.e. there is a future occurrence within `endDate`. A template whose next occurrence (clamped to today) is beyond `endDate` can never generate again and drops out.

The filter runs before `sortUpcoming`, so null-next entries in the list are now only future once templates. Section "hidden when empty" behavior is unchanged — a type whose every template is exhausted renders nothing (HOME-UP-05). The Export tab's management list is untouched (the row itself still shows the start date without "Next:" for finished templates — locked phase-14/15 display).

Tests: "excludes an exhausted once template whose start date has passed (WR-02)", "excludes a repeating template whose pattern has ended (endDate passed) (WR-02)", "keeps a once template whose start date is still ahead (WR-02)", "hides the section entirely when every template of the type is exhausted (WR-02)"; the ordering test fixture was reworked (the old null-next once entry dated 08-01 is now correctly filtered, so the null-next-last case uses a future once template; B/A anchors updated so clamped next dates remain deterministic).

## Verification

- `npx tsc --noEmit` — clean (exit 0)
- `npx jest --testPathPattern="src/components/__tests__/UpcomingSection|src/screens/__tests__/HomeScreenUpcoming|src/lib/__tests__/frequency-test|src/components/__tests__/ScheduledEntryRow"` — **80 passed** (4 suites)
- `src/screens/__tests__/HomeScreen.test.tsx` fails at **load** with `Firebase: Error (auth/invalid-api-key)` — pre-existing environment limitation (it `requireActual`s the real EntriesProvider → firebase init at line 24, before HomeScreen code is evaluated); none of the load-path files were changed by this fix pass. Same documented limitation as the phase-14 fix report.

## Not Fixed (out of scope — Info findings)

IN-01 (secondary-line duplication) is partially addressed — the date math now lives in the shared `getUpcomingOccurrence` helper used by both rows; the full `formatScheduledSecondary` string helper was not extracted. IN-02 (inline theme objects in HomeScreen JSX) was not addressed — cosmetic only, `useMemo`-free re-render cost is nil at this scale.
