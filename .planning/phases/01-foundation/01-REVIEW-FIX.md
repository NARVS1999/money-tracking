---
phase: 01-foundation
fixed_at: 2026-08-07T01:15:00Z
review_path: .planning/phases/01-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-08-07T01:15:00Z
**Source review:** `.planning/phases/01-foundation/01-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (1 Critical, 6 Warnings — Info excluded by scope decision)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Comment-only `incomeCategories` match block denies all access — artifact is not deploy-safe despite "deploy verbatim" instruction

**Files modified:** `deploy/firestore.rules`, `backend-schema.md`
**Commit:** `bb8068d`
**Applied fix:** Replaced the comment-only `match /incomeCategories/{id} { /* identical to expenseCategories */ }` block with the full allow-set mirroring `expenseCategories` (`read, update, delete` on `resource.data.uid == request.auth.uid`; `create` with the same uid guard). Rewrote the file header: removed the contradictory "deploy verbatim" + "expand before pasting" notes and the stale "amountCents hardening NOT approved" claim, replaced with a deploy-safe header stating the rules are byte-faithful to backend-schema.md (updated in the same change). Expanded the same block in `backend-schema.md:90` in lock-step, with a note explaining why the shorthand is not deploy-safe.

### WR-01: `entriesInRange` will fail at runtime — composite-index.md wrongly claims the automatic single-field date index suffices

**Files modified:** `deploy/composite-index.md`, `backend-schema.md`
**Commit:** `b18acf7`
**Applied fix:** Added a "Range index: `entries` — `uid ASC, date ASC`" section to `deploy/composite-index.md` with purpose, console steps, and a note that the automatic single-field `date` index does not cover a uid-equality + date-range query. Corrected the wrong "Range queries … need nothing here" claim in the "Why this index exists" section, and corrected the matching claims in `backend-schema.md` (query patterns line and Indexes table row).

### WR-02: Documented `type ASC, date DESC` index does not match `entriesByType`'s actual filters (uid equality omitted)

**Files modified:** `deploy/composite-index.md`, `backend-schema.md`, `src/firebase/queries.ts`
**Commits:** `40075f8` (doc + schema), `ffe8926` (stale comment in queries.ts)
**Applied fix:** Retitled the doc to "Composite Indexes: `entries`"; changed the tab-list index to `uid ASC, type ASC, date DESC` (uid equality column first) in the summary table, console steps, and verification text; added a per-builder table enumerating ALL builders in `src/firebase/queries.ts` (`userDoc`, `entriesBase`, `entriesByType`, `entriesInRange`, `categoryInUse`, `categoriesOf`) with their constraints and index requirements, explaining why `categoryInUse` needs no composite (index merging) and why `uid` must precede the orderBy/range columns. Updated `backend-schema.md`'s "Tab lists" pattern and Indexes table row. Corrected the stale `type ASC, date DESC` comment in `queries.ts:23`.

### WR-03: Rules allow the default account's own `users` doc to be deleted — "can never be deleted" is client-side-only (T-1-03)

**Files modified:** `deploy/firestore.rules`, `backend-schema.md`
**Commit:** `1ffbf6e`
**Applied fix:** Split the `users` match block: `allow read` stays uid-guarded (Account tab can read the profile), `allow delete` now requires `resource.data.uid == request.auth.uid && !resource.data.isDefault` — the seeded default account's `users` doc is undeletable server-side. Updated the schema rule and its note ("blocked only by app logic… in-app by design" → "blocked by rule") in lock-step.

### WR-04: Integer-cents invariant (NFR-03) is not enforced server-side — rules accept float `amountCents`

**Files modified:** `deploy/firestore.rules`, `backend-schema.md`
**Commit:** `ab8c524`
**Applied fix:** Added `&& request.resource.data.amountCents is int` to the entries create rule in `deploy/firestore.rules` (the hardening line previously documented as "NOT approved" is now approved and applied). Kept the diff minimal per the fix contract — no extra validations beyond the documented hardening line. Updated the file header (integer-cents invariant now enforced; removed the stale "NOT approved" note) and mirrored the rule in `backend-schema.md`.

### WR-05: `entriesInRange` accepts inverted/malformed ranges and silently returns wrong results

**Files modified:** `src/firebase/queries.ts`, `src/firebase/__tests__/queries-test.ts`
**Commit:** `4e04cfc`
**Applied fix:** `entriesInRange` now validates the range using `src/lib/dates.ts` (`isValid`/`compare`): throws `Error("entriesInRange: invalid range …")` on malformed, impossible, or inverted (start > end) dates — callers can no longer silently get an empty result set. The contract is explicitly documented in the builder's comment. Tests updated: the existing `entriesInRange(UID, "a", "b")` call (which now throws) switched to valid dates, and a new test covers inverted, non-`YYYY-MM-DD`, impossible-date, and start == end boundary cases.
**Status:** `fixed` (logic change verified by tsc + jest; contract decision — throw on invalid range — matches the fix scope's preferred option).

### WR-06: Query tests assert on private SDK internals (`q._query`) — suite breaks spuriously on any firebase 12.x bump

**Files modified:** `src/firebase/__tests__/queries-test.ts`
**Commit:** `35b8555`
**Applied fix:** Documented the semver risk in the test-file header: the private `q._query` shape, the `^12.17.1` pin, the silent-degradation failure mode (helper falls back to `{}`), and the migration path (Firestore emulator via `firebase emulators:exec` + `@firebase/rules-unit-testing` in CI). Internal assertions kept per the RESEARCH OQ3 resolution (internals over emulator for speed) — the finding's own fix guidance accepts a documentation-only resolution; pinning firebase exactly was rejected as it deviates from the AGENTS.md `^12.17.1` convention without removing the risk.

---

## Re-review verdict (iteration 1)

All 7 in-scope findings (CR-01, WR-01..WR-06) are resolved. `01-REVIEW.md`
frontmatter updated to `status: clean` (critical 0, warning 0, info 5, total 5;
the 5 Info findings remain accepted by scope decision). Re-review performed
in-process on the changed files (`deploy/firestore.rules`,
`deploy/composite-index.md`, `src/firebase/queries.ts`,
`src/firebase/__tests__/queries-test.ts`, plus `backend-schema.md` updated in
lock-step). Verification: `npx tsc --noEmit` exit 0; `npx jest --ci --silent`
5 suites / 64 tests passed.

---

_Fixed: 2026-08-07T01:15:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
