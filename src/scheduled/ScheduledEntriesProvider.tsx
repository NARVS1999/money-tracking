// ScheduledEntriesProvider — single source of truth for recurring-entry
// templates (offline-first, mirrors EntriesProvider/CategoriesProvider).
// Reads and writes go to SQLite (src/db/scheduled); every local write is
// mirrored into the syncQueue so the sync service (src/sync/syncService)
// pushes it to Firestore when online (SCHD-05). Exposes addScheduled,
// updateScheduled, deleteScheduled, pauseScheduled, resumeScheduled, sync,
// and useScheduledEntries() — the Phase 14 scheduled-entries UI consumes
// this context. The auto-generation engine itself (src/scheduled/scheduler)
// is invoked from the startup wiring in Task 6 of this plan.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { useEntries } from "../entries/EntriesProvider";
import {
  getAllScheduled,
  insertScheduled,
  updateScheduled as updateScheduledDb,
  deleteScheduled as deleteScheduledDb,
  type DbScheduledEntry,
} from "../db/scheduled";
import { enqueue } from "../db/syncQueue";
import { fullSync } from "../sync/syncService";
import { generateTempId } from "../sync/idMapping";
import { runScheduler } from "./scheduler";
import { isFrequency, type Frequency } from "../lib/frequency";
import type { EntryType } from "../db/entries";

export type ScheduledEntry = {
  id: string;
  uid: string;
  type: EntryType;
  amount: number; // integer cents
  categoryId: string;
  date: string; // YYYY-MM-DD — first occurrence / start date
  description: string;
  frequency: Frequency;
  endDate: string | null; // YYYY-MM-DD or null = no end
  lastGenerated: string | null; // YYYY-MM-DD or null = never generated
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ScheduledInput = {
  type: EntryType;
  amount: number; // integer cents
  categoryId: string;
  date: string;
  description: string;
  frequency: Frequency;
  endDate?: string | null;
};

export type ScheduledEntriesContextValue = {
  scheduledEntries: ScheduledEntry[];
  addScheduled: (input: ScheduledInput) => Promise<void>;
  updateScheduled: (
    id: string,
    input: Partial<ScheduledInput>,
  ) => Promise<void>;
  deleteScheduled: (id: string) => Promise<void>;
  pauseScheduled: (id: string) => Promise<void>;
  resumeScheduled: (id: string) => Promise<void>;
  sync: () => Promise<void>;
  isLoading: boolean;
  isSyncing: boolean;
  lastError: string | null;
  clearError: () => void;
};

const ScheduledEntriesContext =
  createContext<ScheduledEntriesContextValue | null>(null);

// SQLite stores timestamps as INTEGER ms epochs; the public type keeps the
// Firestore Timestamp shape consumers already use (same as EntriesProvider).
function toTimestamp(ms: number): Timestamp {
  return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
}

function fromDb(row: DbScheduledEntry): ScheduledEntry {
  return {
    id: row.id,
    uid: row.uid,
    type: row.type,
    amount: row.amountCents,
    categoryId: row.categoryId,
    date: row.date,
    description: row.description,
    frequency: isFrequency(row.frequency) ? row.frequency : "once",
    endDate: row.endDate,
    lastGenerated: row.lastGenerated,
    isActive: row.isActive === 1,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
  };
}

export function ScheduledEntriesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { isLoading: entriesLoading, reload: reloadEntries } = useEntries();
  const [scheduledEntries, setScheduledEntries] = useState<ScheduledEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Startup wiring for the auto-generation engine (Task 6): once the entries
  // list has loaded, run the scheduler ONCE per sign-in in the background
  // (fire-and-forget — never blocks the UI). runScheduler writes generated
  // entries into SQLite + the sync queue; reloadEntries re-reads SQLite so
  // they appear in the entries list immediately. Failures are swallowed —
  // startup must never break over a generation hiccup; the next sign-in
  // retries (generation is idempotent thanks to lastGenerated).
  const schedulerRanFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user) {
      // WR-02: reset the once-per-sign-in marker on sign-out, or a same-uid
      // sign-out → sign-in cycle within one app session would skip generation
      // (occurrences that came due while signed out would wait for the next
      // app restart).
      schedulerRanFor.current = null;
      return;
    }
    if (entriesLoading || schedulerRanFor.current === user.uid) return;
    schedulerRanFor.current = user.uid;
    let cancelled = false;
    (async () => {
      try {
        const generated = await runScheduler(user.uid);
        if (generated > 0 && !cancelled) await reloadEntries();
      } catch {
        // Generation is best-effort at startup — the next sign-in retries.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, entriesLoading, reloadEntries]);

  // Auto-clear error after 5 seconds (same pattern as the other providers).
  const clearError = useCallback(() => setLastError(null), []);

  // One-time load on sign-in (no listeners). Scheduled templates are created
  // locally or arrive through the sync service's pull — nothing to seed.
  useEffect(() => {
    if (!user) {
      setScheduledEntries([]);
      setIsLoading(false);
      return;
    }
    const uid = user.uid;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const rows = await getAllScheduled(uid);
        if (!cancelled) setScheduledEntries(rows.map(fromDb));
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error ? e.message : "Failed to load scheduled entries";
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
  // from SQLite (temp ids are now remapped). Rethrows so callers can surface
  // the failure.
  const sync = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;
    setIsSyncing(true);
    try {
      await fullSync(uid);
      const rows = await getAllScheduled(uid);
      setScheduledEntries(rows.map(fromDb));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed — retry?";
      setLastError(msg);
      throw e;
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  const addScheduled = useCallback(
    async (input: ScheduledInput) => {
      if (!user) throw new Error("Not authenticated");
      if (!isFrequency(input.frequency)) {
        throw new Error("Invalid frequency");
      }
      const id = generateTempId();
      const now = Date.now();
      try {
        // SQLite write first (works offline), then queue for Firestore.
        await insertScheduled({
          id,
          uid: user.uid,
          type: input.type,
          amountCents: input.amount,
          categoryId: input.categoryId,
          date: input.date,
          description: input.description,
          frequency: input.frequency,
          endDate: input.endDate ?? null,
          lastGenerated: null,
          isActive: 1,
          createdAt: now,
          updatedAt: now,
          synced: 0,
        });
        await enqueue(user.uid, "scheduledEntries", id, "create");
        // Mirror the write into local state (visible immediately).
        setScheduledEntries((prev) => [
          ...prev,
          {
            id,
            uid: user.uid,
            type: input.type,
            amount: input.amount,
            categoryId: input.categoryId,
            date: input.date,
            description: input.description,
            frequency: input.frequency,
            endDate: input.endDate ?? null,
            lastGenerated: null,
            isActive: true,
            createdAt: toTimestamp(now),
            updatedAt: toTimestamp(now),
          },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user],
  );

  const updateScheduled = useCallback(
    async (id: string, input: Partial<ScheduledInput>) => {
      if (!user) throw new Error("Not authenticated");
      if (input.frequency !== undefined && !isFrequency(input.frequency)) {
        throw new Error("Invalid frequency");
      }
      const changes: Partial<
        Pick<
          DbScheduledEntry,
          | "type"
          | "amountCents"
          | "categoryId"
          | "date"
          | "description"
          | "frequency"
          | "endDate"
          | "updatedAt"
        >
      > = {};
      if (input.type !== undefined) changes.type = input.type;
      if (input.amount !== undefined) changes.amountCents = input.amount;
      if (input.categoryId !== undefined) changes.categoryId = input.categoryId;
      if (input.date !== undefined) changes.date = input.date;
      if (input.description !== undefined) changes.description = input.description;
      if (input.frequency !== undefined) changes.frequency = input.frequency;
      if (input.endDate !== undefined) changes.endDate = input.endDate ?? null;
      if (Object.keys(changes).length === 0) return;
      // Bumping updatedAt drives last-write-wins on the next pull; the db
      // layer forces synced = 0 so the change is pushed (WR-03).
      changes.updatedAt = Date.now();
      try {
        await updateScheduledDb(user.uid, id, changes);
        await enqueue(user.uid, "scheduledEntries", id, "update");
        // Mirror the update into local state.
        setScheduledEntries((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...input } : s)),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Update failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user],
  );

  const deleteScheduled = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      try {
        // SQLite delete is uid-scoped at the SQL layer (ownership is
        // enforced by the WHERE clause).
        await deleteScheduledDb(user.uid, id);
        await enqueue(user.uid, "scheduledEntries", id, "delete");
        setScheduledEntries((prev) => prev.filter((s) => s.id !== id));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Delete failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user],
  );

  const setActive = useCallback(
    async (id: string, isActive: 0 | 1) => {
      if (!user) throw new Error("Not authenticated");
      try {
        // isActive is a data column — the db layer forces synced = 0 so the
        // pause/resume state pushes (WR-03). The scheduler only reads
        // isActive = 1 templates, so pausing halts generation immediately.
        await updateScheduledDb(user.uid, id, {
          isActive,
          updatedAt: Date.now(),
        });
        await enqueue(user.uid, "scheduledEntries", id, "update");
        setScheduledEntries((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive: isActive === 1 } : s)),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Update failed — retry?";
        setLastError(msg);
        throw e;
      }
    },
    [user],
  );

  const pauseScheduled = useCallback((id: string) => setActive(id, 0), [setActive]);
  const resumeScheduled = useCallback((id: string) => setActive(id, 1), [setActive]);

  // Auto-clear error after 5 seconds.
  useEffect(() => {
    if (!lastError) return;
    const timer = setTimeout(() => setLastError(null), 5000);
    return () => clearTimeout(timer);
  }, [lastError]);

  return (
    <ScheduledEntriesContext.Provider
      value={{
        scheduledEntries,
        addScheduled,
        updateScheduled,
        deleteScheduled,
        pauseScheduled,
        resumeScheduled,
        sync,
        isLoading,
        isSyncing,
        lastError,
        clearError,
      }}
    >
      {children}
    </ScheduledEntriesContext.Provider>
  );
}

export function useScheduledEntries() {
  const ctx = useContext(ScheduledEntriesContext);
  if (!ctx) {
    throw new Error(
      "useScheduledEntries must be used within ScheduledEntriesProvider",
    );
  }
  return ctx;
}
