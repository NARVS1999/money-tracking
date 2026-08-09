# Requirements: Money Tracking v1.1

**Defined:** 2026-08-09
**Core Value:** Logging a money entry must take under 10 seconds — from opening the app to saving — and the data must be there when the phone is offline.

## v1.1 Requirements

### Theme (THEM)

- [ ] **THEM-01**: Summary card uses orange/red gradient (`#EF6D40` → `#DB281C`) with white text and shadow, matching the Modern UI sketch
- [ ] **THEM-02**: Background changes from `#F7F7F8` to `#FAFAFA`; card surfaces use white with subtle shadows instead of flat borders
- [ ] **THEM-03**: All border radii increase: cards `24px`, category icons `14px`, buttons `16px`, tab bar items `12px`
- [ ] **THEM-04**: Category rows display with rounded icon placeholders (initial or preset icon) to the left of the name
- [ ] **THEM-05**: Tab bar uses frosted-glass effect (semi-transparent white + backdrop blur) with active state highlight
- [ ] **THEM-06**: Quick-action buttons ("+ Expense", "+ Income") appear on the Home screen below the summary card, styled as outlined rounded buttons
- [ ] **THEM-07**: All existing screens (Sign In, Home, Expenses, Income, Categories, Account, Export, Entry Form) are updated to match the new theme tokens
- [ ] **THEM-08**: Chart section titles use uppercase small-caps style (`13px`, `700`, `#94A3B8`, `letter-spacing: 0.5px`)

### Budget (BDGT)

- [ ] **BDGT-01**: User can set a single global budget amount (PHP, integer cents) stored in `users/{uid}` doc
- [ ] **BDGT-02**: User can set custom budget date range (start and end dates); the budget applies to that range
- [ ] **BDGT-03**: Home screen shows a budget card with: budget label, amount, date range, progress bar (expenses as % of budget), and remaining amount
- [ ] **BDGT-04**: Progress bar fills from 0% (no spending) to 100% (at budget); bar color changes: green < 70%, yellow 70–90%, red > 90%
- [ ] **BDGT-05**: When budget period ends (today > end date), the budget card shows a "Set new budget" prompt instead of the progress bar
- [ ] **BDGT-06**: Budget settings accessible from Account screen or Home screen budget card tap
- [ ] **BDGT-07**: Removing the budget hides the budget card on Home; user can set a new budget from Account or Home

### Category Icons (ICNS)

- [ ] **ICNS-01**: Category data model gains an optional `icon` field (string, preset icon key); existing categories get no icon (null/undefined = default)
- [ ] **ICNS-02**: When adding a category, user can optionally pick an icon from a preset grid (e.g. 🏠 🍔 🚗 💰 🛒 💊 📚 🎭 etc.)
- [ ] **ICNS-03**: If no icon selected, category displays with a default icon (first letter of name in a colored rounded square)
- [ ] **ICNS-04**: Icon picker appears as a modal/overlay after entering the category name, with a "Skip" option
- [ ] **ICNS-05**: Category rows on Home (CategorySection), Categories screen, and entry form dropdown all show the icon to the left of the name
- [ ] **ICNS-06**: Icon persists in Firestore (`icon` field on category docs); backward-compatible — old docs without `icon` render the default

### Charts (CHRT)

- [ ] **CHRT-01**: Home screen shows an "Expenses by Category" pie/donut chart using `react-native-svg`, based on current-month expense breakdown
- [ ] **CHRT-02**: Home screen shows an "Income by Category" pie/donut chart, based on current-month income breakdown
- [ ] **CHRT-03**: Each chart has a legend showing category name + percentage, with colored dots matching chart segments
- [ ] **CHRT-04**: Chart segments use a curated color palette (8–12 distinct colors); categories beyond the palette share colors
- [ ] **CHRT-05**: Charts are tap-friendly — minimum 80×80px, no tiny slices; if a category is <5%, group into "Other"
- [ ] **CHRT-06**: Charts appear between the summary card and the category breakdown sections on Home

### Non-Functional (NFR)

- [ ] **NFR-07**: `react-native-svg` is bundled in Expo Go SDK 57 — no dev build required
- [ ] **NFR-08**: Budget data is uid-scoped; security rules reject cross-account budget reads/writes
- [ ] **NFR-09**: Category icon field is optional — existing categories without icons render correctly (backward-compatible)
- [ ] **NFR-10**: Chart rendering does not block the UI — derived from cached entries via memo (no Firestore aggregation queries)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEM-01 | Phase 7: Theme Overhaul | Pending |
| THEM-02 | Phase 7: Theme Overhaul | Pending |
| THEM-03 | Phase 7: Theme Overhaul | Pending |
| THEM-04 | Phase 7: Theme Overhaul | Pending |
| THEM-05 | Phase 7: Theme Overhaul | Pending |
| THEM-06 | Phase 7: Theme Overhaul | Pending |
| THEM-07 | Phase 7: Theme Overhaul | Pending |
| THEM-08 | Phase 7: Theme Overhaul | Pending |
| BDGT-01 | Phase 8: Budget | Pending |
| BDGT-02 | Phase 8: Budget | Pending |
| BDGT-03 | Phase 8: Budget | Pending |
| BDGT-04 | Phase 8: Budget | Pending |
| BDGT-05 | Phase 8: Budget | Pending |
| BDGT-06 | Phase 8: Budget | Pending |
| BDGT-07 | Phase 8: Budget | Pending |
| ICNS-01 | Phase 9: Category Icons | Pending |
| ICNS-02 | Phase 9: Category Icons | Pending |
| ICNS-03 | Phase 9: Category Icons | Pending |
| ICNS-04 | Phase 9: Category Icons | Pending |
| ICNS-05 | Phase 9: Category Icons | Pending |
| ICNS-06 | Phase 9: Category Icons | Pending |
| CHRT-01 | Phase 10: Charts | Pending |
| CHRT-02 | Phase 10: Charts | Pending |
| CHRT-03 | Phase 10: Charts | Pending |
| CHRT-04 | Phase 10: Charts | Pending |
| CHRT-05 | Phase 10: Charts | Pending |
| CHRT-06 | Phase 10: Charts | Pending |
| NFR-07 | Phase 10: Charts | Pending |
| NFR-08 | Phase 8: Budget | Pending |
| NFR-09 | Phase 9: Category Icons | Pending |
| NFR-10 | Phase 10: Charts | Pending |

## Coverage

- v1.1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-09*
