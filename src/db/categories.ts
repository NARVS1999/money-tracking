// SQLite CRUD for the categories table (OFFL-01).
// Firestore stores categories in two collections (expenseCategories /
// incomeCategories) without a type field; the SQLite table normalizes this
// into a `type` column ("expense" | "income") so a single table serves both.
// All functions are uid-scoped at the SQL layer.
import { getDb } from "./database";
import type { SQLiteBindValue } from "expo-sqlite";

export type CategoryType = "expense" | "income";

export type DbCategory = {
  id: string;
  uid: string;
  type: CategoryType;
  name: string;
  icon: string;
  createdAt: number;
  synced: 0 | 1;
};

export type DbCategoryInput = Omit<DbCategory, "synced"> & { synced?: 0 | 1 };

const UPDATABLE_COLUMNS = ["type", "name", "icon", "createdAt", "synced"] as const;

export async function getAllCategories(uid: string): Promise<DbCategory[]> {
  const db = await getDb();
  return db.getAllAsync<DbCategory>(
    "SELECT * FROM categories WHERE uid = ? ORDER BY createdAt ASC",
    uid,
  );
}

export async function getCategoriesByType(
  uid: string,
  type: CategoryType,
): Promise<DbCategory[]> {
  const db = await getDb();
  return db.getAllAsync<DbCategory>(
    "SELECT * FROM categories WHERE uid = ? AND type = ? ORDER BY createdAt ASC",
    uid,
    type,
  );
}

export async function insertCategory(cat: DbCategoryInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO categories (id, uid, type, name, icon, createdAt, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    cat.id,
    cat.uid,
    cat.type,
    cat.name,
    cat.icon,
    cat.createdAt,
    cat.synced ?? 0,
  );
}

export async function updateCategory(
  uid: string,
  id: string,
  changes: Partial<Pick<DbCategory, (typeof UPDATABLE_COLUMNS)[number]>>,
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
    `UPDATE categories SET ${setClause} WHERE id = ? AND uid = ?`,
    params,
  );
}

export async function deleteCategory(uid: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "DELETE FROM categories WHERE id = ? AND uid = ?",
    id,
    uid,
  );
}

export async function getUnsyncedCategories(uid: string): Promise<DbCategory[]> {
  const db = await getDb();
  return db.getAllAsync<DbCategory>(
    "SELECT * FROM categories WHERE uid = ? AND synced = 0 ORDER BY createdAt ASC",
    uid,
  );
}

export async function markSynced(uid: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE categories SET synced = 1 WHERE id = ? AND uid = ?",
    id,
    uid,
  );
}

export async function hasCategories(uid: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM categories WHERE uid = ?",
    uid,
  );
  return (row?.c ?? 0) > 0;
}
