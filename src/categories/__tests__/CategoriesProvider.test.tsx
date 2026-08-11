/**
 * CategoriesProvider unit tests (phase 12 refactor) — reads/writes now go to
 * SQLite (insertCategory/updateCategory/deleteCategory + syncQueue enqueue)
 * instead of Firestore. usageMap still derives from EntriesProvider entries.
 * The load effect's seed path runs against the in-memory Firestore mock
 * (empty cloud -> no-op seed).
 */
import React from "react";
import { View, Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be BEFORE any imports of the modules under test
// ---------------------------------------------------------------------------

jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));
jest.mock("firebase/firestore", () => require("../../../jest/firestore-mock"));

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({ name: "mock" })),
}));

jest.mock("../../firebase/app", () => ({ db: { mockDb: true } }));

jest.mock("../../firebase/config", () => ({ firebaseConfig: {} }));

jest.mock("@firebase/auth", () => ({
  initializeAuth: jest.fn(() => ({ _tag: "auth" })),
  getReactNativePersistence: jest.fn(() => ({ _tag: "persistence" })),
}));

let mockUser: any = { uid: "user-1", email: "a@b.com" };

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser, initializing: false }),
}));

// usageMap derives from EntriesProvider entries — per-test let so each test
// controls the entry set.
let mockEntries: Array<{ categoryId?: string }> = [];

jest.mock("../../entries/EntriesProvider", () => ({
  useEntries: () => ({ entries: mockEntries }),
}));

// The provider's sync() delegates to fullSync — mocked so sync timing is
// controllable and no cloud calls are needed.
jest.mock("../../sync/syncService", () => ({
  fullSync: jest.fn(),
}));

// Wrap the real db modules so write payloads are assertable while the real
// implementations still run against the sqlite mock.
jest.mock("../../db/categories", () => {
  const actual = jest.requireActual("../../db/categories");
  return {
    ...actual,
    insertCategory: jest.fn(actual.insertCategory),
    deleteCategory: jest.fn(actual.deleteCategory),
  };
});

jest.mock("../../db/syncQueue", () => {
  const actual = jest.requireActual("../../db/syncQueue");
  return {
    ...actual,
    enqueue: jest.fn(actual.enqueue),
  };
});

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { CategoriesProvider, useCategories } from "../CategoriesProvider";
import type { CategoriesContextValue } from "../CategoriesProvider";
import { insertCategory } from "../../db/categories";
import { getAllCategories } from "../../db/categories";
import { enqueue } from "../../db/syncQueue";
import { fullSync } from "../../sync/syncService";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import { resetFsMock } from "../../../jest/firestore-mock";
import { resetDbForTesting } from "../../db/database";
import type { DbCategoryInput } from "../../db/categories";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let latestContext: CategoriesContextValue | null = null;

function ContextCapture() {
  latestContext = useCategories();
  return <Text>ok</Text>;
}

function ctx(): CategoriesContextValue {
  if (!latestContext) throw new Error("Context not captured — did the render succeed?");
  return latestContext;
}

const now = 1_752_000_000_000;

function dbCat(
  id: string,
  overrides: Partial<DbCategoryInput> = {},
): DbCategoryInput {
  return {
    id,
    uid: "user-1",
    type: "expense",
    name: "Food",
    icon: "",
    createdAt: now,
    updatedAt: now,
    synced: 1,
    ...overrides,
  };
}

// The load effect's promise chain (seed -> read) hangs async act in this
// jest-expo/React-19 env (same note as EntriesProvider.test) — use sync act
// + macrotask flush.
function mountProvider() {
  let root: any;
  act(() => {
    root = renderer.create(
      <CategoriesProvider>
        <ContextCapture />
      </CategoriesProvider>,
    );
  });
  return root;
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  act(() => {});
}

async function flushAll(times = 6) {
  for (let i = 0; i < times; i++) await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSqliteMock();
  resetFsMock();
  resetDbForTesting();
  mockUser = { uid: "user-1", email: "a@b.com" };
  mockEntries = [];
  latestContext = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("initial load", () => {
  it("loads both category lists from SQLite split by type column", async () => {
    await insertCategory(dbCat("cat-1", { name: "Food" }));
    await insertCategory(dbCat("cat-2", { name: "Transport" }));
    await insertCategory(dbCat("cat-3", { type: "income", name: "Salary" }));

    mountProvider();
    await flushAll();

    expect(ctx().expenseCategories.map((c) => c.name)).toEqual(["Food", "Transport"]);
    expect(ctx().incomeCategories.map((c) => c.name)).toEqual(["Salary"]);
  });
});

describe("sync", () => {
  it("runs fullSync, reloads from SQLite, and flips isSyncing", async () => {
    mountProvider();
    await flushAll();
    expect(ctx().isSyncing).toBe(false);

    // Hold the fullSync promise open so we can observe isSyncing.
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    (fullSync as jest.Mock).mockReturnValueOnce(gate);

    await insertCategory(dbCat("new-1", { name: "New" }));

    let syncPromise: Promise<void>;
    act(() => { syncPromise = ctx().sync(); });
    expect(ctx().isSyncing).toBe(true);

    await act(async () => {
      release();
      await syncPromise;
    });

    expect(ctx().isSyncing).toBe(false);
    expect(ctx().expenseCategories.map((c) => c.name)).toEqual(["New"]);
  });
});

describe("usageMap", () => {
  it("derives correct per-category counts from EntriesProvider entries", async () => {
    mockEntries = [
      { categoryId: "A" },
      { categoryId: "B" },
      { categoryId: "A" },
    ];
    mountProvider();
    await flushAll();

    expect(ctx().usageMap).toBeInstanceOf(Map);
    expect(ctx().usageMap.get("A")).toBe(2);
    expect(ctx().usageMap.get("B")).toBe(1);
    expect(ctx().usageMap.size).toBe(2);
  });

  it("is empty when there are no entries", async () => {
    mountProvider();
    await flushAll();

    expect(ctx().usageMap).toBeInstanceOf(Map);
    expect(ctx().usageMap.size).toBe(0);
  });
});

describe("addCategory", () => {
  it("inserts into SQLite with uid, trimmed name, type column and queues a create", async () => {
    mountProvider();
    await flushAll();

    const pending = ctx().addCategory("expenseCategories", "  Food  ");
    await flushAll();
    await pending;

    expect(insertCategory).toHaveBeenCalledTimes(1);
    const payload = (insertCategory as jest.Mock).mock.calls[0][0];
    expect(payload.uid).toBe("user-1");
    expect(payload.name).toBe("Food");
    expect(payload.type).toBe("expense");
    expect(payload.createdAt).toBeDefined();

    expect(enqueue).toHaveBeenCalledTimes(1);
    const [, collection, docId, operation] = (enqueue as jest.Mock).mock.calls[0];
    expect(collection).toBe("expenseCategories");
    expect(operation).toBe("create");
    expect(docId).toMatch(/^local-/);

    // Mirrored into state immediately (visible without a sync)
    expect(ctx().expenseCategories).toHaveLength(1);
    expect(ctx().expenseCategories[0].id).toBe(docId);
    expect(ctx().expenseCategories[0].name).toBe("Food");
  });

  it("appends income categories to the income list", async () => {
    mountProvider();
    await flushAll();

    const pending = ctx().addCategory("incomeCategories", "Salary");
    await flushAll();
    await pending;

    expect(ctx().incomeCategories).toHaveLength(1);
    expect(ctx().incomeCategories[0].name).toBe("Salary");
    expect(ctx().expenseCategories).toHaveLength(0);
  });

  it("silently no-ops on blank input (whitespace only)", async () => {
    mountProvider();
    await flushAll();

    await ctx().addCategory("expenseCategories", "   ");

    expect(insertCategory).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("throws 'Already exists' on case-insensitive trimmed duplicate", async () => {
    await insertCategory(dbCat("cat-1", { name: "Food" }));
    mountProvider();
    await flushAll();

    await expect(
      ctx().addCategory("expenseCategories", "  food  "),
    ).rejects.toThrow("Already exists");
    expect(insertCategory).toHaveBeenCalledTimes(1); // only the seed row
  });

  it("throws 'Not authenticated' when user is null", async () => {
    mockUser = null;
    mountProvider();
    await flushAll();

    await expect(
      ctx().addCategory("expenseCategories", "Food"),
    ).rejects.toThrow("Not authenticated");

    expect(insertCategory).not.toHaveBeenCalled();
  });
});

describe("deleteCategory", () => {
  it("deletes an unused category from SQLite, queues a delete, and removes it from state", async () => {
    await insertCategory(dbCat("cat-to-delete", { name: "Food" }));
    mountProvider();
    await flushAll();

    const pending = ctx().deleteCategory("expenseCategories", "cat-to-delete");
    await flushAll();
    await pending;

    expect(enqueue).toHaveBeenCalledTimes(1);
    const [, collection, docId, operation] = (enqueue as jest.Mock).mock.calls[0];
    expect(collection).toBe("expenseCategories");
    expect(docId).toBe("cat-to-delete");
    expect(operation).toBe("delete");
    expect(ctx().expenseCategories).toHaveLength(0);
  });

  it("throws 'Category is in use' and does NOT delete", async () => {
    mockEntries = [{ categoryId: "in-use-cat" }];
    await insertCategory(dbCat("in-use-cat", { type: "income", name: "X" }));
    mountProvider();
    await flushAll();

    await expect(
      ctx().deleteCategory("incomeCategories", "in-use-cat"),
    ).rejects.toThrow("Category is in use");

    expect(enqueue).not.toHaveBeenCalled();
    expect(ctx().incomeCategories).toHaveLength(1);
  });

  it("throws 'Not authenticated' when user is null", async () => {
    mockUser = null;
    mountProvider();
    await flushAll();

    await expect(
      ctx().deleteCategory("expenseCategories", "any-cat"),
    ).rejects.toThrow("Not authenticated");

    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("updateCategory", () => {
  it("renames a category (trimmed), queues an update, and mirrors state", async () => {
    await insertCategory(dbCat("cat-1", { name: "Food" }));
    mountProvider();
    await flushAll();
    (enqueue as jest.Mock).mockClear();

    const pending = ctx().updateCategory("expenseCategories", "cat-1", {
      name: "  Groceries  ",
    });
    await flushAll();
    await pending;

    expect(enqueue).toHaveBeenCalledTimes(1);
    const [, collection, docId, operation] = (enqueue as jest.Mock).mock.calls[0];
    expect(collection).toBe("expenseCategories");
    expect(docId).toBe("cat-1");
    expect(operation).toBe("update");
    // Db row holds the trimmed name; state mirror matches.
    expect(ctx().expenseCategories[0].name).toBe("Groceries");
    const rows = await getAllCategories("user-1");
    expect(rows.find((r) => r.id === "cat-1")?.name).toBe("Groceries");
  });

  it("updates only the icon when no name is supplied", async () => {
    await insertCategory(dbCat("cat-1"));
    mountProvider();
    await flushAll();

    const pending = ctx().updateCategory("expenseCategories", "cat-1", {
      icon: "car",
    });
    await flushAll();
    await pending;

    expect(ctx().expenseCategories[0].icon).toBe("car");
    expect(ctx().expenseCategories[0].name).toBe("Food");
    const [, , , operation] = (enqueue as jest.Mock).mock.calls[0];
    expect(operation).toBe("update");
  });

  it("throws 'Already exists' on a case-insensitive trimmed duplicate rename", async () => {
    await insertCategory(dbCat("cat-1", { name: "Food" }));
    await insertCategory(dbCat("cat-2", { name: "Transport" }));
    mountProvider();
    await flushAll();
    (enqueue as jest.Mock).mockClear();

    await expect(
      ctx().updateCategory("expenseCategories", "cat-1", { name: "  transport  " }),
    ).rejects.toThrow("Already exists");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("throws 'Name cannot be empty' on a whitespace-only rename", async () => {
    await insertCategory(dbCat("cat-1", { name: "Food" }));
    mountProvider();
    await flushAll();

    await expect(
      ctx().updateCategory("expenseCategories", "cat-1", { name: "   " }),
    ).rejects.toThrow("Name cannot be empty");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("no-ops when no update fields are provided", async () => {
    await insertCategory(dbCat("cat-1", { name: "Food" }));
    mountProvider();
    await flushAll();
    (enqueue as jest.Mock).mockClear();

    await ctx().updateCategory("expenseCategories", "cat-1", {});

    expect(enqueue).not.toHaveBeenCalled();
    expect(ctx().expenseCategories[0].name).toBe("Food");
  });

  it("throws 'Not authenticated' without a user", async () => {
    mockUser = null;
    mountProvider();
    await flushAll();

    await expect(
      ctx().updateCategory("expenseCategories", "cat-1", { name: "New" }),
    ).rejects.toThrow("Not authenticated");
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("useCategories guard", () => {
  it("throws when called outside CategoriesProvider", () => {
    function BrokenComponent() {
      useCategories();
      return <View />;
    }

    const prev = console.error;
    console.error = jest.fn();

    expect(() => {
      act(() => {
        renderer.create(<BrokenComponent />);
      });
    }).toThrow("useCategories must be used within CategoriesProvider");

    console.error = prev;
  });
});
