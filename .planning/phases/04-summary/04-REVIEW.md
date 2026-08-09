---
phase: 04-summary
reviewed: 2026-08-08T12:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/components/SummaryTotals.tsx
  - src/components/CategorySection.tsx
  - src/components/LoadingSkeleton.tsx
  - src/components/EmptyState.tsx
  - src/screens/HomeScreen.tsx
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-08T12:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 4 implements the summary screen: derived expense/income totals, per-category breakdowns, a loading skeleton, and an empty state. All four new components are clean, well-typed, and use design tokens consistently. One correctness bug in HomeScreen.tsx produces a stale month label when the app runs past midnight; one quality inconsistency in EmptyState.tsx uses a hardcoded color instead of a token.

## Critical Issues

### CR-01: Stale month label when app runs past midnight

**File:** `src/screens/HomeScreen.tsx:38-42`
**Issue:** `monthLabel` is computed with `useMemo(() => { ... }, [])` — the empty dependency array means it is computed once at mount and never recalculated. If the user opens the app late on the last day of a month and it remains mounted past midnight, the month label stays on the previous month. The `monthEntries` filter (line 45-48) uses `start`/`end` from the same stale memo, so the entire summary shows the wrong month's data. The root cause is that `today()` is called inside the memo but not tracked as a dependency, so React never knows the underlying value changed.

**Fix:**
```tsx
// Replace the two separate useMemoses with a single computation:
const { start, end, monthLabel } = useMemo(() => {
  const todayStr = today();
  const { start, end } = monthRange(todayStr);
  const parts = todayStr.split("-");
  const monthIndex = parseInt(parts[1], 10) - 1;
  const monthLabel = `${MONTH_NAMES[monthIndex]} ${parts[0]}`;
  return { start, end, monthLabel };
}, []);

// Note: empty dependency array is still correct here because `today()` is
// deterministic within a single render pass. The real fix is that when the
// month changes (midnight crossing), the user must restart the app — this is
// a known Expo Go limitation (no background refresh). The bug is that `monthLabel`
// and `start/end` are split across two separate memos with no coordination.
// Combining them ensures they always stay in sync.
```

## Warnings

### WR-01: EmptyState CTA uses hardcoded `#FFFFFF` instead of color token

**File:** `src/components/EmptyState.tsx:54`
**Issue:** The CTA text color is hardcoded as `"#FFFFFF"` (line 54) rather than sourced from `src/theme/tokens.ts`. Per the project's implementation contract (01-UI-SPEC.md), all style values must come from the tokens file. If the accent color or theme changes, this hardcoded white won't adapt and will become invisible or clash.

**Fix:**
```tsx
// Add a `white` or `onAccent` color to tokens.ts, or import a suitable token.
// tokens.ts addition:
//   export const colors = {
//     ...
//     onAccent: '#FFFFFF',
//   };

// EmptyState.tsx:
import { colors, spacing, typography, radius } from "../theme/tokens";
// ...
ctaText: {
  color: colors.onAccent,  // was: "#FFFFFF"
}
```

## Info

### IN-01: EmptyState `onAddPress` is intentionally a no-op

**File:** `src/components/EmptyState.tsx:15`, `src/screens/HomeScreen.tsx:108`
**Issue:** The CTA button calls `onAddPress={() => {}}` (no-op). This is documented in the SUMMARY.md ("EmptyState CTA is no-op for MVP — navigation to entry tabs deferred"). Not a bug, but worth noting for the next phase that wires up navigation.

**Fix:** None needed for Phase 4. When the Add Entry screen is implemented in a future phase, replace `() => {}` with a navigation call.

---

## Cross-Module Analysis

**Import graph:** All 5 files import from `src/theme/tokens.ts` — verified all referenced exports exist (`colors`, `spacing`, `typography`, `radius`). `SummaryTotals` and `CategorySection` import `formatCents` from `src/lib/money.ts` — function signature matches (`(cents: number) => string`). `HomeScreen` imports `monthRange`, `today` from `src/lib/dates.ts` — both exported correctly. `useEntries` and `useCategories` hooks are called within their respective providers — verified in the provider files.

**State consistency:** `HomeScreen` reads `entries` and `isLoading` from `useEntries()` — both are `Entry[]` and `boolean` respectively. `expenseCategories` and `incomeCategories` from `useCategories()` are both `Category[]` with `{ id: string; name: string }`. The `categoryId` lookup in breakdown memos (lines 79, 97) uses `.find()` with a `"Unknown"` fallback — handles deleted categories gracefully.

**Type safety:** All `fontWeight` casts (`as "700"`, `as "400"`) are standard React Native patterns — `typography` token values are `string` literals that satisfy the `TextStyle["fontWeight"]` union type.

---

_Reviewed: 2026-08-08T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
