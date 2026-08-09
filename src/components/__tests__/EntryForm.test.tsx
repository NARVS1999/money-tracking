// EntryForm component tests (home-add-entry-not-working debug session).
// Regression: (1) the form header must respect the top safe area (Cancel/Save
// were rendering under the status bar/notch); (2) the amount display must be
// tappable to re-focus the hidden amount TextInput once the keyboard is gone.
import React from "react";
import { Text, TextInput } from "react-native";
import renderer, { act } from "react-test-renderer";

// ── Mock: react-native-safe-area-context ──────────────────────────
jest.mock("react-native-safe-area-context", () => {
  // jest mocks are hoisted; use require inside factory to avoid reference errors
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");

  const SafeAreaView = (props: any) => ReactMod.createElement(RNView, props);
  return {
    SafeAreaView,
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// ── Mock: react-native-keyboard-controller ─────────────────────────
jest.mock("react-native-keyboard-controller", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  const KeyboardAwareScrollView = ({ children, ...rest }: any) =>
    ReactMod.createElement(RNView, rest, children);
  return { KeyboardAwareScrollView };
});

// ── Mock: @react-native-community/datetimepicker ───────────────────
jest.mock("@react-native-community/datetimepicker", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  const DateTimePicker = (props: any) => ReactMod.createElement(RNView, props);
  return { __esModule: true, default: DateTimePicker };
});

// ── Mock: useNavigation / useRoute ─────────────────────────────────
let mockNavigate: jest.Mock;
let mockGoBack: jest.Mock;

jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native");
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: { mode: "add", type: "expense" },
    }),
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
import EntryForm from "../EntryForm";

// ── References ─────────────────────────────────────────────────────
let SafeAreaViewSASC: unknown;

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaViewSASC = require("react-native-safe-area-context").SafeAreaView;
});

// ── Before each ────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate = jest.fn();
  mockGoBack = jest.fn();
  mockUseEntries = jest.fn().mockReturnValue({
    entries: [],
    isLoading: false,
    addEntry: jest.fn().mockResolvedValue(undefined),
    updateEntry: jest.fn().mockResolvedValue(undefined),
  });
  mockUseCategories = jest.fn().mockReturnValue({
    expenseCategories: [],
    incomeCategories: [],
  });
});

// ── Tests ──────────────────────────────────────────────────────────

describe("EntryForm safe area and amount interaction", () => {
  // ── 1. Header respects top safe area via SafeAreaView ───────────
  test("renders via SafeAreaView from react-native-safe-area-context", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EntryForm />); });

    const sascSafeAreas = root.root.findAll(
      (n) => n.type === SafeAreaViewSASC,
    );
    expect(sascSafeAreas.length).toBeGreaterThanOrEqual(1);
  });

  // ── 2. Tapping the amount display re-focuses the amount input ───
  // Regression: amountContainer was a plain View — once the keyboard
  // dismissed, tapping the number did nothing (hidden input had no way
  // to be re-focused).
  test("tapping the amount display focuses the hidden amount TextInput", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EntryForm />); });

    // Locate the amount display (large tabular-nums text) and walk up
    // to the nearest ancestor with an onPress (the tappable wrapper).
    const displays = root.root.findAll(
      (n) => n.type === Text && n.props.style?.fontSize === 44,
    );
    expect(displays.length).toBeGreaterThanOrEqual(1);

    let node: renderer.ReactTestInstance | null = displays[0];
    while (node && typeof node.props?.onPress !== "function") {
      node = node.parent;
    }
    expect(node).toBeTruthy();

    // Spy on the hidden amount TextInput's focus() via its ref instance.
    const hiddenInput = root.root.findAll(
      (n) => n.type === TextInput && n.props.keyboardType === "decimal-pad",
    );
    expect(hiddenInput.length).toBe(1);

    // The ref target exposes focus; capture the spy.
    const focusSpy = jest.spyOn(hiddenInput[0].instance, "focus");

    act(() => { node!.props.onPress(); });
    expect(focusSpy).toHaveBeenCalled();
  });

  // ── 3. Hidden amount input has a real (non-zero) size ──────────
  // Regression: the hidden TextInput was 0x0 (height/width 0). On Android,
  // programmatic focus() on a zero-size input stops working after a few
  // show/dismiss cycles — matching "can click it twice, third time no".
  test("hidden amount TextInput has non-zero size so focus keeps working", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EntryForm />); });

    const hiddenInput = root.root.findAll(
      (n) => n.type === TextInput && n.props.keyboardType === "decimal-pad",
    );
    expect(hiddenInput.length).toBe(1);

    const style = hiddenInput[0].props.style ?? {};
    expect(style.height).toBeGreaterThan(0);
    expect(style.width).toBeGreaterThan(0);
  });
});
