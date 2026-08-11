// Sync metadata persistence — the per-uid lastSyncTimestamp pull watermark
// (plan Task 5). Stored in the syncMeta table (schema v2) so each account
// tracks its own watermark: pullChanges(uid, lastSync) only fetches docs
// changed after it, and fullSync advances it after a successful push+pull.
// uid-scoped like every other db access — a device that has seen multiple
// accounts never reads another account's watermark.
import { getDb } from "../db/database";

export async function getLastSync(uid: string): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ lastSync: number }>(
    "SELECT lastSync FROM syncMeta WHERE uid = ?",
    uid,
  );
  return row?.lastSync ?? null;
}

export async function setLastSync(
  uid: string,
  timestamp: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO syncMeta (uid, lastSync) VALUES (?, ?)
     ON CONFLICT(uid) DO UPDATE SET lastSync = excluded.lastSync`,
    uid,
    timestamp,
  );
}
