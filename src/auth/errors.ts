// Firebase auth error -> locked UI copy mapper (AUTH-03).
// Modern projects fail with auth/invalid-credential for BOTH wrong email and
// wrong password (Email Enumeration Protection is on by default); legacy
// projects emit auth/wrong-password / auth/user-not-found. All three map to
// one copy that never reveals whether the email exists. Everything else
// (network, rate limit, malformed input, non-Firebase errors) gets the
// default copy. Pure function: no logging, no side effects — error internals
// never reach the console or the UI.
import { FirebaseError } from "firebase/app";

const CREDENTIAL_COPY = "Email or password is wrong";
const DEFAULT_COPY = "Couldn't sign in. Check your connection and try again.";

const CREDENTIAL_CODES = new Set([
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
]);

export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError && CREDENTIAL_CODES.has(error.code)) {
    return CREDENTIAL_COPY;
  }
  return DEFAULT_COPY;
}

const SIGNUP_COPY = {
  "auth/email-already-in-use": "An account with this email already exists",
  "auth/weak-password": "Password must be at least 6 characters",
  "auth/invalid-email": "Invalid email address",
};

export function signUpErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError && error.code in SIGNUP_COPY) {
    return SIGNUP_COPY[error.code as keyof typeof SIGNUP_COPY];
  }
  return DEFAULT_COPY;
}
