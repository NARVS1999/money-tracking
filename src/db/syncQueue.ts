// SQLite sync queue (OFFL-01, SYNC-*). Records local changes that must be
// pushed to Firestore: enqueue() is called on every local write, and the
// Phase 12 sync service drains the queue with dequeue() after each
// successful push. FIFO order by autoincrement id within a uid.
// Every function is uid-scoped — callers must pass the authenticated uid so
// a device that has seen multiple accounts never drains another account's
// pending ops (sign-out does not purge SQLite).
// operation: "create" | "update" | "delete" | "sync"
import { getDb } from "./database";

export type SyncOperation = "create" | "update" | "delete" | "sync";

export type SyncQueueItem = {
  id: number;
  uid: string;
  collection: string;
  docId: string;
  operation: SyncOperation;
  timestamp: number;
};

export async function enqueue(
  uid: string,
  collection: string,
  docId: string,
  operation: SyncOperation,
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    "INSERT INTO syncQueue (uid, collection, docId, operation, timestamp) VALUES (?, ?, ?, ?, ?)",
    uid,
    collection,
    docId,
    operation,
    Date.now(),
  );
  return result.lastInsertRowId;
}

export async function dequeue(uid: string, id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM syncQueue WHERE id = ? AND uid = ?", id, uid);
}

export async function getQueue(uid: string): Promise<SyncQueueItem[]> {
  const db = await getDb();
  return db.getAllAsync<SyncQueueItem>(
    "SELECT * FROM syncQueue WHERE uid = ? ORDER BY id ASC",
    uid,
  );
}

export async function clearQueue(uid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM syncQueue WHERE uid = ?", uid);
}

// Drop queued ops for a doc that no longer needs pushing (e.g. an offline
// create that was superseded by a delete before ever syncing).
export async function removeByDocId(
  uid: string,
  collection: string,
  docId: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "DELETE FROM syncQueue WHERE collection = ? AND docId = ? AND uid = ?",
    collection,
    docId,
    uid,
  );
}
