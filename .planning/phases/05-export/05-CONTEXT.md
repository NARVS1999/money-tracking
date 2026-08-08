# Phase 5: Export - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

User can export any date range to PDF, Excel, and CSV — with the file saved to Downloads (Android) or shared (iOS) and a success confirmation showing the file name. Requirements: EXPT-01, EXPT-02, EXPT-03, EXPT-04, EXPT-05.

Deliverables:
- Export screen — date range picker, uid-scoped range query, range validation, filename confirmation flow
- PDF pipeline — export.js (range query → totals → PDF HTML) + expo-print printToFileAsync → cache → SAF copy to Downloads / share sheet (iOS)
- Excel + CSV writers — SheetJS 0.20.3 from CDN, XLSX.write(..., { type: "base64" }) + writeAsStringAsync base64 path, files.js SAF wrapper

</domain>

<decisions>
## Implementation Decisions

### Export Screen Layout
- Tab in the bottom navigation (replaces Account tab position)
- Two date pickers (From / To) with "This Month" quick-select button
- Three buttons: PDF / Excel / CSV — tap to export that format
- Success toast with file name + "Open" action button

### PDF Export
- Content: Title "Money Tracking — Aug 2026", totals summary, per-category breakdown, entry list table
- Styling: Simple black/white with green/red for income/expense — matches app design
- File naming: `money-tracking-2026-08-01-to-2026-08-31.pdf`
- Page size: A4 landscape for entry table readability

### Excel/CSV Export
- Excel: One sheet, header row, one row per entry, totals row at bottom
- CSV: Same as Excel — header row, one row per entry, totals row
- Column order: Date, Type, Category, Amount, Description
- File naming: Same pattern as PDF (`money-tracking-2026-08-01-to-2026-08-31.xlsx/.csv`)

### Platform Behavior
- Android: Downloads folder via SAF (StorageAccessFramework) from expo-file-system/legacy
- iOS: Share sheet (expo-sharing) — user chooses where to save
- Error handling: Error toast with "Retry" action — retry the same export
- Large ranges: No special handling — Firestore query handles it; loading spinner during generation

### the agent's Discretion
- SAF permission request flow and error handling
- expo-print HTML template structure
- SheetJS CDN import approach (dynamic import or static)
- Loading/progress indicator during export generation

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/entries/EntriesProvider.tsx` — exposes entries via useEntries() hook
- `src/categories/CategoriesProvider.tsx` — exposes categories via useCategories() hook
- `src/firebase/queries.ts` — `entriesInRange(uid, start, end)` for date-range queries
- `src/lib/money.ts` — `formatCents(cents)` for display formatting
- `src/lib/dates.ts` — `today()`, `monthRange()`, `compare()`, `toDateString()` for date handling
- `src/theme/tokens.ts` — colors, spacing, typography, radius

### Established Patterns
- State: React Context + custom hooks
- Data: Firestore onSnapshot listeners, uid-scoped queries
- Styling: Inline StyleSheet via src/theme/tokens.ts
- Navigation: @react-navigation/bottom-tabs v7

### Integration Points
- `src/firebase/queries.ts` — entriesInRange() for date-range export queries
- expo-print — HTML to PDF (printToFileAsync)
- expo-file-system/legacy — SAF for Android Downloads
- expo-sharing — iOS share sheet
- xlsx (SheetJS) — Excel generation (CDN tarball 0.20.3)

</code_context>

<specifics>
## Specific Ideas

- Export screen per design-brief layout: date range at top, format buttons in middle, status/preview at bottom
- "This Month" quick-select button sets From/To to current month boundaries
- Loading spinner during export generation (PDF/Excel/CSV can take a few seconds)
- Success toast shows the file name and an "Open" button that opens the file

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
