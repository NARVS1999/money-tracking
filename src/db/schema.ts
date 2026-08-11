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

export const SCHEMA_VERSION = 1;

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
`;
