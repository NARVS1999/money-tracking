# Phase 7: Theme Overhaul - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — single-phase autonomous)

## Phase Boundary

The app's visual identity shifts from monochrome flat to Modern UI — orange/red gradient summary card, rounded surfaces with shadows, frosted-glass tab bar, quick-action buttons, and consistent styling across all screens.

## Implementation Decisions

### Design Tokens
- Background: `#F7F7F8` → `#FAFAFA`
- Primary orange: `#EF6D40` (gradient start)
- Primary red: `#DB281C` (gradient end)
- Teal accent: `#45C0CF` (income/charts)
- Yellow: `#F8C519` (charts)
- Border radii: cards 24px, category icons 14px, buttons 16px, inputs 12px
- Shadow tokens: card shadow (`0 20px 40px rgba(239,109,64,0.3)`)

### Summary Card
- Orange/red gradient background with white text
- Balance as large display number
- Expense/Income as stat cards inside the card
- Drop shadow for depth

### Tab Bar
- Semi-transparent white background with backdrop blur (frosted glass)
- Active state: orange highlight background
- Border top: subtle orange tint

### Quick Actions
- Two buttons below summary: "+ Expense" and "+ Income"
- Outlined style with category-colored borders

### Category Rows
- Icon placeholder (initial letter in colored rounded square) to left of name
- Rounded card containers instead of flat list rows

### All Screens
- Rounded card surfaces with shadows instead of flat borders
- Consistent border radii and spacing

## Existing Code Insights

- 10 color tokens, 1 radius token (sm: 8)
- All screens import from `../theme/tokens`
- SummaryTotals is a simple two-number display
- CategorySection renders flat rows with bottom borders
- MainTabs uses `@expo/vector-icons` Ionicons
- EntryRow uses Swipeable with border-bottom styling
- EmptyState, LoadingSkeleton use `colors.background` and `colors.border`

## Specific Ideas

- Match the Modern UI HTML sketch in `.planning/sketches/theme-modern-ui.html`
- Gradient card uses `LinearGradient` from `expo-linear-gradient` (bundled in Expo Go)
- Tab bar frosted effect via `background-color: rgba(255,255,255,0.95)` + `backdrop-filter: blur(20px)` (not directly supported in RN, use semi-transparent bg + opacity)

## Deferred Ideas

None — full theme overhaul is the scope.
