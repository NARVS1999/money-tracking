// database-test.ts — unit tests for the lazy database connection singleton
// (phase 11, OFFL-01). Uses the in-memory expo-sqlite mock; asserts the
// lazy-init / caching / failure-reset contract of getDb().
jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));

import { getDb, resetDbForTesting } from "../database";
import { SCHEMA_SQL } from "../schema";
import {
  openDatabaseAsync,
  resetSqliteMock,
  failNextExecAsync,
} from "../../../jest/sqlite-mock";

const mockOpen = openDatabaseAsync as jest.Mock;

beforeEach(() => {
  resetSqliteMock();
  resetDbForTesting();
});

describe("getDb", () => {
  it("is lazy — importing the module does not open the database", () => {
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it("opens money-tracking.db and applies the schema on first call", async () => {
    const db = await getDb();
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen).toHaveBeenCalledWith("money-tracking.db");
    expect(db.execAsync).toHaveBeenCalledWith(SCHEMA_SQL);
  });

  it("caches the promise — a second call does not reopen", async () => {
    const first = await getDb();
    const second = await getDb();
    expect(second).toBe(first);
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("resets after an open failure so a later retry can succeed", async () => {
    mockOpen.mockRejectedValueOnce(new Error("disk full"));
    await expect(getDb()).rejects.toThrow("disk full");
    const db = await getDb();
    expect(db).toBeTruthy();
    expect(mockOpen).toHaveBeenCalledTimes(2);
  });

  it("resets when schema execution fails and retries with a fresh connection", async () => {
    failNextExecAsync(new Error("bad DDL"));
    await expect(getDb()).rejects.toThrow("bad DDL");
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const retry = await getDb();
    expect(retry).toBeTruthy();
    expect(retry.execAsync).toHaveBeenCalledWith(SCHEMA_SQL);
    expect(mockOpen).toHaveBeenCalledTimes(2);
  });
});

describe("resetDbForTesting", () => {
  it("drops the cached connection so the next getDb() reopens", async () => {
    const first = await getDb();
    resetDbForTesting();
    const second = await getDb();
    expect(second).not.toBe(first);
    expect(mockOpen).toHaveBeenCalledTimes(2);
  });
});
