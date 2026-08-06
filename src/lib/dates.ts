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
