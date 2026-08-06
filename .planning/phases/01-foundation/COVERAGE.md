# API Coverage — Phase 1 Foundation

> Coverage gate for the Firebase JS SDK capability surface touched in Phase 1 (firebase ^12.17.1).
> **INTEGRATE** = capability exercised in working code this phase. **OPT-OUT** = deliberately deferred, with reason. Refreshed during 01-03 Task 2 against the implemented surface.

| Capability | Status | Evidence / Reason |
|-----------|--------|-------------------|
| Email/password sign-in | INTEGRATE | `signInWithEmailAndPassword` via `AuthProvider.signIn` (`src/auth/AuthProvider.tsx`) |
| Session restore/persistence | INTEGRATE | `initializeAuth` + `getReactNativePersistence(AsyncStorage 2.2.0)` at module load (`src/firebase/app.ts`) + `onAuthStateChanged` first-emission gate (`AuthProvider.tsx`) |
| Create account | OPT-OUT | Phase 6 (AUTH-04) — no account-creation UI by locked decision (AUTH-01) |
| Sign out | OPT-OUT | Phase 6 (AUTH-07) — no sign-out surface in Phase 1 |
| Delete user | OPT-OUT | Phase 6 (AUTH-06) — cascading deletion with reauth, chunked batches |
| uid-scoped Firestore queries | INTEGRATE | Every builder in `src/firebase/queries.ts` starts with `where("uid","==",uid)` (NFR-01, unit-tested via query-constraint inspection) |
| Firestore writes | OPT-OUT | Phase 3 (ENTR-05) — entries/categories writes land with the entry form |
| Offline cache | OPT-OUT | N/A — memory cache only: the durable cache is IndexedDB-only and fails in Expo Go; session-scoped offline accepted, durable offline deferred (OFFL-01, v2) |
| Rules deployment | INTEGRATE | `deploy/firestore.rules` (backend-schema.md verbatim) — artifact console-ready (NFR-06); **console deployment DEFERRED** by 01-03 Task 3 user decision (option-c) |
| Composite index creation | INTEGRATE | `deploy/composite-index.md` — `entries: type ASC, date DESC` console artifact backing `entriesByType`; **console creation DEFERRED** by 01-03 Task 3 user decision (option-c) |

## Not Yet Touched (later phases)

- `createUserWithEmailAndPassword`, `signOut`, `reauthenticateWithCredential`, `deleteUser` — Phase 6
- `setDoc`/`updateDoc`/`deleteDoc`/batches — Phase 3 (writes), Phase 6 (cascade)
- `onSnapshot` listeners — Phase 2 (categories), Phase 3 (entries)
- `getDoc` default-account flag reads — Phase 6
