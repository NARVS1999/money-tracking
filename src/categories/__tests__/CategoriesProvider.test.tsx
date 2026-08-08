/**
 * CategoriesProvider unit tests — mocks firebase/firestore, AuthProvider,
 * EntriesProvider, and queries to assert behavior of the manual-sync model:
 * one-time getDocs load, sync(), usageMap derived from EntriesProvider,
 * addCategory, deleteCategory, and the useCategories hook guard.
 *
 * React 19 + react-test-renderer: initial renderer.create MUST be wrapped in
 * act() or child components never execute.
 */
import React from "react";
import { View, Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be BEFORE any imports of the modules under test
// ---------------------------------------------------------------------------

const mockAddDoc = jest.fn().mockResolvedValue({ id: "new-cat-1" });
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDocs = jest.fn();
const mockTimestampNow = jest.fn(() => {
  // Lazy-require the real Timestamp so instanceof works in fetchCategories
  const realTs = (jest.requireActual("firebase/firestore") as any).Timestamp;
  return new realTs(0, 0);
});

jest.mock("firebase/firestore", () => {
  const actual = jest.requireActual("firebase/firestore") as any;
  const TimestampMock = actual.Timestamp;
  TimestampMock.now = () => mockTimestampNow();
  return {
    addDoc: (...args: any[]) => mockAddDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    Timestamp: TimestampMock,
    collection: (_db: any, path: string) => ({ _tag: path }),
    doc: function (_db: any, ...segments: string[]) { return { _tag: segments.join("/") }; },
    query: (...args: any[]) => ((args[0] as any)?._tag ? { _tag: `query(${(args[0] as any)._tag})` } : { _tag: "query" }),
    where: (_field: string, _op: string, _value: any) => ({ _op: "where" }),
    initializeFirestore: jest.fn(() => ({ _tag: "db" })),
  };
});

jest.mock("../../firebase/config", () => ({ firebaseConfig: {} }));

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({ name: "mock" })),
}));

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

jest.mock("../../firebase/queries", () => ({
  categoriesOf: (_uid: string, kind: string) => ({ _tag: kind }),
  categoryInUse: (_uid: string, _categoryId: string) => ({ _tag: "categoryInUse" }),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { CategoriesProvider, useCategories } from "../CategoriesProvider";
import type { CategoriesContextValue } from "../CategoriesProvider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Module-level slot so child components can stash the context value. */
let latestContext: CategoriesContextValue | null = null;

/** Renders as a child of CategoriesProvider and stashes the context value. */
function ContextCapture() {
  latestContext = useCategories();
  return <Text>ok</Text>;
}

function ctx(): CategoriesContextValue {
  if (!latestContext) throw new Error("Context not captured — did the render succeed?");
  return latestContext;
}

/** Shape of a getDocs QuerySnapshot stub consumed by fetchCategories. */
function catSnap(docs: Array<{ id: string; name: string }>) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => ({ name: d.name, createdAt: mockTimestampNow() }),
    })),
  };
}

/**
 * Mount CategoriesProvider + ContextCapture inside act() and flush the
 * one-time load effect's getDocs promises. The load effect fires on mount
 * (two getDocs calls: expenseCategories, incomeCategories), so tests that
 * care about load behavior must prime mockGetDocs BEFORE mounting.
 */
async function mountProvider() {
  let root: any;
  await act(async () => {
    root = renderer.create(
      <CategoriesProvider>
        <ContextCapture />
      </CategoriesProvider>,
    );
  });
  return root;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { uid: "user-1", email: "a@b.com" };
  mockEntries = [];
  latestContext = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("initial load", () => {
  it("fetches both category lists once via uid-scoped queries", async () => {
    mockGetDocs
      .mockResolvedValueOnce(
        catSnap([{ id: "cat-1", name: "Food" }, { id: "cat-2", name: "Transport" }]),
      )
      .mockResolvedValueOnce(catSnap([{ id: "cat-3", name: "Salary" }]));
    await mountProvider();

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    const [expenseRef, incomeRef] = mockGetDocs.mock.calls.map((c) => c[0]);
    expect(expenseRef._tag).toBe("expenseCategories");
    expect(incomeRef._tag).toBe("incomeCategories");

    expect(ctx().expenseCategories).toHaveLength(2);
    expect(ctx().expenseCategories.map((c) => c.name)).toEqual(["Food", "Transport"]);
    expect(ctx().incomeCategories.map((c) => c.name)).toEqual(["Salary"]);
  });
});

describe("sync", () => {
  it("refetches both lists, replaces state, and flips isSyncing", async () => {
    mockGetDocs.mockResolvedValue(catSnap([]));
    await mountProvider();
    expect(ctx().isSyncing).toBe(false);

    // Hold the first sync getDocs promise open so we can observe isSyncing.
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    mockGetDocs
      .mockReturnValueOnce(gate.then(() => catSnap([{ id: "new-1", name: "New" }])))
      .mockReturnValueOnce(Promise.resolve(catSnap([{ id: "new-2", name: "Other" }])));

    let syncPromise: Promise<void>;
    act(() => { syncPromise = ctx().sync(); });
    expect(ctx().isSyncing).toBe(true);

    await act(async () => {
      release();
      await syncPromise;
    });

    expect(ctx().isSyncing).toBe(false);
    expect(ctx().expenseCategories.map((c) => c.name)).toEqual(["New"]);
    expect(ctx().incomeCategories.map((c) => c.name)).toEqual(["Other"]);
  });
});

describe("usageMap", () => {
  it("derives correct per-category counts from EntriesProvider entries", async () => {
    mockEntries = [
      { categoryId: "A" },
      { categoryId: "B" },
      { categoryId: "A" },
    ];
    mockGetDocs.mockResolvedValue(catSnap([]));
    await mountProvider();

    expect(ctx().usageMap).toBeInstanceOf(Map);
    expect(ctx().usageMap.get("A")).toBe(2);
    expect(ctx().usageMap.get("B")).toBe(1);
    expect(ctx().usageMap.size).toBe(2);
  });

  it("is empty when there are no entries", async () => {
    mockGetDocs.mockResolvedValue(catSnap([]));
    await mountProvider();

    expect(ctx().usageMap).toBeInstanceOf(Map);
    expect(ctx().usageMap.size).toBe(0);
  });
});

describe("addCategory", () => {
  it("calls addDoc with uid, trimmed name, createdAt and appends to state", async () => {
    mockGetDocs.mockResolvedValue(catSnap([]));
    await mountProvider();

    await act(async () => {
      await ctx().addCategory("expenseCategories", "  Food  ");
    });

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = mockAddDoc.mock.calls[0];
    expect(ref._tag).toBe("expenseCategories");
    expect(data.uid).toBe("user-1");
    expect(data.name).toBe("Food");
    expect(data.createdAt).toBeDefined();

    // Mirrored into state immediately (visible without a sync)
    expect(ctx().expenseCategories).toHaveLength(1);
    expect(ctx().expenseCategories[0]).toEqual({
      id: "new-cat-1",
      name: "Food",
      createdAt: mockTimestampNow(),
    });
  });

  it("appends income categories to the income list", async () => {
    mockGetDocs.mockResolvedValue(catSnap([]));
    await mountProvider();

    await act(async () => {
      await ctx().addCategory("incomeCategories", "Salary");
    });

    expect(ctx().incomeCategories).toHaveLength(1);
    expect(ctx().incomeCategories[0].name).toBe("Salary");
    expect(ctx().expenseCategories).toHaveLength(0);
  });

  it("silently no-ops on blank input (whitespace only)", async () => {
    mockGetDocs.mockResolvedValue(catSnap([]));
    await mountProvider();

    await act(async () => {
      await ctx().addCategory("expenseCategories", "   ");
    });

    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("throws 'Already exists' on case-insensitive trimmed duplicate", async () => {
    mockGetDocs
      .mockResolvedValueOnce(catSnap([{ id: "cat-1", name: "Food" }]))
      .mockResolvedValueOnce(catSnap([]));
    await mountProvider();

    await act(async () => {
      await expect(
        ctx().addCategory("expenseCategories", "  food  "),
      ).rejects.toThrow("Already exists");
    });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("throws 'Not authenticated' when user is null", async () => {
    mockUser = null;
    mockGetDocs.mockResolvedValue(catSnap([]));
    await mountProvider();

    await act(async () => {
      await expect(
        ctx().addCategory("expenseCategories", "Food"),
      ).rejects.toThrow("Not authenticated");
    });

    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

describe("deleteCategory", () => {
  it("deletes unused category and removes it from state", async () => {
    mockGetDocs
      .mockResolvedValueOnce(catSnap([{ id: "cat-to-delete", name: "Food" }]))
      .mockResolvedValueOnce(catSnap([]));
    await mountProvider();

    // Load consumed 2 getDocs calls; guard sequence: uid ownership check
    // passes, inUse returns empty.
    mockGetDocs
      .mockResolvedValueOnce({ empty: false, docs: [{ id: "cat-to-delete" }] })
      .mockResolvedValueOnce({ empty: true });
    await act(async () => {
      await ctx().deleteCategory("expenseCategories", "cat-to-delete");
    });

    expect(mockGetDocs).toHaveBeenCalledTimes(4);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    const [ref] = mockDeleteDoc.mock.calls[0];
    expect(ref._tag).toBe("expenseCategories/cat-to-delete");
    expect(ctx().expenseCategories).toHaveLength(0);
  });

  it("throws 'Category is in use' and does NOT delete", async () => {
    mockGetDocs
      .mockResolvedValueOnce(catSnap([]))
      .mockResolvedValueOnce(catSnap([{ id: "in-use-cat", name: "X" }]));
    await mountProvider();

    mockGetDocs
      .mockResolvedValueOnce({ empty: false, docs: [{ id: "in-use-cat" }] })
      .mockResolvedValueOnce({ empty: false });
    await act(async () => {
      await expect(
        ctx().deleteCategory("incomeCategories", "in-use-cat"),
      ).rejects.toThrow("Category is in use");
    });

    expect(mockGetDocs).toHaveBeenCalledTimes(4);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(ctx().incomeCategories).toHaveLength(1);
  });

  it("throws 'Not authenticated' when user is null", async () => {
    mockUser = null;
    mockGetDocs.mockResolvedValue(catSnap([]));
    await mountProvider();

    await act(async () => {
      await expect(
        ctx().deleteCategory("expenseCategories", "any-cat"),
      ).rejects.toThrow("Not authenticated");
    });

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});

describe("useCategories guard", () => {
  it("throws when called outside CategoriesProvider", () => {
    // React 19: render-phase errors propagate through act(), not
    // renderer.create directly. Assert on the act() boundary.
    function BrokenComponent() {
      useCategories();
      return <View />;
    }

    // Suppress the expected console.error from React error boundary
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
