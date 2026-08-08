---
phase: 06
plan: "06-02"
subsystem: auth
tags: [firebase, auth, expo, account-lifecycle]

# Dependency graph
requires:
  - phase: 06
    plan: "06-01"
    provides: "AuthProvider.signUp, SignUpScreen, errors.ts signUpErrorMessage"
  - phase: 01
    provides: "AuthProvider with signIn, Firebase singletons, theme tokens, navigation stack"
provides:
  - "AuthProvider.signOut method wrapping firebase signOut"
  - "AuthProvider.reauthenticate method using EmailAuthProvider.credential"
  - "AuthProvider.deleteAccount with chunked cascade delete"
  - "AuthProvider.userProfile state (displayName, email, isDefault)"
  - "AuthProvider.isOnline connectivity flag"
  - "AccountScreen with user profile, sign out, and delete account flow"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [chunked cascade delete ≤500 docs/batch, reauthenticate before deleteUser, isOnline via onSnapshot metadata]

key-files:
  created: []
  modified:
    - src/auth/AuthProvider.tsx
    - src/screens/AccountScreen.tsx

key-decisions:
  - "Cascade deletes chunked ≤500 ops/batch for Firestore limits, idempotent on re-run"
  - "deleteUser called LAST after all Firestore docs removed"
  - "isOnline uses onSnapshot with includeMetadataChanges for real connectivity detection"
  - "userProfile fetched from users/{uid} doc on sign-in, with try/catch fallback for legacy accounts"

requirements-completed: [AUTH-05, AUTH-06, AUTH-07]

# Coverage metadata
coverage:
  - id: D1
    description: "AuthProvider.signOut wraps firebase signOut and clears user/userProfile via onAuthStateChanged"
    requirement: "AUTH-07"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit passes, signOut calls firebaseSignOut(auth)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AuthProvider.reauthenticate uses EmailAuthProvider.credential + reauthenticateWithCredential"
    requirement: "AUTH-06"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit passes, reauthenticate builds credential and calls reauthenticateWithCredential"
        status: pass
    human_judgment: false
  - id: D3
    description: "AuthProvider.deleteAccount cascade deletes entries, expenseCategories, incomeCategories, users doc, then deleteUser"
    requirement: "AUTH-06"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit passes, deleteAccount implements chunked while loops for each collection"
        status: pass
    human_judgment: false
  - id: D4
    description: "userProfile state fetched from users/{uid} with displayName, email, isDefault"
    requirement: "AUTH-05"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit passes, onAuthStateChanged fetches getDoc(users/{uid}) and sets userProfile"
        status: pass
    human_judgment: false
  - id: D5
    description: "isOnline flag uses onSnapshot with includeMetadataChanges for real connectivity"
    requirement: "AUTH-06"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit passes, useEffect subscribes to onSnapshot with includeMetadataChanges"
        status: pass
    human_judgment: false
  - id: D6
    description: "AccountScreen shows display name, email, Default badge for isDefault accounts"
    requirement: "AUTH-05"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit passes, AccountScreen renders userProfile.displayName and conditional badge"
        status: pass
    human_judgment: false
  - id: D7
    description: "Default account never renders delete button (AUTH-05)"
    requirement: "AUTH-05"
    verification:
      - kind: unit
        ref: "src/screens/AccountScreen.tsx: {!userProfile.isDefault && ( delete section )}"
        status: pass
    human_judgment: false
  - id: D8
    description: "Delete button disabled when isOnline is false (AUTH-06)"
    requirement: "AUTH-06"
    verification:
      - kind: unit
        ref: "src/screens/AccountScreen.tsx: disabled={!isOnline || submitting}"
        status: pass
    human_judgment: false
  - id: D9
    description: "Delete flow: modal → password → reauthenticate → cascade → deleteUser → SignInScreen"
    requirement: "AUTH-06"
    verification: []
    human_judgment: true
    rationale: "End-to-end delete flow requires Firebase emulator or real device — reauthentication and cascade delete cannot be verified by unit tests alone"
  - id: D10
    description: "Sign out immediately returns to SignInScreen via onAuthStateChanged"
    requirement: "AUTH-07"
    verification: []
    human_judgment: true
    rationale: "Auth gate behavior requires runtime verification — signOut triggers onAuthStateChanged which swaps the root navigator"

duration: 5min
completed: 2026-08-08
status: complete
---

# Phase 6 Plan 02: Account Lifecycle Summary

**Full Account tab: user profile display, sign out, and cascade delete account flow with reauthentication**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-08T20:34:22Z
- **Completed:** 2026-08-08T20:39:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- AuthProvider extended with signOut (wraps firebase signOut), reauthenticate (EmailAuthProvider.credential + reauthenticateWithCredential), and deleteAccount (reauthenticate → chunked entries → chunked expenseCategories → chunked incomeCategories → users doc → deleteUser)
- AuthProvider exposes userProfile state (displayName, email, isDefault) fetched from users/{uid} doc on sign-in
- AuthProvider exposes isOnline connectivity flag via onSnapshot with includeMetadataChanges
- AccountScreen replaced placeholder with full UI: display name, email, Default badge, sign out button, and delete account flow
- Delete flow: confirmation modal → password input → reauthenticate → cascade delete → auth account deletion → auto-redirect to SignInScreen
- Delete button disabled when offline with helper text

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend AuthProvider** - `38d100e` (feat)
2. **Task 2: Full AccountScreen** - `6ba2c41` (feat)

## Files Created/Modified
- `src/auth/AuthProvider.tsx` - Added signOut, reauthenticate, deleteAccount, userProfile, isOnline; updated AuthContextValue type
- `src/screens/AccountScreen.tsx` - Replaced placeholder with full account management UI

## Decisions Made
- Cascade deletes chunked ≤500 ops/batch (Firestore listDocuments limit), idempotent on re-run
- deleteUser called LAST after all Firestore docs removed — ensures no dangling auth state
- isOnline uses onSnapshot with includeMetadataChanges for real connectivity detection
- userProfile fetched from users/{uid} doc with try/catch fallback for legacy accounts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AUTH-05 (Default account badge), AUTH-06 (Account deletion), AUTH-07 (Sign out) all complete
- Phase 06 account lifecycle fully implemented
- Ready for milestone completion or next phase

---
*Phase: 06-account-lifecycle*
*Completed: 2026-08-08*

## Self-Check: PASSED

### Verification
- `[ -f src/auth/AuthProvider.tsx ]` → FOUND
- `[ -f src/screens/AccountScreen.tsx ]` → FOUND
- `git log --oneline --grep="06-02"` → 2 commits found
- `npx tsc --noEmit` → PASS
