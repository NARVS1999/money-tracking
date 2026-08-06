# Phase 2: Categories - Research

**Researched:** 2026-08-07
**Domain:** React Context + Firestore onSnapshot live data, RN SectionList grouped display, react-native-gesture-handler Swipeable, inline add UX, usage counts, safe delete guard
**Confidence:** HIGH (all load-bearing claims verified today against official sources: Expo SDK 57 bundledNativeModules.json, docs.expo.dev, Firebase docs, npm registry)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Category Group Layout
- Stacked vertically with sticky section headers (Expense Categories / Income Categories)
- Always visible — non-collapsible (max ~15–20 categories total, no space pressure)
- Empty state per group: "No expense categories yet" / "No income categories yet" with inline add directly beneath
- Compact single-line rows (44px touch target min): category name left, usage count right

#### Inline Add UX
- Fixed input at the top of each group — always visible, no toggle/expand
- Each group has its own inline input — user types into the target group directly, no group selector
- Save via keyboard "return"/"done" submits; also a small "+" button next to input as fallback
- Case-insensitive trim duplicate check — reject with inline error "Already exists"

#### Delete Interaction
- Swipe left to reveal red "Delete" action — standard mobile pattern, minimal visual clutter
- In-use categories: swipe shows greyed-out "In use" instead of "Delete" — immediate visual signal, no dialog
- Unused category: Alert "Delete [name]? This cannot be undone." with Cancel / Delete buttons
- Orphan handling: N/A — delete always blocked if in use (CATS-04), no orphans possible

#### Usage Count Display
- Right-aligned in row, same line as category name, in `textSecondary` color
- Format: "12 entries" / "1 entry" — singular/plural handled
- Live via `onSnapshot` on entries (Firestore listeners) — no manual refresh
- Loading state: show "—" while loading (Firestore local cache makes this near-instant)

### the agent's Discretion
- Swipe implementation library choice (react-native-gesture-handler with Swipeable vs custom PanResponder) — pick whatever integrates best with the existing Expo Go setup
- Exact animation timing and curve for inline add input appearance

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CATS-01 | Categories tab shows Expense Categories and Income Categories as two separate groups | SectionList with `stickySectionHeadersEnabled`, two sections from CategoriesProvider data; token-based styling from `theme/tokens.ts`; empty state per CONTEXT decision |
| CATS-02 | User can add a category to either group (inline input) | Fixed TextInput per section header with keyboard return + "+" button; `addDoc` to `expenseCategories`/`incomeCategories` collection; Firestore onSnapshot immediately reflects; case-insensitive trim duplicate check client-side |
| CATS-03 | Each category row shows its usage count (number of entries using it) | `onSnapshot` on `entriesBase(uid)` builds a `Map<categoryId, count>` in CategoriesProvider; derived per-category count memoized from the map; live update with Firestore listeners |
| CATS-04 | A category in use cannot be deleted — deletion is blocked with a message; an empty category can be deleted after confirmation | Swipeable `renderRightActions` shows grey "In use" (no action) vs red "Delete" (→ Alert.alert); guard via `categoryInUse(uid, categoryId)` snapshot — limit(1) query already in queries.ts; `deleteDoc` only after confirmation |
</phase_requirements>

## Project Constraints (from AGENTS.md)

Directives extracted from `./AGENTS.md` (STACK.md section — authoritative, treated with same weight as locked decisions):

- **Expo Go workflow only** — every library must run in Expo Go; no custom native modules. `@react-native-firebase/*` is forbidden (needs dev builds).
- **Firebase JS SDK only**; `firebase@^12.17.1` (Expo requires ≥12.0.0). Firestore is the only database.
- **Free Spark plan**; one Firestore database; no Cloud Functions.
- **Auth**: email/password only; default account seeded via Firebase console, never in-app.
- **Currency**: PHP only, integer-cents storage, never floats; formatting via `money.js` only; no `Intl.NumberFormat`.
- **Compatibility**: Android + iOS; QR-code tested on the user's phone.
- **Mandatory rule**: `npx expo install <pkg>` for every native-adjacent package.
- **State**: React Context + hooks (2 contexts at this scale) — no Redux/Zustand. Phase 2 adds a **second** context (CategoriesProvider), staying within the agreed limit.
- **No `persistentLocalCache()`** — Firestore durable cache is IndexedDB-only; memory cache default (session-scoped offline accepted).
- **Navigation**: `@react-navigation/native@7` + `bottom-tabs@7.18.x` + `native-stack@7.18.x`.
- **AsyncStorage must be 2.2.0** (Expo Go SDK 57 pin).

## Summary

Phase 2 delivers the Categories screen — a SectionList of two non-collapsible category groups (expense/income) with per-group inline add, live usage counts, and a swipe-to-delete gesture that blocks deletion of in-use categories. It builds on Phase 1's auth provider, Firestore singleton, uid-scoped query builders, token-based styling, and 5-tab shell.

The core architecture is a second React Context (`CategoriesProvider`) following the exact pattern established by `AuthProvider` in Phase 1: module-level context + custom hook (`useCategories`), `useEffect` subscribing to Firestore `onSnapshot` listeners, and cleanup in the effect return. The provider runs two uid-scoped listeners — one per collection (`expenseCategories`, `incomeCategories`) — and a third listener on all entries to derive usage counts. All queries go through `src/firebase/queries.ts` builders, every one carrying an explicit `uid` filter (NFR-01).

The swipe interaction uses `react-native-gesture-handler`'s `Swipeable` component (bundled in Expo Go SDK 57 at **~2.32.0** [VERIFIED: bundledNativeModules.json + docs.expo.dev]). The `Swipeable` is the standard RN pattern for iOS-style swipe-to-reveal actions — no custom `Animated`/`PanResponder` needed. Reanimated 4.5.1 is also bundled but not required for the v2.x Swipeable pattern; it stays uninstalled unless a later phase needs it.

**Primary recommendation:** Execute in this order — (1) install gesture-handler via `npx expo install react-native-gesture-handler`; (2) build CategoriesProvider (context + 3 onSnapshot listeners); (3) build CategoriesScreen with SectionList, inline inputs, Swipeable rows, and usage counts; (4) wire everything through MainTabs (already connected); (5) unit tests for the provider and screen; (6) device verification on both iOS and Android via QR.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Category CRUD (add/delete) | Client (Firebase JS SDK) | Database / Storage (Firestore rules) | `addDoc`/`deleteDoc` are client-side calls; Firestore rules enforce uid scoping server-side (NFR-06) |
| Live category list | Client (onSnapshot) | Database / Storage (Firestore) | `onSnapshot` delivers real-time updates from Firestore listeners; CategoriesProvider holds the reactive state |
| Usage count computation | Client (CategoriesProvider) | Database / Storage (Firestore) | Derived client-side from the entries `onSnapshot` feed — no server-side aggregation (Spark plan)
| In-use delete guard | Client (categoryInUse query) | — | `limit(1)` query checks existence; client blocks the UI action — rules cannot block individual deletes based on related data |
| Swipe gesture handling | Client (react-native-gesture-handler) | — | Native gesture recognition via Expo Go bundled module; deterministic, no custom JS touch handling |
| Duplicate name check | Client (in-memory compare) | — | Case-insensitive trim compare against current categories array — no server query needed |
| Sticky section headers | Client (SectionList) | — | Core React Native component; no library required |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-gesture-handler | **~2.32.0** (via `npx expo install`) | Swipeable component for swipe-to-delete | **Bundled in Expo Go SDK 57** (`inExpoGo: true`); `npx expo install` pins to the bundled version, not npm latest 3.1.0 [VERIFIED: bundledNativeModules.json + docs.expo.dev] |
| react-native | 0.86.2 (via SDK 57) | SectionList, FlatList, TextInput, Alert | Core RN components — no library needed for grouping, sticky headers, inline inputs, or Alert.alert dialogs [CITED: reactnative.dev/docs] |
| firebase | ^12.17.1 | Firestore `onSnapshot`, `addDoc`, `deleteDoc`, `getDocs` | Already installed (Phase 1); modular API — no new Firebase deps this phase [CITED: firebase.google.com/docs/firestore] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-reanimated | 4.5.1 (bundled, NOT installed) | Worklet-driven animations for swipe gestures | **Not needed this phase** — the v2.x `Swipeable` component uses Animated, not Reanimated. Only install if later phases need complex gesture-driven animations [VERIFIED: bundledNativeModules.json + docs.expo.dev] |
| @react-native-community/datetimepicker | 9.1.0 (already installed) | — | Not used this phase; will be needed in Phase 3 (Entries) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Swipeable (gesture-handler v2.x) | Custom PanResponder + Animated | PanResponder is JS-thread, drops frames under load; Swipeable is native-thread and standard. Custom only if the swipe UX needs special behavior beyond "reveal one action" — it doesn't. |
| Swipeable (gesture-handler v2.x) | ReanimatedSwipeable (gesture-handler v3.x) | v3.x `ReanimatedSwipeable` requires Reanimated and gesture-handler ≥3.x — Expo Go bundles ~2.32.0, so v3.x is not available without a dev build. Use the v2.x `Swipeable` named export. |
| `react-native-gesture-handler/Swipeable` import | `import { Swipeable } from 'react-native-gesture-handler'` | Both work in ~2.32.0; the named import from the main module is preferred (matches official v2 docs examples) |
| `npx expo install react-native-gesture-handler` | `npm install react-native-gesture-handler@~2.32.0` | `npx expo install` automatically resolves the Expo Go bundled version; manual pin risks version drift |

**Installation:**

```bash
# Single new dep this phase — npx expo install picks ~2.32.0 (bundled pin)
npx expo install react-native-gesture-handler

# Verify compatibility
npx expo-doctor
```

**Version verification (run 2026-08-07):**
- react-native-gesture-handler: npm latest 3.1.0 [VERIFIED: npm registry]; Expo Go SDK 57 bundles **~2.32.0** [VERIFIED: bundledNativeModules.json]
- react-native-reanimated: npm latest 4.5.3; Expo Go SDK 57 bundles **4.5.1** (not installed this phase)
- All other deps unchanged from Phase 1.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| react-native-gesture-handler | npm | 8+ yrs | 6.5M/wk | github.com/software-mansion/react-native-gesture-handler | **OK** | Approved — pinned to ~2.32.0 via `npx expo install` |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none — the single `SUS` verdict from the seam's "too-new" recency heuristic on a canonical package (6.5M/wk downloads, verified source repo, no postinstall scripts, `inExpoGo: true` per official Expo docs). No `checkpoint:human-verify` needed.

## Architecture Patterns

### System Architecture Diagram

```
                              ┌─────────────────────────────────────┐
                              │   Firebase Auth (Phase 1)            │
                              │   useAuth() → { user, ... }          │
                              └──────────────┬──────────────────────┘
                                             │ user.uid
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  CategoriesProvider (NEW — src/categories/CategoriesProvider.tsx)           │
│  React Context { categories, usageMap, addCategory, deleteCategory }       │
│                                                                             │
│  useEffect(user.uid) {                                                      │
│    // Listener 1: expense categories                                        │
│    onSnapshot(categoriesOf(uid, "expenseCategories"), snap => ...)          │
│    // Listener 2: income categories                                         │
│    onSnapshot(categoriesOf(uid, "incomeCategories"), snap => ...)           │
│    // Listener 3: usage counts                                              │
│    onSnapshot(entriesBase(uid), snap => {                                    │
│      const map = new Map<string, number>();                                 │
│      snap.forEach(doc => {                                                  │
│        const cid = doc.data().categoryId;                                    │
│        map.set(cid, (map.get(cid) || 0) + 1);                               │
│      });                                                                    │
│      setUsageMap(map);                                                      │
│    })                                                                       │
│  }                                                                          │
│                                                                             │
│  addCategory(kind, name) {                                                  │
│    // dup check: existing[kind].some(c => c.name.toLowerCase().trim()        │
│    //           === name.toLowerCase().trim())                              │
│    // → error "Already exists" if match                                     │
│    // addDoc(collection(db, kind), { uid, name, createdAt })                │
│  }                                                                          │
│                                                                             │
│  deleteCategory(kind, categoryId) {                                         │
│    // Guard: getDocs(categoryInUse(uid, categoryId))                        │
│    // → if !empty: reject (blocked)                                         │
│    // → if empty: proceed with deleteDoc                                    │
│  }                                                                          │
│  ────────────────────────────────────────────────────────────────────────   │
│  CategoriesScreen (REPLACES PlaceholderScreen)                               │
│    SectionList                                                              │
│    ├─ Section: Expense Categories                                           │
│    │   ├─ renderSectionHeader → "Expense Categories" + TextInput[➕]         │
│    │   ├─ Empty: "No expense categories yet"                                │
│    │   └─ renderItem → Swipeable row { name, usageCount }                   │
│    └─ Section: Income Categories                                            │
│        ├─ renderSectionHeader → "Income Categories" + TextInput[➕]          │
│        ├─ Empty: "No income categories yet"                                 │
│        └─ renderItem → Swipeable row { name, usageCount }                   │
│  ────────────────────────────────────────────────────────────────────────   │
│  Swipeable Row (per category)                                               │
│    renderRightActions →                                                     │
│      inUse? → grey bg, "In use" label (no onPress)                          │
│      unused? → red bg, "Delete" label → onPress: Alert.alert(              │
│        "Delete [name]? This cannot be undone.",                              │
│        [{ text: "Cancel" }, { text: "Delete", onPress: deleteCategory }]    │
│      )                                                                      │
└────────────────────────┬───────────────────────────────────────────────────┘
                         │ Firestore JS SDK
                         ▼
┌────────────────────────────────────────────────────────────────────┐
│ Cloud Firestore (Spark)                                             │
│ expenseCategories/{docId} → { uid, name, createdAt }                │
│ incomeCategories/{docId} → { uid, name, createdAt }                │
│ entries/{docId} → { uid, categoryId, ... }                         │
│                                                                     │
│ Rules (already deployed, Phase 1): uid scoping on all collections   │
│ Indexes: none new — categories queries filter uid only (already     │
│ covered by default single-field indexes)                            │
└────────────────────────────────────────────────────────────────────┘
```

Primary use case trace: Signed in → Categories tab → `CategoriesProvider` subscribes to expense/income categories + all entries → `SectionList` renders two groups with live data from context → User taps inline input, types "Groceries", presses return → `addCategory("expenseCategories", "Groceries")` → `addDoc` writes to Firestore → `onSnapshot` fires with the new doc → list updates instantly → User logs an entry with this category in Phase 3 → entries listener fires → usage count updates from "0 entries" to "1 entry" → User tries to delete it → swipe shows grey "In use" (blocked).

### Recommended Project Structure

```
src/
├── categories/                         # NEW — Phase 2
│   ├── CategoriesProvider.tsx          # Context { expenseCategories, incomeCategories, usageMap, addCategory, deleteCategory }
│   └── __tests__/
│       └── CategoriesProvider.test.ts  # Unit: provider state, dup check, delete guard
├── firebase/
│   ├── app.ts                          # (unchanged)
│   ├── config.ts                       # (unchanged)
│   └── queries.ts                      # (unchanged — categoriesOf, categoryInUse, entriesBase already built)
├── auth/
│   └── AuthProvider.tsx                # (unchanged — pattern to follow)
├── screens/
│   ├── CategoriesScreen.tsx            # REPLACED: SectionList + inline add + Swipeable rows
│   └── __tests__/
│       └── CategoriesScreen.test.ts    # Component: renders groups, inline add, swipe states
├── theme/
│   └── tokens.ts                       # (unchanged — colors, spacing, typography, radius)
├── lib/
│   ├── money.ts                        # (unchanged)
│   └── dates.ts                        # (unchanged — not used this phase)
└── __tests__/
    └── smoke-test.ts                   # (unchanged)
```

### Pattern 1: CategoriesProvider (follows AuthProvider pattern)

**What:** A React Context that owns the Firestore subscriptions for categories data. It exposes `expenseCategories`, `incomeCategories`, `usageMap`, `addCategory(kind, name)`, and `deleteCategory(kind, categoryId)`. Subscriptions are tied to `user.uid` and unsubscribe on unmount/uid-change.

**When to use:** Always — this is the single source of truth for categories state. Screens consume via `useCategories()` hook. Wraps the tab navigator in `App.tsx` (alongside `AuthProvider`).

**Example (following Phase 1 AuthProvider pattern):**

```typescript
// src/categories/CategoriesProvider.tsx
// Pattern: React Context + Firestore onSnapshot (01-RESEARCH.md Pattern 1 adapted)
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/app";
import { categoriesOf, entriesBase, categoryInUse } from "../firebase/queries";
import { useAuth } from "../auth/AuthProvider";

type Category = { id: string; name: string; createdAt: Timestamp };
type CategoryKind = "expenseCategories" | "incomeCategories";

type CategoriesContextValue = {
  expenseCategories: Category[];
  incomeCategories: Category[];
  usageMap: Map<string, number>;
  addCategory: (kind: CategoryKind, name: string) => Promise<void>;
  deleteCategory: (kind: CategoryKind, categoryId: string) => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [usageMap, setUsageMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const unsub1 = onSnapshot(categoriesOf(uid, "expenseCategories"), (snap) => {
      setExpenseCategories(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category))
      );
    });
    const unsub2 = onSnapshot(categoriesOf(uid, "incomeCategories"), (snap) => {
      setIncomeCategories(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category))
      );
    });
    const unsub3 = onSnapshot(entriesBase(uid), (snap) => {
      const map = new Map<string, number>();
      snap.forEach((d) => {
        const cid = d.data().categoryId;
        if (cid) map.set(cid, (map.get(cid) || 0) + 1);
      });
      setUsageMap(map);
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  const addCategory = useCallback(async (kind: CategoryKind, name: string) => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = kind === "expenseCategories" ? expenseCategories : incomeCategories;
    if (existing.some((c) => c.name.toLowerCase().trim() === trimmed.toLowerCase())) {
      throw new Error("Already exists");
    }
    await addDoc(collection(db, kind), {
      uid: user.uid,
      name: trimmed,
      createdAt: Timestamp.now(),
    });
  }, [user, expenseCategories, incomeCategories]);

  const deleteCategory = useCallback(async (kind: CategoryKind, categoryId: string) => {
    if (!user) return;
    const inUseSnap = await getDocs(categoryInUse(user.uid, categoryId));
    if (!inUseSnap.empty) throw new Error("Category is in use");
    await deleteDoc(doc(db, kind, categoryId));
  }, [user]);

  return (
    <CategoriesContext.Provider
      value={{ expenseCategories, incomeCategories, usageMap, addCategory, deleteCategory }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used within CategoriesProvider");
  return ctx;
}
```

### Pattern 2: SectionList with Sticky Headers and Inline Add

**What:** A single `SectionList` with two sections. Each `renderSectionHeader` renders a group label + inline `TextInput` with a "+" submit button. `stickySectionHeadersEnabled={true}` keeps headers pinned while scrolling. The `data` array for each section comes from the corresponding categories state in `useCategories()`.

**When to use:** The Categories screen — this is the entire UI contract. No alternative patterns needed at this scale.

### Pattern 3: Swipeable Row (in-use guard + confirmed delete)

**What:** Each category row is wrapped in `<Swipeable renderRightActions={...}>`. `renderRightActions` checks `usageMap.get(category.id) > 0` to decide: grey "In use" (no action) vs red "Delete" (→ `Alert.alert` → `deleteCategory`).

**When to use:** Every category row in the SectionList. The Swipeable component is the only gesture interaction in this phase.

**Example:**

```typescript
// Inside CategoriesScreen renderItem
import { Swipeable } from "react-native-gesture-handler";
// Swipeable is a named export from gesture-handler v2.x [CITED: docs.swmansion.com/react-native-gesture-handler/2.x]

const renderRightActions = (category: Category, inUse: boolean) => {
  if (inUse) {
    return (
      <View style={styles.swipeInUse}>
        <Text style={styles.swipeInUseText}>In use</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={styles.swipeDelete}
      onPress={() => {
        Alert.alert(
          `Delete ${category.name}?`,
          "This cannot be undone.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => deleteCategory(kind, category.id),
            },
          ]
        );
      }}
    >
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </TouchableOpacity>
  );
};
```

### Anti-Patterns to Avoid

- **Custom PanResponder for swipe:** JS-thread gesture handling drops frames and feels sluggish compared to native-thread Swipeable. The standard library is already in Expo Go — no reason to hand-roll.
- **Separate query per category for usage count:** Running `N` individual `categoryInUse` queries would hit the Spark plan's read budget fast. A single `onSnapshot` on `entriesBase(uid)` and a client-side `Map` gives all counts in one read.
- **Upgrading gesture-handler past ~2.32.0:** npm latest 3.1.0 has a different API (ReanimatedSwipeable) and requires Reanimated to be installed. Pin to the bundled version via `npx expo install`.
- **Missing uid guard on new queries:** Every write (`addDoc`, `deleteDoc`) must include `uid` in the document and every read must use `queries.ts` builders. Adding a direct `collection(db, "expenseCategories")` without `where("uid", "==", uid)` violates NFR-01 and will fail with a second account.
- **Using `flatMap` or loops over `snap.docs` without a `Map`:** Building the usage count map via array methods in the `onSnapshot` callback re-processes the full entries list on every change. A `Map` is O(1) per doc — just right for live updates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe-to-reveal action | Custom `PanResponder` + `Animated.View` | `Swipeable` from `react-native-gesture-handler` (~2.32.0) | Native-thread gesture recognition is deterministic, frame-perfect, and battle-tested. Custom JS-thread swipes drop frames under scroll load, have janky threshold logic, and don't respect platform conventions (iOS swipe friction, Android ripple). The library is already bundled in Expo Go — zero cost. |
| Client-side duplicate search | O(n²) array scan per keystroke | In-memory `some()` on the existing array (n ≤ 20) | O(20) is instant; debounce/throttle for this scale is premature. The search runs only on submit, not on keystroke. |
| Usage count aggregation | Per-category `getCountFromServer` calls | Single `onSnapshot` on `entriesBase(uid)` → `Map<categoryId, count>` | N individual reads for N categories would cost N reads per UI render on Spark plan. One listener covers all categories and stays live. |
| "Loading" state for usage counts | Custom loading flag + timeout | Show "—" until `usageMap.size > 0` | Firestore local cache makes the first snapshot near-instant after data exists; a "—" placeholder is sufficient and matches CONTEXT decision. |
| Section grouping | Plain `FlatList` with manual section headers interspersed in data | Core `SectionList` | `SectionList` handles sticky headers, section-based `keyExtractor` collisions, and `renderSectionHeader` natively. No custom logic needed. |

**Key insight:** The only external library this phase adds is `react-native-gesture-handler` (~2.32.0 bundled). Everything else — SectionList, TextInput, Alert, TouchableOpacity — is core React Native. The CategoriesProvider is a thin context wrapper over three Firestore listeners following the exact pattern Phase 1 established. At ~100 lines of provider logic, there is no case for a state management library or a complex UI framework.

## Common Pitfalls

### Pitfall 1: Gesture-handler version mismatch (3.x API on ~2.32.0)

**What goes wrong:** Developer runs `npm install react-native-gesture-handler` (gets 3.1.0), then imports `ReanimatedSwipeable` or uses the v3 gesture API — none of which exist in ~2.32.0. Also: v3.x requires Reanimated, which isn't installed.

**Why it happens:** npm defaults to `@latest`; Expo Go bundles are version-pinned behind npm.

**How to avoid:** Always use `npx expo install react-native-gesture-handler` — it resolves to the bundled pin. Import `{ Swipeable }` (named export from the main module), not `ReanimatedSwipeable` from a subpath.

**Warning signs:** `TypeError: undefined is not an object (evaluating 'Swipeable')` or `Cannot resolve module 'react-native-gesture-handler/Swipeable'` at bundle time.

### Pitfall 2: Unscoped Firestore writes (NFR-01)

**What goes wrong:** A new `addDoc` or direct collection reference without `uid` in the where clause. With a single account it appears to work; with a second account, rules reject the query with `permission-denied`.

**Why it happens:** Phase 1 established `queries.ts` as the mandatory query builder — but `addDoc` writes happen inline in the provider, not through a builder.

**How to avoid:** Every `addDoc` must include `uid: user.uid` in the data payload. Every `deleteDoc` must go through the uid-scoped collection path (the doc is already uid-scoped from creation). Document this in code comments.

**Warning signs:** Firestore writes succeed for the default account but fail for any additional account created in Phase 6.

### Pitfall 3: Duplicate categories across accounts

**What goes wrong:** Two accounts each create a category "Food". The duplicate check only scans the *current user's* categories, so both succeed — which is correct behavior (each account owns its own ledger). But a developer might accidentally add a server-side uniqueness constraint.

**Why it happens:** Firestore documents are identified by auto-generated IDs within a collection, not by name. Client-side dedup is per-user by construction since the query is uid-scoped.

**How to avoid:** The duplicate check in `addCategory` compares against `existing` (the current kind's array from state, already uid-scoped by the listener). No cross-account comparison is needed or desired.

**Warning signs:** None — this is the correct design. Just don't add compound indexes on `[uid, name]` expecting uniqueness.

### Pitfall 4: Swipeable + SectionList scroll conflict

**What goes wrong:** Swiping a row inside a scrolling SectionList can conflict — the vertical scroll gesture gets consumed by the Swipeable's horizontal gesture detection.

**Why it happens:** React Native's gesture system has a responder negotiation phase. Swipeable needs to claim the horizontal gesture while letting vertical gestures pass through to the scroll view.

**How to avoid:** The `Swipeable` component from gesture-handler v2.x handles this internally via `failOffsetX` and the native gesture system. No additional configuration needed for the standard case. If conflicts arise on Android, add `simultaneousHandlers` ref to the SectionList's native gesture ref.

**Warning signs:** Swipe action triggers scroll instead; or scroll locks up when near a swipeable row. Test on both platforms early.

### Pitfall 5: Memory leak from orphaned onSnapshot listeners

**What goes wrong:** The `useEffect` sets up three `onSnapshot` listeners but fails to clean them up (missing return function, or `user` changes without cleanup).

**Why it happens:** Firestore `onSnapshot` returns an unsubscribe function that must be called. If the user signs out and back in, the old listeners keep running (and charge reads) for the previous uid.

**How to avoid:** The `useEffect` return function calls all three unsubscribe functions. The dependency array includes `[user]` — when `user` changes (sign out → null), the effect cleanup runs, unsubscribing all listeners. The effect re-runs when a new user signs in.

**Warning signs:** Console warnings about multiple active Firestore listeners; reads counting against the Spark free tier for a signed-out account.

## Code Examples

Verified patterns from official sources:

### SectionList with Sticky Headers and Inline Input (per-section)

```typescript
// Source: reactnative.dev/docs/sectionlist (core RN component)
// Adapted for Phase 2's two-group categories with per-group inline add
import { SectionList, TextInput, TouchableOpacity, Text, View, StyleSheet } from "react-native";
import { colors, typography, spacing, radius } from "../theme/tokens";
import { useCategories } from "../categories/CategoriesProvider";

type SectionData = {
  title: string;
  kind: "expenseCategories" | "incomeCategories";
  data: Category[];
};

export default function CategoriesScreen() {
  const { expenseCategories, incomeCategories, usageMap, addCategory } = useCategories();
  const [expenseInput, setExpenseInput] = useState("");
  const [incomeInput, setIncomeInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sections: SectionData[] = [
    { title: "Expense Categories", kind: "expenseCategories", data: expenseCategories },
    { title: "Income Categories", kind: "incomeCategories", data: incomeCategories },
  ];

  const handleAdd = async (kind: CategoryKind, input: string, setInput: (s: string) => void) => {
    try {
      setError(null);
      await addCategory(kind, input);
      setInput("");
    } catch (e: any) {
      setError(e.message || "Failed to add");
    }
  };

  return (
    <SectionList
      sections={sections}
      stickySectionHeadersEnabled={true}
      keyExtractor={(item) => item.id}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.inlineAdd}>
            <TextInput
              style={styles.input}
              placeholder="New category"
              placeholderTextColor={colors.textSecondary}
              value={section.kind === "expenseCategories" ? expenseInput : incomeInput}
              onChangeText={section.kind === "expenseCategories" ? setExpenseInput : setIncomeInput}
              onSubmitEditing={() => {
                const val = section.kind === "expenseCategories" ? expenseInput : incomeInput;
                handleAdd(section.kind, val.trim(),
                  section.kind === "expenseCategories" ? setExpenseInput : setIncomeInput);
              }}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => {
                const val = section.kind === "expenseCategories" ? expenseInput : incomeInput;
                handleAdd(section.kind, val.trim(),
                  section.kind === "expenseCategories" ? setExpenseInput : setIncomeInput);
              }}
            >
              <Text style={styles.addButton}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      renderItem={({ item, section }) => {
        const count = usageMap.get(item.id) || 0;
        return (
          <Swipeable
            renderRightActions={() => renderRightActions(section.kind, item, count > 0)}
          >
            <View style={styles.row}>
              <Text style={styles.categoryName}>{item.name}</Text>
              <Text style={styles.usageCount}>
                {usageMap.size === 0 ? "—" : `${count} ${count === 1 ? "entry" : "entries"}`}
              </Text>
            </View>
          </Swipeable>
        );
      }}
      ListEmptyComponent={({ section }) => (
        <Text style={styles.empty}>
          No {section.kind === "expenseCategories" ? "expense" : "income"} categories yet
        </Text>
      )}
    />
  );
}
```

### Firestore Add + Duplicate Check

```typescript
// Source: firebase.google.com/docs/firestore/manage-data/add-data (Web v9 modular)
const addCategory = useCallback(async (kind: CategoryKind, name: string) => {
  if (!user) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  // Case-insensitive trim duplicate check (CONTEXT: locked decision)
  const existing = kind === "expenseCategories" ? expenseCategories : incomeCategories;
  if (existing.some((c) => c.name.toLowerCase().trim() === trimmed.toLowerCase())) {
    throw new Error("Already exists"); // caller sets inline error
  }

  // NFR-01: uid must be in the document — rules are not filters
  await addDoc(collection(db, kind), {
    uid: user.uid,
    name: trimmed,
    createdAt: Timestamp.now(),
  });
  // onSnapshot will pick up the new doc automatically — no local state mutation
}, [user, expenseCategories, incomeCategories]);
```

### Usage Count Map from onSnapshot

```typescript
// Source: firebase.google.com/docs/firestore/query-data/listen (Web v9 modular)
// Single listener for all entries → derive per-category counts client-side
useEffect(() => {
  if (!user) return;
  const uid = user.uid;
  const unsub = onSnapshot(entriesBase(uid), (snap) => {
    const map = new Map<string, number>();
    snap.forEach((d) => {
      const cid = d.data().categoryId;
      if (cid) map.set(cid, (map.get(cid) || 0) + 1);
    });
    setUsageMap(map);
  });
  return unsub;
}, [user]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gesture-handler v1.x `Swipeable` with class-based API | gesture-handler v2.x `Swipeable` as a functional component with hooks | v2.0 (2022) | Same API surface for basic usage; v2.x is what Expo Go SDK 57 bundles [VERIFIED: bundledNativeModules.json] |
| `Swipeable` as default export from `react-native-gesture-handler/Swipeable` | `{ Swipeable }` named export from `react-native-gesture-handler` | v2.x onwards | Both work; named import from main module is the documented pattern for v2.x [CITED: docs.swmansion.com/react-native-gesture-handler/2.x] |
| gesture-handler v3.x `ReanimatedSwipeable` (requires Reanimated) | **Not available in Expo Go SDK 57** — stick with v2.x `Swipeable` | v3.0 (2025) | v3.x needs a dev build; not relevant until the project migrates off Expo Go |

**Deprecated/outdated:**
- `PanResponder` from core RN: Not deprecated, but functionally replaced by gesture-handler for any non-trivial gesture. Using it for swipe-to-delete in 2026 is an anti-pattern.
- `react-native-swipeable` (community): Unmaintained, pre-gesture-handler. Do not use.

## Assumptions Log

> All claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The v2.x `Swipeable` component from gesture-handler ~2.32.0 renders identically to the official v2 docs examples (the 2.x API docs page is still online at docs.swmansion.com but specific sub-pages returned 404 — the introductory page confirms the v2.x documentation exists and the component API is stable) | Architecture Patterns / Pattern 3 | Low — the `Swipeable` API (`renderRightActions`, `onSwipeableOpen`) is stable and the gesture-handler team hasn't removed it in any v2.x release. If the import path differs, `npx expo install` resolves it. |
| A2 | The `usageMap` "loading state" pattern of showing "—" when the map is empty covers the initial fetch adequately (Firestore local cache makes this near-instant after first data) | Code Examples | Low — if first fetch is slow (network), users see "—" briefly; the UX is acceptable per CONTEXT decision. |
| A3 | No new composite indexes are needed for this phase — `categoriesOf` queries filter by `uid` only, which is covered by default single-field indexes | Architecture Patterns | LOW — if Firestore requires a composite index for the `where("uid", "==", uid)` query on categories collections, the console will surface a link. Default indexes cover single-field equality filters per Firestore docs. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. *(This table has entries — the 3 assumptions above are low-risk and require no pre-execution confirmation, but are documented for traceability.)*

## Open Questions (RESOLVED)

1. **Swipeable right-action width**
   - What we know: Standard pattern is ~75–80px for single-action swipe reveals on mobile. The CONTEXT decision specifies compact single-line rows at 44px touch target min.
   - What's unclear: Exact pixel width for the action panel needs visual testing on the user's phone at 44px row height. Too narrow → text clipped; too wide → feels aggressive.
   - RESOLVED: Start with 80px; adjust during device verification.

2. **Inline input "Already exists" error display duration**
   - What we know: CONTEXT says "reject with inline error 'Already exists'".
   - What's unclear: Does the error auto-dismiss after a timeout, or stay until the user types a different input?
   - RESOLVED: Show error below the input; auto-clear on the next `onChangeText` (standard inline validation pattern). No auto-timeout — user needs to see it until they act.

3. **SectionList performance with usage map updates on every entry snapshot**
   - What we know: `usageMap` state change triggers re-render of every rendered row. At 15–20 categories, this is negligible.
   - What's unclear: If entries grow to 1000+, does the `onSnapshot` callback building a `Map` on every change cause a visible pause?
   - RESOLVED: For the current scale (personal tracker, ~10 entries/day), this is a non-issue. Revisit if performance metrics show frame drops during Phase 3 entries testing.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npx expo install`, `jest` | ✓ | v24.18.0 | — |
| npm | Package installation | ✓ | 11.18.0 | — |
| expo CLI | `npx expo install react-native-gesture-handler` | ✓ | 57.0.13 | — |
| react-native-gesture-handler (~2.32.0) | Swipeable component | ✗ (not yet installed) | — | `npx expo install react-native-gesture-handler` in Wave 0 |
| Firebase project (Phase 1) | Firestore reads/writes | ✓ (already configured) | — | — |
| expo-doctor | Version compatibility check | ✓ | — | — |
| jest + jest-expo | Unit tests | ✓ (already configured) | 29.7.0 | — |

**Missing dependencies with no fallback:**
- `react-native-gesture-handler` — must be installed via `npx expo install react-native-gesture-handler` before any Category screen code references `Swipeable`. Installation is Wave 0, Task 0.

**Missing dependencies with fallback:**
- None — gesture-handler is the single new dependency and has no Expo Go-compatible alternative.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | jest 29.7.0 + jest-expo ~57.0.3 |
| Config file | `jest.config.js` (Phase 1, unchanged) |
| Quick run command | `npx jest src/categories --passWithNoTests` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CATS-01 | Categories tab shows two groups with sticky headers | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "renders two sections"` | ❌ Wave 0 |
| CATS-01 | Empty group shows "No expense categories yet" / "No income categories yet" | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "empty state"` | ❌ Wave 0 |
| CATS-02 | Inline input submits on keyboard return, adds category to Firestore | integration | `npx jest src/categories/__tests__/CategoriesProvider.test.ts -t "addCategory"` | ❌ Wave 0 |
| CATS-02 | Duplicate name rejected with "Already exists" | unit | `npx jest src/categories/__tests__/CategoriesProvider.test.ts -t "duplicate"` | ❌ Wave 0 |
| CATS-03 | Usage count displayed per category ("12 entries" / "1 entry") | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "usage count"` | ❌ Wave 0 |
| CATS-03 | Count shows "—" while loading | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "loading"` | ❌ Wave 0 |
| CATS-04 | In-use category shows grey "In use" swipe, delete blocked | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "in use"` | ❌ Wave 0 |
| CATS-04 | Unused category shows red "Delete" swipe, deletes after confirmation | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "delete confirmation"` | ❌ Wave 0 |
| NFR-01 | addDoc includes `uid` field in document data | unit | `npx jest src/categories/__tests__/CategoriesProvider.test.ts -t "uid"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest src/categories --passWithNoTests`
- **Per wave merge:** `npx jest` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/categories/__tests__/CategoriesProvider.test.ts` — covers CATS-02 (add/duplicate), CATS-04 (delete guard), NFR-01 (uid in documents)
- [ ] `src/screens/__tests__/CategoriesScreen.test.ts` — covers CATS-01 (groups), CATS-03 (usage counts), CATS-04 (swipe states)
- [ ] `jest.config.js` — already exists from Phase 1, no changes needed
- [ ] Framework install: `npx expo install react-native-gesture-handler` — not installed yet
- [ ] Test mock setup: mock `react-native-gesture-handler`'s `Swipeable` export in jest (the native module needs a jest mock — Phase 1 already handles react-native mocks via jest-expo preset)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 1) | Phase 1 handles auth; Phase 2 consumes `useAuth().user.uid` — no new auth surface |
| V3 Session Management | No | No session tokens or cookies managed this phase |
| V4 Access Control | Yes | `uid` in every Firestore document (NFR-01); `addDoc` payload includes `uid: user.uid`; `deleteDoc` targets a uid-scoped doc path; `categoriesOf` and `entriesBase` queries all filter by `uid` — rules enforce server-side |
| V5 Input Validation | Yes | Category name: trimmed, non-empty, max-length enforced at UI level (no explicit DB constraint); duplicate check case-insensitive against current user's names; Firestore document size limit (1 MiB) is a natural cap — names at ~50 chars are trivial |
| V6 Cryptography | No | No cryptographic operations this phase |

### Known Threat Patterns for React Native + Firestore

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-account category access (query without `uid` filter) | Information Disclosure | Every Firestore query goes through `queries.ts` builders (NFR-01); rules reject unscoped reads server-side — all-or-nothing query rejection |
| Cross-account category write (addDoc without `uid` in payload) | Elevation of Privilege | `uid: user.uid` is hardcoded in `addCategory`; rules validate `request.resource.data.uid == request.auth.uid` — server-side enforcement |
| Client-side category name injection (XSS via long/malformed names) | Tampering | Category names are plain strings rendered in `<Text>` — React Native escapes text by default; no HTML rendering; Firestore document size limit prevents DoS via oversized names |
| Race condition: delete category while entry is being added | Denial of Service | `categoryInUse(uid, categoryId)` runs a `getDocs` just before `deleteDoc` — the window is narrow (milliseconds); worst case: an orphaned entry references a deleted category (CATS-04 prevents this in normal flow); Phase 3 entry form handles missing category gracefully |

## Sources

### Primary (HIGH confidence)
- [Expo SDK 57 bundledNativeModules.json](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json) — definitive version pins: `react-native-gesture-handler` ~2.32.0, `react-native-reanimated` 4.5.1, `react-native-screens` ~4.26.0, `react-native-safe-area-context` ~5.7.0 [VERIFIED: fetched 2026-08-07]
- [docs.expo.dev — react-native-gesture-handler](https://docs.expo.dev/versions/v57.0.0/sdk/gesture-handler.md) — `inExpoGo: true`, `platforms: ['android', 'ios', 'web', 'expo-go']`, install `npx expo install react-native-gesture-handler` [VERIFIED: fetched 2026-08-07]
- [docs.expo.dev — react-native-reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated.md) — `inExpoGo: true`, version 4.5.1 bundled [VERIFIED: fetched 2026-08-07]
- [docs.swmansion.com — React Native Gesture Handler 2.x Introduction](https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/) — v2.x documentation still online; confirms Swipeable is a named export in v2.x [VERIFIED: fetched 2026-08-07]
- [npm registry](https://www.npmjs.com/package/react-native-gesture-handler) — latest 3.1.0, 6.5M weekly downloads, source repo software-mansion/react-native-gesture-handler, no postinstall scripts [VERIFIED: npm view 2026-08-07]
- [npm registry](https://www.npmjs.com/package/react-native-reanimated) — latest 4.5.3, 6.7M weekly downloads, source repo software-mansion/react-native-reanimated, no postinstall scripts [VERIFIED: npm view 2026-08-07]
- [firebase.google.com/docs/firestore](https://firebase.google.com/docs/firestore/query-data/listen) — Firestore `onSnapshot` API (modular v9+), real-time listener patterns [VERIFIED: fetched 2026-08-07]
- Phase 1 codebase (`src/auth/AuthProvider.tsx`, `src/firebase/queries.ts`, `src/firebase/app.ts`, `src/theme/tokens.ts`) — established patterns: React Context + onSnapshot, uid-scoped query builders, token-based styling [VERIFIED: codebase grep 2026-08-07]
- Phase 1 RESEARCH.md (`01-RESEARCH.md`) — architecture patterns, pitfall catalog, security posture, project constraints [VERIFIED: codebase read 2026-08-07]

### Secondary (MEDIUM confidence)
- [docs.swmansion.com — React Native Gesture Handler 2.x Introduction](https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/) — API reference sub-pages returned 404 but the introductory page is live and confirms the v2.x documentation exists [CITED: fetched 2026-08-07]
- [reactnative.dev/docs/sectionlist](https://reactnative.dev/docs/sectionlist) — core RN SectionList API (stable, well-known) [ASSUMED: not re-fetched — core RN component with stable API since RN 0.43]

### Tertiary (LOW confidence)
- None — all claims in this research are either verified against authoritative sources (bundledNativeModules.json, Expo docs, npm registry, Firebase docs) or marked as assumptions in the Assumptions Log. The single `[ASSUMED]` claim (A1) is about the exact Swipeable import path in ~2.32.0 and carries low risk.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — single new dependency verified against Expo Go SDK 57 bundledNativeModules.json + docs.expo.dev + npm registry
- Architecture: HIGH — CategoriesProvider follows the exact AuthProvider pattern from Phase 1 (verified in codebase); SectionList is core RN; Swipeable is the standard RN gesture pattern
- Pitfalls: HIGH — version mismatch pitfall verified by comparing npm latest (3.1.0) vs bundled pin (~2.32.0); NFR-01 uid guard verified against Phase 1 codebase; all pitfalls grounded in real Firebase/RN constraints
- Security: HIGH — ASVS V4/V5 coverage verified against Firestore rules (Phase 1) and Firebase docs; threat patterns grounded in Spark plan constraints
- Swipeable API: MEDIUM — the v2.x introduction page confirms documentation exists but specific sub-pages 404'd; the `Swipeable` component's API (`renderRightActions`, `onSwipeableOpen`) is stable and well-known in the RN ecosystem; risk of import path variance is low

**Research date:** 2026-08-07
**Valid until:** 2026-09-07 (30 days — Expo Go SDK 57 is a stable release; Firebase JS SDK v12 is current; gesture-handler v2.x API is stable)








