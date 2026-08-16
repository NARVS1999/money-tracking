# Phase 15: Homepage — Upcoming Indicators — Test Generation Report

**Command:** gsd-add-tests 15 (auto-approve)
**Generated:** 2026-08-12
**Runner:** jest-expo (jest preset), `npx jest`

## Classification

All changed files classified **unit/component** — no E2E/browser classification (React Native app, no browser harness).

| File | Classification | Action |
|------|----------------|--------|
| `src/components/UpcomingSection.tsx` | TDD (component) | extend existing suite (gap only) |
| `src/screens/HomeScreen.tsx` | TDD (integration) | extend existing suite (gap only) |
| `src/lib/frequency.ts` (`getUpcomingOccurrence`) | TDD (pure fn) | extend existing suite (gap only) |
| `src/theme/tokens.ts` | TDD (token contract) | **new suite** (no token tests existed) |

## Coverage Gap Analysis (vs. 80 existing tests)

Already covered by the executor/fixer suites (no new tests added): income teal vs expense red amount colors, null at zero items, ordering with null-next last, expense row tap → ScheduledEntryForm with type, WR-01 stale-anchor clamps, WR-02 expense-side exhaustion.

New tests target genuinely uncovered behavior:

1. **Theme token values** — no test file existed for `src/theme/tokens.ts`; the four upcoming tokens and the accent wiring were untested.
2. **Card bg/border driven by the theme prop** — only the amount color was asserted; the yellow-tinted card contract (bg/border from props, radius 24) was untested.
3. **Both-zero leaves Home as v1.1** — the existing test only asserted the titles are absent; the quick actions and chart sections remaining was untested.
4. **Empty-ledger early-return supersedes the upcoming sections (E4)** — untested.
5. **Income row tap → type: "income"** — only the expense nav path was tested.
6. **Stable sort for equal next dates** — untested (ordering test used distinct dates).
7. **WR-02 exhaustion filter on the income side** — only expense templates were exercised.
8. **`getUpcomingOccurrence` edges** — never-generated template with past start (WR-01 scan), unknown frequency → null.

## Results

| Category | Generated (new) | Passing | Failing | Blocked |
|----------|-----------------|---------|---------|---------|
| Unit (component + lib) | 11 | 11 | 0 | 0 |
| E2E | 0 | — | — | — |

Full related-suite run (5 suites incl. pre-existing): **91 passed, 0 failed**.

## Files Created/Modified

- `src/theme/__tests__/tokens.test.ts` — **new** — 3 tests (token values, distinct names, accent wiring)
- `src/components/__tests__/UpcomingSection.test.tsx` — **modified** — +1 test (card theme bg/border + radius 24)
- `src/screens/__tests__/HomeScreenUpcoming.test.tsx` — **modified** — +5 tests (both-zero v1.1 layout, E4 empty-ledger supersede, income WR-02, stable sort, income tap type)
- `src/lib/__tests__/frequency-test.ts` — **modified** — +2 tests (never-generated clamp, unknown frequency)

## Verification

- `npx jest --testPathPattern="src/components/__tests__/UpcomingSection|src/screens/__tests__/HomeScreenUpcoming|src/lib/__tests__/frequency-test|src/components/__tests__/ScheduledEntryRow|src/theme/__tests__/tokens"` — **91 passed** (5 suites; 80 pre-existing + 11 new)
- `npx tsc --noEmit` — clean (exit 0)
- `npx expo lint` on changed files — 0 errors; 6 `import/first` warnings are the pre-existing phase-14 test-file convention (5 in UpcomingSection.test.tsx, 1 in HomeScreenUpcoming.test.tsx — none from this command's additions)

## Bugs Discovered

None — every new test passed on first run against the implemented behavior (no assertion failures, no implementation bugs flagged).

## Coverage Gaps (remaining)

- **Sort/filter unit-level testing:** `sortUpcoming` and `hasUpcomingOccurrence` are module-private in `src/screens/HomeScreen.tsx` (not exported) — exercised only through the integration suite.
- **Visual/overflow states (UI-SPEC backstop):** row truncation at 320px width, many-row scrolling — held-out visual UI-state tests, not covered by component tests.
- **On-device manual verification (D5)** — requires the user's phone via Expo Go QR; recorded in `.planning/WINDOWS.md` (id 6).
- `src/screens/__tests__/HomeScreen.test.tsx` still fails at **load** (`auth/invalid-api-key`) — pre-existing environment limitation, unrelated to phase 15.
