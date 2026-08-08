// AccountScreen component tests (safeareaview-deprecated debug session).
// Verifies the screen renders via SafeAreaView from react-native-safe-area-context
// instead of the deprecated react-native SafeAreaView, which logs a WARN at
// runtime and will be removed in a future release.
import React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// ── Mock: react-native-safe-area-context ──────────────────────────
jest.mock("react-native-safe-area-context", () => {
  // jest mocks are hoisted; use require inside factory to avoid reference errors
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");

  const SafeAreaView = (props: any) => ReactMod.createElement(View, props);
  return {
    SafeAreaView,
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// ── Mock: AuthProvider ───────────────────────────────────────────
let mockUseAuth: jest.Mock;

jest.mock("../../auth/AuthProvider", () => {
  const actual = jest.requireActual("../../auth/AuthProvider");
  return { ...actual, useAuth: () => mockUseAuth() };
});

// ── Subject under test ─────────────────────────────────────────────
// jest.mock must precede the import (hoisted) — eslint-disable the
// import ordering rule for this import.
// eslint-disable-next-line import/first
import AccountScreen from "../AccountScreen";

// ── References to the two SafeAreaView variants ────────────────────
// Reading react-native's SafeAreaView getter emits the one-time
// deprecation WARN, so capture it once with console.warn suppressed.
let RNSafeAreaView: unknown;
let SafeAreaViewSASC: unknown;

beforeAll(() => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RNSafeAreaView = require("react-native").SafeAreaView;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaViewSASC = require("react-native-safe-area-context").SafeAreaView;
  warnSpy.mockRestore();
});

// ── Before each ────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth = jest.fn().mockReturnValue({
    userProfile: {
      displayName: "Test User",
      email: "test@example.com",
      isDefault: true,
    },
    signOut: jest.fn().mockResolvedValue(undefined),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
    isOnline: true,
  });
});

// ── Tests ──────────────────────────────────────────────────────────
describe("AccountScreen safe-area migration", () => {
  // ── 1. Uses safe-area-context SafeAreaView ──────────────────────
  test("renders via SafeAreaView from react-native-safe-area-context", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<AccountScreen />); });

    const sascSafeAreas = root.root.findAll(
      (n) => n.type === SafeAreaViewSASC,
    );
    expect(sascSafeAreas.length).toBe(1);
  });

  // ── 2. Does not use the deprecated react-native SafeAreaView ────
  test("does not render the deprecated react-native SafeAreaView", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<AccountScreen />); });

    const rnSafeAreas = root.root.findAll(
      (n) => n.type === RNSafeAreaView,
    );
    expect(rnSafeAreas.length).toBe(0);
  });

  // ── 3. Profile content still renders after migration ────────────
  test("still renders profile content after migration", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<AccountScreen />); });

    const texts = root.root.findAll(
      (n) => n.type === Text && n.props.children === "test@example.com",
    );
    expect(texts.length).toBeGreaterThanOrEqual(1);
  });
});
