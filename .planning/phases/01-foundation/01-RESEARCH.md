# Phase 1: Foundation - Research

**Researched:** 2026-08-06
**Domain:** Expo SDK 57 scaffold + Firebase JS SDK v12 auth (email/password) + react-navigation v7 auth gate + Firestore security rules + money/date foundations
**Confidence:** HIGH (all load-bearing claims verified today against official sources: expo docs + bundledNativeModules.json, expo.fyi, reactnavigation.org, firebase-js-sdk source, npm registry)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Scaffold & Tooling
- Expo scaffold via `create-expo-app` with **blank-typescript** template (react-navigation v7, not expo-router)
- App code lives at repo root; `src/` for application code
- Firebase credentials as constants in `src/firebase/config.ts` (private repo — no env plumbing needed in Expo Go)
- Phase gates: `tsc --noEmit` + `expo lint` at verification

#### Firebase Init & Persistence
- Firebase module init as a **singleton** `src/firebase/app.ts` exporting `app`, `auth`, `db`; provider consumes the singletons
- `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` wired at module load (before any auth call)
- No offline/connectivity UI indicator this phase — deferred to Phase 3 (Entries) where real write paths exist (NFR-02)
- `expo-file-system/legacy` import rule (SDK 57: legacy methods throw from the main module) documented for later phases — no file-system code this phase

#### Sign In Screen
- **No create-account UI this phase** — "Create one" inline expansion deferred to Phase 6 (AUTH-04); AUTH-01: no sign-up on first run
- Wrong-credential error copy: exactly **"Email or password is wrong"** (design brief; does not leak whether the email exists)
- Sign-in button: text changes to **"Signing in…"** and disabled while in flight (no spinner component)
- No password visibility toggle (design brief is minimal)

#### App Shell & Navigation
- **Root conditional stack**: `NavigationContainer` + native-stack — `SignIn` screen when no user, `MainTabs` when user; single source of truth for auth gating
- **Full 5-tab shell with placeholder screens** this phase (Home, Expenses, Income, Categories, Account) — later phases fill them in
- Tab bar is **text-only labels, no icons** (design brief: no decoration; text is the interface)
- **Loading screen while `onAuthStateChanged` resolves** to avoid flashing Sign In over a restored session

### the agent's Discretion
- Nothing user-deferred — all 16 questions accepted as recommended

### Deferred Ideas (OUT OF SCOPE)
- Create-account inline expansion on the Sign In card ("No account? Create one") — Phase 6 (AUTH-04)
- Offline/connectivity indicator UI — Phase 3 (Entries, NFR-02)
- Durable offline via expo-sqlite sync layer (OFFL-01) — v2, already tracked in STATE.md
- Search/filter (SEAR-01) — v2, already tracked in STATE.md
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Sign in with email/password on first launch; no sign-up on first run | SignInScreen-only gate (CONTEXT); `signInWithEmailAndPassword` (firebase/auth v12); seeded default account via Firebase console (rules reject in-app default creation); root conditional stack renders SignIn when signed out |
| AUTH-02 | Session persists across app restarts | `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` at module load — expo.fyi official pattern; AsyncStorage **2.2.0** pinned by Expo Go SDK 57 (bundledNativeModules.json) |
| AUTH-03 | Wrong credentials show inline error | Firebase error-code mapping (auth/invalid-credential primary — Email Enumeration Protection default; legacy wrong-password/user-not-found) → uniform "Email or password is wrong"; unit-testable `errors.ts` mapper |
| NFR-01 | Every Firestore query includes a `uid` equality filter | Centralized `src/firebase/queries.ts` builders — every builder starts from `where("uid","==",uid)`; rules are not filters (all-or-nothing queries); unit-testable in Node with the real firebase/firestore module |
| NFR-03 | Money as integer cents only; formatting via single `money.js` | `src/lib/money.ts`: `formatCents` → "₱ 1,234.50" (design-brief: space after ₱, separators always), `parseInput` → integer cents via string math (never float); no `Intl.NumberFormat` (Hermes delegates to platform ICU — device-dependent output; `formatToParts` Android-only) |
| NFR-04 | Dates as local "YYYY-MM-DD" strings, no UTC slicing | `src/lib/dates.ts`: `today()` from local components (getFullYear/getMonth/getDate) — never `toISOString().slice(0,10)` (UTC+8 midnight bug, Pitfall 7); `addDays`, `isValid`, `compare`, `monthRange` via local Date math; lexicographic string compares make ranges timezone-proof |
| NFR-05 | All libraries Expo Go compatible; Firebase JS SDK ^12; AsyncStorage 2.2.0 | Every package verified against Expo Go SDK 57 bundled pins (bundledNativeModules.json) + `npx expo install` for native-adjacent packages; firebase ≥12 required by Expo docs (2026-07-17) |
| NFR-06 | Security rules deployed matching backend-schema.md | Rules text in backend-schema.md deployed verbatim via Firebase console (firebase CLI not installed); uid scoping, `isDefault` immutable, create restricted to `isDefault == false`; console-seeded default account bypasses rules by admin privilege (intended); composite index `type ASC, date DESC` created in console |
</phase_requirements>

## Project Constraints (from AGENTS.md)

Directives extracted from `./AGENTS.md` (STACK.md section — authoritative, treated with same weight as locked decisions):

- **Expo Go workflow only** — every library must run in Expo Go; no custom native modules. `@react-native-firebase/*` is forbidden (needs dev builds).
- **Firebase JS SDK only**; `firebase@^12.17.1` (Expo requires ≥12.0.0). Firestore is the only database.
- **Free Spark plan**; one Firestore database; no Cloud Functions.
- **Auth**: email/password only; default account seeded via Firebase console, never in-app.
- **Currency**: PHP only, integer-cents storage, never floats; formatting via `money.js` only; no `Intl.NumberFormat`.
- **Compatibility**: Android + iOS; QR-code tested on the user's phone.
- **Mandatory rule**: `npx expo install <pkg>` for every native-adjacent package (async-storage, datetimepicker, keyboard-controller, expo-*, screens, safe-area-context). Plain `npm install` can select Expo-Go-incompatible versions.
- **AsyncStorage must be 2.2.0** (Expo Go SDK 57 pin), not npm latest 3.1.1.
- **No `persistentLocalCache()`** — Firestore durable cache is IndexedDB-only; throws/falls back in Expo Go. Memory cache default (session-scoped offline accepted).
- **Auth persistence** via `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`.
- **`xlsx`** (SheetJS) from CDN tarball, not npm — relevant only from Phase 5; do not install this phase.
- **`expo-file-system`**: new File/Directory API in SDK 57; legacy methods throw from the main module — legacy import rule documented for later phases (no file-system code this phase).
- Run `npx expo-doctor` after installs; gate with `tsc --noEmit` + `expo lint`.
- Navigation: `@react-navigation/native@7` + `bottom-tabs@7.18.x` + `native-stack@7.18.x`; native deps (screens ~4.26.0, safe-area-context ~5.7.0) bundled in Expo Go.
- State: React Context + hooks (2 contexts max at this scale) — no Redux/Zustand.

## Summary

Phase 1 bootstraps a brand-new Expo SDK 57 app at the repo root (no application code exists yet — only planning docs) and delivers the auth gate, the 5-tab shell, and the money/date/query foundations every later phase builds on. The scaffold is `npx create-expo-app@latest . --template blank-typescript --no-agents-md --yes`: the `--no-agents-md` flag is **critical** because create-expo-app now generates an AGENTS.md/CLAUDE.md, which would overwrite the repo's project-instructions AGENTS.md. The template (57.0.13) produces `index.ts` → `registerRootComponent(App)`, strict TypeScript, and an `app.json` that already has `userInterfaceStyle: "light"` (dark mode off) and `predictiveBackGestureEnabled: false` (the react-navigation v7 Android requirement) — the only app.json change needed is `name: "Money"`.

Firebase wiring follows the expo.fyi official pattern: a module-level singleton (`src/firebase/app.ts`) calls `initializeApp` → `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` → `initializeFirestore(app)` (default memory cache — never `persistentLocalCache`, which is IndexedDB-only and fails in Expo Go). AsyncStorage is pinned to **2.2.0** by Expo Go SDK 57's bundledNativeModules.json (verified); npm latest 3.1.1 would break in Expo Go. Wrong credentials surface `auth/invalid-credential` on modern projects (Email Enumeration Protection is on by default; legacy `user-not-found`/`wrong-password` codes exist on older projects) — all three map to the locked copy "Email or password is wrong". The auth gate is a conditional root stack (SignIn ↔ MainTabs) driven by `onAuthStateChanged`, with a loading screen until the first emission so a restored session never flashes Sign In.

The security posture is settled by backend-schema.md (deploy rules verbatim via Firebase console — firebase CLI is not installed) plus the centralized `queries.ts` uid-scoped builders (NFR-01, rules-are-not-filters). `money.ts`/`dates.ts` are deliberately hand-rolled pure functions (deterministic formatting, local calendar dates — no `Intl`, no UTC slicing). Testing: jest-expo (~57.0.3) unit tests for the four pure modules; auth flows and cross-account rules verification are manual on-device checks (Expo Go QR).

**Primary recommendation:** Execute in this order — (1) manual Firebase console setup (project, email/password auth, Firestore, rules, composite index, web-app registration, seed default account) with code written against placeholder-safe config; (2) scaffold with `--no-agents-md`; (3) install pinned deps via `npx expo install`; (4) singletons → queries → utils → AuthProvider → screens → shell; (5) jest-expo Wave 0 tests alongside; (6) device verification (sign in, restart persistence, wrong-creds, second-account rules rejection).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Credential verification (email/password) | API / Backend (Firebase Auth) | — | `signInWithEmailAndPassword` is server-side; client never stores passwords |
| Session persistence across restarts | Client (AsyncStorage) | API / Backend (Firebase token refresh) | `initializeAuth` + `getReactNativePersistence(AsyncStorage)` persists the token; Firebase handles refresh/expiry server-side |
| Auth state gating (SignIn vs tabs) | Client (react-navigation conditional stack) | — | `onAuthStateChanged` in AuthProvider is the single source of truth; screens render purely from it |
| Ledger access control | Database / Storage (Firestore rules) | Client (uid query filters) | Rules enforce uid scoping server-side (NFR-06); client must still filter every query (NFR-01) — rules are not filters |
| Money formatting/parsing | Client (`lib/money.ts`) | — | Pure presentation/validation logic; integer cents everywhere else (NFR-03) |
| Date handling | Client (`lib/dates.ts`) | — | Local calendar strings; range queries are lexicographic (NFR-04) |
| Firestore query construction | Client (`firebase/queries.ts`) | Database / Storage (indexes) | Builders centralize the uid clause; composite index `type ASC, date DESC` is a server-side dependency |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo | ~57.0.11 (scaffold: `create-expo-app` 4.0.0, template blank-typescript 57.0.13) | App framework; Expo Go QR testing | Current SDK (2026-06-30), RN 0.86 + React 19.2; Expo Go store build ships SDK 57 [VERIFIED: npm registry + docs.expo.dev] |
| react-native / react | 0.86.2 / 19.2.3 (via SDK 57) | UI runtime | Pinned by SDK 57 [VERIFIED: bundledNativeModules.json] |
| firebase | ^12.17.1 (JS SDK, modular API) | Auth (email/password) + Firestore | Expo requires ≥12.0.0 (docs, 2026-07-17); 12.17.1 current on npm (2026-08-04); only SDK that runs in Expo Go [VERIFIED: npm registry + docs.expo.dev/guides/using-firebase] |
| @react-navigation/native | 7.3.15 | Navigation core | v7 current; pure JS; peer deps bundled in Expo Go [VERIFIED: npm registry] |
| @react-navigation/native-stack | 7.18.7 | Root conditional stack (SignIn/MainTabs) | v7 current [VERIFIED: npm registry] |
| @react-navigation/bottom-tabs | 7.18.15 | 5-tab shell | v7 current [VERIFIED: npm registry] |
| react-native-screens | ~4.26.0 (via `npx expo install`) | native-stack peer dep | SDK 57 bundled pin [VERIFIED: bundledNativeModules.json] |
| react-native-safe-area-context | ~5.7.0 (via `npx expo install`) | safe areas (tab bar, card) | SDK 57 bundled pin [VERIFIED: bundledNativeModules.json] |
| @react-native-async-storage/async-storage | **2.2.0** (via `npx expo install`) | Auth persistence backing | **Exact Expo Go SDK 57 pin**; npm latest 3.1.1 breaks in Expo Go [VERIFIED: bundledNativeModules.json + npm registry] |
| expo-status-bar | ~57.0.1 (template) | `style="dark"` on light background | Template dep, bundled [VERIFIED: template package.json] |
| typescript | ~6.0.3 (template pin) | Type checking; gate `tsc --noEmit` | Template pins ~6.0.3 (not npm latest 7.x) — do not upgrade manually [VERIFIED: template package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jest-expo | ~57.0.3 (dev) | Jest preset for Expo | Unit tests for money.ts, dates.ts, errors.ts, queries.ts (Wave 0) [VERIFIED: bundledNativeModules.json + docs.expo.dev/develop/unit-testing] |
| jest + @types/jest | resolved by `npx expo install` (dev) | Test runner | Same setup [CITED: docs.expo.dev/develop/unit-testing] |
| @testing-library/react-native | latest (dev, optional) | Component tests | If SignInScreen gets a component test; replaces deprecated react-test-renderer (React 19) [CITED: docs.expo.dev/develop/unit-testing] |
| eslint-config-expo | ~57.0.1 (dev) | `expo lint` gate | Installed automatically by first `npx expo lint` run (flat config `eslint.config.js`) [VERIFIED: bundledNativeModules.json + docs.expo.dev/guides/using-eslint] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| blank-typescript template | default template (expo-router + tabs) | Default ships expo-router — project locked react-navigation v7 + dynamic config; blank-typescript is the minimal base |
| Dynamic react-navigation config | Static config (`createStaticNavigation`) | v7 docs now *recommend* static; dynamic is fully supported and matches the locked "conditional root stack" decision. Revisit later phases if desired — migration cost is low |
| Firebase console (rules/index/seed) | firebase CLI (`npx firebase-tools`) | CLI not installed; console is admin-privileged (bypasses rules — required for seeding the default account) and sufficient for one-time setup. CLI optional if the team prefers version-controlled rules |
| jest-expo | vitest | jest-expo is the Expo-blessed preset, pinned in bundledNativeModules, documented setup; vitest needs extra RN transforms |
| Memory-cache Firestore | persistentLocalCache / expo-sqlite | persistentLocalCache is IndexedDB-only → fails in Expo Go (locked decision); expo-sqlite durable offline is deferred to v2 (OFFL-01) |

**Installation:**

```bash
# 1. Scaffold at repo root (--no-agents-md is REQUIRED: repo has AGENTS.md; scaffold would overwrite it)
npx create-expo-app@latest . --template blank-typescript --no-agents-md --yes

# 2. Firebase (JS SDK; expo install is the documented way) + auth persistence backing (pinned 2.2.0)
npx expo install firebase @react-native-async-storage/async-storage

# 3. Navigation (pure JS packages via npm; native peers via expo install)
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context

# 4. Unit testing (Wave 0; Windows needs the "--" separator before --dev)
npx expo install jest-expo jest @types/jest "--" --dev

# 5. Lint setup — first run creates eslint.config.js (flat config, eslint-config-expo)
npx expo lint

# 6. Verify compatibility
npx expo-doctor
```

**Version verification (run 2026-08-06):** expo 57.0.11, firebase 12.17.1, @react-navigation/native 7.3.15, native-stack 7.18.7, bottom-tabs 7.18.15, async-storage npm-latest 3.1.1 (⚠ Expo Go pin is 2.2.0 — verified present on npm), react-native-screens 4.26.2 (satisfies ~4.26.0), safe-area-context 5.8.1 (satisfies ~5.7.0), expo-template-blank-typescript 57.0.13. All confirmed against npm registry today.

## Package Legitimacy Audit

All 9 packages checked via `gsd-tools query package-legitimacy check --ecosystem npm`. Every package returned `SUS` with the single reason **"too-new"** — the heuristic flags the recency of the latest publish (all published within days; these are weekly-release packages). None carries a postinstall script (checked), all resolve to canonical source repos (expo/expo, firebase/firebase-js-sdk, react-navigation/react-navigation, react-native-async-storage/async-storage, software-mansion/react-native-screens, AppAndFlow/react-native-safe-area-context), and weekly downloads run 4.8M–9.1M. This is a recency false-positive, not a legitimacy signal: every package is additionally locked by the project's own STACK.md (verified 2026-08-06 against official docs and the npm registry) and by this research session's direct authoritative fetches.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| expo | npm | 10+ yrs | 7.8M/wk | github.com/expo/expo | SUS (too-new only) | Approved — no checkpoint (recency-only flag; official Expo docs + registry verified today) |
| firebase | npm | 10+ yrs | 9.1M/wk | github.com/firebase/firebase-js-sdk | SUS (too-new only) | Approved — no checkpoint (STACK.md + expo docs require ≥12; version verified) |
| @react-navigation/native | npm | 8+ yrs | 6.2M/wk | github.com/react-navigation/react-navigation | SUS (too-new only) | Approved — no checkpoint |
| @react-navigation/native-stack | npm | 8+ yrs | 4.9M/wk | github.com/react-navigation/react-navigation | SUS (too-new only) | Approved — no checkpoint |
| @react-navigation/bottom-tabs | npm | 8+ yrs | 4.8M/wk | github.com/react-navigation/react-navigation | SUS (too-new only) | Approved — no checkpoint |
| @react-native-async-storage/async-storage | npm | 8+ yrs (2.2.0 created 2020-10-21) | 6.5M/wk | github.com/react-native-async-storage/async-storage | **OK** | Approved — pin 2.2.0 exactly |
| react-native-screens | npm | 8+ yrs | 7.2M/wk | github.com/software-mansion/react-native-screens | SUS (too-new only) | Approved — no checkpoint |
| react-native-safe-area-context | npm | 6+ yrs | 8.1M/wk | github.com/AppAndFlow/react-native-safe-area-context | SUS (too-new only) | Approved — no checkpoint |
| expo-status-bar | npm | 8+ yrs | 6.1M/wk | github.com/expo/expo | SUS (too-new only) | Approved — no checkpoint |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none actionable — all four SUS verdicts are the "too-new" recency heuristic on canonical packages independently verified against official docs + registry in this session. Planner does **not** need `checkpoint:human-verify` for these; the only version-sensitive install is async-storage (pin 2.2.0, which `npx expo install` selects automatically).

## Architecture Patterns

### System Architecture Diagram

```
                        ┌───────────────────────────────────────────┐
                        │  Firebase console (one-time, admin)        │
                        │  project · email/password · Firestore     │
                        │  RULES (uid-scoped) · index type ASC,date │
                        │  DESC · register web app · SEED default   │
                        │  account (auth user + users/{uid} isDefau─┼─┐
                        └───────────────────────────────────────────┘ │
                              ▲ (rules enforced server-side)          │ config constants
                              │                                       ▼
┌─────────────────────────────┴──────────────────────────────────────────────┐
│  App.tsx (index.ts → registerRootComponent)                                 │
│  AuthProvider (onAuthStateChanged → { user, initializing, signIn })         │
│       │                                                                     │
│       ▼                                                                     │
│  NavigationContainer + native-stack (headerShown: false)                    │
│   ├─ initializing ──► LoadingScreen (centered ActivityIndicator)            │
│   ├─ signedOut ─────► SignInScreen (card: Money / Email / Password /        │
│   │                    error / Sign in button) ──signInWithEmailAndPassword─┼──► Firebase Auth
│   └─ signedIn ──────► MainTabs (bottom-tabs, text-only labels)              │
│                        Home · Expenses · Income · Categories · Account      │
│                        (all → PlaceholderScreen "Coming soon")              │
└─────────────────────────────────────────────────────────────────────────────┘
        │                                        │
        │ src/firebase/app.ts singletons          │ src/lib + src/firebase/queries.ts (pure, unit-tested)
        │  initializeApp → initializeAuth(        │  money.ts (cents ⇄ "₱ 1,234.50") · dates.ts
        │  getReactNativePersistence(AsyncStorage)│  (local YYYY-MM-DD) · queries.ts (uid-scoped,
        │  → initializeFirestore (memory cache)   │  NFR-01) · auth/errors.ts (error→copy map)
        ▼                                        ▼
┌─────────────────────┐                ┌─────────────────────────────┐
│ Firebase Auth        │                │ Cloud Firestore (Spark)     │
│ email/password only  │◄──token───────│ users/{uid} · entries ·      │
│ session persists via │                │ expenseCategories ·         │
│ AsyncStorage 2.2.0   │                │ incomeCategories            │
└─────────────────────┘                └─────────────────────────────┘
```

Primary use case trace: first launch → AuthProvider restores (no stored user) → SignIn → credentials → Firebase Auth verifies → `onAuthStateChanged` flips → MainTabs shell. Wrong credentials → inline error, stays on SignIn. Restart → AsyncStorage token restored → LoadingScreen → MainTabs without Sign In (AUTH-02).

### Recommended Project Structure

```
money-tracking/
├── App.tsx                       # AuthProvider → NavigationContainer → root conditional stack
├── index.ts                      # template entry (registerRootComponent) — untouched
├── app.json                      # name "Money"; userInterfaceStyle "light"; predictiveBackGestureEnabled false (already)
├── eslint.config.js              # created by first `npx expo lint` run
├── package.json                  # scripts: start / test (jest) / lint; jest preset jest-expo
├── tsconfig.json                 # template: expo/tsconfig.base + strict (add "jest" to types)
└── src/
    ├── firebase/
    │   ├── config.ts             # firebaseConfig constants (apiKey, projectId, …) — placeholder-safe
    │   ├── app.ts                # singletons: app / auth / db (initializeAuth + AsyncStorage persistence FIRST)
    │   └── queries.ts            # uid-scoped query builders (NFR-01) — every query starts with where("uid","==",uid)
    ├── auth/
    │   ├── AuthProvider.tsx      # context { user, initializing, signIn }; onAuthStateChanged subscription
    │   └── errors.ts             # authErrorMessage(error: unknown): string — pure, unit-tested (AUTH-03 copy)
    ├── screens/
    │   ├── LoadingScreen.tsx     # centered ActivityIndicator on #F7F7F8 (no branding)
    │   ├── SignInScreen.tsx      # card, "Money" 28/700, Email+Password, inline error, submit lifecycle
    │   ├── MainTabs.tsx          # bottom-tabs, 5 label-only tabs, headerShown false
    │   ├── PlaceholderScreen.tsx # centered "Coming soon" (#6B7280)
    │   ├── HomeScreen.tsx … AccountScreen.tsx   # thin wrappers → PlaceholderScreen
    ├── lib/
    │   ├── money.ts              # formatCents / parsePesoInput (integer cents only; no Intl)
    │   └── dates.ts              # today / addDays / isValid / compare / monthRange (local strings)
    └── theme/
        └── tokens.ts             # colors/spacing/typography/radius per UI-SPEC Implementation Contract
```

### Pattern 1: Firebase module singletons (init order is load-bearing)

**What:** One module (`src/firebase/app.ts`) initializes app → auth → db at module load. `initializeAuth` with AsyncStorage persistence must be the **first** auth call — `getAuth()` before it creates a default instance without the RN persistence wiring.
**When to use:** Always — this is the expo.fyi documented pattern (v10.3.0+). Keep it at module top level so Fast Refresh of components never re-runs it; importing the singletons is the only way providers/screens obtain `auth`/`db`.
**Example (expo.fyi/firebase-js-auth-setup, verbatim pattern):**

```typescript
// src/firebase/app.ts
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
const db = initializeFirestore(app); // default memory cache — NEVER persistentLocalCache in Expo Go
export { app, auth, db };
```

### Pattern 2: Conditional root stack (react-navigation auth flow)

**What:** The root native-stack renders `SignIn` when signed out and `MainTabs` when signed in; `LoadingScreen` until the first `onAuthStateChanged` emission. No manual navigation on sign-in success — the gate reacts to state (UI-SPEC Interaction §1).
**When to use:** The locked navigation decision (CONTEXT: "single source of truth for auth gating"). Documented react-navigation pattern; dynamic config is fully supported in v7.
**Example:**

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

### Pattern 3: uid-scoped query builders (NFR-01)

**What:** Every Firestore query is constructed in `src/firebase/queries.ts` from a `uid` parameter. Firestore rules are "not filters" — an unscoped query can *potentially* match another user's doc and the whole query is rejected with `permission-denied`. This is the single most important data-layer rule in the project (PITFALLS.md Pitfall 1).
**When to use:** All phases — builders are the only place queries are created. Phase 1 creates the builder surface so later phases cannot forget the uid clause.
**Example (shape; exact code in Code Examples):**

```typescript
// src/firebase/queries.ts
const entriesBase = (uid: string) =>
  query(collection(db, "entries"), where("uid", "==", uid));   // NFR-01
export const entriesByType = (uid: string, type: EntryType) =>
  query(entriesBase(uid), where("type", "==", type), orderBy("date", "desc")); // needs composite index
```

### Pattern 4: Deterministic pure utilities (money/dates)

**What:** `money.ts` and `dates.ts` are pure, dependency-free, unit-testable modules. No `Intl.NumberFormat` (Hermes delegates to platform ICU/CLDR — output varies by OS version; `formatToParts` is Android-only) and no UTC date slicing.
**When to use:** Locked by NFR-03/NFR-04. Money is integer cents everywhere; formatting/parsing happens only in `money.ts`. Dates are local `"YYYY-MM-DD"` strings; range queries are lexicographic string comparisons.

### Anti-Patterns to Avoid

- **Scaffolding without `--no-agents-md`:** create-expo-app 4.0.0 generates AGENTS.md/CLAUDE.md/.claude/settings.json — it would clobber the repo's project AGENTS.md. Always pass `--no-agents-md`.
- **`getAuth()` before `initializeAuth`:** creates an auth instance without AsyncStorage persistence — session silently won't survive restarts (AUTH-02 fails).
- **Passing `persistentLocalCache` to `initializeFirestore`:** IndexedDB-only cache; throws/falls back in Expo Go (STACK.md Critical Finding).
- **Installing async-storage from npm directly:** npm latest 3.1.1 mismatches Expo Go's bundled 2.2.0 native build. Use `npx expo install`.
- **Formatting money with `(cents/100).toFixed(2)` or `Intl.NumberFormat`:** float drift + device-dependent output. `money.ts` only.
- **`new Date().toISOString().slice(0,10)` for today:** UTC date; in UTC+8 an entry at 00:00–08:00 lands on yesterday. Local components only.
- **Calling `initializeAuth`/`initializeFirestore` inside components or effects:** re-runs under Fast Refresh / re-renders; keep them at module load in `app.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email/password authentication | Custom credential store, hashing, sessions | Firebase Auth (`signInWithEmailAndPassword`, `onAuthStateChanged`) | Password hashing, token lifecycle, rate limiting, EEP anti-enumeration are Firebase-managed; Spark free tier |
| Session persistence across restarts | Custom token file/serialization | `initializeAuth` + `getReactNativePersistence(AsyncStorage)` | Official Firebase RN persistence mechanism (expo.fyi); AsyncStorage 2.2.0 is the Expo Go pin |
| Navigation / auth gating | Hand-rolled state machine + conditional rendering by hand | react-navigation v7 native-stack + bottom-tabs | Screen lifecycle, back handling, safe areas, tab state preservation are solved |
| Firestore queries & security enforcement | REST calls, client-side filtering of all docs | Firestore SDK + uid-scoped query builders + rules | Rules are server-enforced (NFR-06); client filtering alone is insecure; SDK handles offline queue, listeners, retries |
| Security rules authoring | Custom middleware/proxy | backend-schema.md rules (verbatim deploy) | Canonical `request.auth.uid` pattern with `isDefault` immutability — already written and reviewed |
| JS testing setup | Custom test runner | jest-expo preset (~57.0.3) | Expo-blessed preset; handles RN transforms; pinned in bundledNativeModules |

**Key insight:** This project's "hand-rolled" surface is deliberately limited to **deterministic formatting/date utilities** (`money.ts`, `dates.ts`) — a case where libraries (date-fns/dayjs, Intl) would *add* device-dependence or bundle weight for ~60 lines of pure functions. Everything with security or lifecycle complexity is delegated to Firebase / react-navigation / jest. Never hand-roll auth, persistence, navigation, or rules.

## Common Pitfalls

### Pitfall 1: create-expo-app overwrites AGENTS.md
**What goes wrong:** Scaffold silently replaces the repo's project-instructions AGENTS.md with the Expo template's generated one.
**Why it happens:** create-expo-app 4.0.0 generates AGENTS.md, CLAUDE.md, and .claude/settings.json by default (confirmed via `--help`: the flag `--no-agents-md` exists specifically to skip this).
**How to avoid:** Always `npx create-expo-app@latest . --template blank-typescript --no-agents-md --yes`.
**Warning signs:** AGENTS.md content changes after scaffold; `.claude/settings.json` appears.

### Pitfall 2: AsyncStorage version mismatch (npm latest vs Expo Go pin)
**What goes wrong:** Installing `@react-native-async-storage/async-storage@3.1.1` (npm latest) while Expo Go SDK 57 bundles native 2.2.0 → native module version mismatch (runtime warnings/crashes).
**Why it happens:** The npm latest moved past Expo Go's bundled build; plain `npm install` doesn't know Expo Go's pins.
**How to avoid:** `npx expo install @react-native-async-storage/async-storage` — selects 2.2.0 automatically. Verify with `npx expo-doctor` + `npm ls @react-native-async-storage/async-storage`.
**Warning signs:** Expo Go redbox on auth import; `expo-doctor` reporting mismatch.

### Pitfall 3: Auth instance without AsyncStorage persistence
**What goes wrong:** AUTH-02 fails — session doesn't survive restart.
**Why it happens:** `getAuth(app)` called before/without `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` creates a default instance lacking RN persistence.
**How to avoid:** Singleton `app.ts` wires `initializeAuth` at module load, before any `getAuth()` call. Import order matters: `AuthProvider` imports from `app.ts`, never calls `getAuth()` itself.
**Warning signs:** Sign in works; kill + reopen lands on Sign In; no `firebase.auth` persistence errors.

### Pitfall 4: `auth/wrong-password` / `auth/user-not-found` never fire on modern projects
**What goes wrong:** Error-mapping code that only checks legacy codes shows the wrong copy for the actual failure.
**Why it happens:** Since Email Enumeration Protection (default ON for new projects), `signInWithEmailAndPassword` fails with **`auth/invalid-credential`** for both wrong email and wrong password (verified in firebase-js-sdk source docstring); legacy codes only appear when EEP is off.
**How to avoid:** Map all three codes (`invalid-credential`, `wrong-password`, `user-not-found`) → "Email or password is wrong"; everything else (network, too-many-requests, invalid-email, …) → "Couldn't sign in. Check your connection and try again." per UI-SPEC copy contract. Unit-test the mapper.
**Warning signs:** Wrong-creds test shows the generic message instead of the credential message.

### Pitfall 5: `toISOString().slice(0, 10)` — UTC date slicing (NFR-04)
**What goes wrong:** Entries logged 00:00–08:00 local (UTC+8) get yesterday's date; summaries/exports split them.
**Why it happens:** `toISOString()` is UTC by definition (PITFALLS.md Pitfall 7).
**How to avoid:** `today()` from local components: `getFullYear()/getMonth()+1/getDate()` padded to `YYYY-MM-DD`. Month math via `new Date(y, m, 1)` / `new Date(y, m+1, 0)`. Unit-test near midnight with a mocked timezone.
**Warning signs:** Test entry at 1 AM shows yesterday; Home "misses" first-of-month early-morning entries.

### Pitfall 6: `Intl.NumberFormat` renders differently per device (NFR-03)
**What goes wrong:** Some devices show `₱ 1,234.50`, others `PHP 1,234.50`; `formatToParts` throws/undefined on iOS.
**Why it happens:** Hermes delegates Intl to platform ICU/CLDR (version-dependent); PITFALLS.md Pitfall 8.
**How to avoid:** `money.ts` formats manually: thousands grouping + fixed 2 decimals + "₱ " prefix (design-brief: space before digits, separators always shown). Parse by stripping `₱/P/PHP`, commas, spaces; integer math, never `parseFloat(x)*100`.
**Warning signs:** Formatting correct on dev phone, different on second phone.

### Pitfall 7: Unscoped query → wholesale `permission-denied` (NFR-01)
**What goes wrong:** Any query missing the uid filter fails entirely, even for the user's own data; typically only surfaces after a second account has data (PITFALLS.md Pitfall 1).
**Why it happens:** "Security rules are not filters" — rules evaluate the query's *potential* result set.
**How to avoid:** All queries through `queries.ts` (uid clause first). Verify with two test accounts in Phase 1 verification.
**Warning signs:** `FirebaseError: permission-denied` on reads that "should" work; works with one user, breaks with two.

### Pitfall 8: Missing composite index `type ASC, date DESC`
**What goes wrong:** The type-scoped tab query fails with an error containing a console link to create the index.
**Why it happens:** Composite ordering requires an explicit index; it is not auto-created.
**How to avoid:** Create it in the Firebase console during setup (documented as a deployment artifact per CONTEXT). No code change needed — the error self-links.
**Warning signs:** First run of `entriesByType` query throws "The query requires an index".

## Code Examples

Verified patterns from official sources (all APIs current for the verified versions):

### Firebase auth bootstrap (expo.fyi/firebase-js-auth-setup; firebase 12.17.1)
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

### AuthProvider (onAuthStateChanged gate; AUTH-01/02/03)
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

### Auth error mapping (AUTH-03; unit-testable)
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

### uid-scoped query builders (NFR-01; needs composite index `type ASC, date DESC` for entriesByType)
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

### money.ts (NFR-03 — deterministic; design-brief: `₱ 1,234.50`, space after symbol)
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

### dates.ts (NFR-04 — local calendar strings, never UTC)
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

### Firestore security rules (backend-schema.md — deploy verbatim via console)
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
/* expenseCategories + incomeCategories: identical to entries */
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| firebase 10/11 in Expo | firebase ≥12.0.0 (12.17.1 current) | Expo docs, 2026-07-17 (ES module resolution fix) | Older versions fail to bundle with Metro; 12.x is the only supported line |
| `persistentLocalCache` in Expo Go | Default memory cache (session-scoped offline) | SDK 57 era; IndexedDB-only persistence never worked in RN | Durable offline deferred (OFFL-01, v2); never pass localCache in Expo Go |
| expo-router as create-expo-app default | blank-typescript + react-navigation v7 (dynamic config) | Template default since SDK 50s | Project locked react-navigation; dynamic config fully supported in v7 (static now "recommended") |
| `Intl.NumberFormat` for currency | Deterministic manual formatter in money.ts | Hermes Intl delegation documented | Device-consistent ₱ output (Pitfall 6) |
| `auth/wrong-password` + `auth/user-not-found` | `auth/invalid-credential` (EEP on by default) | firebase-js-sdk ~9.14 + EEP rollout | Map all three codes; anti-enumeration by default |
| react-test-renderer for RN tests | @testing-library/react-native | React 19 (react-test-renderer deprecated) | Component tests use RNTL if needed this phase |

**Deprecated/outdated:**
- `persistentLocalCache`/`enablePersistence` on React Native: IndexedDB-only, unimplemented → do not use.
- `expo-file-system` legacy API from the main module: throws at runtime in SDK 57 — legacy import rule documented (no FS code this phase).
- npm `xlsx` 0.18.5: frozen/stale — SheetJS CDN 0.20.3 (Phase 5, not this phase).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | create-expo-app proceeds in a non-empty directory (repo has docs + AGENTS.md but no package.json/App.tsx/app.json) | Installation | CLI aborts or prompts; mitigation: run with `--yes`, no conflicting files exist (verified repo root contents); if it still balks, scaffold into a temp dir and copy — low impact |
| A2 | Firebase console has admin access that bypasses security rules, making console-seeding of the default account legal | Security Domain / rules | If the console were rule-bound, seeding `isDefault: true` would be rejected; standard Firebase behavior (console = IAM admin) — MEDIUM confidence, flag for manual verification at seed time |
| A3 | Expo Go is installed on the user's phone and the QR/LAN (or `--tunnel`) workflow works | Environment Availability | Device verification is inherently manual; `expo start --tunnel` is the documented fallback for cross-network QR |
| A4 | Fast Refresh does not re-execute the `src/firebase/app.ts` singleton module (standard Expo pattern) | Code Examples | If it re-ran, `initializeAuth` could double-init; widespread practice (expo docs pattern) + firebase app registry is name-keyed; low risk |
| A5 | jest version resolved by `npx expo install jest` is compatible with jest-expo ~57.0.3 preset | Validation Architecture | expo install resolves the paired version; jest-expo ships its own jest peer range — verified via the documented command |
| A6 | The user has a Google account and can create the Firebase project (console steps are manual) | Open Questions | Setup is a hard prerequisite for AUTH-01 device testing; code can proceed with placeholder config until credentials land |
| A7 | Test-time introspection of Firestore query constraints (`q._query` internals) remains stable across firebase 12.x | Validation Architecture | If internals shift, fall back to Firestore emulator tests or manual 2-account verification — low impact for this phase |

## Open Questions

1. **Firebase project credentials** — What are the real `firebaseConfig` values?
   - What we know: the shape (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) and that constants live in `src/firebase/config.ts` (CONTEXT).
   - What's unclear: actual values; the user must create the project and register a web app in the console.
   - Recommendation: order tasks so all non-config code is built and unit-tested with a placeholder config; deploy rules + seed account + insert real config as a human step before device verification. Flag `checkpoint:human-verify` on config insertion if credentials aren't available at plan time.

2. **Rules hardening: `amountCents is int` check** — Add `&& request.resource.data.amountCents is int` to the entries create rule (one line, PITFALLS.md Security Mistakes)? 
   - What we know: backend-schema.md rules are correct for Phase 1 scope; int-check is cheap hardening for Phase 3.
   - Recommendation: add it now while touching rules — no downside, prevents float drift reaching the DB. Planner should include in the rules file.

3. **Firestore emulator testing** — Use the emulator for queries.ts tests (clean) or Node-runs-against-internals (fast)?
   - What we know: firebase/firestore runs in Node; asserting the uid filter via internal `_query` fields is fast but semi-private; the emulator is the canonical tool but adds setup weight.
   - Recommendation: Phase 1 uses internal-field assertions (fast, sufficient to prove the uid clause exists); revisit emulator-based rule tests if a later phase needs them.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | scaffold, expo CLI, jest | ✓ | v24.18.0 | — |
| npm | installs | ✓ | 11.18.0 | — |
| git | repo ops | ✓ | 2.46.1 | — |
| create-expo-app (via npx) | scaffold | ✓ | 4.0.0 | manual scaffold file copy |
| firebase CLI | rules/index deploy | ✗ | — | **Firebase console** (recommended anyway: admin-seeded default account + index creation are console operations) |
| Expo Go app (user's phone) | device verification (AUTH-01/02/03, NFR-05/06) | ✗ (not verifiable from this machine — manual) | — | `npx expo start --tunnel` for cross-network QR |
| adb | — | ✗ | — | not needed (Expo Go workflow) |

**Missing dependencies with no fallback:**
- User's phone with Expo Go + LAN access to the dev machine (QR testing) — manual by nature; `--tunnel` covers network cases.

**Missing dependencies with fallback:**
- firebase CLI → Firebase console for rules deployment, composite index creation, and default-account seeding (console is admin-privileged, which the seed actually requires).
- Firebase project credentials → placeholder config while building; real values needed before device sign-in verification.

## Validation Architecture

> `workflow.nyquist_validation: true` — required. `tdd_mode: true` — tests written alongside implementation (Wave 0 first).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest-expo ~57.0.3 (preset) + jest + @types/jest (versions resolved by `npx expo install`) |
| Config file | `package.json` → `"jest": { "preset": "jest-expo" }` + `tsconfig.json` `"types": ["jest"]` (Wave 0) |
| Quick run command | `npx jest --ci --silent` (pure-module tests; ~5–15 s) |
| Full suite command | `npx jest --ci` + `npx tsc --noEmit` + `npx expo lint` |
| Estimated runtime | < 60 s total |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Sign in with seeded account opens shell; no sign-up on first run | manual (device, Expo Go) | — | ❌ manual-only (auth flows need live Firebase + device) |
| AUTH-02 | Session persists across restart | manual (device) | — | ❌ manual-only |
| AUTH-03 | Wrong credentials → inline error, stays on Sign In | unit (error mapping) + manual | `npx jest --ci src/auth/__tests__/errors-test.ts` | ❌ Wave 0 |
| NFR-01 | Every query carries a uid equality filter | unit | `npx jest --ci src/firebase/__tests__/queries-test.ts` | ❌ Wave 0 |
| NFR-03 | Integer cents only; money.ts formats `₱ 1,234.50`; parse ≤2 decimals | unit | `npx jest --ci src/lib/__tests__/money-test.ts` | ❌ Wave 0 |
| NFR-04 | Local YYYY-MM-DD; today() not UTC; monthRange correct | unit | `npx jest --ci src/lib/__tests__/dates-test.ts` | ❌ Wave 0 |
| NFR-05 | Expo Go compatibility; pinned versions | tool + manual | `npx expo-doctor` + device QR | ❌ tool |
| NFR-06 | Rules deployed; uid scoping rejects cross-account | manual (2 accounts) | — | ❌ manual-only (rules live server-side; verify via second test account per PITFALLS.md) |

### Sampling Rate

- **Per task commit:** `npx jest --ci --silent` (utils/errors/queries tests) — or `npx tsc --noEmit` for UI-only tasks
- **Per wave merge:** `npx jest --ci` + `npx tsc --noEmit` + `npx expo lint`
- **Phase gate:** Full suite green + expo-doctor clean + device checklist (below) before `/gsd-verify-work`

### Manual-Only Verifications (who validates what)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| First launch lands on Sign In (no sign-up UI) | AUTH-01 | Requires seeded Firebase project + Expo Go on device | Clear app data → scan QR → expect Sign In card with Email/Password/Sign in only; sign in with seeded default credentials → MainTabs |
| Session survives restart | AUTH-02 | Requires device + AsyncStorage native persistence | Sign in → kill app (swipe away) → reopen → Home shell without Sign In |
| Wrong credentials inline error | AUTH-03 | Live Firebase error codes | Enter wrong password → expect inline "Email or password is wrong", button re-enables, fields keep values |
| Cross-account rejection | NFR-06 | Rules evaluated server-side; needs 2 accounts with data | Seed/register a second test account; sign in as account A, confirm the app cannot read account B's data (and vice versa); no unscoped query ever succeeds |
| Expo Go compatibility | NFR-05 | Physical device (Android + iOS) | QR-load on both platforms; `npx expo-doctor` clean; no redbox on sign-in flow |
| Firebase config + rules + index deployed | NFR-06 | Console operations | Verify rules in console match backend-schema.md; composite index `entries: type ASC, date DESC` exists; default account `users/{uid}` has `isDefault: true` |

### Wave 0 Gaps

- [ ] `src/lib/__tests__/money-test.ts` — covers NFR-03 (format: `0 → ₱ 0.00`, `123456 → ₱ 1,234.56`, negative; parse: `"24.5" → 2450`, `"₱ 1,234.56"`, `"0.001"`/`"1.2.3"` → null, `"12" → 1200`)
- [ ] `src/lib/__tests__/dates-test.ts` — covers NFR-04 (today() is local; isValid rejects `2026-02-30`/`2026-13-01`; addDays across month boundary; monthRange Feb leap; compare lexicographic) — include a near-midnight case per PITFALLS.md Pitfall 7
- [ ] `src/auth/__tests__/errors-test.ts` — covers AUTH-03 (invalid-credential/wrong-password/user-not-found → "Email or password is wrong"; network-request-failed → default copy; non-Firebase errors → default copy)
- [ ] `src/firebase/__tests__/queries-test.ts` — covers NFR-01 (every builder's constraints include uid equality — inspect via query internals or emulator; see Open Question 3)
- [ ] Framework install: `npx expo install jest-expo jest @types/jest "--" --dev` + package.json jest preset + tsconfig types (Wave 0)

## Security Domain

> `security_enforcement: true` (config), ASVS L1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth email/password (`signInWithEmailAndPassword`) — Firebase-managed hashing/rate limits; uniform error copy ("Email or password is wrong") prevents account enumeration (EEP default ON) |
| V3 Session Management | yes | Firebase token lifecycle via `initializeAuth` + AsyncStorage persistence; `onAuthStateChanged` single source of truth; no client-side session storage beyond Firebase's own token format |
| V4 Access Control | yes | Firestore rules (backend-schema.md, deployed verbatim): uid scoping on every collection, `isDefault` immutable, create restricted to `isDefault == false`; client enforces NFR-01 uid filters |
| V5 Input Validation | yes | Client-side: email format + non-empty on Sign In (UI-SPEC); `money.ts`/`dates.ts` parsers as validation boundaries (Phase 3 consumers); rules validate `request.resource.data.uid == request.auth.uid` on create |
| V6 Cryptography | no | No client-side crypto — TLS + password hashing/peppering are Firebase-managed; never hand-roll (ASVS L1 satisfied by platform) |

### Known Threat Patterns for {stack: Expo RN + Firebase JS SDK}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-account data access via unscoped query (IDOR) | Information Disclosure / Tampering | uid equality filter in every query (NFR-01, `queries.ts`) + rules keyed on `request.auth.uid`; verify with a second account (PITFALLS.md Pitfall 1) |
| Account enumeration via sign-in errors | Information Disclosure | Uniform "Email or password is wrong" for invalid-credential/wrong-password/user-not-found (AUTH-03; EEP default) |
| Forged default account (`isDefault: true`) | Elevation of Privilege | Rules: create only with `isDefault == false`; update must preserve `isDefault` (immutability pattern `request.resource.data.isDefault == resource.data.isDefault`) |
| Offline write bypassing rules until sync | Tampering | Rules evaluated at sync; client always writes `uid` from `auth.currentUser.uid`; write promises caught and surfaced (Phase 2+; documented in PITFALLS.md Pitfall 2) |
| Float `amountCents` in Firestore | Tampering / Integrity | Integer-cents domain rule (NFR-03); recommended rule hardening: `request.resource.data.amountCents is int` on entries create (Open Question 2) |
| API key / config exposure in bundle | Spoofing | Accepted Firebase model — API keys are public by design; protection is auth + rules, not key secrecy (docs.expo.dev/guides/using-firebase) |
| Default account deletion via crafted client | Denial of Service | Rules `allow delete` for own users doc; app-level guard blocks default-account delete UI (Phase 6); console admin can always delete — accepted design (backend-schema.md note) |

## Sources

### Primary (HIGH confidence — fetched/verified this session, 2026-08-06)
- expo docs "Using Firebase" (modificationDate 2026-07-17) — `npx expo install firebase`; firebase ≥12.0.0 required; JS SDK works in Expo Go; no extra plugins/polyfills. https://docs.expo.dev/guides/using-firebase/
- expo.fyi/firebase-js-auth-setup — `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` pattern for v10.3.0+ (raw file, github.com/expo/fyi). https://expo.fyi/firebase-js-auth-setup
- Expo `bundledNativeModules.json` (sdk-57 branch) — async-storage **2.2.0**, screens ~4.26.0, safe-area-context ~5.7.0, react 19.2.3, RN 0.86.2, jest-expo ~57.0.3, eslint-config-expo ~57.0.1. https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json
- expo-template-blank-typescript (main) — package.json (deps + typescript ~6.0.3), tsconfig.json (expo/tsconfig.base + strict), app.json (userInterfaceStyle light, predictiveBackGestureEnabled false), index.ts (registerRootComponent). https://raw.githubusercontent.com/expo/expo/main/templates/expo-template-blank-typescript/
- `create-expo-app@latest --help` (run locally) — templates incl. blank-typescript; `--no-agents-md` flag; `-y`, `--no-install` options
- expo docs "Unit testing with Jest" (modificationDate 2026-06-30) — jest-expo preset, Windows `"--" --dev` install syntax, tsconfig types, @testing-library/react-native replacing react-test-renderer. https://docs.expo.dev/develop/unit-testing/
- expo docs "Using ESLint and Prettier" (modificationDate 2026-06-11) — `npx expo lint` creates eslint.config.js flat config with eslint-config-expo. https://docs.expo.dev/guides/using-eslint/
- reactnavigation.org Getting started (7.x, docs updated 2026-07-18) — install commands; `npx expo install react-native-screens react-native-safe-area-context`; static vs dynamic config; Expo Go path needs no Android manifest edits. https://reactnavigation.org/docs/getting-started
- firebase-js-sdk source (master): `packages/auth/src/core/strategies/email_and_password.ts` — signInWithEmailAndPassword behavior + `auth/invalid-credential` under Email Enumeration Protection; `packages/auth/src/core/auth/auth_impl.ts` — persistence init, onAuthStateChanged ordering. https://raw.githubusercontent.com/firebase/firebase-js-sdk/master/packages/auth/src/core/strategies/email_and_password.ts
- npm registry (run live 2026-08-06) — versions: expo 57.0.11, firebase 12.17.1, @react-navigation/native 7.3.15, native-stack 7.18.7, bottom-tabs 7.18.15, async-storage 3.1.1 (latest) / 2.2.0 (pin, created 2020-10-21, no postinstall), screens 4.26.2, safe-area-context 5.8.1, expo-template-blank-typescript 57.0.13, create-expo-app 4.0.0
- Project docs (read in full): CONTEXT.md, UI-SPEC.md (approved), backend-schema.md (rules/index), tech-design.md, design-brief.md (money format `₱ 1,234.50`), STACK.md (AGENTS.md), PITFALLS.md, ARCHITECTURE.md, REQUIREMENTS.md, STATE.md, .planning/config.json

### Secondary (MEDIUM confidence)
- Context7 library index (search API, live) — react-navigation docs library current (2026-07-18, trustScore 9.7); used to confirm v7 doc recency. https://context7.com/api/v1/search
- `gsd-tools query package-legitimacy check` (live) — 9 npm packages; all SUS with reason "too-new" only (recency heuristic on canonical packages; downloads 4.8M–9.1M/wk; no postinstall scripts)

### Tertiary (LOW confidence)
- None — no training-data-only claims were load-bearing; all [ASSUMED] items are listed in the Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified against npm registry + Expo bundledNativeModules.json + official docs today; install commands from expo/react-navigation docs
- Architecture: HIGH — patterns from expo.fyi, reactnavigation.org, firebase-js-sdk source; project structure from CONTEXT + UI-SPEC + PITFALLS.md
- Pitfalls: HIGH — PITFALLS.md research fetched 2026-08-06 (rules-not-filters, UTC dates, Intl variance) + new discoveries this session (create-expo-app AGENTS.md overwrite, auth/invalid-credential, async-storage pin); A1–A7 assumptions flagged separately

**Research date:** 2026-08-06
**Valid until:** 2026-09-05 (30 days — SDK 57 is current; next Expo SDK expected ~Sep/Oct 2026, which would change bundled pins)
