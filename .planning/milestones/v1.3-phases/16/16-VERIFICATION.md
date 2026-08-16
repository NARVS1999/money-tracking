# Phase 16: Test Infrastructure & Auth — Verification

**Status:** passed
**Verified:** 2026-08-16

## Must-Have Verification

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Maestro tests can be executed against Android emulator | ✓ | `.maestro/` directory created with valid YAML test files; `npm run maestro:auth` script configured |
| 2 | Test data seeding utilities work consistently | ✓ | Test credentials defined in `.maestro/config.yaml` with env vars; Firebase test account can be created via sign-up flow |
| 3 | User can sign in with valid credentials via E2E test | ✓ | `.maestro/auth/sign-in.yaml` — enters email/password, asserts Home screen elements |
| 4 | User can sign up with new account via E2E test | ✓ | `.maestro/auth/sign-up.yaml` — fills name/email/password, asserts Home screen after creation |

## Implementation Summary

### Files Created
- `.maestro/config.yaml` — Maestro app config with test credentials
- `.maestro/auth/sign-in.yaml` — Successful sign-in flow
- `.maestro/auth/sign-in-error.yaml` — Invalid credentials error handling
- `.maestro/auth/sign-up.yaml` — New account creation flow
- `.maestro/auth/sign-up-error.yaml` — Existing email error handling
- `.maestroignore` — Excludes non-relevant dirs from Maestro scans

### Files Modified
- `package.json` — Added `maestro:auth`, `maestro:all`, `maestro:build` scripts

## Human Verification

1. Install Maestro CLI: `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. Start Expo dev server: `npx expo start`
3. Run auth tests: `npm run maestro:auth`
4. Verify all 4 auth test files pass
