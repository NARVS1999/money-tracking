// CategoriesProvider — single source of truth for category data
// (offline-first, mirrors EntriesProvider). Reads and writes go to SQLite
// (src/db/categories); every local write is mirrored into the syncQueue for
// the sync service (OFFL-03/04). usageMap derives from EntriesProvider's
// entries (no third network listener): EntriesProvider MUST stay an ancestor
// of CategoriesProvider — App.tsx already nests it so, do not reorder.
// Exposes addCategory (duplicate-checked insert), deleteCategory (in-use
// guarded delete), updateCategory, usageMap, sync, and useCategories() hook —
// same external API as before the SQLite migration, so screens are untouched.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { useEntries } from "../entries/EntriesProvider";
import { seedFromFirestore } from "../db/seed";
import {
  getAllCategories,
  insertCategory,
  updateCategory as updateCategoryDb,
  deleteCategory as deleteCategoryDb,
  type DbCategory,
  type CategoryType,
} from "../db/categories";
import { enqueue } from "../db/syncQueue";
import { fullSync } from "../sync/syncService";
import { generateTempId } from "../sync/idMapping";

export type Category = { id: string; name: string; createdAt: Timestamp; icon?: string };
export type CategoryKind = "expenseCategories" | "incomeCategories";

export type CategoriesContextValue = {
  expenseCategories: Category[];
  incomeCategories: Category[];
  usageMap: Map<string, number>;
  addCategory: (kind: CategoryKind, name: string, icon?: string) => Promise<void>;
  updateCategory: (kind: CategoryKind, categoryId: string, updates: { name?: string; icon?: string }) => Promise<void>;
  deleteCategory: (kind: CategoryKind, categoryId: string) => Promise<void>;
  sync: () => Promise<void>;
  isSyncing: boolean;
  lastError: string | null;
};

// Default null so useCategories() can detect "outside provider" usage.
const CategoriesContext = createContext<CategoriesContextValue | null>(null);

// The Firestore collection name carries the type; SQLite normalizes it into
// the `type` column. The syncQueue stores the collection name verbatim, so
// providers enqueue with the kind and the sync service maps it back.
const kindToType = (kind: CategoryKind): CategoryType =>
  kind === "expenseCategories" ? "expense" : "income";

function toTimestamp(ms: number): Timestamp {
  return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
}

function fromDb(row: DbCategory): Category {
  return {
    id: row.id,
    name: row.name,
    createdAt: toTimestamp(row.createdAt),
    icon: row.icon || undefined,
  };
}

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Usage counts derive from EntriesProvider's entries instead of a third
  // Firestore listener. Requires EntriesProvider as an ancestor (App.tsx).
  const { entries } = useEntries();
  const usageMap = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      if (e.categoryId) map.set(e.categoryId, (map.get(e.categoryId) || 0) + 1);
    });
    return map;
  }, [entries]);

  // One-time load on sign-in (no listeners). seedFromFirestore first, so a
  // fresh sign-in's cloud ledger is already local before the first read.
  const load = useCallback(async (uid: string) => {
    await seedFromFirestore(uid);
    const rows = await getAllCategories(uid);
    const expense: Category[] = [];
    const income: Category[] = [];
    rows.forEach((row) => {
      (row.type === "expense" ? expense : income).push(fromDb(row));
    });
    return { expense, income };
  }, []);

  useEffect(() => {
    if (!user) {
      setExpenseCategories([]);
      setIncomeCategories([]);
      return;
    }
    const uid = user.uid;
    let cancelled = false;
    load(uid)
      .then(({ expense, income }) => {
        if (!cancelled) {
          setExpenseCategories(expense);
          setIncomeCategories(income);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          const msg =
            e instanceof Error ? e.message : "Failed to load categories";
          setLastError(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, load]);

  // Manual sync — full push+pull cycle through the sync service, then reload
  // from SQLite. Rethrows so the Sync button can surface the failure.
  const sync = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;
    setIsSyncing(true);
    try {
      await fullSync(uid);
      const { expense, income } = await load(uid);
      setExpenseCategories(expense);
      setIncomeCategories(income);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed — retry?";
      setLastError(msg);
      throw e;
    } finally {
      setIsSyncing(false);
    }
  }, [user, load]);

  const addCategory = useCallback(
    async (kind: CategoryKind, name: string, icon?: string) => {
      if (!user) throw new Error("Not authenticated");
      const trimmed = name.trim();
      if (!trimmed) return;
      const existing =
        kind === "expenseCategories" ? expenseCategories : incomeCategories;
      if (
        existing.some(
          (c) => c.name.toLowerCase().trim() === trimmed.toLowerCase(),
        )
      ) {
        throw new Error("Already exists");
      }
      const id = generateTempId();
      const now = Date.now();
      try {
        // SQLite write first (works offline), then queue for Firestore.
        await insertCategory({
          id,
          uid: user.uid,
          type: kindToType(kind),
          name: trimmed,
          icon: icon ?? "",
          createdAt: now,
          updatedAt: now,
          synced: 0,
        });
        await enqueue(user.uid, kind, id, "create");
        // Mirror the write into local state (visible immediately)
        const local: Category = {
          id,
          name: trimmed,
          createdAt: toTimestamp(now),
          icon,
        };
        if (kind === "expenseCategories") {
          setExpenseCategories((prev) => [...prev, local]);
        } else {
          setIncomeCategories((prev) => [...prev, local]);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user, expenseCategories, incomeCategories],
  );

  const updateCategory = useCallback(
    async (kind: CategoryKind, categoryId: string, updates: { name?: string; icon?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const existing = kind === "expenseCategories" ? expenseCategories : incomeCategories;

      // Duplicate name check if name is being changed
      if (updates.name) {
        const trimmed = updates.name.trim();
        if (!trimmed) throw new Error("Name cannot be empty");
        if (existing.some((c) => c.id !== categoryId && c.name.toLowerCase().trim() === trimmed.toLowerCase())) {
          throw new Error("Already exists");
        }
      }

      const changes: Partial<Pick<DbCategory, "name" | "icon" | "updatedAt">> = {};
      if (updates.name !== undefined) changes.name = updates.name.trim();
      if (updates.icon !== undefined) changes.icon = updates.icon;
      if (Object.keys(changes).length === 0) return;
      // Bump updatedAt for last-write-wins; db layer forces synced = 0 (WR-03).
      changes.updatedAt = Date.now();

      try {
        await updateCategoryDb(user.uid, categoryId, changes);
        await enqueue(user.uid, kind, categoryId, "update");

        // Mirror into local state
        const setter = kind === "expenseCategories" ? setExpenseCategories : setIncomeCategories;
        setter((prev) =>
          prev.map((c) =>
            c.id === categoryId
              ? { ...c, ...updates, name: updates.name ? updates.name.trim() : c.name }
              : c,
          ),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Update failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user, expenseCategories, incomeCategories],
  );

  const deleteCategory = useCallback(
    async (kind: CategoryKind, categoryId: string) => {
      if (!user) throw new Error("Not authenticated");
      // In-use guard derives from local entries (usageMap) — no Firestore
      // query needed. SQLite deletes are uid-scoped at the SQL layer.
      if ((usageMap.get(categoryId) ?? 0) > 0) {
        throw new Error("Category is in use");
      }
      try {
        await deleteCategoryDb(user.uid, categoryId);
        await enqueue(user.uid, kind, categoryId, "delete");
        // Mirror the delete into local state
        if (kind === "expenseCategories") {
          setExpenseCategories((prev) =>
            prev.filter((c) => c.id !== categoryId),
          );
        } else {
          setIncomeCategories((prev) =>
            prev.filter((c) => c.id !== categoryId),
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Delete failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user, usageMap],
  );

  return (
    <CategoriesContext.Provider
      value={{
        expenseCategories,
        incomeCategories,
        usageMap,
        addCategory,
        updateCategory,
        deleteCategory,
        sync,
        isSyncing,
        lastError,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used within CategoriesProvider");
  return ctx;
}
