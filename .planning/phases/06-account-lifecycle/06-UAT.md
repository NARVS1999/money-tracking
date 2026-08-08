---
status: complete
phase: 06-account-lifecycle
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md]
started: 2026-08-09T00:00:00Z
updated: 2026-08-09T00:03:00Z
---

## Current Test

[testing complete]

## Tests

### 1. End-to-end sign-up flow
expected: Tap "Create account" on SignInScreen. Fill in Display Name, Email, Password. Tap Submit. Account created, user signed in, navigates to MainTabs.
result: pass

### 2. Delete account flow
expected: Tap "Delete Account" on AccountScreen. Confirmation modal appears. Enter password. Tap confirm. Account cascade-deleted, user redirected to SignInScreen.
result: pass

### 3. Sign out flow
expected: Tap "Sign Out" on AccountScreen. Immediately returns to SignInScreen.
result: pass

### 4. AuthProvider.signUp creates Firebase user and writes users/{uid} doc with isDefault:false
expected: AuthProvider.signUp creates Firebase user and writes users/{uid} doc with isDefault:false
result: pass
source: automated
coverage_id: D1

### 5. signUpErrorMessage maps email-already-in-use, weak-password, invalid-email to user-friendly copy
expected: signUpErrorMessage maps email-already-in-use, weak-password, invalid-email to user-friendly copy
result: pass
source: automated
coverage_id: D2

### 6. SignUpScreen with Display Name, Email, Password fields, disabled button when empty or password under 6 chars
expected: SignUpScreen with Display Name, Email, Password fields, disabled button when empty or password under 6 chars
result: pass
source: automated
coverage_id: D3

### 7. SignInScreen has Create account link navigating to SignUpScreen
expected: SignInScreen has Create account link navigating to SignUpScreen
result: pass
source: automated
coverage_id: D4

### 8. AuthProvider.signOut wraps firebase signOut and clears user/userProfile via onAuthStateChanged
expected: AuthProvider.signOut wraps firebase signOut and clears user/userProfile via onAuthStateChanged
result: pass
source: automated
coverage_id: D1

### 9. AuthProvider.reauthenticate uses EmailAuthProvider.credential + reauthenticateWithCredential
expected: AuthProvider.reauthenticate uses EmailAuthProvider.credential + reauthenticateWithCredential
result: pass
source: automated
coverage_id: D2

### 10. AuthProvider.deleteAccount cascade deletes entries, expenseCategories, incomeCategories, users doc, then deleteUser
expected: AuthProvider.deleteAccount cascade deletes entries, expenseCategories, incomeCategories, users doc, then deleteUser
result: pass
source: automated
coverage_id: D3

### 11. userProfile state fetched from users/{uid} with displayName, email, isDefault
expected: userProfile state fetched from users/{uid} with displayName, email, isDefault
result: pass
source: automated
coverage_id: D4

### 12. isOnline flag uses onSnapshot with includeMetadataChanges for real connectivity
expected: isOnline flag uses onSnapshot with includeMetadataChanges for real connectivity
result: pass
source: automated
coverage_id: D5

### 13. AccountScreen shows display name, email, Default badge for isDefault accounts
expected: AccountScreen shows display name, email, Default badge for isDefault accounts
result: pass
source: automated
coverage_id: D6

### 14. Default account never renders delete button (AUTH-05)
expected: Default account never renders delete button (AUTH-05)
result: pass
source: automated
coverage_id: D7

### 15. Delete button disabled when isOnline is false (AUTH-06)
expected: Delete button disabled when isOnline is false (AUTH-06)
result: pass
source: automated
coverage_id: D8

## Summary

total: 15
passed: 15
issues: 0
pending: 0
skipped: 0

## Gaps

- gap_id: G-06-1
  truth: "Sign-up flow completes without Firestore permission errors"
  status: resolved
  reason: "Firestore rules checked resource.data.uid (never written) instead of path-based request.auth.uid == uid"
  severity: blocker
  test: 1
  root_cause: "firestore.rules used resource.data.uid for reads, but signUp never wrote uid field. Fix: changed to path-based request.auth.uid == uid and added uid to signUp payload."
  artifacts:
    - path: "firestore.rules"
      issue: "allow read checked resource.data.uid which was never set"
    - path: "src/auth/AuthProvider.tsx"
      issue: "signUp payload missing uid field"
  missing:
    - "Redeploy Firestore rules in Firebase console"
  resolved_by: "debug session"
  resolved_at: 2026-08-09
