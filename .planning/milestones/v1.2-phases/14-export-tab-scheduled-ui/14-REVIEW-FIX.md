---
phase: 14-export-tab-scheduled-ui
fixed_at: 2026-08-12T00:24:59Z
review_path: .planning/phases/14-export-tab-scheduled-ui/14-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-08-12T00:24:59Z
**Source review:** `.planning/phases/14-export-tab-scheduled-ui/14-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (2 Critical, 2 Warning — Info findings out of scope)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Every edit-mode save resets `lastGenerated` → duplicate entry generation on next startup

**Files modified:** `src/scheduled/ScheduledEntriesProvider.tsx`, `src/scheduled/ScheduledEntryForm.tsx`, `src/scheduled/__tests__/ScheduledEntriesProvider.test.tsx`, `src/scheduled/__tests__/ScheduledEntryForm.test.tsx`
**Commit:** `e856261`
**Applied fix:** Two layers, both required by the finding:

1. **Provider (mandated):** `updateScheduled` now compares the incoming `date`/`frequency` against the stored row (`scheduledEntries.find`) and resets `changes.lastGenerated = null` only when the value **actually changed** (`patternChanged`). An unchanged-but-present value keeps the anchor — in the DB update and in the state mirror (per-row compare). Without a comparable row (stale state), the conservative reset is kept, matching the old behavior.
2. **Form:** the edit path builds a diff patch — only fields whose value differs from `existingEntry` are sent (`amount`, `categoryId`, `date`, `frequency`, `endDate`, `description`); a no-op save skips `updateScheduled` entirely. A description-only edit therefore sends `{ description }` and never touches the anchor.

Tests: provider test "keeps lastGenerated when date/frequency are present but unchanged (CR-01)" (weekly template anchored at today, description-only update with full field echo → anchor survives in SQLite + state, update still enqueued); form test "omits date/frequency from the update payload on a description-only edit (CR-01)" (`payload === { description }`).

### CR-02: Edit mode loses the entry type — income category list shown for expense templates

**Files modified:** `src/scheduled/ScheduledEntryForm.tsx`, `src/screens/ExportScreen.tsx`, `src/scheduled/__tests__/ScheduledEntryForm.test.tsx`
**Commit:** `836971f`
**Applied fix:** Both layers:

1. **ExportScreen** (`openEdit`): navigates with the row's type — `{ mode: "edit", id, type }` from `onEdit={() => openEdit(s.id, s.type)}`, matching the EntryForm edit-navigation pattern (ExpensesScreen/IncomeScreen pass `entry.type`).
2. **Form:** derives `effectiveType` from the stored entry in edit mode (`mode === "edit" && existingEntry ? existingEntry.type : type`), so the category list, the save payload's `type`, and the empty-categories copy are correct regardless of what the caller passes. This also protects any future caller that omits the type.

Tests: "renders the expense category list when the route omits the type (CR-02)" mounts with the real caller shape `{ mode: "edit", id }` against an expense template and asserts the expense category renders (no "Select category" placeholder, no income "Salary" leak); the pre-existing "saves through updateScheduled in edit mode" test now mounts with the real caller shape too.

### WR-01: `getNextOccurrence` ignores `endDate` — row shows "Next:" for occurrences the engine will never generate

**Files modified:** `src/lib/frequency.ts`, `src/components/ScheduledEntryRow.tsx`, `src/lib/__tests__/frequency-test.ts`, `src/components/__tests__/ScheduledEntryRow.test.tsx`
**Commit:** `2555b8c`
**Applied fix:** `getNextOccurrence(startDate, frequency, lastGenerated, endDate)` now takes `endDate` and returns `null` when the derived next occurrence is `null` **or** lands after `endDate` (`compare(next, endDate) > 0`) — exactly the engine's own in-range rule (scheduler.ts:65). The row passes `entry.endDate` and, when null, falls back to showing the start date without a "Next:" prefix (existing once-template presentation), so an ended template stops promising generation.

Tests: frequency tests cover the Jan 31 monthly → end Mar 15 case (null) and the boundary case (end exactly on the occurrence keeps it), plus the never-generated daily cap; row test "shows no 'Next:' when the next occurrence is beyond endDate (WR-01)" renders no "Next:" segment for an ended template.

### WR-02: Past-start rule blocks legitimate edits and forces an anchor change that regenerates duplicates

**Files modified:** `src/scheduled/ScheduledEntryForm.tsx`, `src/scheduled/__tests__/ScheduledEntryForm.test.tsx`
**Commit:** `46746a7`
**Applied fix:** SCHD-UI-09 is now enforced only for dates the user actually changes:

- Defensive check: `startInPast = startStr < today() && startStr !== existingEntry?.date` — the template's own pre-filled start date passes through, so Save stays enabled for untouched start dates (including description-only edits of older templates).
- Picker: `minimumDate` is `today` on CREATE only; in edit mode the floor is the template's own start date, so the picker opens on the existing (possibly past) date without clamping it out of range. Newly picked past dates are still blocked on both paths.

Tests: "allows saving an edit of a template whose start date is in the past (WR-02)" (past-start template, description-only edit → `updateScheduled` called with `{ description }`); "floors the start picker at the template's own date in edit mode (WR-02)" (picker `minimumDate` equals the stored start date).

## Verification

- `npx tsc --noEmit` — clean (exit 0)
- `npx jest --testPathPattern="src/components/__tests__/ScheduledEntryRow|src/scheduled|src/screens/__tests__/ExportScreen"` — **73 passed** (5 suites)
- Full suite: `npx jest` — **391 passed, 391 total** (all tests green; 9 suites fail at *load* with `Firebase: Error (auth/invalid-api-key)` — pre-existing environment limitation, none of them import any file changed in this fix pass)

## Not Fixed (out of scope — Info findings)

IN-01 (stale `endDate` survives a switch to "once"), IN-02 (mutation failures surface load-specific copy / Retry leaves the error block up to 5 s), IN-03 (EntryForm's amount auto-focus missing) were not addressed in this pass — the review's in-scope set was Critical + Warning only. IN-04's test suggestions are partially covered: the CR-02 no-type edit-mount test and the CR-01 description-only payload test were added as part of the critical fixes above.
