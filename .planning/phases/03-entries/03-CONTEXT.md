# Phase 3: Entries - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

User can log, edit, delete, and copy expense/income entries in under 10 seconds — with the data visible even offline mid-session. Requirements: ENTR-01, ENTR-02, ENTR-03, ENTR-04, ENTR-05, ENTR-06, ENTR-07, ENTR-08, NFR-02.

Deliverables:
- EntriesProvider (uid-scoped `onSnapshot`, re-subscribe per `user.uid`, unsubscribe on sign-out) + Expenses/Income tabs with entry lists
- Shared entry form — add/edit/copy pre-fill, per-type dropdown, integer-cents amount input, local-date picker with `maximumDate`, keyboard handling
- Delete confirmation + offline-sync indicator (`hasPendingWrites`/`fromCache`) and `.catch()` handling on every write

</domain>

<decisions>
## Implementation Decisions

### Entry List Layout
- FlatList grouped by date (sections: "Today", "Yesterday", "Aug 7") — standard mobile pattern
- Each entry row: category name left, amount right, date + description below in secondary color
- Empty state: "No entries yet" centered text with "Add one" CTA button below
- Sort order: newest first (date DESC) — matches the composite index `type ASC, date DESC`

### Entry Form UX
- FAB (+) button on each tab → opens modal form (slide up)
- Direct peso input — type "2450" shows "₱ 2,450.00" live via `formatCents(parsePesoInput())`
- Dropdown/picker below amount — expense tab shows only expense categories from CategoriesProvider
- `KeyboardAwareScrollView` from `react-native-keyboard-controller` (bundled in Expo Go)

### Entry Actions (Edit/Copy/Delete)
- Swipe left on entry row → reveals Edit / Copy / Delete actions (same pattern as Categories swipe)
- Delete: Alert dialog "Delete this entry?" with Cancel / Delete (red) buttons
- Copy: Swipe → Copy → form opens pre-filled with same category/amount/description, date reset to today — saves as new entry
- Edit: Swipe → Edit → form opens pre-filled, saves back to the same entry doc

### Offline Sync Indicator
- Per-entry row: small dot + "Syncing…" text next to timestamp, visible when `hasPendingWrites` is true
- Error handling: `.catch()` on every write — toast "Save failed — retry?" with retry button
- Reconnect: auto-reconcile via Firestore listener (no user action needed) — indicator disappears when writes confirm

### the agent's Discretion
- Exact animation timing and curve for modal form presentation
- Toast notification implementation choice (existing library or custom)
- Swipe animation timing and thresholds for entry rows

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/firebase/queries.ts` — `entriesByType(uid, type)` already queries entries by type with `orderBy("date", "desc")`; `entriesBase(uid)` for full entry set; `entriesInRange(uid, start, end)` for range queries
- `src/categories/CategoriesProvider.tsx` — `useCategories()` hook exposes `expenseCategories`, `incomeCategories`, `usageMap` — dropdown source for entry form
- `src/lib/money.ts` — `formatCents(cents)` and `parsePesoInput(input)` for amount input/display
- `src/lib/dates.ts` — `today()`, `toDateString()`, `addDays()`, `compare()`, `monthRange()` for date handling
- `src/auth/AuthProvider.tsx` — `useAuth()` hook for current `user.uid`, pattern to follow for EntriesProvider
- `src/theme/tokens.ts` — `colors`, `spacing`, `typography`, `radius` — single source for all styling

### Established Patterns
- State: React Context + custom hooks (`AuthProvider` + `useAuth`, `CategoriesProvider` + `useCategories` pattern)
- Data: Firestore `onSnapshot` listeners, uid-scoped queries in `src/firebase/queries.ts`
- Styling: Inline StyleSheet via `src/theme/tokens.ts` (no CSS modules, no styled-components)
- Navigation: `@react-navigation/bottom-tabs` v7 — Expenses/Income tabs already wired in `src/screens/MainTabs.tsx`
- Swipe actions: react-native-gesture-handler `Swipeable` (used in Categories)

### Integration Points
- `ExpensesScreen.tsx` — currently a placeholder wrapper, replaced by this phase
- `IncomeScreen.tsx` — currently a placeholder wrapper, replaced by this phase
- `HomeScreen.tsx` — placeholder until Phase 4 fills it in (reads from EntriesProvider)
- CategoriesProvider — entry form dropdowns source from this provider's data
- `src/firebase/queries.ts` — `entriesByType(uid, type)` is the primary query for list screens

</code_context>

<specifics>
## Specific Ideas

- Entry form per design-brief layout: amount input prominent at top, category dropdown below, date picker (default today), optional description field (≤200 chars), Save button
- Date picker: native `@react-native-community/datetimepicker` with `maximumDate={new Date()}` — blocks future dates (ENTR-04)
- Amount display: always ₱ with thousand separators (e.g. "₱ 1,250.00"), stored as integer cents
- Entry row swipe: consistent with Categories swipe pattern (react-native-gesture-handler Swipeable)
- Modal form: `presentation: 'modal'` in native-stack for full-screen modal presentation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
