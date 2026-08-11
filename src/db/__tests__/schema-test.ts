// schema-test.ts — unit tests for the SQLite schema DDL (phase 11).
// Pure string contract tests: SCHEMA_SQL is the single source of truth for
// table DDL, executed idempotently on first getDb(). No native module needed.
import { SCHEMA_VERSION, SCHEMA_SQL } from "../schema";

describe("SCHEMA_VERSION", () => {
  it("is version 1", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});

describe("SCHEMA_SQL", () => {
  it("defines all four tables with IF NOT EXISTS (idempotent)", () => {
    expect(SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS entries");
    expect(SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS categories");
    expect(SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS scheduledEntries");
    expect(SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS syncQueue");
  });

  it("gives entries TEXT-PK id, uid, integer-cents amount and synced flag", () => {
    const block = SCHEMA_SQL.match(/CREATE TABLE IF NOT EXISTS entries \(([\s\S]*?)\);/)?.[1] ?? "";
    expect(block).toContain("id TEXT PRIMARY KEY NOT NULL");
    expect(block).toContain("uid TEXT NOT NULL");
    expect(block).toContain("amountCents INTEGER NOT NULL");
    expect(block).toContain("synced INTEGER NOT NULL DEFAULT 0");
  });

  it("orders entries queries with the uid/date index", () => {
    expect(SCHEMA_SQL).toContain(
      "CREATE INDEX IF NOT EXISTS idx_entries_uid_date ON entries (uid, date DESC)",
    );
  });

  it("normalizes category kind into a type column", () => {
    const block = SCHEMA_SQL.match(/CREATE TABLE IF NOT EXISTS categories \(([\s\S]*?)\);/)?.[1] ?? "";
    expect(block).toContain("type TEXT NOT NULL");
    expect(block).toContain("name TEXT NOT NULL");
    expect(block).toContain("synced INTEGER NOT NULL DEFAULT 0");
    expect(SCHEMA_SQL).toContain("CREATE INDEX IF NOT EXISTS idx_categories_uid ON categories (uid)");
  });

  it("defines scheduledEntries template columns (frequency, isActive, endDate)", () => {
    const block =
      SCHEMA_SQL.match(/CREATE TABLE IF NOT EXISTS scheduledEntries \(([\s\S]*?)\);/)?.[1] ?? "";
    expect(block).toContain("frequency TEXT NOT NULL");
    expect(block).toContain("isActive INTEGER NOT NULL DEFAULT 1");
    expect(block).toContain("endDate TEXT");
    expect(block).toContain("lastGenerated TEXT");
    expect(block).toContain("amountCents INTEGER NOT NULL");
  });

  it("gives syncQueue an autoincrement PK and a uid column (CR-01)", () => {
    const block = SCHEMA_SQL.match(/CREATE TABLE IF NOT EXISTS syncQueue \(([\s\S]*?)\);/)?.[1] ?? "";
    expect(block).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
    expect(block).toContain("uid TEXT NOT NULL");
    expect(block).toContain("collection TEXT NOT NULL");
    expect(block).toContain("operation TEXT NOT NULL");
    expect(block).toContain("timestamp INTEGER NOT NULL");
    expect(SCHEMA_SQL).toContain(
      "CREATE INDEX IF NOT EXISTS idx_syncQueue_uid ON syncQueue (uid, id)",
    );
  });

  it("keeps uid indexes on every data table (uid-scoped SQL layer)", () => {
    expect(SCHEMA_SQL).toContain("CREATE INDEX IF NOT EXISTS idx_entries_uid_date");
    expect(SCHEMA_SQL).toContain("CREATE INDEX IF NOT EXISTS idx_categories_uid");
    expect(SCHEMA_SQL).toContain("CREATE INDEX IF NOT EXISTS idx_scheduled_uid");
    expect(SCHEMA_SQL).toContain("CREATE INDEX IF NOT EXISTS idx_syncQueue_uid");
  });
});
