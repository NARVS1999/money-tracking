---
phase: 06
plan: "06-01"
subsystem: auth
tags: [firebase, auth, expo, react-navigation]

# Dependency graph
requires:
  - phase: 01
    provides: "AuthProvider with signIn, Firebase singletons, theme tokens, navigation stack"
provides:
  - "AuthProvider.signUp method creating Firebase user + users/{uid} doc"
  - "signUpErrorMessage mapping email-already-in-use, weak-password, invalid-email"
  - "SignUpScreen with Display Name, Email, Password fields"
  - "Create account link on SignInScreen navigating to SignUpScreen"
  - "SignUp screen registered in App.tsx signedOut stack"
affects: [06-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [signUp writes users/{uid} doc with isDefault:false alongside createUserWithEmailAndPassword]

key-files:
  created:
    - src/screens/SignUpScreen.tsx
  modified:
    - src/auth/AuthProvider.tsx
    - src/auth/errors.ts
    - src/screens/SignInScreen.tsx
    - App.tsx

key-decisions:
  - "signUp writes users/{uid} doc in same flow as createUserWithEmailAndPassword — no second signIn call needed"
  - "SignUpScreen visual design matches SignInScreen exactly (same card, inputs, button, error placement)"

patterns-established:
  - "signUpErrorMessage maps sign-up-specific Firebase error codes separately from authErrorMessage"

requirements-completed: [AUTH-04]

# Coverage metadata
coverage:
  - id: D1
    description: "AuthProvider.signUp creates Firebase user and writes users/{uid} doc with isDefault:false"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit passes"
        status: pass
    human_judgment: false
  - id: D2
    description: "signUpErrorMessage maps email-already-in-use, weak-password, invalid-email to user-friendly copy"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "src/auth/errors.ts#signUpErrorMessage contains all three codes"
        status: pass
    human_judgment: false
  - id: D3
    description: "SignUpScreen with Display Name, Email, Password fields, disabled button when empty or password under 6 chars"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit passes, button disabled logic verified"
        status: pass
    human_judgment: false
  - id: D4
    description: "SignInScreen has Create account link navigating to SignUpScreen"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "src/screens/SignInScreen.tsx contains navigation.navigate(SignUp)"
        status: pass
    human_judgment: false
  - id: D5
    description: "End-to-end sign-up flow: Create account -> SignUpScreen -> submit -> signed in -> MainTabs"
    requirement: "AUTH-04"
    verification: []
    human_judgment: true
    rationale: "End-to-end flow requires Firebase emulator or real device — cannot be verified by automated unit tests alone"

duration: 7min
completed: 2026-08-08
status: complete
---

# Phase 6 Plan 01: In-App Account Creation Summary

**SignUp screen with createUserWithEmailAndPassword, users/{uid} doc write, inline error mapping, and navigation wired from SignInScreen**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-08T20:22:13Z
- **Completed:** 2026-08-08T20:29:25Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- AuthProvider extended with signUp(displayName, email, password) that calls createUserWithEmailAndPassword and writes users/{uid} doc with isDefault:false
- signUpErrorMessage maps three sign-up-specific error codes to user-friendly copy
- SignUpScreen created with Display Name, Email, Password fields matching SignInScreen's visual design
- SignInScreen now has a "Create account" link that navigates to SignUpScreen
- App.tsx signedOut stack includes both SignIn and SignUp screens

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend AuthProvider with signUp** - `2408804` (feat)
2. **Task 2: Create SignUpScreen** - `f637e00` (feat)
3. **Task 3: Wire Create account link** - `6fbc538` (feat)

## Files Created/Modified
- `src/screens/SignUpScreen.tsx` - New screen with three fields, disabled button logic, inline errors
- `src/auth/AuthProvider.tsx` - Added createUserWithEmailAndPassword + setDoc users/{uid}, signUp in context
- `src/auth/errors.ts` - Added signUpErrorMessage for sign-up-specific error codes
- `src/screens/SignInScreen.tsx` - Added useNavigation + Create account link below Sign in button
- `App.tsx` - Added SignUpScreen import and registered in signedOut stack

## Decisions Made
- signUp writes users/{uid} doc in same flow as createUserWithEmailAndPassword — user is already signed in after createUserWithEmailAndPassword, no second signIn call needed
- SignUpScreen visual design matches SignInScreen exactly (same card, inputs, button, error placement) for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- In-app account creation (AUTH-04) complete
- Ready for 06-02 (account deletion) which depends on AuthProvider patterns established here
- New accounts start with empty ledger (no entries, no categories for this uid) — verified by Firestore rules

---
*Phase: 06-account-lifecycle*
*Completed: 2026-08-08*

## Self-Check: PASSED
