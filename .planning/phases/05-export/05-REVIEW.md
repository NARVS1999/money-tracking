---
phase: 05-export
reviewed: 2026-08-09T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/screens/ExportScreen.tsx
  - src/lib/exportPipeline.ts
  - src/lib/files.ts
  - src/screens/MainTabs.tsx
  - package.json
findings:
  critical: 1
  warning: 6
  info: 2
  total: 9
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 5 implements the Export feature: date pickers, format selection (PDF/Excel/CSV), platform-aware file saving (Android SAF / iOS share sheet), and the export pipeline with HTML/PDF generation and SheetJS-based Excel/CSV writers. One critical bug causes PDF export to produce corrupted files. Several code quality issues around dead code, duplicated logic, and missing null guards.

## Critical Issues

### CR-01: PDF export produces corrupted files — binary data read as UTF-8

**File:** `src/lib/exportPipeline.ts:199-201`
**Issue:** `exportPDF` reads the binary PDF file from expo-print's cache using `FileSystem.readAsStringAsync(uri)` without specifying Base64 encoding. The default encoding is UTF-8, which corrupts binary data (PDF is a binary format). The corrupted string is then passed to `saveToFile` with `"utf8"` encoding, writing corrupted bytes to the output file. The resulting PDF file will be unreadable.

```typescript
// BUG: reads binary PDF as UTF-8 string — corrupts data
const content = await FileSystem.readAsStringAsync(uri);
await saveToFile(content, filename, "utf8");
```

**Fix:** Read the PDF as Base64 and save with Base64 encoding:

```typescript
const content = await FileSystem.readAsStringAsync(uri, {
  encoding: FileSystem.EncodingType.Base64,
});
await saveToFile(content, filename, "base64");
```

## Warnings

### WR-01: HTML injection in PDF — user content not HTML-escaped

**File:** `src/lib/exportPipeline.ts:40-44`
**Issue:** Entry descriptions and category names are interpolated directly into HTML without escaping. If a description contains `<`, `>`, `&`, or `"`, it will break the HTML structure and produce a malformed PDF. For example, a description like `Lunch < 100` would create an invalid `< 100` HTML tag.

```typescript
// BUG: user content injected raw into HTML
<td>${e.description || ""}</td>
```

**Fix:** Add an HTML escape helper and apply it to all user-provided strings:

```typescript
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Then in the template:
<td>${escapeHtml(e.description || "")}</td>
```

### WR-02: `isDisabled` variable computed but never referenced

**File:** `src/screens/ExportScreen.tsx:84-85`
**Issue:** `isDisabled` is computed with `isExporting`, `selectedFormat`, `rangeEntries.length`, and `hasValidationError`, but is never used anywhere in the component. The format buttons use their own inline `disabled` prop (line 279) that does not include `selectedFormat === null`. This is dead code that misleads about the actual disable logic.

```typescript
const isDisabled =
  isExporting || selectedFormat === null || rangeEntries.length === 0 || hasValidationError;
```

**Fix:** Either remove `isDisabled` entirely (since buttons handle their own disabled state), or refactor buttons to use it consistently.

### WR-03: `buildCsvString` is exported but never called (dead code)

**File:** `src/lib/exportPipeline.ts:161-180`
**Issue:** `buildCsvString` is a pure function that generates CSV from entries. However, `exportCSV` (line 239) uses `XLSX.utils.sheet_to_csv` instead. `buildCsvString` is never imported or called anywhere in the codebase. This is dead code from the Plan 05-01 stub that was not cleaned up when Plan 05-03 reimplemented CSV via xlsx.

**Fix:** Remove `buildCsvString` or refactor `exportCSV` to use it instead of importing xlsx for CSV generation.

### WR-04: Format button onPress duplicates `handleExport` logic inline

**File:** `src/screens/ExportScreen.tsx:254-277`
**Issue:** The format button `onPress` handler contains a complete inline copy of the export logic (set exporting, call function, handle success/error, clear exporting). Meanwhile, `handleExport` (lines 117-151) implements the same logic and is used by `handleRetry` (line 155). This duplication means bug fixes to one path may not be applied to the other.

**Fix:** Refactor the format button `onPress` to call `handleExport` after setting the format:

```typescript
onPress={() => {
  setSelectedFormat(fmt);
  // Let handleExport pick up the new format on next tick
  // Or restructure: set format first, then call handleExport
}}
```

### WR-05: `setSelectedFormat(fmt)` called twice in same handler

**File:** `src/screens/ExportScreen.tsx:255,258`
**Issue:** The format button `onPress` calls `setSelectedFormat(fmt)` on line 255, then immediately calls it again on line 258 inside the guard. The second call is redundant.

**Fix:** Remove the duplicate call on line 258.

### WR-06: `FileSystem.cacheDirectory` may be null — no null guard

**File:** `src/lib/files.ts:30`
**Issue:** `FileSystem.cacheDirectory` can be `null` in certain environments (e.g., Expo Go on web, or if the cache directory is unavailable). The template string `${FileSystem.cacheDirectory}${filename}` would produce `"nullmoney-tracking-..."` as the path, causing `writeAsStringAsync` to fail with a confusing error.

```typescript
const cachePath = `${FileSystem.cacheDirectory}${filename}`;
```

**Fix:** Add a null guard:

```typescript
if (!FileSystem.cacheDirectory) {
  throw new Error("Cache directory unavailable");
}
const cachePath = `${FileSystem.cacheDirectory}${filename}`;
```

### WR-07: Toast "Open" button is a no-op placeholder

**File:** `src/screens/ExportScreen.tsx:326-328`
**Issue:** When a successful export toast is shown, the "Open" action button (line 334) only dismisses the toast. The comment on line 327 acknowledges this is a placeholder. Users who tap "Open" expecting to view the exported file will see nothing happen beyond the toast disappearing.

**Fix:** Implement file opening using `expo-file-system` `getContentUriAsync` + `expo-intent-launcher` (Android) or open the file directly (iOS). Alternatively, remove the "Open" button and only show a "Dismiss" action until the feature is ready.

## Info

### IN-01: `handleRetry` is a trivial wrapper that could be inlined

**File:** `src/screens/ExportScreen.tsx:153-156`
**Issue:** `handleRetry` calls `setToast(null)` then `handleExport()`. This is a 3-line wrapper used only once (line 330). It could be inlined in the toast action handler for clarity.

**Fix:** Inline or keep as-is — low priority, purely stylistic.

### IN-02: Category breakdown in PDF mixes expense and income categories

**File:** `src/lib/exportPipeline.ts:50-60`
**Issue:** The `categoryTotals` map aggregates both expense and income categories together. If a user has categories with the same ID in both collections (unlikely with Firestore auto-IDs, but possible with manual IDs), they would be merged. The breakdown section also doesn't indicate whether each category is an expense or income category.

**Fix:** Consider adding a type indicator (expense/income) to the category breakdown, or split into two sections. Low priority for a personal app.

---

_Reviewed: 2026-08-09T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
