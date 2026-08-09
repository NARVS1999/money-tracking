// EntriesProvider — single source of truth for entry data (manual-sync model).
// Loads entries once via getDocs when user.uid becomes available; there are NO
// real-time data listeners — remote changes reach the UI only through the
// user's own writes (mirrored into local state) or an explicit sync() call
// (wired to the header Sync button). Exposes addEntry, updateEntry,
// deleteEntry, copyEntry, sync, and useEntries() hook.
//
// Follows the CategoriesProvider pattern exactly: module-level createContext(null),
// custom hook with null guard, useEffect with cleanup (cancelled-flag guard).
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
  getDoc,
  getDocs,
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
  sync: () => Promise<void>;
  isLoading: boolean;
  isSyncing: boolean;
  lastError: string | null;
  clearError: () => void;
};

const EntriesContext = createContext<EntriesContextValue | null>(null);

// One-time fetch of every entry belonging to uid (expense + income), merged
// and sorted by date descending. Shared code path for the initial load and
// the manual sync() action so both behave identically.
async function fetchAllEntries(uid: string): Promise<Entry[]> {
  const [expenseSnap, incomeSnap] = await Promise.all([
    getDocs(entriesByType(uid, "expense")),
    getDocs(entriesByType(uid, "income")),
  ]);

  const toEntry = (d: { id: string; data: () => Record<string, unknown> }, type: EntryType): Entry => {
    const data = d.data();
    return {
      id: d.id,
      uid,
      type,
      // Firestore field is amountCents (backend-schema.md / rules WR-04);
      // the internal Entry type keeps the short name `amount`.
      amount: typeof data.amountCents === "number" ? data.amountCents : 0,
      categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
      date: typeof data.date === "string" ? data.date : "",
      description: typeof data.description === "string" ? data.description : "",
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt
          : Timestamp.now(),
    };
  };

  const all = [
    ...expenseSnap.docs.map((d) => toEntry(d, "expense")),
    ...incomeSnap.docs.map((d) => toEntry(d, "income")),
  ];
  return all.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

export function EntriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Auto-clear error after 5 seconds
  const clearError = useCallback(() => setLastError(null), []);

  // One-time load on sign-in (no listeners). The cancelled flag makes state
  // updates no-ops after a user change or unmount.
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setIsLoading(false);
      return;
    }
    const uid = user.uid;
    let cancelled = false;
    setIsLoading(true);
    fetchAllEntries(uid)
      .then((all) => {
        if (!cancelled) setEntries(all);
      })
      .catch((e) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load entries";
          setLastError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Manual sync — pulls the latest entries from Firestore on demand. Rethrows
  // so the Sync button can surface the failure.
  const sync = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;
    setIsSyncing(true);
    try {
      const all = await fetchAllEntries(uid);
      setEntries(all);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed — retry?";
      setLastError(msg);
      throw e;
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  const addEntry = useCallback(
    async (input: EntryInput) => {
      if (!user) throw new Error("Not authenticated");
      try {
        const docRef = await addDoc(collection(db, "entries"), {
          uid: user.uid,
          type: input.type,
          amountCents: input.amount,
          categoryId: input.categoryId,
          date: input.date,
          description: input.description,
          createdAt: Timestamp.now(),
        });
        // Mirror the write into local state (ENTR-05: visible immediately)
        const local: Entry = {
          id: docRef.id,
          uid: user.uid,
          type: input.type,
          amount: input.amount,
          categoryId: input.categoryId,
          date: input.date,
          description: input.description,
          createdAt: Timestamp.now(),
        };
        setEntries((prev) =>
          [...prev, local].sort((a, b) =>
            a.date > b.date ? -1 : a.date < b.date ? 1 : 0,
          ),
        );
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
        if (input.amount !== undefined) updateData.amountCents = input.amount;
        if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
        if (input.date !== undefined) updateData.date = input.date;
        if (input.description !== undefined) updateData.description = input.description;
        await updateDoc(doc(db, "entries", id), updateData);
        // Mirror the update into local state
        const patch: Partial<Entry> = {};
        if (input.type !== undefined) patch.type = input.type;
        if (input.amount !== undefined) patch.amount = input.amount;
        if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
        if (input.date !== undefined) patch.date = input.date;
        if (input.description !== undefined) patch.description = input.description;
        setEntries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        );
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
        // Verify ownership before deletion (defense-in-depth)
        const entryDoc = await getDoc(doc(db, "entries", id));
        if (!entryDoc.exists() || entryDoc.data().uid !== user.uid) {
          throw new Error("Entry not found");
        }
        await deleteDoc(doc(db, "entries", id));
        // Mirror the delete into local state
        setEntries((prev) => prev.filter((e) => e.id !== id));
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
        const docRef = await addDoc(collection(db, "entries"), {
          uid: user.uid,
          type: source.type,
          amountCents: source.amount,
          categoryId: source.categoryId,
          date: today(), // Copy resets date to today (ENTR-08)
          description: source.description,
          createdAt: Timestamp.now(),
        });
        // Mirror the copy into local state
        const local: Entry = {
          id: docRef.id,
          uid: user.uid,
          type: source.type,
          amount: source.amount,
          categoryId: source.categoryId,
          date: today(),
          description: source.description,
          createdAt: Timestamp.now(),
        };
        setEntries((prev) =>
          [...prev, local].sort((a, b) =>
            a.date > b.date ? -1 : a.date < b.date ? 1 : 0,
          ),
        );
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
        sync,
        isLoading,
        isSyncing,
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
