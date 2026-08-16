---
phase: 14-export-tab-scheduled-ui
plan: 01
subsystem: ui
tags: [scheduled-entries, swipeable, frequency-picker, export-screen, expo-go, react-native]

# Dependency graph
requires:
  - phase: 13-recurring-entries-data
    provides: ScheduledEntriesProvider (useScheduledEntries, add/update/delete/pause/resume), frequency utilities (formatFrequency, getNextDate, FREQUENCY_LABELS), dates helpers (toDateString, addDays)
provides:
  - ScheduledEntryRow list component (icon, description||categoryName, frequency + next date, colored amount; swipe Edit teal / Pause-Resume neutral / Delete danger)
  - ScheduledEntryForm modal (EntryForm field set + 5-segment frequency picker + optional end date; start date blocks past; registered in the root stack)
  - "Scheduled Entries" section in ExportScreen (Expenses/Income sub-sections, hidden at zero; whole-section empty state; LoadingSkeleton + inline error/Retry)
  - frequency.ts additions: getNextOccurrence (engine-consistent next occurrence) and formatNextDate ("Mon D" label)
affects: [15-homepage-upcoming]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Swipeable row with 3 text-labeled right actions (Edit teal, neutral toggle, danger delete) — EntryRow pattern reused for templates; delete behind Alert confirm, pause/resume applied immediately
    - Bottom-sheet category picker + tappable 44px tabular amount display with hidden decimal-pad input (EntryForm pattern verbatim, reused for scheduling)
    - 5-segment frequency picker (flex:1 segments, accent fill when selected, single-line truncated labels)
    - Section-scoped provider error handling: mutations catch and swallow, failures surface through the provider's lastError block with Retry → sync

key-files:
  created:
    - src/components/ScheduledEntryRow.tsx
    - src/scheduled/ScheduledEntryForm.tsx
    - src/components/__tests__/ScheduledEntryRow.test.tsx
    - src/scheduled/__tests__/ScheduledEntryForm.test.tsx
  modified:
    - src/lib/frequency.ts (+getNextOccurrence, +formatNextDate)
    - src/lib/__tests__/frequency-test.ts (+10 tests)
    - App.tsx (ScheduledEntryForm modal registration)
    - src/screens/ExportScreen.tsx (Scheduled Entries section)

key-decisions:
  - "Task 2 (frequency helpers) executed before Task 1 (row): the row imports getNextOccurrence/formatNextDate, so committing the row first would fail typecheck — same foundation-first pattern Phase 13 documented (Rule 3)"
  - "Add Scheduled button type comes from the sub-section context: income when only income templates exist, else expense (expenses-first convention); the form's type is fixed by the route param"
  - "Edit-mode start dates in the past block Save per the approved SCHD-UI-09 contract (picker minimumDate = today + defensive check) — editing an old template requires moving the start date forward"
  - "Provider mutations (delete/pause/resume) are caught in ExportScreen and surfaced through the provider's lastError inline block — never an unhandled rejection"
  - "Form tests use plain jest.mock objects for the providers (requireActual would pull the real firebase init chain that fails under plain jest — see Issues Encountered)"

requirements-completed: [SCHD-UI-01, SCHD-UI-02, SCHD-UI-03, SCHD-UI-04, SCHD-UI-05, SCHD-UI-06, SCHD-UI-07, SCHD-UI-08, SCHD-UI-09]

coverage:
  - id: D1
    description: "Frequency label helpers — getNextOccurrence (next occurrence anchored at lastGenerated else start date; null for once) and formatNextDate ('Mon D' label)"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/frequency-test.ts#getNextOccurrence / formatNextDate describe blocks (10 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ScheduledEntryRow — content contract (description||categoryName, frequency · next date, once without 'Next:', colored tabular amount), paused badge without next date, swipe action labels, tap/edit, immediate pause toggle, delete behind Alert"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ScheduledEntryRow.test.tsx (11 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ScheduledEntryForm — 5 frequency segments, end-date row hidden for once (SCHD-UI-08), Save gating, end-date ordering inline error, edit prefill, missing-entry guard, add/edit save flows (SCHD-UI-07/09)"
    verification:
      - kind: unit
        ref: "src/scheduled/__tests__/ScheduledEntryForm.test.tsx (8 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ScheduledEntryForm registered as a modal stack screen in App.tsx (EntryForm pattern)"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (App.tsx compiles; smoke-test cannot run in this env — see Issues Encountered)"
        status: pass
    human_judgment: false
  - id: D5
    description: "ExportScreen Scheduled Entries section — header + Add Scheduled CTA, Expenses/Income sub-sections hidden at zero, whole-section empty state copy, LoadingSkeleton, inline error + Retry, row tap → edit navigation"
    verification:
      - kind: other
        ref: "npx tsc --noEmit + lint clean on ExportScreen.tsx; section state rendering not covered by a component test (ExportScreen would need the firebase init chain mocked — see Issues Encountered)"
        status: pass
    human_judgment: true
    rationale: "Section state behavior (hide-at-zero, empty state, navigation wiring) is UI rendering not asserted by an automated test; requires visual verification in Expo Go"
  - id: D6
    description: "On-device manual verification (plan Task 8): Export tab section, Add Scheduled flow, create daily expense, swipe edit/delete/pause/resume, monthly income in Income sub-section"
    verification: []
    human_judgment: true
    rationale: "Requires the user's phone via Expo Go QR — not executable in this environment; recorded in WINDOWS.md ledger (id 5)"

# Metrics
duration: 37min
completed: 2026-08-12
status: complete
---

# Phase 14 Plan 1: Export Tab — Scheduled UI Summary

**Scheduled-entry template management UI on the Export tab: a swipeable ScheduledEntryRow (Edit teal / Pause-Resume neutral / Delete danger, paused badge), a ScheduledEntryForm modal mirroring EntryForm with a 5-segment frequency picker and optional end date (start date blocks the past), and a "Scheduled Entries" section with Expenses/Income sub-sections, whole-section empty state, and loading/error states — all on top of Phase 13's ScheduledEntriesProvider and frequency utilities**

## Performance

- **Duration:** 37 min
- **Started:** 2026-08-11T23:23:48Z
- **Completed:** 2026-08-12T00:00:50Z
- **Tasks:** 8 (7 executed; Task 8 is manual on-device verification)
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- **ScheduledEntryRow** (`src/components/ScheduledEntryRow.tsx`): EntryRow container pattern with 44px CategoryIcon, `description || categoryName` primary line, `{Frequency} · Next: {date}` secondary (start date without a "Next:" prefix for once templates, date from `getNextDate(lastGenerated ?? date, frequency)` — engine-consistent), right-aligned tabular amount colored income-green/expense-red. Swipe actions 3×80px text-labeled: **Edit teal `#45C0CF`**, **Pause/Resume neutral** (applied immediately, reversible), **Delete danger** behind the Alert confirmation. Paused templates render a grey pill **Paused** badge + frequency with no next date (generation is halted). Last row in a card is borderless (`isLast`).
- **Frequency helpers** (`src/lib/frequency.ts`, Task 2): `getNextOccurrence(startDate, frequency, lastGenerated)` — next occurrence after the engine's anchor (null for once) — and `formatNextDate` ("Aug 15" — DateSectionHeader convention). UI code never re-implements date/frequency math.
- **ScheduledEntryForm** (`src/scheduled/ScheduledEntryForm.tsx`): mirrors EntryForm 1:1 (tappable 44px tabular amount display + hidden decimal-pad input, category bottom sheet filtered by type) plus: **Start Date** picker with `minimumDate = today` (SCHD-UI-09 blocks past dates — inverted from EntryForm), **Repeats** 5-segment picker (Once/Daily/Weekly/Monthly/Yearly, flex:1, accent fill selected, single-line labels), **End Date (optional)** row only when frequency ≠ once (SCHD-UI-08) with `minimumDate = start + 1` and a Clear action, inline "End date must be after the start date." error, description optional maxLength 200. Save gated on amount > 0, category, start not past, endDate ordering; add/update through the provider; edit-mode not-found guard. Registered in App.tsx as a modal stack screen (EntryForm pattern).
- **ExportScreen section** (Tasks 5-6): "Scheduled Entries" header + accent **Add Scheduled** CTA below the export controls; **Expenses → Income** sub-sections (fixed order, hidden at zero of that type) with rows in a surface card (radius 24, shadow.surface, overflow hidden); whole-section empty state ("No scheduled entries yet" / "Add one to auto-generate recurring expenses or income."); LoadingSkeleton while loading; inline "Couldn't load scheduled entries." + Retry → sync. Row tap → edit modal; Add → add modal with type from the sub-section context. Provider mutations are caught and surfaced through the provider's lastError block.
- **48/48 new tests pass** (10 frequency helpers, 11 row, 8 form, 19 inherited); `npx tsc --noEmit` exits 0; `expo lint` reports 0 errors on all phase-14 files.

## Task Commits

Each task was committed atomically (Task 2 executed first — the row imports its helpers, see Deviation 1):

1. **Task 2: Frequency label helpers** - `7cc823b` (feat)
2. **Task 1: ScheduledEntryRow component** - `4558a1a` (feat)
3. **Task 3: ScheduledEntryForm component** - `ee2c4cf` (feat)
4. **Task 4: Form modal registration in App.tsx** - `95fe588` (feat)
5. **Task 5: ExportScreen scheduled section** - `5be83b3` (feat)
6. **Task 6: Whole-section empty state** - `5ed2a83` (feat)
7. **Task 7: Typecheck + lint** - `a4bc6d6` (fix)
8. **Task 8: Manual verification** - not executable here (see Next Phase Readiness)

## Files Created/Modified

- `src/components/ScheduledEntryRow.tsx` - Swipeable template row (created)
- `src/scheduled/ScheduledEntryForm.tsx` - Add/Edit template modal (created)
- `src/components/__tests__/ScheduledEntryRow.test.tsx` - 11 tests (created)
- `src/scheduled/__tests__/ScheduledEntryForm.test.tsx` - 8 tests (created)
- `src/lib/frequency.ts` - +getNextOccurrence, +formatNextDate (modified)
- `src/lib/__tests__/frequency-test.ts` - +10 tests (modified)
- `App.tsx` - ScheduledEntryForm modal screen registration (modified)
- `src/screens/ExportScreen.tsx` - Scheduled Entries section, empty state, loading/error (modified)

## Decisions Made

- **Foundation-first execution order** (Task 2 before Task 1): the row imports `getNextOccurrence`/`formatNextDate`, so every commit stays typecheck-green — same deviation Phase 13 documented.
- **Add Scheduled type from sub-section context**: income when only income templates exist, else expense (expenses-first convention). The header button is shared, so the route param picks the type.
- **Past start dates block Save in edit mode** per the approved SCHD-UI-09 contract: the picker's `minimumDate = today` plus a defensive `startStr < today()` check keep Save disabled — editing a template that started in the past requires moving its start date forward. Documented consequence of the user-approved requirement.
- **Section mutations are fire-and-forget**: delete/pause/resume catch errors and let the provider's `lastError` (auto-clearing) render the inline error block — no unhandled promise rejections from swipe actions.
- **Plain provider mocks in tests**: `jest.mock` factories return stub objects instead of `requireActual` — the real provider pulls the firebase init chain that throws `auth/invalid-api-key` under plain jest (see Issues Encountered).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Execution order: frequency helpers before the row**
- **Found during:** Task 1 (ScheduledEntryRow)
- **Issue:** The row imports `getNextOccurrence`/`formatNextDate` from Task 2 — committing it first would fail typecheck.
- **Fix:** Committed Task 2 (helpers + tests), then Task 1 (row). Task attribution preserved in this summary.
- **Committed in:** `7cc823b` (first commit)

**2. [Rule 1 - Bug] dateToInput crashed on the end-date picker value**
- **Found during:** Task 3 (ScheduledEntryForm test — "inline end-date error" case)
- **Issue:** `dateToInput(addDays(startStr, 1))` passed a `YYYY-MM-DD` string into a helper typed `(d: Date)`; `toDateString` then called `d.getFullYear()` on a string → runtime `TypeError`, surfaced the moment the end-date picker opened.
- **Fix:** `dateToInput` now accepts `Date | string` and normalizes via `toDateString`.
- **Files modified:** src/scheduled/ScheduledEntryForm.tsx
- **Verification:** the end-date picker test drives `onValueChange` through `minimumDate` and passes
- **Committed in:** `ee2c4cf`

**3. [Rule 1 - Bug] React 19 render-time guard for the missing-entry Alert**
- **Found during:** Task 3 (form test development)
- **Issue:** The EntryForm guard pattern (Alert in an effect on `!existingEntry`) needs an `isLoading` escape hatch that the scheduled provider's synchronous read doesn't have; a naive effect re-fired the Alert every render.
- **Fix:** Render-time `setState` guard (`guardShown` flag) — the Alert fires once, then the flag suppresses re-alerts until unmount.
- **Files modified:** src/scheduled/ScheduledEntryForm.tsx
- **Verification:** "alerts and goes back when the entry no longer exists" passes
- **Committed in:** `ee2c4cf`

---

**Total deviations:** 3 auto-fixed (1 blocking-order, 2 bugs)
**Impact on plan:** All three were required for correct execution — the order deviation keeps every commit typecheck-green, the `dateToInput` fix was a crash in the end-date picker path, the guard fix prevents Alert spam. No scope creep.

## Issues Encountered

- **Pre-existing test-env failure (not caused by this plan):** 9 test suites (EntryForm, HomeScreen, ExpensesScreen, IncomeScreen, CategoriesScreen, AccountScreen, queries-test, smoke-test, keyboard-provider-test) fail at **module load** with `FirebaseError: auth/invalid-api-key` because plain `jest` does not load `.env`, so `EXPO_PUBLIC_FIREBASE_API_KEY` is empty and `src/firebase/app.ts`'s `initializeAuth` throws. Verified **pre-existing** by running `EntryForm.test.tsx` at the pre-plan commit `7285805` in a temp worktree — identical failure. All phase-14 test files avoid the `requireActual` chain and pass (48/48). The affected suites need a jest env fix (e.g. a setup file loading `.env` or a firebase module mock) — out of scope for this plan; flagged for the verifier.
- **node_modules recovery incident (process, not code):** verifying the pre-existing failure required a temp git worktree; `git worktree remove --force` on Windows/MSYS followed the node_modules junction into the main repo and emptied it. Recovered with `npm ci` (package-lock intact). All committed work and git history were unaffected.
- **Lint:** `expo lint` reports 0 errors on phase-14 files. The 7 remaining repo-wide errors are the established provider `set-state-in-effect` pattern (AuthProvider, CategoriesProvider, EntriesProvider, ScheduledEntriesProvider, SyncButton) and two legacy test files — pre-existing, out of scope. New-file warnings (unused `e` in catch, test import-order/require) match the sibling EntryForm/test-file conventions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 15 (homepage-upcoming)** can consume `useScheduledEntries()` + `getNextOccurrence`/`formatNextDate` for upcoming-occurrence previews — the row's secondary-line logic ("Next: {date}", paused suppression) is the exact shape Home needs.
- **Manual verification pending (Task 8)** — requires the user's phone via Expo Go QR; recorded in `.planning/WINDOWS.md` (id 5):
  1. Export tab shows the "Scheduled Entries" section below the export controls with the accent "Add Scheduled" button
  2. Tap Add Scheduled → form opens (amount, category, Start Date, Repeats, End Date for repeating, description)
  3. Create a daily expense (starts today) → appears in the Expenses sub-section with "Daily · Next: <date>"
  4. Swipe a row → Edit opens the pre-filled form; Delete asks confirmation then removes; Pause shows the grey "Paused · Daily" badge immediately; Resume restores the next date
  5. Create a monthly income → lands in the Income sub-section (both sub-sections render; a type with zero entries hides its sub-section)
  6. Delete all templates → the whole-section empty state appears with the plan copy
- **Test-env follow-up (verifier/next phase):** the 9 firebase-init-failing suites predate this plan but block a fully green `npm test`; worth a jest setupFiles entry loading `.env` or a firebase module mock.
- Phase 13's manual verification (WINDOWS.md id 4) remains open and blocks full SCHD-01..10 closure.

---
*Phase: 14-export-tab-scheduled-ui*
*Completed: 2026-08-12*
## Self-Check: PASSED
