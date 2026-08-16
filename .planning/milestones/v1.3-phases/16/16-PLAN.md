# Phase 16: Test Infrastructure & Auth — Plan

**Created:** 2026-08-16
**Status:** Ready for execution

## Tasks

### Task 1: Install Maestro and Create Directory Structure
- Install Maestro CLI (via Homebrew on macOS, or manual install)
- Create `.maestro/` directory
- Create `.maestro/config.yaml` with app launch config
- Create `.maestro/auth/` directory for auth tests

### Task 2: Create Auth Flow Test Files
- `.maestro/auth/sign-in.yaml` — successful sign in flow
- `.maestro/auth/sign-in-error.yaml` — invalid credentials error handling
- `.maestro/auth/sign-up.yaml` — new account creation flow
- `.maestro/auth/sign-up-error.yaml` — existing email error handling

### Task 3: Create Test Seeding Utilities
- `.maestro/utils/seed-test-account.js` — script to create test Firebase account
- `.maestro/utils/cleanup-test-data.js` — script to clean up test data after tests

### Task 4: Add Maestro Scripts to package.json
- `maestro:auth` — run auth tests
- `maestro:all` — run all tests
- `maestro:build` — build test APK for Android

### Task 5: Create .maestroignore
- Exclude node_modules, .expo, android/build from Maestro scans

## Dependencies

- Task 1 must complete before Task 2-5
- Tasks 2, 3, 4, 5 can run in parallel after Task 1

## Verification

- Maestro CLI installed and `maestro --version` works
- `.maestro/` directory structure exists
- Auth test YAML files are valid Maestro syntax
- Test seeding script can create/delete test accounts
- Package.json scripts work with `npm run maestro:auth`
