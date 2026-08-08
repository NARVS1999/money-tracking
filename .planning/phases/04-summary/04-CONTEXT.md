# Phase 4: Summary - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

User can see at a glance what was spent and earned this month, and per category. Requirements: SUMM-01, SUMM-02, SUMM-03.

Deliverables:
- Home screen derived summary — reduce cached entries over monthRange() for totals + per-category breakdown (no aggregation queries)
- Empty state + add CTA, month-boundary correctness, and live update verification

</domain>

<decisions>
## Implementation Decisions

### Summary Layout
- Two large numbers at top: "₱ 12,500.00" (red for expense) and "₱ 8,200.00" (green for income) — 44pt tabular-nums
- Per-category breakdown list below totals: category name left, amount right, sorted by amount descending
- Current calendar month only — auto-updates at month boundaries
- Empty state: "Nothing logged this month" centered text with "Add an entry" CTA button

### Category Breakdown Details
- Categories sorted by amount descending (biggest spender first)
- Expense and income categories separated into two sections: "Expenses" and "Income" with their own totals
- Only show categories with activity this month (hide empty ones)
- No entry count per category — just the total amount

### Month Boundary Behavior
- Summary updates immediately when app is opened in a new month — entries from the new month appear
- No past month viewing for MVP — current month only; past months deferred to Export (Phase 5)
- Use local date string (already stored as YYYY-MM-DD) — no timezone issues

### the agent's Discretion
- Exact animation timing for summary number transitions
- Loading state while entries are being reduced
- Section header styling for "Expenses" / "Income" breakdown sections

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/entries/EntriesProvider.tsx` — exposes entries array via useEntries() hook; entries have { uid, type, amount, categoryId, date, description }
- `src/categories/CategoriesProvider.tsx` — exposes expenseCategories, incomeCategories via useCategories() hook
- `src/lib/money.ts` — `formatCents(cents)` for display formatting
- `src/lib/dates.ts` — `today()`, `monthRange()`, `compare()` for date calculations
- `src/theme/tokens.ts` — colors, spacing, typography, radius

### Established Patterns
- State: React Context + custom hooks (AuthProvider, CategoriesProvider, EntriesProvider pattern)
- Data: Derived state from cached entries (no aggregation queries — reduce over monthRange())
- Styling: Inline StyleSheet via src/theme/tokens.ts
- Navigation: HomeScreen is a tab in MainTabs.tsx

### Integration Points
- `HomeScreen.tsx` — currently a placeholder, replaced by this phase
- EntriesProvider — source of all entry data for the summary
- CategoriesProvider — source of category names for the breakdown
- `src/lib/dates.ts` — monthRange() for filtering entries to current month

</code_context>

<specifics>
## Specific Ideas

- Home screen per design-brief layout: totals prominently at top, breakdown below
- "Add an entry" CTA navigates to the appropriate tab (Expenses or Income) — but for MVP, just show the CTA without navigation
- Live update: summary recalculates immediately when entries change (derived from onSnapshot listener)

</specifics>

<deferred>
## Deferred Ideas

- Past month viewing / month selector — deferred to Export (Phase 5)
- Pull-to-refresh — not needed with live onSnapshot listeners
- Charts or graphs — explicitly out of scope (design brief: numbers are the interface)

</deferred>
