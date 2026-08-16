---
phase: 15-homepage-upcoming
plan: 01
subsystem: ui
tags: [home-screen, upcoming, scheduled-entries, react-native, expo-go]

# Dependency graph
requires:
  - phase: 14-export-tab-scheduled-ui
    provides: ScheduledEntryRow visual contract, getNextOccurrence/formatNextDate frequency helpers, ScheduledEntryForm edit-mode navigation (CR-02 pattern)
  - phase: 13-recurring-entries-data
    provides: ScheduledEntriesProvider (useScheduledEntries), ScheduledEntry type (isActive/endDate/lastGenerated)
provides:
  - UpcomingSection component (yellow-tinted card, themed tap-only rows, null-at-zero)
  - HomeScreen upcoming sections integration (expenses then income, sorted, edit-mode navigation)
  - 4 new theme tokens (upcomingExpenseBg/Border, upcomingIncomeBg/Border)
affects: [16-* phases touching the Home screen or scheduled-entry UX]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Themed section card: CategorySection container pattern + theme-driven bg/border/accent tokens passed as props (component stays token-agnostic)
    - Upcoming ordering as a pure module-level sort (sortUpcoming in HomeScreen) reusing getNextOccurrence — UI never re-implements date math
    - Home screen integration test with all-provider plain mocks (no requireActual) + react-native-svg/expo-linear-gradient/vector-icons mocks — the firebase chain cannot load under plain jest

key-files:
  created:
    - src/components/UpcomingSection.tsx
    - src/components/__tests__/UpcomingSection.test.tsx
    - src/screens/__tests__/HomeScreenUpcoming.test.tsx
  modified:
    - src/theme/tokens.ts (+upcomingExpenseBg/Border, upcomingIncomeBg/Border)
    - src/screens/HomeScreen.tsx (upcoming sections between quick actions and charts)

key-decisions:
  - "Income amounts are teal #45C0CF on Home (UI-SPEC HOME-UP-02 yellow-blue theme) — a deliberate locked delta from ScheduledEntryRow's income green #16A34A; the Export tab keeps green"
  - "Rows are rendered inline in UpcomingSection (TouchableOpacity, no Swipeable) rather than reusing ScheduledEntryRow behind swipe suppression — the spec allowed either; inline avoids importing the gesture-handler Swipeable for a tap-only surface"
  - "sortUpcoming lives in HomeScreen as a pure module-level function using getNextOccurrence: next occurrence ascending (soonest first), null-next entries last by start date, stable for equal dates"
  - "Execution order: tokens (Task 5) → component (Tasks 1-2) → integration (Tasks 3-4), keeping every commit typecheck-green (same foundation-first pattern as phases 13-14)"

patterns-established:
  - "Home screen integration test: plain provider mocks + __esModule:true react-native-svg mock (default import interop) + expo-linear-gradient/vector-icons mocks, so the firebase init chain never loads"
  - "Section component theme contract: { bg, border, accent } prop object; call sites resolve tokens, the component stays token-agnostic and reusable"

requirements-completed: [HOME-UP-01, HOME-UP-02, HOME-UP-03, HOME-UP-04, HOME-UP-05, HOME-UP-06, HOME-UP-07]

coverage:
  - id: D1
    description: "UpcomingSection — yellow-tinted card (theme bg/border, radius 24, shadow.surface), 18/700 title (no CTA, no subtotal badge), ScheduledEntryRow content contract rows (44px CategoryIcon, description||categoryName, '{Frequency} · Next: {date}', once/finished show start date without 'Next:'), amount colored by theme accent (#DC2626 expense / #45C0CF income), tap-only rows, null at zero items, last-row borderless"
    verification:
      - kind: unit
        ref: "src/components/__tests__/UpcomingSection.test.tsx (11 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "HomeScreen upcoming integration — useScheduledEntries wiring, active-only filter per type (no 7-day horizon), sortUpcoming ordering (next occurrence ascending, null-next last), both sections between quick-action buttons and chart sections (expenses first), per-type hide at zero, paused exclusion, row tap → ScheduledEntryForm { mode: 'edit', id, type }"
    verification:
      - kind: unit
        ref: "src/screens/__tests__/HomeScreenUpcoming.test.tsx (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Theme tokens — upcomingExpenseBg/Border and upcomingIncomeBg/Border (rgba(248,197,25,0.08)/(0.15)), distinct names despite identical values so the themes may diverge later"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (tokens consumed by HomeScreen typechecks)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Typecheck + lint clean on all phase-15 files — npx tsc --noEmit exits 0; expo lint reports 0 errors on phase-15 files (6 import-order warnings match the phase-14 test-file convention); the 7 repo-wide lint errors are the pre-existing provider set-state-in-effect pattern"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npx expo lint"
        status: pass
    human_judgment: false
  - id: D5
    description: "On-device manual verification (plan Task 7): sections visible between quick actions and charts with correct themes, hidden at zero, row tap opens edit form"
    verification: []
    human_judgment: true
    rationale: "Requires the user's phone via Expo Go QR — not executable in this environment; recorded in WINDOWS.md ledger (id 6)"

# Metrics
duration: 8min
completed: 2026-08-12
status: complete
---

# Phase 15 Plan 1: Homepage — Upcoming Indicators Summary

**Home-screen upcoming indicators: a reusable UpcomingSection component (yellow-tinted card, tap-only rows, null-at-zero) wired into HomeScreen between the quick-action buttons and chart sections — active scheduled templates per type, sorted by next occurrence, navigating to ScheduledEntryForm edit mode; income amounts teal #45C0CF (not the Export green), expense amounts red #DC2626, on four new yellow theme tokens**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-12T00:53:15Z
- **Completed:** 2026-08-12T01:01:00Z
- **Tasks:** 7 (6 executed; Task 7 is manual on-device verification)
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- **UpcomingSection** (`src/components/UpcomingSection.tsx`): CategorySection container pattern (paddingHorizontal md, marginBottom lg) + 18/700 textPrimary title — **no CTA, no subtotal badge** (15-UI-SPEC: a scheduled-total would misrepresent the ledger; Export owns the Add CTA). Card is `theme.bg` (yellow tint `rgba(248,197,25,0.08)`) with 1px `theme.border` (`rgba(248,197,25,0.15)`), radius 24, `shadow.surface`. Rows follow the ScheduledEntryRow visual contract with two locked deltas: amount color from the section theme (expense `#DC2626` / income `#45C0CF` — teal, NOT the Export tab's green `#16A34A`), and **tap-only** TouchableOpacity rows (no Swipeable — management stays in Export). Content contract verbatim: 44px CategoryIcon, `description || categoryName` primary (16/400), `{formatFrequency} · Next: {formatNextDate(...)}` secondary (14/400 textSecondary) — "once" and endDate-finished templates show the start date without a "Next:" prefix. Amount is 16/700 tabular, right-aligned, minWidth 44. **Returns `null` at zero items** — absence IS the empty state (HOME-UP-05).
- **HomeScreen integration** (`src/screens/HomeScreen.tsx`): `useScheduledEntries()` consumed; `sortUpcoming` (pure module-level fn) orders **all active** templates (no 7-day horizon, HOME-UP-03) by next occurrence ascending via `getNextOccurrence`, null-next entries last by start date, stable for equal dates. Two `UpcomingSection`s rendered **between the quick-action buttons and the chart sections** — Upcoming Expenses (yellow-red `#DC2626`) then Upcoming Income (yellow-blue `#45C0CF`), expenses-first convention (HOME-UP-07). Row tap → `navigation.navigate("ScheduledEntryForm", { mode: "edit", id, type })` — the phase-14 CR-02 pattern, `type` passed for the form's category filter (HOME-UP-06). The empty-ledger `EmptyState` early return is unchanged; both-zero sections leave Home exactly as v1.1.
- **Theme tokens** (`src/theme/tokens.ts`): `upcomingExpenseBg`/`upcomingExpenseBorder`/`upcomingIncomeBg`/`upcomingIncomeBorder` — distinct names, identical yellow values, so the themes can diverge later without touching call sites.
- **18/18 new tests pass** (11 UpcomingSection, 7 HomeScreen upcoming integration); full related-suite run 79/79 green (ScheduledEntryRow, ExportScreen, frequency helpers included — no regressions); `npx tsc --noEmit` exits 0; `expo lint` reports **0 errors** on all phase-15 files.

## Task Commits

Each task was committed atomically (foundation-first order — tokens before the component before the integration, so every commit stays typecheck-green):

1. **Task 5: Upcoming color tokens** - `c92c7aa` (feat)
2. **Tasks 1+2: UpcomingSection component + themed rows** - `99c6426` (feat)
3. **Tasks 3+4: HomeScreen integration + provider wiring** - `21698a7` (feat)
4. **Task 6: Typecheck + lint** - clean on first run, no fix commit needed (verification-only)
5. **Task 7: Manual verification** - not executable here (WINDOWS.md id 6)

**Plan metadata:** `docs(15-01): complete homepage-upcoming plan` (after this SUMMARY)

## Files Created/Modified

- `src/components/UpcomingSection.tsx` - Yellow-tinted upcoming card with themed tap-only rows (created)
- `src/theme/tokens.ts` - +4 upcoming color tokens (modified)
- `src/screens/HomeScreen.tsx` - upcoming sections + useScheduledEntries + sortUpcoming + edit navigation (modified)
- `src/components/__tests__/UpcomingSection.test.tsx` - 11 tests: empty-state null, content contract, once/finished secondary line, themed colors, tap wiring, last-row border (created)
- `src/screens/__tests__/HomeScreenUpcoming.test.tsx` - 7 tests: render/hide/partial-hide, paused exclusion, sort order, placement, edit navigation (created)

## Decisions Made

- **Income amount teal `#45C0CF` on Home**: the approved UI-SPEC yellow-blue theme (HOME-UP-02) deliberately overrides ScheduledEntryRow's income green `#16A34A` on the home screen only; the Export tab keeps green. Locked by the plan, executed as specified.
- **Inline themed rows instead of reusing ScheduledEntryRow**: the UI-SPEC explicitly allowed either; inline rows avoid importing `react-native-gesture-handler`'s Swipeable for a tap-only surface, and the amount color comes from the theme prop either way.
- **`sortUpcoming` as a pure module-level function in HomeScreen**: reuses `getNextOccurrence` (engine-consistent math — UI never re-implements date logic); YYYY-MM-DD strings compare chronologically; `Array.prototype.sort` stability (ES2019+) keeps equal dates in insertion order.
- **Tests committed with their features** (phase-14 convention): no separate test commits; the new HomeScreen integration test uses all-plain mocks (`__esModule: true` on the react-native-svg mock for the default-import interop) so the firebase init chain never loads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Foundation-first execution order (Task 5 before Tasks 1-2 before Tasks 3-4)**
- **Found during:** Task 1 (UpcomingSection component)
- **Issue:** HomeScreen passes the new theme tokens to UpcomingSection; committing the component or the integration before the tokens exist would fail typecheck.
- **Fix:** Committed Task 5 (tokens) first, then the component, then the integration. Task attribution preserved in this summary (same deviation phases 13-14 documented).
- **Committed in:** `c92c7aa`, `99c6426`, `21698a7`

**2. [Rule 3 - Blocking] Tasks 1+2 and Tasks 3+4 merged into single commits (same-file pairs)**
- **Found during:** Task 2 (style upcoming rows) and Task 4 (provider wiring)
- **Issue:** Task 2's styling IS the component body (Tasks 1-2 are the same new file `UpcomingSection.tsx`), and Task 4's provider access is intrinsic to Task 3's render (the sections cannot render without the hook). Splitting either pair would produce an empty second commit.
- **Fix:** Merged each same-file pair into one commit; both tasks' content fully implemented and documented.
- **Committed in:** `99c6426` (Tasks 1+2), `21698a7` (Tasks 3+4)

---

**Total deviations:** 2 auto-fixed (2 blocking-order merges)
**Impact on plan:** Both were structural, not correctness issues — every task's content is implemented exactly per the plan and UI-SPEC, and every commit stays typecheck-green. No scope creep.

## Issues Encountered

- **react-native-svg mock interop (test development):** the first HomeScreen integration test run crashed with "Element type is invalid... got: object" — DonutChart's `import Svg, { Path }` default import goes through babel's `_interopRequireDefault`, which wraps a mock object lacking `__esModule: true`. Fixed by adding `__esModule: true` to the mock. Jest-env-only issue; no production impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 15 complete on the code side**: UpcomingSection is a reusable, token-agnostic component (`{ bg, border, accent }` theme prop) — future phases can restyle or relocate it without touching its internals.
- **Manual verification pending (Task 7)** — requires the user's phone via Expo Go QR; recorded in `.planning/WINDOWS.md` (id 6):
  1. Home shows "Upcoming Expenses" (yellow tint + red `#DC2626` amounts) between the quick-action buttons and the chart sections
  2. Home shows "Upcoming Income" below it (yellow tint + teal `#45C0CF` amounts)
  3. Rows show description (or category name), "{Frequency} · Next: {date}", and the formatted amount; once templates show their start date without "Next:"
  4. A type with zero active templates hides only its own section; zero of both leaves Home exactly as v1.1
  5. Tapping a row opens ScheduledEntryForm in edit mode, pre-filled, with the correct category type
- **Test-env follow-up (pre-existing, not caused by this plan):** the 9 firebase-init-failing suites (incl. the legacy `HomeScreen.test.tsx`) still block a fully green `npm test`; the new `HomeScreenUpcoming.test.tsx` deliberately avoids the chain with plain mocks. Worth a jest setupFiles entry loading `.env` or a firebase module mock.
- Phases 11-14 manual verifications (WINDOWS.md ids 1-5) remain open and block full closure of their requirements.

---
*Phase: 15-homepage-upcoming*
*Completed: 2026-08-12*
## Self-Check: PASSED
