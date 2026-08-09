/**
 * TDD RED test for the permission-denied debug session
 * (firestore-permission-denied).
 *
 * Root cause hypothesis: the users/{uid} read rule
 * (`resource.data.uid == request.auth.uid`) always denies because no writer
 * ever sets the schema-required `uid` field (backend-schema.md: `uid` string
 * REQUIRED) on the users doc. signUp today writes { displayName, email,
 * isDefault, createdAt } only — missing `uid` — and tech-design.md's seed step
 * also omits it, so even the seeded default account fails every read, surfaced
 * by the phase-06 uncaught isOnline onSnapshot.
 *
 * This test asserts the write contract: the users doc payload MUST include
 * `uid` equal to the auth user's uid. RED until signUp is fixed.
 */
import React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be BEFORE any imports of the module under test
// ---------------------------------------------------------------------------

let onAuthStateChangedCb: ((u: any) => void) | null = null;
const mockCreateUser = jest.fn().mockResolvedValue({
  user: { uid: "new-user-uid", email: "new@example.com" },
});
const mockSetDoc = jest.fn().mockResolvedValue(undefined);

jest.mock("@firebase/auth", () => ({
  initializeAuth: jest.fn(() => ({ _tag: "auth" })),
  getReactNativePersistence: jest.fn(() => ({ _tag: "persistence" })),
  onAuthStateChanged: jest.fn((_auth: any, cb: (u: any) => void) => {
    onAuthStateChangedCb = cb;
    return jest.fn();
  }),
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUser(...args),
  signInWithEmailAndPassword: jest.fn(),
  EmailAuthProvider: { credential: jest.fn() },
  reauthenticateWithCredential: jest.fn(),
  signOut: jest.fn(),
  deleteUser: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: (_db: any, path: string) => ({ _tag: path }),
  doc: (_db: any, ...segments: string[]) => ({ _tag: segments.join("/") }),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  deleteDoc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanos: 0 }) },
  initializeFirestore: jest.fn(() => ({ _tag: "db" })),
}));

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({ name: "mock" })),
}));

jest.mock("../../firebase/config", () => ({ firebaseConfig: {} }));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { AuthProvider, useAuth } from "../AuthProvider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let latestAuth: ReturnType<typeof useAuth> | null = null;

function AuthCapture() {
  latestAuth = useAuth();
  return <Text>ok</Text>;
}

function mount() {
  let root: any;
  act(() => {
    root = renderer.create(
      <AuthProvider>
        <AuthCapture />
      </AuthProvider>,
    );
  });
  return root;
}

function auth(): NonNullable<typeof latestAuth> {
  if (!latestAuth) throw new Error("Auth context not captured");
  return latestAuth;
}

beforeEach(() => {
  jest.clearAllMocks();
  onAuthStateChangedCb = null;
  latestAuth = null;
  mockCreateUser.mockResolvedValue({
    user: { uid: "new-user-uid", email: "new@example.com" },
  });
});

describe("signUp users doc write contract", () => {
  it("writes a users doc containing the schema-required uid field", async () => {
    mount();

    await act(async () => {
      await auth().signUp("New User", "new@example.com", "password123");
    });

    // setDoc(doc(db, "users", uid), payload)
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [docRef, payload] = mockSetDoc.mock.calls[0];

    // users/{uid} document reference points at the auth user's uid
    expect(docRef._tag).toBe("users/new-user-uid");

    // The rules + schema (backend-schema.md) require users.uid == auth.uid.
    // Missing field => resource.data.uid undefined => permission-denied.
    expect(payload.uid).toBe("new-user-uid");
  });
});