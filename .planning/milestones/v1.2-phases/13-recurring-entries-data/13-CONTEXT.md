# Phase 13: Recurring Entries Data Layer - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

ScheduledEntriesProvider (SQLite-backed via src/db/scheduled.ts from Phase 11, with sync queue), frequency utilities (src/lib/frequency.ts: matchesFrequency, getNextDate, formatFrequency), extended date helpers (src/lib/dates.ts: isSameDay, daysBetween, addMonths, addYears), and the auto-generation engine (src/scheduled/scheduler.ts: runScheduler, getDatesToGenerate, generateEntry) wired to run on app startup in the background.
</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
All implementation choices are at the agent's discretion — pure infrastructure phase. Use ROADMAP success criteria, Phase 11/12 SQLite modules and provider patterns (EntriesProvider/CategoriesProvider), and the planned frequency semantics (once/daily/weekly/monthly/yearly) to guide decisions.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 11 SQLite: src/db/scheduled.ts (getAllScheduled(uid), getActiveScheduled(uid), insertScheduled, updateScheduled(uid,id,changes), deleteScheduled(uid,id), getUnsyncedScheduled(uid), markSynced(uid,id))
- Provider pattern: src/entries/EntriesProvider.tsx, src/categories/CategoriesProvider.tsx
- Date utilities: src/lib/dates.ts

### Established Patterns
- React Context + hooks; providers read SQLite, write SQLite + enqueue sync
- Providers wired in App.tsx

### Integration Points
- App.tsx — provider wrapper + scheduler startup call after entries/categories load
- Phase 14 UI (ExportScreen) consumes ScheduledEntriesProvider — same external API convention

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.
</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.
</deferred>
