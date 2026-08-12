// ExportScreen component tests — the "Scheduled Entries" section
// (14-UI-SPEC §3, SCHD-UI-02/05/06). Covers the section header + Add
// Scheduled CTA, the Expenses/Income sub-sections (hidden at zero of that
// type, fixed order), the whole-section empty state copy, the LoadingSkeleton
// while loading, the inline load-error + Retry → sync flow, and the
// navigation wiring (Add with the sub-section-derived type, row tap → edit
// with the row's id + type). The provider/firebase chain is mocked — plain
// jest does not load .env and the real providers throw at module load.
import React from "react";
import { Alert, Animated, Text } from "react-native";
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

// ── Mock: navigation ───────────────────────────────────────────────────────
let mockNavigate: jest.Mock;

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

// ── Mock: providers (plain mocks — requireActual would pull the firebase
// init chain that throws auth/invalid-api-key under plain jest) ────────────
jest.mock("../../entries/EntriesProvider", () => ({
  useEntries: () => ({ entries: [] }),
}));

let mockCategories: any;

jest.mock("../../categories/CategoriesProvider", () => ({
  useCategories: () => mockCategories,
}));

let mockScheduled: {
  scheduledEntries: any[];
  deleteScheduled: jest.Mock;
  pauseScheduled: jest.Mock;
  resumeScheduled: jest.Mock;
  sync: jest.Mock;
  isLoading: boolean;
  lastError: string | null;
};

jest.mock("../../scheduled/ScheduledEntriesProvider", () => ({
  useScheduledEntries: () => mockScheduled,
}));

// ── Mock: export pipeline (expo-print / expo-file-system / xlsx chain) ─────
jest.mock("../../lib/exportPipeline", () => ({
  exportPDF: jest.fn(async () => "ledger.pdf"),
  exportExcel: jest.fn(async () => "ledger.xlsx"),
  exportCSV: jest.fn(async () => "ledger.csv"),
}));

// ── Subject under test ─────────────────────────────────────────────────────
import ExportScreen from "../ExportScreen";
import { Timestamp } from "firebase/firestore";

const ts = new Timestamp(1_700_000_000, 0);

const expenseEntry = {
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
};

const incomeEntry = {
  ...expenseEntry,
  id: "s2",
  type: "income",
  amount: 250000,
  categoryId: "cat-3",
  description: "Salary",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate = jest.fn();
  mockCategories = {
    expenseCategories: [{ id: "cat-1", name: "Housing", createdAt: ts }],
    incomeCategories: [{ id: "cat-3", name: "Salary", createdAt: ts }],
  };
  mockScheduled = {
    scheduledEntries: [],
    deleteScheduled: jest.fn(async () => {}),
    pauseScheduled: jest.fn(async () => {}),
    resumeScheduled: jest.fn(async () => {}),
    sync: jest.fn(async () => {}),
    isLoading: false,
    lastError: null,
  };
});

function mount() {
  let root: any;
  act(() => {
    root = renderer.create(<ExportScreen />);
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

describe("ExportScreen scheduled section — header and empty state", () => {
  it("renders the section header and the Add Scheduled CTA", () => {
    const root = mount();
    const labels = texts(root);
    expect(labels).toContain("Scheduled Entries");
    expect(labels).toContain("Add Scheduled");
  });

  it("shows the whole-section empty state copy when both types are zero", () => {
    const root = mount();
    const labels = texts(root);
    expect(labels).toContain("No scheduled entries yet");
    expect(labels).toContain(
      "Add one to auto-generate recurring expenses or income.",
    );
    // No sub-section headings when there is nothing to list.
    expect(labels).not.toContain("Expenses");
    expect(labels).not.toContain("Income");
  });
});

describe("ExportScreen scheduled section — sub-sections", () => {
  it("lists expense rows under Expenses and hides the Income sub-section at zero", () => {
    mockScheduled.scheduledEntries = [expenseEntry];
    const root = mount();
    const labels = texts(root);
    expect(labels).toContain("Expenses");
    expect(labels).not.toContain("Income");
    expect(labels).toContain("Rent");
    expect(labels).not.toContain("No scheduled entries yet");
  });

  it("lists income rows under Income and hides the Expenses sub-section at zero", () => {
    mockScheduled.scheduledEntries = [incomeEntry];
    const root = mount();
    const labels = texts(root);
    expect(labels).toContain("Income");
    expect(labels).not.toContain("Expenses");
    expect(labels).toContain("Salary");
  });

  it("renders both sub-sections in fixed Expenses → Income order", () => {
    mockScheduled.scheduledEntries = [incomeEntry, expenseEntry];
    const root = mount();
    const labels = texts(root);
    const expenseIdx = labels.indexOf("Expenses");
    const incomeIdx = labels.indexOf("Income");
    expect(expenseIdx).toBeGreaterThanOrEqual(0);
    expect(incomeIdx).toBeGreaterThan(expenseIdx);
  });
});

describe("ExportScreen scheduled section — navigation wiring", () => {
  it("opens the add form with the expense type when expense templates exist", () => {
    mockScheduled.scheduledEntries = [expenseEntry];
    const root = mount();
    act(() => {
      pressableWithText(root, "Add Scheduled").props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("ScheduledEntryForm", {
      mode: "add",
      type: "expense",
    });
  });

  it("opens the add form with the income type when only income templates exist", () => {
    mockScheduled.scheduledEntries = [incomeEntry];
    const root = mount();
    act(() => {
      pressableWithText(root, "Add Scheduled").props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("ScheduledEntryForm", {
      mode: "add",
      type: "income",
    });
  });

  it("opens the edit form with the row's id and type on row tap", () => {
    mockScheduled.scheduledEntries = [expenseEntry, incomeEntry];
    const root = mount();
    act(() => {
      pressableWithText(root, "Rent").props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("ScheduledEntryForm", {
      mode: "edit",
      id: "s1",
      type: "expense",
    });
    act(() => {
      pressableWithText(root, "Salary").props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith("ScheduledEntryForm", {
      mode: "edit",
      id: "s2",
      type: "income",
    });
  });
});

describe("ExportScreen scheduled section — loading and error states", () => {
  it("renders the LoadingSkeleton while loading and no list content", () => {
    mockScheduled.scheduledEntries = [expenseEntry];
    mockScheduled.isLoading = true;
    const root = mount();
    const labels = texts(root);
    expect(labels).not.toContain("Rent");
    expect(labels).not.toContain("No scheduled entries yet");
    // LoadingSkeleton = 2 totals + 3 rows Animated.Views.
    expect(root.root.findAllByType(Animated.View).length).toBeGreaterThanOrEqual(5);
  });

  it("shows the inline load error and calls sync on Retry", () => {
    mockScheduled.lastError = "Something broke";
    const root = mount();
    const labels = texts(root);
    expect(labels).toContain("Couldn't load scheduled entries.");
    expect(labels).toContain("Retry");
    expect(labels).not.toContain("No scheduled entries yet");
    act(() => {
      pressableWithText(root, "Retry").props.onPress();
    });
    expect(mockScheduled.sync).toHaveBeenCalledTimes(1);
  });
});

describe("ExportScreen scheduled section — row mutations", () => {
  it("pauses an active template through the provider on the Pause swipe action", () => {
    mockScheduled.scheduledEntries = [expenseEntry];
    const root = mount();
    act(() => {
      pressableWithText(root, "Pause").props.onPress();
    });
    expect(mockScheduled.pauseScheduled).toHaveBeenCalledWith("s1");
    expect(mockScheduled.resumeScheduled).not.toHaveBeenCalled();
  });

  it("resumes a paused template through the provider on the Resume swipe action", () => {
    mockScheduled.scheduledEntries = [{ ...expenseEntry, isActive: false }];
    const root = mount();
    act(() => {
      pressableWithText(root, "Resume").props.onPress();
    });
    expect(mockScheduled.resumeScheduled).toHaveBeenCalledWith("s1");
    expect(mockScheduled.pauseScheduled).not.toHaveBeenCalled();
  });

  it("deletes only after the Alert confirmation", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    mockScheduled.scheduledEntries = [expenseEntry];
    const root = mount();
    act(() => {
      pressableWithText(root, "Delete").props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe("Delete this scheduled entry?");
    expect(mockScheduled.deleteScheduled).not.toHaveBeenCalled();
    const confirmBtn = (alertSpy.mock.calls[0][2] as any)?.[1];
    act(() => {
      confirmBtn?.onPress();
    });
    expect(mockScheduled.deleteScheduled).toHaveBeenCalledWith("s1");
  });

  it("surfaces a rejected mutation through the provider without throwing", async () => {
    mockScheduled.scheduledEntries = [expenseEntry];
    mockScheduled.pauseScheduled = jest.fn(async () => {
      throw new Error("boom");
    });
    const root = mount();
    await act(async () => {
      pressableWithText(root, "Pause").props.onPress();
    });
    // The handler catches the rejection — the provider's lastError block is
    // the only surface. No unhandled rejection propagates.
    expect(mockScheduled.pauseScheduled).toHaveBeenCalledWith("s1");
  });
});
