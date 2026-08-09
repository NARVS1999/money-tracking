---
slug: firestore-permission-denied
status: resolved
trigger: |
  Android Bundled 6326ms index.ts (1626 modules)
  ERROR  [2026-08-08T20:52:13.557Z]  @firebase/firestore: Firestore (12.17.0): Uncaught Error in snapshot listener: FirebaseError: [code=permission-denied]: Missing or insufficient permissions.
  (repeats on app reload)
created: 2026-08-09
updated: 2026-08-09
---

# Debug Session: firestore-permission-denied

## Symptoms

- Expected: App loads data normally — entries and categories render from Firestore with no console errors.
- Actual: Snapshot listener throws `FirebaseError: [code=permission-denied]: Missing or insufficient permissions.` on every app start (and on reload).
- Error: `@firebase/firestore: Uncaught Error in snapshot listener: FirebaseError: [code=permission-denied]: Missing or insufficient permissions.`
- Timeline: Worked before — this is a regression, not a first-run issue.
- User is signed in when the error occurs.
- Reproduction: Every app start / reload.
- The permission-denied error repeats on reload: `ERROR [2026-08-08T20:56:02.685Z] @firebase/firestore: Firestore (12.17.0): Uncaught Error in snapshot listener: FirebaseError: [code=permission-denied]: Missing or insufficient permissions.`
- Unrelated warning also present: `WARN SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead.` (ignore unless relevant).

## Current Focus

- hypothesis: users/{uid} read rule `resource.data.uid == request.auth.uid` always fails because no writer (or documented seed) ever sets a `uid` field on the users doc. The pre-existing denial was silent (getDoc in try/catch); the new isOnline onSnapshot (no error handler) surfaces it as "Uncaught Error in snapshot listener" on every boot.
- test: (pending — TDD: assert signUp setDoc payload includes the schema-required `uid` field; currently it does not)
- expecting: payload `{ uid: userCredential.user.uid, ... }` — test RED now
- next_action: write failing test, then fix signUp payload + rules/seed docs

## Evidence

- timestamp: 2026-08-09 — firestore.rules matches deploy/firestore.rules (byte-identical). users/{uid}: read requires `resource.data.uid == request.auth.uid`; create requires `request.resource.data.uid == request.auth.uid`.
- timestamp: 2026-08-09 — backend-schema.md declares users.uid field REQUIRED (string, "Firebase auth user id").
- timestamp: 2026-08-09 — AuthProvider.tsx signUp writes users doc WITHOUT uid: `{displayName, email, isDefault, createdAt}` (line 134).
- timestamp: 2026-08-09 — tech-design.md seed step ("users/{uid} doc with displayName and isDefault: true") also omits uid — the seeded default account doc lacks uid → every read denied.
- timestamp: 2026-08-09 — git: 38d100e (feat 06-02) added isOnline `onSnapshot(doc(db,"users",uid), {includeMetadataChanges})` with NO error handler — first uncaught listener hitting users/{uid}; getDoc in try/catch (silent) predates it. Matches regression timing.
- timestamp: 2026-08-09 — entries/expenseCategories/incomeCategories writes DO include uid (`uid: user.uid`) — only users docs are nonconforming.
- timestamp: 2026-08-09 — SafeAreaView deprecation warning: unrelated (not actionable in Expo Go; rib warning).

## Fix Applied

1. **src/auth/AuthProvider.tsx (signUp)** — users doc payload now includes `uid: userCredential.user.uid` (schema-required, backend-schema.md).
2. **firestore.rules + deploy/firestore.rules + backend-schema.md** — `users/{uid}` block now matches on the doc PATH (`request.auth.uid == uid`) instead of `resource.data.uid`. This heals the console-seeded default account (its doc has no `uid` field and cannot be migrated in-app — reads were denied before any write). Isolation semantics unchanged (NFR-06): delete still blocked for `isDefault`, create still requires `isDefault == false` for non-default.
3. **TDD test** — new `src/auth/__tests__/signup-users-doc-test.tsx` asserts the write contract (RED before fix: `payload.uid === undefined`; GREEN after).
- **Deployment action needed (human):** re-apply the updated rules in the Firebase console (`firestore.rules`) — the app-side fix alone is not sufficient until rules are redeployed; then reload the app.

## Resolution

- status: resolved
- root_cause: users/{uid} access rules keyed on a `resource.data.uid` field that no writer ever sets (in-app signUp omitted it; the console seed also omitted it). Every read of the users doc denied by rules; the phase-06 isOnline onSnapshot (no onError handler) turned the pre-existing silent denial into an uncaught "permission-denied" error on every boot. (Checkpoint: repo rules, backend-schema, and both writers/seed instructions confirmed the missing field; regression commit 38d100e.)
- fix: write `uid` into the signUp users doc AND re-key rules on the doc path `request.auth.uid == uid` across firestore.rules, deploy/firestore.rules, and backend-schema.md. Requires console rules redeploy (per project convention, console is the rules deployment path).
- fix_satisfies: signup-users-doc-test.tsx (uid write contract). Full suite: 106 passed; 2 failures (CategoriesScreen.test, smoke-test) pre-existing on the unmodified tree (jest env native-module issues, unrelated to this session).
- guardrail_verdict: passed
- blameless_postmortem: why not caught: no test asserted the users-doc write payload against the rules contract, and the rules are deployed verbatim via console (no emulator-based rules gate); existing getDoc read was silently try/caught so the denial was invisible until phase 06 added an unguarded listener. guard: new signup-users-doc test locks the write contract; rules/schema mirror kept byte-identical across firestore.rules / deploy/firestore.rules / backend-schema.md.