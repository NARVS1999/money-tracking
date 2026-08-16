# Phase 20: Navigation Tests — Plan

**Created:** 2026-08-16
**Status:** Ready for execution

## Tasks

### Task 1: Tab Switching Test
- `.maestro/navigation/tab-switching.yaml` — tap each tab, verify correct screen appears

### Task 2: Screen Navigation Test
- `.maestro/navigation/screen-navigation.yaml` — navigate to EntryForm via FAB

### Task 3: Back Navigation Test
- `.maestro/navigation/back-navigation.yaml` — open EntryForm, tap Cancel, return to previous screen

## Dependencies

- All tasks are independent
- Each test assumes user is authenticated

## Verification

- All 3 YAML files are valid Maestro syntax
- Tests follow consistent naming and structure
