// Category icon color utility unit tests (Phase 9: Category Icons).
// Contract: getIconColor/getIconTextColor wrap index modulo palette length.
import { ICON_COLORS, ICON_TEXT_COLORS, getIconColor, getIconTextColor } from "../categoryIcons";

describe("ICON_COLORS", () => {
  it("contains 8 colors", () => {
    expect(ICON_COLORS).toHaveLength(8);
  });

  it("all values are valid rgba color strings", () => {
    ICON_COLORS.forEach((c) => {
      expect(c).toMatch(/^rgba\(\d+,\d+,\d+,\d+(\.\d+)?\)$/);
    });
  });
});

describe("ICON_TEXT_COLORS", () => {
  it("contains 8 colors", () => {
    expect(ICON_TEXT_COLORS).toHaveLength(8);
  });

  it("all values are valid hex colors", () => {
    ICON_TEXT_COLORS.forEach((c) => {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

describe("getIconColor", () => {
  it("returns the first color for index 0", () => {
    expect(getIconColor(0)).toBe(ICON_COLORS[0]);
  });

  it("returns the last color for index 7", () => {
    expect(getIconColor(7)).toBe(ICON_COLORS[7]);
  });

  it("wraps around for index beyond palette length", () => {
    expect(getIconColor(8)).toBe(ICON_COLORS[0]);
    expect(getIconColor(9)).toBe(ICON_COLORS[1]);
  });

  it("wraps around for large indices", () => {
    expect(getIconColor(100)).toBe(ICON_COLORS[100 % ICON_COLORS.length]);
  });
});

describe("getIconTextColor", () => {
  it("returns the first color for index 0", () => {
    expect(getIconTextColor(0)).toBe(ICON_TEXT_COLORS[0]);
  });

  it("returns the last color for index 7", () => {
    expect(getIconTextColor(7)).toBe(ICON_TEXT_COLORS[7]);
  });

  it("wraps around for index beyond palette length", () => {
    expect(getIconTextColor(8)).toBe(ICON_TEXT_COLORS[0]);
    expect(getIconTextColor(9)).toBe(ICON_TEXT_COLORS[1]);
  });

  it("wraps around for large indices", () => {
    expect(getIconTextColor(100)).toBe(ICON_TEXT_COLORS[100 % ICON_TEXT_COLORS.length]);
  });
});
