---
phase: 02-categories
plan: 01
subsystem: data
tags: [react-context, firestore, onSnapshot, tdd, categoriesprovider]
requires:
  - phase: 01-auth
    provides: AuthProvider + useAuth hook, firebase/app singletons, firebase/queries builders
  - phase: 01-auth
    provides: jest-expo preset, firebase mock patterns
provides:
  - CategoriesProvider context + useCategories hook exposing expenseCategories, incomeCategories, usageMap, addCategory, deleteCategory
  - Unit tests for all CategoriesProvider behaviors (11 tests)
affects:
  - 02-categories (CategoriesScreen consumes CategoriesProvider)
  - 03-entries (entry form category dropdowns source from CategoriesProvider)

tech-stack:
  added:
    - "@types/react-test-renderer" — dev dependency for test type safety
  patterns:
    - React Context + Firestore onSnapshot provider pattern (follows Phase 1 AuthProvider exactly)
    - jest.mock strategy for firebase/firestore, firebase/app, @firebase/auth, queries, AuthProvider
    - Module-level Context + custom hook with null guard
    - React 19 test-renderer: renderer.create MUST be wrapped in act()

key-files:
  created:
    - src/categories/CategoriesProvider.tsx — React Context provider with three Firestore onSnapshot listeners, addCategory (duplicate check + addDoc), deleteCategory (in-use guard + deleteDoc), usageMap derivation
    - src/categories/__tests__/CategoriesProvider.test.tsx — 11 unit tests covering all behaviors
  modified: []

key-decisions:
  - "React 19 react-test-renderer requires wrapping renderer.create in act() — child components do not execute without it"
  - "Mocked firebase/firestore, firebase/app, @firebase/auth at module level using jest.mock with controlled callbacks for onSnapshot"
  - "doc() mock joins multiple path segments (for deleteDoc ref) using segments.join('/')"

patterns-established:
  - "CategoriesProvider follows AuthProvider pattern: module-level createContext(null), custom hook with null guard, useEffect for subscriptions with cleanup"
  - "Firestore mock strategy: capture onSnapshot callbacks in a Record<tag, fn>, fire them from test code via helper functions"
  - "Test component captures context value in module-level variable for assertions (avoids callback-during-render pattern)"

requirements-completed: [CATS-02, CATS-03, CATS-04]

coverage:
  - id: D1
    description: "CategoriesProvider exposes useCategories() with expenseCategories, incomeCategories, usageMap, addCategory, deleteCategory"
    requirement: CATS-02
    verification:
      - kind: unit
        ref: "src/categories/__tests__/CategoriesProvider.test.tsx#addCategory"
        status: pass
    human_judgment: false
  - id: D2
    description: "Usage count map (Map<categoryId, count>) derived live from entries onSnapshot"
    requirement: CATS-03
    verification:
      - kind: unit
        ref: "src/categories/__tests__/CategoriesProvider.test.tsx#usageMap"
        status: pass
    human_judgment: false
  - id: D3
    description: "deleteCategory guards via categoryInUse query before deleteDoc; throws 'Category is in use' if non-empty"
    requirement: CATS-04
    verification:
      - kind: unit
        ref: "src/categories/__tests__/CategoriesProvider.test.tsx#deleteCategory"
        status: pass
    human_judgment: false
  - id: D4
    description: "Three onSnapshot listeners subscribe when user.uid is available; all unsub on sign-out"
    verification:
      - kind: unit
        ref: "src/categories/__tests__/CategoriesProvider.test.tsx#listener lifecycle"
        status: pass
    human_judgment: false
  - id: D5
    description: "useCategories() throws when called outside CategoriesProvider"
    verification:
      - kind: unit
        ref: "src/categories/__tests__/CategoriesProvider.test.tsx#useCategories guard"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-08-07
status: complete
---

# Phase 2 Plan 1: CategoriesProvider — Firestore-backed React Context with add/delete/usage counts

**CategoriesProvider delivers a React Context with three Firestore onSnapshot subscriptions, inline duplicate-checked category creation, in-use deletion guard, and a live derived usage-count map — fully unit-tested (11 tests) following TDD gates.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-06T19:31:38Z
- **Completed:** 2026-08-06T19:48:22Z
- **Tasks:** 2 (RED → GREEN)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Created `src/categories/CategoriesProvider.tsx` — React Context provider following the exact Phase 1 AuthProvider pattern
- Three Firestore `onSnapshot` subscriptions: expenseCategories, incomeCategories, entries — all uid-scoped via `queries.ts` builders, all unsubscribe on sign-out
- `addCategory(kind, name)`: trims input, silent no-op on blank, case-insensitive duplicate check with "Already exists" error, writes `{ uid, name, createdAt }` to the target collection
- `deleteCategory(kind, categoryId)`: runs `categoryInUse` query before `deleteDoc`, throws "Category is in use" if non-empty
- `usageMap`: `Map<string, number>` rebuilt per `entriesBase` onSnapshot callback — categoryId → count
- 11 unit tests covering all behaviors using mocked Firebase modules + react-test-renderer

## Task Commits

Each TDD gate was committed atomically:

1. **RED gate: Failing tests** — `eeaa6cd` (test)
2. **GREEN gate: Passing implementation** — `2354ace` (feat)

## TDD Gate Compliance

- RED commit (`eeaa6cd`) exists and predates GREEN commit (`2354ace`) in git log ✓
- RED commit tests failed because CategoriesProvider.tsx did not exist (module not found) ✓
- GREEN commit tests pass: 11/11 ✓
- Full suite: 75/75 tests pass, no regressions ✓
- TypeScript: `npx tsc --noEmit` exits 0 ✓

## Files Created/Modified

- `src/categories/CategoriesProvider.tsx` — React Context provider: three onSnapshot listeners, addCategory, deleteCategory, usageMap derivation, useCategories hook (created)
- `src/categories/__tests__/CategoriesProvider.test.tsx` — 11 unit tests mocking firebase/firestore, AuthProvider, queries (created)
- `package.json` — added `@types/react-test-renderer` dev dependency (modified)
- `package-lock.json` — lock file update for @types/react-test-renderer (modified)

## Decisions Made

- React 19 test-renderer requires wrapping `renderer.create` in `act()` — child components never execute without it. This was discovered during test debugging and is a behavioral change from React 18
- Mock strategy: `jest.mock` for `firebase/firestore`, `firebase/app`, `@firebase/auth`, `../../auth/AuthProvider`, `../../firebase/queries`, `../../firebase/config` — each mock captures onSnapshot callbacks or returns tagged objects for assertion
- `doc()` mock joins multiple path segments using `segments.join("/")` to correctly simulate `doc(db, collectionPath, documentId)` for deleteDoc ref validation
- No REFACTOR phase needed — implementation is clean, follows the research pattern exactly, and has no duplication or complexity issues

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] React 19 test-renderer act() requirement**

- **Found during:** GREEN gate execution (tests failing despite correct implementation)
- **Issue:** `renderer.create` in React 19 does not execute child component bodies unless wrapped in `act()`. Without `act()`, context values are null and hooks never run. This is a React 19 behavioral change.
- **Fix:** Wrapped all `renderer.create` calls in `act()` wrapper. Updated the hook guard test to assert on `act()` boundary instead of `renderer.create` directly (errors propagate through `act()`).
- **Files modified:** `src/categories/__tests__/CategoriesProvider.test.tsx`
- **Verification:** All 11 tests pass with `npx jest src/categories`
- **Committed in:** `2354ace` (GREEN commit)

**2. [Rule 3 - Blocking] Missing firebase module mocks**

- **Found during:** GREEN gate execution (import chain error: `initializeFirestore is not a function`)
- **Issue:** `src/firebase/app.ts` calls `initializeFirestore()`, `initializeApp()`, `initializeAuth()`, `getReactNativePersistence()` at module load. The test mock for `firebase/firestore` did not include `initializeFirestore`, and `firebase/app` and `@firebase/auth` were not mocked.
- **Fix:** Added `jest.mock` for `firebase/app` (returns `initializeApp`), `@firebase/auth` (returns `initializeAuth`, `getReactNativePersistence`), `../../firebase/config` (returns `firebaseConfig: {}`). Added `initializeFirestore` to `firebase/firestore` mock.
- **Files modified:** `src/categories/__tests__/CategoriesProvider.test.tsx`
- **Verification:** Module imports resolve without errors; tests execute
- **Committed in:** `2354ace` (GREEN commit)

**3. [Rule 3 - Blocking] Missing @types/react-test-renderer for TypeScript compilation**

- **Found during:** `npx tsc --noEmit` check after GREEN gate
- **Issue:** `react-test-renderer` imported in test file had no type declarations, causing TS7016 error
- **Fix:** Installed `@types/react-test-renderer` as dev dependency
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `2354ace` (GREEN commit)

**4. [Rule 1 - Bug] doc() mock only captured first path segment**

- **Found during:** GREEN gate (deleteCategory test: expected `_tag: "expenseCategories/cat-to-delete"` but got `_tag: "expenseCategories"`)
- **Issue:** `doc` mock was `(_db: any, path: string) => ({ _tag: path })` but Firestore `doc()` accepts `(db, collectionPath, documentId)` — second segment was dropped
- **Fix:** Changed to `(_db: any, ...segments: string[]) => ({ _tag: segments.join("/") })`
- **Files modified:** `src/categories/__tests__/CategoriesProvider.test.tsx`
- **Verification:** deleteCategory test passes with correct ref path
- **Committed in:** `2354ace` (GREEN commit)

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** All auto-fixes were necessary for the tests to establish the correct mock environment. No scope creep. No architectural changes.

## Issues Encountered

- React 19's `react-test-renderer` behavioral change (act() requirement for initial render) required investigation and test restructuring. This is a known React 19 change — errors thrown during render are caught by React and logged via `console.warn` rather than propagating through `renderer.create`. Wrapping in `act()` makes error boundaries work properly.
- `@ts-expect-error` directives inside object literals in `jest.mock` factories do not suppress TypeScript errors on the correct lines — the `@ts-expect-error` comment applies to the next statement, not the next property. The only error was on `onSnapshot`'s spread; `addDoc`/`deleteDoc`/`getDocs` spreads did not trigger the same error (likely different type inference).

## Known Stubs

None — the implementation is complete with no stubs, placeholders, or TODO items. All context values are wired to real Firestore onSnapshot listeners (mocked in tests, real in app).

## Threat Flags

None — all threats in the plan's `<threat_model>` are mitigated: uid scoping (T-2-01 via queries.ts), uid in addDoc payload (T-2-02, test-verified), listener cleanup (T-2-05, test-verified), category InUse guard (T-2-04, test-verified). No new security surface introduced.

## User Setup Required

None — no external service configuration required. CategoriesProvider integrates with existing Firebase project (Phase 1 Firestore, auth).

## Next Phase Readiness

- CategoriesProvider is ready for `02-02-PLAN.md` (CategoriesScreen) — the state contract matches the UI-SPEC exactly
- `useCategories()` hook exports `expenseCategories`, `incomeCategories`, `usageMap`, `addCategory`, `deleteCategory` — all that the CategoriesScreen needs
- No Firestore rule changes needed — writes go through the same uid-scoped collections already protected by Phase 1 rules

---

*Phase: 02-categories*
*Completed: 2026-08-07*
