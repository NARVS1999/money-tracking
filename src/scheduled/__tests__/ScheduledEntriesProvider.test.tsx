/**
 * ScheduledEntriesProvider unit tests (phase 13, SCHD-05) — the write
 * contract mirrors EntriesProvider: SQLite insert + syncQueue enqueue per
 * write, amount as integer cents (amountCents at the db boundary), temp ids
 * for offline creates, and pause/resume toggling isActive (a data change
 * that forces synced = 0 so the state pushes).
 *
 * Mocks: in-memory sqlite mock (jest/sqlite-mock), in-memory Firestore mock
 * (jest/firestore-mock), and wrapped insertScheduled/enqueue so call
 * payloads are assertable while the real implementations still run.
 */
import React from "react";
import { Text } from "react-native";
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

let mockUser: any = { uid: "user-1" };

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}));

// The provider's sync() delegates to fullSync — mocked so sync timing is
// controllable and no cloud calls are needed.
jest.mock("../../sync/syncService", () => ({
  fullSync: jest.fn(),
}));

// Wrap the real db modules so the write payloads are assertable.
jest.mock("../../db/scheduled", () => {
  const actual = jest.requireActual("../../db/scheduled");
  return {
    ...actual,
    insertScheduled: jest.fn(actual.insertScheduled),
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
// eslint-disable-next-line import/first
import {
  ScheduledEntriesProvider,
  useScheduledEntries,
} from "../ScheduledEntriesProvider";
import { insertScheduled, getAllScheduled } from "../../db/scheduled";
import { enqueue } from "../../db/syncQueue";
import { fullSync } from "../../sync/syncService";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import { resetFsMock } from "../../../jest/firestore-mock";
import { resetDbForTesting } from "../../db/database";
import type { DbScheduledInput } from "../../db/scheduled";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const captured = {
  latest: null as ReturnType<typeof useScheduledEntries> | null,
};

function Capture() {
  // Test capture pattern: writing the context snapshot to a holder during
  // render is intentional in tests.
  // eslint-disable-next-line react-hooks/immutability
  captured.latest = useScheduledEntries();
  return <Text>ok</Text>;
}

function ctx(): NonNullable<typeof captured.latest> {
  if (!captured.latest) throw new Error("Scheduled context not captured");
  return captured.latest;
}

// NOTE: async act() hangs in this jest-expo/React-19 environment when a
// mounted provider has an in-flight effect promise chain (documented in
// EntriesProvider.test.tsx). Mount with sync act and flush promise chains
// with macrotask + sync act cycles instead.
function mountSync() {
  let root: any;
  act(() => {
    root = renderer.create(
      <ScheduledEntriesProvider>
        <Capture />
      </ScheduledEntriesProvider>,
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

const now = 1_752_000_000_000;

function dbRow(id: string, overrides: Partial<DbScheduledInput> = {}): DbScheduledInput {
  return {
    id,
    uid: "user-1",
    type: "expense",
    amountCents: 100_00,
    categoryId: "cat-1",
    date: "2026-08-11",
    description: "Daily coffee",
    frequency: "daily",
    createdAt: now,
    updatedAt: now,
    synced: 1,
    ...overrides,
  };
}

const sampleInput = {
  type: "expense" as const,
  amount: 100_00,
  categoryId: "cat-1",
  date: "2026-08-11",
  description: "Daily coffee",
  frequency: "daily" as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  resetSqliteMock();
  resetFsMock();
  resetDbForTesting();
  mockUser = { uid: "user-1" };
  captured.latest = null;
});

describe("ScheduledEntriesProvider load", () => {
  it("loads templates from SQLite on sign-in (amount -> cents at the db boundary)", async () => {
    await insertScheduled(dbRow("t1"));
    await insertScheduled(dbRow("t2", { id: "off", isActive: 0 }));
    mountSync();
    await flushAll();

    expect(ctx().scheduledEntries.map((s) => s.id)).toEqual(["t1", "off"]);
    expect(ctx().scheduledEntries[0].amount).toBe(100_00);
    expect(ctx().scheduledEntries[0].isActive).toBe(true);
    expect(ctx().scheduledEntries[1].isActive).toBe(false);
    expect(ctx().scheduledEntries[0].frequency).toBe("daily");
    expect(ctx().isLoading).toBe(false);
  });

  it("is empty without a user", async () => {
    mockUser = null;
    mountSync();
    await flushAll();
    expect(ctx().scheduledEntries).toEqual([]);
  });
});

describe("ScheduledEntriesProvider write contract", () => {
  it("writes amountCents — not amount — on addScheduled, and queues a create", async () => {
    mountSync();
    await flushAll();

    const pending = ctx().addScheduled(sampleInput);
    await flushAll();
    await pending;

    expect(insertScheduled).toHaveBeenCalledTimes(1);
    const payload = (insertScheduled as jest.Mock).mock.calls[0][0];
    expect(payload.amountCents).toBe(100_00);
    expect(payload.amount).toBeUndefined();
    expect(payload.uid).toBe("user-1");
    expect(payload.frequency).toBe("daily");
    expect(payload.isActive).toBe(1);
    expect(payload.endDate).toBeNull();
    expect(payload.synced).toBe(0);

    // Queued as a create on the scheduledEntries collection with a temp id.
    expect(enqueue).toHaveBeenCalledTimes(1);
    const [, collection, docId, operation] = (enqueue as jest.Mock).mock.calls[0];
    expect(collection).toBe("scheduledEntries");
    expect(operation).toBe("create");
    expect(docId).toMatch(/^local-/);

    // Mirrored into state immediately.
    const entry = ctx().scheduledEntries.find((s) => s.id === docId);
    expect(entry).toBeDefined();
    expect(entry?.amount).toBe(100_00);
    expect(entry?.isActive).toBe(true);
    expect(entry?.lastGenerated).toBeNull();
  });

  it("rejects an unknown frequency on addScheduled", async () => {
    mountSync();
    await flushAll();

    await expect(
      ctx().addScheduled({ ...sampleInput, frequency: "fortnightly" as never }),
    ).rejects.toThrow("Invalid frequency");
    expect(insertScheduled).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("updates a template and queues an update (bumps updatedAt, synced forced 0)", async () => {
    await insertScheduled(dbRow("t1", { updatedAt: 1000, synced: 1 }));
    mountSync();
    await flushAll();
    (enqueue as jest.Mock).mockClear();

    await ctx().updateScheduled("t1", { description: "Renamed", amount: 200_00 });
    await flushAll();

    expect((enqueue as jest.Mock).mock.calls[0][2]).toBe("t1");
    expect((enqueue as jest.Mock).mock.calls[0][3]).toBe("update");
    const rows = await getAllScheduled("user-1");
    expect(rows[0].description).toBe("Renamed");
    expect(rows[0].amountCents).toBe(200_00);
    expect(rows[0].updatedAt).toBeGreaterThan(1000);
    expect(rows[0].synced).toBe(0);
    expect(ctx().scheduledEntries[0].description).toBe("Renamed");
    expect(ctx().scheduledEntries[0].amount).toBe(200_00);
  });

  it("no-ops updateScheduled when no fields are provided", async () => {
    await insertScheduled(dbRow("t1"));
    mountSync();
    await flushAll();
    (enqueue as jest.Mock).mockClear();

    await ctx().updateScheduled("t1", {});

    expect(enqueue).not.toHaveBeenCalled();
    expect(ctx().scheduledEntries[0].description).toBe("Daily coffee");
  });

  it("deletes a template and queues a delete", async () => {
    await insertScheduled(dbRow("t1"));
    mountSync();
    await flushAll();
    (enqueue as jest.Mock).mockClear();

    const pending = ctx().deleteScheduled("t1");
    await flushAll();
    await pending;

    expect(ctx().scheduledEntries).toHaveLength(0);
    const last = (enqueue as jest.Mock).mock.calls.at(-1);
    expect(last?.[2]).toBe("t1");
    expect(last?.[3]).toBe("delete");
    expect(await getAllScheduled("user-1")).toHaveLength(0);
  });

  it("pauseScheduled sets isActive 0 and queues an update; resumeScheduled restores 1", async () => {
    await insertScheduled(dbRow("t1"));
    mountSync();
    await flushAll();
    (enqueue as jest.Mock).mockClear();

    await ctx().pauseScheduled("t1");
    await flushAll();
    expect(ctx().scheduledEntries[0].isActive).toBe(false);
    const pausePayload = (enqueue as jest.Mock).mock.calls[0];
    expect(pausePayload[2]).toBe("t1");
    expect(pausePayload[3]).toBe("update");

    await ctx().resumeScheduled("t1");
    await flushAll();
    expect(ctx().scheduledEntries[0].isActive).toBe(true);
    expect((await getAllScheduled("user-1"))[0].isActive).toBe(1);
  });
});

describe("ScheduledEntriesProvider sync", () => {
  it("runs fullSync, reloads from SQLite, and flips isSyncing", async () => {
    await insertScheduled(dbRow("t1"));
    mountSync();
    await flushAll();
    expect(ctx().isSyncing).toBe(false);

    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    (fullSync as jest.Mock).mockReturnValueOnce(gate);

    let syncPromise: Promise<void>;
    act(() => { syncPromise = ctx().sync(); });
    expect(ctx().isSyncing).toBe(true);

    await act(async () => {
      release();
      await syncPromise;
    });

    expect(fullSync).toHaveBeenCalledTimes(1);
    expect(ctx().isSyncing).toBe(false);
    expect(ctx().scheduledEntries.map((s) => s.id)).toEqual(["t1"]);
  });

  it("sets lastError and rethrows when fullSync fails", async () => {
    mountSync();
    await flushAll();
    (fullSync as jest.Mock).mockRejectedValueOnce(new Error("network down"));

    await expect(ctx().sync()).rejects.toThrow("network down");
    await flushAll();

    expect(ctx().lastError).toBe("network down");
    expect(ctx().isSyncing).toBe(false);
  });
});

describe("ScheduledEntriesProvider auth guards", () => {
  it("throws 'Not authenticated' on every write without a user", async () => {
    mockUser = null;
    mountSync();
    await flushAll();
    (insertScheduled as jest.Mock).mockClear();
    (enqueue as jest.Mock).mockClear();

    await expect(ctx().addScheduled(sampleInput)).rejects.toThrow("Not authenticated");
    await expect(ctx().updateScheduled("t1", { description: "x" })).rejects.toThrow("Not authenticated");
    await expect(ctx().deleteScheduled("t1")).rejects.toThrow("Not authenticated");
    await expect(ctx().pauseScheduled("t1")).rejects.toThrow("Not authenticated");
    await expect(ctx().resumeScheduled("t1")).rejects.toThrow("Not authenticated");

    expect(insertScheduled).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("clears lastError via clearError", async () => {
    mountSync();
    await flushAll();
    (fullSync as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    await expect(ctx().sync()).rejects.toThrow("boom");
    await flushAll();
    expect(ctx().lastError).toBe("boom");

    act(() => ctx().clearError());
    expect(ctx().lastError).toBeNull();
  });
});
