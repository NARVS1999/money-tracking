// SQLite sync queue (OFFL-01, SYNC-*). Records local changes that must be
// pushed to Firestore: enqueue() is called on every local write, and the
// Phase 12 sync service drains the queue with dequeue() after each
// successful push. FIFO order by autoincrement id.
// operation: "create" | "update" | "delete" | "sync"
import { getDb } from "./database";

export type SyncOperation = "create" | "update" | "delete" | "sync";

export type SyncQueueItem = {
  id: number;
  collection: string;
  docId: string;
  operation: SyncOperation;
  timestamp: number;
};

export async function enqueue(
  collection: string,
  docId: string,
  operation: SyncOperation,
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    "INSERT INTO syncQueue (collection, docId, operation, timestamp) VALUES (?, ?, ?, ?)",
    collection,
    docId,
    operation,
    Date.now(),
  );
  return result.lastInsertRowId;
}

export async function dequeue(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM syncQueue WHERE id = ?", id);
}

export async function getQueue(): Promise<SyncQueueItem[]> {
  const db = await getDb();
  return db.getAllAsync<SyncQueueItem>(
    "SELECT * FROM syncQueue ORDER BY id ASC",
  );
}

export async function clearQueue(): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM syncQueue");
}

// Drop queued ops for a doc that no longer needs pushing (e.g. an offline
// create that was superseded by a delete before ever syncing).
export async function removeByDocId(
  collection: string,
  docId: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "DELETE FROM syncQueue WHERE collection = ? AND docId = ?",
    collection,
    docId,
  );
}
