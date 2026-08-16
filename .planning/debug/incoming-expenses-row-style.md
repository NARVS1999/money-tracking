---
slug: incoming-expenses-row-style
status: resolved
trigger: |
  fixed the incoming expenses row : make it like on expenses row on homepages both location
created: 2026-08-16
updated: 2026-08-16
---

# Debug Session: incoming-expenses-row-style

## Symptoms

- Expected: The Upcoming rows on the Home screen (both "Upcoming Expenses" AND "Upcoming Income" sections) should look like the category-breakdown rows in the "Expenses"/"Income" sections on the same screen — icon + category name + "N of M" count line + right-aligned colored amount (CategorySection row style).
- Actual: The Upcoming rows currently use the UpcomingRow style — icon + description (or category name) + "Weekly · Next: date" secondary line + right-aligned colored amount (UpcomingSection/UpcomingRow in src/components/UpcomingSection.tsx).
- Error: None — visual styling change request, no crash or console error.
- Timeline: User explicitly asked for the change ("make it like on expenses row on homepages both location").
- Reproduction: Open Home screen with active scheduled entries; both Upcoming sections render rows in UpcomingRow style, differing from the category-breakdown rows in the Expenses/Income sections.
- "both location" confirmed by user = both "Upcoming Expenses" and "Upcoming Income" sections on the Home screen.
- Target style confirmed by user = category-breakdown style (CategorySection row): category name + "N of M" + amount.

## Current Focus

- hypothesis: (resolved — see Resolution)

## Evidence

- timestamp: 2026-08-16 — Compared UpcomingRow (UpcomingSection.tsx) vs CategorySection row (CategorySection.tsx). Deltas found: (1) primary line shows `entry.description || categoryName` at weight 400 vs `categoryName` at weight 600; (2) secondary line is `{Frequency} · Next: {date}` vs `{index+1} of {count}` at 13px; (3) icon (44px), right-aligned amount, themed accent color, last-row borderless pattern, and card chrome already match.
- timestamp: 2026-08-16 — HomeScreen.tsx renders both `<UpcomingSection>` (lines 289, 309) with themes accenting expense red #DC2626 / income teal #45C0CF; both sections use the same UpcomingRow, so a single component fix covers "both location". Confirmed no other consumers of UpcomingSection (grep).
- timestamp: 2026-08-16 — ScheduledEntryRow.tsx (Export tab) retains the full schedule-info contract (`Weekly · Next: date`), so dropping the secondary date line from the Home Upcoming rows loses no capability — the schedule detail remains available in the Export tab.
- timestamp: 2026-08-16 — Test impact mapped: UpcomingSection.test.tsx asserts description-primary and `Weekly · Next:` lines; HomeScreenUpcoming.test.tsx identifies rows by description text. Both must be updated to the category-name + count contract.

## Resolution

- root_cause: UpcomingRow in src/components/UpcomingSection.tsx implemented a different visual contract (description-or-category primary + "{Frequency} · Next: {date}" secondary) than the category-breakdown rows in CategorySection.tsx (category name at weight 600 + "{n} of {count}" count line at 13px), so the Upcoming sections on Home looked unlike the Expenses/Income breakdown rows.
- fix: Restyled UpcomingRow to match the CategorySection row contract — primary line is now always the category name at weight 600, secondary line is "{index+1} of {count}" at 13px (single template string so it renders as one text node), keeping the 44px icon, right-aligned themed amount (expense red / income teal), tap-to-edit wiring, themed card chrome, and last-row borderless pattern. Both Upcoming sections on Home render this component, so the single change covers "both location". Updated UpcomingSection.test.tsx and HomeScreenUpcoming.test.tsx to the new contract (rows identified by category name; ordering/nav tests use non-colliding categories since the fixture entry's "Housing" also appears in the chart legend and breakdown). Verified: 26/26 tests pass across both suites; the 3 scheduler/ScheduledEntryForm failures and the 11 firebase auth/invalid-api-key suite-load failures are pre-existing (reproduced with the fix stashed).
- tests_updated: src/components/__tests__/UpcomingSection.test.tsx, src/screens/__tests__/HomeScreenUpcoming.test.tsx
