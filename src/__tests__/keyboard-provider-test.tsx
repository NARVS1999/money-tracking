/**
 * TDD RED test for the home-add-entry-not-working debug session
 * (round 3: WARN "Couldn't find real values for KeyboardContext").
 *
 * Root cause hypothesis: react-native-keyboard-controller requires a
 * KeyboardProvider ancestor for KeyboardAwareScrollView (and its keyboard
 * tracking) to work — App.tsx never mounts one, so every render of the
 * entry form logs the WARN and keyboard-aware behavior is degraded.
 *
 * This test asserts App mounts KeyboardProvider. RED until App.tsx is fixed.
 */
import React from "react";
import renderer, { act } from "react-test-renderer";

// ── Mock: react-native-safe-area-context ──────────────────────────
jest.mock("react-native-safe-area-context", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  const SafeAreaProvider = ({ children }: any) => children;
  const SafeAreaView = (props: any) =>
    ReactMod.createElement("View", props);
  return { SafeAreaProvider, SafeAreaView, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

// ── Mock: react-native-gesture-handler ────────────────────────────
jest.mock("react-native-gesture-handler", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  const GestureHandlerRootView = ({ children }: any) => children;
  const Swipeable = ReactMod.forwardRef(({ children, renderRightActions }: any, _ref: any) => {
    const actions = typeof renderRightActions === "function" ? renderRightActions() : null;
    return ReactMod.createElement("View", null, children, actions);
  });
  Swipeable.displayName = "Swipeable";
  return { GestureHandlerRootView, Swipeable };
});

// ── Mock: expo-status-bar ─────────────────────────────────────────
jest.mock("expo-status-bar", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement } = require("react");
  const StatusBar = () => createElement("View", null);
  return { StatusBar };
});

// ── Mock: AuthProvider (initializing — RootNavigator shows LoadingScreen,
// avoiding the full navigation tree in this test) ─────────────────
jest.mock("../auth/AuthProvider", () => {
  const AuthProvider = ({ children }: any) => children;
  return {
    AuthProvider,
    useAuth: () => ({ user: null, initializing: true }),
  };
});

// ── Mock: EntriesProvider ─────────────────────────────────────────
jest.mock("../entries/EntriesProvider", () => {
  const EntriesProvider = ({ children }: any) => children;
  return { EntriesProvider, useEntries: () => ({ entries: [], isLoading: false }) };
});

// ── Mock: CategoriesProvider ──────────────────────────────────────
jest.mock("../categories/CategoriesProvider", () => {
  const CategoriesProvider = ({ children }: any) => children;
  return { CategoriesProvider, useCategories: () => ({ expenseCategories: [], incomeCategories: [] }) };
});

// ── Mock: react-native-keyboard-controller ────────────────────────
// The jest/index.js mock exports KeyboardProvider as a string host
// component — findable via type === "KeyboardProvider".
jest.mock("react-native-keyboard-controller", () => ({
  KeyboardProvider: "KeyboardProvider",
  KeyboardAwareScrollView: "KeyboardAwareScrollView",
}));

// ── Subject under test ─────────────────────────────────────────────
// eslint-disable-next-line import/first
import App from "../../App";

describe("App keyboard provider", () => {
  it("mounts KeyboardProvider for react-native-keyboard-controller", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<App />); });

    const providers = root.root.findAll(
      (n) => n.type === ("KeyboardProvider" as unknown),
    );
    expect(providers.length).toBeGreaterThanOrEqual(1);
  });
});
