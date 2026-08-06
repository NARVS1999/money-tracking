// Wave 0 smoke test (01-01 Task 3): imports the App module graph (exercises
// src/firebase/app.ts module-load init under jest-expo mocks, including the
// @firebase/auth RN build + AsyncStorage persistence wiring) and locks the
// theme token contract. No render — component testing is deferred.
import App from "../../App";
import { colors } from "../theme/tokens";

describe("App module", () => {
  it("loads the app component as a function", () => {
    expect(typeof App).toBe("function");
  });
});

describe("theme tokens", () => {
  it("locks the background color contract", () => {
    expect(colors.background).toBe("#F7F7F8");
  });

  it("exposes the full token surface", () => {
    expect(colors.surface).toBe("#FFFFFF");
    expect(colors.textPrimary).toBe("#1A1A1A");
    expect(colors.accent).toBe("#111827");
  });
});
