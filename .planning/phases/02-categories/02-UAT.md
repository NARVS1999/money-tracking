---
status: testing
phase: 02-categories
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md
started: 2026-08-08T00:00:00.000Z
updated: 2026-08-08T00:00:00.000Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 10
name: Sign in and reach the Categories tab
expected: |
  Open the app in Expo Go on your phone. Sign in with the seeded default account. You land on the app shell with a tab bar — the Categories tab is visible and tappable.
awaiting: user response

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
result: [pending]

### 11. Categories tab layout — two sections with sticky headers
expected: The Categories tab shows two grouped sections: "Expense Categories" and "Income Categories". Section headers stick to the top while scrolling. Each group has an inline add input at its header.
result: [pending]

### 12. Inline add a category
expected: Type a new expense category (e.g. "Groceries") and submit via keyboard return or the '+' button. It appears in the Expense list immediately and the input clears. Submitting a duplicate name shows a duplicate error. Submitting a blank input does nothing.
result: [pending]

### 13. Usage counts per category row
expected: Each category row shows a right-aligned count of entries using it. While counts load you see an em-dash (—); a category with exactly one entry shows the singular form.
result: [pending]

### 14. Swipe-to-delete on an unused category
expected: Swipe an unused category. A red "Delete" button appears. Tapping it opens a confirmation dialog; confirming removes the category from the list.
result: [pending]

### 15. Swipe-to-delete on an in-use category
expected: Swipe a category that has at least one entry using it. The revealed button is grey and reads "In use" — it is not tappable and no delete dialog appears.
result: [pending]

### 16. Error display uses locked copy
expected: If a Firestore write fails (e.g. offline), the app shows a friendly, fixed error message — no raw technical/error object text is visible.
result: [pending]

### 17. Re-subscription after sign-out / sign-in
expected: Sign out, then sign back in. The Categories tab still loads the account's categories and counts — listeners re-subscribe and data syncs from Firestore.
result: [pending]

### 18. End-to-end on-device coverage
expected: The Categories tab works end-to-end on the phone: the app bundles and loads without errors, swipe gestures feel native (smooth, no jank), sticky headers and scrolling behave correctly on your platform.
result: [pending]

## Summary

total: 18
passed: 9
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

[none yet]
