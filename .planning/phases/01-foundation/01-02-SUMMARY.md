---
phase: 01-foundation
plan: 01-02
subsystem: auth
tags: [react-native, expo, firebase-auth, react-navigation, error-mapping, context, bottom-tabs]

# Dependency graph
requires:
  - phase: 01-01
    provides: Firebase singletons (app/auth/db), design tokens, jest-expo infra, App.tsx gate skeleton
provides:
  - AUTH-03 error mapper (src/auth/errors.ts) — 3 credential codes -> locked copy, unit-tested
  - AuthProvider context { user, initializing, signIn } + useAuth() — single onAuthStateChanged subscriber
  - Full UI-SPEC Sign In screen (card, Money title, Email+Password, inline error, submit lifecycle, keyboard flow)
  - LoadingScreen (centered ActivityIndicator on background, no branding)
  - 5-tab text-only shell (Home/Expenses/Income/Categories/Account) + PlaceholderScreen + 5 wrapper screens
  - Auth-gated root stack: SafeAreaProvider > AuthProvider > RootNavigator (Loading outside NavigationContainer / SignIn / MainTabs)
affects: [01-03, phases 2-6 — screens and tabs filled in later phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [AuthProvider context pattern, conditional root stack (Pattern 2), auth error -> locked copy mapping, label-only tab bar]

key-files:
  created: [src/auth/errors.ts, src/auth/__tests__/errors-test.ts, src/auth/AuthProvider.tsx, src/screens/LoadingScreen.tsx, src/screens/SignInScreen.tsx, src/screens/MainTabs.tsx, src/screens/PlaceholderScreen.tsx, src/screens/HomeScreen.tsx, src/screens/ExpensesScreen.tsx, src/screens/IncomeScreen.tsx, src/screens/CategoriesScreen.tsx, src/screens/AccountScreen.tsx]
  modified: [App.tsx, src/theme/tokens.ts]

key-decisions:
  - "Auth functions import from @firebase/auth (RN build), not firebase/auth umbrella — 01-01's verified working pattern; app.ts singleton import discipline maintained"
  - "tokens.ts typography marked `as const` so weight literals ('400'/'700') satisfy TextStyle['fontWeight'] without casts"
  - "Focused input border uses accent token per UI-SPEC Input treatment; error Text renders only when non-null with accessibilityRole='alert'"
  - "signIn in AuthProvider does not catch — SignInScreen maps errors via authErrorMessage (error copy stays in one module)"

patterns-established:
  - "Auth gate: root conditional stack renders purely from AuthProvider context; no manual navigation on success or failure"
  - "Error mapping: all auth failures funnel through authErrorMessage; screens never render raw error objects"
  - "Tab shell stability: wrapper screens exist so the 5-tab structure never changes as phases fill them in"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

coverage:
  - id: D1
    description: "AUTH-03 error mapper — auth/invalid-credential, auth/wrong-password, auth/user-not-found -> 'Email or password is wrong'; all other Firebase and non-Firebase errors -> default copy; pure (no logging)"
    requirement: AUTH-03
    verification:
      - kind: unit
        ref: "src/auth/__tests__/errors-test.ts#authErrorMessage (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sign In screen per UI-SPEC (card composition, copy contract, disabled/enabled/submitting states, inline error lifecycle, keyboard flow, accessibility) and AUTH-01 no-signup gate rendering"
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "npx tsc --noEmit && npx jest --ci --silent && npx expo export --platform android"
        status: pass
    human_judgment: true
    rationale: "Visual/UX contract and on-device interaction (keyboard avoidance, focus flow, error announcement) require Expo Go device verification with real Firebase credentials"
  - id: D3
    description: "5-tab text-only shell (Home, Expenses, Income, Categories, Account) with 'Coming soon' placeholders, tokens-only styling"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit && npx jest --ci --silent && npx expo export --platform android"
        status: pass
    human_judgment: true
    rationale: "Tab bar look/feel (label-only, no icons, safe-area inset) needs visual device check per UI-SPEC"
  - id: D4
    description: "AUTH-02 session survives app restart — reopening lands on shell without signing in again"
    requirement: AUTH-02
    verification: []
    human_judgment: true
    rationale: "Backstop requiring device + real Firebase credentials (config insertion deferred in 01-01 checkpoint); code path verified structurally (LoadingScreen while initializing, AsyncStorage persistence wired in 01-01)"

# Metrics
duration: 19min
completed: 2026-08-06
status: complete
---

# Phase 01 Plan 02: Auth Gate & Sign In Summary

**Full auth gate: AUTH-03 error mapper (unit-tested), AuthProvider context, UI-SPEC Sign In screen, LoadingScreen, and 5-tab text-only shell — SignIn ↔ MainTabs swapped purely by onAuthStateChanged**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-06T16:28:23Z
- **Completed:** 2026-08-06T16:47:00Z
- **Tasks:** 3 (Task 1 TDD: RED+GREEN; Tasks 2-3 feat)
- **Files modified:** 14 (12 created, 2 modified)

## Accomplishments
- AUTH-03 mapper: `authErrorMessage(error: unknown): string` — 3 credential codes → locked copy "Email or password is wrong" (no email-existence leak, EEP-safe); every other Firebase code and all non-Firebase input → "Couldn't sign in. Check your connection and try again."; pure — no console output (spy-asserted). 8 unit tests green.
- `AuthProvider` context `{ user, initializing, signIn }` + `useAuth()` (throws outside provider) — the only `onAuthStateChanged` subscriber; first emission flips `initializing` (no Sign In flash over restored session); `signIn` wraps `signInWithEmailAndPassword` without catching.
- SignInScreen implements the full UI-SPEC contract: centered card (surface, hairline border, radius 8, padding 24), "Money" 28/700 title, Email (`email-address`/`next`→Password focus) + Password (`secureTextEntry`/`go`+`onSubmitEditing` submits), inline error below Password (danger, `accessibilityRole="alert"`), full-width 48px accent button — disabled (opacity 0.5) when either field empty or submitting, "Signing in…" in-flight label, fields keep values on error, focus-ring border via accent token, `accessibilityLabelledBy` label linking, KeyboardAvoidingView (iOS padding only). No spinner component, no password toggle, no create-account affordance (AUTH-01).
- App.tsx: SafeAreaProvider > AuthProvider > StatusBar(dark) + RootNavigator — conditional native-stack (LoadingScreen outside NavigationContainer / SignIn / MainTabs), headerShown false, zero manual navigation.
- MainTabs: bottom-tabs v7 with exactly 5 label-only tabs (Home, Expenses, Income, Categories, Account), accent/textSecondary tints, surface bg + border top, 14px labels, no icons; all five render PlaceholderScreen ("Coming soon" 16/400 textSecondary centered).
- Verified: `npx jest --ci --silent` 11/11, `npx tsc --noEmit` 0, `npx expo lint` clean, `npx expo export --platform android` bundles.

## Task Commits

1. **Task 1 RED: failing auth error mapping tests** - `980f7e7` (test)
2. **Task 1 GREEN: auth error mapping** - `e2fa1d6` (feat)
3. **Task 3: 5-tab shell with placeholder screens** - `a144d2e` (feat)
4. **Task 2: AuthProvider, Sign In screen and auth-gated root stack** - `69a50bf` (feat)

**Plan metadata:** `docs(01-02): complete auth gate plan` (final commit)

_Note: TDD task produced test → feat pair; Task 3 executed before Task 2 (see Deviations)._

## Files Created/Modified
- `src/auth/errors.ts` - Pure FirebaseError → locked-copy mapper (AUTH-03)
- `src/auth/__tests__/errors-test.ts` - 8 unit tests (7 behavior cases incl. purity spy)
- `src/auth/AuthProvider.tsx` - AuthContext { user, initializing, signIn }, useAuth() guard
- `src/screens/LoadingScreen.tsx` - Centered ActivityIndicator on background, no branding
- `src/screens/SignInScreen.tsx` - Full UI-SPEC sign-in card with submit lifecycle
- `src/screens/MainTabs.tsx` - bottom-tabs 5-tab label-only shell
- `src/screens/PlaceholderScreen.tsx` - Centered "Coming soon" (body/400/textSecondary)
- `src/screens/{Home,Expenses,Income,Categories,Account}Screen.tsx` - Thin wrappers → PlaceholderScreen
- `App.tsx` - SafeAreaProvider > AuthProvider > RootNavigator conditional stack (replaces 01-01 skeleton leaf views)
- `src/theme/tokens.ts` - `as const` on typography (weight literals assignable to TextStyle)

## Decisions Made
- **@firebase/auth imports** — auth functions import from `@firebase/auth` (RN build), per 01-01's verified working pattern (umbrella `firebase/auth` dropped the RN condition); `auth` singleton still imported from `../firebase/app` (import order load-bearing)
- **tokens `as const`** — typography weight strings need literal types for `fontWeight` assignment; token file remains single source of truth
- **Error copy centralized** — `signIn` propagates errors; SignInScreen maps via `authErrorMessage` only, keeping all AUTH-03 copy in one unit-tested module
- **No toast/snackbar on success** — gate swap is the only feedback (UI-SPEC Interaction §1)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2 executed after Task 3 (order swap)**
- **Found during:** Task 2 (AuthProvider + gate)
- **Issue:** Task 2's `<verify>` runs `tsc`/`jest`/`expo export` on App.tsx, which imports `MainTabs` — a file only Task 3 creates. Executing in plan order would fail Task 2's own verification gate.
- **Fix:** Executed Task 3 (MainTabs + placeholders) before Task 2 so every commit is independently green; commit messages and scope unchanged.
- **Files modified:** none extra (execution order only)
- **Verification:** each commit's suite green; final full suite 11/11
- **Committed in:** `a144d2e` (Task 3) precedes `69a50bf` (Task 2)

**2. [Rule 3 - Type] tokens.ts typography needs `as const`**
- **Found during:** Task 3 (PlaceholderScreen styling)
- **Issue:** `typography.body.weight` inferred as `string`, not assignable to `TextStyle["fontWeight"]` under strict TS.
- **Fix:** Added `as const` to the typography object in `src/theme/tokens.ts`; all token values unchanged (smoke-test contract still passes).
- **Files modified:** src/theme/tokens.ts
- **Verification:** `npx tsc --noEmit` clean
- **Committed in:** `a144d2e` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 3)
**Impact on plan:** Both are execution/type-level fixes with no scope creep; plan's contracts (UI-SPEC, AUTH-01/02/03, token discipline) implemented exactly as specified.

## TDD Gate Compliance
- RED gate: `980f7e7 test(01-02): add failing tests for auth error mapping` — suite failed (module missing) before implementation ✓
- GREEN gate: `e2fa1d6 feat(01-02): implement auth error mapping` — 8/8 pass after implementation ✓
- No REFACTOR commit needed — implementation is minimal and already clean.

## Issues Encountered
- None — all three tasks completed on first pass; only the two documented deviations above.

## User Setup Required

**Firebase console (deferred, carried from 01-01):**
- Real `firebaseConfig` values into `src/firebase/config.ts` (currently PLACEHOLDER strings)
- Deploy `deploy/firestore.rules` + composite index + seed default account (01-03 plan Task 3)

## Next Phase Readiness
- Sign-in flow complete and unit-verified; 5-tab shell ready for Phase 2 (Home) and Phase 3 (Entries) screen fill-ins
- 01-03 (money/dates/queries/rules) can proceed in parallel — no shared files
- Device checklist for AUTH-01/02/03 (incl. keyboard-avoidance backstop) remains gated on real Firebase credentials + Expo Go on the phone
- `src/auth/errors.ts` is the only consumer-ready contract for any future auth-facing error UI

## Self-Check: PASSED
- All 14 key files exist on disk (12 created, 2 modified) ✓
- All 5 commits present in git log: `980f7e7` (RED), `e2fa1d6` (GREEN), `a144d2e` (Task 3), `69a50bf` (Task 2), `8e95ee2` (docs) ✓
- Full suite re-verified post-commit: jest 11/11, tsc clean, expo lint clean, expo export bundles ✓
- STATE.md / ROADMAP.md / config.json untouched (orchestrator-owned) ✓

---
*Phase: 01-foundation*
*Completed: 2026-08-06*
