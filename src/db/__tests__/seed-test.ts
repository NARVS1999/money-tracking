// seed-test.ts — unit tests for seedFromFirestore (phase 11, OFFL-01 / D4).
// Mocks firebase/firestore + the local CRUD modules so only the seed logic
// runs: idempotent skip, per-table seeding (WR-02 fix), PK-conflict tolerance,
// Timestamp/type coercion, and error propagation.
import { seedFromFirestore } from "../seed";

jest.mock("firebase/firestore", () => {
  // Prototype-based on purpose: babel-plugin-jest-hoist rejects class
  // parameter properties inside jest.mock factories, and `new Timestamp(x)`
  // must satisfy `value instanceof Timestamp` in seed.ts.
  function MockTimestamp(this: { ms: number }, ms: number) {
    this.ms = ms;
  }
  MockTimestamp.prototype.toMillis = function toMillis() {
    return this.ms;
  };
  return {
    Timestamp: MockTimestamp,
    collection: jest.fn((dbRef: unknown, name: string) => ({ dbRef, name })),
    query: jest.fn((q: unknown) => q),
    where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    getDocs: jest.fn(),
  };
});

jest.mock("../../firebase/app", () => ({
  db: { mockDb: true },
}));

jest.mock("../database", () => ({
  getDb: jest.fn().mockResolvedValue({
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
  }),
}));

jest.mock("../entries", () => ({
  hasEntries: jest.fn(),
  insertEntry: jest.fn(),
}));

jest.mock("../categories", () => ({
  hasCategories: jest.fn(),
  insertCategory: jest.fn(),
}));

const Fs = require("firebase/firestore") as {
  Timestamp: new (ms: number) => { toMillis(): number };
  collection: jest.Mock;
  query: jest.Mock;
  where: jest.Mock;
  getDocs: jest.Mock;
};
const { db: mockDb } = require("../../firebase/app") as { db: unknown };
const { hasEntries, insertEntry } = require("../entries") as {
  hasEntries: jest.Mock;
  insertEntry: jest.Mock;
};
const { hasCategories, insertCategory } = require("../categories") as {
  hasCategories: jest.Mock;
  insertCategory: jest.Mock;
};

const UID = "u1";

const doc = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: 1_752_000_000_000 });
  Fs.getDocs.mockResolvedValue({ docs: [] });
  hasEntries.mockResolvedValue(false);
  hasCategories.mockResolvedValue(false);
  insertEntry.mockResolvedValue(undefined);
  insertCategory.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

const seedDocs = {
  entries: [
    doc("e1", {
      type: "expense",
      amountCents: 150_000,
      categoryId: "cat1",
      date: "2026-08-15",
      description: "Groceries",
      createdAt: new Fs.Timestamp(1_728_000_000_000),
    }),
    doc("e2", {
      type: "income",
      amountCents: 1_000_000,
      categoryId: "cat2",
      date: "2026-08-16",
      description: "Salary",
      createdAt: new Fs.Timestamp(1_728_000_000_001),
    }),
  ],
  expenseCats: [
    doc("cat1", { name: "Food", icon: "🍔", createdAt: new Fs.Timestamp(1_728_000_000_000) }),
  ],
  incomeCats: [
    doc("cat2", { name: "Salary", icon: "💰", createdAt: new Fs.Timestamp(1_728_000_000_000) }),
  ],
};

function mockFullCloud(): void {
  Fs.getDocs.mockImplementation(async (q: { name: string }) => {
    if (q.name === "entries") return { docs: seedDocs.entries };
    if (q.name === "expenseCategories") return { docs: seedDocs.expenseCats };
    if (q.name === "incomeCategories") return { docs: seedDocs.incomeCats };
    return { docs: [] };
  });
}

describe("seedFromFirestore — idempotent fast path", () => {
  it("skips entirely when both tables are populated (seeded: false)", async () => {
    hasEntries.mockResolvedValue(true);
    hasCategories.mockResolvedValue(true);
    const result = await seedFromFirestore(UID);
    expect(result).toEqual({ seeded: false, entries: 0, categories: 0 });
    expect(Fs.getDocs).not.toHaveBeenCalled();
    expect(insertEntry).not.toHaveBeenCalled();
  });

  it("still fetches and seeds when only one table is populated (WR-02)", async () => {
    hasEntries.mockResolvedValue(true);
    hasCategories.mockResolvedValue(false);
    mockFullCloud();
    const result = await seedFromFirestore(UID);
    expect(result.seeded).toBe(true);
    expect(result.entries).toBe(0);
    expect(result.categories).toBe(2);
    expect(insertEntry).not.toHaveBeenCalled();
    expect(insertCategory).toHaveBeenCalledTimes(2);
  });
});

describe("seedFromFirestore — full seed", () => {
  it("queries the uid-scoped cloud collections", async () => {
    mockFullCloud();
    await seedFromFirestore(UID);
    expect(Fs.collection).toHaveBeenCalledWith(mockDb, "entries");
    expect(Fs.collection).toHaveBeenCalledWith(mockDb, "expenseCategories");
    expect(Fs.collection).toHaveBeenCalledWith(mockDb, "incomeCategories");
    expect(Fs.where).toHaveBeenCalledWith("uid", "==", UID);
    expect(Fs.getDocs).toHaveBeenCalledTimes(3);
  });

  it("inserts entries with synced: 1 and updatedAt = createdAt", async () => {
    mockFullCloud();
    const result = await seedFromFirestore(UID);
    expect(result).toEqual({ seeded: true, entries: 2, categories: 2 });
    expect(insertEntry).toHaveBeenNthCalledWith(1, {
      id: "e1",
      uid: UID,
      type: "expense",
      amountCents: 150_000,
      categoryId: "cat1",
      date: "2026-08-15",
      description: "Groceries",
      createdAt: 1_728_000_000_000,
      updatedAt: 1_728_000_000_000,
      synced: 1,
    });
    expect(insertEntry).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: "income" }));
  });

  it("maps expense/income category collections onto the type column", async () => {
    mockFullCloud();
    await seedFromFirestore(UID);
    expect(insertCategory).toHaveBeenNthCalledWith(1, {
      id: "cat1",
      uid: UID,
      type: "expense",
      name: "Food",
      icon: "🍔",
      createdAt: 1_728_000_000_000,
      // Cloud doc has no updatedAt (pre-v1.2) — falls back to createdAt.
      updatedAt: 1_728_000_000_000,
      synced: 1,
    });
    expect(insertCategory).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: "income" }));
  });

  it("reports seeded: false for an empty cloud ledger", async () => {
    const result = await seedFromFirestore(UID);
    expect(result).toEqual({ seeded: false, entries: 0, categories: 0 });
  });
});

describe("seedFromFirestore — data coercion", () => {
  it("converts Firestore Timestamps to ms epochs", async () => {
    Fs.getDocs.mockImplementation(async (q: { name: string }) => ({
      docs: q.name === "entries" ? [doc("e1", { createdAt: new Fs.Timestamp(123_456) })] : [],
    }));
    await seedFromFirestore(UID);
    expect(insertEntry).toHaveBeenCalledWith(expect.objectContaining({ createdAt: 123_456 }));
  });

  it("falls back to Date.now() for non-Timestamp createdAt", async () => {
    Fs.getDocs.mockImplementation(async (q: { name: string }) => ({
      docs: q.name === "entries" ? [doc("e1", { createdAt: "2026-01-01" })] : [],
    }));
    await seedFromFirestore(UID);
    expect(insertEntry).toHaveBeenCalledWith(
      expect.objectContaining({ createdAt: Date.now(), updatedAt: Date.now() }),
    );
  });

  it("coerces any non-income type to expense", async () => {
    Fs.getDocs.mockImplementation(async (q: { name: string }) => ({
      docs:
        q.name === "entries"
          ? [doc("e1", { type: "transfer" }), doc("e2", { type: "income" })]
          : [],
    }));
    await seedFromFirestore(UID);
    expect(insertEntry).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: "expense" }));
    expect(insertEntry).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: "income" }));
  });

  it("defaults malformed cloud fields to safe values", async () => {
    Fs.getDocs.mockImplementation(async (q: { name: string }) => {
      if (q.name === "entries") {
        return { docs: [doc("e1", { type: "expense", amountCents: "150000", date: 42 })] };
      }
      if (q.name === "expenseCategories") return { docs: [doc("c1", { name: 123 })] };
      return { docs: [] };
    });
    await seedFromFirestore(UID);
    expect(insertEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 0,
        categoryId: "",
        date: "",
        description: "",
      }),
    );
    expect(insertCategory).toHaveBeenCalledWith(expect.objectContaining({ name: "", icon: "" }));
  });
});

describe("seedFromFirestore — concurrency and errors", () => {
  it("skips rows whose insert hits a PK conflict and counts the rest (WR-02)", async () => {
    mockFullCloud();
    insertEntry.mockRejectedValueOnce(
      new Error("SQLITE_CONSTRAINT: PRIMARY KEY constraint failed: entries"),
    );
    const result = await seedFromFirestore(UID);
    expect(result).toEqual({ seeded: true, entries: 1, categories: 2 });
    expect(insertEntry).toHaveBeenCalledTimes(2);
  });

  it("propagates non-PK insert errors instead of swallowing them", async () => {
    mockFullCloud();
    insertEntry.mockRejectedValueOnce(new Error("disk full"));
    await expect(seedFromFirestore(UID)).rejects.toThrow("disk full");
  });

  it("propagates non-PK category insert errors", async () => {
    mockFullCloud();
    insertCategory.mockRejectedValueOnce(new Error("db locked"));
    await expect(seedFromFirestore(UID)).rejects.toThrow("db locked");
  });
});
