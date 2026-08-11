/**
 * Startup scheduler contract tests (phase 13, Task 6) — the auto-generation
 * engine is fire-and-forget: a failure at startup must never break app
 * startup (no unhandled rejection, no lastError surfaced, entries list
 * untouched), and the once-per-sign-in marker must hold even when the
 * scheduler rejects. The scheduler module itself is mocked so failures are
 * injectable; the rest of the provider stack is real (sqlite mock).
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

jest.mock("../../sync/syncService", () => ({
  fullSync: jest.fn(),
}));

const mockRunScheduler = jest.fn();
jest.mock("../scheduler", () => ({
  runScheduler: (...args: unknown[]) => mockRunScheduler(...args),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
// eslint-disable-next-line import/first
import {
  ScheduledEntriesProvider,
  useScheduledEntries,
} from "../ScheduledEntriesProvider";
import { EntriesProvider } from "../../entries/EntriesProvider";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import { resetFsMock } from "../../../jest/firestore-mock";
import { resetDbForTesting } from "../../db/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const captured = { latest: null as ReturnType<typeof useScheduledEntries> | null };

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

function mountSync() {
  let root: any;
  act(() => {
    root = renderer.create(
      <EntriesProvider>
        <ScheduledEntriesProvider>
          <Capture />
        </ScheduledEntriesProvider>
      </EntriesProvider>,
    );
  });
  return root;
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  act(() => {});
}

async function flushAll(times = 10) {
  for (let i = 0; i < times; i++) await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSqliteMock();
  resetFsMock();
  resetDbForTesting();
  mockUser = { uid: "user-1" };
  captured.latest = null;
  mockRunScheduler.mockResolvedValue(0);
});

describe("ScheduledEntriesProvider startup scheduler contract", () => {
  it("swallows a generation failure — no crash, no lastError, app state intact", async () => {
    mockRunScheduler.mockRejectedValueOnce(new Error("disk full"));

    mountSync();
    await flushAll();

    expect(mockRunScheduler).toHaveBeenCalledTimes(1);
    expect(mockRunScheduler).toHaveBeenCalledWith("user-1");
    expect(ctx().lastError).toBeNull();
    expect(ctx().isLoading).toBe(false);
    expect(ctx().scheduledEntries).toEqual([]);
  });

  it("runs the scheduler exactly once per sign-in", async () => {
    mountSync();
    await flushAll(15);

    // The entries-loading flag settles mid-flush; the once-per-sign-in
    // marker must suppress any re-fire of the effect.
    expect(mockRunScheduler).toHaveBeenCalledTimes(1);
  });
});
