# Phase 6: Account Lifecycle - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Source:** PRD Express Path (REQUIREMENTS.md)

<domain>
## Phase Boundary

User can create additional accounts in-app and delete an account (with full cascade), while the seeded default account stays protected — and sign out from anywhere.

**In scope:**
- AUTH-04: In-app account creation (display name, email, password min 6 chars) with empty ledger and immediate sign-in
- AUTH-05: Default account protection (badge, no delete option)
- AUTH-06: Account deletion (reauth → cascade delete → sign in screen)
- AUTH-07: Sign out from Account tab

**Out of scope:**
- Password reset (via Firebase console, not in-app — per ADR-0005)
- Email verification
- Account editing (rename, change email/password)
- Multi-device account switching beyond "sign in to any account"

</domain>

<decisions>
## Implementation Decisions

### Account Creation (AUTH-04)
- User can create an account in-app with display name, email, and password (minimum 6 characters)
- New account starts with an empty ledger (no categories, no entries)
- App signs into the new account immediately after creation
- Uses Firebase `createUserWithEmailAndPassword` from `@firebase/auth`
- Writes a `users/{uid}` doc with `{ displayName, email, isDefault: false, createdAt }`

### Default Account Protection (AUTH-05)
- Default account is identified by `isDefault: true` on the `users/{uid}` doc
- Default account shows a "Default" badge in the Account tab
- Default account never offers a delete option in the Account tab
- Default account is seeded via Firebase console (not in-app) — per ADR-0005
- Security rules prevent in-app creation of default-flagged accounts

### Account Deletion (AUTH-06)
- User can delete a non-default account
- Requires password reauthentication before deletion
- Cascade delete order: entries → categories → users doc → auth account (`deleteUser()` last)
- Chunked loop: ≤500 docs/batch to stay under Firestore limits
- Idempotent: if app crashes mid-deletion, re-running picks up where it left off
- After deletion, user is returned to Sign In screen
- Disabled when offline (network required for Firebase Auth operations)

### Sign Out (AUTH-07)
- User can sign out from the Account tab
- Uses Firebase `signOut(auth)` from `@firebase/auth`
- AuthProvider reacts to `onAuthStateChanged` and clears `user`
- Auth gate swaps to SignInScreen automatically

### Technical Approach
- AuthProvider extended with: `signUp`, `signOut`, `reauthenticate`, `deleteAccount`
- AccountScreen built from placeholder to full UI (display name, email, badge, sign out, delete)
- In-app account creation: likely a modal or secondary screen off SignInScreen
- Reauthentication: `reauthenticateWithCredential` + `EmailAuthProvider.credential`
- No new dependencies required (Firebase Auth SDK already installed)

### Implementation Order
1. Extend AuthProvider with signUp, signOut, reauthenticate, deleteAccount
2. Build AccountScreen UI (display name, email, "Default" badge, sign out, delete)
3. Build in-app account creation flow
4. Build account deletion flow (reauth → cascade → sign out)

### Risk Areas
- Cascade loop must be idempotent — partial deletion should not leave dangling docs
- `deleteUser()` must be LAST — if called before Firestore docs are deleted, data is orphaned
- Reauthentication requires user to type password again — forgotten password = stuck (console only)
- Network state check needed — delete button disabled when offline

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authentication
- `docs/adr/0005-email-password-accounts-with-default.md` — Email/password auth with protected default account (supersedes ADR-0002)
- `src/auth/AuthProvider.tsx` — Current auth state management (signIn only)
- `src/auth/errors.ts` — Auth error message mapping
- `src/firebase/app.ts` — Firebase singletons (initializeAuth with AsyncStorage persistence)

### Data Model
- `src/firebase/queries.ts` — uid-scoped query builders (entriesBase, categoriesOf, userDoc)
- `src/entries/EntriesProvider.tsx` — Entry data model and onSnapshot listeners
- `src/categories/CategoriesProvider.tsx` — Category data model and onSnapshot listeners

### Screens
- `src/screens/AccountScreen.tsx` — Current placeholder (to be built out)
- `src/screens/SignInScreen.tsx` — Current sign-in flow (to be extended with sign-up)

### Security
- Firestore security rules (uid scoping, isDefault immutable) — per NFR-06

</canonical_refs>

<specifics>
## Specific Ideas

- Account creation: display name field + email + password (min 6 chars)
- Default badge: visual indicator on Account tab for default account
- Delete confirmation: password reauthentication gate before cascade
- Cascade progress: consider showing progress indicator during multi-batch deletion
- Sign out: simple button in Account tab, immediate redirect to Sign In

</specifics>

<deferred>
## Deferred Ideas

- Password reset (ADR-0005: "via Firebase console, not in-app")
- Email verification
- Account editing (rename, change email/password)
- Multi-device account switching beyond basic sign-in
- Account data export before deletion

</deferred>

---

*Phase: 06-account-lifecycle*
*Context gathered: 2026-08-09 via PRD Express Path*
