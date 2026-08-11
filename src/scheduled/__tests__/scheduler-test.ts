// scheduler-test.ts — unit tests for the recurring auto-generation engine
// (phase 13, SCHD-02/03/04). Uses the in-memory expo-sqlite mock: templates
// live in scheduledEntries, generated entries land in entries, and the sync
// queue records one create per generated entry. The engine imports no
// firebase modules, so no firestore mock is needed.
jest.mock("expo-sqlite", () => require("../../../jest/sqlite-mock"));

// Wrap the real syncQueue so a test can inject a mid-run failure and assert
// the transaction rolls everything back (WR-01).
jest.mock("../../db/syncQueue", () => {
  const actual = jest.requireActual("../../db/syncQueue");
  return {
    ...actual,
    enqueue: jest.fn(actual.enqueue),
  };
});

import { resetDbForTesting } from "../../db/database";
import { resetSqliteMock } from "../../../jest/sqlite-mock";
import {
  getAllEntries,
  type DbEntryInput,
} from "../../db/entries";
import {
  insertScheduled,
  getAllScheduled,
  type DbScheduledInput,
} from "../../db/scheduled";
import { enqueue, getQueue } from "../../db/syncQueue";
import {
  getDatesToGenerate,
  generateEntry,
  runScheduler,
} from "../scheduler";

const now = 1_752_000_000_000;

const makeScheduled = (
  overrides: Partial<DbScheduledInput> = {},
): DbScheduledInput =>
  ({
    id: "s1",
    uid: "u1",
    type: "expense",
    amountCents: 100_00,
    categoryId: "cat1",
    date: "2026-08-11", // yesterday relative to the fixed "today" below
    description: "Daily coffee",
    frequency: "daily",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }) as DbScheduledInput;

beforeEach(() => {
  resetSqliteMock();
  resetDbForTesting();
  // Restore the real implementation between tests (a WR-01 test injects a
  // mid-run failure into the queue op).
  (enqueue as jest.Mock).mockImplementation(
    jest.requireActual("../../db/syncQueue").enqueue,
  );
});

describe("getDatesToGenerate", () => {
  it("once generates exactly the start date when never generated", () => {
    const t = makeScheduled({ frequency: "once", date: "2026-08-01" });
    expect(getDatesToGenerate(t, "2026-08-12")).toEqual(["2026-08-01"]);
  });

  it("once generates nothing once lastGenerated is set", () => {
    const t = makeScheduled({
      frequency: "once",
      date: "2026-08-01",
      lastGenerated: "2026-08-01",
    });
    expect(getDatesToGenerate(t, "2026-08-12")).toEqual([]);
  });

  it("daily generates every day from the start date through today (catch-up)", () => {
    const t = makeScheduled({ frequency: "daily", date: "2026-08-11" });
    expect(getDatesToGenerate(t, "2026-08-12")).toEqual([
      "2026-08-11",
      "2026-08-12",
    ]);
  });

  it("daily resumes the day after lastGenerated", () => {
    const t = makeScheduled({
      frequency: "daily",
      date: "2026-08-01",
      lastGenerated: "2026-08-11",
    });
    expect(getDatesToGenerate(t, "2026-08-12")).toEqual(["2026-08-12"]);
  });

  it("weekly generates every 7 days from the start date", () => {
    const t = makeScheduled({ frequency: "weekly", date: "2026-08-01" });
    expect(getDatesToGenerate(t, "2026-08-22")).toEqual([
      "2026-08-01",
      "2026-08-08",
      "2026-08-15",
      "2026-08-22",
    ]);
  });

  it("monthly generates the anchor day-of-month from start through today", () => {
    // Start May 12, today Aug 12: May/Jun/Jul/Aug 12 (today's boundary is an
    // occurrence — same inclusive rule as daily).
    const t = makeScheduled({ frequency: "monthly", date: "2026-05-12" });
    expect(getDatesToGenerate(t, "2026-08-12")).toEqual([
      "2026-05-12",
      "2026-06-12",
      "2026-07-12",
      "2026-08-12",
    ]);
  });

  it("yearly generates the anchor month/day", () => {
    const t = makeScheduled({ frequency: "yearly", date: "2024-02-29" });
    expect(getDatesToGenerate(t, "2028-02-29")).toEqual([
      "2024-02-29",
      "2028-02-29", // leap years only (day-equality rule)
    ]);
  });

  it("stops at endDate", () => {
    const t = makeScheduled({
      frequency: "daily",
      date: "2026-08-01",
      endDate: "2026-08-05",
    });
    expect(getDatesToGenerate(t, "2026-08-12")).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
  });

  it("returns nothing when the start date is after today", () => {
    const t = makeScheduled({ frequency: "daily", date: "2026-09-01" });
    expect(getDatesToGenerate(t, "2026-08-12")).toEqual([]);
  });

  it("returns nothing for an unknown frequency value", () => {
    const t = makeScheduled({ frequency: "fortnightly" });
    expect(getDatesToGenerate(t, "2026-08-12")).toEqual([]);
  });
});

describe("generateEntry", () => {
  it("maps a template + date to an entry input (cents, verbatim description)", () => {
    const t = makeScheduled({
      type: "income",
      amountCents: 500_000,
      categoryId: "sal",
      description: "Salary",
    });
    expect(generateEntry(t, "2026-08-12")).toEqual({
      type: "income",
      amount: 500_000,
      categoryId: "sal",
      date: "2026-08-12",
      description: "Salary",
    });
  });
});

describe("runScheduler", () => {
  it("generates daily catch-up entries, queues creates, and advances lastGenerated", async () => {
    await insertScheduled(makeScheduled({ frequency: "daily" })); // start 08-11
    const generated = await runScheduler("u1");

    expect(generated).toBe(2); // yesterday + today
    const entries = await getAllEntries("u1");
    expect(entries.map((e) => e.date).sort()).toEqual([
      "2026-08-11",
      "2026-08-12",
    ]);
    // Payload mirrors the template (cents, description, category).
    expect(entries[0].amountCents).toBe(100_00);
    expect(entries[0].categoryId).toBe("cat1");
    expect(entries[0].description).toBe("Daily coffee");
    expect(entries[0].synced).toBe(0); // pending push

    // One queued create per generated entry (temp ids, SYNC-04 path) plus
    // the queued template update that carries lastGenerated to Firestore
    // (CR-01 — the cloud copy must converge or a fresh pull would
    // regenerate the whole history as duplicates).
    const queue = await getQueue("u1");
    expect(queue).toHaveLength(3);
    const creates = queue.filter(
      (q) => q.collection === "entries" && q.operation === "create",
    );
    expect(creates).toHaveLength(2);
    expect(creates.every((q) => q.docId.startsWith("local-"))).toBe(true);

    // lastGenerated advanced (and updatedAt bumped so the cloud copy loses
    // LWW to this advancement) — a second run generates nothing.
    const [template] = await getAllScheduled("u1");
    expect(template.lastGenerated).toBe("2026-08-12");
    expect(template.updatedAt).toBeGreaterThan(now);
    const templateUpdate = queue.find(
      (q) => q.collection === "scheduledEntries",
    );
    expect(templateUpdate).toBeDefined();
    expect(templateUpdate?.uid).toBe("u1");
    expect(templateUpdate?.docId).toBe("s1");
    expect(templateUpdate?.operation).toBe("update");
    expect(await runScheduler("u1")).toBe(0);
  });

  it("skips inactive templates and other uids", async () => {
    await insertScheduled(makeScheduled({ isActive: 0 }));
    await insertScheduled(makeScheduled({ id: "u2s", uid: "u2" }));
    expect(await runScheduler("u1")).toBe(0);
    expect(await getAllEntries("u1")).toHaveLength(0);
    expect(await getAllEntries("u2")).toHaveLength(0);
  });

  it("generates nothing when no dates are due", async () => {
    await insertScheduled(makeScheduled({ frequency: "once", lastGenerated: "2026-08-11" }));
    expect(await runScheduler("u1")).toBe(0);
    expect(await getAllEntries("u1")).toHaveLength(0);
  });

  it("generates one entry per month for a monthly template started months ago", async () => {
    await insertScheduled(makeScheduled({ frequency: "monthly", date: "2026-05-12" }));
    const generated = await runScheduler("u1");
    expect(generated).toBe(4); // May 12, Jun 12, Jul 12, Aug 12
    // getAllEntries orders by date DESC.
    const dates = (await getAllEntries("u1")).map((e) => e.date);
    expect(dates).toEqual(["2026-08-12", "2026-07-12", "2026-06-12", "2026-05-12"]);
  });

  it("is uid-scoped end to end (writes land on the caller's uid)", async () => {
    await insertScheduled(makeScheduled({ id: "u2s", uid: "u2" }));
    const generated = await runScheduler("u2");
    expect(generated).toBe(2);
    const rows = await getAllEntries("u2");
    expect(rows).toHaveLength(2);
    expect(rows.every((r: DbEntryInput) => r.uid === "u2")).toBe(true);
    expect(await getAllEntries("u1")).toHaveLength(0);
  });

  it("rolls a template's generation back atomically when a write fails mid-run (WR-01)", async () => {
    // A kill/failure between the first insert and the lastGenerated advance
    // must not leave a half-generated template: nothing persists, the anchor
    // stays put, and the restart regenerates cleanly (no duplicates).
    await insertScheduled(makeScheduled({ frequency: "daily" })); // 2 dates due
    const realEnqueue = jest.requireActual<typeof import("../../db/syncQueue")>(
      "../../db/syncQueue",
    ).enqueue;
    let calls = 0;
    (enqueue as jest.Mock).mockImplementation(
      async (...args: Parameters<typeof enqueue>) => {
        calls += 1;
        if (calls === 2) throw new Error("disk full"); // mid-generation
        return realEnqueue(...args);
      },
    );

    await expect(runScheduler("u1")).rejects.toThrow("disk full");

    // The whole template's generation rolled back: no entries, no queue ops,
    // anchor un-advanced.
    expect(await getAllEntries("u1")).toHaveLength(0);
    expect(await getQueue("u1")).toHaveLength(0);
    const [template] = await getAllScheduled("u1");
    expect(template.lastGenerated).toBeNull();
    expect(template.updatedAt).toBe(now);
  });
});
