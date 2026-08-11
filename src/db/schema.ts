// SQLite schema for the local-first storage layer (OFFL-01).
// Single source of truth for table DDL — imported by database.ts and executed
// on first run via db.execAsync (multi-statement, idempotent thanks to
// IF NOT EXISTS).
//
// Conventions:
// - ids are TEXT primary keys — Firestore doc ids are used verbatim so the
//   local row and the cloud doc always share an id (no temp-id mapping for
//   the initial seed path; the sync layer's temp-id mapping in Phase 12
//   covers offline-first creates).
// - Timestamps are INTEGER milliseconds since epoch (Firestore
//   Timestamp.toMillis()), so `updatedAt` comparisons work with
//   last-write-wins without conversion.
// - `synced` is 0/1 — 0 means "local change not yet pushed to Firestore"
//   (Phase 12 sync service drains these).
// - amounts are INTEGER cents (ADR-0003) — never floats.
// - dates are "YYYY-MM-DD" local calendar strings (NFR-04).
//
// Schema v2 (Phase 12): added `updatedAt` to categories and scheduledEntries
// (entries already had it) so pull-side last-write-wins (SYNC-02) works for
// every collection, and added the syncMeta table that stores the per-uid
// lastSyncTimestamp pull watermark (syncMetadata.ts). Existing v1 installs
// are migrated in database.ts via PRAGMA user_version + ALTER TABLE.

export const SCHEMA_VERSION = 2;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY NOT NULL,
  uid TEXT NOT NULL,
  type TEXT NOT NULL,
  amountCents INTEGER NOT NULL,
  categoryId TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_uid_date ON entries (uid, date DESC);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  uid TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL DEFAULT 0,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_categories_uid ON categories (uid);

CREATE TABLE IF NOT EXISTS scheduledEntries (
  id TEXT PRIMARY KEY NOT NULL,
  uid TEXT NOT NULL,
  type TEXT NOT NULL,
  amountCents INTEGER NOT NULL,
  categoryId TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL,
  endDate TEXT,
  lastGenerated TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL DEFAULT 0,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_scheduled_uid ON scheduledEntries (uid);

CREATE TABLE IF NOT EXISTS syncQueue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  collection TEXT NOT NULL,
  docId TEXT NOT NULL,
  operation TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_syncQueue_uid ON syncQueue (uid, id);

CREATE TABLE IF NOT EXISTS syncMeta (
  uid TEXT PRIMARY KEY NOT NULL,
  lastSync INTEGER NOT NULL
);
`;

// v1 -> v2 column additions for existing installs. SQLite has no
// "ADD COLUMN IF NOT EXISTS", so database.ts checks PRAGMA table_info before
// running each ALTER (guarded by PRAGMA user_version). Fresh installs get the
// columns from SCHEMA_SQL above and skip these.
export const SCHEMA_V2_ALTERS: ReadonlyArray<{
  table: string;
  column: string;
  ddl: string;
}> = [
  {
    table: "categories",
    column: "updatedAt",
    ddl: "ALTER TABLE categories ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0",
  },
  {
    table: "scheduledEntries",
    column: "updatedAt",
    ddl: "ALTER TABLE scheduledEntries ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0",
  },
];
