# Phase 14: Export Tab — Scheduled UI - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Scheduled entry management UI in ExportScreen: ScheduledEntryRow list component (icon, description, amount, frequency, next date; swipe Edit/Delete/Pause-Resume), ScheduledEntryForm modal (EntryForm fields + 5-option frequency picker + optional end date), "Scheduled Entries" section in ExportScreen with Expenses/Income sub-sections, Add button, and empty state. Consumes ScheduledEntriesProvider from Phase 13.
</domain>

<decisions>
## Implementation Decisions

### ScheduledEntryRow
- Row layout mirrors EntryRow + CategorySection icon row: 44px CategoryIcon, `description || categoryName` primary, `{Frequency} · Next: {date}` secondary, right-aligned tabular amount (expense red / income green)
- Swipe actions: Edit (teal #45C0CF), Pause/Resume (neutral), Delete (danger red) — text-labeled, matching EntryRow swipe pattern
- Paused state: grey pill badge replaces next-date segment ("Paused · Weekly"); no next date while paused

### ScheduledEntryForm
- Mirrors EntryForm 1:1, registered as modal screen (Stack Navigator, EntryForm pattern)
- Start-date picker: minimumDate = today (blocks past dates, SCHD-UI-09)
- Frequency picker: 5 segments (Once/Daily/Weekly/Monthly/Yearly), flex:1, accent fill selected
- End-date row only when frequency ≠ once; minimumDate = start + 1
- Validation: amount > 0, category selected, endDate after startDate

### ExportScreen Section
- Below existing export controls; "Scheduled Entries" heading + accent "Add Scheduled" CTA
- Expenses → Income sub-sections (hidden at zero)
- Empty state with plan copy: "No scheduled entries yet. Add one to auto-generate recurring expenses or income."
- LoadingSkeleton + inline load-error with Retry

### the agent's Discretion
Any visual details not covered above are at the agent's discretion using the UI-SPEC (14-UI-SPEC.md) and design tokens (src/theme/tokens.ts).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/components/EntryRow.tsx — row layout + swipe actions pattern
- src/components/CategorySection.tsx — section styling pattern
- EntryForm (src/screens/EntryFormScreen.tsx or components) — field layout, parsePesoInput, DateTimePicker usage
- src/screens/ExportScreen.tsx — existing export controls section
- src/scheduled/ScheduledEntriesProvider.tsx (Phase 13) — scheduledEntries, addScheduled, updateScheduled, deleteScheduled, pauseScheduled, resumeScheduled
- src/lib/frequency.ts (Phase 13) — formatFrequency, getNextDate

### Established Patterns
- Modal forms in Stack Navigator; Swipeable rows; design tokens from src/theme/tokens.ts
- Provider context consumption via hooks

### Integration Points
- App.tsx — ScheduledEntryForm modal registration
- ExportScreen.tsx — scheduled section insertion
- Phase 15 HomeScreen will consume useScheduledEntries similarly

</code_context>

<specifics>
## Specific Ideas

Follow the UI-SPEC design contract (14-UI-SPEC.md) exactly — it was approved 6/6 by the UI checker.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>
