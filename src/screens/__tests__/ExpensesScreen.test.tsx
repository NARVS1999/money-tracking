// ExpensesScreen component tests (income-tab-no-add-entry-button debug session).
// Regression: the empty state (no expense entries yet) must still render the
// add-entry FAB (+) — previously the FAB only rendered in the non-empty
// branch, so an empty Expenses tab told the user to "Tap the + button below"
// with no button rendered (identical latent defect to the Income tab).
import React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// ── Mock: useNavigation ────────────────────────────────────────────
let mockNavigate: jest.Mock;

jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native");
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate }),
  };
});

// ── Mock: EntriesProvider ──────────────────────────────────────────
let mockUseEntries: jest.Mock;

jest.mock("../../entries/EntriesProvider", () => {
  const actual = jest.requireActual("../../entries/EntriesProvider");
  return { ...actual, useEntries: () => mockUseEntries() };
});

// ── Subject under test ─────────────────────────────────────────────
// eslint-disable-next-line import/first
import ExpensesScreen from "../ExpensesScreen";

// ── Helpers ────────────────────────────────────────────────────────
function findText(root: renderer.ReactTestRenderer, text: string): any {
  const results = root.root.findAll(
    (node) => node.type === Text && node.props.children === text,
  );
  if (results.length === 0) throw new Error(`Text "${text}" not found`);
  return results[0];
}

// ── Before each ────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate = jest.fn();
  mockUseEntries = jest.fn().mockReturnValue({
    entries: [],
    isLoading: false,
    deleteEntry: jest.fn(),
    lastError: null,
    clearError: jest.fn(),
  });
});

// ── Tests ──────────────────────────────────────────────────────────

describe("ExpensesScreen add-entry FAB", () => {
  // ── 1. Empty state shows the FAB ─────────────────────────────────
  test("renders the add-entry FAB (+) when there are no expense entries", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ExpensesScreen />); });

    // Empty-state copy is present
    expect(findText(root, "No entries yet")).toBeTruthy();

    // The + button must exist below the copy
    expect(findText(root, "+")).toBeTruthy();
  });

  // ── 2. Tapping the FAB navigates to EntryForm (add/expense) ──────
  test("tapping the FAB navigates to EntryForm in add mode with type expense", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ExpensesScreen />); });

    const label = findText(root, "+");
    let node = label;
    while (node && typeof node.props?.onPress !== "function") {
      node = node.parent;
    }
    expect(node).toBeTruthy();

    act(() => { node.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith("EntryForm", {
      mode: "add",
      type: "expense",
    });
  });
});
