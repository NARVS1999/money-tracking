// SQLite database connection singleton (OFFL-01).
// Lazy init: the first getDb() call opens the database and runs the schema
// DDL (idempotent — IF NOT EXISTS), so importing this module has zero side
// effects. Safe to import from App.tsx, providers, and tests alike.
//
// A failed open resets the cached promise so a later retry (e.g. after
// storage becomes available) can succeed instead of permanently rejecting.
import * as SQLite from "expo-sqlite";
import { SCHEMA_SQL } from "./schema";

const DB_NAME = "money-tracking.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME)
      .then(async (db) => {
        await db.execAsync(SCHEMA_SQL);
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
