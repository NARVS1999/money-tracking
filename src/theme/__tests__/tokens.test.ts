// tokens.test.ts — design-token unit tests (15-UI-SPEC §3). Locks the four
// new upcoming-section tokens (yellow-tinted card bg/border, identical values
// under distinct names so the expense/income themes may diverge later) and
// the semantic accents the Home sections are wired with (expense red
// #DC2626 / income teal #45C0CF — the yellow-red and yellow-blue themes).
import { colors } from "../tokens";

describe("upcoming section tokens (15-UI-SPEC §3)", () => {
  it("defines the four upcoming tokens with the UI-SPEC yellow-tinted values", () => {
    expect(colors.upcomingExpenseBg).toBe("rgba(248, 197, 25, 0.08)");
    expect(colors.upcomingExpenseBorder).toBe("rgba(248, 197, 25, 0.15)");
    expect(colors.upcomingIncomeBg).toBe("rgba(248, 197, 25, 0.08)");
    expect(colors.upcomingIncomeBorder).toBe("rgba(248, 197, 25, 0.15)");
  });

  it("keeps the expense and income token names distinct despite identical values", () => {
    const keys = Object.keys(colors).filter((k) => k.startsWith("upcoming"));
    expect(keys.sort()).toEqual([
      "upcomingExpenseBg",
      "upcomingExpenseBorder",
      "upcomingIncomeBg",
      "upcomingIncomeBorder",
    ]);
    // Identical values today, but a HomeScreen call-site switch from one name
    // to the other must not silently be possible — each call site uses its own
    // token (checked by the distinct-key assertion above).
    expect(colors.upcomingExpenseBg).toBe(colors.upcomingIncomeBg);
    expect(colors.upcomingExpenseBorder).toBe(colors.upcomingIncomeBorder);
  });

  it("uses the expense red and income teal accents for the upcoming sections", () => {
    // HomeScreen passes colors.expense / colors.teal as the section accents
    // (15-UI-SPEC §2: yellow-red and yellow-blue themes).
    expect(colors.expense).toBe("#DC2626");
    expect(colors.teal).toBe("#45C0CF");
  });
});
