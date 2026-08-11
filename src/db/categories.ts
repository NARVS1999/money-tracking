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
  id: string,
  changes: Partial<Pick<DbCategory, (typeof UPDATABLE_COLUMNS)[number]>>,
): Promise<void> {
  const columns = Object.keys(changes).filter((key) =>
    (UPDATABLE_COLUMNS as readonly string[]).includes(key),
  );
  if (columns.length === 0) return;
  const db = await getDb();
  const setClause = columns.map((col) => `${col} = ?`).join(", ");
  const params: SQLiteBindValue[] = columns.map(
    (col) => (changes as Record<string, SQLiteBindValue>)[col],
  );
  params.push(id);
  await db.runAsync(`UPDATE categories SET ${setClause} WHERE id = ?`, params);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM categories WHERE id = ?", id);
}

export async function getUnsyncedCategories(): Promise<DbCategory[]> {
  const db = await getDb();
  return db.getAllAsync<DbCategory>(
    "SELECT * FROM categories WHERE synced = 0 ORDER BY createdAt ASC",
  );
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE categories SET synced = 1 WHERE id = ?", id);
}

export async function hasCategories(uid: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM categories WHERE uid = ?",
    uid,
  );
  return (row?.c ?? 0) > 0;
}
