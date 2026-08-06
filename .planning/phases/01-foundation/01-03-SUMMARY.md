---
phase: 01-foundation
plan: 01-03
subsystem: data-layer
tags: [money, dates, firestore, security-rules, composite-index, uid-scoping, tdd, jest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: 01-01 Firebase singletons (app/auth/db) + jest-expo infra; 01-02 AuthProvider + auth gate
provides:
  - Deterministic integer-cents money utilities (formatCents/parsePesoInput) — NFR-03, zero float math, no Intl
  - Local-calendar date utilities (toDateString/today/isValid/addDays/compare/monthRange) — NFR-04, no UTC slicing
  - Centralized uid-scoped query builders (queries.ts) — NFR-01, every builder starts with where("uid","==",uid)
  - Console-ready deployment artifacts: deploy/firestore.rules (backend-schema.md verbatim) + deploy/composite-index.md
  - COVERAGE.md Firebase JS SDK API coverage matrix (10 rows, deferred deployment recorded)
affects: [phases 2-6 — all Firestore queries must go through queries.ts; entriesByType needs the composite index; rules deployment gate re-opens for console]

# Tech tracking
tech-stack:
  added: [none — no new packages; deploy/ directory with rules + index artifacts]
  patterns: [integer-cents string math (never floats), local Date math (never UTC slicing), query-constraint internals testing (q._query.filters), uid clause FIRST in every builder, byte-faithful rules artifact from backend-schema.md]

key-files:
  created: [src/lib/money.ts, src/lib/dates.ts, src/lib/__tests__/money-test.ts, src/lib/__tests__/dates-test.ts, src/firebase/queries.ts, src/firebase/__tests__/queries-test.ts, deploy/firestore.rules, deploy/composite-index.md]
  modified: [.planning/phases/01-foundation/COVERAGE.md]

key-decisions:
  - "Task 3 console deployment DEFERRED by user (option-c variant): rules/index/seed artifacts written, nothing deployed, no firebase CLI calls — deferral recorded in SUMMARY + artifacts"
  - "incomeCategories rules shorthand (backend-schema.md line 90) kept byte-faithful; deploy-time note flags that a comment-only match denies all access — human must expand before pasting"
  - "Query tests assert via q._query.filters/explicitOrderBy/limit internals (RESEARCH OQ3) — no emulator; verified against firebase 12.17.1 installed internals"

patterns-established:
  - "String-split money parsing: Number(w)*100 + padded fraction — never parseFloat(x)*100 (NFR-03)"
  - "Local calendar components only: getFullYear/getMonth/getDate, never toISOString (NFR-04)"
  - "Every query builder starts with where('uid','==',uid) — rules are not filters (NFR-01)"

requirements-completed: [NFR-01, NFR-03, NFR-04, NFR-06]

coverage:
  - id: D1
    description: "Deterministic integer-cents money utilities — formatCents renders '₱ 1,234.56' with thousands separators and padded fractions, no Intl/float math; parsePesoInput string-split math with 2-decimal validation"
    requirement: NFR-03
    verification:
      - kind: unit
        ref: "src/lib/__tests__/money-test.ts#formatCents/parsePesoInput suites (17 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Local-calendar date utilities — toDateString/today from local components, isValid round-trip rejects 2026-02-30, addDays/monthRange local Date math, compare lexicographic"
    requirement: NFR-04
    verification:
      - kind: unit
        ref: "src/lib/__tests__/dates-test.ts#full suite (22 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "uid-scoped query builders — all 5 builders carry a uid equality filter FIRST (asserted via query internals); per-builder constraints (entriesByType type+date desc, entriesInRange date range, categoryInUse limit 1, categoriesOf collection)"
    requirement: NFR-01
    verification:
      - kind: unit
        ref: "src/firebase/__tests__/queries-test.ts#uid scoping + per-builder constraints (13 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Deployment artifacts: deploy/firestore.rules byte-faithful to backend-schema.md lines 68-91 + deploy/composite-index.md console steps for entries type ASC date DESC"
    requirement: NFR-06
    verification:
      - kind: other
        ref: "byte-diff script: 19/19 match-block lines identical to backend-schema.md"
        status: pass
    human_judgment: true
    rationale: "Console deployment of rules/index/seed is DEFERRED by user decision — server-side enforcement (NFR-06) cannot be verified until the human runs the console steps; artifacts only"
  - id: D5
    description: "COVERAGE.md 10-row Firebase API matrix refreshed — INTEGRATE rows map to shipped files (AuthProvider, app.ts, queries.ts, deploy artifacts); OPT-OUT dispositions match phase plan"
    verification:
      - kind: other
        ref: "manual row-by-row audit vs shipped files on disk"
        status: pass
    human_judgment: false

# Metrics
duration: 42min
completed: 2026-08-07
status: complete
---

# Phase 01 Foundation: Plan 01-03 Summary

**Integer-cents money + local-date utilities, uid-scoped Firestore query builders (all 5 with `where("uid","==",uid)` first), and console-ready rules/composite-index artifacts — with console deployment deferred by user decision**

## Performance

- **Duration:** 42 min
- **Started:** 2026-08-07T09:58:00+08:00
- **Completed:** 2026-08-07T10:40:00+08:00
- **Tasks:** 3 (Task 1 TDD, Task 2 TDD + artifacts, Task 3 checkpoint — pre-resolved defer)
- **Files modified:** 8 created + 1 modified

## Accomplishments

- **NFR-03 money.ts**: `formatCents` — `Math.floor` integer division, regex thousands grouping, padded fraction, "₱ " prefix, negative sign; `parsePesoInput` — strips ₱/P/p/commas/spaces, `/^\d+(\.\d{0,2})?$/` validation, **string-split math to integer cents** (never float). Zero imports, zero Intl.
- **NFR-04 dates.ts**: `toDateString`/`today` from local components (getFullYear/getMonth/getDate — no UTC slicing), `isValid` format regex + round-trip Date construction (rejects 2026-02-30, 2026-13-01, 2026-1-1, garbage), `addDays`/`monthRange` local Date math (leap-year aware), `compare` lexicographic. Zero imports.
- **NFR-01 queries.ts**: `userDoc`, `entriesBase`, `entriesByType` (type constraint + `orderBy("date","desc")` — composite index dependency), `entriesInRange` (date >= / <=), `categoryInUse` (limit 1), `categoriesOf` (typed collection). Every builder starts with `where("uid","==",uid)`; imports `db` from `./app`, never initializes Firestore.
- **Tests**: 52 new tests (17 money + 22 dates + 13 queries) via query-constraint internals (`q._query.filters`/`explicitOrderBy`/`limit` — RESEARCH OQ3), verified against installed firebase 12.17.1 internals. Full suite 63/63 green.
- **Deployment artifacts**: `deploy/firestore.rules` (match blocks byte-faithful to backend-schema.md lines 68-91, diff-verified, console-paste-ready in service wrapper) + `deploy/composite-index.md` (console steps for `entries: type ASC, date DESC`, self-linking error behavior).
- **COVERAGE.md refreshed**: 10-row matrix — rules/index rows now record **deferred deployment**; every INTEGRATE row maps to a shipped file on disk.

## Task Commits

1. **Task 1: money/dates utilities (TDD)** — `0fb80c3` (test: failing money/date utility tests) + `7dd7f0f` (feat: implement money and date utilities)
2. **Task 2: uid-scoped query builders (TDD)** — `b31aeab` (test: failing uid-scoped query tests) + `29d3cc7` (feat: implement uid-scoped query builders)
3. **Task 2 (artifacts): rules + index + COVERAGE.md** — `b3d2a53` (feat: add firestore rules and index deployment artifacts)
4. **Task 3: checkpoint — deferred (user decision), no commit**

## Files Created/Modified

- `src/lib/money.ts` — formatCents/parsePesoInput (integer cents, no Intl, no floats)
- `src/lib/__tests__/money-test.ts` — 17 NFR-03 cases incl. negative, large, 3-decimal rejection, float-drift impossibility
- `src/lib/dates.ts` — toDateString/today/isValid/addDays/compare/monthRange (local only)
- `src/lib/__tests__/dates-test.ts` — 22 NFR-04 cases incl. leap day, month/year boundaries, near-midnight safe today()
- `src/firebase/queries.ts` — 6 uid-scoped builders + userDoc
- `src/firebase/__tests__/queries-test.ts` — 13 NFR-01 cases via `_query` internals
- `deploy/firestore.rules` — backend-schema.md verbatim + deploy-time notes
- `deploy/composite-index.md` — console steps + deferral status
- `.planning/phases/01-foundation/COVERAGE.md` — refreshed (modified)

## Decisions Made

- **Console deployment deferred (Task 3, user decision — option-c variant):** rules publish, composite-index creation, and default-account seed all recorded as artifacts only. No firebase CLI calls, no console actions, no seeding. NFR-06 stays unenforced server-side until the human runs the console steps; the cross-account backstop and AUTH-01/02/03 device checks remain blocked on it (precondition: real Firebase config from 01-01 Task 2, still deferred).
- **incomeCategories shorthand preserved byte-faithful** — backend-schema.md line 90 is `match /incomeCategories/{id} { /* identical to expenseCategories */ }`; kept verbatim per plan instruction, but flagged in the rules file header: a comment-only match block denies ALL access, so the human must expand it before pasting into the console.
- **Query internals assertion approach (OQ3)** — tests read `q._query.filters` (field path segments + op + protobuf-style value), `explicitOrderBy`, `limit`; helper `hasUidFilter` proves the uid equality exists and is first. Verified against the installed SDK's actual structure — no emulator needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error in queries-test helper**
- **Found during:** Task 2 verification (`tsc --noEmit`)
- **Issue:** `filterFields` returned `(string | null)[]` but was typed `string[]` — TS2322 under strict mode
- **Fix:** Corrected return type annotation to `(string | null)[]`
- **Files modified:** src/firebase/__tests__/queries-test.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `b3d2a53` (folded into Task 2 artifacts commit)

**2. [Rule 2 - Missing Critical] Comment-only incomeCategories match block would deny all access if deployed**
- **Found during:** Task 2 artifact review
- **Issue:** backend-schema.md's `match /incomeCategories/{id} { /* identical to expenseCategories */ }` is shorthand, not deployable rules — a match block with no allow statements denies every read/write to income categories
- **Fix:** Kept the block byte-faithful (plan contract), added a prominent DEPLOY-TIME NOTE in the file header instructing the human to expand it to the expenseCategories allow-set before pasting
- **Files modified:** deploy/firestore.rules
- **Verification:** byte-diff against backend-schema.md still passes (comments are outside match blocks)
- **Committed in:** `b3d2a53`

**3. [Rule 1 - Style] expo lint warnings on Array<T> syntax**
- **Found during:** Task 2 verification (`npx expo lint`)
- **Issue:** 3 `@typescript-eslint/array-type` warnings (0 errors) in queries-test.ts
- **Fix:** Converted to `T[]` syntax
- **Files modified:** src/firebase/__tests__/queries-test.ts
- **Verification:** `npx expo lint` clean
- **Committed in:** `b3d2a53`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2)
**Impact on plan:** All fixes were within-task correctness/quality fixes; no scope creep. Artifact contents unchanged in intent.

## Issues Encountered

- **Byte-faithfulness script edge:** initial inline node one-liner broke on quoting in bash; used a temp script file instead — verification approach adjusted, no product impact.
- **COVERAGE.md drift:** drafted at plan time said rules "deployed via Firebase console" — reality (deferred) updated in rows 9-10; no other row needed changes (all INTEGRATE symbols verified on disk).

## User Setup Required

**Firebase console deployment (deferred — one-way door, re-opened):**
- **Precondition:** real `firebaseConfig` values in `src/firebase/config.ts` (01-01 Task 2, still deferred)
- Publish `deploy/firestore.rules` — **expand the incomeCategories block first** (see header note)
- Create composite index `entries: type ASC, date DESC` per `deploy/composite-index.md`
- Seed default account (auth user + `users/{uid}` with `isDefault: true`) with admin privilege
- Then: NFR-06 backstop (second-account isolation on device) + AUTH-01/02/03 device checks

## Next Phase Readiness

- Phase 2 (categories) and Phase 3 (entries) get their query surface: `categoriesOf`, `entriesBase`, `entriesByType`, `entriesInRange`, `categoryInUse` — all uid-scoped and unit-tested
- `entriesByType` will fail with a self-linking index error until the composite index is created in the console (documented in deploy/composite-index.md)
- Phase 3 write paths must use the same `db` singleton; rules (deploy/firestore.rules) are the server enforcement point — deployment still pending user action
- All later phases MUST construct queries only through `queries.ts` (NFR-01 prohibition) and format money only via `money.ts` (NFR-03)

---
*Phase: 01-foundation*
*Completed: 2026-08-07*

## Self-Check: PASSED

- All 9 created/modified files verified on disk (money.ts, dates.ts, money-test.ts, dates-test.ts, queries.ts, queries-test.ts, firestore.rules, composite-index.md, COVERAGE.md)
- All 5 task commits verified in git log: `0fb80c3` (test money/dates), `7dd7f0f` (feat money/dates), `b31aeab` (test queries), `29d3cc7` (feat queries), `b3d2a53` (feat rules/index/COVERAGE)
- `npx jest --ci --silent`: 63/63 pass (11 prior + 52 new)
- `npx tsc --noEmit`: exit 0
- `npx expo lint`: 0 errors, 0 warnings
- STATE.md / ROADMAP.md untouched (orchestrator-owned)
