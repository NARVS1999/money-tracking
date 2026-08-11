// categories-test.ts — unit tests for the categories SQLite CRUD module
// (phase 11, OFFL-01). Uses the in-memory expo-sqlite mock; verifies uid
// scoping, the type column normalization, and the synced-flag contract.
jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));

import { resetDbForTesting } from "../database";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import {
  getAllCategories,
  getCategoriesByType,
  insertCategory,
  updateCategory,
  deleteCategory,
  getUnsyncedCategories,
  markSynced,
  hasCategories,
  type DbCategoryInput,
} from "../categories";

const now = 1_752_000_000_000;

const makeCategory = (overrides: Partial<DbCategoryInput> = {}): DbCategoryInput => ({
  id: "cat1",
  uid: "u1",
  type: "expense",
  name: "Food",
  icon: "🍔",
  createdAt: now,
  ...overrides,
});

beforeEach(() => {
  resetSqliteMock();
  resetDbForTesting();
});

describe("insertCategory / getAllCategories", () => {
  it("inserts a row and reads it back with synced defaulting to 0", async () => {
    await insertCategory(makeCategory());
    const rows = await getAllCategories("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "cat1",
      uid: "u1",
      type: "expense",
      name: "Food",
      icon: "🍔",
      createdAt: now,
      synced: 0,
    });
  });

  it("preserves an explicit synced: 1 (seed path)", async () => {
    await insertCategory(makeCategory({ synced: 1 }));
    expect((await getAllCategories("u1"))[0].synced).toBe(1);
  });

  it("orders by createdAt ASC", async () => {
    await insertCategory(makeCategory({ id: "a", createdAt: 3 }));
    await insertCategory(makeCategory({ id: "b", createdAt: 1 }));
    await insertCategory(makeCategory({ id: "c", createdAt: 2 }));
    expect((await getAllCategories("u1")).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("scopes reads by uid", async () => {
    await insertCategory(makeCategory());
    await insertCategory(makeCategory({ id: "other", uid: "u2" }));
    const rows = await getAllCategories("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("cat1");
  });
});

describe("getCategoriesByType", () => {
  it("filters by type within the uid scope", async () => {
    await insertCategory(makeCategory({ type: "expense" }));
    await insertCategory(makeCategory({ id: "inc", type: "income" }));
    await insertCategory(makeCategory({ id: "u2cat", uid: "u2", type: "expense" }));
    const expenses = await getCategoriesByType("u1", "expense");
    const incomes = await getCategoriesByType("u1", "income");
    expect(expenses.map((r) => r.id)).toEqual(["cat1"]);
    expect(incomes.map((r) => r.id)).toEqual(["inc"]);
  });
});

describe("updateCategory", () => {
  it("partially updates only the given columns", async () => {
    await insertCategory(makeCategory({ synced: 1 }));
    await updateCategory("u1", "cat1", { name: "Food & Drinks" });
    const [row] = await getAllCategories("u1");
    expect(row.name).toBe("Food & Drinks");
    expect(row.icon).toBe("🍔");
    expect(row.type).toBe("expense");
  });

  it("forces synced = 0 when a data column changes (WR-03)", async () => {
    await insertCategory(makeCategory({ synced: 1 }));
    await updateCategory("u1", "cat1", { icon: "🍽️" });
    expect((await getAllCategories("u1"))[0].synced).toBe(0);
  });

  it("accepts synced: 1 as the sync-confirmation path without touching data", async () => {
    await insertCategory(makeCategory({ synced: 0 }));
    await updateCategory("u1", "cat1", { synced: 1 });
    const [row] = await getAllCategories("u1");
    expect(row.synced).toBe(1);
    expect(row.name).toBe("Food");
  });

  it("drops synced: 0 — the flag is reserved for the sync service (WR-03)", async () => {
    await insertCategory(makeCategory({ synced: 1 }));
    await updateCategory("u1", "cat1", { synced: 0 });
    expect((await getAllCategories("u1"))[0].synced).toBe(1);
  });

  it("ignores columns outside the whitelist", async () => {
    await insertCategory(makeCategory());
    await updateCategory("u1", "cat1", {
      name: "safe",
      uid: "attacker",
    } as Partial<DbCategoryInput> & { uid?: string });
    expect((await getAllCategories("u1"))[0].uid).toBe("u1");
  });

  it("updates only the row matching (id, uid) (WR-01)", async () => {
    await insertCategory(makeCategory({ synced: 1 }));
    await insertCategory(makeCategory({ id: "u2cat", uid: "u2", synced: 1 }));
    await updateCategory("u2", "cat1", { name: "hijack" });
    await updateCategory("u1", "cat1", { name: "legit" });
    expect((await getAllCategories("u1"))[0].name).toBe("legit");
    expect((await getAllCategories("u2"))[0].name).toBe("Food");
  });
});

describe("deleteCategory", () => {
  it("removes the row scoped to (id, uid)", async () => {
    await insertCategory(makeCategory());
    await insertCategory(makeCategory({ id: "u2cat", uid: "u2" }));
    await deleteCategory("u1", "cat1");
    expect(await getAllCategories("u1")).toHaveLength(0);
    expect(await getAllCategories("u2")).toHaveLength(1);
  });
});

describe("getUnsyncedCategories", () => {
  it("returns only synced = 0 rows for the uid, oldest-created first", async () => {
    await insertCategory(makeCategory({ id: "a", synced: 1, createdAt: now - 2000 }));
    await insertCategory(makeCategory({ id: "b", synced: 0, createdAt: now - 1000 }));
    await insertCategory(makeCategory({ id: "c", synced: 0, createdAt: now }));
    await insertCategory(makeCategory({ id: "d", uid: "u2", synced: 0 }));
    expect((await getUnsyncedCategories("u1")).map((r) => r.id)).toEqual(["b", "c"]);
  });
});

describe("markSynced", () => {
  it("sets synced = 1 for the matching (id, uid) row only", async () => {
    await insertCategory(makeCategory({ synced: 0 }));
    await insertCategory(makeCategory({ id: "u2cat", uid: "u2", synced: 0 }));
    await markSynced("u1", "cat1");
    expect((await getAllCategories("u1"))[0].synced).toBe(1);
    expect((await getAllCategories("u2"))[0].synced).toBe(0);
  });
});

describe("hasCategories", () => {
  it("is false for an empty uid, true when the uid has rows", async () => {
    expect(await hasCategories("u1")).toBe(false);
    await insertCategory(makeCategory({ id: "u2cat", uid: "u2" }));
    expect(await hasCategories("u1")).toBe(false);
    await insertCategory(makeCategory());
    expect(await hasCategories("u1")).toBe(true);
  });
});
