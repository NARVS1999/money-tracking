// NFR-04 local-date utility unit tests (01-03 Task 1, TDD RED).
// Contract: local "YYYY-MM-DD" strings only — never UTC-derived components
// (getFullYear/getMonth/getDate, never toISOString slicing).
import {
  addDays,
  addMonths,
  addYears,
  compare,
  daysBetween,
  isSameDay,
  isValid,
  monthRange,
  toDateString,
  today,
} from "../dates";

describe("toDateString", () => {
  it("formats a local Date using LOCAL components (never UTC-derived)", () => {
    expect(toDateString(new Date(2026, 7, 6))).toBe("2026-08-06");
  });

  it("pads month and day to two digits", () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("isValid", () => {
  it("accepts a valid date", () => {
    expect(isValid("2026-02-28")).toBe(true);
  });

  it("rejects impossible calendar dates (2026-02-30)", () => {
    expect(isValid("2026-02-30")).toBe(false);
  });

  it("rejects an invalid month", () => {
    expect(isValid("2026-13-01")).toBe(false);
  });

  it("rejects non-zero-padded formats", () => {
    expect(isValid("2026-1-1")).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(isValid("garbage")).toBe(false);
  });

  it("rejects an invalid day for the month", () => {
    expect(isValid("2026-04-31")).toBe(false);
  });

  it("accepts leap-day in a leap year and rejects it otherwise", () => {
    expect(isValid("2024-02-29")).toBe(true);
    expect(isValid("2026-02-29")).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses a month boundary forward", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("crosses a year boundary from Feb 28 in a non-leap year", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("lands on Feb 29 in a leap year", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("crosses a month boundary backward", () => {
    expect(addDays("2026-08-06", -6)).toBe("2026-07-31");
  });

  it("crosses a year boundary backward", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("returns the same date for zero days", () => {
    expect(addDays("2026-08-06", 0)).toBe("2026-08-06");
  });
});

describe("monthRange", () => {
  it("returns the full February range in a leap year", () => {
    expect(monthRange("2024-02")).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
  });

  it("returns the full December range", () => {
    expect(monthRange("2026-12")).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
    });
  });

  it("returns a 30-day month end", () => {
    expect(monthRange("2026-04")).toEqual({
      start: "2026-04-01",
      end: "2026-04-30",
    });
  });
});

describe("compare", () => {
  it("returns -1 when the first date is earlier", () => {
    expect(compare("2026-01-01", "2026-01-02")).toBe(-1);
  });

  it("returns 0 for identical dates", () => {
    expect(compare("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("returns 1 when the first date is later", () => {
    expect(compare("2026-02-01", "2026-01-01")).toBe(1);
  });

  it("is lexicographic — no Date construction, so range ordering is timezone-proof", () => {
    // month-ordering across a year boundary
    expect(compare("2025-12-31", "2026-01-01")).toBe(-1);
  });
});

describe("today", () => {
  it("matches toDateString(new Date()) — local calendar math only", () => {
    expect(today()).toBe(toDateString(new Date()));
  });
});

describe("isSameDay", () => {
  it("is true for identical date strings", () => {
    expect(isSameDay("2026-08-12", "2026-08-12")).toBe(true);
  });

  it("is false for different days", () => {
    expect(isSameDay("2026-08-12", "2026-08-13")).toBe(false);
  });
});

describe("daysBetween", () => {
  it("is 0 for the same day", () => {
    expect(daysBetween("2026-08-12", "2026-08-12")).toBe(0);
  });

  it("counts consecutive days", () => {
    expect(daysBetween("2026-08-11", "2026-08-12")).toBe(1);
  });

  it("crosses a month boundary", () => {
    expect(daysBetween("2026-07-31", "2026-08-12")).toBe(12);
  });

  it("crosses a year boundary", () => {
    expect(daysBetween("2025-12-31", "2026-01-02")).toBe(2);
  });

  it("is negative when b precedes a", () => {
    expect(daysBetween("2026-08-12", "2026-08-10")).toBe(-2);
  });
});

describe("addMonths", () => {
  it("adds months within the same year", () => {
    expect(addMonths("2026-08-12", 1)).toBe("2026-09-12");
  });

  it("rolls over the year boundary", () => {
    expect(addMonths("2026-11-12", 3)).toBe("2027-02-12");
  });

  it("clamps to the last day of a shorter month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29"); // leap year
  });

  it("subtracts months", () => {
    expect(addMonths("2026-03-12", -1)).toBe("2026-02-12");
    expect(addMonths("2026-02-12", -2)).toBe("2025-12-12");
  });

  it("clamps December 31 forward", () => {
    expect(addMonths("2026-12-31", 1)).toBe("2027-01-31");
  });
});

describe("addYears", () => {
  it("adds years", () => {
    expect(addYears("2026-08-12", 1)).toBe("2027-08-12");
  });

  it("subtracts years", () => {
    expect(addYears("2026-08-12", -1)).toBe("2025-08-12");
  });

  it("clamps Feb 29 to Feb 28 in non-leap target years", () => {
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
  });
});
