# Phase 2: Categories - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the Categories screen with two category groups (expense/income), per-group inline add, live usage counts per category, and a safe delete guard that blocks deletion of in-use categories. It builds on Phase 1's auth, Firestore queries, and tab shell. Uses `categoriesOf(uid, kind)` from `queries.ts` which queries `expenseCategories` and `incomeCategories` collections (each doc: `{ uid, name, createdAt }`). The Firestore security rules already scope by `uid`. Categories feed the Phase 3 entry form dropdowns — the groups defined here determine what options appear per entry type.
</domain>

<decisions>
## Implementation Decisions

### Category Group Layout
- Stacked vertically with sticky section headers (Expense Categories / Income Categories)
- Always visible — non-collapsible (max ~15–20 categories total, no space pressure)
- Empty state per group: "No expense categories yet" / "No income categories yet" with inline add directly beneath
- Compact single-line rows (44px touch target min): category name left, usage count right

### Inline Add UX
- Fixed input at the top of each group — always visible, no toggle/expand
- Each group has its own inline input — user types into the target group directly, no group selector
- Save via keyboard "return"/"done" submits; also a small "＋" button next to input as fallback
- Case-insensitive trim duplicate check — reject with inline error "Already exists"

### Delete Interaction
- Swipe left to reveal red "Delete" action — standard mobile pattern, minimal visual clutter
- In-use categories: swipe shows greyed-out "In use" instead of "Delete" — immediate visual signal, no dialog
- Unused category: Alert "Delete [name]? This cannot be undone." with Cancel / Delete buttons
- Orphan handling: N/A — delete always blocked if in use (CATS-04), no orphans possible

### Usage Count Display
- Right-aligned in row, same line as category name, in `textSecondary` color
- Format: "12 entries" / "1 entry" — singular/plural handled
- Live via `onSnapshot` on entries (Firestore listeners) — no manual refresh
- Loading state: show "—" while loading (Firestore local cache makes this near-instant)

### the agent's Discretion
- Swipe implementation library choice (react-native-gesture-handler with Swipeable vs custom PanResponder) — pick whatever integrates best with the existing Expo Go setup
- Exact animation timing and curve for inline add input appearance
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/firebase/queries.ts` — `categoriesOf(uid, kind)` already queries `expenseCategories`/`incomeCategories` uid-scoped; `categoryInUse(uid, categoryId)` for the in-use guard
- `src/auth/AuthProvider.tsx` — `useAuth()` hook for current `user.uid`, pattern to follow for CategoriesProvider
- `src/theme/tokens.ts` — `colors`, `spacing`, `typography`, `radius` — single source for all styling
- `src/screens/PlaceholderScreen.tsx` — existing placeholder pattern, will be replaced

### Established Patterns
- State: React Context + custom hooks (`AuthProvider` + `useAuth` pattern in `src/auth/AuthProvider.tsx`)
- Data: Firestore `onSnapshot` listeners, uid-scoped queries in `src/firebase/queries.ts`
- Styling: Inline StyleSheet via `src/theme/tokens.ts` (no CSS modules, no styled-components)
- Navigation: `@react-navigation/bottom-tabs` v7 — Categories tab already wired in `src/screens/MainTabs.tsx`

### Integration Points
- `CategoriesScreen.tsx` — currently a placeholder wrapper, replaced by this phase
- Phase 3 Entries: category dropdowns source from CategoriesProvider data
- `categoryInUse()` — already in queries.ts, used for delete guard
- Firestore collections: `expenseCategories/{docId}` and `incomeCategories/{docId}` with `{ uid, name, createdAt }`
</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP success criteria — implementation is open to standard React Native patterns consistent with Phase 1 codebase conventions.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>
