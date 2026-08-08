# Phase 5: Export — Research

**Researcher:** gsd-planner (inline research pass)
**Date:** 2026-08-08
**Risk Level:** HIGH — SAF + SheetJS CDN + base64 writes

---

## 1. expo-file-system/legacy — SAF for Android Downloads

**Critical finding:** In Expo SDK 57, the main `expo-file-system` module exports the new `File`/`Directory`/`Paths` API. The legacy methods (`writeAsStringAsync`, `StorageAccessFramework`, `requestDirectoryPermissionsAsync`, `createFileAsync`) moved to `expo-file-system/legacy`. Importing them from the main module **throws at runtime**.

**Correct import pattern:**
```typescript
import * as FileSystem from 'expo-file-system/legacy';
// NOT: import { ... } from 'expo-file-system';
```

**SAF flow (Android):**
1. `FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()` — user picks a directory
2. `FileSystem.StorageAccessFramework.createFileAsync(dirUri, filename, mimeType)` — creates file
3. `FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, content, encoding)` — writes content

**SAF permissions:** `requestDirectoryPermissionsAsync` returns `{ granted, directoryUri }`. If not granted, show error toast. The user only needs to grant once per session (the returned `directoryUri` can be reused).

**Alternative (no SAF):** Use `FileSystem.writeAsStringAsync(FileSystem.cacheDirectory + filename, content)` then `Sharing.shareAsync()`. This works on both platforms but doesn't auto-save to Downloads on Android. The CONTEXT.md decision says "Android: Downloads via SAF; iOS: Share sheet" — so SAF is the primary path on Android.

**File naming:** `money-tracking-YYYY-MM-DD-to-YYYY-MM-DD.{ext}`

---

## 2. SheetJS 0.20.3 from CDN

**npm's `xlsx` is frozen at 0.18.5** (no releases since 2023). SheetJS LLC distributes 0.20.3 from their CDN.

**Install command:**
```bash
npm install -S https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

**Important:** Add `"allowScripts": { "xlsx": true }` to package.json if needed.

**Import pattern:**
```typescript
import * as XLSX from 'xlsx';
```

**Excel generation:**
```typescript
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data); // data = array of arrays
XLSX.utils.book_append_sheet(wb, ws, 'Entries');
const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
```

**CSV generation:**
```typescript
const csv = XLSX.utils.sheet_to_csv(ws);
// Write as UTF-8 string (no base64 needed for CSV)
```

**Key API notes:**
- `XLSX.write(wb, { type: 'base64' })` returns a base64 string — write via `FileSystem.writeAsStringAsync` with `FileSystem.EncodingType.Base64`
- `XLSX.utils.aoa_to_sheet([[...]])` creates a sheet from array-of-arrays
- Column widths can be set via `ws['!cols'] = [{ wch: 12 }, ...]`

---

## 3. expo-print — PDF Generation

**API:**
```typescript
import * as Print from 'expo-print';

const { uri } = await Print.printToFileAsync({
  html: htmlString,
  base64: false, // returns { uri } not base64
});
// uri = file path in cache directory
```

**HTML template notes:**
- Use inline CSS (no external stylesheets in RN)
- `@page { size: A4 landscape; margin: 1cm; }` for landscape
- Simple table with borders for entry list
- Green/red for income/expense amounts
- Title: "Money Tracking — {Month YYYY}"

**Flow:**
1. Generate HTML string from entries + totals
2. `Print.printToFileAsync({ html })` → returns `{ uri }` in cache
3. Move from cache to Downloads (Android) or share (iOS)

---

## 4. expo-sharing — iOS Share Sheet

**API:**
```typescript
import * as Sharing from 'expo-sharing';

await Sharing.shareAsync(fileUri, {
  mimeType: 'application/pdf', // or appropriate type
  dialogTitle: 'Save export',
});
```

**Platform check:** `Platform.OS === 'ios'` → use sharing. `Platform.OS === 'android'` → use SAF.

---

## 5. Base64 Write Pattern

For PDF and Excel (binary content), the pattern is:
1. Generate content as base64 string
2. Write to cache: `FileSystem.writeAsStringAsync(cachePath, base64, { encoding: FileSystem.EncodingType.Base64 })`
3. Move to final destination (SAF on Android, share on iOS)

For CSV (text content):
1. Generate CSV string
2. Write to cache: `FileSystem.writeAsStringAsync(cachePath, csvString)`
3. Move to final destination

---

## 6. Date Picker in React Native

`@react-native-community/datetimepicker` 9.1.0 (bundled in Expo Go):
- Mode: `"date"` (calendar picker)
- `maximumDate={new Date()}` — no future dates
- `minimumDate` / `maximumDate` for range constraints
- Android: native dialog, iOS: inline picker
- Returns `Date` object in `onChange` event

---

## 7. Package Legitimacy

| Package | Source | Status |
|---------|--------|--------|
| expo-print | SDK 57 bundled | ✅ Official |
| expo-sharing | SDK 57 bundled | ✅ Official |
| expo-file-system | SDK 57 bundled (already installed) | ✅ Official |
| xlsx (SheetJS) | CDN tarball | ✅ SheetJS LLC official distribution |

No `[ASSUMED]` or `[SUS]` packages. All are official Expo SDK modules or the documented SheetJS CDN distribution.

---

## 8. Platform Branching Strategy

The only `Platform.OS` branch in the entire export pipeline is the save/write step:
- Android: SAF → Downloads folder
- iOS: expo-sharing → share sheet

Everything else (HTML generation, XLSX generation, CSV generation, date formatting) is platform-agnostic.

---

## 9. Potential Pitfalls

1. **SAF permission denial:** User might deny directory access. Must handle gracefully with error toast.
2. **Large file generation:** For date ranges with many entries, the XLSX/PDF generation could be slow. Show loading indicator.
3. **Cache cleanup:** Files written to cache should be cleaned up after export (delete from cache after SAF copy/share).
4. **SheetJS bundle size:** The CDN tarball is ~500KB. It's a pure JS library so it works in Expo Go but adds to the bundle.
5. **expo-print HTML limitations:** Complex CSS may not render correctly. Keep HTML simple with inline styles.
