# Roadmap: Money Tracking

## Overview

A personal expense/income tracker for the phone (Expo Go workflow): sign in with email/password, log entries in under 10 seconds with session-scoped offline persistence, manage per-type categories, view the current-month summary, and export date-range PDF/Excel/CSV summaries to the phone. The journey is a dependency chain — auth gates everything → categories feed entry forms → entries feed summary and exports → account lifecycle wraps it all. Export (Phase 5) is the riskiest platform code and is deliberately isolated after the data layer is proven.

## Milestones

- [x] **v1.0** — Core app (auth, categories, entries, summary, export, account lifecycle) — completed 2026-08-09 — [full roadmap](milestones/v1.0-ROADMAP.md) · [requirements](milestones/v1.0-REQUIREMENTS.md)
- [ ] **v1.1** — Theme overhaul, budget, category icons, charts — in progress

## Phases

**Phase Numbering:**

- Integer phases (1–6): v1.0 (archived)
- Integer phases (7–10): v1.1 current work
- Decimal phases (7.1, 7.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 7: Theme Overhaul** - Repaint all screens to Modern UI style: orange/red gradient summary card, rounded surfaces, frosted tab bar, quick-action buttons (completed 2026-08-09)
- [ ] **Phase 8: Budget** - Single global budget with custom date range, progress bar on Home, budget settings in Account
- [ ] **Phase 9: Category Icons** - Preset icon grid on category creation, icon rendering across all screens, backward-compatible data model
- [ ] **Phase 10: Charts** - Expense/income pie charts on Home via react-native-svg, legend, "Other" grouping for small slices

## Phase Details

### Phase 7: Theme Overhaul

**Goal**: The app's visual identity shifts from monochrome flat to Modern UI — orange/red gradient summary card, rounded surfaces with shadows, frosted-glass tab bar, quick-action buttons, and consistent styling across all screens.
**Mode:** mvp
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: THEM-01, THEM-02, THEM-03, THEM-04, THEM-05, THEM-06, THEM-07, THEM-08
**Success Criteria** (what must be TRUE):

  1. Home screen summary card uses orange/red gradient with white text and drop shadow
  2. Background is `#FAFAFA`, surfaces are white with shadow-based elevation
  3. All border radii match the Modern UI spec (cards 24px, icons 14px, buttons 16px)
  4. Category rows show icon placeholders (initial letter or preset icon) to the left of the name
  5. Tab bar has frosted-glass effect with active-state orange highlight
  6. Quick-action buttons ("+ Expense", "+ Income") appear below the summary card
  7. All existing screens (Sign In, Home, Expenses, Income, Categories, Account, Export, Entry Form) render correctly with the new tokens
  8. Chart section title styling (uppercase small-caps) is applied

### Phase 8: Budget

**Goal**: User can set a single global budget with a custom date range, and see a progress bar on the Home screen showing spending vs budget with color-coded thresholds.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: BDGT-01, BDGT-02, BDGT-03, BDGT-04, BDGT-05, BDGT-06, BDGT-07, NFR-08
**Success Criteria** (what must be TRUE):

  1. User can set a budget amount and custom date range (start/end) stored in `users/{uid}` doc
  2. Home screen shows a budget card with label, amount, date range, progress bar, and remaining amount
  3. Progress bar fills from 0% to 100% based on expenses within the budget date range vs budget amount
  4. Bar color changes: green < 70%, yellow 70–90%, red > 90%
  5. When today > end date, budget card shows "Set new budget" prompt
  6. Budget settings accessible from Account screen or by tapping the budget card
  7. Removing the budget hides the card; user can set a new one from Account or Home

### Phase 9: Category Icons

**Goal**: User can optionally assign an icon to a category from a preset grid, with a default fallback for existing and unselected categories.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: ICNS-01, ICNS-02, ICNS-03, ICNS-04, ICNS-05, ICNS-06, NFR-09
**Success Criteria** (what must be TRUE):

  1. Category type gains an optional `icon` field (string, preset key); existing categories without icons render the default
  2. Adding a category shows an optional icon picker modal after name entry, with "Skip" option
  3. Default icon is the first letter of the category name in a colored rounded square
  4. Category rows on Home, Categories screen, and entry form dropdown all show the icon
  5. Icon persists in Firestore; backward-compatible with old docs

### Phase 10: Charts

**Goal**: Home screen displays pie/donut charts for expense and income breakdowns by category, using react-native-svg, with legends and smart grouping for small slices.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: CHRT-01, CHRT-02, CHRT-03, CHRT-04, CHRT-05, CHRT-06, NFR-07, NFR-10
**Success Criteria** (what must be TRUE):

  1. Home screen shows an "Expenses by Category" donut chart from current-month expense breakdown
  2. Home screen shows an "Income by Category" donut chart from current-month income breakdown
  3. Each chart has a legend with category name + percentage and colored dots
  4. Segments use a curated 8–12 color palette; categories beyond the palette share colors
  5. Slices <5% are grouped into "Other"
  6. Charts render between summary card and category breakdown sections
  7. `react-native-svg` is installed via `npx expo install` (Expo Go compatible)
  8. Chart data is derived from cached entries via memo — no Firestore aggregation queries

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Theme Overhaul | 1/1 | Complete | 2026-08-09 |
| 8. Budget | 0/0 | Not started | - |
| 9. Category Icons | 0/0 | Not started | - |
| 10. Charts | 0/0 | Not started | - |
