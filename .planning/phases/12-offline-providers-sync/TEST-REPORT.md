# Phase 12: Test Generation Report

**Generated:** 2026-08-12
**Workflow:** gsd-add-tests (auto-approve semantics)
**Classification:** unit only (React Native app — no browser/E2E harness)

## Classification

| File | Class | Action |
|------|-------|--------|
| `src/sync/idMapping.ts` | TDD | New `idMapping-test.ts` (no direct tests existed) |
| `src/sync/syncMetadata.ts` | TDD | New `syncMetadata-test.ts` (only indirect coverage via fullSync) |
| `src/components/SyncButton.tsx` | TDD | New `SyncButton.test.tsx` (WR-04 badge refresh untested) |
| `src/sync/syncService.ts` | TDD | Extended `syncService-test.ts` — scheduledEntries push/pull, defensive paths, WR-01 categories, uid chaining |
| `src/entries/EntriesProvider.tsx` | TDD | Extended — sync(), auth guards, no-op update, updatedAt bump, copyEntry not found |
| `src/categories/CategoriesProvider.tsx` | TDD | Extended — updateCategory (had zero coverage) |
| `src/sync/AutoSync.tsx` | Skip | AppState behavior requires on-device Expo Go (SUMMARY D6) |
| `App.tsx`, Firestore rules/indexes | Skip | Glue/config |

## Results

| Category | Generated | Passing | Failing | Blocked |
|----------|-----------|---------|---------|---------|
| Unit (new files) | 23 | 23 | 0 | 0 |
| Unit (extended) | 28 | 28 | 0 | 0 |
| **Total new** | **51** | **51** | **0** | **0** |

Suite totals after generation (targeted run: `src/sync|src/entries|src/categories|src/components/__tests__/SyncButton`):

| Suite | Before | After |
|-------|--------|-------|
| syncService-test | 22 | 36 |
| idMapping-test | — | 10 |
| syncMetadata-test | — | 4 |
| EntriesProvider.test | 3 | 11 |
| CategoriesProvider.test | 13 | 19 |
| SyncButton.test | — | 9 |
| **Total** | **38** | **89** |

Full-suite run: 266/266 runnable tests pass. The 9 failing suites are the
pre-existing env-gated suites (transitively load `src/firebase/app.ts`,
fail with `auth/invalid-api-key` when Firebase env vars are absent) —
documented as pre-existing in 12-01-SUMMARY.md and identical to HEAD~9.
`npx tsc --noEmit` exits 0.

## Files Created/Modified

Created:
- `src/sync/__tests__/idMapping-test.ts` — 10 tests (temp scheme + transactional remap across collections, uid scoping, rollback, unknown collection no-op)
- `src/sync/__tests__/syncMetadata-test.ts` — 4 tests (null default, insert, ON CONFLICT upsert, uid isolation)
- `src/components/__tests__/SyncButton.test.tsx` — 9 tests (pending badge incl. 99+ cap, last-sync line, press→both syncs, Alert on failure, disabled while syncing, no-user guards)

Modified:
- `src/sync/__tests__/syncService-test.ts` — +14 tests (scheduled create/update/delete push, non-temp create setDoc path, unknown-collection drop, sync marker drop, empty queue, WR-01 for categories, scheduled LWW merge/reconcile/WR-02 skip, scheduled best-effort error swallow, push-fail-then-pull fullSync, different-uid chaining)
- `src/entries/__tests__/EntriesProvider.test.tsx` — +8 tests (sync gate + isSyncing, sync error → lastError + rethrow, no-user no-op, all-write auth guards, empty-update no-op, updatedAt bump + synced=0, copyEntry not found, clearError)
- `src/categories/__tests__/CategoriesProvider.test.tsx` — +6 tests (trimmed rename + queue update + state mirror, icon-only update, duplicate rename, empty name, no-field no-op, auth guard)
- `jest/sqlite-mock.ts` — fixed transaction-rollback restore bug (see Bugs below)

## Coverage Gaps

- **AutoSync (AppState foreground listener)** — on-device only (SUMMARY D6); jest cannot exercise AppState + real provider tree.
- **SyncButton timeAgo buckets** (`h ago` / `d ago`) — internal helper; only "just now" observed via rendered status line.
- **On-device offline flows** (kill/reopen, two-device propagation) — manual Tasks 11–12 in SUMMARY.
- **mapTempId crash-window** (IN-02: queue docId rewrite) — requires multi-statement crash injection across a kill boundary; not representable in jest.

## Bugs Discovered

1. **[Test-infrastructure bug] `jest/sqlite-mock.ts` transaction rollback restored rows incorrectly**
   - The `withTransactionAsync` rollback path assigned the parsed table descriptor (`{autoincrement, pk, rows}`) to `table.rows` instead of `table.rows.rows`, so after any failed transaction every table read threw `TypeError: table.rows.filter is not a function`.
   - No existing test ever exercised a *failed* transaction, so the mock's rollback was silently broken — it also means the db layer's rollback contract was never actually verified under test.
   - Fixed in `jest/sqlite-mock.ts` (restore uses `restored[key].rows` + preserved descriptor fields). The new idMapping rollback test now proves the transactional remap contract.

2. No implementation bugs discovered — all new tests passed against the phase 12 implementation on first assertions (after fixing the 3 test-authoring errors below).

### Test-authoring errors fixed during generation (not implementation bugs)
- `mockRejectedValueOnce` on `getDocs` targets the *first* Firestore query (entries incremental), not the scheduled pull — switched to a conditional `mockImplementationOnce` keyed on `q._coll`.
- Duplicate PK when inserting same-id rows for a second uid in the sqlite mock (PK is `id`, not `uid`+`id`) — test revised to scope via the uid-scoped reference UPDATE instead.
- `@expo/vector-icons` mock used `RN.createElement` (not exported) — uses `require("react").createElement` per EntryForm.test convention.
