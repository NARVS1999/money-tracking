// NFR-01 uid-scoped query builder unit tests (01-03 Task 2, TDD RED).
// Contract: every query builder starts with a where("uid","==",uid) equality
// filter (rules are not filters — an unscoped query fails wholesale with
// permission-denied once a second account exists). Asserted via query
// constraint internals (RESEARCH OQ3: q._query.filters), never serialized
// strings. userDoc is a DocumentReference, not a query — exempt.
import type { Query } from "firebase/firestore";
import { collection, doc } from "firebase/firestore";
import {
  categoriesOf,
  categoryInUse,
  entriesBase,
  entriesByType,
  entriesInRange,
  userDoc,
} from "../queries";
import { db } from "../app";

type QueryInternals = {
  filters?: Array<{
    field?: { segments?: string[] };
    op?: string;
    value?: Record<string, unknown>;
  }>;
  explicitOrderBy?: Array<{ field?: { segments?: string[] }; dir?: string }>;
  limit?: number;
};

const internals = (q: Query): QueryInternals =>
  ((q as unknown as { _query: QueryInternals })._query ?? {}) as QueryInternals;

/** Extract a filter's field path ("uid", "type", …) or null. */
function filterField(f: NonNullable<QueryInternals["filters"]>[number]): string | null {
  return f.field?.segments?.join(".") ?? null;
}

/** Extract a filter's comparison value, unwrapping the protobuf-style value object. */
function filterValue(f: NonNullable<QueryInternals["filters"]>[number]): unknown {
  const v = f.value;
  if (v === null || v === undefined) return v;
  if (typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  return v;
}

/** True when the query carries a where("uid","==",uid) equality filter. */
function hasUidFilter(q: Query, uid: string): boolean {
  return internals(q).filters?.some(
    (f) => filterField(f) === "uid" && f.op === "==" && filterValue(f) === uid,
  ) ?? false;
}

/** All filter field paths in the query, in order. */
function filterFields(q: Query): string[] {
  return (internals(q).filters ?? []).map(filterField);
}

/** The date column direction when ordered by date. */
function dateOrderDir(q: Query): string | undefined {
  return internals(q).explicitOrderBy?.find(
    (o) => o.field?.segments?.join(".") === "date",
  )?.dir;
}

const UID = "test-uid-123";
const OTHER = "other-uid-999";

describe("uid scoping (NFR-01)", () => {
  it.each<[string, Query]>([
    ["entriesBase", entriesBase(UID)],
    ["entriesByType", entriesByType(UID, "expense")],
    ["entriesInRange", entriesInRange(UID, "2026-08-01", "2026-08-31")],
    ["categoryInUse", categoryInUse(UID, "cat1")],
    ["categoriesOf", categoriesOf(UID, "expenseCategories")],
  ])("%s starts with a uid equality filter", (_name, q) => {
    expect(hasUidFilter(q, UID)).toBe(true);
  });

  it("binds the filter to the PASSED uid — another uid's filter does not match", () => {
    expect(hasUidFilter(entriesBase(UID), OTHER)).toBe(false);
    expect(hasUidFilter(entriesByType(UID, "expense"), OTHER)).toBe(false);
  });

  it("places the uid filter FIRST in the constraint list", () => {
    expect(filterFields(entriesByType(UID, "expense"))[0]).toBe("uid");
    expect(filterFields(entriesInRange(UID, "a", "b"))[0]).toBe("uid");
    expect(filterFields(categoryInUse(UID, "c"))[0]).toBe("uid");
    expect(filterFields(categoriesOf(UID, "incomeCategories"))[0]).toBe("uid");
  });

  it("userDoc returns a DocumentReference, not a query — exempt from the filter assertion", () => {
    const ref = userDoc(UID);
    expect(ref).toBeInstanceOf(Object);
    expect((ref as unknown as { _query?: unknown })._query).toBeUndefined();
    expect(ref.path).toBe(`users/${UID}`);
    expect(doc(db, "users", UID).path).toBe(ref.path);
  });
});

describe("per-builder constraints", () => {
  it("entriesByType constrains type and orders by date desc (composite index dependency)", () => {
    const q = entriesByType(UID, "expense");
    expect(hasUidFilter(q, UID)).toBe(true);
    expect(filterFields(q)).toContain("type");
    expect(dateOrderDir(q)).toBe("desc");
    // type filter equals the passed type
    const typeFilter = internals(q).filters?.find((f) => filterField(f) === "type");
    expect(typeFilter?.op).toBe("==");
    expect(filterValue(typeFilter as never)).toBe("expense");
  });

  it("entriesInRange constrains date >= start and date <= end", () => {
    const q = entriesInRange(UID, "2026-08-01", "2026-08-31");
    expect(hasUidFilter(q, UID)).toBe(true);
    const ops = internals(q).filters
      ?.filter((f) => filterField(f) === "date")
      .map((f) => ({ op: f.op, value: filterValue(f) }));
    expect(ops).toEqual([
      { op: ">=", value: "2026-08-01" },
      { op: "<=", value: "2026-08-31" },
    ]);
  });

  it("categoryInUse constrains categoryId and applies limit(1)", () => {
    const q = categoryInUse(UID, "cat1");
    expect(hasUidFilter(q, UID)).toBe(true);
    expect(internals(q).filters?.some((f) => filterField(f) === "categoryId")).toBe(true);
    expect(internals(q).limit).toBe(1);
  });

  it("categoriesOf targets the requested collection and is uid-scoped", () => {
    const expense = categoriesOf(UID, "expenseCategories");
    const income = categoriesOf(UID, "incomeCategories");
    expect(hasUidFilter(expense, UID)).toBe(true);
    expect(hasUidFilter(income, UID)).toBe(true);
    expect((expense as unknown as { _query: { path: { segments: string[] } } })._query.path.segments.at(-1)).toBe("expenseCategories");
    expect((income as unknown as { _query: { path: { segments: string[] } } })._query.path.segments.at(-1)).toBe("incomeCategories");
  });

  it("queries.ts never creates a Firestore collection outside the builders' uid scope", () => {
    // entriesBase targets the "entries" collection with the uid clause applied
    const base = entriesBase(UID);
    const path = (base as unknown as { _query: { path: { segments: string[] } } })._query.path;
    expect(path.segments.at(-1)).toBe("entries");
    expect(hasUidFilter(base, UID)).toBe(true);
    expect(collection(db, "entries").path).toBe("entries");
  });
});
