# Phase 8: Budget - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (single-phase autonomous)

## Phase Boundary

User can set a single global budget with a custom date range, and see a progress bar on the Home screen showing spending vs budget with color-coded thresholds.

## Implementation Decisions

### Data Model
- Budget stored in `users/{uid}` doc: `{ budgetAmount: number (cents), budgetStartDate: string, budgetEndDate: string }`
- Optional fields — absence means no budget set
- UserProfile type extended with optional budget fields
- AuthProvider exposes `updateBudget(amount, startDate, endDate)` and `clearBudget()` methods

### UI
- BudgetCard component on Home screen between SummaryCard and quick-action buttons
- Shows: "Budget" label, amount, date range, progress bar, remaining amount
- Progress bar: green < 70%, yellow 70-90%, red > 90%
- When budget period expired (today > endDate): show "Set new budget" prompt
- Tapping budget card opens budget settings (same as Account screen section)

### Budget Settings
- Accessible from Account screen (budget section) and by tapping budget card on Home
- Three fields: amount (₱), start date, end date
- Save/Cancel/Remove buttons
- Uses existing DateTimePicker for dates

### Firestore
- No new collections — budget lives on users/{uid} doc
- Security rules already allow user to update their own doc
- No new queries needed — budget fetched with userProfile

## Existing Code Insights

- AuthProvider fetches users/{uid} doc on auth state change
- UserProfile type: { displayName, email, isDefault }
- HomeScreen computes expenseTotal per month via memo
- AccountScreen shows user profile card with sign out/delete
- DateTimePicker already installed and used in EntryForm

## Specific Ideas

- Budget amount input uses same integer-cents pattern as EntryForm
- Date range picker reuses DateTimePicker component
- Progress bar is a simple View with width percentage and conditional background color
- "Set new budget" prompt when expired uses the same orange accent button style

## Deferred Ideas

None — full budget feature is the scope.
