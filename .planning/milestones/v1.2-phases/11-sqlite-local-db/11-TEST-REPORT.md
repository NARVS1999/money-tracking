# Phase 11: Test Report (add-tests)

**Generated:** 2026-08-12
**Command:** gsd-add-tests 11 --auto
**Coverage target:** `src/db/*` SQLite local-first layer (OFFL-01)

## Results

| Category | Generated | Passing | Failing | Blocked |
|----------|-----------|---------|---------|---------|
| Unit     | 86        | 86      | 0       | 0       |
| E2E      | 0         | —       | —       | —       |

## Files Created

| File | Tests | Coverage |
|------|-------|----------|
| `src/db/__tests__/schema-test.ts` | 8 | DDL contract: 4 tables, uid columns, indexes, `synced`/`isActive` defaults, SCHEMA_VERSION |
| `src/db/__tests__/database-test.ts` | 6 | `getDb()` lazy init, open-once caching, failure-reset retry (open + schema), `resetDbForTesting()` |
| `src/db/__tests__/entries-test.ts` | 16 | insert defaults, ordering, uid scoping, type filter, update whitelist + forced `synced=0` (WR-03), `synced:1`-only path, (id,uid)-scoped delete/markSynced, unsynced getter, hasEntries |
| `src/db/__tests__/categories-test.ts` | 14 | type-column normalization, uid scoping, WR-03/whitelist, (id,uid) scoping, unsynced getter, hasCategories |
| `src/db/__tests__/scheduled-test.ts` | 15 | template defaults (isActive/endDate/lastGenerated), `getActiveScheduled` (Phase 13 input), WR-03/whitelist, (id,uid) scoping, null endDate clear |
| `src/db/__tests__/syncQueue-test.ts` | 9 | FIFO autoincrement, uid scoping (CR-01), dequeue/clearQueue/removeByDocId isolation, timestamp |
| `src/db/__tests__/seed-test.ts` | 18 | idempotent skip, per-table seeding (WR-02), collection/where queries, Timestamp→ms, type coercion, malformed defaults, PK-conflict skip, non-PK error propagation |
| `jest/sqlite-mock.ts` | — | In-memory expo-sqlite mock (shared store, `?`+literal binds, PK conflicts, AUTOINCREMENT, snapshot/rollback transactions) |

## Test Commands

- Unit: `npx jest --testPathPattern="src/db/__tests__"` — **7 suites, 86 tests, all green**
- Full suite: no regression — same 9 pre-existing env-var failures as baseline (suites importing the App/firebase graph; needs `EXPO_PUBLIC_FIREBASE_*` env vars, logged in `deferred-items.md`)
- `npx tsc --noEmit` — clean (0 errors)
- `npx eslint` on new files — 0 errors (24 warnings: `require()` in jest.mock factories, same pattern as existing `exportPipeline-test.ts`)

## Coverage Gaps

- **E2E:** none generated — this is a React Native app; no browser E2E harness exists. On-device behavior (D6: sign-in seeds SQLite, kill/reopen persistence, re-seed on new device) remains manual verification via Expo Go QR (`WINDOWS.md` open item 1).
- **App.tsx `SeedOnSignIn` wiring:** covered only by the existing module-load smoke test, which requires Firebase env vars to run.
- **`withTransactionAsync` rollback:** the seed test mocks the transaction wrapper (asserts error propagation); rollback restore itself is implemented in `jest/sqlite-mock.ts` but not asserted end-to-end — a Phase 12 sync-service test can exercise it against the real mock store.
- **IN-04 (undefined bind values in `update*` changes):** deliberately not asserted — the deferred review finding says `updateEntry(uid, id, { description: undefined })` would bind `undefined` and throw at runtime; the mock faithfully reproduces that throw. Fix deferred to Phase 12 provider work (per 11-REVIEW.md).

## Bugs Discovered

None in the phase-11 implementation — all 86 tests passed against the shipped code. (Test-writing failures were mock/test bugs: require-path depth, greedy WHERE regex, PK collisions in fixtures, babel-hoist on class param properties — all fixed.)

## Classification Log

- TDD: `database.ts`, `schema.ts`, `entries.ts`, `categories.ts`, `scheduled.ts`, `syncQueue.ts`, `seed.ts` (7)
- E2E: none
- Skip: `App.tsx` (glue wiring; covered by smoke-test)
