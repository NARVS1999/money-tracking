---
phase: 11-sqlite-local-db
verified: 2026-08-12T12:00:00Z
status: human_needed
score: 8/9 must-haves verified
behavior_unverified: 1 # SC8 — App.tsx seed trigger wired but not exercised by an automated test (smoke test requires Firebase env vars); on-device proof is a human item
overrides_applied: 0
behavior_unverified_items:
  - truth: "App.tsx wires seed on auth state change: empty SQLite → seed, populated → skip"
    test: "Sign in on the phone via Expo Go; watch the console for `[sqlite] seeded N entries, M categories` on the first sign-in and silence (skip) on the next"
    expected: "First sign-in logs a seeded count; subsequent sign-ins skip; SQLite now holds the ledger"
    why_human: "SeedOnSignIn's useEffect-on-user trigger is present and wired (App.tsx:31-53, mounted under AuthProvider) and the seed's skip logic is unit-tested (seed-test.ts), but no automated test exercises the React hook firing on an auth state change — that requires a device session"
human_verification:
  - test: "Sign in on the phone (Expo Go QR). First sign-in: console shows `[sqlite] seeded N entries, M categories`; second sign-in on the same device: seed skips silently"
    expected: "SQLite is seeded from Firestore exactly once per device; subsequent sign-ins do not duplicate data"
    why_human: "On-device behavior of seedFromFirestore against real Firestore + real expo-sqlite — WINDOWS.md open item 1 (Task 11); unit tests exercise the logic against a mock, not the device runtime"
  - test: "Kill the app, enable airplane mode, reopen. Entries and categories from the last sync must still render"
    expected: "Data persists from SQLite with no network — per-session offline (project's documented Expo Go limitation)"
    why_human: "Persistence across process kill requires a real device; jest cannot restart the app process"
  - test: "Sign in on a second device (new device). Seed runs again; entries appear without duplicates"
    expected: "Idempotent reseed — Firestore doc ids as TEXT PKs prevent duplication"
    why_human: "Multi-device behavior requires two physical devices / fresh Expo Go installs"
  - test: "NFR-16: with ~1000 entries, app startup + SQLite load feels under 1 second"
    expected: "No perceptible startup delay; indexed reads (idx_entries_uid_date) keep the load fast"
    why_human: "Performance feel is a device measurement; no benchmark harness exists in this project"
---

# Phase 11: SQLite Local Database Verification Report

**Phase Goal:** Establish expo-sqlite as the local source of truth — database schema (entries, categories, scheduledEntries, syncQueue), CRUD modules, and Firestore seed on first sign-in.
**Verified:** 2026-08-12
**Status:** human_needed
**Re-verification:** No — initial verification

## User Flow Coverage

Phase is `mode: mvp` in ROADMAP.md. Note: the goal is an infrastructure statement, not a user-story-formatted goal ("As a … so that …") — discrepancy surfaced per `references/verify-mvp-mode.md` (planner should reformat via `/gsd mvp-phase` if user-story framing is wanted). The end-user flow this phase enables:

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Sign in | Auth session established; seed fires on auth state change | App.tsx:31-53 (`SeedOnSignIn`, `useEffect(..., [user])`, mounted at App.tsx:93) | ✓ wired |
| First sign-in seeds | Firestore entries + categories copied into SQLite; log line `[sqlite] seeded N entries, M categories` | src/db/seed.ts:76-151; App.tsx:37-41 | ✓ wired (+ unit-tested via seed-test.ts) |
| Repeat sign-in skips | Idempotent — no duplicate rows | seed.ts fast path (lines 78-84) + per-table transactional guard | ✓ unit-tested |
| Kill + reopen offline | Data persists from SQLite without network | expo-sqlite `money-tracking.db` persisted store; DDL idempotent | ⚠️ on-device proof required (human item 2) |
| New device reseed | Seed runs again, doc-id PKs prevent duplicates | seed.ts + TEXT PK schema (schema.ts) | ⚠️ on-device proof required (human item 3) |

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | expo-sqlite installed — bundled in Expo Go SDK 57, no dev build | ✓ VERIFIED | package.json: `"expo-sqlite": "~57.0.1"`; `expo/bundledNativeModules.json` also `~57.0.1` — exact SDK 57 Expo Go pin, no native module, no dev build. Method deviation: plain `npm install` instead of `npx expo install` (npm 11.18 EALLOWSCRIPTS; same resolved pin, verified via `expo install --check` per SUMMARY) |
| 2 | `src/db/database.ts` initializes the DB and creates tables on first run (entries, categories, scheduledEntries, syncQueue) | ✓ VERIFIED | database.ts:15-28 (lazy `getDb()` → `openDatabaseAsync` + `execAsync(SCHEMA_SQL)`, failure-reset); schema.ts 4 tables + uid indexes, `IF NOT EXISTS` idempotent. Tests: database-test (6), schema-test (8) pass |
| 3 | `src/db/entries.ts` SQLite CRUD: getAllEntries, getEntriesByType, insertEntry, updateEntry, deleteEntry, getUnsyncedEntries, markSynced | ✓ VERIFIED | All 7 exported (entries.ts:38-130), uid-scoped, column-whitelist updates (WR-03 fix: forced `synced=0`). Tests: entries-test (16) pass |
| 4 | `src/db/categories.ts` same CRUD surface | ✓ VERIFIED | All 7 exported (categories.ts:25-116), `type` column normalizes the two Firestore collections. Tests: categories-test (14) pass |
| 5 | `src/db/scheduled.ts` CRUD for scheduled entries (all/active variants) | ✓ VERIFIED | getAllScheduled + getActiveScheduled (scheduled.ts:45-59) + full CRUD; isActive/endDate/lastGenerated fields per plan. Tests: scheduled-test (15) pass |
| 6 | `src/db/syncQueue.ts` enqueue/dequeue/getQueue/clearQueue/removeByDocId | ✓ VERIFIED | All 5 exported, uid-scoped after CR-01 fix (schema uid column + composite index). Tests: syncQueue-test (9) pass |
| 7 | `seedFromFirestore(uid)` fetches all entries/categories from Firestore into SQLite — idempotent (skips if uid already seeded) | ✓ VERIFIED | seed.ts:76-151 — parallel fetch (entries + expenseCategories + incomeCategories, `where uid`), fast-path skip, per-table transactional check+insert (WR-02 fix), PK-conflict tolerance, SeedResult. Data flow verified: collection names match src/firebase/queries.ts:21,46; `db` from src/firebase/app.ts:27. Tests: seed-test (18) pass, incl. idempotent-skip and per-table transitions |
| 8 | App.tsx wires seed on auth state change: empty SQLite → seed, populated → skip | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Wiring present: `SeedOnSignIn` (App.tsx:31-53) mounted under AuthProvider (App.tsx:93), `useEffect` keyed on `user`, calls `seedFromFirestore(user.uid)`, skip logic inside seed. No automated test exercises the hook firing on a real auth state change (smoke test imports only the module graph and needs Firebase env vars) → on-device proof is human item 1 |
| 9 | `npx tsc --noEmit` passes; manual verification: sign-in seeds data, kill+reopen persists from SQLite | ✓ VERIFIED (automated half) | `npx tsc --noEmit` exits 0 (run 2026-08-12). Manual half = human items 1-3 below |

**Score:** 8/9 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/db/schema.ts` | 4-table DDL, uid indexes, synced flags | ✓ VERIFIED | entries/categories/scheduledEntries/syncQueue per plan columns; INTEGER ms timestamps; SCHEMA_VERSION 1 |
| `src/db/database.ts` | Lazy init + idempotent schema on first run | ✓ VERIFIED | `getDb()` singleton, failure-reset, `resetDbForTesting()`; zero module-load side effects |
| `src/db/entries.ts` | Full CRUD surface | ✓ VERIFIED | 7 functions + hasEntries; uid-scoped SQL; whitelist updates |
| `src/db/categories.ts` | Full CRUD surface | ✓ VERIFIED | 7 functions + hasCategories; type-column normalization |
| `src/db/scheduled.ts` | Full CRUD surface (all/active) | ✓ VERIFIED | 7 functions + hasScheduled; getActiveScheduled ready for Phase 13 |
| `src/db/syncQueue.ts` | enqueue/dequeue/getQueue/clearQueue/removeByDocId | ✓ VERIFIED | uid-scoped FIFO, autoincrement, ms timestamps |
| `src/db/seed.ts` | Idempotent Firestore→SQLite seed | ✓ VERIFIED | Transactional per-table seed; PK-conflict skip; SeedResult |
| `App.tsx` | SeedOnSignIn wiring | ✓ VERIFIED (wired) | Mounted under AuthProvider; behavior on-device (human item) |
| `package.json` | expo-sqlite dependency | ✓ VERIFIED | `~57.0.1` == Expo Go SDK 57 bundled pin |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| App.tsx → src/db/seed.ts | `import { seedFromFirestore }` + `SeedOnSignIn` useEffect | WIRED | App.tsx:17,37; seed runs on `user` change |
| seed.ts → src/firebase/app.ts | `import { db }` (firestore instance) | WIRED | seed.ts:19; app.ts:27 exports initialized Firestore |
| seed.ts → Firestore collections | `collection(db, "entries")`, `expenseCategories`, `incomeCategories` with `where("uid", "==", uid)` | WIRED | seed.ts:60,88-90; collection names match src/firebase/queries.ts:21,46 |
| seed.ts → entries/categories modules | `hasEntries`/`insertEntry`/`hasCategories`/`insertCategory` | WIRED | seed.ts:20-30; inserts inside `withTransactionAsync` |
| database.ts → schema.ts | `execAsync(SCHEMA_SQL)` on first open | WIRED | database.ts:19; idempotent IF NOT EXISTS |
| All CRUD modules → database.ts | `getDb()` per call | WIRED | entries/categories/scheduled/syncQueue all call getDb() |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| seed.ts entries fetch | `entriesSnap` | Firestore `entries` collection, `where uid` | ✓ real query (getDocs + where), no static fallback | ✓ FLOWING |
| seed.ts categories fetch | `expenseCats`/`incomeCats` | Firestore `expenseCategories`/`incomeCategories`, `where uid` | ✓ real query | ✓ FLOWING |
| schema/database | tables | DDL executed on first `getDb()` | ✓ real SQLite store (`money-tracking.db`) | ✓ FLOWING |
| App.tsx seed trigger | `user.uid` | AuthProvider auth state | ✓ real authenticated uid | ✓ FLOWING |

### Automated Checks

| Check | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| DB-layer unit tests (7 suites) | `npx jest --testPathPattern="src/db/__tests__"` | 7 suites passed, 86/86 tests passed, 0 failures (3.4s) | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Debt markers | grep TBD/FIXME/XXX/PLACEHOLDER in src/db/*.ts, App.tsx | none found | ✓ PASS |
| Commit integrity | `git log` for claimed task/fix commits | all present (15 matched: 10 task commits + 5 review-fix commits) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| OFFL-01 | 11-01-PLAN | expo-sqlite as local source of truth for entries/categories/scheduled entries | ✓ SATISFIED (phase scope) | 4-table schema + uid-scoped CRUD modules + sync queue in place; full "all reads come from SQLite" provider switchover is Phase 12's goal (OFFL-01 final intent lands there) |
| OFFL-02 | 11-01-PLAN | First sign-in seeds Firestore data into local SQLite | ✓ SATISFIED | seedFromFirestore wired to sign-in (App.tsx); idempotent, unit-tested (18 tests); on-device confirmation in human items |
| NFR-11 | 11-01-PLAN | expo-sqlite bundled in Expo Go SDK 57 — no dev build | ✓ SATISFIED | `~57.0.1` matches `expo/bundledNativeModules.json`; pure JS-compatible module |
| NFR-12 | 11-01-PLAN | SQLite ops do not block the UI — async reads, minimal sync writes | ✓ SATISFIED | Entire API is async (`getAllAsync`/`runAsync`); lazy singleton; no synchronous blocking calls anywhere in src/db |
| NFR-13 | 11-01-PLAN | Existing entry/category data preserved during migration to SQLite | ✓ SATISFIED | Seed imports existing Firestore ledger verbatim (doc ids as PKs, no loss/duplication); note: REQUIREMENTS.md traceability table labels NFR-13 as "Phase 11: Migration" — phase name mismatch vs ROADMAP ("SQLite Local Database"); no separate migration phase exists, flag for planner reconciliation |
| NFR-16 | 11-01-PLAN | App startup SQLite load under 1 second for up to 1000 entries | ? NEEDS HUMAN | Indexed reads (`idx_entries_uid_date`, `idx_categories_uid`) and lazy init support the budget, but no benchmark exists — device measurement required (human item 4) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| App.tsx | 43-46 | Empty `.catch(() => {})` swallows seed failures silently (IN-03) | ℹ️ Info | Failure only observable by absence of the `[sqlite] seeded` log; review-recommended `console.warn` fix deferred, intentionally |
| src/db/*.ts | — | `undefined` bind values in update paths (IN-04) | ℹ️ Info | Would throw at runtime if a caller passes `undefined`; deliberately not asserted (per TEST-REPORT), fix deferred to Phase 12 provider work |
| seed.ts | 39-41 | Silent coercion of malformed cloud data (IN-02) | ℹ️ Info | `toMillis`/type/amount fallbacks default silently; review recommended logging; deferred |
| — | — | `updatedAt` has no cloud counterpart yet (IN-05) | ℹ️ Info | LWW foundation for Phase 12 — noted for the Phase 12 plan |

No blockers. No debt markers (TBD/FIXME/XXX) in phase-modified files. The 2 Critical + 3 Warning review findings (CR-01, CR-02, WR-01, WR-02, WR-03) were fixed in commits `171c727`, `369b8af`, `4f5d528`, `b172297`, `ec41063` — all verified in the current code.

### Human Verification Required

1. **Sign-in seeds SQLite (D6 / SC8 runtime)**
   **Test:** Sign in on the phone via Expo Go QR. First sign-in: console should log `[sqlite] seeded N entries, M categories`. Sign out and sign back in: seed should skip silently.
   **Expected:** Ledger seeded exactly once per device; no duplicate rows.
   **Why human:** Real Firestore + real expo-sqlite on device — WINDOWS.md open item 1 (Task 11 manual verification). Seed logic is unit-tested; the on-device runtime is not.

2. **Kill + reopen persistence (offline)**
   **Test:** Kill the app, enable airplane mode, reopen.
   **Expected:** Entries/categories from the last sync still render from SQLite (per-session offline — the documented Expo Go limitation).
   **Why human:** Process-kill persistence requires a real device session; jest cannot restart the app.

3. **New-device reseed idempotency**
   **Test:** Sign in on a second device (fresh install).
   **Expected:** Seed runs again; entries appear without duplicates (TEXT PK doc ids).
   **Why human:** Requires a second physical device / fresh Expo Go install.

4. **NFR-16 startup performance**
   **Test:** With ~1000 entries, measure app startup + SQLite load on device.
   **Expected:** Under 1 second; index-backed reads keep it fast.
   **Why human:** Performance feel is a device measurement; no benchmark harness exists.

### Gaps Summary

No gaps found. All 8 automated must-haves verified (86/86 tests pass, tsc clean); 1 truth (SC8) is wired but its runtime sign-in trigger needs on-device confirmation; the plan's own Task 11 manual verification items remain open (WINDOWS.md item 1). Per `human_verify_mode: end-of-phase` (config.json) these route to this report's human_verification list — status `human_needed`, not `passed`.

---

_Verified: 2026-08-12_
_Verifier: the agent (gsd-verifier)_
