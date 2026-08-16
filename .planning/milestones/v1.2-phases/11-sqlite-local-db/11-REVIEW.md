---
phase: 11-sqlite-local-db
reviewed: 2026-08-12T04:10:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - App.tsx
  - src/db/categories.ts
  - src/db/database.ts
  - src/db/entries.ts
  - src/db/scheduled.ts
  - src/db/schema.ts
  - src/db/seed.ts
  - src/db/syncQueue.ts
findings:
  critical: 2
  warning: 3
  info: 5
  total: 10
status: fixed
fix_status:
  fixed: 5
  skipped: 0
  fixed_at: 2026-08-12T05:00:00Z
  fix_report: 11-REVIEW-FIX.md
---

# Phase 11: Code Review Report

**Reviewed:** 2026-08-12T04:10:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found → fixed (all 5 Critical/Warning findings resolved; see [11-REVIEW-FIX.md](11-REVIEW-FIX.md))

## Summary

Reviewed the Phase 11 SQLite local-first layer: 4-table schema, lazy-init connection singleton, uid-scoped CRUD modules for entries/categories/scheduled entries, sync queue, the Firestore→SQLite seed, and the App.tsx seed wiring. Cross-referenced against the Firebase layer (`src/firebase/queries.ts`, `src/firebase/app.ts`) and both providers to validate collection names, the cloud data model, and ownership-check precedents.

Overall the modules are cleanly structured, parameterized SQL is used throughout, the column-whitelist update pattern is a solid injection defense, and collection names match the Phase 10 query builders. However, the sync surface (queue + unsynced getters) is **not uid-scoped**, which becomes a cross-account data-corruption vector once Phase 12 drains it on a device where more than one account has ever signed in (sign-out is a supported flow — AccountScreen — and `signOut` does not clear SQLite). Two findings are classified Critical; three Warnings and five Info items follow.

## Critical Issues

### CR-01: syncQueue has no uid column — cross-account sync corruption on account switch

**File:** `src/db/schema.ts:67-73`, `src/db/syncQueue.ts:18-63`
**Issue:** The `syncQueue` table is the only table without a `uid` column, and every queue function (`enqueue`, `getQueue`, `dequeue`, `clearQueue`, `removeByDocId`) operates on the whole queue. The app supports signing out and signing in as a different account (AccountScreen sign-out; `signOut` in AuthProvider does not clear SQLite), so a device will accumulate rows for multiple uids. When Phase 12 drains the queue, there is no way to scope it to the signed-in uid — user A's offline creates would be pushed into user B's Firestore ledger (or fail with permission-denied after leaking data shape), and `clearQueue()` wipes both accounts' pending ops. The schema shipped in this phase bakes the flaw in; fixing it later requires an ALTER TABLE migration. This violates the phase's own stated pattern "Uid-scoped SQL at the query layer (ownership never trusted to callers)".
**Fix:** Add `uid TEXT NOT NULL` to the table and index, and thread uid through the API:
```sql
CREATE TABLE IF NOT EXISTS syncQueue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  collection TEXT NOT NULL,
  docId TEXT NOT NULL,
  operation TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_syncQueue_uid ON syncQueue (uid, id);
```
```ts
export async function enqueue(uid: string, collection: string, docId: string, operation: SyncOperation): Promise<number> { ... }
export async function getQueue(uid: string): Promise<SyncQueueItem[]> { ... }  // WHERE uid = ?
export async function clearQueue(uid: string): Promise<void> { ... }          // WHERE uid = ?
export async function dequeue(uid: string, id: number): Promise<void> { ... } // WHERE uid = ? AND id = ?
export async function removeByDocId(uid: string, collection: string, docId: string): Promise<void> { ... }
```
Also consider uid-scoped cleanup on sign-out/account deletion (deleteAccount cascade deletes Firestore data but leaves the local SQLite rows for that uid).

### CR-02: getUnsynced* getters are not uid-scoped — Phase 12 drain pushes another account's rows

**File:** `src/db/entries.ts:100-105`, `src/db/categories.ts:82-87`, `src/db/scheduled.ts:109-114`
**Issue:** `getUnsyncedEntries()`, `getUnsyncedCategories()`, and `getUnsyncedScheduled()` run `WHERE synced = 0` with no uid filter. On a device where a previous account's rows remain (sign-out does not purge SQLite, and the seed intentionally keeps a "fully local" ledger authoritative), the Phase 12 sync service would collect the *other account's* unsynced rows and push them into the signed-in user's Firestore — silent cross-account data corruption. Even single-account devices are only safe by accident. Every other query in these modules is uid-scoped; these three are inconsistent with the module contract stated in the file headers ("Every function is uid-scoped").
**Fix:** Add a required `uid` parameter and filter:
```ts
export async function getUnsyncedEntries(uid: string): Promise<DbEntry[]> {
  const db = await getDb();
  return db.getAllAsync<DbEntry>(
    "SELECT * FROM entries WHERE uid = ? AND synced = 0 ORDER BY updatedAt ASC",
    uid,
  );
}
```
(Apply the same change to `getUnsyncedCategories` and `getUnsyncedScheduled`.)

## Warnings

### WR-01: update/delete/markSynced target rows by id only — no uid verification

**File:** `src/db/entries.ts:78-98,107-110`, `src/db/categories.ts:60-80,89-92`, `src/db/scheduled.ts:84-107,116-119`
**Issue:** `updateEntry(id, changes)`, `deleteEntry(id)`, and `markSynced(id)` filter only on the PK `id`. The id is a Firestore doc id (globally unique), so the WHERE clause is functionally sufficient — but the uid is never verified, which contradicts the module header claim "ownership is enforced at the SQL layer, not trusted to the caller." The Firestore path in the same codebase performs an explicit ownership check before delete (`src/entries/EntriesProvider.tsx:232-236` — "Verify ownership before deletion (defense-in-depth)"), so the SQLite layer is weaker than the precedent it mirrors. On a multi-account device, a stale or cross-uid id (e.g., from a cached id surviving an account switch) would silently update/delete another account's local row; the later cloud push would then fail, leaving queue/local state desynchronized. At minimum the ownership check should be a uid predicate when one is available to the caller.
**Fix:** Either scope by `(id, uid)` — `DELETE FROM entries WHERE id = ? AND uid = ?` — and pass uid from callers, or document explicitly that id-only targeting is a deliberate single-owner-device assumption (and revisit before Phase 12 wires the sync layer, which is exactly where mixed-uid rows will appear).

### WR-02: seed idempotency check is all-or-nothing and check-then-act (non-atomic)

**File:** `src/db/seed.ts:64-70,99-103`
**Issue:** The skip predicate `if (alreadyHasEntries || alreadyHasCategories)` conflates "has any local data" with "has complete local data". If a uid ever has rows in one table but not the other (e.g., a Phase 12 offline category write lands before the seed's async check runs — the seed and the providers start concurrently on sign-in — or a future partial state), the seed skips permanently and the empty table is never populated: the cloud entries would never appear locally while the "authoritative local" heuristic treats the ledger as complete. Additionally, the check and the insert are not atomic: two concurrent `seedFromFirestore` calls (React StrictMode double-effects in dev, or a fast sign-in/sign-out cycle) both pass the check, then one fails with a PK constraint inside the transaction; App.tsx swallows the error, so the failure is invisible and only a future sign-in retries.
**Fix:** Make the guard per-table and atomic. Either seed each table independently when its own count is zero, or wrap the check + inserts in a single transaction:
```ts
const sqlite = await getDb();
await sqlite.withTransactionAsync(async () => {
  if (!(await hasEntries(uid))) {
    for (const entry of entries) await insertEntry(entry);
  }
  if (!(await hasCategories(uid))) {
    for (const cat of categories) await insertCategory(cat);
  }
});
```
(Note: `insertCategory`/`insertEntry` call `getDb()` internally, which resolves to the same connection inside the transaction — safe with expo-sqlite's serialized transaction, no deadlock.)

### WR-03: `synced` flag is caller-controlled on updates — silent non-push risk in Phase 12

**File:** `src/db/entries.ts:28-36,78-93`, `src/db/categories.ts:23,60-75`, `src/db/scheduled.ts:31-43,84-102`
**Issue:** `synced` is a member of `UPDATABLE_COLUMNS` in all three modules, and the update functions do nothing to force `synced = 0` when data columns change. A Phase 12 caller that passes a partial changes object without remembering `synced: 0` will write a local edit that is never pushed to Firestore — the row stays `synced = 1` and the edit silently diverges from the cloud (data loss of the edit, and a confusing "offline changes pending" state). The seed summary explicitly lists `updateEntry(id, changes)` as a Phase 12 consumption point, so this landmine is about to be stepped on. The safer contract: any update that touches data columns must reset `synced` to 0 unless the update *is* the sync confirmation.
**Fix:** Force the flag in the update path and reserve `synced` for the sync service:
```ts
export async function updateEntry(
  id: string,
  changes: Partial<Pick<DbEntry, (typeof UPDATABLE_COLUMNS)[number]>>,
): Promise<void> {
  const columns = Object.keys(changes).filter((key) =>
    (UPDATABLE_COLUMNS as readonly string[]).includes(key) &&
    (key === "synced" ? (changes as Record<string, unknown>).synced === 1 : true),
  );
  // If any non-synced data column is being updated, force synced = 0
  const hasDataChange = columns.some((c) => c !== "synced");
  const setColumns = hasDataChange ? columns.filter((c) => c !== "synced").concat("synced") : columns;
  const params: SQLiteBindValue[] = setColumns.map((col) =>
    col === "synced" && hasDataChange ? 0 : (changes as Record<string, SQLiteBindValue>)[col],
  );
  ...
}
```
(Or, simpler: require callers to always pass `synced` explicitly and add a unit test asserting an edit without `synced: 0` fails loudly.)

## Info

### IN-01: connection leak on schema-init failure

**File:** `src/db/database.ts:17-25`
**Issue:** If `openDatabaseAsync` succeeds but `execAsync(SCHEMA_SQL)` rejects, the `.catch` resets `dbPromise` but never closes the opened handle. The next `getDb()` opens a second connection while the first stays open — a one-connection-per-failure leak, and two connections to the same file can interleave writes.
**Fix:**
```ts
dbPromise = SQLite.openDatabaseAsync(DB_NAME)
  .then(async (db) => {
    await db.execAsync(SCHEMA_SQL);
    return db;
  })
  .catch(async (e) => {
    dbPromise = null;
    throw e;
  });
```
Better: track the opened db in the closure and call `db.closeAsync()` in the catch when the schema step failed.

### IN-02: seed silently coerces malformed cloud data

**File:** `src/db/seed.ts:36-38,85-87`
**Issue:** `type: data.type === "income" ? "income" : "expense"` turns any unknown type value into an expense; `toMillis` substitutes `Date.now()` for anything that is not a `Timestamp`; `amountCents` falls back to `0`. A mis-typed cloud doc (e.g., `type: "transfer"` or a string `amountCents`) is silently imported as wrong financial data rather than flagged. The Firestore rules presumably constrain these fields, but the seed's own defensive branches advertise that malformed data is expected — log a warning when coercion fires so corrupted ledgers are detectable.
**Fix:** Log a `console.warn` (or collect into `SeedResult`) when `data.type` is not `"income"`/`"expense"` or `amountCents` is not a finite number, instead of silently defaulting.

### IN-03: App.tsx swallows seed failures with no diagnostic

**File:** `App.tsx:43-46`
**Issue:** The `.catch(() => {})` intentionally swallows seed errors (design: providers fall back to Firestore), but with zero logging the only failure signal is the *absence* of the `[sqlite] seeded N entries` log. Debugging offline-first issues (why did the ledger never populate?) requires grepping for a missing log line.
**Fix:** Add `console.warn("[sqlite] seed failed:", error)` in the catch — a warning is consistent with the "failures are swallowed on purpose" intent while keeping the failure observable.

### IN-04: undefined bind values can reach the update functions

**File:** `src/db/entries.ts:82-90`, `src/db/categories.ts:64-72`, `src/db/scheduled.ts:88-96`
**Issue:** The column filter checks key membership only, not value definedness. `updateEntry(id, { description: undefined })` passes the whitelist, then binds `undefined` via `(changes as Record<string, SQLiteBindValue>)[col]` — a type assertion that hides the mismatch and throws at runtime (undefined is not a `SQLiteBindValue`). Phase 12's providers build partial changes objects and may not filter undefined (the Firestore path in `EntriesProvider.updateEntry` filters `!== undefined` per key; the SQLite path must too).
**Fix:** Filter undefined values in the same pass:
```ts
const columns = Object.keys(changes).filter((key) =>
  (UPDATABLE_COLUMNS as readonly string[]).includes(key) &&
  (changes as Record<string, unknown>)[key] !== undefined,
);
```

### IN-05: `updatedAt` has no cloud counterpart — LWW foundation incomplete

**File:** `src/db/seed.ts:92`, `src/db/schema.ts:31`; `src/entries/EntriesProvider.tsx:164-172`
**Issue:** The local schema stores `updatedAt` and the seed sets `updatedAt = createdAt` for seeded rows, but cloud entry docs contain only `createdAt` — `addEntry`/`updateEntry` in EntriesProvider never write `updatedAt`. Phase 12's last-write-wins sync therefore has nothing to compare against on the cloud side: seeded rows will always look locally-created, and cloud-side edits cannot be detected. The seed's choice (`updatedAt = createdAt`) is fine today, but the phase summary's claim that "`updatedAt` comparisons work with last-write-wins" is only half-built.
**Fix:** When Phase 12 adds cloud writes, include `updatedAt: Timestamp.now()` (or serverTimestamp) in every cloud write and confirm Firestore rules permit the field — note this in the 12-offline-providers-sync plan so the LWW design lands complete.

---

_Reviewed: 2026-08-12T04:10:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
