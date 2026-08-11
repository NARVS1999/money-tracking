// jest/firestore-mock.ts — in-memory Firestore mock for sync-service tests.
// Emulates the small surface src/sync/syncService.ts uses:
//   - collection / doc / query / where: ref-building passthroughs
//   - addDoc: auto-id create into a per-collection store
//   - setDoc: upsert by id
//   - deleteDoc: delete by id
//   - getDocs: reads with a minimal filter matcher (uid == and updatedAt >
//     comparisons on MockTimestamp values — enough for the pull query)
//   - Timestamp: ms-round-trippable class (toMillis), so LWW comparisons in
//     the service work against real values
// The store is module-level and shared; call resetFsMock() in beforeEach.
// fsStore exposes the raw store for seeding cloud state in tests.

export type FsQuery = {
  _coll: string;
  filters: Array<{ field: string; op: string; value: unknown }>;
};

export const fsStore: Record<string, Map<string, Record<string, unknown>>> = {};

let docCounter = 0;

export function resetFsMock(): void {
  for (const key of Object.keys(fsStore)) delete fsStore[key];
  docCounter = 0;
}

function coll(name: string): Map<string, Record<string, unknown>> {
  if (!fsStore[name]) fsStore[name] = new Map();
  return fsStore[name];
}

// Prototype-based on purpose (same note as seed-test.ts): babel-plugin-
// jest-hoist rejects class parameter properties inside jest.mock factories,
// and `new Timestamp(x)` must satisfy `value instanceof Timestamp` checks in
// the sync service (LWW comparisons).
export function MockTimestamp(this: { seconds: number; nanoseconds: number; ms: number }, seconds: number, nanoseconds: number) {
  this.seconds = seconds;
  this.nanoseconds = nanoseconds;
  this.ms = seconds * 1000 + Math.floor(nanoseconds / 1e6);
}
MockTimestamp.prototype.toMillis = function toMillis(this: { ms: number }) {
  return this.ms;
};
MockTimestamp.now = function now() {
  const t = Date.now();
  return new (MockTimestamp as unknown as new (s: number, n: number) => { ms: number })(Math.floor(t / 1000), (t % 1000) * 1e6);
};
MockTimestamp.prototype.constructor = MockTimestamp;

// Consumers import { Timestamp } from "firebase/firestore" — alias the mock
// under the canonical name so `instanceof` checks in the sync service see the
// same constructor that test fixtures construct with.
export const Timestamp = MockTimestamp;

function tsOf(value: unknown): number | undefined {
  return (value as { toMillis?: () => number })?.toMillis?.();
}

function matches(
  data: Record<string, unknown>,
  filters: Array<{ field: string; op: string; value: unknown }>,
): boolean {
  return filters.every(({ field, op, value }) => {
    const actual = data[field];
    if (op === "==") return actual === value;
    if (op === ">") {
      const a = tsOf(actual) ?? (typeof actual === "number" ? actual : undefined);
      const b = tsOf(value) ?? (typeof value === "number" ? value : undefined);
      return typeof a === "number" && typeof b === "number" && a > b;
    }
    if (op === ">=") {
      const a = tsOf(actual) ?? (typeof actual === "number" ? actual : undefined);
      const b = tsOf(value) ?? (typeof value === "number" ? value : undefined);
      return typeof a === "number" && typeof b === "number" && a >= b;
    }
    return false;
  });
}

// --- API surface consumed by src/firebase/app.ts, queries.ts, syncService.ts

export const collection = jest.fn(
  (_db: unknown, name: string) => ({ _coll: name }),
);

export const doc = jest.fn(
  (_db: unknown, name: string, id: string) => ({ _coll: name, id }),
);

export const where = jest.fn(
  (field: string, op: string, value: unknown) => ({ field, op, value }),
);

export const query = jest.fn((...args: unknown[]): FsQuery => {
  const base =
    args[0] && typeof args[0] === "object" && "_coll" in (args[0] as object)
      ? (args[0] as FsQuery)
      : { _coll: (args[0] as { _coll: string })._coll, filters: [] as Array<{ field: string; op: string; value: unknown }> };
  const filters = [...(base.filters ?? [])];
  for (const arg of args.slice(1)) {
    if (arg && typeof arg === "object" && "field" in (arg as object)) {
      filters.push(arg as { field: string; op: string; value: unknown });
    }
  }
  return { _coll: base._coll, filters };
});

export const addDoc = jest.fn(
  async (ref: { _coll: string }, data: Record<string, unknown>) => {
    docCounter += 1;
    const id = `fs-${docCounter}`;
    coll(ref._coll).set(id, data);
    return { id };
  },
);

export const setDoc = jest.fn(
  async (ref: { _coll: string; id: string }, data: Record<string, unknown>) => {
    coll(ref._coll).set(ref.id, data);
  },
);

export const deleteDoc = jest.fn(
  async (ref: { _coll: string; id: string }) => {
    coll(ref._coll).delete(ref.id);
  },
);

export const getDocs = jest.fn(async (q: FsQuery) => {
  const rows = [...coll(q._coll).entries()]
    .filter(([, data]) => matches(data, q.filters ?? []))
    .map(([id, data]) => ({ id, data: () => data }));
  return { docs: rows };
});

export const initializeFirestore = jest.fn(() => ({ _tag: "db" }));
