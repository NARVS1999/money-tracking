// UpcomingSection component tests (phase 15, HOME-UP-01/02/05/06). Covers the
// section contract: returns null at zero items (absence IS the empty state),
// title rendering, the ScheduledEntryRow content contract (description ||
// category name primary, "{Frequency} · Next: {date}" secondary, "once"
// without a "Next:" prefix), the WR-01 today-clamp on the "Next:" date (a
// stale lastGenerated anchor never shows a past date), the themed amount
// color (expense red #DC2626 / income teal #45C0CF — NOT the Export tab's
// green), the tap-only row wiring (tap -> onTapItem), and the last-row
// borderless card pattern.
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import renderer, { act } from "react-test-renderer";

// ── Mock: @expo/vector-icons (CategoryIcon renders through it) ────────────
jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native");
  return {
    Ionicons: (props: any) => ReactMod.createElement(RN.Text, props, "icon"),
  };
});

// ── Mock: CategoriesProvider (category lookup for the rows) ───────────────
let mockCategories: any = {};

jest.mock("../../categories/CategoriesProvider", () => ({
  useCategories: () => mockCategories,
}));

// ── Subject under test ─────────────────────────────────────────────────────
import UpcomingSection, {
  type UpcomingSectionTheme,
} from "../UpcomingSection";
import type { ScheduledEntry } from "../../scheduled/ScheduledEntriesProvider";
import { formatCents, } from "../../lib/money";
import { formatNextDate } from "../../lib/frequency";
import { Timestamp } from "firebase/firestore";

const ts = new Timestamp(1_700_000_000, 0);

function makeEntry(overrides: Partial<ScheduledEntry> = {}): ScheduledEntry {
  return {
    id: "s1",
    uid: "user-1",
    type: "expense",
    amount: 12345,
    categoryId: "cat-1",
    date: "2026-08-12",
    description: "Rent",
    frequency: "weekly",
    endDate: null,
    lastGenerated: null,
    isActive: true,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

const expenseTheme: UpcomingSectionTheme = {
  bg: "rgba(248, 197, 25, 0.08)",
  border: "rgba(248, 197, 25, 0.15)",
  accent: "#DC2626",
};

const incomeTheme: UpcomingSectionTheme = {
  bg: "rgba(248, 197, 25, 0.08)",
  border: "rgba(248, 197, 25, 0.15)",
  accent: "#45C0CF",
};

function mount(items: ScheduledEntry[], theme: UpcomingSectionTheme = expenseTheme) {
  let root: any;
  act(() => {
    root = renderer.create(
      <UpcomingSection
        title="Upcoming Expenses"
        items={items}
        theme={theme}
        onTapItem={jest.fn()}
      />,
    );
  });
  return root;
}

function texts(root: any): string[] {
  return root.root
    .findAllByType(Text)
    .map((t: any) => t.props.children)
    .filter(
      (c: unknown) =>
        typeof c === "string" && c !== "icon" && c.trim().length > 0,
    );
}

// Color from a Text node's style array (ScheduledEntryRow test pattern).
function colorOfText(root: any, label: string): string | undefined {
  const node = root.root
    .findAllByType(Text)
    .find((t: any) => t.props.children === label);
  if (!node) return undefined;
  const style = Array.isArray(node.props.style)
    ? node.props.style
    : [node.props.style];
  return style.find(
    (s: any) => s && typeof s === "object" && s.color,
  )?.color;
}

// Flatten a style array into a single object.
function flattenStyle(style: any): Record<string, unknown> {
  return ([] as any[])
    .concat(style)
    .filter(Boolean)
    .reduce((acc, s) => ({ ...acc, ...s }), {});
}

beforeEach(() => {
  jest.clearAllMocks();
  // Fixed clock at 2026-08-12 — the WR-01 clamp anchors "Next:" to today,
  // so every date expectation must be deterministic (repo pattern:
  // syncQueue-test / seed-test useFakeTimers).
  jest.useFakeTimers({ now: new Date(2026, 7, 12) });
  mockCategories = {
    expenseCategories: [
      { id: "cat-1", name: "Housing", createdAt: ts },
      { id: "cat-2", name: "Food", createdAt: ts },
    ],
    incomeCategories: [{ id: "cat-3", name: "Salary", createdAt: ts }],
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe("UpcomingSection empty state", () => {
  it("returns null when there are no items (absence IS the empty state)", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <UpcomingSection
          title="Upcoming Expenses"
          items={[]}
          theme={expenseTheme}
          onTapItem={jest.fn()}
        />,
      );
    });
    expect(root.root.findAllByType(Text)).toHaveLength(0);
    expect(root.toJSON()).toBeNull();
  });
});

describe("UpcomingSection content", () => {
  it("renders the section title", () => {
    const root = mount([makeEntry()]);
    expect(texts(root)).toContain("Upcoming Expenses");
  });

  it("shows the description as the primary line when present", () => {
    const root = mount([makeEntry()]);
    expect(texts(root)).toContain("Rent");
  });

  it("falls back to the category name when the description is empty", () => {
    const root = mount([makeEntry({ description: "" })]);
    expect(texts(root)).toContain("Housing");
  });

  it("shows '{Frequency} · Next: {date}' for a repeating entry", () => {
    const root = mount([makeEntry()]); // weekly from 2026-08-12 → next 2026-08-19
    const expected = `Weekly · Next: ${formatNextDate("2026-08-19")}`;
    expect(texts(root)).toContain(expected);
  });

  it("shows the start date without a 'Next:' prefix for a once entry", () => {
    const root = mount([makeEntry({ frequency: "once" })]);
    const expected = `Once · ${formatNextDate("2026-08-12")}`;
    expect(texts(root)).toContain(expected);
  });

  it("shows the start date without a 'Next:' prefix when the pattern has ended (endDate passed)", () => {
    const root = mount([
      makeEntry({ frequency: "weekly", endDate: "2026-08-18" }),
    ]);
    const expected = `Weekly · ${formatNextDate("2026-08-12")}`;
    expect(texts(root)).toContain(expected);
  });

  it("never shows a past date as 'Next:' when the engine anchor is stale (WR-01)", () => {
    // Daily template whose lastGenerated (Aug 10) predates today (Aug 12):
    // the engine-consistent next (Aug 11) is gone — the row clamps to today.
    const root = mount([
      makeEntry({ date: "2026-01-01", lastGenerated: "2026-08-10", frequency: "daily" }),
    ]);
    const expected = `Daily · Next: ${formatNextDate("2026-08-12")}`;
    expect(texts(root)).toContain(expected);
  });

  it("clamps a stale weekly anchor to the next future occurrence (WR-01)", () => {
    // Weekly from Mon 2026-08-03, lastGenerated Mon 2026-08-03, today Wed
    // 2026-08-12: the engine next (Mon Aug 10) is past → next Monday Aug 17.
    const root = mount([
      makeEntry({ date: "2026-08-03", lastGenerated: "2026-08-03", frequency: "weekly" }),
    ]);
    const expected = `Weekly · Next: ${formatNextDate("2026-08-17")}`;
    expect(texts(root)).toContain(expected);
  });

  it("colors the amount with the expense theme accent (#DC2626)", () => {
    const root = mount([makeEntry()]);
    expect(colorOfText(root, formatCents(12345))).toBe("#DC2626");
  });

  it("colors the amount with the income theme accent (#45C0CF — not the Export green)", () => {
    const root = mount(
      [makeEntry({ type: "income", categoryId: "cat-3", description: "Salary" })],
      incomeTheme,
    );
    expect(colorOfText(root, formatCents(12345))).toBe("#45C0CF");
  });
});

describe("UpcomingSection interactions", () => {
  it("calls onTapItem with the entry when a row is tapped", () => {
    const onTapItem = jest.fn();
    const entry = makeEntry();
    let root: any;
    act(() => {
      root = renderer.create(
        <UpcomingSection
          title="Upcoming Expenses"
          items={[entry]}
          theme={expenseTheme}
          onTapItem={onTapItem}
        />,
      );
    });
    const label = root.root
      .findAllByType(Text)
      .find((t: any) => t.props.children === "Rent");
    let node = label;
    while (node && typeof node.props?.onPress !== "function") {
      node = node.parent;
    }
    act(() => {
      node.props.onPress();
    });
    expect(onTapItem).toHaveBeenCalledWith(entry);
  });

  it("drops the bottom border on the last row only", () => {
    const root = mount([makeEntry({ id: "s1" }), makeEntry({ id: "s2" })]);
    const rows = root.root.findAllByType(TouchableOpacity);
    expect(rows.length).toBe(2);
    expect(flattenStyle(rows[0].props.style).borderBottomWidth).toBe(1);
    expect(flattenStyle(rows[1].props.style).borderBottomWidth).toBe(0);
  });
});
