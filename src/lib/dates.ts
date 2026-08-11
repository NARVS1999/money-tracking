// NFR-04 deterministic local-date utilities (01-RESEARCH.md Code Examples, lines 503-528).
// Contract:
//   - local "YYYY-MM-DD" strings only, built from LOCAL calendar components
//     (getFullYear/getMonth/getDate) — NEVER toISOString().slice(0,10), which is
//     UTC and shifts dates for timezones ahead of UTC (Pitfall 5)
//   - range queries across these strings are lexicographic (timezone-proof)
//   - pure + dependency-free
const pad = (n: number) => n.toString().padStart(2, "0");

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // LOCAL — no toISOString
}

export function today(): string {
  return toDateString(new Date());
}

export function isValid(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  // Round-trip rejects impossible dates like 2026-02-30 (Date rolls them over)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function addDays(s: string, n: number): string {
  const [y, m, d] = s.split("-").map(Number);
  return toDateString(new Date(y, m - 1, d + n)); // local Date math
}

export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0; // lexicographic works for zero-padded YYYY-MM-DD
}

export function monthRange(s: string): { start: string; end: string } {
  const [y, m] = s.split("-").map(Number);
  const start = `${y}-${pad(m)}-01`;
  const end = toDateString(new Date(y, m, 0)); // day 0 of next month = last day of this month
  return { start, end };
}

// True when both strings name the same calendar day. The YYYY-MM-DD format
// is zero-padded and local, so lexical equality IS day equality.
export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

// Whole days from a to b (b - a), signed. LOCAL calendar math via Date(y,
// m-1, d) — never UTC components. Math.round absorbs DST-induced 23/25-hour
// days; both dates are interpreted at local midnight.
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms =
    new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime();
  return Math.round(ms / 86_400_000);
}

// Add n months to a date string. The day is clamped to the target month's
// last day when it does not exist (Jan 31 + 1 -> Feb 28/29), so the result is
// always a valid calendar date. Clamping is sticky: Feb 28 + 1 -> Mar 28.
export function addMonths(s: string, n: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12; // 0-based month of the result
  const lastDay = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, lastDay))}`;
}

// Add n years to a date string. Feb 29 clamps to Feb 28 in non-leap target
// years (2024-02-29 + 1 -> 2025-02-28).
export function addYears(s: string, n: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const ny = y + n;
  const lastDay = new Date(ny, m, 0).getDate();
  return `${ny}-${pad(m)}-${pad(Math.min(d, lastDay))}`;
}
