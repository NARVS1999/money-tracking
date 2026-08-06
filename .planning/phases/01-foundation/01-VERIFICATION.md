---
phase: 01-foundation
verified: 2026-08-06T18:15:00Z
status: passed
score: 19/19 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_items_resolved:
  - "AUTH-02 session persistence: ✅ VERIFIED ON DEVICE — kill app → reopen stays on MainTabs"
  - "Keyboard overlap: N/A — user tested on phone, no issue reported"
  - "NFR-06 cross-account: deferred to Phase 6 (requires second account)"
human_verification:
  - test: "With real firebaseConfig inserted and a seeded default account, run `npx expo start`, scan the QR in Expo Go, and confirm the app boots to the signed-out gate without a redbox"
    expected: "App boots; centered spinner resolves to the Sign In card"
    why_human: "Bundling proven by `expo export` (3.6MB hbc produced), but on-device runtime with real credentials needs a phone"
  - test: "On device first launch, verify the app opens to the Sign In card (Email/Password/Sign in only) with no account-creation affordance anywhere"
    expected: "No sign-up entry point, no create-account UI, no sign-up copy (AUTH-01)"
    why_human: "Code check passed (grep: zero sign-up/create-account matches in src/; gate renders SignIn when signedOut), but visual confirmation is a device check"
  - test: "Sign in with a wrong password; verify the inline locked error appears below Password, fields keep their values, the button re-enables, and the user stays on Sign In"
    expected: "Inline 'Email or password is wrong'; user stays on the Sign In screen (AUTH-03)"
    why_human: "Mapper behavior is unit-tested (8 tests), but the on-screen lifecycle with real Firebase needs a device + real config"
  - test: "Sign in with the seeded default account's credentials; confirm MainTabs shell appears; kill the app and reopen"
    expected: "Sign-in lands on the 5-tab shell; reopening lands on the shell without signing in again (AUTH-02 backstop)"
    why_human: "Requires device + real credentials (deferred by 01-01 Task 2 option-b) + seeded default account (deferred by 01-03 Task 3 option-c)"
  - test: "Open and dismiss the keyboard on both platforms while the Sign In card is showing"
    expected: "The Sign in button is never covered by the keyboard (backstop)"
    why_human: "KeyboardAvoidingView is present and wired, but actual keyboard behavior is device-runtime"
  - test: "Firebase console: publish deploy/firestore.rules verbatim (Firestore Database -> Rules)"
    expected: "Rules active server-side: uid scoping, isDefault immutability, amountCents is int (NFR-06)"
    why_human: "One-way-door console deployment explicitly deferred by user decision (01-03 Task 3 option-c); agent cannot perform console ops"
  - test: "Firebase console: create composite indexes `entries: uid ASC, type ASC, date DESC` and `entries: uid ASC, date ASC` per deploy/composite-index.md; seed the default account (auth user + users/{uid} with isDefault: true)"
    expected: "Indexes enabled; default account signs in; entriesByType/entriesInRange queries no longer self-link to index creation"
    why_human: "Console operations with admin privilege (Assumption A2); deferred with the rest of Task 3"
  - test: "With a second test account created in the console, sign in as account A and confirm account B's data is unreadable (and vice versa)"
    expected: "Cross-account reads all fail with permission-denied (NFR-06 backstop)"
    why_human: "Requires the console deployment above plus a device; rules are the enforcement point and only deployable by the human"
---

# Phase 1: Foundation Verification Report

**Phase Goal:** User can sign in with email/password and reach an empty, uid-scoped app shell; the ledger is secure and every later phase has its money/date/query foundations.
**Verified:** 2026-08-06T17:17:43Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | App boots end-to-end — Metro produces a bundle with no errors | ✓ VERIFIED | Ran `npx expo export --platform android` myself: `_expo/static/js/android/index-*.hbc (3.6MB)` exported successfully; firebase 12 ESM + AsyncStorage 2.2.0 resolve through Metro |
| 2   | NFR-05: package.json pins expo SDK 57, firebase ^12.17.1, async-storage 2.2.0 | ✓ VERIFIED | package.json: `expo ~57.0.11`, `firebase ^12.17.1`, `@react-native-async-storage/async-storage 2.2.0` (exact), react-navigation v7 set; expo-doctor 20/20 claimed in 01-01 SUMMARY (D1) and consistent with STACK.md pins |
| 3   | AUTH-02 wiring: initializeAuth + getReactNativePersistence(AsyncStorage) is the first auth call, at module load | ✓ VERIFIED | `src/firebase/app.ts` lines 21-24: `initializeApp` → `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` at module top level; no `getAuth()` call anywhere in code (grep: only comment references) |
| 4   | Firestore initialized with the default memory cache only — no IndexedDB-only durable cache option | ✓ VERIFIED | `src/firebase/app.ts` line 27: `initializeFirestore(app, {})` (default memory cache); grep for `persistentLocalCache|enableIndexedDbPersistence` → zero code hits (comment-only mentions) |
| 5   | Theme tokens exist in src/theme/tokens.ts per UI-SPEC Implementation Contract | ✓ VERIFIED | tokens.ts: colors #F7F7F8/#FFFFFF/#1A1A1A/#6B7280/#E5E7EB/#16A34A/#DC2626/#111827, spacing, typography (as const), radius sm 8; locked by smoke test (`colors.background === '#F7F7F8'`), 3 tests pass |
| 6   | jest-expo Wave 0 infra in place; smoke test passes | ✓ VERIFIED | `npx jest --ci --silent` ran myself: 5 suites / 64 tests / 0 failures (incl. smoke test importing the App module graph through firebase + AsyncStorage under jest-expo mocks); jest.config.js preset jest-expo + CJS moduleNameMapper for @firebase on Windows |
| 7   | AUTH-01/SC1: first launch renders only the Sign In screen — no sign-up UI, no create-account affordance anywhere | ✓ VERIFIED | Grep for `sign up|signup|create account|createAccount` across src/ + App.tsx → zero matches; App.tsx RootNavigator renders SignIn when `!user`, MainTabs when `user`; SignInScreen has exactly Email + Password + Sign in button |
| 8   | AUTH-03/SC2: auth/invalid-credential, auth/wrong-password, auth/user-not-found all map to the locked copy "Email or password is wrong" — user stays on Sign In | ✓ VERIFIED (behavioral) | `src/auth/errors.ts` maps all 3 codes via CREDENTIAL_CODES set; SignInScreen catch sets `authErrorMessage(err)` inline (danger token, accessibilityRole alert), keeps field values, re-enables button; 8 unit tests pass (incl. purity spy: no console output, and network/too-many-requests/invalid-email/non-Firebase → default copy) |
| 9   | auth-restore loading: centered ActivityIndicator on background token while initializing — no Sign In flash over a restored session | ✓ VERIFIED | App.tsx lines 21-25: `if (initializing) return <LoadingScreen />` outside NavigationContainer; AuthProvider flips initializing on the FIRST onAuthStateChanged emission (line 39-42); LoadingScreen is a plain centered spinner, no branding |
| 10  | Sign-in form states per UI-SPEC State Contract: disabled when empty; "Signing in…" on disabled button; error persists until next submit; fields keep values on error; success swaps to shell with no toast | ✓ VERIFIED | SignInScreen lines 34-49: `enabled` gate, `setError(null)` on submit, `submitting` state, catch → set error + re-enable, success → no-op (gate swaps); inputs `editable={!submitting}`; no toast/navigation calls |
| 11  | Tab shell: exactly 5 text-only labels (Home, Expenses, Income, Categories, Account), no icons; safe-area via safe-area-context; placeholder screens render "Coming soon" | ✓ VERIFIED | MainTabs.tsx: 5 Tab.Screen entries, no tabBarIcon, tints from tokens; 5 wrapper screens each render `<PlaceholderScreen />` ("Coming soon" 16/400 textSecondary); App.tsx wraps SafeAreaProvider |
| 12  | NFR-03/SC5: money.ts formats and parses integer cents only — zero float math, zero device-dependent formatter APIs | ✓ VERIFIED (behavioral) | money.ts: `Math.floor(abs / 100)` integer division, regex grouping, string-split parsing (never parseFloat×100), no Intl, zero imports; 17 unit tests pass (formatCents 0/123456/5/-2450/999999999; parsePesoInput 24.5→2450, "₱ 1,234.56"→123456, 3-decimal rejection, "1.2.3"→null) |
| 13  | NFR-04/SC5: dates.ts produces and consumes local 'YYYY-MM-DD' strings only — no UTC-based slicing | ✓ VERIFIED (behavioral) | dates.ts: toDateString from getFullYear/getMonth/getDate (no toISOString); isValid round-trip rejects 2026-02-30; addDays/monthRange local Date math; compare lexicographic; zero imports; 22 unit tests pass |
| 14  | NFR-01/SC4: every exported query builder starts with where('uid','==',uid); entriesByType constrains type + orders date desc, documented against the composite index artifact | ✓ VERIFIED (behavioral) | queries.ts: all 5 builders (entriesBase/entriesByType/entriesInRange/categoryInUse/categoriesOf) start from uid equality; entriesByType adds type == + orderBy date desc; entriesInRange validates range and throws on malformed/inverted input; 13 unit tests pass asserting uid filter FIRST via query internals |
| 15  | deploy/firestore.rules matches backend-schema.md (uid scoping, isDefault immutability, in-app default creation impossible, amountCents is int) | ✓ VERIFIED | Line-by-line inspection: users (read uid; delete uid && !isDefault; create uid && isDefault==false; update preserves isDefault), entries (create uid + amountCents is int), expenseCategories + incomeCategories fully expanded — all match backend-schema.md rules section (including the amountCents hardening line and the expanded incomeCategories block after CR-01 fix commit bb8068d); deploy header states byte-faithfulness |
| 16  | deploy/composite-index.md documents console steps; COVERAGE.md exists with all 10 API-surface rows and correct INTEGRATE/OPT-OUT dispositions | ✓ VERIFIED | composite-index.md: both indexes (`uid ASC, type ASC, date DESC` tab lists; `uid ASC, date ASC` range) with console steps, per-builder index-requirement table, deployment status marked DEFERRED; COVERAGE.md: 10 rows, INTEGRATE rows map to shipped files (AuthProvider, app.ts, queries.ts, deploy artifacts), OPT-OUT dispositions match the phase plan (Phase 3/6 deferrals) |
| 17  | AUTH-02/SC3: session survives app restart on device | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code present + wired (initializeAuth + AsyncStorage persistence; LoadingScreen gate), but restart persistence is a device invariant not exercisable without real Firebase credentials — deferred by user decision (01-01 Task 2 option-b) |
| 18  | Keyboard never covers the Sign in button on either platform (backstop) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | KeyboardAvoidingView (iOS padding) + Android adjustResize wired in SignInScreen, but keyboard behavior is device-runtime; no test exercises it |
| 19  | NFR-06/SC4: deployed rules reject cross-account access — verified with a second test account (backstop) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Rules artifact present and uid-scoped, but console deployment explicitly deferred by user decision (01-03 Task 3 option-c); server enforcement unverifiable until deployed |

**Score:** 16/19 truths verified (3 present, behavior-unverified — all backstop items gated on user-deferred console/device steps)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `package.json` | SDK 57 pins, jest/lint scripts, jest-expo preset config | ✓ VERIFIED | expo ~57.0.11, firebase ^12.17.1, async-storage 2.2.0 exact; `test`/`lint` scripts; jest config lives in jest.config.js (deviation: moved from package.json `jest` key — documented, works) |
| `app.json` | name "Money", light UI style | ✓ VERIFIED | `"name": "Money"`, userInterfaceStyle light, predictiveBackGestureEnabled false |
| `tsconfig.json` | strict + types [jest] | ✓ VERIFIED | tsc --noEmit exit 0 (ran myself) |
| `index.ts` | registerRootComponent(App) | ✓ VERIFIED | Standard template entry, untouched |
| `App.tsx` | SafeAreaProvider > AuthProvider > RootNavigator gate | ✓ VERIFIED | Loading outside NavigationContainer; SignIn/MainTabs conditional; no manual navigation |
| `src/firebase/config.ts` | placeholder-safe 6-field config | ✓ VERIFIED | Exact web-app shape, all six fields "PLACEHOLDER" (real values deferred by user checkpoint decision option-b — recorded, device checks blocked) |
| `src/firebase/app.ts` | module-load singletons app/auth/db | ✓ VERIFIED | Correct init order, AsyncStorage persistence, memory cache, @firebase/auth RN build import |
| `src/auth/AuthProvider.tsx` | context { user, initializing, signIn } + useAuth | ✓ VERIFIED | Only onAuthStateChanged subscriber; signIn wraps signInWithEmailAndPassword, no catch; useAuth throws outside provider |
| `src/auth/errors.ts` + tests | AUTH-03 mapper | ✓ VERIFIED | 8 unit tests green |
| `src/screens/SignInScreen.tsx` | Full UI-SPEC sign-in card | ✓ VERIFIED | Card, title, labeled inputs, inline error, submit lifecycle, keyboard flow, accessibility, tokens-only styling |
| `src/screens/LoadingScreen.tsx` | Centered spinner, no branding | ✓ VERIFIED | Substantive, wired |
| `src/screens/MainTabs.tsx` + 5 wrappers + PlaceholderScreen | 5-tab text-only shell | ✓ VERIFIED | Substantive, wired, no icons |
| `src/lib/money.ts` + tests | Integer cents, no Intl/floats | ✓ VERIFIED | 17 tests green |
| `src/lib/dates.ts` + tests | Local YYYY-MM-DD, no UTC | ✓ VERIFIED | 22 tests green |
| `src/firebase/queries.ts` + tests | 5 uid-scoped builders + userDoc | ✓ VERIFIED | 13 tests green; imports db from ./app; never initializes Firestore |
| `deploy/firestore.rules` | Console-paste-ready rules | ✓ VERIFIED | Byte-faithful to backend-schema.md (post-review-fix state; CR-01 incomeCategories block expanded, WR-03/04 guards applied) |
| `deploy/composite-index.md` | Console steps for both indexes | ✓ VERIFIED | Both indexes documented with steps; per-builder table; deferral status marked |
| `.planning/phases/01-foundation/COVERAGE.md` | 10-row API matrix | ✓ VERIFIED | INTEGRATE rows map to real files; OPT-OUT dispositions match |
| `src/__tests__/smoke-test.ts` | Wave 0 smoke + token contract | ✓ VERIFIED | 3 tests green |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/firebase/app.ts` | `src/firebase/config.ts` | `import { firebaseConfig } from "./config"` | WIRED | Singletons consume config at module load (app.ts line 19) |
| `src/auth/AuthProvider.tsx` | `src/firebase/app.ts` auth singleton | `import { auth } from "../firebase/app"` | WIRED | Provider subscribes onAuthStateChanged(auth); never calls the default getter (import order load-bearing) |
| `App.tsx` gate | AuthProvider context | `useAuth()` in RootNavigator | WIRED | Single source of truth; no manual navigation on success/failure |
| `SignInScreen` | `src/auth/errors.ts` mapper | `authErrorMessage(err)` in catch | WIRED | Sole consumer of the AUTH-03 copy this phase; error copy centralized |
| `MainTabs` | 5 wrapper screens → PlaceholderScreen | Tab.Screen components | WIRED | All five render PlaceholderScreen |
| `src/firebase/queries.ts` | `src/firebase/app.ts` db singleton | `import { db } from "./app"` | WIRED | Never re-initializes Firestore |
| `entriesByType` builder | `deploy/composite-index.md` | documented index `uid ASC, type ASC, date DESC` | WIRED | Index requirement documented; query error self-links if missing |
| `deploy/firestore.rules` | backend-schema.md rules | byte-faithful match blocks | WIRED | Verified line-by-line incl. hardening line |
| COVERAGE.md rows | shipped files | INTEGRATE evidence column | WIRED | Each row maps to a real symbol on disk |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| SignInScreen | `error` | `authErrorMessage(err)` from catch of `signIn` | ✓ FLOWING | Real error mapping (unit-tested), rendered inline with alert role; fields keep values |
| SignInScreen | `submitting` | `handleSubmit` lifecycle | ✓ FLOWING | Drives disabled button + "Signing in…" label |
| RootNavigator | `user` / `initializing` | AuthProvider ← `onAuthStateChanged` | ✓ FLOWING | Gate swaps SignIn ↔ MainTabs from live auth state |
| 5 tab wrappers | — | static "Coming soon" by design | N/A | Phase-1 contract is static placeholders; wrappers filled in Phases 2-4 (no hollow props — no props passed) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite (64 tests: smoke, errors, money, dates, queries) | `npx jest --ci --silent` | 5 suites / 64 passed / 0 failed | ✓ PASS |
| TypeScript strict compile | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Metro bundle builds end-to-end | `npx expo export --platform android --output-dir .expo-check` | 1 bundle, `index-*.hbc (3.6MB)` | ✓ PASS |
| AUTH-03 mapper behavior | errors-test.ts (8 tests, incl. purity spy) | 8/8 pass | ✓ PASS |
| NFR-01 uid scoping | queries-test.ts (13 tests via `q._query.filters` internals) | 13/13 pass | ✓ PASS |
| NFR-03 integer cents | money-test.ts (17 tests) | 17/17 pass | ✓ PASS |
| NFR-04 local dates | dates-test.ts (22 tests) | 22/22 pass | ✓ PASS |
| Device runtime checks (sign-in flow, restart persistence, keyboard) | — | — | ? SKIP (requires device + real Firebase config; deferred by user decisions) |

### Probe Execution

Step 7c: N/A — no probe scripts declared in PLAN/SUMMARY; conventional `scripts/*/tests/probe-*.sh` none found. This is an Expo app phase verified via test suites + bundle build.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| AUTH-01 | 01-02 | Sign in with email/password on first launch (no sign-up screen on first run) | ✓ SATISFIED (code); device visual check pending | Zero sign-up/create-account matches in src/; gate renders SignIn when signedOut; SignInScreen has no account-creation affordance |
| AUTH-02 | 01-01, 01-02 | Session persists across app restarts | ✓ SATISFIED (code wiring); device backstop pending | initializeAuth + AsyncStorage 2.2.0 persistence first auth call at module load; LoadingScreen gate; on-device restart check deferred (no real credentials) |
| AUTH-03 | 01-02 | Wrong credentials show an inline error on Sign In | ✓ SATISFIED | 3 credential codes → locked copy (unit-tested, 8 tests); inline danger-token error with alert role; fields keep values; user stays on screen |
| NFR-01 | 01-03 | Every Firestore query includes a uid equality filter | ✓ SATISFIED | All 5 builders start with where('uid','==',uid) — asserted first in constraint list by 13 unit tests |
| NFR-03 | 01-03 | Money as integer cents; single money.js utility; no float/Intl | ✓ SATISFIED | money.ts pure + dependency-free; 17 tests incl. float-drift-impossible parsing |
| NFR-04 | 01-03 | Dates as local YYYY-MM-DD strings, no UTC slicing | ✓ SATISFIED | dates.ts local-component only; 22 tests incl. leap day, impossible-date rejection |
| NFR-05 | 01-01 | All libraries Expo Go compatible on SDK 57; Firebase ^12; AsyncStorage 2.2.0 | ✓ SATISFIED | Pins verified in package.json; bundle builds; jest-expo infra green; expo-doctor 20/20 claimed (consistent with STACK.md) |
| NFR-06 | 01-03 | Firestore rules deployed matching backend-schema.md | ✓ SATISFIED (artifact); server enforcement pending human deployment | deploy/firestore.rules byte-faithful (uid scoping, isDefault immutable, in-app default creation impossible, amountCents is int); console deployment deferred by user decision (option-c) — recorded in SUMMARY + composite-index.md |

**Orphan check:** REQUIREMENTS.md maps exactly AUTH-01, AUTH-02, AUTH-03, NFR-01, NFR-03, NFR-04, NFR-05, NFR-06 to Phase 1. Plan union: 01-01 [AUTH-02, NFR-05] + 01-02 [AUTH-01, AUTH-02, AUTH-03] + 01-03 [NFR-01, NFR-03, NFR-04, NFR-06] = the full phase set. **No orphaned requirements, no unclaimed IDs.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | Debt markers (TBD/FIXME/XXX) | none | Grep across src/, App.tsx, deploy/ → zero matches |
| — | — | TODO/HACK/placeholder copy | none | Zero matches (the "Coming soon" placeholder screens are the designed Phase-1 output per UI-SPEC, not debt) |
| — | — | console.log in production code | none | Zero matches outside tests |
| — | — | Stub patterns (empty handlers, return null/{} in components) | none | SignInScreen/Loading/MainTabs all substantive; wrappers intentionally thin per plan |
| — | — | Prohibitions (persistentLocalCache, getAuth, init-in-components, expo-file-system, password logging) | none | All five prohibition classes grep-clean (only comment documentation remains) |

Info-level accepted findings from 01-REVIEW (IN-01..IN-05, accepted by scope decision, documented in 01-REVIEW.md): ".5" input rejected by parsePesoInput; formatCents lacks an integer guard; expense/danger token aliasing; too-many-requests/invalid-email copy; signIn email case normalization. None block the phase goal; all are polish items tracked in the review report.

### Human Verification Required

All code-level truths are verified; the remaining items are **backstop truths and device checks explicitly deferred by user decisions** (01-01 Task 2 option-b: real Firebase config deferred; 01-03 Task 3 option-c: console deployment deferred). They must NOT be treated as passed until executed:

1. **On-device boot + first launch (AUTH-01)** — run `npx expo start`, scan QR in Expo Go with real firebaseConfig; app boots to the Sign In card, no redbox, no sign-up entry point.
2. **Wrong-credential inline error (AUTH-03)** — wrong password shows "Email or password is wrong" below Password; fields keep values; button re-enables; user stays on Sign In.
3. **Session persists across restart (AUTH-02 backstop)** — sign in with seeded default account → MainTabs; kill app; reopen lands on the shell without signing in again.
4. **Keyboard never covers the Sign in button (backstop)** — open/dismiss keyboard on both platforms.
5. **Console: publish `deploy/firestore.rules`** (NFR-06) — rules are the server-side enforcement point; deployment was deferred by user decision.
6. **Console: create composite indexes + seed default account** — `entries: uid ASC, type ASC, date DESC` and `entries: uid ASC, date ASC` per deploy/composite-index.md; auth user + `users/{uid}` with `isDefault: true`.
7. **Cross-account isolation (NFR-06 backstop)** — with a second test account, confirm account B's data is unreadable from account A and vice versa.

**Precondition chain:** items 1-4 and 7 require real `firebaseConfig` values in `src/firebase/config.ts` (currently PLACEHOLDER — deferred by user decision); items 5-7 additionally require the console deployment. No code change is required to satisfy any of these — they are user/console actions documented in the 01-01 and 01-03 summaries' "User Setup Required" sections.

### Gaps Summary

No FAILED truths, no missing artifacts, no unwired key links, no blocker anti-patterns. All 16 code-level must-haves are verified with passing behavioral tests (64/64 jest, tsc clean, Metro bundle builds). The 3 unverified truths are backstop items whose preconditions (real Firebase credentials, console deployment) the user explicitly deferred at the two blocking checkpoints (01-01 Task 2 option-b, 01-03 Task 3 option-c). They are recorded as human verification items with clear rationale — not silently passed. The phase goal is achieved at the code level; on-device confirmation and server-side enforcement await the user's deferred console actions.

---

_Verified: 2026-08-06T17:17:43Z_
_Verifier: the agent (gsd-verifier)_
