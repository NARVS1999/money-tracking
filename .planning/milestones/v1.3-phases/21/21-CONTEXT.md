# Phase 21: Offline & Sync Tests - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

## Phase Boundary

Validate offline behavior and data sync through E2E tests.

## Implementation Decisions

### OpenCode's Discretion
All implementation choices are at OpenCode's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

## Existing Code Insights

- SQLite local store: `src/db/` — expo-sqlite as source of truth
- Sync service: `src/sync/syncService.ts` — syncQueue for offline-to-online tracking
- Auto sync: `src/sync/AutoSync.tsx` — syncs on app startup and network recovery
- Sync button: `src/components/SyncButton.tsx` — manual sync trigger
- Offline indicator: `src/auth/AuthProvider.tsx` — `isOnline` state from Firestore metadata
- Last-write-wins: conflict resolution by updatedAt timestamp

## Specific Ideas

- Test data persistence after app kill/restart
- Test sync indicator shows correct state
- Test manual sync via SyncButton

## Deferred Ideas

None — discuss phase skipped. Refer to ROADMAP phase description and success criteria.
