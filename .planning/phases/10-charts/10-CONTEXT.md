# Phase 10: Charts - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (single-phase autonomous)

## Phase Boundary

Home screen displays pie/donut charts for expense and income breakdowns by category, using react-native-svg, with legends and smart grouping for small slices.

## Implementation Decisions

### Chart Library
- react-native-svg (Expo Go compatible, bundled in Expo Go SDK 57)
- Custom donut chart component using SVG arcs
- No external charting library needed

### Data
- Expense/income breakdown already computed in HomeScreen via memos
- Pass data to DonutChart component
- Slices <5% grouped into "Other"

### Colors
- Curated 8-color palette for chart segments
- Categories beyond palette share colors
- Consistent with theme tokens

### Layout
- Charts render between SummaryCard/BudgetCard and CategorySection blocks
- Two charts: "Expenses by Category" and "Income by Category"
- Each chart has a legend with category name + percentage

## Existing Code Insights

- HomeScreen already computes expenseBreakdown and incomeBreakdown arrays
- CategorySection already renders category rows with icons
- BudgetCard is between SummaryCard and quick actions
- react-native-svg not installed yet — needs `npx expo install`

## Specific Ideas

- DonutChart component: center hole for total, colored arcs for categories
- Legend: colored dot + category name + percentage
- "Other" group for slices <5%
- Animated entrance for visual polish

## Deferred Ideas

None — full chart feature is the scope.
