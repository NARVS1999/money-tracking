# Phase 14 — Test Report (add-tests)

**Date:** 2026-08-12
**Runner:** jest-expo (`npx jest`)
**Scope:** phase 14 (Export Tab — Scheduled UI) unit/component tests only — React Native app, no browser harness; E2E classification skipped.

## Classification

| File | Category | Reason |
|------|----------|--------|
| `src/screens/ExportScreen.tsx` | TDD | Scheduled section state machine (empty/loading/error/populated/partial) + navigation wiring — SUMMARY coverage D5 was previously human-judgment-only |
| `src/scheduled/ScheduledEntryForm.tsx` | TDD | Validation gating edge cases (past start, end-date floor, save failure, no-op edit) |
| `src/components/ScheduledEntryRow.tsx` | TDD | Amount color contract, Unknown fallback, cancel-delete, resume interaction |
| `src/lib/frequency.ts` | Skip | Already covered: 28 tests across matchesFrequency/getNextDate/getNextOccurrence/formatNextDate incl. WR-01 endDate caps — no uncovered branches |
| `App.tsx` | Skip | Glue (modal screen registration) — not meaningfully testable |

## Results

| Suite | Before | After | Added |
|-------|--------|-------|-------|
| `src/screens/__tests__/ExportScreen.test.tsx` | 0 (new file) | 14 | 14 |
| `src/scheduled/__tests__/ScheduledEntryForm.test.tsx` | 13 | 22 | 9 |
| `src/components/__tests__/ScheduledEntryRow.test.tsx` | 12 | 16 | 4 |
| `src/lib/__tests__/frequency-test.ts` | 28 | 28 | 0 |
| provider/scheduler suites | 51 | 51 | 0 |
| **Phase-14 suites total** | **104** | **131** | **27** |

- Targeted run: `npx jest --testPathPattern="src/components/__tests__/ScheduledEntryRow|src/scheduled|src/screens/__tests__/ExportScreen|src/lib/__tests__/frequency"` → **131/131 passed** (7 suites).
- Full suite: `npx jest` → **418 passed, 418 total**. 9 suites still fail at *module load* with `FirebaseError: auth/invalid-api-key` (plain jest does not load `.env`) — the documented pre-existing limitation from the phase SUMMARY; none of them import a file changed here.
- `npx tsc --noEmit` → exit 0. `npx expo lint` on the 3 test files → 0 errors (warnings match the established sibling test-file conventions).

## New coverage

### ExportScreen.test.tsx (14) — section states previously untested (D5)
- Section header + Add Scheduled CTA render
- Whole-section empty state copy (`No scheduled entries yet` / `Add one to auto-generate recurring expenses or income.`)
- Expenses/Income sub-sections hide at zero of that type (both directions); fixed Expenses → Income order with both present
- Add navigation: `{ mode: "add", type }` — expense when expense templates exist, income when only income templates exist
- Row tap → `{ mode: "edit", id, type }` with the row's own type (CR-02 regression guard)
- LoadingSkeleton while `isLoading`, no list/empty content
- Inline `Couldn't load scheduled entries.` + Retry → `sync()`
- Swipe wiring: Pause → `pauseScheduled(id)`, Resume → `resumeScheduled(id)`, Delete behind Alert confirm → `deleteScheduled(id)`
- Rejected mutation surfaces through the provider without an unhandled rejection (fire-and-forget)

### ScheduledEntryForm.test.tsx (9) — validation edge cases
- Save stays disabled with amount only (category required)
- Cancel → goBack without saving
- Description `maxLength === 200`
- Add-mode start picker floors at today (SCHD-UI-09)
- Defensive past-start check blocks Save in add mode (SCHD-UI-09)
- End-date picker floors at start + 1 day
- Save failure → Alert `Save failed. Please try again.` and no goBack
- Clear action resets the pre-filled end date (payload `endDate: null`)
- No-op edit skips `updateScheduled` entirely (CR-01 diff-patch guard)

### ScheduledEntryRow.test.tsx (4)
- Amount color contract: income-green / expense-red from tokens (14-UI-SPEC §1)
- `Unknown` fallback when the category id has no match
- Cancel (first Alert button) carries no onPress — cannot trigger delete
- Resume swipe action calls `onTogglePause` immediately

## Bugs discovered during test writing

None — the two initial failures were test bugs, not implementation bugs:

1. Row cancel-delete test called `cancelBtn.onPress()` — the RN Alert cancel button legitimately has no `onPress` (OS dismisses it). Test rewritten to assert the contract (no onPress on Cancel).
2. Form past-start test pressed the *future* past-date label before the picker had changed the display — `pressableWithText` found nothing. Fixed to open the picker via the displayed (today) row label first.

## Coverage gaps (uncovered, documented)

- `isLast` borderless separator and other layout/style details (styling — out of scope)
- Paused pill badge visual styling (text contract covered)
- Export pipeline itself (PDF/Excel/CSV) — out of phase scope, pre-existing export tests in `exportPipeline-test.ts`
- Visual/backstop UI states from the UI-SPEC (overflow truncation, badge truncation at 320px) — held-out visual tests
- On-device manual verification (SUMMARY Task 8, WINDOWS.md id 5) — requires Expo Go QR
