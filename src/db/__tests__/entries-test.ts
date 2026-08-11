// entries-test.ts — unit tests for the entries SQLite CRUD module (phase 11,
// OFFL-01). Uses the in-memory expo-sqlite mock; verifies uid scoping,
// synced-flag contract (WR-03), ordering, and defaults.
jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));

import { resetDbForTesting } from "../database";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import {
  getAllEntries,
  getEntriesByType,
  insertEntry,
  updateEntry,
  deleteEntry,
  getUnsyncedEntries,
  markSynced,
  hasEntries,
  type DbEntryInput,
} from "../entries";

const now = 1_752_000_000_000;

const makeEntry = (overrides: Partial<DbEntryInput> = {}): DbEntryInput =>
  ({
    id: "e1",
    uid: "u1",
    type: "expense",
    amountCents: 150_000,
    categoryId: "cat1",
    date: "2026-08-15",
    description: "Groceries",
    createdAt: now,
    ...overrides,
  }) as DbEntryInput;

beforeEach(() => {
  resetSqliteMock();
  resetDbForTesting();
});

describe("insertEntry / getAllEntries", () => {
  it("inserts a row and reads it back", async () => {
    await insertEntry(makeEntry());
    const rows = await getAllEntries("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "e1",
      uid: "u1",
      type: "expense",
      amountCents: 150_000,
      categoryId: "cat1",
      date: "2026-08-15",
      description: "Groceries",
      createdAt: now,
      updatedAt: now,
      synced: 0,
    });
  });

  it("defaults synced to 0 and updatedAt to createdAt", async () => {
    await insertEntry(makeEntry());
    const [row] = await getAllEntries("u1");
    expect(row.synced).toBe(0);
    expect(row.updatedAt).toBe(now);
  });

  it("preserves an explicit synced: 1 (seed path)", async () => {
    await insertEntry(makeEntry({ synced: 1 }));
    const [row] = await getAllEntries("u1");
    expect(row.synced).toBe(1);
  });

  it("orders by date DESC then createdAt DESC", async () => {
    await insertEntry(makeEntry({ id: "a", date: "2026-08-10", createdAt: 1 }));
    await insertEntry(makeEntry({ id: "b", date: "2026-08-20", createdAt: 2 }));
    await insertEntry(makeEntry({ id: "c", date: "2026-08-20", createdAt: 3 }));
    const rows = await getAllEntries("u1");
    expect(rows.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("scopes reads by uid — another account's rows are invisible", async () => {
    await insertEntry(makeEntry({ uid: "u1" }));
    await insertEntry(makeEntry({ id: "other", uid: "u2" }));
    const rows = await getAllEntries("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("e1");
  });
});

describe("getEntriesByType", () => {
  it("filters by type within the uid scope", async () => {
    await insertEntry(makeEntry({ type: "expense" }));
    await insertEntry(makeEntry({ id: "inc", type: "income" }));
    await insertEntry(makeEntry({ id: "u2exp", uid: "u2", type: "expense" }));
    const expenses = await getEntriesByType("u1", "expense");
    const incomes = await getEntriesByType("u1", "income");
    expect(expenses.map((r) => r.id)).toEqual(["e1"]);
    expect(incomes.map((r) => r.id)).toEqual(["inc"]);
  });
});

describe("updateEntry", () => {
  it("partially updates only the given columns", async () => {
    await insertEntry(makeEntry({ synced: 1 }));
    await updateEntry("u1", "e1", { description: "Market run" });
    const [row] = await getAllEntries("u1");
    expect(row.description).toBe("Market run");
    expect(row.amountCents).toBe(150_000);
    expect(row.date).toBe("2026-08-15");
  });

  it("forces synced = 0 when a data column changes (WR-03)", async () => {
    await insertEntry(makeEntry({ synced: 1 }));
    await updateEntry("u1", "e1", { description: "edited" });
    const [row] = await getAllEntries("u1");
    expect(row.synced).toBe(0);
  });

  it("accepts synced: 1 as the sync-confirmation path without touching data", async () => {
    await insertEntry(makeEntry({ synced: 0 }));
    await updateEntry("u1", "e1", { synced: 1 });
    const [row] = await getAllEntries("u1");
    expect(row.synced).toBe(1);
    expect(row.description).toBe("Groceries");
  });

  it("drops synced: 0 — the flag is reserved for the sync service (WR-03)", async () => {
    await insertEntry(makeEntry({ synced: 1 }));
    await updateEntry("u1", "e1", { synced: 0 });
    const [row] = await getAllEntries("u1");
    expect(row.synced).toBe(1);
  });

  it("ignores columns outside the whitelist (SQL injection defense)", async () => {
    await insertEntry(makeEntry());
    await updateEntry("u1", "e1", {
      description: "safe",
      uid: "attacker",
      updatedAt: 0,
    } as Partial<DbEntryInput> & { uid?: string });
    const [row] = await getAllEntries("u1");
    expect(row.uid).toBe("u1");
    expect(row.description).toBe("safe");
  });

  it("updates only the row matching (id, uid) — cross-account ids are inert (WR-01)", async () => {
    await insertEntry(makeEntry({ synced: 1 }));
    await insertEntry(makeEntry({ id: "u2entry", uid: "u2", synced: 1 }));
    await updateEntry("u2", "e1", { description: "hijack attempt" });
    await updateEntry("u1", "e1", { description: "legit" });
    const u1 = await getAllEntries("u1");
    const u2 = await getAllEntries("u2");
    expect(u1[0].description).toBe("legit");
    expect(u2[0].description).toBe("Groceries");
  });

  it("forces synced = 0 even when the update also passes synced: 1 with data (WR-03)", async () => {
    await insertEntry(makeEntry({ synced: 1 }));
    await updateEntry("u1", "e1", { description: "edited", synced: 1 });
    const [row] = await getAllEntries("u1");
    expect(row.synced).toBe(0);
  });
});

describe("deleteEntry", () => {
  it("removes the row scoped to (id, uid)", async () => {
    await insertEntry(makeEntry());
    await insertEntry(makeEntry({ id: "u2entry", uid: "u2" }));
    await deleteEntry("u1", "e1");
    expect(await getAllEntries("u1")).toHaveLength(0);
    expect(await getAllEntries("u2")).toHaveLength(1);
  });
});

describe("getUnsyncedEntries", () => {
  it("returns only synced = 0 rows for the uid, oldest-updated first", async () => {
    await insertEntry(makeEntry({ id: "a", synced: 1, createdAt: now - 2000 }));
    await insertEntry(makeEntry({ id: "b", synced: 0, createdAt: now - 1000 }));
    await insertEntry(makeEntry({ id: "c", synced: 0, createdAt: now }));
    await insertEntry(makeEntry({ id: "d", uid: "u2", synced: 0 }));
    const unsynced = await getUnsyncedEntries("u1");
    expect(unsynced.map((r) => r.id)).toEqual(["b", "c"]);
  });
});

describe("markSynced", () => {
  it("sets synced = 1 for the matching (id, uid) row only", async () => {
    await insertEntry(makeEntry({ synced: 0 }));
    await insertEntry(makeEntry({ id: "u2entry", uid: "u2", synced: 0 }));
    await markSynced("u1", "e1");
    const u1 = await getAllEntries("u1");
    const u2 = await getAllEntries("u2");
    expect(u1[0].synced).toBe(1);
    expect(u2[0].synced).toBe(0);
  });
});

describe("hasEntries", () => {
  it("is false for an empty uid", async () => {
    expect(await hasEntries("u1")).toBe(false);
  });

  it("is true when the uid has rows, regardless of other uids", async () => {
    await insertEntry(makeEntry({ id: "u2entry", uid: "u2" }));
    expect(await hasEntries("u1")).toBe(false);
    await insertEntry(makeEntry());
    expect(await hasEntries("u1")).toBe(true);
  });
});
