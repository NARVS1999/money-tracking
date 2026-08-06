---
phase: 02-categories
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/categories/CategoriesProvider.tsx
  - src/categories/__tests__/CategoriesProvider.test.tsx
  - src/screens/CategoriesScreen.tsx
  - src/screens/__tests__/CategoriesScreen.test.tsx
  - App.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-07
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed all five Phase 2 source files: `CategoriesProvider`, `CategoriesScreen`, `App.tsx`, and the two test suites. The architecture follows the AuthProvider pattern faithfully (module-level context, custom hook with null guard, `useEffect` with cleanup, uid-scoped query builders from `src/firebase/queries`). NFR-01 uid scoping is enforced at the query layer for reads; the provider includes `uid` in `addDoc` payloads and gates deletes behind `categoryInUse`. The screen implementation matches the UI-SPEC contract: SectionList with sticky headers, per-group inline add inputs, Swipeable rows, and live usage counts.

Two critical bugs were found: (1) an unsafe `as Category` type assertion that can cause runtime crashes if Firestore documents have unexpected shapes, and (2) stale state retention on sign-out that leaks the prior user's data to the next authenticated session. Three warnings cover defense-in-depth gaps and error handling weaknesses. Two informational items note code quality opportunities.

## Critical Issues

### CR-01: Unsafe `as Category` type assertion bypasses runtime validation

**File:** `src/categories/CategoriesProvider.tsx:56-62`
**Issue:** The `onSnapshot` callbacks cast Firestore document data to `Category` with no runtime validation:

```typescript
setExpenseCategories(
  snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category)),
);
```

`d.data()` returns `DocumentData` (effectively `Record<string, any>`). If any document in `expenseCategories` or `incomeCategories` lacks a `name` field (e.g., manual Firebase console edit, future migration, corrupt write), the Category type promises `name: string` but the runtime value can be `undefined`. When `addCategory`'s duplicate check later calls `c.name.toLowerCase().trim()` on line 89, it throws a **TypeError** that propagates unhandled. The CategoriesScreen render would also show blank text for missing names.

This is a type-unsound assertion through a trust boundary (Firestore network data). The Phase 1 `AuthProvider` avoids this pattern entirely by using Firebase's typed `User` object directly.

**Fix:**
```typescript
setExpenseCategories(
  snap.docs
    .map((d) => {
      const data = d.data();
      const name = typeof data.name === 'string' ? data.name : '';
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt
        : Timestamp.now();
      return { id: d.id, name, createdAt };
    }),
);
```

### CR-02: Previous user's category data persists in state across sign-out/sign-in

**File:** `src/categories/CategoriesProvider.tsx:50-78`
**Issue:** When `user` transitions to `null` (sign-out), the `useEffect` cleanup unsubscribes the three `onSnapshot` listeners, but the `useState` values — `expenseCategories`, `incomeCategories`, and `usageMap` — retain the **previous user's data**. Because `CategoriesProvider` wraps `RootNavigator` in `App.tsx:45` and never unmounts across sessions, when a **different user** signs in on the same device, the previous user's categories are visible on screen until the new `onSnapshot` subscriptions fire and overwrite the state.

This is a data leakage bug: User B can momentarily see User A's category names. On a shared device (the app's own seeded default account scenario), this violates account isolation.

**Trace:**
1. User A signs in → Provider subscribes → state fills with User A's categories.
2. User A signs out → `user` becomes `null` → effect returns at line 51 → state preserves User A's data.
3. User B signs in → effect re-runs (new uid) → User A's stale data renders until snapshots deliver User B's data.

**Fix:** Clear state before the early return:
```typescript
useEffect(() => {
  if (!user) {
    setExpenseCategories([]);
    setIncomeCategories([]);
    setUsageMap(new Map());
    return;
  }
  const uid = user.uid;
  // ... rest of effect unchanged
}, [user]);
```

## Warnings

### WR-01: `deleteCategory` lacks defense-in-depth document ownership check

**File:** `src/categories/CategoriesProvider.tsx:108`
**Issue:** `deleteDoc(doc(db, kind, categoryId))` deletes the document directly by ID without verifying that the document's `uid` field matches `user.uid`. The UI only exposes categories returned by `categoriesOf(uid, kind)` (which filters by uid), so normal usage is safe. However, if Firestore security rules are ever misconfigured (or if a future code path bypasses the UI filter), a user could delete another user's category by guessing a document ID.

The `categoryInUse` guard on line 106 checks whether **entries** reference this category (scoped to `user.uid`), but it does **not** verify that the **category document itself** belongs to this user.

The `addCategory` function on line 94 does store `uid` in the document — a read-before-delete check against that field completes the defense-in-depth chain.

**Fix:**
```typescript
const deleteCategory = useCallback(
  async (kind: CategoryKind, categoryId: string) => {
    if (!user) throw new Error("Not authenticated");
    const categoryRef = doc(db, kind, categoryId);
    const categorySnap = await getDocs(
      query(collection(db, kind), where("uid", "==", user.uid))
    );
    // Verify the document belongs to this user
    if (!categorySnap.docs.some(d => d.id === categoryId)) {
      throw new Error("Category not found");
    }
    const inUseSnap = await getDocs(categoryInUse(user.uid, categoryId));
    if (!inUseSnap.empty) throw new Error("Category is in use");
    await deleteDoc(categoryRef);
  },
  [user],
);
```

### WR-02: `addCategory` / `deleteCategory` silently no-op when `!user`

**File:** `src/categories/CategoriesProvider.tsx:82,105`
**Issue:** Both functions begin with `if (!user) return;` — they resolve the promise silently with no error. Callers have no way to distinguish "success" from "silently skipped because no user is signed in." The `CategoriesScreen` error handler at lines 65-68 and 135-140 catches **thrown** errors but doesn't account for silent no-ops.

In practice, this is currently unreachable from the UI because `CategoriesProvider` is only mounted inside the authenticated tab navigator stack (the `user ? MainTabs : SignIn` conditional in `RootNavigator`). But it's a latent bug for any future code or test that calls these functions outside that guard.

**Fix:** Throw or return a rejected promise:
```typescript
const addCategory = useCallback(
  async (kind: CategoryKind, name: string) => {
    if (!user) throw new Error("Not authenticated");
    // ... rest unchanged
  },
  [user, expenseCategories, incomeCategories],
);
```

### WR-03: Overly broad error catch with unvalidated property access

**File:** `src/screens/CategoriesScreen.tsx:65`
**Issue:**
```typescript
} catch (e: any) {
  setError(e.message || "Couldn't add category. Try again.");
```

The catch clause types the error as `any` and accesses `e.message` without checking whether `e` is actually an `Error` instance. If `addCategory` threw a string, a plain object, or `null`, `e.message` would be `undefined` (triggering the fallback message). While the fallback is present, the type-unsafe access is fragile and violates the codebase's TypeScript conventions.

**Fix:**
```typescript
} catch (e: unknown) {
  const message = e instanceof Error ? e.message : "Couldn't add category. Try again.";
  setError(message);
```

## Info

### IN-01: `renderRightActions` creates new component definitions on every render

**File:** `src/screens/CategoriesScreen.tsx:94-155`
**Issue:** `renderRightActions` is called during each render of each row and unconditionally returns a **new** function component (`SwipeInUseAction` or `SwipeDeleteAction`) via a function declaration. This means every row in the SectionList receives new React component references on every render, causing unnecessary reconciliation. At ~20 categories, the performance impact is negligible, but the pattern is worth noting for correctness.

**Fix:** Hoist the component definitions out of `renderRightActions` and use props instead:
```typescript
function SwipeInUseAction() {
  return (
    <View style={[styles.swipeAction, { backgroundColor: "#E5E7EB" }]}>
      <Text style={[styles.swipeActionText, { color: "#6B7280" }]}>In use</Text>
    </View>
  );
}
// Then in renderRightActions: return count > 0 ? SwipeInUseAction : SwipeDeleteAction;
```
_(Note: the `SwipeDeleteAction` needs `item` and `kind` via closure or props — extract the `onPress` as a prop.)_

### IN-02: Input trimming duplication between screen and provider

**File:** `src/screens/CategoriesScreen.tsx:56` and `src/categories/CategoriesProvider.tsx:83`
**Issue:** Both `CategoriesScreen.handleAdd` and `CategoriesProvider.addCategory` independently trim the input string and check for empty/whitespace-only. The screen-level check is legitimate defense-in-depth (prevents an unnecessary async call), but the provider-level check is part of the public API contract. If the trim behavior ever changes (e.g., different whitespace handling), it must be updated in two places.

**Fix:** Document or consolidate. Either:
- Remove the screen-level trim check and rely entirely on the provider (the async overhead is negligible for a single `addDoc`), or
- Keep both but add a `@ts-note` documenting the intentional duplication.

---

_Reviewed: 2026-08-07_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
