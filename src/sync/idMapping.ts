// Temp-id handling for offline-first creates (SYNC-04). Locally-created rows
// get a `local-*` temp id until the sync service pushes them to Firestore and
// receives the real doc id; mapTempId then rewrites the local row id AND any
// categoryId references in other tables so the local ledger stays consistent
// after the remap (an entry that references a just-pushed category keeps
// pointing at the right doc).
//
// The temp scheme lives here so providers and the sync service share one
// source of truth. Negative-number and UUID-style ids are also recognised as
// temps for robustness against legacy local-id schemes.
import { getDb } from "../db/database";

const TEMP_ID_RE =
  /^local-|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEGATIVE_ID_RE = /^-\d+$/;

export function generateTempId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isTempId(id: string): boolean {
  return TEMP_ID_RE.test(id) || NEGATIVE_ID_RE.test(id);
}

// Rewrite temp -> real after a successful create push:
//   - "entries": the row id itself, plus categoryId references in entries
//     and scheduledEntries (an entry using a just-pushed temp category).
//   - "expenseCategories" / "incomeCategories": the row id, plus categoryId
//     references in entries and scheduledEntries.
//   - "scheduledEntries": the row id.
// Runs in one transaction so a crash mid-remap cannot split the row id from
// its references.
export async function mapTempId(
  collection: string,
  tempId: string,
  realId: string,
  uid: string,
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    if (collection === "entries") {
      await db.runAsync(
        "UPDATE entries SET id = ? WHERE id = ? AND uid = ?",
        realId,
        tempId,
        uid,
      );
      await db.runAsync(
        "UPDATE entries SET categoryId = ? WHERE categoryId = ? AND uid = ?",
        realId,
        tempId,
        uid,
      );
      await db.runAsync(
        "UPDATE scheduledEntries SET categoryId = ? WHERE categoryId = ? AND uid = ?",
        realId,
        tempId,
        uid,
      );
    } else if (
      collection === "expenseCategories" ||
      collection === "incomeCategories"
    ) {
      await db.runAsync(
        "UPDATE categories SET id = ? WHERE id = ? AND uid = ?",
        realId,
        tempId,
        uid,
      );
      await db.runAsync(
        "UPDATE entries SET categoryId = ? WHERE categoryId = ? AND uid = ?",
        realId,
        tempId,
        uid,
      );
      await db.runAsync(
        "UPDATE scheduledEntries SET categoryId = ? WHERE categoryId = ? AND uid = ?",
        realId,
        tempId,
        uid,
      );
    } else if (collection === "scheduledEntries") {
      await db.runAsync(
        "UPDATE scheduledEntries SET id = ? WHERE id = ? AND uid = ?",
        realId,
        tempId,
        uid,
      );
    }
  });
}
