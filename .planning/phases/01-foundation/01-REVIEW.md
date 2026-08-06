---
phase: 01-foundation
reviewed: 2026-08-07T01:11:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - App.tsx
  - index.ts
  - babel.config.js
  - jest.config.js
  - package.json
  - tsconfig.json
  - deploy/composite-index.md
  - deploy/firestore.rules
  - src/__tests__/smoke-test.ts
  - src/auth/AuthProvider.tsx
  - src/auth/__tests__/errors-test.ts
  - src/auth/errors.ts
  - src/firebase/__tests__/queries-test.ts
  - src/firebase/app.ts
  - src/firebase/config.ts
  - src/firebase/queries.ts
  - src/lib/__tests__/dates-test.ts
  - src/lib/__tests__/money-test.ts
  - src/lib/dates.ts
  - src/lib/money.ts
  - src/screens/AccountScreen.tsx
  - src/screens/CategoriesScreen.tsx
  - src/screens/ExpensesScreen.tsx
  - src/screens/HomeScreen.tsx
  - src/screens/IncomeScreen.tsx
  - src/screens/LoadingScreen.tsx
  - src/screens/MainTabs.tsx
  - src/screens/PlaceholderScreen.tsx
  - src/screens/SignInScreen.tsx
  - src/theme/tokens.ts
findings:
  critical: 0
  warning: 0
  info: 5
  total: 5
status: clean
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-07T12:00:00Z (initial); 2026-08-07T01:11:00Z (post-fix re-review)
**Depth:** standard
**Files Reviewed:** 29
**Status:** clean (after fix pass — all Critical/Warning findings resolved; 5 Info findings accepted)

## Summary

Reviewed the Phase 1 (Foundation) implementation: Firebase module-load singletons, auth gate (AuthProvider/SignIn/Loading), 5-tab shell, money/date utilities, uid-scoped query builders, jest infra, and the Firestore rules + composite-index deployment artifacts.

**What is solid:** The threat model's core requirements are met. All 5 query builders plus `userDoc` are uid-scoped (queries.ts, verified via tests), the auth error mapper is pure with locked credential copy (T-1-02 ✓), no secrets/logging/tokens appear anywhere in source (T-1-04 ✓), and the rules match backend-schema.md byte-for-byte with correct `isDefault` immutability on create/update. money.ts and dates.ts are clean, deterministic implementations with strong test coverage. App shell/auth flow structure follows the documented patterns correctly.

**Key concerns:** The two deployment artifacts are defective as shipped. `deploy/firestore.rules` contains a comment-only `incomeCategories` match block that denies ALL access to income categories if pasted as instructed, and `deploy/composite-index.md` documents an index plan that does not match the queries actually built by `queries.ts` (the `entriesInRange` claim of "needs nothing" is wrong, and the `entriesByType` index omits the `uid` equality field). Since NFR-06 enforcement is explicitly deferred to the human deploying these artifacts, these defects will surface as runtime breakage — income tracking dead on arrival, and index-required errors on the tab list and range queries. Because deployment is deferred, all of these can be fixed before the one-way door opens.

## Critical Issues

### CR-01: Comment-only `incomeCategories` match block denies all access — artifact is not deploy-safe despite "deploy verbatim" instruction

**File:** `deploy/firestore.rules:39` (with header lines 1-2, 10-14)
**Issue:** The match block is `match /incomeCategories/{id} { /* identical to expenseCategories */ }` — a match block with no `allow` statements **denies every read/write** to income categories. The file header line 1-2 instructs "deploy verbatim via Firebase console", while lines 10-14 tell the human to expand the block before pasting. These instructions contradict each other; the file is the sole deployment artifact for NFR-06 and is claimed "console-paste-ready" (01-03 SUMMARY D4). A human following the file's own primary instruction breaks income tracking entirely (and it fails silently for rules — every income-category write/read returns permission-denied at runtime). The 01-03 "fix" (a header comment) does not change the deployed behavior. The project's own 01-03 deviation log classified this as "Missing Critical" — it remains unfixed in the artifact itself.
**Fix:** Replace the comment block with the full allow-set so the file is genuinely deployable verbatim:

```csp
match /incomeCategories/{id} {
  allow read, update, delete: if resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
                 && request.resource.data.uid == request.auth.uid;
}
```

Then update backend-schema.md:90 the same way (the rules claim byte-faithfulness to a schema that itself ships this shorthand), and re-verify.

## Warnings

### WR-01: `entriesInRange` will fail at runtime — composite-index.md wrongly claims the automatic single-field date index suffices

**File:** `deploy/composite-index.md:42-45` (claim), `src/firebase/queries.ts:28-29` (query)
**Issue:** The doc states: "Range queries (`entriesInRange`, date `>=` / `<=`) use the automatic single-field index on date and need nothing here." `entriesInRange` combines an **equality** filter on `uid` with **range** filters on `date` — filters on two different fields. Firestore's index merging (per the official index-overview docs) covers "queries with multiple equality (`==`) clauses and, optionally, an `orderBy` clause" — an inequality/range clause is not in that class. Equality + range across fields requires a **composite index `uid ASC, date ASC`**. As deployed, the first call to `entriesInRange` throws "The query requires an index." with a self-link. This breaks the Phase 4 export/summary feature at runtime, and the artifact actively misleads the human into skipping the required console step.
**Fix:** Add a second index row to deploy/composite-index.md:

| Collection | Fields | Purpose |
|-----------|--------|---------|
| `entries` | `uid ASC, date ASC` | Range export/summary (`entriesInRange`) |

(Keep the existing `type ASC, date DESC` row for the tab lists.)

### WR-02: Documented `type ASC, date DESC` index does not match `entriesByType`'s actual filters (uid equality omitted)

**File:** `deploy/composite-index.md:22-29`, `src/firebase/queries.ts:24-25`
**Issue:** `entriesByType` builds `where("uid","==",uid) + where("type","==",type) + orderBy("date","desc")` — two equality filters plus an orderBy. Firestore's composite-index rule is that the index must cover the query's equality fields ahead of the orderBy field (the index-overview restaurants example shows the 3-equality + orderBy query needing `category, city, editors_pick, star_rating`). The documented `type ASC, date DESC` index has no `uid` column, so it cannot serve the query's `uid` equality clause; the query will still throw an index-required error after the human completes the documented console steps. The 01-03 SUMMARY's claim that `entriesByType` "will fail with a self-linking index error until the composite index is created" is correct in spirit, but the artifact then points the human at the wrong index.
**Fix:** Update the index definition to include the uid equality field — expected shape `uid ASC, type ASC, date DESC` (verify against the self-linking error after deploy, or in the emulator, and record the final shape in composite-index.md).

### WR-03: Rules allow the default account's own `users` doc to be deleted — "can never be deleted" is client-side-only (T-1-03)

**File:** `deploy/firestore.rules:19`
**Issue:** `allow read, delete: if resource.data.uid == request.auth.uid;` lets the default-account user (or any client holding that session) delete `users/<default-uid>` — the doc carrying `isDefault: true`. AGENTS.md's core constraint says the seeded default account "can never be deleted in-app", and the rules are stated (NFR-06, T-1-03) to be the enforcement point; today the only guard is planned app logic in Phase 6 (AccountScreen is still a placeholder). The `isDefault` field is immutable on update and un-forgeable on create, but **delete** has no such guard — a buggy or modified client permanently loses the default-account marker. Note the rules also can't distinguish the default account's *entries/categories* (the cascade), but those are data, while the `users` doc is the ownership record — and the schema's own note admits the default protection is "in-app by design", i.e. client-side privilege logic.
**Fix:** Guard delete only (keep read unguarded so the Account tab can read the profile):

```csp
match /users/{uid} {
  allow read: if resource.data.uid == request.auth.uid;
  allow delete: if resource.data.uid == request.auth.uid
                 && !resource.data.isDefault;
  ...
}
```

### WR-04: Integer-cents invariant (NFR-03) is not enforced server-side — rules accept float `amountCents`

**File:** `deploy/firestore.rules:27-31` (entries create/update)
**Issue:** The entries rules validate only `uid` ownership. A client bug or modified client can write `amountCents: 24.5` (float) and the rules accept it, corrupting every later total/export — the app's most important data invariant ("integer-cents storage, never floats" — AGENTS.md) rests entirely on client discipline. The file header (lines 6-8) documents that an `amountCents is int` hardening line was considered and "NOT approved"; it should be approved — the cost is one line per rule and the invariant is core to the product. Similarly, `type` is unvalidated (any string accepted) and required fields (`date`, `categoryId`) can be omitted by a malformed client.
**Fix:**

```csp
match /entries/{id} {
  allow read, update, delete: if resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
                 && request.resource.data.uid == request.auth.uid
                 && request.resource.data.amountCents is int
                 && request.resource.data.amountCents >= 0
                 && request.resource.data.type in ['expense', 'income'];
}
```

### WR-05: `entriesInRange` accepts inverted/malformed ranges and silently returns wrong results

**File:** `src/firebase/queries.ts:28-29`
**Issue:** The builder does not validate `start`/`end`: an inverted range (`start > end`) or a non-`YYYY-MM-DD` string produces a query that silently returns an empty set — the export/summary feature (Phase 4) would emit an empty report instead of failing loudly, and a malformed date string (e.g., from a date-picker regression) yields silent wrong data with no error. `dates.ts` already ships `isValid`/`compare` for exactly this.
**Fix:**

```ts
export const entriesInRange = (uid: string, start: string, end: string) => {
  if (!isValid(start) || !isValid(end) || compare(start, end) > 0) {
    throw new Error(`entriesInRange: invalid range ${start}..${end}`);
  }
  return query(entriesBase(uid), where("date", ">=", start), where("date", "<=", end));
};
```

### WR-06: Query tests assert on private SDK internals (`q._query`) — suite breaks spuriously on any firebase 12.x bump

**File:** `src/firebase/__tests__/queries-test.ts:25-26, 46-49`
**Issue:** All 13 query tests read `q._query.filters`/`explicitOrderBy`/`limit` — undocumented, private Query internals of `@firebase/firestore`. `package.json` pins `firebase: ^12.17.1` (semver range), so any 12.x release that renames or reshapes these internals breaks the entire query suite with no product change, and the tests would silently stop asserting what they claim (the helper falls back to `{}` and returns false — a shape change degrades the test to "always fails" rather than failing loudly as a contract change). The 01-03 decision (OQ3, no emulator) is documented, but the reliability risk is real and the emulator is available (`@firebase/rules-unit-testing` / `firebase emulators:exec`) for later phases.
**Fix:** Acceptable short-term: pin `firebase` exactly (`"12.17.1"`). Better: migrate the query assertions to a Firestore emulator run in CI, keeping the internal-assertion tests only as a fast smoke check.

## Info

### IN-01: `parsePesoInput` rejects ".5" (no leading zero) and accepts zero amounts

**File:** `src/lib/money.ts:18`
**Issue:** Cleaned input `".5"` fails the `^\d+...` regex → null, so a user typing `.5` gets a validation error; conversely `"0"`/`"00"` parse to 0 cents, so zero-value entries must be rejected by the form (silently valid today). Consider accepting an optional leading zero (`^\.?\d+...` or normalize a leading `.` to `0.`), and document that zero is a form-level decision.
**Fix:** Normalize before validation: `const normalized = cleaned.startsWith(".") ? "0" + cleaned : cleaned;`

### IN-02: `formatCents` renders garbage for non-integer input

**File:** `src/lib/money.ts:7-14`
**Issue:** Contract says integer cents, but nothing enforces it: `formatCents(2450.5)` → `"₱ 24.50.5"` (fraction `50.5` passes through `.padStart` untouched). A defensive `Number.isInteger` guard would convert a future caller bug into an early throw instead of silently corrupting displayed money.
**Fix:** `if (!Number.isInteger(cents)) throw new TypeError("formatCents expects integer cents");`

### IN-03: `expense` and `danger` tokens share the same value

**File:** `src/theme/tokens.ts:6`
**Issue:** `expense: '#DC2626'` and `danger: '#DC2626'` are identical; restyling one later silently changes the other. If they are meant to stay in sync, keep one and alias it (`danger: expense`).
**Fix:** `expense: '#DC2626', danger: '#DC2626'` → define once and reference, or add a comment documenting the coupling.

### IN-04: Rate-limit and malformed-email errors get the "check your connection" copy

**File:** `src/auth/errors.ts:24`
**Issue:** `auth/too-many-requests` (Firebase locks the account after ~5 failed attempts) and `auth/invalid-email` map to "Couldn't sign in. Check your connection and try again." — actively misleading: the user retries into a locked account, and a typo'd email looks like a network problem. The AUTH-03 contract only covers the 3 credential codes, but a dedicated copy for `too-many-requests` ("Too many attempts. Try again later.") costs one map entry and removes a real UX trap.
**Fix:** Add `"auth/too-many-requests"` to a small secondary map → `"Too many sign-in attempts. Try again in a few minutes."`

### IN-05: `signIn` does not normalize email case

**File:** `src/auth/AuthProvider.tsx:48`
**Issue:** `signInWithEmailAndPassword` is case-sensitive on the email: if the seeded default account is `Owner@gmail.com`, typing `owner@gmail.com` fails with `invalid-credential` → "Email or password is wrong" (no hint). Firebase normalizes to lowercase at account creation but not at sign-in. Lowercasing the input is the standard fix.
**Fix:** `await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);`

---

## Post-fix re-review (iteration 1, 2026-08-07)

Re-reviewed the changed files after the fix pass: `deploy/firestore.rules`,
`deploy/composite-index.md`, `src/firebase/queries.ts`,
`src/firebase/__tests__/queries-test.ts` (plus `backend-schema.md`, updated in
lock-step to keep the rules byte-faithful to their documented source of truth).

- **CR-01** — resolved: `incomeCategories` match block expanded to the full
  allow-set (mirrors `expenseCategories`) in both `deploy/firestore.rules` and
  `backend-schema.md`; the contradictory "deploy verbatim" vs "expand before
  pasting" header notes replaced with a single deploy-safe header. The artifact
  is now genuinely paste-ready.
- **WR-01** — resolved: composite index `uid ASC, date ASC` documented for
  `entriesInRange` with its own console steps; the wrong "range queries need
  nothing here" claim corrected in `deploy/composite-index.md` and
  `backend-schema.md` (the automatic single-field `date` index does not serve
  a uid-equality + date-range query).
- **WR-02** — resolved: documented index is now `uid ASC, type ASC, date DESC`
  (uid equality column first); console steps updated; a per-builder table
  enumerates all six query builders' constraints and index requirements;
  the stale `type ASC, date DESC` comment in `queries.ts` corrected.
- **WR-03** — resolved: `users` delete rule guards `!resource.data.isDefault`
  (default account's doc undeletable server-side; read stays unguarded); schema
  rule and note updated in lock-step.
- **WR-04** — resolved: entries create rule enforces `amountCents is int`
  (NFR-03 server-side invariant); header note updated (hardening now approved
  and applied); schema updated in lock-step. Diff kept minimal — no extra
  validations beyond the documented hardening line.
- **WR-05** — resolved: `entriesInRange` validates the range via
  `src/lib/dates.ts` (`isValid`/`compare`) and throws `Error` on malformed,
  impossible, or inverted (start > end) ranges; tests updated and extended
  (inverted, non-YYYY-MM-DD, impossible-date, and start == end boundary cases).
- **WR-06** — resolved (documented): semver risk of asserting on the private
  `q._query` internals documented in the test-file header, including the
  failure mode (helper degrades to `{}`) and the migration path (Firestore
  emulator in CI). Internal assertions kept per RESEARCH OQ3 decision.

**Info findings (IN-01..IN-05):** reviewed and accepted as-is by decision —
the fix scope excluded Info findings.

**Verification after fixes:** `npx tsc --noEmit` passes (exit 0);
`npx jest --ci --silent` passes (5 suites, 64 tests, 0 failures).

_Reviewed: 2026-08-07T12:00:00Z (initial) / 2026-08-07T01:11:00Z (post-fix re-review)_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
_Status after fix pass: clean_
