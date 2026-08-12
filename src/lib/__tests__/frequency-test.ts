// frequency-test.ts — unit tests for the recurring-frequency matching
// utilities (phase 13, SCHD-01). Verifies occurrence anchoring for every
// frequency, next-occurrence math (including month-end and leap-year edge
// cases), and the human-readable labels.
import {
  matchesFrequency,
  getNextDate,
  formatFrequency,
  isFrequency,
  FREQUENCIES,
  getNextOccurrence,
  getUpcomingOccurrence,
  formatNextDate,
} from "../frequency";

describe("matchesFrequency", () => {
  it("once matches only the start date itself", () => {
    expect(matchesFrequency("2026-08-12", "once", "2026-08-12")).toBe(true);
    expect(matchesFrequency("2026-08-13", "once", "2026-08-12")).toBe(false);
    expect(matchesFrequency("2026-08-11", "once", "2026-08-12")).toBe(false);
  });

  it("daily matches every date", () => {
    expect(matchesFrequency("2026-08-12", "daily", "2026-08-11")).toBe(true);
    expect(matchesFrequency("2030-01-01", "daily", "2026-08-11")).toBe(true);
  });

  it("weekly matches multiples of 7 days from the anchor", () => {
    const start = "2026-08-12";
    expect(matchesFrequency("2026-08-12", "weekly", start)).toBe(true); // +0
    expect(matchesFrequency("2026-08-19", "weekly", start)).toBe(true); // +7
    expect(matchesFrequency("2026-08-26", "weekly", start)).toBe(true); // +14
    expect(matchesFrequency("2026-08-13", "weekly", start)).toBe(false); // +1
    expect(matchesFrequency("2026-08-20", "weekly", start)).toBe(false); // +8
    // Backward multiples also anchor (engine only iterates forward).
    expect(matchesFrequency("2026-08-05", "weekly", start)).toBe(true); // -7
  });

  it("monthly matches the start date's day-of-month", () => {
    const start = "2026-08-12";
    expect(matchesFrequency("2026-08-12", "monthly", start)).toBe(true);
    expect(matchesFrequency("2026-09-12", "monthly", start)).toBe(true);
    expect(matchesFrequency("2027-08-12", "monthly", start)).toBe(true);
    expect(matchesFrequency("2026-09-11", "monthly", start)).toBe(false);
  });

  it("monthly on the 31st skips months without a 31st (day-equality)", () => {
    const start = "2026-01-31";
    expect(matchesFrequency("2026-02-28", "monthly", start)).toBe(false);
    expect(matchesFrequency("2026-03-31", "monthly", start)).toBe(true);
  });

  it("yearly matches the start date's month and day", () => {
    const start = "2026-08-12";
    expect(matchesFrequency("2026-08-12", "yearly", start)).toBe(true);
    expect(matchesFrequency("2027-08-12", "yearly", start)).toBe(true);
    expect(matchesFrequency("2027-08-13", "yearly", start)).toBe(false);
    expect(matchesFrequency("2027-09-12", "yearly", start)).toBe(false);
  });

  it("yearly on Feb 29 only matches leap years", () => {
    const start = "2024-02-29";
    expect(matchesFrequency("2028-02-29", "yearly", start)).toBe(true);
    expect(matchesFrequency("2025-02-28", "yearly", start)).toBe(false);
  });

  it("never matches for an unknown frequency value", () => {
    expect(matchesFrequency("2026-08-12", "fortnightly" as never, "2026-08-12")).toBe(false);
  });

  it("monthly from Feb 29 matches any month's 29th (day-equality only, month ignored)", () => {
    const start = "2024-02-29";
    expect(matchesFrequency("2024-03-29", "monthly", start)).toBe(true);
    expect(matchesFrequency("2026-03-29", "monthly", start)).toBe(true);
    expect(matchesFrequency("2026-02-28", "monthly", start)).toBe(false);
  });

  it("weekly anchors across a year boundary", () => {
    const start = "2026-12-29";
    expect(matchesFrequency("2027-01-05", "weekly", start)).toBe(true); // +7
    expect(matchesFrequency("2027-01-04", "weekly", start)).toBe(false); // +6
  });
});

describe("getNextDate", () => {
  it("once has no next occurrence", () => {
    expect(getNextDate("2026-08-12", "once")).toBeNull();
  });

  it("daily advances one day", () => {
    expect(getNextDate("2026-08-12", "daily")).toBe("2026-08-13");
    expect(getNextDate("2026-12-31", "daily")).toBe("2027-01-01");
  });

  it("weekly advances seven days", () => {
    expect(getNextDate("2026-08-12", "weekly")).toBe("2026-08-19");
  });

  it("monthly lands on the same day-of-month next month", () => {
    expect(getNextDate("2026-08-12", "monthly")).toBe("2026-09-12");
    expect(getNextDate("2026-12-12", "monthly")).toBe("2027-01-12");
  });

  it("monthly from a clamped day skips months lacking that day", () => {
    // Jan 31: Feb has no 31st -> next occurrence is Mar 31 (engine-consistent
    // day-equality, not month-step clamping).
    expect(getNextDate("2026-01-31", "monthly")).toBe("2026-03-31");
  });

  it("yearly lands on the same month/day next year", () => {
    expect(getNextDate("2026-08-12", "yearly")).toBe("2027-08-12");
  });

  it("yearly from Feb 29 waits for the next leap year", () => {
    expect(getNextDate("2024-02-29", "yearly")).toBe("2028-02-29");
  });

  it("returns null for an unknown frequency value", () => {
    expect(getNextDate("2026-08-12", "fortnightly" as never)).toBeNull();
  });

  it("monthly from Jan 29 lands on Feb 29 in a leap year", () => {
    expect(getNextDate("2024-01-29", "monthly")).toBe("2024-02-29");
  });

  it("monthly from Jan 29 skips a non-leap February (day-equality)", () => {
    expect(getNextDate("2026-01-29", "monthly")).toBe("2026-03-29");
  });

  it("monthly from Feb 29 (leap) advances to the next month's 29th", () => {
    expect(getNextDate("2024-02-29", "monthly")).toBe("2024-03-29");
  });

  it("weekly advances across a year boundary", () => {
    expect(getNextDate("2026-12-29", "weekly")).toBe("2027-01-05");
  });
});

describe("formatFrequency / isFrequency", () => {
  it("maps every frequency to its human-readable label", () => {
    expect(FREQUENCIES.map((f) => formatFrequency(f))).toEqual([
      "Once",
      "Daily",
      "Weekly",
      "Monthly",
      "Yearly",
    ]);
  });

  it("passes through unknown frequency strings", () => {
    expect(formatFrequency("fortnightly")).toBe("fortnightly");
  });

  it("isFrequency recognizes exactly the five frequencies", () => {
    expect(["once", "daily", "weekly", "monthly", "yearly"].every(isFrequency)).toBe(true);
    expect(isFrequency("fortnightly")).toBe(false);
    expect(isFrequency("")).toBe(false);
  });
});

describe("getNextOccurrence", () => {
  it("anchors at lastGenerated when it is set", () => {
    expect(getNextOccurrence("2026-08-01", "daily", "2026-08-10", null)).toBe("2026-08-11");
    expect(getNextOccurrence("2026-08-01", "weekly", "2026-08-05", null)).toBe("2026-08-12");
  });

  it("falls back to the start date when never generated", () => {
    expect(getNextOccurrence("2026-08-12", "daily", null, null)).toBe("2026-08-13");
    expect(getNextOccurrence("2026-08-12", "monthly", null, null)).toBe("2026-09-12");
  });

  it("once never has a next occurrence", () => {
    expect(getNextOccurrence("2026-08-12", "once", null, null)).toBeNull();
    expect(getNextOccurrence("2026-08-12", "once", "2026-08-12", null)).toBeNull();
  });

  it("returns null when the next occurrence lands after endDate (WR-01)", () => {
    // Monthly from Jan 31 with lastGenerated Jan 31: the next match is Mar 31
    // (Feb has no 31st) — beyond the Mar 15 end, so the engine will never
    // generate it; the UI must not promise it.
    expect(
      getNextOccurrence("2026-01-31", "monthly", "2026-01-31", "2026-03-15"),
    ).toBeNull();
    // The same template with the end ON the occurrence keeps it.
    expect(
      getNextOccurrence("2026-01-31", "monthly", "2026-01-31", "2026-03-31"),
    ).toBe("2026-03-31");
  });

  it("caps the first occurrence too when never generated (WR-01)", () => {
    // Daily starting 2026-08-12, end the same day: the next day is beyond.
    expect(getNextOccurrence("2026-08-12", "daily", null, "2026-08-12")).toBeNull();
    expect(getNextOccurrence("2026-08-12", "daily", null, "2026-08-13")).toBe("2026-08-13");
  });
});

describe("getUpcomingOccurrence", () => {
  it("passes through a next occurrence that is not in the past", () => {
    // Weekly from Aug 12 with lastGenerated Aug 12 → next Aug 19 (future).
    expect(
      getUpcomingOccurrence("2026-08-12", "weekly", "2026-08-12", null, "2026-08-12"),
    ).toBe("2026-08-19");
    // A future start date (never generated) passes through unchanged.
    expect(
      getUpcomingOccurrence("2026-09-01", "weekly", null, null, "2026-08-12"),
    ).toBe("2026-09-08");
  });

  it("clamps a stale daily next to today (WR-01)", () => {
    // lastGenerated Aug 10 → engine next Aug 11, already past → today.
    expect(
      getUpcomingOccurrence("2026-08-01", "daily", "2026-08-10", null, "2026-08-12"),
    ).toBe("2026-08-12");
  });

  it("clamps a never-generated daily template whose start date is in the past to today (WR-01)", () => {
    // No lastGenerated: the engine next (start + 1 = Aug 2) is long past —
    // the display scan still finds the first real occurrence at/after today.
    expect(
      getUpcomingOccurrence("2026-08-01", "daily", null, null, "2026-08-12"),
    ).toBe("2026-08-12");
  });

  it("clamps a stale weekly next forward to the next future occurrence (WR-01)", () => {
    // Weekly anchored Mon 2026-08-03, lastGenerated Mon 2026-08-03, today
    // Wed 2026-08-12 → engine next (Mon Aug 10) is past → next Monday Aug 17.
    expect(
      getUpcomingOccurrence("2026-08-03", "weekly", "2026-08-03", null, "2026-08-12"),
    ).toBe("2026-08-17");
  });

  it("keeps the pattern's anchor day when clamping a stale monthly next (WR-01)", () => {
    // Monthly anchored on the 31st (Jan 31), lastGenerated Jan 31, session
    // spanning to Aug 12: the engine's next (Mar 31) is past, but the next
    // real occurrence is Aug 31 — NOT Sep 12 (a re-anchor at today would
    // break the day-of-month).
    expect(
      getUpcomingOccurrence("2026-01-31", "monthly", "2026-01-31", null, "2026-08-12"),
    ).toBe("2026-08-31");
  });

  it("clamps a stale yearly next to the next pattern year (WR-01)", () => {
    // Yearly on Aug 5, lastGenerated 2025-08-05, today 2026-08-12 → engine
    // next (2026-08-05) is past → 2027-08-05.
    expect(
      getUpcomingOccurrence("2025-08-05", "yearly", "2025-08-05", null, "2026-08-12"),
    ).toBe("2027-08-05");
  });

  it("keeps the clamped occurrence when it still lands within endDate (WR-01)", () => {
    expect(
      getUpcomingOccurrence("2026-08-01", "daily", "2026-08-10", "2026-08-12", "2026-08-12"),
    ).toBe("2026-08-12");
  });

  it("returns null when the clamped scan runs past endDate (WR-01)", () => {
    // Daily ending Aug 11: the stale engine next (Aug 11) is past and the
    // clamped scan from Aug 12 is beyond the end — finished.
    expect(
      getUpcomingOccurrence("2026-08-01", "daily", "2026-08-10", "2026-08-11", "2026-08-12"),
    ).toBeNull();
  });

  it("once never has a next occurrence", () => {
    expect(
      getUpcomingOccurrence("2026-08-12", "once", null, null, "2026-08-12"),
    ).toBeNull();
    expect(
      getUpcomingOccurrence("2026-08-12", "once", "2026-08-12", null, "2026-08-12"),
    ).toBeNull();
  });

  it("returns null for an unknown frequency value", () => {
    // getNextOccurrence → getNextDate degrades to null for an unparseable
    // pattern — the upcoming row must never invent a date for it.
    expect(
      getUpcomingOccurrence("2026-08-12", "fortnightly" as never, null, null, "2026-08-12"),
    ).toBeNull();
  });
});

describe("formatNextDate", () => {
  it("formats YYYY-MM-DD as a short month + day", () => {
    expect(formatNextDate("2026-08-15")).toBe("Aug 15");
    expect(formatNextDate("2026-12-01")).toBe("Dec 1");
    expect(formatNextDate("2027-01-31")).toBe("Jan 31");
  });
});
