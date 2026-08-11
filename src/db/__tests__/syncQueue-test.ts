// syncQueue-test.ts — unit tests for the offline sync queue module (phase 11,
// SYNC-*). Uses the in-memory expo-sqlite mock; verifies FIFO autoincrement
// order, uid scoping (CR-01 fix), and per-doc removal.
jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));

import { resetDbForTesting } from "../database";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import { enqueue, dequeue, getQueue, clearQueue, removeByDocId } from "../syncQueue";

beforeEach(() => {
  resetSqliteMock();
  resetDbForTesting();
  jest.useFakeTimers({ now: 1_752_000_000_000 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("enqueue", () => {
  it("returns sequential autoincrement ids (FIFO order)", async () => {
    expect(await enqueue("u1", "entries", "e1", "create")).toBe(1);
    expect(await enqueue("u1", "entries", "e2", "update")).toBe(2);
    expect(await enqueue("u1", "entries", "e3", "delete")).toBe(3);
  });

  it("stores uid, collection, docId, operation and the current timestamp", async () => {
    const id = await enqueue("u1", "categories", "cat1", "create");
    const [item] = await getQueue("u1");
    expect(item).toMatchObject({
      id,
      uid: "u1",
      collection: "categories",
      docId: "cat1",
      operation: "create",
    });
    expect(item.timestamp).toBe(Date.now());
  });
});

describe("getQueue", () => {
  it("returns queued ops in FIFO (id ASC) order", async () => {
    await enqueue("u1", "entries", "e1", "create");
    await enqueue("u1", "entries", "e2", "update");
    const queue = await getQueue("u1");
    expect(queue.map((q) => q.docId)).toEqual(["e1", "e2"]);
  });

  it("is uid-scoped — another account's ops are not visible (CR-01)", async () => {
    await enqueue("u1", "entries", "e1", "create");
    await enqueue("u2", "entries", "e2", "create");
    const queue = await getQueue("u1");
    expect(queue).toHaveLength(1);
    expect(queue[0].docId).toBe("e1");
  });
});

describe("dequeue", () => {
  it("removes only the matching (id, uid) row (CR-01)", async () => {
    const id1 = await enqueue("u1", "entries", "e1", "create");
    await enqueue("u2", "entries", "e2", "create");
    await dequeue("u1", id1);
    expect(await getQueue("u1")).toHaveLength(0);
    expect(await getQueue("u2")).toHaveLength(1);
  });

  it("does not remove a different uid's row with the same id", async () => {
    await enqueue("u1", "entries", "e1", "create");
    await enqueue("u2", "entries", "e2", "create");
    await dequeue("u2", 1);
    const u1 = await getQueue("u1");
    expect(u1).toHaveLength(1);
    expect(u1[0].docId).toBe("e1");
  });
});

describe("clearQueue", () => {
  it("clears only the given uid's pending ops (CR-01)", async () => {
    await enqueue("u1", "entries", "e1", "create");
    await enqueue("u1", "entries", "e2", "update");
    await enqueue("u2", "entries", "e3", "create");
    await clearQueue("u1");
    expect(await getQueue("u1")).toHaveLength(0);
    expect(await getQueue("u2")).toHaveLength(1);
  });
});

describe("removeByDocId", () => {
  it("drops queued ops for a doc by (collection, docId, uid)", async () => {
    await enqueue("u1", "entries", "e1", "create");
    await enqueue("u1", "entries", "e2", "create");
    await enqueue("u1", "categories", "e1", "create");
    await enqueue("u2", "entries", "e1", "create");
    await removeByDocId("u1", "entries", "e1");
    const queue = await getQueue("u1");
    expect(queue.map((q) => `${q.collection}:${q.docId}`)).toEqual([
      "entries:e2",
      "categories:e1",
    ]);
    expect((await getQueue("u2")).map((q) => q.docId)).toEqual(["e1"]);
  });

  it("is a no-op when nothing matches", async () => {
    await enqueue("u1", "entries", "e1", "create");
    await removeByDocId("u1", "entries", "nonexistent");
    expect(await getQueue("u1")).toHaveLength(1);
  });
});
