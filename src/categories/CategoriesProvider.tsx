// CategoriesProvider — single source of truth for category data (02-RESEARCH.md
// Pattern 1, lines 250-361). Subscribes three onSnapshot listeners
// (expenseCategories, incomeCategories, entries) when user.uid is available;
// all three unsubscribe on sign-out or unmount. Exposes addCategory
// (duplicate-checked addDoc), deleteCategory (in-use guarded deleteDoc),
// usageMap (derived per-category entry count), and useCategories() hook.
//
// Follows the AuthProvider pattern exactly: module-level createContext(null),
// custom hook with null guard, useEffect with cleanup.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase/app";
import { categoriesOf, entriesBase, categoryInUse } from "../firebase/queries";
import { useAuth } from "../auth/AuthProvider";

export type Category = { id: string; name: string; createdAt: Timestamp };
export type CategoryKind = "expenseCategories" | "incomeCategories";

export type CategoriesContextValue = {
  expenseCategories: Category[];
  incomeCategories: Category[];
  usageMap: Map<string, number>;
  addCategory: (kind: CategoryKind, name: string) => Promise<void>;
  deleteCategory: (kind: CategoryKind, categoryId: string) => Promise<void>;
};

// Default null so useCategories() can detect "outside provider" usage.
const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [usageMap, setUsageMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user) {
      setExpenseCategories([]);
      setIncomeCategories([]);
      setUsageMap(new Map());
      return;
    }
    const uid = user.uid;

    const unsub1 = onSnapshot(categoriesOf(uid, "expenseCategories"), (snap) => {
      setExpenseCategories(
        snap.docs.map((d) => {
          const data = d.data();
          const name = typeof data.name === "string" ? data.name : "";
          const createdAt =
            data.createdAt instanceof Timestamp
              ? data.createdAt
              : Timestamp.now();
          return { id: d.id, name, createdAt };
        }),
      );
    });
    const unsub2 = onSnapshot(categoriesOf(uid, "incomeCategories"), (snap) => {
      setIncomeCategories(
        snap.docs.map((d) => {
          const data = d.data();
          const name = typeof data.name === "string" ? data.name : "";
          const createdAt =
            data.createdAt instanceof Timestamp
              ? data.createdAt
              : Timestamp.now();
          return { id: d.id, name, createdAt };
        }),
      );
    });
    const unsub3 = onSnapshot(entriesBase(uid), (snap) => {
      const map = new Map<string, number>();
      snap.forEach((d) => {
        const cid = d.data().categoryId;
        if (cid) map.set(cid, (map.get(cid) || 0) + 1);
      });
      setUsageMap(map);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [user]);

  const addCategory = useCallback(
    async (kind: CategoryKind, name: string) => {
      if (!user) return;
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
      await addDoc(collection(db, kind), {
        uid: user.uid,
        name: trimmed,
        createdAt: Timestamp.now(),
      });
    },
    [user, expenseCategories, incomeCategories],
  );

  const deleteCategory = useCallback(
    async (kind: CategoryKind, categoryId: string) => {
      if (!user) return;
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
