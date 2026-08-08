// CategoriesProvider — single source of truth for category data (manual-sync
// model, mirrors EntriesProvider). Loads both category lists once via getDocs
// when user.uid becomes available; there are NO real-time data listeners —
// remote changes reach the UI only through the user's own writes (mirrored
// into local state) or an explicit sync() call (wired to the header Sync
// button). usageMap derives from EntriesProvider's entries (no third network
// listener): EntriesProvider MUST stay an ancestor of CategoriesProvider —
// App.tsx already nests it so, do not reorder. Exposes addCategory
// (duplicate-checked addDoc), deleteCategory (in-use guarded deleteDoc),
// usageMap, sync, and useCategories() hook.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase/app";
import { categoriesOf, categoryInUse } from "../firebase/queries";
import { useAuth } from "../auth/AuthProvider";
import { useEntries } from "../entries/EntriesProvider";

export type Category = { id: string; name: string; createdAt: Timestamp };
export type CategoryKind = "expenseCategories" | "incomeCategories";

export type CategoriesContextValue = {
  expenseCategories: Category[];
  incomeCategories: Category[];
  usageMap: Map<string, number>;
  addCategory: (kind: CategoryKind, name: string) => Promise<void>;
  deleteCategory: (kind: CategoryKind, categoryId: string) => Promise<void>;
  sync: () => Promise<void>;
  isSyncing: boolean;
  lastError: string | null;
};

// Default null so useCategories() can detect "outside provider" usage.
const CategoriesContext = createContext<CategoriesContextValue | null>(null);

// One-time fetch of both category lists for uid. Shared code path for the
// initial load and the manual sync() action so both behave identically.
async function fetchCategories(
  uid: string,
): Promise<[Category[], Category[]]> {
  const [expenseSnap, incomeSnap] = await Promise.all([
    getDocs(categoriesOf(uid, "expenseCategories")),
    getDocs(categoriesOf(uid, "incomeCategories")),
  ]);

  const toCategory = (d: {
    id: string;
    data: () => Record<string, unknown>;
  }): Category => {
    const data = d.data();
    const name = typeof data.name === "string" ? data.name : "";
    const createdAt =
      data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now();
    return { id: d.id, name, createdAt };
  };

  return [
    expenseSnap.docs.map(toCategory),
    incomeSnap.docs.map(toCategory),
  ];
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

  // One-time load on sign-in (no listeners). The cancelled flag makes state
  // updates no-ops after a user change or unmount.
  useEffect(() => {
    if (!user) {
      setExpenseCategories([]);
      setIncomeCategories([]);
      return;
    }
    const uid = user.uid;
    let cancelled = false;
    fetchCategories(uid)
      .then(([expense, income]) => {
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
  }, [user]);

  // Manual sync — pulls the latest categories from Firestore on demand.
  // Rethrows so the Sync button can surface the failure.
  const sync = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;
    setIsSyncing(true);
    try {
      const [expense, income] = await fetchCategories(uid);
      setExpenseCategories(expense);
      setIncomeCategories(income);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed — retry?";
      setLastError(msg);
      throw e;
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  const addCategory = useCallback(
    async (kind: CategoryKind, name: string) => {
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
      try {
        const docRef = await addDoc(collection(db, kind), {
          uid: user.uid,
          name: trimmed,
          createdAt: Timestamp.now(),
        });
        // Mirror the write into local state (visible immediately)
        const local: Category = {
          id: docRef.id,
          name: trimmed,
          createdAt: Timestamp.now(),
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

  const deleteCategory = useCallback(
    async (kind: CategoryKind, categoryId: string) => {
      if (!user) throw new Error("Not authenticated");
      try {
        // Defense-in-depth: verify the category document belongs to this user
        const categorySnap = await getDocs(
          query(collection(db, kind), where("uid", "==", user.uid)),
        );
        if (!categorySnap.docs.some((d) => d.id === categoryId)) {
          throw new Error("Category not found");
        }
        const inUseSnap = await getDocs(categoryInUse(user.uid, categoryId));
        if (!inUseSnap.empty) throw new Error("Category is in use");
        await deleteDoc(doc(db, kind, categoryId));
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
    [user],
  );

  return (
    <CategoriesContext.Provider
      value={{
        expenseCategories,
        incomeCategories,
        usageMap,
        addCategory,
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
