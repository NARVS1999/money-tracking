---
phase: 15-homepage-upcoming
reviewed: 2026-08-12T01:07:14Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/components/UpcomingSection.tsx
  - src/components/__tests__/UpcomingSection.test.tsx
  - src/screens/HomeScreen.tsx
  - src/screens/__tests__/HomeScreenUpcoming.test.tsx
  - src/theme/tokens.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-08-12T01:07:14Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the phase-15 changes: the new `UpcomingSection` component, the HomeScreen integration (`useScheduledEntries` wiring, `sortUpcoming`, edit-mode navigation), and the four new theme tokens, plus both new test files (checked for test reliability only). Cross-referenced against `src/lib/frequency.ts`, `src/scheduled/ScheduledEntriesProvider.tsx`, `src/scheduled/scheduler.ts`, `ScheduledEntryRow.tsx` (visual contract), `App.tsx` (provider mounting, route registration) and the 15-UI-SPEC.

The implementation is faithful to the UI-SPEC: component contract (theme prop object, null-at-zero, tap-only rows, last-row borderless), placement between quick actions and charts with expenses-first ordering, `sortUpcoming` correctness (string-compare of YYYY-MM-DD, stable, null-next last), income teal vs expense red accents, and token names matching the spec. No security surface exists in this change (no user input, no writes, no network paths). Navigation to `ScheduledEntryForm` from the tab navigator bubbles to the root stack where the screen is registered (same pattern as ExportScreen, phase 14); `ScheduledEntriesProvider` wraps the tree in `App.tsx`, so `useScheduledEntries()` is safe at runtime.

The two warnings concern the semantics of the "Upcoming" promise itself — both inherited from the phase-14 `getNextOccurrence` helper that this phase deliberately reuses, but now surfaced on the home screen where the section title makes the promise: the displayed "Next:" date can be stale (past) within a long-lived session, and exhausted templates (once-already-generated / endDate passed) remain listed in the "Upcoming" sections forever. Neither is a crash or data-loss issue; both are display-correctness defects in the new feature.

## Warnings

### WR-01: "Next:" date can be stale (in the past) or skip a pending occurrence — the section promises "Upcoming" but can show past dates

**File:** `src/components/UpcomingSection.tsx:97-106` (logic inherited from `src/lib/frequency.ts:49-60`; mirrored in `src/components/ScheduledEntryRow.tsx:53-62`)
**Issue:** `getNextOccurrence` anchors on `lastGenerated ?? startDate` and never clamps to today. The scheduler only runs once per sign-in at startup (`ScheduledEntriesProvider.tsx:125-148`), so:
- If the app session spans a date boundary (app left open/backgrounded overnight), a daily template shows `Daily · Next: {yesterday}` — a past date — inside a section titled "Upcoming".
- A template created mid-session has `lastGenerated = null`; a weekly template created today displays `Next: {today + 7d}`, but the engine will generate the *start-date* occurrence (today) at the next startup — the UI's "next" skips a due occurrence the user will actually see.
The 15-UI-SPEC locked the "verbatim" reuse of `getNextOccurrence`, but the phase-14 Export context (a management list) and the phase-15 Home context (an "Upcoming" indicator) make different promises with the same helper.
**Fix:** Clamp the display anchor to today in the display path — e.g., add a display variant in `src/lib/frequency.ts` that computes `next = getNextOccurrence(...)` from `max(lastGenerated ?? startDate, today)`, and use it in both `UpcomingSection` and `ScheduledEntryRow`; or re-run the scheduler on app foreground so `lastGenerated` stays current. Do not fix it inline in only one row component (see IN-01).

### WR-02: Exhausted templates never leave the "Upcoming" sections — permanent clutter that is not "upcoming"

**File:** `src/screens/HomeScreen.tsx:147-154` + `src/components/UpcomingSection.tsx:103-106`
**Issue:** The per-type filter only checks `isActive`, and `sortUpcoming` places null-next entries *last* — it never removes them. Any active template whose pattern is exhausted — a "once" template already generated (`lastGenerated` set) or a repeating template whose `endDate` is in the past — renders its start date with no "Next:" prefix and stays in the list **indefinitely** (until the user manually pauses/deletes it in the Export tab). A once template generated months ago permanently shows `Once · Mar 2` under "Upcoming Expenses". The section title promises upcoming occurrences; these rows are finished, and the user has no affordance on Home to dismiss them (tap only opens edit mode). The UI-SPEC locked the *display* of once/finished rows (start date, no "Next:") but never addressed whether exhausted templates belong in an "Upcoming" list at all.
**Fix:** Exclude templates with no possible future occurrence from the upcoming lists — e.g., filter `nextDate !== null || endDate === null || endDate >= today` per type (a once template whose start date is still ahead stays; a once template already in the past drops out), or add an explicit finished state surfaced in the Export tab. At minimum, apply the filter in `HomeScreen` alongside the `isActive` filter so both sections share it.

## Info

### IN-01: Secondary-line computation duplicated verbatim between UpcomingRow and ScheduledEntryRow

**File:** `src/components/UpcomingSection.tsx:97-106` vs `src/components/ScheduledEntryRow.tsx:53-62`
**Issue:** Both components independently compute `getNextOccurrence` → `nextDate ?? entry.date` → `{frequency} · Next: {date}` / `{frequency} · {date}`. The comment in UpcomingSection even says "verbatim". Any fix to WR-01/WR-02 semantics must now be applied in two files, and the duplication is exactly how the two displays can drift apart.
**Fix:** Extract a shared helper — e.g. `formatScheduledSecondary(entry: ScheduledEntry): string` in `src/lib/frequency.ts` — and call it from both rows.

### IN-02: UpcomingSection theme prop objects rebuilt inline on every HomeScreen render

**File:** `src/screens/HomeScreen.tsx:231-235, 241-245`
**Issue:** The `{ bg, border, accent }` objects are constructed inline in JSX, so a fresh object identity is passed on every HomeScreen render. Harmless at this scale, but the values are fixed per type — hoisting them to module-level constants would make the intent explicit and keep the render path cleaner.
**Fix:**
```ts
const UPCOMING_EXPENSE_THEME: UpcomingSectionTheme = {
  bg: colors.upcomingExpenseBg,
  border: colors.upcomingExpenseBorder,
  accent: colors.expense,
};
const UPCOMING_INCOME_THEME: UpcomingSectionTheme = {
  bg: colors.upcomingIncomeBg,
  border: colors.upcomingIncomeBorder,
  accent: colors.teal,
};
```
(place next to `sortUpcoming` in `HomeScreen.tsx`)

---

_Reviewed: 2026-08-12T01:07:14Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
