// NFR-03 money utility unit tests (01-03 Task 1, TDD RED).
// Contract: integer cents in/out only — zero float math, zero device-dependent
// formatter APIs (no Intl.NumberFormat). Output "₱ 1,234.56" — space after ₱,
// thousands separators always shown.
import { formatCents, parsePesoInput } from "../money";

describe("formatCents", () => {
  it("formats zero as ₱ 0.00", () => {
    expect(formatCents(0)).toBe("₱ 0.00");
  });

  it("formats thousands with separators", () => {
    expect(formatCents(123456)).toBe("₱ 1,234.56");
  });

  it("formats sub-peso amounts with a padded fraction", () => {
    expect(formatCents(5)).toBe("₱ 0.05");
  });

  it("formats negative amounts with a leading minus before the symbol", () => {
    expect(formatCents(-2450)).toBe("-₱ 24.50");
  });

  it("formats large values with full grouping", () => {
    expect(formatCents(999999999)).toBe("₱ 9,999,999.99");
  });

  it("pads single-digit fractions", () => {
    expect(formatCents(2450)).toBe("₱ 24.50");
  });
});

describe("parsePesoInput", () => {
  it("parses a decimal amount to integer cents", () => {
    expect(parsePesoInput("24.5")).toBe(2450);
  });

  it("parses a fully formatted peso string with symbol, commas and spaces", () => {
    expect(parsePesoInput("₱ 1,234.56")).toBe(123456);
  });

  it("parses a whole number as pesos", () => {
    expect(parsePesoInput("12")).toBe(1200);
  });

  it("parses a two-decimal fraction", () => {
    expect(parsePesoInput("0.05")).toBe(5);
  });

  it("rejects three decimal places", () => {
    expect(parsePesoInput("0.001")).toBeNull();
  });

  it("rejects multiple decimal separators", () => {
    expect(parsePesoInput("1.2.3")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parsePesoInput("abc")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(parsePesoInput("")).toBeNull();
  });

  it("accepts a leading P/₱ with no space", () => {
    expect(parsePesoInput("P25")).toBe(2500);
  });

  it("never performs float arithmetic — 0.1 + 0.2 style drift is impossible", () => {
    expect(parsePesoInput("0.10")).toBe(10);
    expect(parsePesoInput("0.2")).toBe(20);
    expect(parsePesoInput("1.29")).toBe(129);
  });
});
