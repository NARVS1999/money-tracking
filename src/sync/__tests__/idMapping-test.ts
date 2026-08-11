// idMapping-test.ts — unit tests for temp-id handling (phase 12, SYNC-04).
// Covers the temp scheme (generateTempId / isTempId) and the transactional
// temp->real remap (mapTempId) across all three collections: entries remaps
// the row id plus categoryId references in entries and scheduledEntries;
// category collections remap the category row plus the same references;
// scheduledEntries remaps only its own row. Remap statements are uid-scoped,
// and the whole rewrite runs in one transaction (a mid-transaction failure
// must roll back so the row id and its references can never split).
jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));

jest.mock("../../db/database", () => {
  const actual = jest.requireActual("../../db/database");
  return {
    ...actual,
    getDb: jest.fn(actual.getDb),
  };
});

import { resetDbForTesting } from "../../db/database";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import { getDb } from "../../db/database";
import {
  insertEntry,
  getAllEntries,
  type DbEntryInput,
} from "../../db/entries";
import {
  insertCategory,
  getAllCategories,
  type DbCategoryInput,
} from "../../db/categories";
import {
  insertScheduled,
  getAllScheduled,
  type DbScheduledInput,
} from "../../db/scheduled";
import { generateTempId, isTempId, mapTempId } from "../idMapping";

const UID = "u1";
const now = 1_752_000_000_000;

function entry(id: string, overrides: Partial<DbEntryInput> = {}): DbEntryInput {
  return {
    id,
    uid: UID,
    type: "expense",
    amountCents: 2450,
    categoryId: "cat-1",
    date: "2026-08-15",
    description: "Coffee",
    createdAt: now,
    updatedAt: now,
    synced: 0,
    ...overrides,
  };
}

function category(
  id: string,
  overrides: Partial<DbCategoryInput> = {},
): DbCategoryInput {
  return {
    id,
    uid: UID,
    type: "expense",
    name: "Food",
    icon: "",
    createdAt: now,
    updatedAt: now,
    synced: 0,
    ...overrides,
  };
}

function scheduled(
  id: string,
  overrides: Partial<DbScheduledInput> = {},
): DbScheduledInput {
  return {
    id,
    uid: UID,
    type: "expense",
    amountCents: 1000,
    categoryId: "cat-1",
    date: "2026-09-01",
    description: "Rent",
    frequency: "monthly",
    endDate: null,
    lastGenerated: null,
    isActive: 1,
    createdAt: now,
    updatedAt: now,
    synced: 0,
    ...overrides,
  };
}

beforeEach(() => {
  resetSqliteMock();
  resetDbForTesting();
});

describe("generateTempId", () => {
  it("produces unique ids with the local- prefix", () => {
    const a = generateTempId();
    const b = generateTempId();
    expect(a).toMatch(/^local-/);
    expect(b).toMatch(/^local-/);
    expect(a).not.toBe(b);
  });
});

describe("isTempId", () => {
  it("recognizes local- ids, UUID-style ids, and negative numbers as temp", () => {
    expect(isTempId("local-abc123")).toBe(true);
    expect(isTempId("local-")).toBe(true);
    expect(
      isTempId("123e4567-e89b-12d3-a456-426614174000"),
    ).toBe(true);
    expect(isTempId("-42")).toBe(true);
  });

  it("rejects firestore-style and plain ids", () => {
    expect(isTempId("fs-1")).toBe(false);
    expect(isTempId("abc123")).toBe(false);
    expect(isTempId("42")).toBe(false);
    expect(isTempId("")).toBe(false);
  });
});

describe("mapTempId — entries collection", () => {
  it("rewrites the row id and categoryId references in entries and scheduledEntries", async () => {
    const tempCat = generateTempId();
    const tempEntry = generateTempId();
    await insertCategory(category(tempCat));
    await insertEntry(entry(tempEntry, { categoryId: tempCat }));
    await insertEntry(entry("real-entry", { categoryId: tempCat }));
    await insertScheduled(scheduled("real-sched", { categoryId: tempCat }));

    await mapTempId("entries", tempEntry, "fs-entry-1", UID);

    const rows = await getAllEntries(UID);
    expect(rows.find((r) => r.id === "fs-entry-1")).toBeDefined();
    expect(rows.find((r) => r.id === tempEntry)).toBeUndefined();
    // categoryId references are untouched by an entries remap.
    expect(rows.find((r) => r.id === "fs-entry-1")?.categoryId).toBe(tempCat);
  });

  it("rewrites a categoryId reference inside entries and scheduledEntries to the real category id", async () => {
    const tempCat = generateTempId();
    const tempEntry = generateTempId();
    await insertCategory(category(tempCat));
    await insertEntry(entry(tempEntry, { categoryId: tempCat }));
    await insertScheduled(scheduled("real-sched", { categoryId: tempCat }));
    await insertScheduled(scheduled("other-sched", { categoryId: "real-cat" }));

    await mapTempId("expenseCategories", tempCat, "fs-cat-1", UID);

    // Category row itself remapped.
    const cats = await getAllCategories(UID);
    expect(cats.find((c) => c.id === "fs-cat-1")).toBeDefined();
    expect(cats.find((c) => c.id === tempCat)).toBeUndefined();
    // Entries + scheduledEntries referencing the temp category now point at
    // the real id; unrelated references are untouched.
    const entries = await getAllEntries(UID);
    expect(entries.find((r) => r.id === tempEntry)?.categoryId).toBe("fs-cat-1");
    const scheds = await getAllScheduled(UID);
    expect(scheds.find((s) => s.id === "real-sched")?.categoryId).toBe("fs-cat-1");
    expect(scheds.find((s) => s.id === "other-sched")?.categoryId).toBe("real-cat");
  });

  it("applies the same reference rewrite for the incomeCategories collection", async () => {
    const tempCat = generateTempId();
    await insertCategory(category(tempCat, { type: "income" }));
    await insertEntry(entry("e1", { categoryId: tempCat, type: "income" }));

    await mapTempId("incomeCategories", tempCat, "fs-inc-1", UID);

    expect((await getAllCategories(UID))[0].id).toBe("fs-inc-1");
    expect((await getAllEntries(UID))[0].categoryId).toBe("fs-inc-1");
  });

  it("rewrites only the matching uid's rows and references", async () => {
    const tempCat = generateTempId();
    await insertCategory(category(tempCat));
    // Another account's entry references the same temp category id.
    await insertEntry(entry("e-other", { categoryId: tempCat, uid: "other" }));

    await mapTempId("expenseCategories", tempCat, "fs-cat-1", UID);

    // This uid's category row is remapped; the other uid's reference is
    // untouched by the uid-scoped UPDATE.
    expect((await getAllCategories(UID))[0].id).toBe("fs-cat-1");
    expect((await getAllEntries("other"))[0].categoryId).toBe(tempCat);
  });
});

describe("mapTempId — scheduledEntries collection", () => {
  it("rewrites only the scheduled row id, never category references", async () => {
    const tempSched = generateTempId();
    await insertScheduled(scheduled(tempSched, { categoryId: "cat-1" }));
    await insertEntry(entry("e1", { categoryId: tempSched }));

    await mapTempId("scheduledEntries", tempSched, "fs-sched-1", UID);

    const rows = await getAllScheduled(UID);
    expect(rows.find((r) => r.id === "fs-sched-1")?.categoryId).toBe("cat-1");
    expect(rows.find((r) => r.id === tempSched)).toBeUndefined();
    // Entry categoryId was not touched by the scheduled remap.
    expect((await getAllEntries(UID))[0].categoryId).toBe(tempSched);
  });
});

describe("mapTempId — transaction safety", () => {
  it("rolls back all rewrites when a statement inside the transaction fails", async () => {
    const tempCat = generateTempId();
    const tempEntry = generateTempId();
    await insertCategory(category(tempCat));
    await insertEntry(entry(tempEntry, { categoryId: tempCat }));

    // Second statement (the entries categoryId rewrite) fails mid-transaction.
    const realDb = await getDb();
    let call = 0;
    const failingRun = jest.fn(async (sql: string, ...args: unknown[]) => {
      call += 1;
      if (call === 2) throw new Error("disk full");
      return (realDb.runAsync as unknown as (s: string, ...a: unknown[]) => Promise<unknown>)(sql, ...args);
    });
    (getDb as jest.Mock).mockResolvedValueOnce({
      ...realDb,
      runAsync: failingRun,
    });

    await expect(
      mapTempId("expenseCategories", tempCat, "fs-cat-1", UID),
    ).rejects.toThrow("disk full");

    // The transaction rolled back: the category row still carries the temp id.
    const cats = await getAllCategories(UID);
    expect(cats.find((c) => c.id === tempCat)).toBeDefined();
    expect(cats.find((c) => c.id === "fs-cat-1")).toBeUndefined();
  });

  it("is a no-op for an unknown collection (no statements executed)", async () => {
    const realDb = await getDb();
    (getDb as jest.Mock).mockResolvedValueOnce(realDb);
    const runSpy = jest.spyOn(realDb, "runAsync");

    await mapTempId("unknownCollection", "local-x", "fs-x", UID);

    expect(runSpy).not.toHaveBeenCalled();
  });
});
