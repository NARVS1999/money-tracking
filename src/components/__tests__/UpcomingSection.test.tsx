// UpcomingSection component tests (phase 15, HOME-UP-01/02/05/06). Covers the
// section contract: returns null at zero items (absence IS the empty state),
// title rendering, the category-breakdown row contract (category name primary
// + "{n} of {count}" count line — the same visual contract as CategorySection
// rows on the Home screen), the themed amount color (expense red #DC2626 /
// income teal #45C0CF — NOT the Export tab's green), the tap-only row wiring
// (tap -> onTapItem), and the last-row borderless card pattern.
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
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
import { formatCents } from "../../lib/money";
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
  // Fixed clock at 2026-08-12 for deterministic date behavior (repo pattern:
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

  it("shows the category name as the primary line (CategorySection row contract)", () => {
    // The row matches the category-breakdown contract: category name, not
    // the entry description — the description is no longer surfaced here.
    const root = mount([makeEntry()]); // description "Rent", category cat-1 → "Housing"
    expect(texts(root)).toContain("Housing");
    expect(texts(root)).not.toContain("Rent");
  });

  it("shows '{n} of {count}' as the count line for a single item", () => {
    const root = mount([makeEntry()]);
    expect(texts(root)).toContain("1 of 1");
  });

  it("numbers rows with '{index+1} of {count}'", () => {
    const root = mount([
      makeEntry({ id: "s1" }),
      makeEntry({ id: "s2" }),
      makeEntry({ id: "s3" }),
    ]);
    const found = texts(root);
    expect(found).toContain("1 of 3");
    expect(found).toContain("2 of 3");
    expect(found).toContain("3 of 3");
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

  it("applies the theme bg/border to the card with the 24px radius (yellow-tinted card)", () => {
    // The card must be driven by the theme prop, not hardcoded tokens — a
    // custom theme proves the bg/border come from props (15-UI-SPEC §1 card
    // contract: theme.bg background, theme.border 1px edge, radius.lg 24).
    const customTheme: UpcomingSectionTheme = {
      bg: "#111111",
      border: "#222222",
      accent: "#333333",
    };
    const root = mount([makeEntry()], customTheme);
    const card = root.root
      .findAllByType(View)
      .map((v: any) => ({ node: v, style: flattenStyle(v.props.style) }))
      .find(({ style }: any) => style.borderRadius === 24);
    expect(card).toBeTruthy();
    expect(card.style.backgroundColor).toBe("#111111");
    expect(card.style.borderColor).toBe("#222222");
    expect(card.style.borderRadius).toBe(24);
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
      .find((t: any) => t.props.children === "Housing");
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
