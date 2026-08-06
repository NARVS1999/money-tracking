---
phase: 02-categories
fixed_at: 2026-08-07T00:00:00Z
review_path: .planning/phases/02-categories/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-08-07
**Source review:** .planning/phases/02-categories/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (2 Critical, 3 Warning)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Unsafe `as Category` type assertion bypasses runtime validation

**Files modified:** `src/categories/CategoriesProvider.tsx`
**Commit:** a62c7df
**Applied fix:** Replaced unsafe `as Category` casts in both `onSnapshot` callbacks (expenseCategories, incomeCategories) with runtime validation. Each document from Firestore now checks that `data.name` is a string (defaulting to empty string if not) and that `data.createdAt` is a `Timestamp` (defaulting to `Timestamp.now()` if not). This prevents TypeError crashes when Firestore documents have unexpected shapes.

### CR-02: Previous user's category data persists in state across sign-out/sign-in

**Files modified:** `src/categories/CategoriesProvider.tsx`
**Commit:** 1c51037
**Applied fix:** Added state clearing before the early return in the `useEffect` when `user` is null. On sign-out, `expenseCategories`, `incomeCategories`, and `usageMap` are immediately reset to empty/default values, preventing User B from momentarily seeing User A's data before the new onSnapshot subscriptions fire.

### WR-01: `deleteCategory` lacks defense-in-depth document ownership check

**Files modified:** `src/categories/CategoriesProvider.tsx`
**Commit:** f4f7135
**Applied fix:** Added ownership verification before deletion. `deleteCategory` now queries the category collection for documents matching the current user's uid and checks if the target document ID is among them. If not found, it throws "Category not found". Also added `query` and `where` imports from firebase/firestore.

### WR-02: `addCategory` / `deleteCategory` silently no-op when `!user`

**Files modified:** `src/categories/CategoriesProvider.tsx`
**Commit:** d799921
**Applied fix:** Replaced both `if (!user) return;` guards in `addCategory` and `deleteCategory` with `if (!user) throw new Error("Not authenticated");`. Callers (like `CategoriesScreen`) can now catch and display the error instead of experiencing a silent no-op.

### WR-03: Overly broad error catch with unvalidated property access

**Files modified:** `src/screens/CategoriesScreen.tsx`
**Commit:** 2b6d9d7
**Applied fix:** Changed the catch clause in `handleAdd` from `catch (e: any)` to `catch (e: unknown)` with a type-safe `e instanceof Error` check. The error message is extracted only if `e` is an `Error` instance; otherwise the fallback message is used. This eliminates unsafe property access on `any` and aligns with TypeScript best practices.

---

_Fixed: 2026-08-07_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
