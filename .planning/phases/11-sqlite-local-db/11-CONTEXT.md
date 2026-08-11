# Phase 11: SQLite Local Database - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish expo-sqlite as the local source of truth — database schema (entries, categories, scheduledEntries, syncQueue), CRUD modules, and Firestore seed on first sign-in. Deliverables: `src/db/database.ts` (init + tables), `src/db/entries.ts`, `src/db/categories.ts`, `src/db/scheduled.ts`, `src/db/syncQueue.ts` CRUD modules, `src/db/seed.ts` (idempotent Firestore seed), and App.tsx wiring on auth state change.
</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
All implementation choices are at the agent's discretion — pure infrastructure phase. Use ROADMAP success criteria, existing codebase conventions (src/ structure, integer-cents money, YYYY-MM-DD date strings), and the planned schema (entries, categories, scheduledEntries, syncQueue tables with synced flags) to guide decisions.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/dates.ts`, `src/lib/money.ts` — date/money utilities
- Existing providers in `src/entries/`, `src/categories/` — context API patterns to preserve for Phase 12 refactor

### Established Patterns
- React Context + hooks state management
- Firestore CRUD modules in src/ per domain folder

### Integration Points
- `App.tsx` — auth state change wiring for seed
- Existing EntriesProvider/CategoriesProvider will read from SQLite in Phase 12

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.
</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.
</deferred>
