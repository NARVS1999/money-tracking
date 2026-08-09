---
phase: 03-entries
reviewed: 2026-08-09T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/entries/EntriesProvider.tsx
  - src/components/EntryRow.tsx
  - src/components/DateSectionHeader.tsx
  - src/components/EntryForm.tsx
  - src/screens/ExpensesScreen.tsx
  - src/screens/IncomeScreen.tsx
  - App.tsx
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 3 introduces the entry data layer (`EntriesProvider`), UI components (`EntryRow`, `DateSectionHeader`, `EntryForm`), and wires them into `ExpensesScreen`/`IncomeScreen` via `App.tsx`. The implementation follows the established `CategoriesProvider` pattern correctly: module-level `createContext(null)`, custom hook with null guard, `useEffect` with cleanup, `useCallback` for stable function references.

One critical security concern: `deleteEntry` does not verify document ownership before deletion. Three warnings cover a hardcoded color, a misleading "Retry" button label, and a missing deleted-entry guard in the form. Three info items address code duplication across the two nearly-identical screen components.

No dangerous function usage (`eval`, `innerHTML`, etc.) or hardcoded secrets were found. The provider nesting in `App.tsx` (`EntriesProvider` > `CategoriesProvider`) is correct — `CategoriesProvider` subscribes to `entriesBase(uid)` for its usage map, so it must sit inside `EntriesProvider`.

## Critical Issues

### CR-01: `deleteEntry` does not verify document ownership before deletion

**File:** `src/entries/EntriesProvider.tsx:188-199`
**Issue:** `deleteEntry(id)` calls `deleteDoc(doc(db, "entries", id))` without first checking if the document belongs to the current user. While Firestore security rules should enforce this server-side, this is a defense-in-depth violation. If security rules have a bug or are in test mode (which is common during development), any authenticated user could delete any other user's entries by guessing/traversing document IDs. The other mutation functions (`addEntry`, `updateEntry`) don't have this issue because they write to authenticated paths, but `deleteDoc` takes a raw document ID.
**Fix:**
```typescript
const deleteEntry = useCallback(
  async (id: string) => {
    if (!user) throw new Error("Not authenticated");
    try {
      // Verify ownership before deletion (defense-in-depth)
      const entryDoc = await getDoc(doc(db, "entries", id));
      if (!entryDoc.exists() || entryDoc.data().uid !== user.uid) {
        throw new Error("Entry not found");
      }
      await deleteDoc(doc(db, "entries", id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed — retry?";
      setLastError(msg);
      throw e;
    }
  },
  [user],
);
```
Add `getDoc` to the firebase/firestore import at line 17.

## Warnings

### WR-01: Hardcoded color in EntryRow swipe actions

**File:** `src/components/EntryRow.tsx:31,39`
**Issue:** The Edit and Copy swipe actions use a hardcoded `"#E5E7EB"` color instead of `colors.border` from the theme tokens. This creates a maintenance issue if the color scheme changes — these two buttons would remain the old color while the rest of the app updates.
**Fix:**
```tsx
// Line 31 and 39: replace "#E5E7EB" with colors.border
style={[styles.swipeAction, { backgroundColor: colors.border }]}
```

### WR-02: "Retry" button on error toast only clears the error, doesn't retry

**File:** `src/screens/ExpensesScreen.tsx:127-129` and `src/screens/IncomeScreen.tsx:127-129`
**Issue:** The error toast's "Retry" button calls `clearError()` which just dismisses the toast. Users expecting it to retry the failed operation will be confused when the error simply disappears without reattempting anything. The label "Retry" implies re-execution, but the behavior is "Dismiss".
**Fix:** Either rename the button to "Dismiss" to match its actual behavior, or accept that in this architecture the Firestore `onSnapshot` listener will automatically retry on network recovery (making a manual retry unnecessary), in which case "Dismiss" is the correct label.

### WR-03: Entry form does not handle the case where an entry is deleted while the form is open

**File:** `src/components/EntryForm.tsx:43-46`
**Issue:** When in `edit` or `copy` mode, the form uses `useMemo` to look up the existing entry by `entryId`. If the entry is deleted by another device or session while the form is open, `existingEntry` becomes `null`. The form then initializes with empty/default values and the user can still tap "Save", which would create a new document instead of updating the deleted one. The user has no indication that the entry they were editing no longer exists.
**Fix:**
```tsx
// After the existingEntry useMemo, add:
useEffect(() => {
  if ((mode === "edit" || mode === "copy") && entryId && !existingEntry && !isLoading) {
    Alert.alert("Entry not found", "This entry may have been deleted.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
  }
}, [mode, entryId, existingEntry, isLoading, navigation]);
```
Note: This requires `isLoading` from `useEntries()` (already destructured at line 36). The guard prevents the alert from firing before entries have loaded.

## Info

### IN-01: Duplicated `groupByDate` function across ExpensesScreen and IncomeScreen

**File:** `src/screens/ExpensesScreen.tsx:20-34` and `src/screens/IncomeScreen.tsx:20-34`
**Issue:** Both screens contain identical implementations of `groupByDate`. This violates DRY and means any bug fix or improvement must be applied in two places.
**Fix:** Extract to `src/lib/entries.ts` (or `src/lib/dates.ts`):
```typescript
export function groupByDate<T extends { date: string }>(items: T[]): { date: string; data: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.date);
    if (list) { list.push(item); } else { map.set(item.date, [item]); }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    .map(([date, data]) => ({ date, data }));
}
```

### IN-02: ExpensesScreen and IncomeScreen are nearly identical — consider extracting a shared component

**File:** `src/screens/ExpensesScreen.tsx` and `src/screens/IncomeScreen.tsx`
**Issue:** The two screens share identical logic (filtering, sectioning, flatData computation, navigation handlers, FAB, error toast, styles), differing only in `entry.type` filter and empty-state copy. This makes maintenance harder — any UI change must be applied twice.
**Fix:** Create a shared `EntryListScreen` component that accepts `entryType: "expense" | "income"` and the empty-state copy as props. The screens become thin wrappers:
```tsx
// ExpensesScreen.tsx
export default function ExpensesScreen() {
  return <EntryListScreen type="expense" emptySubtitle="Tap the + button below to log your first expense." />;
}
```

### IN-03: Inconsistent error handling patterns between EntryForm and screens

**File:** `src/components/EntryForm.tsx:129-131` vs `src/screens/ExpensesScreen.tsx:124-131`
**Issue:** `EntryForm` shows an `Alert.alert()` on save failure (line 131), while the screens display an error toast with a clear button (lines 124-131). Both approaches are valid but the inconsistency may confuse users — some errors appear as popups, others as banners.
**Fix:** This is acceptable for now since the error contexts differ (form save vs. list subscription). Document the convention: forms use Alerts (modal context), screens use toasts (list context). If a unified approach is desired later, standardize on one pattern.

---

_Reviewed: 2026-08-09T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
