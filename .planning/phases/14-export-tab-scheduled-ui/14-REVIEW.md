---
phase: 14-export-tab-scheduled-ui
reviewed: 2026-08-12T00:08:19Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - App.tsx
  - src/components/ScheduledEntryRow.tsx
  - src/components/__tests__/ScheduledEntryRow.test.tsx
  - src/lib/__tests__/frequency-test.ts
  - src/lib/frequency.ts
  - src/scheduled/ScheduledEntryForm.tsx
  - src/scheduled/__tests__/ScheduledEntryForm.test.tsx
  - src/screens/ExportScreen.tsx
findings:
  critical: 2
  warning: 2
  info: 4
  total: 8
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-08-12T00:08:19Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Phase 14 "Export Tab — Scheduled UI" changes: `ScheduledEntryRow`, `ScheduledEntryForm`, the `getNextOccurrence`/`formatNextDate` helpers, the ExportScreen "Scheduled Entries" section, and the App.tsx modal registration, cross-referenced against the Phase 13 provider (`ScheduledEntriesProvider`), the generation engine (`scheduler.ts`), the dates/money libs, and the EntryForm pattern the form claims to mirror 1:1.

The UI work is generally solid: tests are meaningful (48/48), the row/form/section match the approved UI-SPEC contract, and error propagation (fire-and-forget mutations surfaced through `lastError`, never unhandled rejections) is handled correctly. The Android `DateTimePicker` dismissal path was verified against the installed v9.1.0 source: `DISMISS_ACTION` routes to `onDismiss` and `onValueChange` only fires on date-set, so the missing `event.type` check is benign on this version.

However, two **critical** data-integrity bugs were found in the edit flow, both missed by the test suite because the tests drive the form with route params that the real navigation never supplies:

1. **Every edit-mode save resets `lastGenerated`** — the form always includes `date`/`frequency` in the update payload, and the provider resets the generation anchor on *presence* of those fields rather than on *change*. The next app startup then regenerates every occurrence since the template's start date → **duplicate ledger entries** (SQLite + Firestore).
2. **Edit mode loses the entry type** — ExportScreen's edit navigation passes only `{ mode: "edit", id }`, so the form falls back to the income-category list for *every* edit; an expense template edited there can be saved with an income category.

## Critical Issues

### CR-01: Every edit-mode save resets `lastGenerated` → duplicate entry generation on next startup

**File:** `src/scheduled/ScheduledEntryForm.tsx:144-158`
**Issue:** The form's save payload always contains `date: startStr` and `frequency` (lines 148, 150) — including when the user only changed the description. The provider resets the generation anchor whenever those fields are *present*, not when they *changed* (`src/scheduled/ScheduledEntriesProvider.tsx:291-293`: `if (input.date !== undefined || input.frequency !== undefined) { changes.lastGenerated = null; }`). Since the form always sends both, **any edit** — even a description-only edit — nulls `lastGenerated`. On the next sign-in/startup, `runScheduler` (scheduler.ts:62, `let d = lastGenerated ? addDays(lastGenerated, 1) : start`) regenerates every occurrence from the template's start date through today as brand-new rows with fresh temp ids, then queues them for Firestore sync. Every occurrence already generated before the edit is **duplicated in the ledger** (and synced to Firestore). This defeats the engine's idempotency guarantee and corrupts financial history. The provider's WR-03 comment documents the intent ("a *new* start date or frequency changes the generation pattern") but the implementation cannot distinguish "new" from "present". The phase-14 form is the only caller that triggers it (the engine's own update passes only `lastGenerated`/`updatedAt`).

**Fix:** In the form's edit path, omit unchanged fields from the update payload (compare against `existingEntry`):
```ts
if (mode === "edit" && id && existingEntry) {
  const patch: Partial<ScheduledInput> = {};
  if (cents !== existingEntry.amount) patch.amount = cents;
  if (selectedCategoryId !== existingEntry.categoryId) patch.categoryId = selectedCategoryId;
  if (startStr !== existingEntry.date) patch.date = startStr;
  if (frequency !== existingEntry.frequency) patch.frequency = frequency;
  const end = endDate ? toDateString(endDate) : null;
  if (end !== existingEntry.endDate) patch.endDate = end;
  if (description.trim() !== existingEntry.description) patch.description = description.trim();
  if (Object.keys(patch).length > 0) await updateScheduled(id, patch);
  navigation.goBack();
} else {
  await addScheduled(input);
}
```
(Alternatively, harden the provider: only reset `lastGenerated` when the incoming value actually differs from the stored row — that protects every future caller too.)

### CR-02: Edit mode loses the entry type — income category list shown for expense templates

**File:** `src/screens/ExportScreen.tsx:200-205` → `src/scheduled/ScheduledEntryForm.tsx:46-47, 137, 144-152`
**Issue:** `openEdit` navigates with `{ mode: "edit", id }` — no `type` (the UI-SPEC §3 prescribes this shape, and the form's `RouteParams` marks `type` required, so the mismatch was invisible to typechecking). In the form, `type` is therefore `undefined` in every real edit: `categories` falls through to `incomeCategories` (line 47), and `input.type` is `undefined` on save. The provider's `updateScheduled` skips `type` when undefined (`input.type !== undefined`), so the type itself survives — but:
- Editing an **expense** template opens the category picker showing **income** categories; the pre-filled expense `categoryId` is not in that list, so the row shows the "Select category" placeholder while a category is actually selected.
- Picking any category from the shown list assigns an **income category to an expense template** — persisted via `updateScheduled`. The row then renders "Unknown" for the category (lookup fails in the expense list). This is inconsistent data in the ledger.
- EntryForm's edit navigation (ExpensesScreen.tsx:65-68, IncomeScreen.tsx:64-68) always passes `type: entry.type` — the pattern precedent was not followed here.

**Fix:** Derive the type from the entry in the form (robust regardless of caller), e.g. after the `existingEntry` memo:
```ts
const effectiveType: "expense" | "income" =
  mode === "edit" && existingEntry ? existingEntry.type : type;
```
and use `effectiveType` for both the category list (line 47) and the save payload (line 144). Alternatively pass the row's type from ExportScreen (`onEdit={() => openEdit(s.id, s.type)}`).

## Warnings

### WR-01: `getNextOccurrence` ignores `endDate` — row shows "Next:" for occurrences the engine will never generate

**File:** `src/lib/frequency.ts:46-52` + `src/components/ScheduledEntryRow.tsx:51-59`
**Issue:** `getNextOccurrence(startDate, frequency, lastGenerated)` derives the next date purely from the anchor; it has no `endDate` parameter. The engine (scheduler.ts:65) never generates past `endDate`, so a template with `endDate` in the past — or whose next occurrence lands beyond `endDate` — still renders "Next: Mar 31" forever, implying generation continues when it has stopped. Example: monthly template starting Jan 31 with endDate Mar 15 and `lastGenerated = Jan 31` → row shows "Next: Mar 31", but Mar 31 > endDate so the engine skips it. The UI-SPEC §1 contract prescribed this exact formula (so the deviation is a contract gap, not an implementation miss), but the phase's own goal is "engine-consistent next occurrence" — this is not.

**Fix:** Extend the helper to accept `endDate` and return `null` when the next occurrence exceeds it, and have the row drop the "Next:" segment (show start date / no next date) when null:
```ts
export function getNextOccurrence(
  startDate: string,
  frequency: Frequency,
  lastGenerated: string | null,
  endDate: string | null,
): string | null {
  const next = getNextDate(lastGenerated ?? startDate, frequency);
  if (next === null || (endDate !== null && compare(next, endDate) > 0)) return null;
  return next;
}
```

### WR-02: Past-start rule blocks legitimate edits and forces an anchor change that regenerates duplicates

**File:** `src/scheduled/ScheduledEntryForm.tsx:125, 130-135`
**Issue:** `startInPast = startStr < today()` disables Save for *any* template whose start date is in the past — including a description-only edit of a template created last week. The user is forced to advance the start date to today to save, which (a) silently shifts the generation anchor, and (b) triggers the CR-01 reset path (date genuinely changed → `lastGenerated = null`), so the next startup regenerates the current-day occurrence that was already generated → a duplicate entry. SCHD-UI-09's intent was to block *newly picked* past dates; applying it to the pre-filled value of an existing template is stricter than the requirement's stated purpose and has a data-integrity side effect neither the contract nor the summary accounts for.

**Fix:** Only enforce the past rule for dates the user actually changes — allow the template's own start date to pass through:
```ts
const startInPast = startStr < today() && startStr !== existingEntry?.date;
```
This keeps Save enabled for untouched start dates while still blocking new past picks via the picker's `minimumDate` and the defensive check.

## Info

### IN-01: Stale `endDate` survives a switch to "once"

**File:** `src/scheduled/ScheduledEntryForm.tsx:270-302, 151`
**Issue:** When the user switches the frequency to "once", the End Date row hides but `endDate` state is retained and still saved (`endDate: endDate ? toDateString(endDate) : null`). The value silently reappears if the user later switches back to a repeating frequency. Clear `endDate` when `frequency === "once"` (in the segment `onPress` or on save).

### IN-02: Mutation failures surface load-specific copy; a successful Retry leaves the error block up to 5 s

**File:** `src/screens/ExportScreen.tsx:388-396`
**Issue:** delete/pause/resume failures all set the provider's `lastError`, which renders "Couldn't load scheduled entries." — a load message for a mutation failure — and replaces the whole row list. Additionally, after a successful Retry (`syncScheduled` resolves), `lastError` is not cleared (only the 5 s auto-clear timer removes it), so the error block persists for up to 5 s after the data actually loaded. Consider `clearError()` in `handleScheduledRetry` after a successful sync, and/or a mutation-specific message.

### IN-03: Form omits EntryForm's amount auto-focus

**File:** `src/scheduled/ScheduledEntryForm.tsx:171-205` (vs `src/components/EntryForm.tsx:107-110`)
**Issue:** EntryForm auto-focuses the amount input 300 ms after mount; ScheduledEntryForm does not. In add mode the user must tap the amount display before typing. Given the project's Core Value (log an entry in < 10 s), restoring the auto-focus effect keeps the scheduled flow consistent with the claimed "EntryForm pattern verbatim".

### IN-04: Edit-mode tests mask CR-02 (and CR-01's trigger)

**File:** `src/scheduled/__tests__/ScheduledEntryForm.test.tsx:286, 316`
**Issue:** Every edit-mode test mounts with `type: "expense"` explicitly in the route params — a shape the real caller never produces (`ExportScreen` navigates with `{ mode: "edit", id }`). The tests therefore cannot catch the type loss; the "saves through updateScheduled" test also asserts only `description` in the payload, so the always-present `date`/`frequency` fields (CR-01's trigger) pass unnoticed. Add a test that mounts with `{ mode: "edit", id }` (no `type`) against an expense entry and asserts the expense category list renders — and one asserting a description-only edit does not reset the anchor (payload omits `date`/`frequency`).

---

_Reviewed: 2026-08-12T00:08:19Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
