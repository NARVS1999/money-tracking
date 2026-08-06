/**
 * CategoriesProvider unit tests (RED phase — all tests fail before
 * CategoriesProvider.tsx is created).
 *
 * Mock strategy: jest.mock firebase/firestore (onSnapshot/addDoc/deleteDoc/getDocs),
 * AuthProvider (useAuth), and queries (query builders). Each test asserts behavior,
 * not Firestore internals.
 */
import React from "react";
import { View, Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be BEFORE any imports of the modules under test
// ---------------------------------------------------------------------------

// Captured onSnapshot callbacks keyed by a "subscription key" so tests can
// fire the expense/income/entries snapshots independently.
const onSnapshotMocks: Record<string, (snap: any) => void> = {};
const mockUnsubscribe = jest.fn();

const mockAddDoc = jest.fn().mockResolvedValue({ id: "new-cat-1" });
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDocs = jest.fn();
const mockTimestampNow = jest.fn(() => ({ seconds: 0, nanoseconds: 0 }));

// onSnapshot returns an unsubscribe function and captures the callback.
// We use unique query id strings to differentiate the three subscriptions.
const mockOnSnapshot = jest.fn((_query: any, observerOrNext: any) => {
  // Firestore onSnapshot accepts both (query, observer) and (query, onNext).
  const callback =
    typeof observerOrNext === "function"
      ? observerOrNext
      : observerOrNext?.next ?? (() => {});
  // Stash the callback against a tag on the query so tests can fire it.
  const tag = (_query as any)?._tag ?? "unknown";
  onSnapshotMocks[tag] = callback;
  return mockUnsubscribe;
});

jest.mock("firebase/firestore", () => ({
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  Timestamp: { now: () => mockTimestampNow() },
  collection: (db: any, path: string) => ({ _tag: path }),
  doc: (db: any, path: string) => ({ _tag: path }),
}));

// Controlled useAuth — tests can change the return value between renders.
let mockUser: any = { uid: "user-1", email: "a@b.com" };

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser, initializing: false }),
}));

// Query builders return tagged objects so addCategory/deleteCategory pass
// identifiable refs to addDoc / deleteDoc / getDocs.
jest.mock("../../firebase/queries", () => ({
  categoriesOf: (_uid: string, kind: string) => ({ _tag: kind }),
  entriesBase: (_uid: string) => ({ _tag: "entries" }),
  categoryInUse: (_uid: string, _categoryId: string) => ({
    _tag: "categoryInUse",
  }),
}));

// ---------------------------------------------------------------------------
// Import the module under test (after mocks are in place)
// ---------------------------------------------------------------------------
import { CategoriesProvider, useCategories } from "../CategoriesProvider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convenience: fire the expenseCategories onSnapshot with given docs. */
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

/** Convenience: fire the incomeCategories onSnapshot with given docs. */
function fireIncomeSnapshot(docs: Array<{ id: string; name: string }>) {
  const cb = onSnapshotMocks["incomeCategories"];
  if (!cb) throw new Error("incomeCategories onSnapshot not subscribed");
  cb({
    docs: docs.map((d) => ({
      id: d.id,
      data: () => ({ name: d.name, createdAt: mockTimestampNow() }),
    })),
  });
}

/** Convenience: fire the entries onSnapshot with given categoryId maps. */
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
 * Provider wrapper that exposes the context value via a child render-prop so
 * tests can read state directly instead of spelunking component trees.
 */
function ProviderWithCapture({
  onValue,
}: {
  onValue: (v: ReturnType<typeof useCategories>) => void;
}) {
  return (
    <CategoriesProvider>
      <Capture onValue={onValue} />
    </CategoriesProvider>
  );
}

function Capture({
  onValue,
}: {
  onValue: (v: ReturnType<typeof useCategories>) => void;
}) {
  const value = useCategories();
  onValue(value);
  return <Text>child</Text>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Reset captured callbacks
  Object.keys(onSnapshotMocks).forEach((k) => delete onSnapshotMocks[k]);
  mockUser = { uid: "user-1", email: "a@b.com" };
});

// --- addCategory -----------------------------------------------------------

describe("addCategory", () => {
  it("calls addDoc with uid, trimmed name, createdAt (success)", async () => {
    let ctx: any = null;
    renderer.create(<ProviderWithCapture onValue={(v) => (ctx = v)} />);

    await act(async () => {
      await ctx.addCategory("expenseCategories", "  Food  ");
    });

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = mockAddDoc.mock.calls[0];
    expect(ref._tag).toBe("expenseCategories");
    expect(data.uid).toBe("user-1");
    expect(data.name).toBe("Food");
    expect(data.createdAt).toBeDefined();
  });

  it("silently no-ops on blank input (whitespace only)", async () => {
    let ctx: any = null;
    renderer.create(<ProviderWithCapture onValue={(v) => (ctx = v)} />);

    await act(async () => {
      await ctx.addCategory("expenseCategories", "   ");
    });

    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("throws 'Already exists' on case-insensitive trimmed duplicate", async () => {
    let ctx: any = null;
    renderer.create(<ProviderWithCapture onValue={(v) => (ctx = v)} />);

    // Seed the expenseCategories state
    await act(async () => {
      fireExpenseSnapshot([{ id: "cat-1", name: "Food" }]);
    });

    await act(async () => {
      await expect(ctx.addCategory("expenseCategories", "  food  ")).rejects.toThrow(
        "Already exists",
      );
    });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("silently no-ops when user is null (not signed in)", async () => {
    mockUser = null;
    let ctx: any = null;
    renderer.create(<ProviderWithCapture onValue={(v) => (ctx = v)} />);

    await act(async () => {
      // Should not throw — just returns early
      await ctx.addCategory("expenseCategories", "Food");
    });

    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

// --- deleteCategory ---------------------------------------------------------

describe("deleteCategory", () => {
  it("deletes unused category (getDocs returns empty)", async () => {
    mockGetDocs.mockResolvedValue({ empty: true });
    let ctx: any = null;
    renderer.create(<ProviderWithCapture onValue={(v) => (ctx = v)} />);

    await act(async () => {
      await ctx.deleteCategory("expenseCategories", "cat-to-delete");
    });

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    const [ref] = mockDeleteDoc.mock.calls[0];
    expect(ref._tag).toBe("expenseCategories/cat-to-delete");
  });

  it("throws 'Category is in use' and does NOT delete", async () => {
    mockGetDocs.mockResolvedValue({ empty: false });
    let ctx: any = null;
    renderer.create(<ProviderWithCapture onValue={(v) => (ctx = v)} />);

    await act(async () => {
      await expect(
        ctx.deleteCategory("incomeCategories", "in-use-cat"),
      ).rejects.toThrow("Category is in use");
    });

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it("silently no-ops when user is null", async () => {
    mockUser = null;
    let ctx: any = null;
    renderer.create(<ProviderWithCapture onValue={(v) => (ctx = v)} />);

    await act(async () => {
      await ctx.deleteCategory("expenseCategories", "any-cat");
    });

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});

// --- usageMap derivation ----------------------------------------------------

describe("usageMap", () => {
  it("derives correct per-category counts from entries snapshot", async () => {
    let ctx: any = null;
    renderer.create(<ProviderWithCapture onValue={(v) => (ctx = v)} />);

    await act(async () => {
      fireEntriesSnapshot([
        { categoryId: "A" },
        { categoryId: "B" },
        { categoryId: "A" },
      ]);
    });

    expect(ctx.usageMap).toBeInstanceOf(Map);
    expect(ctx.usageMap.get("A")).toBe(2);
    expect(ctx.usageMap.get("B")).toBe(1);
    expect(ctx.usageMap.size).toBe(2);
  });

  it("starts as an empty Map before entries snapshot", async () => {
    let ctx: any = null;
    renderer.create(<ProviderWithCapture onValue={(v) => (ctx = v)} />);

    expect(ctx.usageMap).toBeInstanceOf(Map);
    expect(ctx.usageMap.size).toBe(0);
  });
});

// --- listener lifecycle -----------------------------------------------------

describe("listener lifecycle", () => {
  it("unsubscribes all three listeners when user changes to null", async () => {
    // Mount with a user → three subscriptions created
    mockUser = { uid: "user-1" };
    const wrapper = renderer.create(
      <ProviderWithCapture onValue={() => {}} />,
    );

    // Verify subscriptions were created
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3);

    // Sign out
    mockUser = null;
    await act(async () => {
      wrapper.update(
        <ProviderWithCapture onValue={() => {}} />,
      );
    });

    // All three unsubscribes should have been called
    expect(mockUnsubscribe).toHaveBeenCalledTimes(3);
  });
});

// --- hook guard -------------------------------------------------------------

describe("useCategories guard", () => {
  it("throws when called outside CategoriesProvider", () => {
    function BrokenComponent() {
      useCategories();
      return <View />;
    }

    // Suppress the expected console.error from React for this test
    const prevConsoleError = console.error;
    console.error = jest.fn();

    expect(() => {
      renderer.create(<BrokenComponent />);
    }).toThrow("useCategories must be used within CategoriesProvider");

    console.error = prevConsoleError;
  });
});
