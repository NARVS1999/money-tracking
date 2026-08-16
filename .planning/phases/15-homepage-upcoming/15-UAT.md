---
status: complete
phase: 15-homepage-upcoming
source: 15-01-SUMMARY.md
started: 2026-08-16T09:00:00Z
updated: 2026-08-16T09:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Home Screen Shows Upcoming Expenses Section
expected: Open the Home screen. An "Upcoming Expenses" section appears between the quick-action buttons and the chart sections. It has a yellow tint background and red amounts.
result: pass

### 2. Home Screen Shows Upcoming Income Section
expected: Below the expenses section, an "Upcoming Income" section appears with yellow tint and teal amounts.
result: pass

### 3. Upcoming Rows Show Correct Info
expected: Each upcoming row shows description (or category name), "{Frequency} · Next: {date}", and the formatted amount. "Once" templates show their start date without "Next:".
result: pass

### 4. Sections Hidden When Empty
expected: If there are no active scheduled entries of a type, that section is hidden. If both are empty, no upcoming sections appear.
result: pass

### 5. Tapping Row Opens Edit Form
expected: Tap an upcoming row. The ScheduledEntryForm opens in edit mode with the entry's data pre-filled.
result: pass

### 6. Paused Entries Not Shown
expected: Paused scheduled entries do not appear in the upcoming sections.
result: [pending]

### 2. Home Screen Shows Upcoming Income Section
expected: Below the expenses section, an "Upcoming Income" section appears with yellow tint and teal amounts.
result: [pending]

### 3. Upcoming Rows Show Correct Info
expected: Each upcoming row shows description (or category name), "{Frequency} · Next: {date}", and the formatted amount. "Once" templates show their start date without "Next:".
result: [pending]

### 4. Sections Hidden When Empty
expected: If there are no active scheduled entries of a type, that section is hidden. If both are empty, no upcoming sections appear.
result: [pending]

### 5. Tapping Row Opens Edit Form
expected: Tap an upcoming row. The ScheduledEntryForm opens in edit mode with the entry's data pre-filled.
result: [pending]

### 6. Paused Entries Not Shown
expected: Paused scheduled entries do not appear in the upcoming sections.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
