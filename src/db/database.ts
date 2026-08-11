// SQLite database connection singleton (OFFL-01).
// Lazy init: the first getDb() call opens the database, runs the schema
// DDL (idempotent — IF NOT EXISTS), and applies any pending version
// migrations (PRAGMA user_version), so importing this module has zero side
// effects. Safe to import from App.tsx, providers, and tests alike.
//
// A failed open resets the cached promise so a later retry (e.g. after
// storage becomes available) can succeed instead of permanently rejecting.
import * as SQLite from "expo-sqlite";
import { SCHEMA_SQL, SCHEMA_VERSION, SCHEMA_V2_ALTERS } from "./schema";

const DB_NAME = "money-tracking.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Stepwise migrations keyed off PRAGMA user_version. Each step ALTERs the
// tables of an existing v1 install; fresh installs already have the columns
// from SCHEMA_SQL, so the table_info guards make the ALTERs no-ops there.
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version?: number; v?: number }>(
    "PRAGMA user_version",
  );
  const version = row?.user_version ?? row?.v ?? 0;
  if (version >= SCHEMA_VERSION) return;

  if (version < 2) {
    for (const alter of SCHEMA_V2_ALTERS) {
      const cols = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(${alter.table})`,
      );
      if (!cols.some((c) => c.name === alter.column)) {
        await db.execAsync(alter.ddl);
      }
    }
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME)
      .then(async (db) => {
        await db.execAsync(SCHEMA_SQL);
        await migrate(db);
        return db;
      })
      .catch((e) => {
        dbPromise = null;
        throw e;
      });
  }
  return dbPromise;
}

// Test/teardown helper: drops the cached connection. The next getDb() call
// reopens the database and re-applies the schema.
export function resetDbForTesting(): void {
  dbPromise = null;
}
