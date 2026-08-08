// EntriesProvider — single source of truth for entry data. Subscribes
// onSnapshot listeners for expense and income entries when user.uid is
// available; unsubscribes on sign-out or unmount. Exposes addEntry,
// updateEntry, deleteEntry, copyEntry, and useEntries() hook.
//
// Follows the CategoriesProvider pattern exactly: module-level createContext(null),
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
  onSnapshot,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/app";
import { entriesByType } from "../firebase/queries";
import { useAuth } from "../auth/AuthProvider";
import { today } from "../lib/dates";

export type EntryType = "expense" | "income";

export type Entry = {
  id: string;
  uid: string;
  type: EntryType;
  amount: number; // integer cents
  categoryId: string;
  date: string; // YYYY-MM-DD
  description: string;
  createdAt: Timestamp;
  hasPendingWrites: boolean;
};

export type EntryInput = {
  type: EntryType;
  amount: number;
  categoryId: string;
  date: string;
  description: string;
};

export type EntriesContextValue = {
  entries: Entry[];
  addEntry: (input: EntryInput) => Promise<void>;
  updateEntry: (id: string, input: Partial<EntryInput>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  copyEntry: (id: string) => Promise<void>;
  isLoading: boolean;
  lastError: string | null;
  clearError: () => void;
};

const EntriesContext = createContext<EntriesContextValue | null>(null);

export function EntriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  // Auto-clear error after 5 seconds
  const clearError = useCallback(() => setLastError(null), []);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setIsLoading(false);
      return;
    }
    const uid = user.uid;
    setIsLoading(true);

    const unsubExpense = onSnapshot(
      entriesByType(uid, "expense"),
      (snap) => {
        const expenseEntries = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid,
            type: "expense" as EntryType,
            amount: typeof data.amount === "number" ? data.amount : 0,
            categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
            date: typeof data.date === "string" ? data.date : "",
            description: typeof data.description === "string" ? data.description : "",
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt
                : Timestamp.now(),
            hasPendingWrites: d.metadata.hasPendingWrites,
          };
        });

        const unsubIncome = onSnapshot(
          entriesByType(uid, "income"),
          (snap2) => {
            const incomeEntries = snap2.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                uid,
                type: "income" as EntryType,
                amount: typeof data.amount === "number" ? data.amount : 0,
                categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
                date: typeof data.date === "string" ? data.date : "",
                description: typeof data.description === "string" ? data.description : "",
                createdAt:
                  data.createdAt instanceof Timestamp
                    ? data.createdAt
                    : Timestamp.now(),
                hasPendingWrites: d.metadata.hasPendingWrites,
              };
            });

            // Merge and sort by date descending
            const all = [...expenseEntries, ...incomeEntries].sort((a, b) =>
              a.date > b.date ? -1 : a.date < b.date ? 1 : 0,
            );
            setEntries(all);
            setIsLoading(false);
          },
        );

        // Return cleanup for both listeners
        return () => {
          unsubExpense();
          unsubIncome();
        };
      },
    );

    return () => {
      unsubExpense();
    };
  }, [user]);

  const addEntry = useCallback(
    async (input: EntryInput) => {
      if (!user) throw new Error("Not authenticated");
      try {
        await addDoc(collection(db, "entries"), {
          uid: user.uid,
          type: input.type,
          amount: input.amount,
          categoryId: input.categoryId,
          date: input.date,
          description: input.description,
          createdAt: Timestamp.now(),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user],
  );

  const updateEntry = useCallback(
    async (id: string, input: Partial<EntryInput>) => {
      if (!user) throw new Error("Not authenticated");
      try {
        const updateData: Record<string, unknown> = {};
        if (input.type !== undefined) updateData.type = input.type;
        if (input.amount !== undefined) updateData.amount = input.amount;
        if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
        if (input.date !== undefined) updateData.date = input.date;
        if (input.description !== undefined) updateData.description = input.description;
        await updateDoc(doc(db, "entries", id), updateData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      try {
        await deleteDoc(doc(db, "entries", id));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Delete failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user],
  );

  const copyEntry = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      const source = entries.find((e) => e.id === id);
      if (!source) throw new Error("Entry not found");
      try {
        await addDoc(collection(db, "entries"), {
          uid: user.uid,
          type: source.type,
          amount: source.amount,
          categoryId: source.categoryId,
          date: today(), // Copy resets date to today (ENTR-08)
          description: source.description,
          createdAt: Timestamp.now(),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user, entries],
  );

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (!lastError) return;
    const timer = setTimeout(() => setLastError(null), 5000);
    return () => clearTimeout(timer);
  }, [lastError]);

  return (
    <EntriesContext.Provider
      value={{
        entries,
        addEntry,
        updateEntry,
        deleteEntry,
        copyEntry,
        isLoading,
        lastError,
        clearError,
      }}
    >
      {children}
    </EntriesContext.Provider>
  );
}

export function useEntries() {
  const ctx = useContext(EntriesContext);
  if (!ctx) throw new Error("useEntries must be used within EntriesProvider");
  return ctx;
}
