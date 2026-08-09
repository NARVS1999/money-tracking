// HomeScreen component tests (home-add-entry-not-working debug session).
// Regression: the empty-state "Add an entry" CTA must navigate to the
// EntryForm screen — previously wired to a no-op (() => {}), so tapping
// it did nothing.
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

// ── Mock: CategoriesProvider ───────────────────────────────────────
let mockUseCategories: jest.Mock;

jest.mock("../../categories/CategoriesProvider", () => {
  const actual = jest.requireActual("../../categories/CategoriesProvider");
  return { ...actual, useCategories: () => mockUseCategories() };
});

// ── Subject under test ─────────────────────────────────────────────
// jest.mock must precede the import (hoisted) — eslint-disable the
// import ordering rule for this import.
// eslint-disable-next-line import/first
import HomeScreen from "../HomeScreen";

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
  });
  mockUseCategories = jest.fn().mockReturnValue({
    expenseCategories: [],
    incomeCategories: [],
  });
});

// ── Tests ──────────────────────────────────────────────────────────

describe("HomeScreen add-entry CTA", () => {
  // ── 1. Empty month shows the CTA ────────────────────────────────
  test("renders 'Add an entry' CTA when the month has no entries", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<HomeScreen />); });

    expect(findText(root, "Nothing logged this month")).toBeTruthy();
    expect(findText(root, "Add an entry")).toBeTruthy();
  });

  // ── 2. Tapping the CTA navigates to EntryForm (add/expense) ─────
  // Regression for home-add-entry-not-working: onAddPress was a no-op.
  test("tapping 'Add an entry' navigates to EntryForm in add mode", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<HomeScreen />); });

    // Locate the "Add an entry" label, then walk up to the nearest
    // ancestor exposing an onPress (the Pressable CTA).
    const label = findText(root, "Add an entry");
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
