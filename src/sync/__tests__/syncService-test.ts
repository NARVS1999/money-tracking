// syncService-test.ts — unit tests for the sync service (phase 12, SYNC-01..04).
// Runs pushChanges / pullChanges / fullSync against the in-memory sqlite mock
// (jest/sqlite-mock) and an in-memory Firestore mock (jest/firestore-mock).
// Covers: offline create push with temp-id remapping, create+delete
// supersession, update push, push failure preserving the queue (OFFL-10),
// pull last-write-wins merge (SYNC-02), remote-delete reconciliation
// (SYNC-03), and the fullSync watermark advance.
jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));
jest.mock("firebase/firestore", () => require("../../../jest/firestore-mock"));
jest.mock("../../firebase/app", () => ({ db: { mockDb: true } }));

import { resetDbForTesting } from "../../db/database";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import { resetFsMock, fsStore } from "../../../jest/firestore-mock";
import * as Fs from "firebase/firestore";
import {
  insertEntry,
  getAllEntries,
  deleteEntry,
  updateEntry,
  type DbEntryInput,
} from "../../db/entries";
import {
  insertCategory,
  getAllCategories,
  type DbCategoryInput,
} from "../../db/categories";
import { enqueue, getQueue } from "../../db/syncQueue";
import { pushChanges, pullChanges, fullSync } from "../syncService";
import { getLastSync } from "../syncMetadata";
import { generateTempId, isTempId } from "../idMapping";

const UID = "u1";
const now = 1_752_000_000_000;

function makeEntry(id: string, overrides: Partial<DbEntryInput> = {}): DbEntryInput {
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

function makeCategory(id: string, overrides: Partial<DbCategoryInput> = {}): DbCategoryInput {
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

function ts(ms: number): Fs.Timestamp {
  return new Fs.Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
}

function cloudEntry(id: string, updatedAt: number, overrides: Record<string, unknown> = {}) {
  return {
    uid: UID,
    type: "expense",
    amountCents: 2450,
    categoryId: "cat-1",
    date: "2026-08-15",
    description: "Coffee",
    createdAt: ts(now),
    updatedAt: ts(updatedAt),
    ...overrides,
  };
}

function seedCloudEntry(id: string, data: Record<string, unknown>): void {
  if (!fsStore["entries"]) fsStore["entries"] = new Map();
  fsStore["entries"].set(id, data);
}

beforeEach(() => {
  resetSqliteMock();
  resetFsMock();
  resetDbForTesting();
  jest.clearAllMocks();
});

describe("pushChanges — creates (SYNC-01, SYNC-04)", () => {
  it("pushes an offline create: addDoc with amountCents, remaps the temp id, marks synced, dequeues", async () => {
    const tempId = generateTempId();
    expect(isTempId(tempId)).toBe(true);
    await insertEntry(makeEntry(tempId));
    await enqueue(UID, "entries", tempId, "create");

    const pushed = await pushChanges(UID);

    expect(pushed).toBe(1);
    // Cloud payload uses the rules/schema field names — amountCents, not amount.
    expect(Fs.addDoc as jest.Mock).toHaveBeenCalledTimes(1);
    const [, payload] = (Fs.addDoc as jest.Mock).mock.calls[0];
    expect(payload.amountCents).toBe(2450);
    expect(payload.amount).toBeUndefined();
    expect(payload.uid).toBe(UID);

    // Local row now carries the Firestore id, marked synced (SYNC-04).
    const rows = await getAllEntries(UID);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toMatch(/^fs-/);
    expect(rows[0].id).not.toBe(tempId);
    expect(rows[0].synced).toBe(1);

    expect(await getQueue(UID)).toHaveLength(0);
  });

  it("pushes a category create to the kind collection and remaps the row", async () => {
    const tempId = generateTempId();
    await insertCategory(makeCategory(tempId, { name: "Transport" }));
    await enqueue(UID, "expenseCategories", tempId, "create");

    const pushed = await pushChanges(UID);

    expect(pushed).toBe(1);
    const [ref, payload] = (Fs.addDoc as jest.Mock).mock.calls[0];
    expect(ref._coll).toBe("expenseCategories");
    expect(payload.name).toBe("Transport");
    const rows = await getAllCategories(UID);
    expect(rows[0].id).toMatch(/^fs-/);
    expect(rows[0].synced).toBe(1);
    expect(await getQueue(UID)).toHaveLength(0);
  });

  it("drops a create whose row was deleted before the push ran", async () => {
    const tempId = generateTempId();
    await insertEntry(makeEntry(tempId));
    await enqueue(UID, "entries", tempId, "create");
    await deleteEntry(UID, tempId); // user deleted it offline before syncing

    const pushed = await pushChanges(UID);

    expect(pushed).toBe(0);
    expect(Fs.addDoc as jest.Mock).not.toHaveBeenCalled();
    expect(await getQueue(UID)).toHaveLength(0);
  });

  it("drains create then delete of the same temp doc to a net-zero cloud state", async () => {
    const tempId = generateTempId();
    await insertEntry(makeEntry(tempId));
    await enqueue(UID, "entries", tempId, "create");
    await deleteEntry(UID, tempId);
    await enqueue(UID, "entries", tempId, "delete");

    const pushed = await pushChanges(UID);

    // The row is already gone, so the create is superseded (dropped); the
    // delete pushes a no-op deleteDoc on a doc that never existed. Net-zero
    // cloud state, fully drained queue.
    expect(pushed).toBe(1);
    expect(Fs.addDoc as jest.Mock).not.toHaveBeenCalled();
    expect((Fs.deleteDoc as jest.Mock).mock.calls[0][0].id).toBe(tempId);
    expect(fsStore["entries"]?.size ?? 0).toBe(0);
    expect(await getAllEntries(UID)).toHaveLength(0);
    expect(await getQueue(UID)).toHaveLength(0);
  });
});

describe("pushChanges — updates and deletes", () => {
  it("pushes an update as a full-doc setDoc with the current row state", async () => {
    await insertEntry(makeEntry("real-1"));
    await enqueue(UID, "entries", "real-1", "update");

    const pushed = await pushChanges(UID);

    expect(pushed).toBe(1);
    expect(Fs.setDoc as jest.Mock).toHaveBeenCalledTimes(1);
    const [ref, payload] = (Fs.setDoc as jest.Mock).mock.calls[0];
    expect(ref.id).toBe("real-1");
    expect(payload.amountCents).toBe(2450);
    expect(payload.updatedAt).toBeInstanceOf(Fs.Timestamp);
    expect((await getAllEntries(UID))[0].synced).toBe(1);
    expect(await getQueue(UID)).toHaveLength(0);
  });

  it("skips an update whose row was deleted locally before push", async () => {
    await insertEntry(makeEntry("real-1"));
    await enqueue(UID, "entries", "real-1", "update");
    await deleteEntry(UID, "real-1");

    const pushed = await pushChanges(UID);

    expect(pushed).toBe(0);
    expect(Fs.setDoc as jest.Mock).not.toHaveBeenCalled();
    expect(await getQueue(UID)).toHaveLength(0);
  });

  it("drops a stale offline update instead of overwriting a newer cloud edit (WR-01)", async () => {
    // Cloud copy was edited at `now`; the offline edit is older (stale).
    await insertEntry(makeEntry("e1", { updatedAt: now - 5000 }));
    await enqueue(UID, "entries", "e1", "update");
    seedCloudEntry("e1", cloudEntry("e1", now, { description: "Newer cloud edit" }));

    await fullSync(UID);

    // Nothing pushed — the cloud copy is newer.
    expect(Fs.setDoc as jest.Mock).not.toHaveBeenCalled();
    // Pull converges the local row to the cloud copy; queue drained.
    const [row] = await getAllEntries(UID);
    expect(row.description).toBe("Newer cloud edit");
    expect(row.updatedAt).toBe(now);
    expect(await getQueue(UID)).toHaveLength(0);
  });

  it("pushes a local update when the local edit is at least as new as the cloud copy (WR-01)", async () => {
    await insertEntry(makeEntry("e1", { updatedAt: now }));
    await enqueue(UID, "entries", "e1", "update");
    seedCloudEntry("e1", cloudEntry("e1", now - 5000, { description: "Stale cloud" }));

    const pushed = await pushChanges(UID);

    expect(pushed).toBe(1);
    expect(Fs.setDoc as jest.Mock).toHaveBeenCalledTimes(1);
    const [, payload] = (Fs.setDoc as jest.Mock).mock.calls[0];
    expect(payload.description).toBe("Coffee");
    expect(await getQueue(UID)).toHaveLength(0);
  });

  it("pushes a delete for a real id", async () => {
    await insertEntry(makeEntry("real-1"));
    await enqueue(UID, "entries", "real-1", "delete");

    const pushed = await pushChanges(UID);

    expect(pushed).toBe(1);
    expect(Fs.deleteDoc as jest.Mock).toHaveBeenCalledTimes(1);
    expect((Fs.deleteDoc as jest.Mock).mock.calls[0][0].id).toBe("real-1");
    expect(await getQueue(UID)).toHaveLength(0);
  });
});

describe("pushChanges — failure safety (OFFL-10)", () => {
  it("keeps the failing item and everything after it queued on error", async () => {
    const temp1 = generateTempId();
    const temp2 = generateTempId();
    await insertEntry(makeEntry(temp1, { amountCents: 100 }));
    await insertEntry(makeEntry(temp2, { amountCents: 200 }));
    await enqueue(UID, "entries", temp1, "create");
    await enqueue(UID, "entries", temp2, "create");

    (Fs.addDoc as jest.Mock).mockRejectedValueOnce(new Error("network down"));

    await pushChanges(UID);

    // First item failed; second must still be queued for the next sync.
    const queue = await getQueue(UID);
    expect(queue).toHaveLength(2);
    expect(queue[0].docId).toBe(temp1);
    expect(queue[1].docId).toBe(temp2);
  });
});

describe("pullChanges — last-write-wins merge (SYNC-02)", () => {
  it("merges a remote doc newer than the local row (cloud wins)", async () => {
    // Local copy is older than the remote edit.
    await insertEntry(makeEntry("e1", { updatedAt: now - 5000, synced: 1 }));
    seedCloudEntry("e1", cloudEntry("e1", now, { description: "Renamed" }));

    await pullChanges(UID, now - 10_000);

    const [row] = await getAllEntries(UID);
    expect(row.description).toBe("Renamed");
    expect(row.updatedAt).toBe(now);
    expect(row.synced).toBe(1);
  });

  it("keeps a local row newer than the remote copy (local wins)", async () => {
    await insertEntry(makeEntry("e1", { updatedAt: now, synced: 0 }));
    seedCloudEntry("e1", cloudEntry("e1", now - 5000, { description: "Stale" }));

    await pullChanges(UID, now - 10_000);

    const [row] = await getAllEntries(UID);
    expect(row.description).toBe("Coffee");
  });

  it("inserts a remote doc that has no local row", async () => {
    seedCloudEntry("e-remote", cloudEntry("e-remote", now));

    await pullChanges(UID, now - 10_000);

    const rows = await getAllEntries(UID);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("e-remote");
    expect(rows[0].synced).toBe(1);
  });

  it("ignores remote docs older than the pull watermark", async () => {
    seedCloudEntry("e-old", cloudEntry("e-old", now - 50_000));

    await pullChanges(UID, now - 10_000);

    expect(await getAllEntries(UID)).toHaveLength(0);
  });
});

describe("pullChanges — remote-delete reconciliation (SYNC-03)", () => {
  it("deletes a clean local row that is absent from the cloud", async () => {
    await insertEntry(makeEntry("gone", { synced: 1 }));

    await pullChanges(UID, now - 10_000);

    expect(await getAllEntries(UID)).toHaveLength(0);
  });

  it("keeps a local row still pending push (synced = 0) even if absent from the cloud", async () => {
    await insertEntry(makeEntry("pending", { synced: 0 }));

    await pullChanges(UID, now - 10_000);

    const rows = await getAllEntries(UID);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("pending");
  });

  it("does not resurrect a cloud doc targeted by a queued offline delete (WR-02)", async () => {
    // User deleted the entry offline (row gone, delete op queued) while the
    // cloud copy was edited on another device (newer updatedAt). The pull
    // must skip the doc and keep the delete op for the next push.
    await insertEntry(makeEntry("e1", { synced: 1 }));
    await enqueue(UID, "entries", "e1", "delete");
    await deleteEntry(UID, "e1");
    seedCloudEntry("e1", cloudEntry("e1", now, { description: "edited elsewhere" }));

    await pullChanges(UID, now - 10_000);

    expect(await getAllEntries(UID)).toHaveLength(0);
    const queue = await getQueue(UID);
    expect(queue).toHaveLength(1);
    expect(queue[0].operation).toBe("delete");
    expect(queue[0].docId).toBe("e1");
  });
});

describe("pullChanges — categories", () => {
  it("merges remote category edits and reconciles deletions for both kinds", async () => {
    await insertCategory(makeCategory("keep", { synced: 1 }));
    if (!fsStore["expenseCategories"]) fsStore["expenseCategories"] = new Map();
    fsStore["expenseCategories"].set("keep", {
      uid: UID,
      type: "expense",
      name: "Food",
      icon: "",
      createdAt: ts(now),
      updatedAt: ts(now),
    });

    await pullChanges(UID, now - 10_000);

    const rows = await getAllCategories(UID);
    expect(rows.map((r) => r.id)).toEqual(["keep"]);
    expect(rows[0].synced).toBe(1);
  });

  it("removes a locally-deleted cloud category is NOT re-created (absent = remote delete)", async () => {
    // Local row synced=1, no cloud doc → remote deleted → removed locally.
    await insertCategory(makeCategory("ghost", { synced: 1 }));

    await pullChanges(UID, now - 10_000);

    expect(await getAllCategories(UID)).toHaveLength(0);
  });
});

describe("fullSync", () => {
  it("pushes, pulls, and advances the lastSync watermark", async () => {
    // One pending local create + one remote doc to merge.
    const tempId = generateTempId();
    await insertEntry(makeEntry(tempId, { amountCents: 500 }));
    await enqueue(UID, "entries", tempId, "create");
    seedCloudEntry("remote-1", cloudEntry("remote-1", now));

    await fullSync(UID);

    // Push happened: local temp remapped.
    const rows = await getAllEntries(UID);
    const local = rows.find((r) => r.id !== "remote-1");
    expect(local?.id).toMatch(/^fs-/);
    // Pull happened: remote doc merged.
    expect(rows.some((r) => r.id === "remote-1")).toBe(true);
    // Watermark advanced.
    const lastSync = await getLastSync(UID);
    expect(lastSync).not.toBeNull();
    expect(lastSync as number).toBeGreaterThan(now);
    // Queue fully drained.
    expect(await getQueue(UID)).toHaveLength(0);
  });

  it("coalesces concurrent same-uid calls into one run", async () => {
    const tempId = generateTempId();
    await insertEntry(makeEntry(tempId));
    await enqueue(UID, "entries", tempId, "create");

    await Promise.all([fullSync(UID), fullSync(UID), fullSync(UID)]);

    expect(Fs.addDoc as jest.Mock).toHaveBeenCalledTimes(1);
    expect(await getQueue(UID)).toHaveLength(0);
  });
});
