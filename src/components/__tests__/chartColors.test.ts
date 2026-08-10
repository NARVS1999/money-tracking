// Chart color palette unit tests (Phase 10: Charts).
// Contract: getChartColor() wraps index modulo palette length.
import { CHART_COLORS, getChartColor } from "../chartColors";

describe("CHART_COLORS", () => {
  it("contains 8 colors", () => {
    expect(CHART_COLORS).toHaveLength(8);
  });

  it("all values are valid hex colors", () => {
    CHART_COLORS.forEach((c) => {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

describe("getChartColor", () => {
  it("returns the first color for index 0", () => {
    expect(getChartColor(0)).toBe(CHART_COLORS[0]);
  });

  it("returns the last color for index 7", () => {
    expect(getChartColor(7)).toBe(CHART_COLORS[7]);
  });

  it("wraps around for index beyond palette length", () => {
    expect(getChartColor(8)).toBe(CHART_COLORS[0]);
    expect(getChartColor(9)).toBe(CHART_COLORS[1]);
  });

  it("wraps around for large indices", () => {
    expect(getChartColor(100)).toBe(CHART_COLORS[100 % CHART_COLORS.length]);
  });
});
