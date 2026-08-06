// NFR-01 uid-scoped query builders (01-RESEARCH.md Pattern 3, lines 305-317;
// Code Examples lines 466-482). Rules are not filters: an unscoped query can
// match another user's doc and the WHOLE query is rejected with
// permission-denied once a second account exists (Pitfall 7). Every builder
// therefore starts from where("uid","==",uid) — the uid clause is
// non-negotiable and first. Later phases must construct queries ONLY here.
import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./app"; // never initializeFirestore here — singleton lives in app.ts
import { compare, isValid } from "../lib/dates";

export const userDoc = (uid: string) => doc(db, "users", uid);

export const entriesBase = (uid: string) =>
  query(collection(db, "entries"), where("uid", "==", uid));

// Requires the composite index `entries: uid ASC, type ASC, date DESC`
// (deploy/composite-index.md). If the index is missing, this query errors
// with a console link to create it.
export const entriesByType = (uid: string, type: "expense" | "income") =>
  query(entriesBase(uid), where("type", "==", type), orderBy("date", "desc"));

// Lexicographic range over zero-padded YYYY-MM-DD strings (timezone-proof, NFR-04).
// Throws on a malformed or inverted (start > end) range so callers cannot
// silently get an empty result set (WR-05).
export const entriesInRange = (uid: string, start: string, end: string) => {
  if (!isValid(start) || !isValid(end) || compare(start, end) > 0) {
    throw new Error(`entriesInRange: invalid range ${start}..${end}`);
  }
  return query(entriesBase(uid), where("date", ">=", start), where("date", "<=", end));
};

// "Is this category in use?" — one doc is enough to block deletion (ADR-0004).
export const categoryInUse = (uid: string, categoryId: string) =>
  query(entriesBase(uid), where("categoryId", "==", categoryId), limit(1));

export const categoriesOf = (
  uid: string,
  kind: "expenseCategories" | "incomeCategories",
) => query(collection(db, kind), where("uid", "==", uid));
