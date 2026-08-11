// EntriesProvider — single source of truth for entry data (offline-first).
// Reads and writes go to SQLite (src/db/entries) so the app is fully usable
// without a network (OFFL-03); every local write is mirrored into the
// syncQueue so the sync service (src/sync/syncService) can push it to
// Firestore when online (OFFL-04). There are NO real-time data listeners —
// remote changes reach the UI through sync() (header Sync button / auto-sync
// on foreground). Exposes addEntry, updateEntry, deleteEntry, copyEntry,
// sync, and useEntries() hook — same external API as before the SQLite
// migration, so screens are untouched.
//
// Locally-created rows use a temp id (src/sync/idMapping); the sync service
// remaps it to the Firestore doc id on the next successful push (SYNC-04).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { today } from "../lib/dates";
import { seedFromFirestore } from "../db/seed";
import {
  getAllEntries,
  insertEntry,
  updateEntry as updateEntryDb,
  deleteEntry as deleteEntryDb,
  type DbEntry,
} from "../db/entries";
import { enqueue } from "../db/syncQueue";
import { fullSync } from "../sync/syncService";
import { generateTempId } from "../sync/idMapping";

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
  reload: () => Promise<void>;
  isLoading: boolean;
  isSyncing: boolean;
  lastError: string | null;
  clearError: () => void;
};

const EntriesContext = createContext<EntriesContextValue | null>(null);

// SQLite stores timestamps as INTEGER ms epochs; the provider's public Entry
// type keeps the Firestore Timestamp shape consumers already use.
function toTimestamp(ms: number): Timestamp {
  return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
}

function fromDb(row: DbEntry): Entry {
  return {
    id: row.id,
    uid: row.uid,
    type: row.type,
    amount: row.amountCents,
    categoryId: row.categoryId,
    date: row.date,
    description: row.description,
    createdAt: toTimestamp(row.createdAt),
  };
}

const byDateDesc = (a: Entry, b: Entry) =>
  a.date > b.date ? -1 : a.date < b.date ? 1 : 0;

export function EntriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Auto-clear error after 5 seconds
  const clearError = useCallback(() => setLastError(null), []);

  // One-time load on sign-in (no listeners). seedFromFirestore first, so a
  // fresh sign-in's cloud ledger is already local before the first read —
  // no empty-list flash while the seed runs; offline first-run falls back to
  // an empty ledger that sync() populates later. The cancelled flag makes
  // state updates no-ops after a user change or unmount.
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setIsLoading(false);
      return;
    }
    const uid = user.uid;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        await seedFromFirestore(uid);
        const rows = await getAllEntries(uid);
        if (!cancelled) setEntries(rows.map(fromDb));
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load entries";
          setLastError(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Manual sync — full push+pull cycle through the sync service, then reload
  // from SQLite (temp ids are now remapped). Rethrows so the Sync button can
  // surface the failure.
  const sync = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;
    setIsSyncing(true);
    try {
      await fullSync(uid);
      const rows = await getAllEntries(uid);
      setEntries(rows.map(fromDb));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed — retry?";
      setLastError(msg);
      throw e;
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  // Reload the list straight from SQLite — no network. The recurring-entry
  // scheduler (Phase 13) inserts generated entries directly into the entries
  // table, so the provider needs a cheap re-read for them to appear without
  // an app restart or a full sync().
  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await getAllEntries(user.uid);
      setEntries(rows.map(fromDb));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to reload entries";
      setLastError(msg);
    }
  }, [user]);

  const addEntry = useCallback(
    async (input: EntryInput) => {
      if (!user) throw new Error("Not authenticated");
      const id = generateTempId();
      const now = Date.now();
      try {
        // SQLite write first (works offline), then queue for Firestore.
        await insertEntry({
          id,
          uid: user.uid,
          type: input.type,
          amountCents: input.amount,
          categoryId: input.categoryId,
          date: input.date,
          description: input.description,
          createdAt: now,
          updatedAt: now,
          synced: 0,
        });
        await enqueue(user.uid, "entries", id, "create");
        // Mirror the write into local state (visible immediately)
        setEntries((prev) =>
          [...prev, {
            id,
            uid: user.uid,
            type: input.type,
            amount: input.amount,
            categoryId: input.categoryId,
            date: input.date,
            description: input.description,
            createdAt: toTimestamp(now),
          }].sort(byDateDesc),
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
      const changes: Partial<Pick<DbEntry, "type" | "amountCents" | "categoryId" | "date" | "description" | "updatedAt">> = {};
      if (input.type !== undefined) changes.type = input.type;
      if (input.amount !== undefined) changes.amountCents = input.amount;
      if (input.categoryId !== undefined) changes.categoryId = input.categoryId;
      if (input.date !== undefined) changes.date = input.date;
      if (input.description !== undefined) changes.description = input.description;
      if (Object.keys(changes).length === 0) return;
      // Bumping updatedAt drives last-write-wins on the next pull; the db
      // layer forces synced = 0 so the change is pushed (WR-03).
      changes.updatedAt = Date.now();
      try {
        await updateEntryDb(user.uid, id, changes);
        await enqueue(user.uid, "entries", id, "update");
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
        // SQLite delete is uid-scoped at the SQL layer (no doc pre-check
        // needed — ownership is enforced by the WHERE clause).
        await deleteEntryDb(user.uid, id);
        await enqueue(user.uid, "entries", id, "delete");
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
      const newId = generateTempId();
      const now = Date.now();
      try {
        await insertEntry({
          id: newId,
          uid: user.uid,
          type: source.type,
          amountCents: source.amount,
          categoryId: source.categoryId,
          date: today(), // Copy resets date to today (ENTR-08)
          description: source.description,
          createdAt: now,
          updatedAt: now,
          synced: 0,
        });
        await enqueue(user.uid, "entries", newId, "create");
        // Mirror the copy into local state
        setEntries((prev) =>
          [...prev, {
            id: newId,
            uid: user.uid,
            type: source.type,
            amount: source.amount,
            categoryId: source.categoryId,
            date: today(),
            description: source.description,
            createdAt: toTimestamp(now),
          }].sort(byDateDesc),
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
        reload,
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
