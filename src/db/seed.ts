// seedFromFirestore — one-time bootstrap of the local SQLite ledger from
// Firestore (OFFL-01). Runs on first sign-in on a device (wired in App.tsx).
//
// Idempotency: each table is seeded independently, so a uid that has rows in
// one table but not the other still gets the missing table populated (a
// partial ledger never blocks seeding the rest). The count checks and the
// inserts run inside a transaction (serialized on the single connection), so
// two concurrent seed calls (React StrictMode double-effects, fast
// sign-in/sign-out) cannot both insert the same rows: the second transaction
// re-checks and skips, and a row that still races in is caught per-row as a
// PK conflict and ignored, leaving the existing local row authoritative.
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
import { getQueue } from "./syncQueue";

export type SeedResult = {
  seeded: boolean;
  entries: number;
  categories: number;
};

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : Date.now();
}

// True when the error is a primary-key/unique constraint failure — the row
// already exists locally (a concurrent seed won the race), so the insert is
// safely skipped. Any other error propagates.
function isPkConflict(e: unknown): boolean {
  return (
    e instanceof Error &&
    /(primary key|unique) constraint failed/i.test(e.message)
  );
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
    const createdAt = toMillis(data.createdAt);
    return {
      id: d.id,
      uid,
      type,
      name: typeof data.name === "string" ? data.name : "",
      icon: typeof data.icon === "string" ? data.icon : "",
      createdAt,
      // Pre-v1.2 cloud docs have no updatedAt — fall back to createdAt so
      // last-write-wins compares against a meaningful timestamp.
      updatedAt:
        data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : createdAt,
      synced: 1,
    };
  });
}

export async function seedFromFirestore(uid: string): Promise<SeedResult> {
  // WR-03: a uid with pending queue ops is not in a seedable state — the
  // local ledger holds authoritative offline changes (e.g. the user deleted
  // every row) that the cloud copies have not caught up with yet. Seeding
  // from Firestore would resurrect those deleted rows with synced = 1 (and
  // disconnect the queued delete ops from the rows). Let the next sync
  // reconcile instead.
  if ((await getQueue(uid)).length > 0) {
    return { seeded: false, entries: 0, categories: 0 };
  }

  // Fast path: uid is fully populated in both tables — nothing to seed.
  const [alreadyHasEntries, alreadyHasCategories] = await Promise.all([
    hasEntries(uid),
    hasCategories(uid),
  ]);
  if (alreadyHasEntries && alreadyHasCategories) {
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
      // Pre-v1.2 cloud docs have no updatedAt — fall back to createdAt so
      // last-write-wins compares against a meaningful timestamp.
      updatedAt:
        data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : createdAt,
      synced: 1,
    };
  });

  const categories = [...expenseCats, ...incomeCats];

  let entriesSeeded = 0;
  let categoriesSeeded = 0;

  const sqlite = await getDb();
  await sqlite.withTransactionAsync(async () => {
    // Per-table check + insert inside the transaction: a uid that has rows
    // in one table but not the other still seeds the missing table, and the
    // check is re-run under the serialized transaction so two concurrent
    // seeds cannot both insert the same rows.
    if (!(await hasEntries(uid))) {
      for (const entry of entries) {
        try {
          await insertEntry(entry);
          entriesSeeded += 1;
        } catch (e) {
          // Row already exists (concurrent seed won the race) — keep the
          // existing local row authoritative; any other error propagates
          // and rolls back the transaction.
          if (!isPkConflict(e)) throw e;
        }
      }
    }
    if (!(await hasCategories(uid))) {
      for (const cat of categories) {
        try {
          await insertCategory(cat);
          categoriesSeeded += 1;
        } catch (e) {
          if (!isPkConflict(e)) throw e;
        }
      }
    }
  });

  return {
    seeded: entriesSeeded > 0 || categoriesSeeded > 0,
    entries: entriesSeeded,
    categories: categoriesSeeded,
  };
}
