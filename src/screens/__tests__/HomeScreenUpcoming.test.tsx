// HomeScreen upcoming-sections integration tests (phase 15, HOME-UP-01/02/03/
// 05/06/07). Covers: both sections render with active templates, per-type
// hiding at zero (partial + both-zero), paused-template exclusion, upcoming
// row ordering (next occurrence ascending, null-next last by start date),
// section placement between the quick-action buttons and the chart sections,
// and row tap → ScheduledEntryForm edit-mode navigation (id + type).
// All providers are plain mocks — requireActual would pull the firebase init
// chain that throws auth/invalid-api-key under plain jest (phase-14 pattern).
import React from "react";
import { Text } from "react-native";
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

// ── Mock: native view libs used by the summary card / donut charts ────────
jest.mock("expo-linear-gradient", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native");
  return {
    LinearGradient: (props: any) => ReactMod.createElement(RN.View, props),
  };
});

jest.mock("react-native-svg", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native");
  const View = (props: any) => ReactMod.createElement(RN.View, props);
  // __esModule: true so the interop default import resolves to View itself
  // (DonutChart does `import Svg, { Path } from "react-native-svg"`).
  return { __esModule: true, default: View, Svg: View, Path: View, Circle: View };
});

// ── Mock: navigation ───────────────────────────────────────────────────────
let mockNavigate: jest.Mock;

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// ── Mock: providers (plain mocks — no firebase chain) ─────────────────────
let mockUseEntries: jest.Mock;
let mockCategories: any;
let mockAuth: any;
let mockScheduled: { scheduledEntries: any[] };

jest.mock("../../entries/EntriesProvider", () => ({
  useEntries: () => mockUseEntries(),
}));

jest.mock("../../categories/CategoriesProvider", () => ({
  useCategories: () => mockCategories,
}));

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("../../scheduled/ScheduledEntriesProvider", () => ({
  useScheduledEntries: () => mockScheduled,
}));

// ── Subject under test ─────────────────────────────────────────────────────
// eslint-disable-next-line import/first
import HomeScreen from "../HomeScreen";
import { Timestamp } from "firebase/firestore";

const ts = new Timestamp(1_700_000_000, 0);

// Entry fixture — minimal shape HomeScreen reads (type/amount/categoryId/date).
const entry = { id: "e1", type: "expense", amount: 1000, categoryId: "cat-1", date: "2026-08-01" };

function makeScheduled(overrides: Record<string, unknown> = {}) {
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

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate = jest.fn();
  mockUseEntries = jest.fn().mockReturnValue({
    entries: [entry],
    isLoading: false,
  });
  mockCategories = {
    expenseCategories: [{ id: "cat-1", name: "Housing", icon: "home", createdAt: ts }],
    incomeCategories: [{ id: "cat-3", name: "Salary", icon: "cash", createdAt: ts }],
  };
  mockAuth = { userProfile: null };
  mockScheduled = { scheduledEntries: [] };
});

function mount() {
  let root: any;
  act(() => {
    root = renderer.create(<HomeScreen />);
  });
  return root;
}

// All Text children in tree (render) order — used for order assertions.
function texts(root: any): string[] {
  return root.root
    .findAllByType(Text)
    .map((t: any) => t.props.children)
    .filter(
      (c: unknown) =>
        typeof c === "string" && c !== "icon" && c.trim().length > 0,
    );
}

// Walk up from the label to the nearest ancestor with an onPress.
function pressableWithText(root: any, label: string): any {
  const textNode = root.root
    .findAllByType(Text)
    .find((t: any) => t.props.children === label);
  if (!textNode) return undefined;
  let node = textNode;
  while (node && typeof node.props?.onPress !== "function") {
    node = node.parent;
  }
  return node;
}

describe("HomeScreen upcoming sections", () => {
  it("renders Upcoming Expenses and Upcoming Income when both types have active templates", () => {
    mockScheduled = {
      scheduledEntries: [
        makeScheduled(),
        makeScheduled({ id: "s2", type: "income", categoryId: "cat-3", description: "Salary" }),
      ],
    };
    const root = mount();
    const found = texts(root);
    expect(found).toContain("Upcoming Expenses");
    expect(found).toContain("Upcoming Income");
    expect(found).toContain("Rent");
    expect(found).toContain("Salary");
  });

  it("hides Upcoming Income when there are no active income templates", () => {
    mockScheduled = { scheduledEntries: [makeScheduled()] };
    const root = mount();
    const found = texts(root);
    expect(found).toContain("Upcoming Expenses");
    expect(found).not.toContain("Upcoming Income");
  });

  it("hides both upcoming sections when there are no scheduled entries", () => {
    const root = mount(); // mockScheduled.scheduledEntries = []
    const found = texts(root);
    expect(found).not.toContain("Upcoming Expenses");
    expect(found).not.toContain("Upcoming Income");
  });

  it("excludes paused templates from both sections", () => {
    mockScheduled = {
      scheduledEntries: [
        makeScheduled({ id: "s1", description: "Active rent" }),
        makeScheduled({ id: "s2", description: "Paused rent", isActive: false }),
      ],
    };
    const root = mount();
    const found = texts(root);
    expect(found).toContain("Active rent");
    expect(found).not.toContain("Paused rent");
  });

  it("orders rows by next occurrence ascending, null-next entries last by start date", () => {
    // B: weekly from 08-05 → next 08-12 (soonest). A: weekly from 08-12 →
    // next 08-19. C: once (no next) with the earliest start → last.
    mockScheduled = {
      scheduledEntries: [
        makeScheduled({ id: "a", date: "2026-08-12", description: "A-late" }),
        makeScheduled({ id: "b", date: "2026-08-05", description: "B-soon" }),
        makeScheduled({ id: "c", date: "2026-08-01", frequency: "once", description: "C-once" }),
      ],
    };
    const root = mount();
    const found = texts(root);
    const b = found.indexOf("B-soon");
    const a = found.indexOf("A-late");
    const c = found.indexOf("C-once");
    expect(b).toBeGreaterThanOrEqual(0);
    expect(a).toBeGreaterThan(b);
    expect(c).toBeGreaterThan(a);
  });

  it("places the upcoming sections between the quick-action buttons and the chart sections", () => {
    mockScheduled = { scheduledEntries: [makeScheduled()] };
    const root = mount();
    const found = texts(root);
    const quickExpense = found.indexOf("- Expense");
    const quickIncome = found.indexOf("+ Income");
    const upcomingTitle = found.indexOf("Upcoming Expenses");
    const chartTitle = found.indexOf("Expenses by Category");
    expect(quickExpense).toBeGreaterThanOrEqual(0);
    expect(quickIncome).toBeGreaterThanOrEqual(0);
    expect(upcomingTitle).toBeGreaterThan(Math.max(quickExpense, quickIncome));
    expect(chartTitle).toBeGreaterThan(upcomingTitle);
  });

  it("navigates to ScheduledEntryForm in edit mode with the row id and type on tap", () => {
    mockScheduled = { scheduledEntries: [makeScheduled()] };
    const root = mount();
    const tappable = pressableWithText(root, "Rent");
    expect(tappable).toBeTruthy();
    act(() => {
      tappable.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("ScheduledEntryForm", {
      mode: "edit",
      id: "s1",
      type: "expense",
    });
  });
});
