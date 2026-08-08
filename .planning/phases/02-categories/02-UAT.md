---
status: complete
phase: 02-categories
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md
started: 2026-08-08T00:00:00.000Z
updated: 2026-08-08T00:09:00.000Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. CategoriesProvider exposes useCategories() with expenseCategories, incomeCategories, usageMap, addCategory, deleteCategory
expected: CategoriesProvider exposes useCategories() with expenseCategories, incomeCategories, usageMap, addCategory, deleteCategory
result: pass
source: automated
coverage_id: D1

### 2. Usage count map (Map<categoryId, count>) derived live from entries onSnapshot
expected: Usage count map (Map<categoryId, count>) derived live from entries onSnapshot
result: pass
source: automated
coverage_id: D2

### 3. deleteCategory guards via categoryInUse query before deleteDoc; throws 'Category is in use' if non-empty
expected: deleteCategory guards via categoryInUse query before deleteDoc; throws 'Category is in use' if non-empty
result: pass
source: automated
coverage_id: D3

### 4. Three onSnapshot listeners subscribe when user.uid is available; all unsub on sign-out
expected: Three onSnapshot listeners subscribe when user.uid is available; all unsub on sign-out
result: pass
source: automated
coverage_id: D4

### 5. useCategories() throws when called outside CategoriesProvider
expected: useCategories() throws when called outside CategoriesProvider
result: pass
source: automated
coverage_id: D5

### 6. Categories tab renders two grouped sections (Expense/Income Categories) with sticky headers
expected: Categories tab renders two grouped sections (Expense/Income Categories) with sticky headers
result: pass
source: automated
coverage_id: D1

### 7. Inline add inputs per group with duplicate detection, keyboard return and '+' button submit, blank input no-op
expected: Inline add inputs per group with duplicate detection, keyboard return and '+' button submit, blank input no-op
result: pass
source: automated
coverage_id: D2

### 8. Live right-aligned usage counts per category row (singular/plural/em-dash loading)
expected: Live right-aligned usage counts per category row (singular/plural/em-dash loading)
result: pass
source: automated
coverage_id: D3

### 9. Swipe-to-delete with in-use guard: grey 'In use' for used categories (non-tappable), red 'Delete' -> Alert.alert confirmation for unused
expected: Swipe-to-delete with in-use guard: grey 'In use' for used categories (non-tappable), red 'Delete' -> Alert.alert confirmation for unused
result: pass
source: automated
coverage_id: D4

### 10. Sign in and reach the Categories tab
expected: Open the app in Expo Go on your phone. Sign in with the seeded default account. You land on the app shell with a tab bar — the Categories tab is visible and tappable.
result: pass

### 11. Categories tab layout — two sections with sticky headers
expected: The Categories tab shows two grouped sections: "Expense Categories" and "Income Categories". Section headers stick to the top while scrolling. Each group has an inline add input at its header.
result: pass

### 12. Inline add a category
expected: Type a new expense category (e.g. "Groceries") and submit via keyboard return or the '+' button. It appears in the Expense list immediately and the input clears. Submitting a duplicate name shows a duplicate error. Submitting a blank input does nothing.
result: pass

### 13. Usage counts per category row
expected: Each category row shows a right-aligned count of entries using it. While counts load you see an em-dash (—); a category with exactly one entry shows the singular form.
result: pass

### 14. Swipe-to-delete on an unused category
expected: Swipe an unused category. A red "Delete" button appears. Tapping it opens a confirmation dialog; confirming removes the category from the list.
result: pass

### 15. Swipe-to-delete on an in-use category
expected: Swipe a category that has at least one entry using it. The revealed button is grey and reads "In use" — it is not tappable and no delete dialog appears.
result: skipped
reason: "No entries exist yet (Phase 3 not built) — there are only categories, so no category can be in use. Guard logic covered by automated tests; re-verify after Phase 3."

### 16. Error display uses locked copy
expected: If a Firestore write fails (e.g. offline), the app shows a friendly, fixed error message — no raw technical/error object text is visible.
result: skipped
reason: "Deferred follow-up: skip for now"

### 17. Re-subscription after sign-out / sign-in
expected: Sign out, then sign back in. The Categories tab still loads the account's categories and counts — listeners re-subscribe and data syncs from Firestore.
result: pass
note: "User confirmed all 5 tabs show after re-sign-in; only the Categories tab has real content, other tabs are placeholders (expected at this stage)."

### 18. End-to-end on-device coverage
expected: The Categories tab works end-to-end on the phone: the app bundles and loads without errors, swipe gestures feel native (smooth, no jank), sticky headers and scrolling behave correctly on your platform.
result: pass

## Summary

total: 18
passed: 16
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps

[none yet]

## Deferred Follow-Ups

- test: 16
  idea: "Error display locked copy — skip for now, test offline behavior later"
  deferred_at: 2026-08-08
