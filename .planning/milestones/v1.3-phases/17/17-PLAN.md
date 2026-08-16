# Phase 17: Entry Management Tests — Plan

**Created:** 2026-08-16
**Status:** Ready for execution

## Tasks

### Task 1: Create Expense Entry Test
- `.maestro/entries/create-expense.yaml` — tap FAB, select category, enter amount, save, verify in list

### Task 2: Create Income Entry Test
- `.maestro/entries/create-income.yaml` — same flow for income type

### Task 3: Edit Entry Test
- `.maestro/entries/edit-entry.yaml` — swipe to edit, modify amount, save, verify change

### Task 4: Delete Entry Test
- `.maestro/entries/delete-entry.yaml` — swipe to delete, confirm, verify removal

### Task 5: Copy Entry Test
- `.maestro/entries/copy-entry.yaml` — swipe to copy, verify pre-filled form

## Dependencies

- All tasks are independent (can be parallelized)
- Each test assumes user is authenticated (chain with auth test or use stored state)

## Verification

- All 5 YAML files are valid Maestro syntax
- Tests follow consistent naming and structure
- Each test has proper assertions for start and end state
