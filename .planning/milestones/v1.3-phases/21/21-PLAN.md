# Phase 21: Offline & Sync Tests — Plan

**Created:** 2026-08-16
**Status:** Ready for execution

## Tasks

### Task 1: Data Persistence Test
- `.maestro/offline/data-persistence.yaml` — create entry, kill app, restart, verify entry exists

### Task 2: Sync Indicator Test
- `.maestro/offline/sync-indicator.yaml` — verify SyncButton appears and sync state is shown

### Task 3: Manual Sync Test
- `.maestro/offline/manual-sync.yaml` — tap SyncButton, verify sync completes

## Dependencies

- All tasks are independent
- Each test assumes user is authenticated

## Verification

- All 3 YAML files are valid Maestro syntax
- Tests follow consistent naming and structure
