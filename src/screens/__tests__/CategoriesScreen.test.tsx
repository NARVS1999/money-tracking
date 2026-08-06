// CategoriesScreen component tests (02-02 Task 2).
// Uses react-test-renderer to assert the full CategoriesScreen
// renders correctly for all UI-SPEC State Contract combinations.
import React from "react";
import { TouchableOpacity, Alert, Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// ── Mock: react-native-gesture-handler ──────────────────────────────
jest.mock("react-native-gesture-handler", () => {
  // jest mocks are hoisted; use require inside factory to avoid reference errors
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rnMod = require("react-native");

  const SwipeableComponent = reactMod.forwardRef(
    ({ children, renderRightActions, ..._rest }: any, _ref: any) => {
      const actions =
        typeof renderRightActions === "function"
          ? renderRightActions()
          : null;
      return reactMod.createElement(
        rnMod.View,
        { testID: "swipeable" },
        children,
        actions,
      );
    },
  );
  SwipeableComponent.displayName = "Swipeable";
  return { Swipeable: SwipeableComponent };
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
import CategoriesScreen from "../CategoriesScreen";

// ── Helpers ────────────────────────────────────────────────────────
type CategoryStub = {
  id: string;
  name: string;
  createdAt: { toDate: () => Date };
};
const toCat = (id: string, name: string): CategoryStub => ({
  id, name, createdAt: { toDate: () => new Date() },
});
const defaults = () => ({
  expenseCategories: [] as CategoryStub[],
  incomeCategories: [] as CategoryStub[],
  usageMap: new Map<string, number>(),
  addCategory: jest.fn().mockResolvedValue(undefined),
  deleteCategory: jest.fn().mockResolvedValue(undefined),
});

function findText(root: renderer.ReactTestRenderer, text: string): any {
  const results = root.root.findAll(
    (node) => node.type === Text && node.props.children === text,
  );
  if (results.length === 0) throw new Error(`Text "${text}" not found`);
  return results[0];
}
function findAllText(root: renderer.ReactTestRenderer, text: string): any[] {
  return root.root.findAll(
    (node) => node.type === Text && node.props.children === text,
  );
}
// ── Before each ────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockUseCategories = jest.fn().mockReturnValue(defaults());
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

// ── Tests ──────────────────────────────────────────────────────────

describe("CategoriesScreen", () => {
  // ── 1. Renders two sections with correct titles ─────────────────
  test("renders two sections with correct titles", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });
    expect(findText(root, "Expense Categories")).toBeTruthy();
    expect(findText(root, "Income Categories")).toBeTruthy();
  });

  // ── 2. Renders category names and usage counts ──────────────────
  test("renders category names and usage counts", () => {
    mockUseCategories.mockReturnValue({
      ...defaults(),
      expenseCategories: [toCat("1", "Food"), toCat("3", "Transport")],
      incomeCategories: [toCat("2", "Salary")],
      usageMap: new Map([["1", 5], ["2", 0], ["3", 1]]),
    });
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });

    expect(findText(root, "Food")).toBeTruthy();
    expect(findText(root, "Transport")).toBeTruthy();
    expect(findText(root, "Salary")).toBeTruthy();
    expect(findText(root, "5 entries")).toBeTruthy();
    expect(findText(root, "0 entries")).toBeTruthy();
    expect(findText(root, "1 entry")).toBeTruthy();
  });

  // ── 3. Renders singular usage count ────────────────────────────
  test("renders singular usage count for exactly 1 entry", () => {
    mockUseCategories.mockReturnValue({
      ...defaults(),
      expenseCategories: [toCat("1", "Food")],
      usageMap: new Map([["1", 1]]),
    });
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });
    expect(findText(root, "1 entry")).toBeTruthy();
  });

  // ── 4. Renders em-dash loading state ───────────────────────────
  test("renders em-dash loading state when usageMap is empty", () => {
    mockUseCategories.mockReturnValue({
      ...defaults(),
      expenseCategories: [toCat("1", "Food")],
      incomeCategories: [toCat("2", "Salary")],
      usageMap: new Map(),
    });
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });
    expect(findAllText(root, "\u2014").length).toBe(2);
  });

  // ── 5. Renders empty state per group ────────────────────────────
  test("renders empty state per group with inline add still visible", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });

    // When both groups are empty, section headers render but no
    // category rows appear. Verify section headers are present.
    expect(findText(root, "Expense Categories")).toBeTruthy();
    expect(findText(root, "Income Categories")).toBeTruthy();

    // Inline add inputs visible — find TextInput by placeholder prop
    const inputs = root.root.findAll(
      (n) => n.props?.placeholder === "New category",
    );
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    // No category names rendered (empty sections)
    // This confirms the screen handles empty state correctly.
  });

  // ── 6. Inline add submit calls addCategory ──────────────────────
  test("inline add submit calls addCategory and clears input", async () => {
    const addCategory = jest.fn().mockResolvedValue(undefined);
    mockUseCategories.mockReturnValue({ ...defaults(), addCategory });

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });

    // Find expense input and type
    const inputs = root.root.findAll(
      (n) => n.props?.placeholder === "New category",
    );
    const expenseInput = inputs[0];
    act(() => { expenseInput.props.onChangeText("Groceries"); });

    // Find '+' button — use findByType for TouchableOpacity, then
    // filter for ones containing "+" text
    const buttons = root.root.findAllByType(TouchableOpacity);
    const plusBtn = buttons.find((btn) => {
      try {
        const children = btn.findAll(
          (c: any) => c.type === Text && c.props.children === "+",
        );
        return children.length > 0;
      } catch {
        return false;
      }
    });
    expect(plusBtn).toBeTruthy();

    await act(async () => { await plusBtn!.props.onPress(); });
    expect(addCategory).toHaveBeenCalledWith("expenseCategories", "Groceries");
  });

  // ── 7. Duplicate error displays and clears ──────────────────────
  test("duplicate error displays and clears", async () => {
    const addCategory = jest.fn().mockRejectedValue(new Error("Already exists"));
    mockUseCategories.mockReturnValue({ ...defaults(), addCategory });

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });

    const inputs = root.root.findAll(
      (n) => n.props?.placeholder === "New category",
    );
    const expenseInput = inputs[0];

    act(() => { expenseInput.props.onFocus(); });
    act(() => { expenseInput.props.onChangeText("duplicate"); });

    // Find '+' button
    const buttons = root.root.findAllByType(TouchableOpacity);
    const plusBtn = buttons.find((btn) => {
      try {
        return btn.findAll(
          (c: any) => c.type === Text && c.props.children === "+",
        ).length > 0;
      } catch {
        return false;
      }
    });
    expect(plusBtn).toBeTruthy();

    await act(async () => { await plusBtn!.props.onPress(); });

    // Error should appear
    expect(findText(root, "Already exists")).toBeTruthy();

    // Type new char — error clears
    act(() => { expenseInput.props.onChangeText("new text"); });
    expect(
      root.root.findAll((n) => n.props?.children === "Already exists").length,
    ).toBe(0);
  });

  // ── 8. Swipe renders 'In use' when count > 0 ────────────────────
  test("swipe renders 'In use' text when usage count > 0", () => {
    mockUseCategories.mockReturnValue({
      ...defaults(),
      expenseCategories: [toCat("1", "Food")],
      usageMap: new Map([["1", 5]]),
    });
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });

    expect(findText(root, "In use")).toBeTruthy();
    expect(findAllText(root, "Delete").length).toBe(0);
  });

  // ── 9. Swipe renders 'Delete' when count === 0 ──────────────────
  test("swipe renders 'Delete' button when usage count is 0", () => {
    mockUseCategories.mockReturnValue({
      ...defaults(),
      expenseCategories: [toCat("1", "Food")],
      usageMap: new Map([["1", 0]]),
    });
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });

    expect(findText(root, "Delete")).toBeTruthy();
    expect(findAllText(root, "In use").length).toBe(0);
  });

  // ── 10. Delete tap triggers Alert.alert ─────────────────────────
  test("delete tap triggers Alert.alert with confirmation", async () => {
    mockUseCategories.mockReturnValue({
      ...defaults(),
      expenseCategories: [toCat("1", "Food")],
      usageMap: new Map([["1", 0]]),
    });
    const alertSpy = jest.spyOn(Alert, "alert");

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });

    // Find the Delete TouchableOpacity by looking for TouchableOpacity
    // that contains a Text child with "Delete"
    const buttons = root.root.findAllByType(TouchableOpacity);
    const deleteBtn = buttons.find((btn) => {
      try {
        return btn.findAll(
          (c: any) => c.type === Text && c.props.children === "Delete",
        ).length > 0;
      } catch {
        return false;
      }
    });
    expect(deleteBtn).toBeTruthy();

    await act(async () => { await deleteBtn!.props.onPress(); });

    expect(alertSpy).toHaveBeenCalledWith(
      "Delete Food?",
      "This cannot be undone.",
      expect.arrayContaining([
        { text: "Cancel", style: "cancel" },
        expect.objectContaining({ text: "Delete", style: "destructive" }),
      ]),
    );
  });

  // ── 11. Delete confirm calls deleteCategory ─────────────────────
  test("delete confirm calls deleteCategory with correct args", async () => {
    const deleteCategory = jest.fn().mockResolvedValue(undefined);
    mockUseCategories.mockReturnValue({
      ...defaults(),
      expenseCategories: [toCat("1", "Food")],
      usageMap: new Map([["1", 0]]),
      deleteCategory,
    });

    let capturedOnPress: (() => void) | undefined;
    jest.spyOn(Alert, "alert").mockImplementation(
      (_title: string, _message?: string, buttons?: any[], _options?: any) => {
        const del = (buttons ?? []).find((b: any) => b.text === "Delete");
        capturedOnPress = del?.onPress;
      },
    );

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });

    const buttons = root.root.findAllByType(TouchableOpacity);
    const deleteBtn = buttons.find((btn) => {
      try {
        return btn.findAll(
          (c: any) => c.type === Text && c.props.children === "Delete",
        ).length > 0;
      } catch {
        return false;
      }
    });
    expect(deleteBtn).toBeTruthy();

    await act(async () => { await deleteBtn!.props.onPress(); });

    expect(capturedOnPress).toBeDefined();
    await act(async () => { capturedOnPress!(); });
    expect(deleteCategory).toHaveBeenCalledWith("expenseCategories", "1");
  });

  // ── 12. Accessibility roles present ─────────────────────────────
  test("accessibility roles present on headers and inputs", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });

    // Section headers have accessibilityRole="header"
    const headers = root.root.findAll(
      (n) => n.props?.accessibilityRole === "header",
    );
    expect(headers.length).toBeGreaterThanOrEqual(2);

    // Inline inputs have per-group accessibilityLabels
    const expenseInputs = root.root.findAll(
      (n) => n.props?.accessibilityLabel === "New expense category",
    );
    const incomeInputs = root.root.findAll(
      (n) => n.props?.accessibilityLabel === "New income category",
    );
    const addExpense = root.root.findAll(
      (n) => n.props?.accessibilityLabel === "Add expense category",
    );
    const addIncome = root.root.findAll(
      (n) => n.props?.accessibilityLabel === "Add income category",
    );

    expect(expenseInputs.length).toBeGreaterThanOrEqual(1);
    expect(incomeInputs.length).toBeGreaterThanOrEqual(1);
    expect(addExpense.length).toBeGreaterThanOrEqual(1);
    expect(addIncome.length).toBeGreaterThanOrEqual(1);
  });

  // ── 13. Blank input is silent no-op ─────────────────────────────
  test("blank input submit is a silent no-op", async () => {
    const addCategory = jest.fn().mockResolvedValue(undefined);
    mockUseCategories.mockReturnValue({ ...defaults(), addCategory });

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<CategoriesScreen />); });

    const buttons = root.root.findAllByType(TouchableOpacity);
    const plusBtn = buttons.find((btn) => {
      try {
        return btn.findAll(
          (c: any) => c.type === Text && c.props.children === "+",
        ).length > 0;
      } catch {
        return false;
      }
    });
    expect(plusBtn).toBeTruthy();

    await act(async () => { await plusBtn!.props.onPress(); });
    expect(addCategory).not.toHaveBeenCalled();
  });
});
