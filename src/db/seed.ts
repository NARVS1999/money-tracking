// seedFromFirestore — one-time bootstrap of the local SQLite ledger from
// Firestore (OFFL-01). Runs on first sign-in on a device (wired in App.tsx).
//
// Idempotency: skips entirely when the uid already has local rows (either
// table), so repeated sign-ins / restarts never duplicate data and a device
// that has gone fully local keeps its local edits authoritative. Seeding
// happens inside a transaction — a mid-run failure rolls back so a retry
// can run cleanly instead of leaving a partial ledger.
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase/app";
import {
  hasEntries,
  insertEntry,
  type DbEntry,
} from "./entries";
import {
  hasCategories,
  insertCategory,
  type DbCategory,
  type CategoryType,
} from "./categories";
import { getDb } from "./database";

export type SeedResult = {
  seeded: boolean;
  entries: number;
  categories: number;
};

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : Date.now();
}

// Firestore categories live in two collections without a type field; the
// collection name carries the type (expenseCategories / incomeCategories).
async function fetchCategoriesForType(
  uid: string,
  type: CategoryType,
): Promise<DbCategory[]> {
  const snap = await getDocs(
    query(collection(db, type === "expense" ? "expenseCategories" : "incomeCategories"), where("uid", "==", uid)),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      uid,
      type,
      name: typeof data.name === "string" ? data.name : "",
      icon: typeof data.icon === "string" ? data.icon : "",
      createdAt: toMillis(data.createdAt),
      synced: 1,
    };
  });
}

export async function seedFromFirestore(uid: string): Promise<SeedResult> {
  const [alreadyHasEntries, alreadyHasCategories] = await Promise.all([
    hasEntries(uid),
    hasCategories(uid),
  ]);
  if (alreadyHasEntries || alreadyHasCategories) {
    return { seeded: false, entries: 0, categories: 0 };
  }

  // Fetch the cloud ledger (entries + both category kinds) in parallel.
  const [entriesSnap, expenseCats, incomeCats] = await Promise.all([
    getDocs(query(collection(db, "entries"), where("uid", "==", uid))),
    fetchCategoriesForType(uid, "expense"),
    fetchCategoriesForType(uid, "income"),
  ]);

  const entries: DbEntry[] = entriesSnap.docs.map((d) => {
    const data = d.data();
    const createdAt = toMillis(data.createdAt);
    return {
      id: d.id,
      uid,
      type: data.type === "income" ? "income" : "expense",
      amountCents: typeof data.amountCents === "number" ? data.amountCents : 0,
      categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
      date: typeof data.date === "string" ? data.date : "",
      description:
        typeof data.description === "string" ? data.description : "",
      createdAt,
      updatedAt: createdAt,
      synced: 1,
    };
  });

  const categories = [...expenseCats, ...incomeCats];

  const sqlite = await getDb();
  await sqlite.withTransactionAsync(async () => {
    for (const entry of entries) await insertEntry(entry);
    for (const cat of categories) await insertCategory(cat);
  });

  return { seeded: true, entries: entries.length, categories: categories.length };
}
