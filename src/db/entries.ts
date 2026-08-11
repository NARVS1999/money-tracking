// SQLite CRUD for the entries table (OFFL-01).
// Every function is uid-scoped — callers must pass the authenticated uid;
// ownership is enforced at the SQL layer, not trusted to the caller.
// All timestamps are INTEGER ms epochs; dates are YYYY-MM-DD strings.
// `synced` 0/1 marks local changes pending push (Phase 12 sync service).
import { getDb } from "./database";

export type EntryType = "expense" | "income";

export type DbEntry = {
  id: string;
  uid: string;
  type: EntryType;
  amountCents: number;
  categoryId: string;
  date: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  synced: 0 | 1;
};

export type DbEntryInput = Omit<DbEntry, "synced"> & { synced?: 0 | 1 };

// Columns updateEntry() may touch. Whitelist prevents arbitrary SQL column
// injection through the partial-update API.
const UPDATABLE_COLUMNS = [
  "type",
  "amountCents",
  "categoryId",
  "date",
  "description",
  "updatedAt",
  "synced",
] as const;

export async function getAllEntries(uid: string): Promise<DbEntry[]> {
  const db = await getDb();
  return db.getAllAsync<DbEntry>(
    "SELECT * FROM entries WHERE uid = ? ORDER BY date DESC, createdAt DESC",
    uid,
  );
}

export async function getEntriesByType(
  uid: string,
  type: EntryType,
): Promise<DbEntry[]> {
  const db = await getDb();
  return db.getAllAsync<DbEntry>(
    "SELECT * FROM entries WHERE uid = ? AND type = ? ORDER BY date DESC, createdAt DESC",
    uid,
    type,
  );
}

export async function insertEntry(entry: DbEntryInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO entries
       (id, uid, type, amountCents, categoryId, date, description,
        createdAt, updatedAt, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.uid,
    entry.type,
    entry.amountCents,
    entry.categoryId,
    entry.date,
    entry.description,
    entry.createdAt,
    entry.updatedAt ?? entry.createdAt,
    entry.synced ?? 0,
  );
}

export async function updateEntry(
  id: string,
  changes: Partial<Pick<DbEntry, (typeof UPDATABLE_COLUMNS)[number]>>,
): Promise<void> {
  const columns = Object.keys(changes).filter((key) =>
    (UPDATABLE_COLUMNS as readonly string[]).includes(key),
  );
  if (columns.length === 0) return;
  const db = await getDb();
  const setClause = columns.map((col) => `${col} = ?`).join(", ");
  await db.runAsync(
    `UPDATE entries SET ${setClause} WHERE id = ?`,
    ...[...columns.map((col) => (changes as Record<string, unknown>)[col]), id],
  );
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM entries WHERE id = ?", id);
}

export async function getUnsyncedEntries(): Promise<DbEntry[]> {
  const db = await getDb();
  return db.getAllAsync<DbEntry>(
    "SELECT * FROM entries WHERE synced = 0 ORDER BY updatedAt ASC",
  );
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE entries SET synced = 1 WHERE id = ?", id);
}

// True when the uid has any rows — used by seedFromFirestore for the
// idempotency check (OFFL-01: skip seeding if already populated).
export async function hasEntries(uid: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM entries WHERE uid = ?",
    uid,
  );
  return (row?.c ?? 0) > 0;
}
