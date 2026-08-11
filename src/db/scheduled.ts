// SQLite CRUD for the scheduledEntries table (OFFL-01, recurring entries).
// Scheduled entries are templates — the auto-generation engine (Phase 13)
// reads getActiveScheduled(uid) and materializes real entries from them.
// frequency: "once" | "daily" | "weekly" | "monthly" | "yearly"
// isActive: 0/1 (1 = engine should process this template)
// endDate / lastGenerated: YYYY-MM-DD or null (no end / not yet generated)
import { getDb } from "./database";
import type { SQLiteBindValue } from "expo-sqlite";
import type { EntryType } from "./entries";

export type DbScheduledEntry = {
  id: string;
  uid: string;
  type: EntryType;
  amountCents: number;
  categoryId: string;
  date: string;
  description: string;
  frequency: string;
  endDate: string | null;
  lastGenerated: string | null;
  isActive: 0 | 1;
  createdAt: number;
  synced: 0 | 1;
};

export type DbScheduledInput = Omit<DbScheduledEntry, "synced"> & {
  synced?: 0 | 1;
};

const UPDATABLE_COLUMNS = [
  "type",
  "amountCents",
  "categoryId",
  "date",
  "description",
  "frequency",
  "endDate",
  "lastGenerated",
  "isActive",
  "createdAt",
  "synced",
] as const;

export async function getAllScheduled(uid: string): Promise<DbScheduledEntry[]> {
  const db = await getDb();
  return db.getAllAsync<DbScheduledEntry>(
    "SELECT * FROM scheduledEntries WHERE uid = ? ORDER BY date ASC",
    uid,
  );
}

export async function getActiveScheduled(uid: string): Promise<DbScheduledEntry[]> {
  const db = await getDb();
  return db.getAllAsync<DbScheduledEntry>(
    "SELECT * FROM scheduledEntries WHERE uid = ? AND isActive = 1 ORDER BY date ASC",
    uid,
  );
}

export async function insertScheduled(entry: DbScheduledInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO scheduledEntries
       (id, uid, type, amountCents, categoryId, date, description,
        frequency, endDate, lastGenerated, isActive, createdAt, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.uid,
    entry.type,
    entry.amountCents,
    entry.categoryId,
    entry.date,
    entry.description,
    entry.frequency,
    entry.endDate ?? null,
    entry.lastGenerated ?? null,
    entry.isActive ?? 1,
    entry.createdAt,
    entry.synced ?? 0,
  );
}

export async function updateScheduled(
  uid: string,
  id: string,
  changes: Partial<Pick<DbScheduledEntry, (typeof UPDATABLE_COLUMNS)[number]>>,
): Promise<void> {
  const raw = changes as Record<string, unknown>;
  // WR-03: `synced` is reserved for the sync service — callers may only pass
  // synced: 1 (the sync-confirmation path); any other value is dropped. Any
  // data-column change forces synced = 0 so an edit is never silently left
  // marked as already pushed (which would lose the edit in Phase 12).
  const columns = Object.keys(changes).filter(
    (key) =>
      (UPDATABLE_COLUMNS as readonly string[]).includes(key) &&
      (key !== "synced" || raw.synced === 1),
  );
  const hasDataChange = columns.some((c) => c !== "synced");
  const setColumns = hasDataChange
    ? columns.filter((c) => c !== "synced").concat("synced")
    : columns;
  if (setColumns.length === 0) return;
  const db = await getDb();
  const setClause = setColumns.map((col) => `${col} = ?`).join(", ");
  const params: SQLiteBindValue[] = setColumns.map((col) =>
    col === "synced" && hasDataChange ? 0 : (raw[col] as SQLiteBindValue),
  );
  params.push(id, uid);
  await db.runAsync(
    `UPDATE scheduledEntries SET ${setClause} WHERE id = ? AND uid = ?`,
    params,
  );
}

export async function deleteScheduled(uid: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "DELETE FROM scheduledEntries WHERE id = ? AND uid = ?",
    id,
    uid,
  );
}

export async function getUnsyncedScheduled(uid: string): Promise<DbScheduledEntry[]> {
  const db = await getDb();
  return db.getAllAsync<DbScheduledEntry>(
    "SELECT * FROM scheduledEntries WHERE uid = ? AND synced = 0 ORDER BY createdAt ASC",
    uid,
  );
}

export async function markSynced(uid: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE scheduledEntries SET synced = 1 WHERE id = ? AND uid = ?",
    id,
    uid,
  );
}

export async function hasScheduled(uid: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM scheduledEntries WHERE uid = ?",
    uid,
  );
  return (row?.c ?? 0) > 0;
}
