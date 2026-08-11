/**
 * SyncButton unit tests (phase 12, OFFL-09/SYNC-05 + WR-04). Covers the
 * pending-changes badge (refreshed on mount and whenever the providers'
 * state mutates — the WR-04 fix), the last-sync status line, the press →
 * entriesSync + categoriesSync flow, the Alert on failure, and the disabled
 * state while syncing. Queue/watermark reads run against the real db layer
 * backed by the in-memory sqlite mock.
 */
import React from "react";
import { Alert, Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be BEFORE any imports of the module under test
// ---------------------------------------------------------------------------

jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));

jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native");
  return {
    Ionicons: (props: any) => ReactMod.createElement(RN.Text, props, "icon"),
  };
});

let mockUser: any = { uid: "user-1" };

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockEntries: any = {};

jest.mock("../../entries/EntriesProvider", () => ({
  useEntries: () => mockEntries,
}));

let mockCategories: any = {};

jest.mock("../../categories/CategoriesProvider", () => ({
  useCategories: () => mockCategories,
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import SyncButton from "../SyncButton";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import { resetDbForTesting } from "../../db/database";
import { enqueue, clearQueue } from "../../db/syncQueue";
import { setLastSync } from "../../sync/syncMetadata";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The providers' real sync() delegates to fullSync, which drains the queue —
// the mocked provider sync simulates that so the post-press badge refresh is
// observable.
function syncingSyncMock() {
  return jest.fn(async () => {
    await clearQueue("user-1");
  });
}

function mountButton() {
  let root: any;
  act(() => {
    root = renderer.create(<SyncButton />);
  });
  return root;
}

// Flush one macrotask + pending React work (same pattern as the provider
// tests — async act() hangs with in-flight effect chains in this env).
async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  act(() => {});
}

async function flushAll(times = 4) {
  for (let i = 0; i < times; i++) await flush();
}

function button(root: any): any {
  return root.root.findByProps({ accessibilityRole: "button" });
}

function statusTexts(root: any): string[] {
  return root.root
    .findAllByType(Text)
    .map((t: any) => t.props.children)
    .filter(
      (c: unknown) =>
        typeof c === "string" && c !== "icon" && c.trim().length > 0,
    );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSqliteMock();
  resetDbForTesting();
  mockUser = { uid: "user-1" };
  mockEntries = {
    entries: [],
    sync: syncingSyncMock(),
    isSyncing: false,
  };
  mockCategories = {
    expenseCategories: [],
    incomeCategories: [],
    sync: syncingSyncMock(),
    isSyncing: false,
  };
});

describe("SyncButton status", () => {
  it("shows the pending badge and count text when the queue is non-empty (WR-04)", async () => {
    await enqueue("user-1", "entries", "e1", "create");
    await enqueue("user-1", "entries", "e2", "update");

    const root = mountButton();
    await flushAll();

    const status = statusTexts(root);
    expect(status).toContain("2 pending");
    expect(button(root).props.accessibilityLabel).toBe(
      "Sync data (2 pending changes)",
    );
  });

  it("caps the badge count display at 99+", async () => {
    for (let i = 0; i < 150; i++) {
      await enqueue("user-1", "entries", `e${i}`, "create");
    }

    const root = mountButton();
    await flushAll();

    expect(statusTexts(root)).toContain("99+");
  });

  it("shows the relative last-sync time when the queue is empty", async () => {
    await setLastSync("user-1", Date.now() - 5_000);

    const root = mountButton();
    await flushAll();

    expect(statusTexts(root)).toContain("synced just now");
  });

  it("shows nothing when there is no user", async () => {
    mockUser = null;
    const root = mountButton();
    await flushAll();

    expect(statusTexts(root)).toEqual([]);
  });
});

describe("SyncButton press", () => {
  it("runs both providers' sync() on press and refreshes the badge", async () => {
    await enqueue("user-1", "entries", "e1", "create");
    const root = mountButton();
    await flushAll();

    act(() => {
      button(root).props.onPress();
    });
    await flushAll();

    expect(mockEntries.sync).toHaveBeenCalledTimes(1);
    expect(mockCategories.sync).toHaveBeenCalledTimes(1);
    // Queue drained (both syncs ran against the real sync service) → badge gone.
    expect(statusTexts(root)).not.toContain("1 pending");
  });

  it("alerts on sync failure instead of swallowing it", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    mockEntries.sync.mockRejectedValueOnce(new Error("network down"));

    const root = mountButton();
    await flushAll();

    act(() => {
      button(root).props.onPress();
    });
    await flushAll();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe("Sync failed");
    expect(alertSpy.mock.calls[0][1]).toBe("network down");
  });

  it("does nothing while a sync is in flight", async () => {
    const root = mountButton();
    await flushAll();

    mockEntries.isSyncing = true;
    act(() => {
      root.update(<SyncButton />);
    });
    await flushAll();

    act(() => {
      button(root).props.onPress();
    });
    await flushAll();

    expect(mockEntries.sync).not.toHaveBeenCalled();
    expect(mockCategories.sync).not.toHaveBeenCalled();
  });

  it("does not sync when there is no user", async () => {
    mockUser = null;
    const root = mountButton();
    await flushAll();

    act(() => {
      button(root).props.onPress();
    });
    await flushAll();

    expect(mockEntries.sync).not.toHaveBeenCalled();
    expect(mockCategories.sync).not.toHaveBeenCalled();
  });

  it("does not sync while syncing even if the button is pressed (guard)", async () => {
    const root = mountButton();
    await flushAll();

    mockEntries.isSyncing = true;
    act(() => {
      root.update(<SyncButton />);
    });
    await flushAll();

    act(() => {
      button(root).props.onPress();
    });
    await flushAll();

    expect(mockEntries.sync).not.toHaveBeenCalled();
  });
});
