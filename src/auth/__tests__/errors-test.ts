// AUTH-03 error-mapping unit tests (01-02 Task 1, TDD RED).
// Firebase auth error codes -> locked UI copy. The mapper must never reveal
// whether the email exists (Email Enumeration Protection), never log, and
// never crash on non-Firebase input.
import { FirebaseError } from "firebase/app";
import { authErrorMessage } from "../errors";

const CREDENTIAL_COPY = "Email or password is wrong";
const DEFAULT_COPY = "Couldn't sign in. Check your connection and try again.";

describe("authErrorMessage", () => {
  it("maps auth/invalid-credential to the locked credential copy", () => {
    // Primary code under Email Enumeration Protection (modern projects)
    expect(
      authErrorMessage(
        new FirebaseError("auth/invalid-credential", "Invalid credential."),
      ),
    ).toBe(CREDENTIAL_COPY);
  });

  it("maps auth/wrong-password to the locked credential copy", () => {
    expect(
      authErrorMessage(
        new FirebaseError("auth/wrong-password", "The password is invalid."),
      ),
    ).toBe(CREDENTIAL_COPY);
  });

  it("maps auth/user-not-found to the locked credential copy", () => {
    expect(
      authErrorMessage(
        new FirebaseError("auth/user-not-found", "There is no user record."),
      ),
    ).toBe(CREDENTIAL_COPY);
  });

  it("maps auth/network-request-failed to the default copy", () => {
    expect(
      authErrorMessage(
        new FirebaseError("auth/network-request-failed", "A network error."),
      ),
    ).toBe(DEFAULT_COPY);
  });

  it.each(["auth/too-many-requests", "auth/invalid-email"])(
    "maps %s to the default copy",
    (code) => {
      expect(
        authErrorMessage(new FirebaseError(code, `error for ${code}`)),
      ).toBe(DEFAULT_COPY);
    },
  );

  it("maps non-Firebase input (Error, null, undefined) to the default copy — never crashes", () => {
    expect(authErrorMessage(new Error("boom"))).toBe(DEFAULT_COPY);
    expect(authErrorMessage(null)).toBe(DEFAULT_COPY);
    expect(authErrorMessage(undefined)).toBe(DEFAULT_COPY);
  });

  it("is pure — no console output", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      authErrorMessage(new FirebaseError("auth/invalid-credential", "bad"));
      authErrorMessage(new FirebaseError("auth/network-request-failed", "net"));
      authErrorMessage(new Error("boom"));
      authErrorMessage(null);
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
