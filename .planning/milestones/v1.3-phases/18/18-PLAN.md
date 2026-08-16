# Phase 18: Category Tests — Plan

**Created:** 2026-08-16
**Status:** Ready for execution

## Tasks

### Task 1: Create Category Test
- `.maestro/categories/create-category.yaml` — type name, tap +, verify in list

### Task 2: View Categories Test
- `.maestro/categories/view-categories.yaml` — navigate to Categories tab, verify sections exist

### Task 3: Edit Category Test
- `.maestro/categories/edit-category.yaml` — swipe → edit → rename → save → verify

### Task 4: Delete Category Test
- `.maestro/categories/delete-category.yaml` — swipe → delete → confirm → verify removal

## Dependencies

- All tasks are independent
- Each test assumes user is authenticated

## Verification

- All 4 YAML files are valid Maestro syntax
- Tests follow consistent naming and structure
