# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-08-06
**Files analyzed:** 28 (22 code/config files + 4 unit test files + 2 deployment artifacts)
**Analogs found:** 0 / 28 — **brand-new Expo repo: no application code exists yet** (repo root contains only planning docs: AGENTS.md, design-brief.md, tech-design.md, app-flow.md, backend-schema.md, project-requirements.md, .planning/). Every pattern below is the **canonical pattern from the phase research** (RESEARCH.md Code Examples, verified 2026-08-06 against official sources) or the **UI-SPEC Implementation Contract**. Planner actions should cite these excerpts as "copy from 01-RESEARCH.md / 01-UI-SPEC.md", not from repo code.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `index.ts` (scaffold) | config | bootstrap | none — template entry (`registerRootComponent`), untouched | no-analog |
| `app.json` (modify) | config | n/a | none — template; only `name: "Money"` changes | no-analog |
| `package.json` (modify) | config | n/a | none — template + jest preset + scripts | no-analog |
| `tsconfig.json` (modify) | config | n/a | none — template + `"types": ["jest"]` | no-analog |
| `eslint.config.js` (generated) | config | n/a | none — first `npx expo lint` run creates it | no-analog |
| `src/firebase/config.ts` | config | n/a (static constants) | none — placeholder-safe `firebaseConfig` shape | no-analog |
| `src/firebase/app.ts` | service (module singleton) | bootstrap (module-load init) | none — expo.fyi singleton pattern | no-analog |
| `src/firebase/queries.ts` | service (data access) | CRUD (query construction) | none — uid-scoped builder pattern | no-analog |
| `src/auth/AuthProvider.tsx` | provider | event-driven (`onAuthStateChanged`) | none — Context provider pattern | no-analog |
| `src/auth/errors.ts` | utility | transform (FirebaseError → copy) | none — pure mapper pattern | no-analog |
| `src/screens/LoadingScreen.tsx` | component | static render | none — UI-SPEC composition | no-analog |
| `src/screens/SignInScreen.tsx` | component | request-response (form → auth) | none — UI-SPEC composition + Interaction contract | no-analog |
| `src/screens/MainTabs.tsx` | component (navigation shell) | static render | none — bottom-tabs v7 pattern | no-analog |
| `src/screens/PlaceholderScreen.tsx` | component | static render | none — UI-SPEC composition | no-analog |
| `src/screens/HomeScreen.tsx` + `ExpensesScreen.tsx` + `IncomeScreen.tsx` + `CategoriesScreen.tsx` + `AccountScreen.tsx` | component (thin wrappers) | static render | none — render PlaceholderScreen | no-analog |
| `src/lib/money.ts` | utility | transform (cents ⇄ string) | none — deterministic formatter (NFR-03) | no-analog |
| `src/lib/dates.ts` | utility | transform (local date strings) | none — deterministic calendar utils (NFR-04) | no-analog |
| `src/theme/tokens.ts` | config | n/a (design tokens) | none — UI-SPEC Implementation Contract | no-analog |
| `App.tsx` | component (app shell) | event-driven (auth-gated routing) | none — react-navigation v7 conditional root stack | no-analog |
| `src/lib/__tests__/money-test.ts` | test | — | none — jest-expo Wave 0 | no-analog |
| `src/lib/__tests__/dates-test.ts` | test | — | none — jest-expo Wave 0 | no-analog |
| `src/auth/__tests__/errors-test.ts` | test | — | none — jest-expo Wave 0 | no-analog |
| `src/firebase/__tests__/queries-test.ts` | test | — | none — jest-expo Wave 0 | no-analog |
| Firestore security rules (console deploy artifact) | config (deployment) | n/a | none — backend-schema.md verbatim | no-analog |
| Composite index `entries: type ASC, date DESC` (console artifact) | config (deployment) | n/a | none — console-created | no-analog |

## Pattern Assignments

---

### `src/firebase/app.ts` (service — module-load singleton; bootstrap)

**Pattern source:** 01-RESEARCH.md Pattern 1 (lines 258-278) + Code Examples (lines 401-415) + Anti-Patterns (lines 327-332). **This is the load-bearing file of the phase** — init order matters: `initializeAuth` with AsyncStorage persistence must be the **first** auth call, at module top level (Fast Refresh never re-runs it).

**Core pattern (copy verbatim, RESEARCH.md lines 402-415):**
```typescript
// src/firebase/app.ts
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = initializeFirestore(app); // memory cache (Expo Go default)
```

**Guard rules (RESEARCH.md lines 327-332):**
- NEVER `getAuth()` before/without `initializeAuth` — creates a default instance lacking RN persistence → AUTH-02 silently fails.
- NEVER `persistentLocalCache` in `initializeFirestore` — IndexedDB-only, fails in Expo Go. Default memory cache only.
- NEVER call `initializeAuth`/`initializeFirestore` inside components or effects (Fast Refresh re-runs).

---

### `src/firebase/config.ts` (config — static constants)

**Pattern source:** 01-RESEARCH.md Open Question 1 (lines 578-581) + CONTEXT decision (line 24: private repo, constants, no env plumbing).

**Shape (placeholder-safe while the user creates the Firebase project; real values are a `checkpoint:human-verify` human step before device verification):**
```typescript
// src/firebase/config.ts
export const firebaseConfig = {
  apiKey: "PLACEHOLDER", authDomain: "PLACEHOLDER", projectId: "PLACEHOLDER",
  storageBucket: "PLACEHOLDER", messagingSenderId: "PLACEHOLDER", appId: "PLACEHOLDER",
};
```
Exact field set: `apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId` (web-app registration values). All non-config code is built and unit-tested against the placeholder.

---

### `src/firebase/queries.ts` (service — data access; CRUD query construction)

**Pattern source:** 01-RESEARCH.md Pattern 3 (lines 305-317) + Code Examples (lines 466-482) + Pitfall 7 (lines 385-389). **Rules are not filters** — every query MUST carry `where("uid","==",uid)` first or the whole query is rejected `permission-denied` when a second account exists (NFR-01).

**Core pattern (copy verbatim, RESEARCH.md lines 466-482):**
```typescript
// src/firebase/queries.ts
import { collection, doc, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "./app";

export const userDoc = (uid: string) => doc(db, "users", uid);
export const entriesBase = (uid: string) => query(collection(db, "entries"), where("uid", "==", uid));
export const entriesByType = (uid: string, type: "expense" | "income") =>
  query(entriesBase(uid), where("type", "==", type), orderBy("date", "desc"));
export const entriesInRange = (uid: string, start: string, end: string) =>
  query(entriesBase(uid), where("date", ">=", start), where("date", "<=", end));
export const categoryInUse = (uid: string, categoryId: string) =>
  query(entriesBase(uid), where("categoryId", "==", categoryId), limit(1));
export const categoriesOf = (uid: string, kind: "expenseCategories" | "incomeCategories") =>
  query(collection(db, kind), where("uid", "==", uid));
```

**Note:** `entriesByType` requires the composite index `entries: type ASC, date DESC` (console artifact — the query error self-links to create it; Pitfall 8, lines 391-395).

---

### `src/auth/AuthProvider.tsx` (provider — event-driven auth state)

**Pattern source:** 01-RESEARCH.md Code Examples (lines 417-448) + UI-SPEC State Contract (lines 141-162). `onAuthStateChanged` is the **single source of truth** for the auth gate; screens never navigate manually.

**Core pattern (copy verbatim, RESEARCH.md lines 417-448):**
```typescript
// src/auth/AuthProvider.tsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, User } from "firebase/auth";
import { auth } from "../firebase/app";
import { authErrorMessage } from "./errors";

const AuthContext = createContext<{ user: User | null; initializing: boolean; signIn: (email: string, password: string) => Promise<void> } | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setInitializing(false); });
    return unsub;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password); // throws FirebaseError
  }, []);

  return <AuthContext.Provider value={{ user, initializing, signIn }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

**Import rule (RESEARCH.md line 364):** AuthProvider imports `auth` from `app.ts` — never calls `getAuth()` itself (persistence wiring depends on import order).

---

### `src/auth/errors.ts` (utility — transform; AUTH-03)

**Pattern source:** 01-RESEARCH.md Code Examples (lines 450-464) + Pitfall 4 (lines 367-371). Modern projects (EEP on by default) fail with `auth/invalid-credential` for BOTH wrong email and wrong password; legacy codes must still map. Locked copy: **"Email or password is wrong"** (CONTEXT line 35; UI-SPEC line 118).

**Core pattern (copy verbatim, RESEARCH.md lines 450-464):**
```typescript
// src/auth/errors.ts
import { FirebaseError } from "firebase/app";

export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
      return "Email or password is wrong";
    }
    // network-request-failed, too-many-requests, invalid-email, … (UI-SPEC default copy)
  }
  return "Couldn't sign in. Check your connection and try again.";
}
```

---

### `App.tsx` (component — app shell; event-driven auth-gated routing)

**Pattern source:** 01-RESEARCH.md Pattern 2 (lines 280-303) + UI-SPEC Implementation Contract (line 253). Root conditional stack: `restoring → LoadingScreen` (outside the navigator is fine per Pattern 2), `signedOut → SignIn`, `signedIn → MainTabs`. No manual navigation on sign-in success — the gate reacts to auth state.

**Core pattern (copy verbatim, RESEARCH.md lines 286-303):**
```tsx
// App.tsx
function RootNavigator() {
  const { user, initializing } = useAuth();
  if (initializing) return <LoadingScreen />;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```
Structure: `index.ts` (`registerRootComponent(App)`, untouched template) → `App` renders `AuthProvider` wrapping `RootNavigator`.

---

### `src/theme/tokens.ts` (config — design tokens)

**Pattern source:** 01-UI-SPEC.md Implementation Contract (lines 223-241) — single source of truth; **no style values outside this file** (UI-SPEC line 225).

**Core pattern (copy verbatim, UI-SPEC lines 227-240):**
```ts
export const colors = {
  background: '#F7F7F8', surface: '#FFFFFF', textPrimary: '#1A1A1A',
  textSecondary: '#6B7280', border: '#E5E7EB', income: '#16A34A',
  expense: '#DC2626', accent: '#111827', danger: '#DC2626',
};
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64 };
export const typography = {
  display: { size: 28, weight: '700', lineHeight: 34 },   // 28 × 1.2
  heading: { size: 20, weight: '700', lineHeight: 24 },   // 20 × 1.2
  body:    { size: 16, weight: '400', lineHeight: 24 },   // 16 × 1.5
  label:   { size: 14, weight: '400', lineHeight: 20 },   // 14 × 1.4
};
export const radius = { sm: 8 };
```
`income`/`expense` tokens are declared but **unused in Phase 1** (no money surfaces; UI-SPEC line 44).

---

### `src/screens/LoadingScreen.tsx` (component — static render)

**Pattern source:** 01-UI-SPEC.md Visual contract (line 48) + State Contract (line 146). Full-screen `#F7F7F8`, centered `ActivityIndicator` (`size="large"`, color `#111827` = tokens `colors.background` / `colors.accent`), no text, no branding. Single state; the listener resolves to `null` → Sign In, never throws (UI-SPEC line 161). Styling via `StyleSheet.create` only, tokens imported from `../theme/tokens`.

---

### `src/screens/SignInScreen.tsx` (component — request-response form)

**Pattern source:** 01-UI-SPEC.md Visual (line 46), Copywriting (lines 111-123), Interaction (lines 127-137), State (lines 150-159), Accessibility (lines 165-177).

**Local state (UI-SPEC line 150):** `email: string`, `password: string`, `submitting: boolean`, `error: string | null`.

**Composition (UI-SPEC line 46):** centered card on `#F7F7F8`; app name **"Money"** `28pt/700` `#1A1A1A` centered; Email + Password labeled fields; inline error below Password (`accessibilityRole="alert"`); full-width **Sign in** button. Card: hairline border `1px #E5E7EB`, radius `8px`, padding `24px`, no shadows (line 38).

**Interaction contract (UI-SPEC lines 128-135) — the non-obvious bits:**
- Submit: press button OR keyboard "go" on Password (`returnKeyType="go"` + `onSubmitEditing`) → `signInWithEmailAndPassword` via `useAuth().signIn` → on failure: catch → `authErrorMessage(err)` → set error → button re-enables, fields keep values.
- Button disabled when either field empty OR submitting; disabled = `opacity 0.5`. In-flight label **"Signing in…"**, inputs locked.
- Keyboard flow: Email `returnKeyType="next"` → focuses Password; `KeyboardAvoidingView` iOS `behavior="padding"` (Android default `adjustResize`).
- Input props (line 174): Email `keyboardType="email-address"` `autoCapitalize="none"` `autoCorrect={false}` `textContentType="username"` `autoComplete="email"`; Password `secureTextEntry` `textContentType="password"` `autoComplete="current-password"`.
- Success = no toast, no manual navigation — the gate swaps (Interaction line 129).

**Error handling pattern:** all errors funnel through `authErrorMessage` (see `src/auth/errors.ts` above); the copy contract (lines 118-119) is the only copy the screen may render.

---

### `src/screens/MainTabs.tsx` (component — navigation shell)

**Pattern source:** 01-UI-SPEC.md Implementation Contract (line 255). bottom-tabs v7, **5 label-only tabs** (no `tabBarIcon` — text is the interface), `headerShown: false` on the root stack.

**Navigation structure (copy from UI-SPEC line 255):**
```tsx
tabBarActiveTintColor: '#111827'   // → tokens colors.accent
tabBarInactiveTintColor: '#6B7280' // → tokens colors.textSecondary
tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E5E7EB' } // surface/border tokens
tabBarLabelStyle: { fontSize: 14 } // → tokens typography.label
```
Tab labels: Home, Expenses, Income, Categories, Account — each rendering its wrapper screen (PlaceholderScreen). Standard v7 API: `createBottomTabNavigator()`, `Tab.Navigator screenOptions={...}`, `Tab.Screen name=... component=...` (lazy by default, state preserved — UI-SPEC line 137).

---

### `src/screens/PlaceholderScreen.tsx` + 5 wrappers (component — static render)

**Pattern source:** 01-UI-SPEC.md Visual contract (line 50). Full-screen `#F7F7F8`, centered **"Coming soon"** (`16pt/400 #6B7280` = tokens `typography.body` size + `colors.textSecondary`). No headers this phase. Each wrapper (HomeScreen, ExpensesScreen, IncomeScreen, CategoriesScreen, AccountScreen) is a thin component rendering `<PlaceholderScreen />` — filled in Phases 2-4.

---

### `src/lib/money.ts` (utility — transform; NFR-03)

**Pattern source:** 01-RESEARCH.md Pattern 4 (lines 319-322) + Code Examples (lines 484-501) + Pitfall 6 (lines 379-383). Pure, dependency-free, deterministic — **no `Intl.NumberFormat`** (device-dependent; `formatToParts` Android-only) and **never floats** (`(cents/100).toFixed(2)` is float drift).

**Core pattern (copy verbatim, RESEARCH.md lines 484-501):**
```typescript
// src/lib/money.ts
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toString();
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${sign}₱ ${grouped}.${frac}`;
}
export function parsePesoInput(input: string): number | null {
  const cleaned = input.replace(/[₱Pp\s,]/g, "");            // strip symbol/commas/spaces
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;        // up to 2 decimals only
  const [w = "0", f = ""] = cleaned.split(".");
  return Number(w) * 100 + Number(f.padEnd(2, "0").slice(0, 2)); // integer cents, no floats
}
```
Output contract: `₱ 1,234.50` — space after ₱, separators always shown (design-brief; RESEARCH line 55).

---

### `src/lib/dates.ts` (utility — transform; NFR-04)

**Pattern source:** 01-RESEARCH.md Pattern 4 (lines 319-322) + Code Examples (lines 503-528) + Pitfall 5 (lines 373-377). Local calendar strings only — **never `toISOString().slice(0,10)`** (UTC+8 midnight bug).

**Core pattern (copy verbatim, RESEARCH.md lines 503-528):**
```typescript
// src/lib/dates.ts
const pad = (n: number) => n.toString().padStart(2, "0");
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // LOCAL — no toISOString
}
export function today(): string { return toDateString(new Date()); }
export function isValid(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d; // rejects 2026-02-30
}
export function addDays(s: string, n: number): string {
  const [y, m, d] = s.split("-").map(Number);
  return toDateString(new Date(y, m - 1, d + n)); // local Date math
}
export function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; } // lexicographic works
export function monthRange(s: string): { start: string; end: string } {
  const [y, m] = s.split("-").map(Number);
  const start = `${y}-${pad(m)}-01`;
  const end = toDateString(new Date(y, m, 0)); // day 0 of next month = last day
  return { start, end };
}
```
Range queries consume these strings with lexicographic `>=` / `<=` comparisons (timezone-proof; RESEARCH line 56).

---

### Scaffold/config files (`index.ts`, `app.json`, `package.json`, `tsconfig.json`, `eslint.config.js`)

**Pattern source:** 01-RESEARCH.md Installation (lines 140-161) + template facts (lines 83, 694) + Pitfall 1 (lines 349-353).

- **Scaffold command (MANDATORY flags, RESEARCH line 144):** `npx create-expo-app@latest . --template blank-typescript --no-agents-md --yes` — `--no-agents-md` is critical: the scaffold would otherwise overwrite the repo's AGENTS.md (Pitfall 1).
- `index.ts`: template entry (`registerRootComponent(App)`) — untouched.
- `app.json`: template already has `userInterfaceStyle: "light"` + `predictiveBackGestureEnabled: false`; **only change is `name: "Money"`** (RESEARCH line 83).
- `tsconfig.json`: template (`expo/tsconfig.base`, strict); add `"types": ["jest"]` for Wave 0 (RESEARCH line 619).
- `package.json`: template deps + `"jest": { "preset": "jest-expo" }` + scripts `start`/`test`/`lint`; **typescript ~6.0.3 template pin — do not upgrade** (RESEARCH line 119).
- `eslint.config.js`: created by first `npx expo lint` run (flat config, eslint-config-expo) — do not hand-write.
- **Install order (RESEARCH lines 142-161):** `npx expo install firebase @react-native-async-storage/async-storage` (pins AsyncStorage 2.2.0 — Pitfall 2); `npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs`; `npx expo install react-native-screens react-native-safe-area-context`; `npx expo install jest-expo jest @types/jest "--" --dev` (Windows needs the `"--"` separator); `npx expo lint`; `npx expo-doctor`.

---

### Unit tests (Wave 0, jest-expo)

**Pattern source:** 01-RESEARCH.md Validation Architecture (lines 610-660) — test map + Wave 0 gaps.

**Setup (lines 618-619):** `package.json` → `"jest": { "preset": "jest-expo" }`; `tsconfig.json` → `"types": ["jest"]`. Run: `npx jest --ci --silent`.

**Test files and required coverage (lines 656-659):**
- `src/lib/__tests__/money-test.ts` — format: `0 → ₱ 0.00`, `123456 → ₱ 1,234.56`, negative; parse: `"24.5" → 2450`, `"₱ 1,234.56"`, `"0.001"`/`"1.2.3"` → null, `"12" → 1200`.
- `src/lib/__tests__/dates-test.ts` — `today()` local; `isValid` rejects `2026-02-30`/`2026-13-01`; `addDays` across month boundary; `monthRange` Feb leap; `compare` lexicographic; near-midnight case.
- `src/auth/__tests__/errors-test.ts` — `invalid-credential`/`wrong-password`/`user-not-found` → "Email or password is wrong"; `network-request-failed` → default copy; non-Firebase errors → default copy.
- `src/firebase/__tests__/queries-test.ts` — every builder's constraints include the uid equality (inspect via query internals `q._query` or emulator; RESEARCH Open Question 3, lines 587-589).

---

### Firestore security rules (console deploy artifact) + composite index

**Pattern source:** backend-schema.md lines 64-91 (**deploy verbatim** — no firebase CLI; RESEARCH line 58) + RESEARCH.md Open Question 2 (lines 583-585) + UI-adjacent Security Domain (lines 672-686).

**Rules text — copy from backend-schema.md lines 68-91:**
```
match /users/{uid} {
  allow read, delete: if resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
                 && request.resource.data.uid == request.auth.uid
                 && request.resource.data.isDefault == false;
  allow update: if resource.data.uid == request.auth.uid
                 && request.resource.data.isDefault == resource.data.isDefault;
}

match /entries/{id} {
  allow read, update, delete: if resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
                 && request.resource.data.uid == request.auth.uid;
}

match /expenseCategories/{id} {
  allow read, update, delete: if resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
                 && request.resource.data.uid == request.auth.uid;
}

match /incomeCategories/{id} { /* identical to expenseCategories */ }
```

**Recommended one-line hardening (RESEARCH Open Question 2):** add `&& request.resource.data.amountCents is int` to the `entries` create rule (prevents float drift; safe to add while touching rules).

**Console operations (all admin-side, manual):** register web app → get config values; deploy rules verbatim; create composite index `entries: type ASC, date DESC`; seed default account (auth user + `users/{uid}` with `isDefault: true` — console admin bypasses rules, which is required; RESEARCH line 58, Assumption A2). `checkpoint:human-verify` on real config insertion (RESEARCH line 581).

---

## Shared Patterns

### 1. Firebase singleton import discipline
**Source:** `src/firebase/app.ts` (RESEARCH.md lines 258-278, 402-415)
**Apply to:** `AuthProvider.tsx`, `queries.ts`, all future data consumers
- Import `auth`/`db` from `../firebase/app`; never call `getAuth()`/`initializeApp` yourself.
- `initializeAuth` + AsyncStorage persistence at module load, before any auth call — AUTH-02 depends on it.

### 2. Auth error mapping → locked copy
**Source:** `src/auth/errors.ts` (RESEARCH.md lines 450-464; UI-SPEC lines 118-119)
**Apply to:** `SignInScreen.tsx` (only consumer this phase)
- All three credential codes → "Email or password is wrong"; everything else → "Couldn't sign in. Check your connection and try again." Never leak whether the email exists.

### 3. Design tokens single source
**Source:** `src/theme/tokens.ts` (UI-SPEC lines 223-241)
**Apply to:** All screens (`LoadingScreen`, `SignInScreen`, `MainTabs`, `PlaceholderScreen`, wrappers)
- No raw color/size values outside tokens.ts. `StyleSheet.create` only — no styling libraries, no icons, system font.

### 4. uid-scoped query builders (NFR-01)
**Source:** `src/firebase/queries.ts` (RESEARCH.md lines 305-317, 466-482)
**Apply to:** Every future Firestore query in every phase — builders are the only place queries are created; uid clause first, always.

### 5. jest-expo Wave 0 test conventions
**Source:** RESEARCH.md Validation Architecture (lines 610-660)
**Apply to:** money-test.ts, dates-test.ts, errors-test.ts, queries-test.ts
- Preset `jest-expo`; tests written alongside implementation (tdd_mode); `npx jest --ci --silent` per task commit.

### 6. UI/UX invariants (UI-SPEC)
- Touch targets ≥ 44×44pt; Sign In button + inputs 48px; tab bar 56px + safe-area inset.
- Disabled button = `opacity 0.5`; in-flight label "Signing in…" (no spinner component).
- `StatusBar style="dark"` (expo-status-bar, template dep); `headerShown: false` throughout.
- Font scaling never disabled; secondary text only on white surfaces.

### 7. Anti-pattern blacklist (RESEARCH.md lines 324-332)
| Anti-pattern | Instead |
|---|---|
| Scaffold without `--no-agents-md` (clobbers repo AGENTS.md) | `npx create-expo-app@latest . --template blank-typescript --no-agents-md --yes` |
| `getAuth()` before `initializeAuth` (session won't persist) | Singleton `app.ts` wiring at module load |
| `persistentLocalCache` (IndexedDB-only, fails in Expo Go) | Default memory cache in `initializeFirestore` |
| `npm install` for async-storage (3.1.1 mismatches Expo Go's 2.2.0) | `npx expo install @react-native-async-storage/async-storage` |
| `(cents/100).toFixed(2)` / `Intl.NumberFormat` (float drift, device-dependent) | `money.ts` manual formatting only |
| `new Date().toISOString().slice(0,10)` (UTC+8 date bug) | `dates.ts` local components |
| `initializeAuth`/`initializeFirestore` inside components/effects | Module top level in `app.ts` |

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| All 28 files (see File Classification) | — | — | **Repo has zero application code** — planning-stage only (verified 2026-08-06: no `src/`, no `App.tsx`, no `package.json`). No in-repo code exists to copy from; planner must use the canonical patterns above (RESEARCH.md Code Examples / UI-SPEC Implementation Contract / backend-schema.md), which are verified against official sources (expo docs, expo.fyi, reactnavigation.org, firebase-js-sdk, bundledNativeModules.json) |

**Post-scaffold note for the planner:** after `create-expo-app` runs, the template itself becomes the analog for `index.ts`, `app.json`, `tsconfig.json`, and `package.json` — copy from the generated template files, applying the listed modifications only (never edit the generated `index.ts`; only `app.json`'s `name` changes).

## Metadata

**Analog search scope:** repo root + all subdirectories (`**/*.{ts,tsx,js,jsx}` glob), `.claude/skills/`, `.agents/skills/` — no code or project skills found
**Files scanned:** 0 application files (root contains 7 planning docs + `.planning/` + `docs/` only)
**Pattern extraction date:** 2026-08-06
**Pattern sources:** 01-RESEARCH.md (lines 258-332, 401-528, 610-660, 672-686), 01-UI-SPEC.md (lines 44-50, 111-177, 223-255), backend-schema.md (lines 64-91), 01-CONTEXT.md (locked decisions)
