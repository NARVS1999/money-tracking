// Frequency matching utilities for recurring entries (Phase 13, SCHD-01+).
// The auto-generation engine (src/scheduled/scheduler.ts) and the Phase 14
// scheduled-entries UI share these semantics:
//   - "once":    matches only the start date
//   - "daily":   matches every day
//   - "weekly":  matches every 7 days from the start date
//   - "monthly": matches the start date's day-of-month (a start on the 31st
//                skips months that have no 31st — day-equality, per plan)
//   - "yearly":  matches the start date's month + day (Feb 29 only in leap
//                years — day-equality)
// All dates are local "YYYY-MM-DD" strings (NFR-04).
import { addDays, addMonths, addYears, compare, daysBetween } from "./dates";

export type Frequency = "once" | "daily" | "weekly" | "monthly" | "yearly";

export const FREQUENCIES: readonly Frequency[] = [
  "once",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  once: "Once",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function isFrequency(value: string): value is Frequency {
  return (FREQUENCIES as readonly string[]).includes(value);
}

// Human-readable label. Unknown strings pass through unchanged so a
// forward-incompatible DB value degrades to showing itself, not a blank.
export function formatFrequency(frequency: string): string {
  return FREQUENCY_LABELS[frequency as Frequency] ?? frequency;
}

// Next occurrence date for a scheduled template (Phase 14 UI). The engine
// advances lastGenerated after each generation, so the next occurrence is
// derived from lastGenerated when set, else from the start date. "once" has
// no next occurrence -> null (the UI shows the start date instead of "Next:").
// endDate caps the pattern: when the next occurrence would land AFTER the end
// date, the engine will never generate it (scheduler.ts:65) -> null (WR-01),
// so the UI stops promising "Next:" for a finished template.
export function getNextOccurrence(
  startDate: string,
  frequency: Frequency,
  lastGenerated: string | null,
  endDate: string | null,
): string | null {
  const next = getNextDate(lastGenerated ?? startDate, frequency);
  if (next === null || (endDate !== null && compare(next, endDate) > 0)) {
    return null;
  }
  return next;
}

// Short "Mon D" label for a YYYY-MM-DD date ("Aug 15"), matching the
// DateSectionHeader convention — UI code must not re-implement date formatting.
export function formatNextDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function dayOfMonth(s: string): number {
  return Number(s.slice(8, 10));
}

function monthOf(s: string): number {
  return Number(s.slice(5, 7));
}

// True when `date` is an occurrence of the frequency pattern anchored at
// `startDate`. Only the occurrence pattern is checked — range bounds
// (endDate / today) are the caller's concern.
export function matchesFrequency(
  date: string,
  frequency: Frequency,
  startDate: string,
): boolean {
  switch (frequency) {
    case "once":
      return date === startDate;
    case "daily":
      return true;
    case "weekly":
      // Multiples of 7 days from the anchor (including 0 = the start date).
      // A negative multiple also anchors — harmless for forward generation.
      return daysBetween(startDate, date) % 7 === 0;
    case "monthly":
      return dayOfMonth(date) === dayOfMonth(startDate);
    case "yearly":
      return (
        dayOfMonth(date) === dayOfMonth(startDate) &&
        monthOf(date) === monthOf(startDate)
      );
    default:
      // Unknown frequency value (e.g. a hand-edited DB row) never matches —
      // the engine must not invent occurrences for a pattern it can't parse.
      return false;
  }
}

// Next occurrence strictly after `lastDate`, engine-consistent: the result
// satisfies matchesFrequency(next, frequency, lastDate). "once" has no next
// occurrence -> null. Monthly scans day-by-day (bounded by the longest month)
// so a clamped short month does not desync the engine's day-equality rule:
// Jan 31 -> Mar 31 (Feb has no 31st), Feb 28 -> Mar 28, Jan 29 -> Feb 29 in
// leap years. Yearly re-anchors until month/day both match (Feb 29 -> the
// next leap year's Feb 29).
export function getNextDate(
  lastDate: string,
  frequency: Frequency,
): string | null {
  switch (frequency) {
    case "once":
      return null;
    case "daily":
      return addDays(lastDate, 1);
    case "weekly":
      return addDays(lastDate, 7);
    case "monthly": {
      let d = addDays(lastDate, 1);
      for (let i = 0; i < 62; i++) {
        if (matchesFrequency(d, "monthly", lastDate)) return d;
        d = addDays(d, 1);
      }
      return d; // unreachable for valid inputs; safety net
    }
    case "yearly": {
      // Recompute from the ORIGINAL anchor every iteration: addYears clamps
      // Feb 29 to Feb 28, and adding years to the clamped day would stay 28
      // forever — it would never re-anchor onto a leap day.
      for (let i = 1; i <= 8; i++) {
        const candidate = addYears(lastDate, i);
        if (matchesFrequency(candidate, "yearly", lastDate)) return candidate;
      }
      return addYears(lastDate, 8); // unreachable for valid inputs; safety net
    }
    default:
      return null;
  }
}
