# Phase 12: Offline-First Providers + Sync - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor EntriesProvider and CategoriesProvider to read/write SQLite first (with syncQueue for pending changes), build the sync service (push changes → Firestore, pull remote changes with last-write-wins by updatedAt, fullSync), add ID mapping for temp IDs, persist lastSyncTimestamp, wire auto-sync on foreground and the existing SyncButton, and update Firestore rules/indexes for scheduledEntries.
</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
All implementation choices are at the agent's discretion — pure infrastructure phase. Use ROADMAP success criteria, the Phase 11 SQLite modules (src/db/*), and existing provider conventions (src/entries/EntriesProvider.tsx, src/categories/CategoriesProvider.tsx) to guide decisions.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 11 SQLite modules: src/db/entries.ts, categories.ts, scheduled.ts, syncQueue.ts, seed.ts
- Existing providers: src/entries/EntriesProvider.tsx, src/categories/CategoriesProvider.tsx (Firestore-backed, same external API)
- src/components/SyncButton.tsx (exists — needs rewiring to new sync service)

### Established Patterns
- React Context + hooks state management
- Providers expose same external API; sync() triggers push+pull

### Integration Points
- App.tsx — SyncProvider wiring, AppState foreground listener
- Firestore rules: firestore.rules; indexes: firestore.indexes.json

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.
</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.
</deferred>
