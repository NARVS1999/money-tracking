// syncMetadata-test.ts — unit tests for the per-uid sync watermark (plan
// Task 5). getLastSync returns null for an unknown uid; setLastSync inserts
// the first watermark and upserts on the second (the ON CONFLICT(uid) DO
// UPDATE path — the most frequently executed sync statement); watermarks are
// strictly uid-scoped so one account can never read another's pull position.
jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));

import { resetDbForTesting } from "../../db/database";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import { getLastSync, setLastSync } from "../syncMetadata";

beforeEach(() => {
  resetSqliteMock();
  resetDbForTesting();
});

describe("syncMetadata watermark", () => {
  it("returns null when no sync has ever run for the uid", async () => {
    expect(await getLastSync("u1")).toBeNull();
  });

  it("returns the stored watermark after setLastSync", async () => {
    await setLastSync("u1", 123_456);
    expect(await getLastSync("u1")).toBe(123_456);
  });

  it("upserts on the second write for the same uid instead of throwing a PK conflict", async () => {
    await setLastSync("u1", 100);
    await setLastSync("u1", 200);
    expect(await getLastSync("u1")).toBe(200);
  });

  it("keeps watermarks independent per uid", async () => {
    await setLastSync("u1", 100);
    await setLastSync("u2", 999);
    expect(await getLastSync("u1")).toBe(100);
    expect(await getLastSync("u2")).toBe(999);
    // Updating one uid never leaks into another.
    await setLastSync("u1", 150);
    expect(await getLastSync("u2")).toBe(999);
  });
});
