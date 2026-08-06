/**
 * CategoriesProvider unit tests — mocks firebase/firestore, AuthProvider, and
 * queries to assert behavior of addCategory, deleteCategory, usageMap, listener
 * lifecycle, and the useCategories hook guard.
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

// Captured onSnapshot callbacks keyed by query tag so tests can fire the
// expense/income/entries snapshots independently.
const onSnapshotMocks: Record<string, (snap: any) => void> = {};
const mockUnsubscribe = jest.fn();

const mockAddDoc = jest.fn().mockResolvedValue({ id: "new-cat-1" });
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDocs = jest.fn();
const mockTimestampNow = jest.fn(() => {
  // Lazy-require the real Timestamp so instanceof works in onSnapshot callbacks
  const realTs = (jest.requireActual("firebase/firestore") as any).Timestamp;
  return new realTs(0, 0);
});

const mockOnSnapshot = jest.fn((_query: any, observerOrNext: any) => {
  const callback =
    typeof observerOrNext === "function"
      ? observerOrNext
      : observerOrNext?.next ?? (() => {});
  const tag = (_query as any)?._tag ?? "unknown";
  onSnapshotMocks[tag] = callback;
  return mockUnsubscribe;
});

jest.mock("firebase/firestore", () => {
  const actual = jest.requireActual("firebase/firestore") as any;
  const TimestampMock = actual.Timestamp;
  TimestampMock.now = () => mockTimestampNow();
  return {
    // @ts-expect-error – spread of any[] is intentional for mock forwarding
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
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

jest.mock("../../firebase/queries", () => ({
  categoriesOf: (_uid: string, kind: string) => ({ _tag: kind }),
  entriesBase: (_uid: string) => ({ _tag: "entries" }),
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

function fireExpenseSnapshot(docs: Array<{ id: string; name: string }>) {
  const cb = onSnapshotMocks["expenseCategories"];
  if (!cb) throw new Error("expenseCategories onSnapshot not subscribed");
  cb({
    docs: docs.map((d) => ({
      id: d.id,
      data: () => ({ name: d.name, createdAt: mockTimestampNow() }),
    })),
  });
}

function fireEntriesSnapshot(entries: Array<{ categoryId: string }>) {
  const cb = onSnapshotMocks["entries"];
  if (!cb) throw new Error("entries onSnapshot not subscribed");
  cb({
    docs: entries.map((e) => ({ id: "e", data: () => e })),
    forEach(fn: (d: any) => void) {
      entries.forEach((e) => fn({ id: "e", data: () => e }));
    },
  });
}

/**
 * Mount CategoriesProvider + ContextCapture inside act().
 * The onSnapshot side-effect fires synchronously in the mock (callback is
 * captured but state is not updated until the callback is explicitly fired).
 * For the "empty map" test, use this directly. For tests that need
 * snapshot data, fire the callback separately inside act().
 */
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(onSnapshotMocks).forEach((k) => delete onSnapshotMocks[k]);
  mockUser = { uid: "user-1", email: "a@b.com" };
  latestContext = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("addCategory", () => {
  it("calls addDoc with uid, trimmed name, createdAt (success)", async () => {
    mountProvider();

    await act(async () => {
      await ctx().addCategory("expenseCategories", "  Food  ");
    });

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = mockAddDoc.mock.calls[0];
    expect(ref._tag).toBe("expenseCategories");
    expect(data.uid).toBe("user-1");
    expect(data.name).toBe("Food");
    expect(data.createdAt).toBeDefined();
  });

  it("silently no-ops on blank input (whitespace only)", async () => {
    mountProvider();

    await act(async () => {
      await ctx().addCategory("expenseCategories", "   ");
    });

    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("throws 'Already exists' on case-insensitive trimmed duplicate", async () => {
    mountProvider();

    // Seed the expenseCategories state
    await act(async () => {
      fireExpenseSnapshot([{ id: "cat-1", name: "Food" }]);
    });

    await act(async () => {
      await expect(
        ctx().addCategory("expenseCategories", "  food  "),
      ).rejects.toThrow("Already exists");
    });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("throws 'Not authenticated' when user is null", async () => {
    mockUser = null;
    mountProvider();

    await act(async () => {
      await expect(
        ctx().addCategory("expenseCategories", "Food"),
      ).rejects.toThrow("Not authenticated");
    });

    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

describe("deleteCategory", () => {
  it("deletes unused category (getDocs for uid check returns doc, inUse returns empty)", async () => {
    mockGetDocs
      .mockResolvedValueOnce({ empty: false, docs: [{ id: "cat-to-delete" }] }) // uid ownership check
      .mockResolvedValueOnce({ empty: true }); // inUse check
    mountProvider();

    await act(async () => {
      await ctx().deleteCategory("expenseCategories", "cat-to-delete");
    });

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    const [ref] = mockDeleteDoc.mock.calls[0];
    expect(ref._tag).toBe("expenseCategories/cat-to-delete");
  });

  it("throws 'Category is in use' and does NOT delete (uid check passes, inUse not empty)", async () => {
    mockGetDocs
      .mockResolvedValueOnce({ empty: false, docs: [{ id: "in-use-cat" }] }) // uid ownership check
      .mockResolvedValueOnce({ empty: false }); // inUse check
    mountProvider();

    await act(async () => {
      await expect(
        ctx().deleteCategory("incomeCategories", "in-use-cat"),
      ).rejects.toThrow("Category is in use");
    });

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it("throws 'Not authenticated' when user is null", async () => {
    mockUser = null;
    mountProvider();

    await act(async () => {
      await expect(
        ctx().deleteCategory("expenseCategories", "any-cat"),
      ).rejects.toThrow("Not authenticated");
    });

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});

describe("usageMap", () => {
  it("derives correct per-category counts from entries snapshot", async () => {
    mountProvider();

    await act(async () => {
      fireEntriesSnapshot([
        { categoryId: "A" },
        { categoryId: "B" },
        { categoryId: "A" },
      ]);
    });

    expect(ctx().usageMap).toBeInstanceOf(Map);
    expect(ctx().usageMap.get("A")).toBe(2);
    expect(ctx().usageMap.get("B")).toBe(1);
    expect(ctx().usageMap.size).toBe(2);
  });

  it("starts as an empty Map before entries snapshot", () => {
    mountProvider();

    expect(ctx().usageMap).toBeInstanceOf(Map);
    expect(ctx().usageMap.size).toBe(0);
  });
});

describe("listener lifecycle", () => {
  it("unsubscribes all three listeners when user changes to null", async () => {
    mockUser = { uid: "user-1" };
    let root: any;
    act(() => {
      root = renderer.create(
        <CategoriesProvider>
          <ContextCapture />
        </CategoriesProvider>,
      );
    });

    expect(mockOnSnapshot).toHaveBeenCalledTimes(3);

    // Sign out
    mockUser = null;
    await act(async () => {
      root.update(
        <CategoriesProvider>
          <ContextCapture />
        </CategoriesProvider>,
      );
    });

    expect(mockUnsubscribe).toHaveBeenCalledTimes(3);
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
