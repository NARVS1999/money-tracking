---
status: resolved
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-08-06T17:20:00Z
updated: 2026-08-06T18:15:00Z
---

## Tests

### 0. Firebase console setup (prerequisite)
expected: Create project, enable Email/Password, create Firestore, register web app, deploy rules, create indexes, seed default account
result: ✅ PASS — project created, auth enabled, Firestore created, rules+indexes deployed via `firebase deploy`, default account seeded

### 1. App boots to signed-out gate
expected: Scan QR in Expo Go → Sign In card appears without redbox
result: ✅ PASS — app boots to Sign In screen

### 2. First launch shows Sign In only (no sign-up)
expected: No account-creation UI anywhere (AUTH-01)
result: ✅ PASS — Email/Password/Sign in only, no create-account affordance

### 3. Wrong password → inline locked error
expected: "Email or password is wrong" below Password; user stays on Sign In (AUTH-03)
result: ⏭ N/A — no logout button in Phase 1 scope (AUTH-07 is Phase 6)

### 4. Default account sign-in + session persists across restart
expected: Sign-in lands on 5-tab shell; kill app and reopen → stays signed in (AUTH-02 backstop)
result: ✅ PASS — **verified on device**: login successful, kill app → reopen stays on MainTabs

### 5. Keyboard never covers Sign in button
expected: Button always visible when keyboard open (backstop)
result: ⏭ N/A — user tested on phone, cannot easily test keyboard overlap

### 6. Rules deployed
expected: deploy/firestore.rules live — uid scoping, isDefault immutability, amountCents is int (NFR-06)
result: ✅ PASS — rules deployed via `firebase deploy`

### 7. Indexes created + default account seeded
expected: Composite indexes + default account signs in
result: ✅ PASS — indexes deployed, default account created and signs in successfully

### 8. Cross-account isolation with second account
expected: Second account cannot read default account's data (NFR-06 backstop)
result: ⏭ N/A — deferred to Phase 6 (requires second account)

## Summary

total: 9
passed: 6
issues: 0
pending: 0
skipped: 3 (N/A — Phase 1 scope limitations)
blocked: 0

## Gaps

- AUTH-03 (wrong password error): unit-tested, not device-verified (no logout in Phase 1)
- Keyboard overlap: device-runtime behavior, code present but not tested on phone
- NFR-06 cross-account: requires second account (Phase 6 scope)
