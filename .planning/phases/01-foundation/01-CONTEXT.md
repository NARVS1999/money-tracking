# Phase 1: Foundation - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

<domain>
## Phase Boundary

User can sign in with email/password and reach an empty, uid-scoped app shell; the ledger is secure and every later phase has its money/date/query foundations. Requirements: AUTH-01, AUTH-02, AUTH-03, NFR-01, NFR-03, NFR-04, NFR-05, NFR-06.

Deliverables:
- Expo SDK 57 app scaffold (Expo Go compatible) + Firebase init (JS SDK ^12, AsyncStorage 2.2.0 auth persistence, memory-cache Firestore)
- AuthProvider + Sign In screen + auth gate (session persists across restarts, inline wrong-credential errors)
- `money.js` + `dates.js` utils, uid-scoped query builders, Firestore security rules + composite index (`type ASC, date DESC`) deployment

</domain>

<decisions>
## Implementation Decisions

### Scaffold & Tooling
- Expo scaffold via `create-expo-app` with **blank-typescript** template (react-navigation v7, not expo-router)
- App code lives at repo root; `src/` for application code
- Firebase credentials as constants in `src/firebase/config.ts` (private repo — no env plumbing needed in Expo Go)
- Phase gates: `tsc --noEmit` + `expo lint` at verification

### Firebase Init & Persistence
- Firebase module init as a **singleton** `src/firebase/app.ts` exporting `app`, `auth`, `db`; provider consumes the singletons
- `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` wired at module load (before any auth call)
- No offline/connectivity UI indicator this phase — deferred to Phase 3 (Entries) where real write paths exist (NFR-02)
- `expo-file-system/legacy` import rule (SDK 57: legacy methods throw from the main module) documented for later phases — no file-system code this phase

### Sign In Screen
- **No create-account UI this phase** — "Create one" inline expansion deferred to Phase 6 (AUTH-04); AUTH-01: no sign-up on first run
- Wrong-credential error copy: exactly **"Email or password is wrong"** (design brief; does not leak whether the email exists)
- Sign-in button: text changes to **"Signing in…"** and disabled while in flight (no spinner component)
- No password visibility toggle (design brief is minimal)

### App Shell & Navigation
- **Root conditional stack**: `NavigationContainer` + native-stack — `SignIn` screen when no user, `MainTabs` when user; single source of truth for auth gating
- **Full 5-tab shell with placeholder screens** this phase (Home, Expenses, Income, Categories, Account) — later phases fill them in
- Tab bar is **text-only labels, no icons** (design brief: no decoration; text is the interface)
- **Loading screen while `onAuthStateChanged` resolves** to avoid flashing Sign In over a restored session

### the agent's Discretion
- Nothing user-deferred — all 16 questions accepted as recommended

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- No application code exists yet — repo is planning-stage (root docs: design-brief.md, tech-design.md, app-flow.md, backend-schema.md, project-requirements.md)
- Design tokens defined in design-brief.md: `#F7F7F8` bg, `#FFFFFF` surface, `#1A1A1A` text, `#6B7280` secondary, `#E5E7EB` border, `#16A34A` income, `#DC2626` expense/danger, `#111827` accent

### Established Patterns
- Expo Go workflow only — every library must be Expo Go compatible (SDK 57, firebase ^12 JS SDK, AsyncStorage 2.2.0 pinned, `npx expo install` for native-adjacent packages)
- No `persistentLocalCache` — memory cache only (IndexedDB-only in the JS SDK, throws in Expo Go); session-scoped offline accepted (STATE.md decision)
- Money as integer cents, dates as local `"YYYY-MM-DD"` strings (NFR-03/NFR-04)

### Integration Points
- App entry: `App.tsx` (or `index.ts`) → AuthProvider → NavigationContainer
- Firebase singletons under `src/firebase/`
- Utils under `src/lib/` (money.js, dates.js) — consumed by entry form and summary in later phases
- Query builders centralized under `src/firebase/queries.ts` — every query carries a `uid` filter (NFR-01)

</code_context>

<specifics>
## Specific Ideas

- Sign In screen per design-brief layout: app name "Money" 28pt bold centered, Email + Password fields, full-width black Sign in button, inline error in danger color below fields
- Blank/loading screen during auth restore should be a simple centered indicator on the design background (not a branded splash)
- Firestore security rules must match backend-schema.md: uid scoping, `isDefault` immutable, in-app default creation impossible (NFR-06)
- Composite index `type ASC, date DESC` must be created for future query builders (deployment artifact — document, creation happens in Firebase console)

</specifics>

<deferred>
## Deferred Ideas

- Create-account inline expansion on the Sign In card ("No account? Create one") — Phase 6 (AUTH-04)
- Offline/connectivity indicator UI — Phase 3 (Entries, NFR-02)
- Durable offline via expo-sqlite sync layer (OFFL-01) — v2, already tracked in STATE.md
- Search/filter (SEAR-01) — v2, already tracked in STATE.md

</deferred>
