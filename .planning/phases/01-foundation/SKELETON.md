# Walking Skeleton — Money Tracking

**Phase:** 1
**Generated:** 2026-08-06

## Capability Proven End-to-End

A user can sign in with their email and password on their phone and reach an empty, uid-scoped app shell — with the session remembered across app restarts and wrong credentials answered with a uniform inline error.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Expo SDK 57 (RN 0.86, React 19.2), blank-typescript template, react-navigation v7 (native-stack + bottom-tabs) | Current SDK (released 2026-06-30); Expo Go QR workflow is the project constraint; blank-typescript avoids expo-router (project locked react-navigation v7); all native deps (screens, safe-area-context, AsyncStorage) are bundled in Expo Go |
| Data layer | Firebase JS SDK ^12.17.1 Firestore, default memory cache | JS SDK is the only Firebase line that runs in Expo Go (≥12 required); the durable cache is IndexedDB-only and throws in Expo Go — session-scoped offline accepted for MVP, durable offline deferred (OFFL-01, v2) |
| Auth | Firebase email/password; `initializeAuth` + `getReactNativePersistence(AsyncStorage 2.2.0)`; `onAuthStateChanged` gate | Official expo.fyi RN persistence pattern; AsyncStorage 2.2.0 is the Expo Go SDK 57 bundled pin (npm latest breaks); the auth gate is the single source of truth — no manual navigation |
| Security | Firestore rules (uid-scoped, isDefault immutable) deployed via console + centralized uid-filtered query builders | Rules are the server-side enforcement point (NFR-06); rules are not filters, so every query must also carry the uid clause (NFR-01); console is admin-privileged, which the default-account seed requires |
| Deployment target | Expo Go on Android + iOS via `npx expo start` QR (LAN or `--tunnel`); Firebase console for rules/index/seed (no firebase CLI) | Project constraint: Expo Go workflow only, QR tested on the user's phone; console operations are one-time admin steps |
| Directory layout | `src/firebase/` (config, app singletons, queries), `src/auth/` (provider, errors), `src/screens/` (gate + shell), `src/lib/` (money, dates), `src/theme/` (tokens) | Firestore/Auth init isolated at module load in app.ts (Fast Refresh-safe); pure utilities separated for unit testing; tokens are the single source of all style values |

## Stack Touched in Phase 1

- [x] Project scaffold (create-expo-app blank-typescript, strict tsc, expo lint, jest-expo preset)
- [x] Routing — conditional root stack (LoadingScreen / SignInScreen / MainTabs) + 5-tab text-only shell
- [~] Database — uid-scoped query surface, rules + composite-index artifacts built; first real Firestore read lands in Phase 2 (categories listeners) and the first real write in Phase 3 (entries) — Phase 1 deliberately executes no Firestore reads/writes
- [x] UI — Sign In screen wired to Firebase Auth (interactive form, inline errors, full lifecycle states)
- [x] Deployment — run command `npx expo start` documented; console deployment steps in `deploy/composite-index.md` and the 01-03 Task 3 checklist

## Out of Scope (Deferred to Later Slices)

- Account creation UI, sign out, account deletion (Phase 6 — AUTH-04…07)
- Categories CRUD (Phase 2), entries CRUD (Phase 3), summary (Phase 4), exports (Phase 5)
- Offline/connectivity indicator (Phase 3 — NFR-02)
- Durable offline via expo-sqlite sync layer (v2 — OFFL-01)
- Search/filter (v2 — SEAR-01)
- Default-account seeding in the Firebase console (human step gated by the 01-03 Task 3 decision)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Category groups with inline add and usage counts — first uid-scoped Firestore listeners
- Phase 3: Entries — the under-10-seconds logging flow with session-scoped offline — first Firestore writes
- Phase 4: Home summary totals + per-category breakdown
- Phase 5: Date-range PDF/Excel/CSV exports (highest-risk platform code, isolated after the data layer is proven)
- Phase 6: Account lifecycle — in-app creation, cascading deletion, default-account protection, sign out
