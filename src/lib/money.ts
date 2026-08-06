// NFR-03 deterministic money utilities (01-RESEARCH.md Code Examples, lines 484-501).
// Contract:
//   - integer cents everywhere; NO float arithmetic (float drift is a correctness bug)
//   - NO Intl.NumberFormat / toFixed — Hermes delegates Intl to platform ICU/CLDR,
//     so output varies per device (Pitfall 6)
//   - pure + dependency-free: this module is the ONLY place money is formatted/parsed
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toString(); // integer division — never float cents/100
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${sign}₱ ${grouped}.${frac}`;
}

export function parsePesoInput(input: string): number | null {
  const cleaned = input.replace(/[₱Pp\s,]/g, ""); // strip symbol/commas/spaces
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null; // up to 2 decimals only
  const [w = "0", f = ""] = cleaned.split(".");
  // String-split math -> integer cents; never parseFloat(x) * 100 (float drift)
  return Number(w) * 100 + Number(f.padEnd(2, "0").slice(0, 2));
}
