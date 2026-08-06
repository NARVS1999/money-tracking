---
status: testing
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-08-06T17:20:00Z
updated: 2026-08-06T17:20:00Z
---

## Current Test

number: 0
name: Firebase console setup (credentials + deployment)
expected: |
  Real firebaseConfig inserted into src/firebase/config.ts; rules + indexes deployed; default account seeded
awaiting: user console actions

## Tests

### 0. Firebase console setup (prerequisite for all device tests)
expected: Create project → enable Email/Password → create Firestore → register web app (6 config values); publish deploy/firestore.rules; create indexes `entries: uid ASC, type ASC, date DESC` and `entries: uid ASC, date ASC`; seed default account (auth user + users/{uid} with isDefault: true)
result: [pending]

### 1. App boots to signed-out gate on device
expected: With real firebaseConfig + seeded default account: `npx expo start`, scan QR in Expo Go, app boots to the Sign In card without a redbox
result: [pending]

### 2. First launch shows Sign In only (no sign-up)
expected: Sign In card (Email/Password/Sign in) with no account-creation affordance anywhere (AUTH-01)
result: [pending]

### 3. Wrong password → inline locked error
expected: "Email or password is wrong" below Password; fields keep values; button re-enables; user stays on Sign In (AUTH-03)
result: [pending]

### 4. Default account sign-in + session persists across restart
expected: Sign-in lands on 5-tab shell; kill app and reopen → lands on shell without re-signing-in (AUTH-02 backstop)
result: [pending]

### 5. Keyboard never covers the Sign in button (both platforms)
expected: Focus Email/Password, open/dismiss keyboard — button always visible (backstop)
result: [pending]

### 6. Rules deployed (console)
expected: publish deploy/firestore.rules verbatim — uid scoping, isDefault immutability, amountCents is int live (NFR-06)
result: [pending]

### 7. Indexes created + default account seeded (console)
expected: `entries: uid ASC, type ASC, date DESC` and `entries: uid ASC, date ASC` created; default account signs in
result: [pending]

### 8. Cross-account isolation with second account
expected: Second test account cannot read the default account's data — all cross-account reads fail with permission-denied (NFR-06 backstop)
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
