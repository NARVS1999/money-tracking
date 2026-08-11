// scheduled-test.ts — unit tests for the scheduledEntries SQLite CRUD module
// (phase 11, OFFL-01 / recurring entries). Uses the in-memory expo-sqlite
// mock; verifies template defaults, isActive filtering, uid scoping, and the
// synced-flag contract.
jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));

import { resetDbForTesting } from "../database";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import {
  getAllScheduled,
  getActiveScheduled,
  insertScheduled,
  updateScheduled,
  deleteScheduled,
  getUnsyncedScheduled,
  markSynced,
  hasScheduled,
  type DbScheduledInput,
} from "../scheduled";

const now = 1_752_000_000_000;

const makeScheduled = (overrides: Partial<DbScheduledInput> = {}): DbScheduledInput =>
  ({
    id: "s1",
    uid: "u1",
    type: "expense",
    amountCents: 50_000,
    categoryId: "cat1",
    date: "2026-08-15",
    description: "Rent",
    frequency: "monthly",
    createdAt: now,
    ...overrides,
  }) as DbScheduledInput;

beforeEach(() => {
  resetSqliteMock();
  resetDbForTesting();
});

describe("insertScheduled / getAllScheduled", () => {
  it("inserts a row and reads it back", async () => {
    await insertScheduled(makeScheduled());
    const rows = await getAllScheduled("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "s1",
      uid: "u1",
      type: "expense",
      amountCents: 50_000,
      frequency: "monthly",
      endDate: null,
      lastGenerated: null,
      isActive: 1,
      synced: 0,
    });
  });

  it("defaults isActive to 1 and synced to 0", async () => {
    await insertScheduled(makeScheduled());
    const [row] = await getAllScheduled("u1");
    expect(row.isActive).toBe(1);
    expect(row.synced).toBe(0);
  });

  it("stores explicit endDate / lastGenerated and isActive: 0", async () => {
    await insertScheduled(
      makeScheduled({ endDate: "2026-12-31", lastGenerated: "2026-08-15", isActive: 0 }),
    );
    const [row] = await getAllScheduled("u1");
    expect(row.endDate).toBe("2026-12-31");
    expect(row.lastGenerated).toBe("2026-08-15");
    expect(row.isActive).toBe(0);
  });

  it("orders by date ASC", async () => {
    await insertScheduled(makeScheduled({ id: "a", date: "2026-09-01" }));
    await insertScheduled(makeScheduled({ id: "b", date: "2026-08-01" }));
    await insertScheduled(makeScheduled({ id: "c", date: "2026-08-15" }));
    expect((await getAllScheduled("u1")).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("scopes reads by uid", async () => {
    await insertScheduled(makeScheduled());
    await insertScheduled(makeScheduled({ id: "other", uid: "u2" }));
    const rows = await getAllScheduled("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("s1");
  });
});

describe("getActiveScheduled", () => {
  it("returns only isActive = 1 templates for the uid (Phase 13 engine input)", async () => {
    await insertScheduled(makeScheduled({ isActive: 1 }));
    await insertScheduled(makeScheduled({ id: "off", isActive: 0 }));
    await insertScheduled(makeScheduled({ id: "u2active", uid: "u2", isActive: 1 }));
    const active = await getActiveScheduled("u1");
    expect(active.map((r) => r.id)).toEqual(["s1"]);
  });
});

describe("updateScheduled", () => {
  it("partially updates only the given columns", async () => {
    await insertScheduled(makeScheduled({ synced: 1 }));
    await updateScheduled("u1", "s1", { frequency: "weekly" });
    const [row] = await getAllScheduled("u1");
    expect(row.frequency).toBe("weekly");
    expect(row.amountCents).toBe(50_000);
    expect(row.isActive).toBe(1);
  });

  it("can clear endDate back to null", async () => {
    await insertScheduled(makeScheduled({ endDate: "2026-12-31", synced: 1 }));
    await updateScheduled("u1", "s1", { endDate: null });
    const [row] = await getAllScheduled("u1");
    expect(row.endDate).toBeNull();
  });

  it("forces synced = 0 when a data column changes (WR-03)", async () => {
    await insertScheduled(makeScheduled({ synced: 1 }));
    await updateScheduled("u1", "s1", { description: "edited" });
    expect((await getAllScheduled("u1"))[0].synced).toBe(0);
  });

  it("accepts synced: 1 as the sync-confirmation path without touching data", async () => {
    await insertScheduled(makeScheduled({ synced: 0 }));
    await updateScheduled("u1", "s1", { synced: 1 });
    const [row] = await getAllScheduled("u1");
    expect(row.synced).toBe(1);
    expect(row.description).toBe("Rent");
  });

  it("drops synced: 0 — the flag is reserved for the sync service (WR-03)", async () => {
    await insertScheduled(makeScheduled({ synced: 1 }));
    await updateScheduled("u1", "s1", { synced: 0 });
    expect((await getAllScheduled("u1"))[0].synced).toBe(1);
  });

  it("ignores columns outside the whitelist", async () => {
    await insertScheduled(makeScheduled());
    await updateScheduled("u1", "s1", {
      frequency: "safe",
      uid: "attacker",
    } as Partial<DbScheduledInput> & { uid?: string });
    expect((await getAllScheduled("u1"))[0].uid).toBe("u1");
  });

  it("updates only the row matching (id, uid) (WR-01)", async () => {
    await insertScheduled(makeScheduled({ synced: 1 }));
    await insertScheduled(makeScheduled({ id: "u2s", uid: "u2", synced: 1 }));
    await updateScheduled("u2", "s1", { frequency: "hijack" });
    await updateScheduled("u1", "s1", { frequency: "legit" });
    expect((await getAllScheduled("u1"))[0].frequency).toBe("legit");
    expect((await getAllScheduled("u2"))[0].frequency).toBe("monthly");
  });
});

describe("deleteScheduled", () => {
  it("removes the row scoped to (id, uid)", async () => {
    await insertScheduled(makeScheduled());
    await insertScheduled(makeScheduled({ id: "u2s", uid: "u2" }));
    await deleteScheduled("u1", "s1");
    expect(await getAllScheduled("u1")).toHaveLength(0);
    expect(await getAllScheduled("u2")).toHaveLength(1);
  });
});

describe("getUnsyncedScheduled", () => {
  it("returns only synced = 0 rows for the uid, oldest-created first", async () => {
    await insertScheduled(makeScheduled({ id: "a", synced: 1, createdAt: now - 2000 }));
    await insertScheduled(makeScheduled({ id: "b", synced: 0, createdAt: now - 1000 }));
    await insertScheduled(makeScheduled({ id: "c", synced: 0, createdAt: now }));
    await insertScheduled(makeScheduled({ id: "d", uid: "u2", synced: 0 }));
    expect((await getUnsyncedScheduled("u1")).map((r) => r.id)).toEqual(["b", "c"]);
  });
});

describe("markSynced", () => {
  it("sets synced = 1 for the matching (id, uid) row only", async () => {
    await insertScheduled(makeScheduled({ synced: 0 }));
    await insertScheduled(makeScheduled({ id: "u2s", uid: "u2", synced: 0 }));
    await markSynced("u1", "s1");
    expect((await getAllScheduled("u1"))[0].synced).toBe(1);
    expect((await getAllScheduled("u2"))[0].synced).toBe(0);
  });
});

describe("hasScheduled", () => {
  it("is false for an empty uid, true when the uid has rows", async () => {
    expect(await hasScheduled("u1")).toBe(false);
    await insertScheduled(makeScheduled({ id: "u2s", uid: "u2" }));
    expect(await hasScheduled("u1")).toBe(false);
    await insertScheduled(makeScheduled());
    expect(await hasScheduled("u1")).toBe(true);
  });
});
