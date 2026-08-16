---
status: testing
phase: 11-sqlite-local-db
source: 11-01-SUMMARY.md
started: 2026-08-16T07:45:00Z
updated: 2026-08-16T07:45:00Z
---

## Current Test

number: 4
name: Categories Load from SQLite
expected: |
  Open the Categories screen. Your expense and income categories appear.
  Adding a new category works and persists after kill.
awaiting: user response

## Tests

### 1. Cold Start — App Boots with SQLite
expected: Kill the app completely (swipe away). Reopen. App loads the Home screen without errors. SQLite database is created silently in the background.
result: pass

### 2. Sign-In Seeds Data from Firestore
expected: Sign in with your account. Entries and categories from Firestore appear in the app. If you already had data, it shows immediately.
result: pass

### 3. Data Persists After Kill
expected: Add an entry (expense or income). Kill the app. Reopen. The entry you added is still there — loaded from SQLite, not re-fetched from Firestore.
result: skipped
reason: Cannot test on Expo Go

### 4. Categories Load from SQLite
expected: Open the Categories screen. Your expense and income categories appear. Adding a new category works and persists after kill.
result: [pending]

### 5. Sync Queue Tracks Offline Changes
expected: Turn off WiFi/mobile data. Add an entry. Turn WiFi back on. Tap the Sync button. The entry syncs to Firestore (check Firebase Console to confirm).
result: [pending]

### 6. Idempotent Seed — No Duplicates
expected: Sign out. Sign back in. Data does not duplicate — same entries and categories as before.
result: [pending]

## Summary

total: 6
passed: 2
issues: 0
pending: 3
skipped: 1

## Gaps

[none yet]
