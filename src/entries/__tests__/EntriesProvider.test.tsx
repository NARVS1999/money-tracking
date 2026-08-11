/**
 * EntriesProvider unit tests (phase 12 refactor) — the write contract moved
 * from Firestore addDoc to SQLite insertEntry + syncQueue enqueue. The
 * rules-critical field is still amountCents (schema/rules field name), now
 * enforced at the SQLite insert boundary; the sync service (covered by
 * syncService-test) pushes amountCents to Firestore.
 *
 * Mocks: in-memory sqlite mock (jest/sqlite-mock), in-memory Firestore mock
 * (jest/firestore-mock — the load effect's seed path), and wrapped
 * insertEntry/enqueue so call payloads are assertable while the real
 * implementations still run.
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
jest.mock("../../db/entries", () => {
  const actual = jest.requireActual("../../db/entries");
  return {
    ...actual,
    insertEntry: jest.fn(actual.insertEntry),
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
import { EntriesProvider, useEntries } from "../EntriesProvider";
import { insertEntry, getAllEntries } from "../../db/entries";
import { enqueue } from "../../db/syncQueue";
import { fullSync } from "../../sync/syncService";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import { resetFsMock } from "../../../jest/firestore-mock";
import { resetDbForTesting } from "../../db/database";
import type { DbEntryInput } from "../../db/entries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const captured = { latestEntries: null as ReturnType<typeof useEntries> | null };

function Capture() {
  // Test capture pattern: writing the context snapshot to a holder during
  // render is intentional in tests.
  // eslint-disable-next-line react-hooks/immutability
  captured.latestEntries = useEntries();
  return <Text>ok</Text>;
}

function entries(): NonNullable<typeof captured.latestEntries> {
  if (!captured.latestEntries) throw new Error("Entries context not captured");
  return captured.latestEntries;
}

// NOTE: async act() hangs in this jest-expo/React-19 environment when a
// mounted provider has an in-flight effect promise chain (documented in the
// original pre-refactor test). Mount with sync act and flush promise chains
// with macrotask + sync act cycles instead.
function mountSync() {
  let root: any;
  act(() => {
    root = renderer.create(
      <EntriesProvider>
        <Capture />
      </EntriesProvider>,
    );
  });
  return root;
}

// Flush one macrotask + pending React work. Multiple passes settle the load
// effect's seed -> read chain.
async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  act(() => {});
}

async function flushAll(times = 6) {
  for (let i = 0; i < times; i++) await flush();
}

const sampleInput = {
  type: "expense" as const,
  amount: 2450,
  categoryId: "cat-1",
  date: "2026-08-09",
  description: "Coffee",
};

const now = 1_752_000_000_000;

function dbRow(id: string, overrides: Partial<DbEntryInput> = {}): DbEntryInput {
  return {
    id,
    uid: "user-1",
    type: "expense",
    amountCents: 2450,
    categoryId: "cat-1",
    date: "2026-08-09",
    description: "Coffee",
    createdAt: now,
    updatedAt: now,
    synced: 1,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSqliteMock();
  resetFsMock();
  resetDbForTesting();
  mockUser = { uid: "user-1" };
  captured.latestEntries = null;
});

describe("EntriesProvider offline-first write contract", () => {
  it("writes amountCents (schema/rules field) — not amount — on addEntry, and queues a create", async () => {
    mountSync();
    await flushAll();

    const pending = entries().addEntry(sampleInput);
    await flushAll();
    await pending;

    // SQLite insert carries amountCents; the `amount` alias must not leak.
    expect(insertEntry).toHaveBeenCalledTimes(1);
    const payload = (insertEntry as jest.Mock).mock.calls[0][0];
    expect(payload.amountCents).toBe(2450);
    expect(payload.amount).toBeUndefined();
    expect(payload.uid).toBe("user-1");

    // Queued as a create on the entries collection with a temp id (SYNC-04).
    expect(enqueue).toHaveBeenCalledTimes(1);
    const [, collection, docId, operation] = (enqueue as jest.Mock).mock.calls[0];
    expect(collection).toBe("entries");
    expect(operation).toBe("create");
    expect(docId).toMatch(/^local-/);

    // Mirrored into state immediately (ENTR-05: visible without a sync).
    const entry = entries().entries.find((e) => e.id === docId);
    expect(entry).toBeDefined();
    expect(entry?.amount).toBe(2450);
  });

  it("writes amountCents — not amount — on copyEntry", async () => {
    // Seed a local row so the copy has a source.
    await insertEntry(dbRow("seed-id"));
    mountSync();
    await flushAll();

    (insertEntry as jest.Mock).mockClear();
    (enqueue as jest.Mock).mockClear();

    const pending = entries().copyEntry("seed-id");
    await flushAll();
    await pending;

    expect(insertEntry).toHaveBeenCalledTimes(1);
    const payload = (insertEntry as jest.Mock).mock.calls[0][0];
    expect(payload.amountCents).toBe(2450);
    expect(payload.amount).toBeUndefined();

    const [, collection, docId, operation] = (enqueue as jest.Mock).mock.calls[0];
    expect(collection).toBe("entries");
    expect(operation).toBe("create");
    expect(docId).toMatch(/^local-/);
    expect(docId).not.toBe("seed-id");
  });

  it("loads entries from SQLite on sign-in and mirrors updates/deletes", async () => {
    await insertEntry(dbRow("seed-id"));
    mountSync();
    await flushAll();

    expect(entries().entries.map((e) => e.id)).toEqual(["seed-id"]);

    const update = entries().updateEntry("seed-id", { description: "Renamed" });
    await flushAll();
    await update;
    expect(entries().entries[0].description).toBe("Renamed");
    expect((enqueue as jest.Mock).mock.calls[0][2]).toBe("seed-id");
    expect((enqueue as jest.Mock).mock.calls[0][3]).toBe("update");

    const del = entries().deleteEntry("seed-id");
    await flushAll();
    await del;
    expect(entries().entries).toHaveLength(0);
    const last = (enqueue as jest.Mock).mock.calls.at(-1);
    expect(last?.[2]).toBe("seed-id");
    expect(last?.[3]).toBe("delete");
  });
});

describe("EntriesProvider sync", () => {
  it("runs fullSync, reloads from SQLite, and flips isSyncing", async () => {
    await insertEntry(dbRow("seed-id"));
    mountSync();
    await flushAll();
    expect(entries().isSyncing).toBe(false);

    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    (fullSync as jest.Mock).mockReturnValueOnce(gate);

    let syncPromise: Promise<void>;
    act(() => { syncPromise = entries().sync(); });
    expect(entries().isSyncing).toBe(true);

    await act(async () => {
      release();
      await syncPromise;
    });

    expect(fullSync).toHaveBeenCalledTimes(1);
    expect(entries().isSyncing).toBe(false);
    // Reload from SQLite after the sync: the row is still there.
    expect(entries().entries.map((e) => e.id)).toEqual(["seed-id"]);
  });

  it("sets lastError and rethrows when fullSync fails", async () => {
    mountSync();
    await flushAll();
    (fullSync as jest.Mock).mockRejectedValueOnce(new Error("network down"));

    await expect(entries().sync()).rejects.toThrow("network down");
    await flushAll();

    expect(entries().lastError).toBe("network down");
    expect(entries().isSyncing).toBe(false);
  });

  it("is a no-op without a user", async () => {
    mockUser = null;
    mountSync();
    await flushAll();
    (fullSync as jest.Mock).mockClear();

    await entries().sync();
    expect(fullSync).not.toHaveBeenCalled();
  });
});

describe("EntriesProvider auth guards and write edges", () => {
  it("throws 'Not authenticated' on addEntry/updateEntry/deleteEntry/copyEntry without a user", async () => {
    mockUser = null;
    mountSync();
    await flushAll();
    (insertEntry as jest.Mock).mockClear();
    (enqueue as jest.Mock).mockClear();

    await expect(entries().addEntry(sampleInput)).rejects.toThrow("Not authenticated");
    await expect(entries().updateEntry("seed-id", { description: "x" })).rejects.toThrow("Not authenticated");
    await expect(entries().deleteEntry("seed-id")).rejects.toThrow("Not authenticated");
    await expect(entries().copyEntry("seed-id")).rejects.toThrow("Not authenticated");

    expect(insertEntry).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("no-ops updateEntry when no fields are provided", async () => {
    await insertEntry(dbRow("seed-id"));
    mountSync();
    await flushAll();
    (enqueue as jest.Mock).mockClear();

    await entries().updateEntry("seed-id", {});

    expect(enqueue).not.toHaveBeenCalled();
    expect(entries().entries[0].description).toBe("Coffee");
  });

  it("bumps updatedAt and forces synced = 0 on updateEntry", async () => {
    await insertEntry(dbRow("seed-id", { updatedAt: 1000, synced: 1 }));
    mountSync();
    await flushAll();

    await entries().updateEntry("seed-id", { description: "Renamed" });

    const rows = await getAllEntries("user-1");
    const row = rows.find((r) => r.id === "seed-id");
    expect(row?.updatedAt).toBeGreaterThan(1000);
    expect(row?.synced).toBe(0);
    expect(row?.description).toBe("Renamed");
  });

  it("throws 'Entry not found' on copyEntry of an unknown id", async () => {
    mountSync();
    await flushAll();

    await expect(entries().copyEntry("nope")).rejects.toThrow("Entry not found");
    expect(insertEntry).not.toHaveBeenCalled();
  });

  it("clears lastError via clearError", async () => {
    mountSync();
    await flushAll();
    (fullSync as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    await expect(entries().sync()).rejects.toThrow("boom");
    await flushAll();
    expect(entries().lastError).toBe("boom");

    act(() => entries().clearError());
    expect(entries().lastError).toBeNull();
  });
});
