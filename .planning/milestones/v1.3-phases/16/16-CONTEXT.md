# Phase 16: Test Infrastructure & Auth - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

## Phase Boundary

Set up Maestro E2E test framework and validate authentication flows (sign in, sign up) through automated end-to-end tests.

## Implementation Decisions

### OpenCode's Discretion
All implementation choices are at OpenCode's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

## Existing Code Insights

- Expo SDK 57 project with React Native 0.86
- Auth via Firebase JS SDK 12 with `initializeAuth` + AsyncStorage persistence
- Sign in screen: `src/screens/SignInScreen.tsx` — email/password fields, submit button, error display
- Sign up screen: `src/screens/SignUpScreen.tsx` — display name, email, password fields
- Auth provider: `src/auth/AuthProvider.tsx` — onAuthStateChanged gate, signIn/signUp/signOut methods
- Tab navigation: `src/screens/MainTabs.tsx` — Home, Expenses, Income, Categories, Export, Account tabs
- No Maestro config exists yet — need full setup
- App package: `com.ampolnarvs.mtscaffold`
- Expo Go workflow — Maestro works with Expo Go

## Specific Ideas

- Install Maestro CLI and create `.maestro/` directory structure
- Create auth flow tests: sign in with valid/invalid credentials, sign up with new account
- Use test credentials (not production) — consider creating a dedicated test Firebase project or using a test account
- Add Maestro scripts to package.json for easy execution

## Deferred Ideas

None — discuss phase skipped. Refer to ROADMAP phase description and success criteria.
