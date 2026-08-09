/**
 * TDD RED test for the home-add-entry-not-working debug session
 * (round 3: "Save failed. Please try again.").
 *
 * Root cause hypothesis: firestore.rules + backend-schema.md require the
 * entries create payload to carry `amountCents` (integer cents, WR-04 —
 * `request.resource.data.amountCents is int`), but EntriesProvider writes
 * `amount`. Every addDoc is denied by the rules, so saving any entry fails
 * with permission-denied (surfaced as the generic "Save failed" alert).
 *
 * This test asserts the write contract: the addDoc payload MUST include
 * `amountCents` (the schema/rules field) and MUST NOT write `amount`.
 * RED until addEntry/copyEntry are fixed.
 */
import React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be BEFORE any imports of the module under test
// ---------------------------------------------------------------------------

const mockAddDoc = jest.fn().mockResolvedValue({ id: "new-entry-id" });
const entryDoc = {
  id: "seed-id",
  data: () => ({
    uid: "user-1",
    type: "expense",
    amountCents: 2450,
    categoryId: "cat-1",
    date: "2026-08-09",
    description: "Coffee",
    createdAt: { seconds: 0, nanos: 0 },
  }),
};
const mockGetDocs = jest.fn().mockResolvedValue({ docs: [entryDoc] });

jest.mock("firebase/firestore", () => {
  class MockTimestamp {
    seconds: number;
    nanos: number;
    constructor(seconds: number, nanos: number) {
      this.seconds = seconds;
      this.nanos = nanos;
    }
    static now() {
      return new MockTimestamp(0, 0);
    }
  }
  return {
    collection: (_db: any, path: string) => ({ _tag: path }),
    doc: (_db: any, ...segments: string[]) => ({ _tag: segments.join("/") }),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    getDoc: jest.fn(),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    deleteDoc: jest.fn(),
    updateDoc: jest.fn(),
    query: (_q: any) => ({ _tag: "query" }),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    Timestamp: MockTimestamp,
    initializeFirestore: jest.fn(() => ({ _tag: "db" })),
  };
});

jest.mock("@firebase/auth", () => ({
  initializeAuth: jest.fn(() => ({ _tag: "auth" })),
  getReactNativePersistence: jest.fn(() => ({ _tag: "persistence" })),
  onAuthStateChanged: jest.fn((_auth: any, _cb: any) => jest.fn()),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  EmailAuthProvider: { credential: jest.fn() },
  reauthenticateWithCredential: jest.fn(),
  signOut: jest.fn(),
  deleteUser: jest.fn(),
}));

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({ name: "mock" })),
}));

jest.mock("../../firebase/config", () => ({ firebaseConfig: {} }));

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "user-1" } }),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
// eslint-disable-next-line import/first
import { EntriesProvider, useEntries } from "../EntriesProvider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Object holder (not a bare variable) so the React purity lint rule doesn't
// flag the capture assignment — mirrors signup-users-doc-test's pattern.
const captured = { latestEntries: null as ReturnType<typeof useEntries> | null };

function Capture() {
  // Test capture pattern (same as signup-users-doc-test.tsx): writing the
  // context snapshot to a holder during render is intentional in tests.
  // eslint-disable-next-line react-hooks/immutability
  captured.latestEntries = useEntries();
  return <Text>ok</Text>;
}

// NOTE: async act() hangs in this jest-expo/React-19 environment when a
// mounted provider has an in-flight effect promise chain. addDoc/addEntry
// call the mocked addDoc SYNCHRONOUSLY, so the payload is assertable without
// awaiting through act — flush with a macrotask + sync act instead.
function mount() {
  let root: any;
  act(() => {
    root = renderer.create(
      <EntriesProvider>
        <Capture />
      </EntriesProvider>,
    );
  });
  return root;
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  act(() => {});
}

function entries(): NonNullable<typeof captured.latestEntries> {
  if (!captured.latestEntries) throw new Error("Entries context not captured");
  return captured.latestEntries;
}

const sampleInput = {
  type: "expense" as const,
  amount: 2450,
  categoryId: "cat-1",
  date: "2026-08-09",
  description: "Coffee",
};

beforeEach(() => {
  jest.clearAllMocks();
  captured.latestEntries = null;
  mockAddDoc.mockResolvedValue({ id: "new-entry-id" });
  mockGetDocs.mockResolvedValue({ docs: [entryDoc] });
});

describe("EntriesProvider write contract (amountCents)", () => {
  it("writes amountCents (schema/rules field) — not amount — on addEntry", async () => {
    mount();

    // addDoc is called synchronously inside addEntry — assert payload
    // immediately, then settle the promise outside act.
    const pending = entries().addEntry(sampleInput);
    await flush();

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [collRef, payload] = mockAddDoc.mock.calls[0];

    // entries collection
    expect(collRef._tag).toBe("entries");

    // Rules: request.resource.data.amountCents is int — MUST be present
    expect(payload.amountCents).toBe(2450);
    expect(typeof payload.amountCents).toBe("number");

    // The nonconforming field must not be written
    expect(payload.amount).toBeUndefined();

    await pending;
  });

  it("writes amountCents — not amount — on copyEntry", async () => {
    mount();
    // Seed local state from the mocked initial load
    await flush();

    mockAddDoc.mockClear();

    const pending = entries().copyEntry("seed-id");
    await flush();

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.amountCents).toBe(2450);
    expect(payload.amount).toBeUndefined();

    await pending;
  });
});
