// Sync service — the online bridge between SQLite (local source of truth)
// and Firestore (cloud ledger).
//
//   pushChanges(uid)   drains the syncQueue in FIFO order (OFFL-06): creates
//                      via addDoc with temp-id remapping (SYNC-04), updates
//                      via full-doc setDoc, deletes via deleteDoc. A failing
//                      item stops the drain and stays queued so the next sync
//                      retries (OFFL-10).
//   pullChanges(uid)   fetches remote changes since the last sync watermark
//                      and merges them into SQLite with last-write-wins by
//                      updatedAt (SYNC-02), plus remote-delete reconciliation
//                      (SYNC-03: a clean local row absent from Firestore was
//                      deleted on another device).
//   fullSync(uid)      push then pull, then advances the per-uid watermark.
//                      Concurrent calls (SyncButton, auto-sync, both
//                      providers) coalesce into one run via an in-flight lock.
//
// Every function is uid-scoped. Firestore docs use the field names the rules
// and consumers expect (amountCents, createdAt/updatedAt as Timestamps) —
// never the SQLite column/type names verbatim.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase/app";
import { entriesBase, categoriesOf } from "../firebase/queries";
import {
  getAllEntries,
  insertEntry,
  deleteEntry as deleteEntryDb,
  markSynced as markEntrySynced,
  type DbEntry,
} from "../db/entries";
import {
  getAllCategories,
  insertCategory,
  deleteCategory as deleteCategoryDb,
  markSynced as markCategorySynced,
  type DbCategory,
  type CategoryType,
} from "../db/categories";
import {
  getAllScheduled,
  insertScheduled,
  deleteScheduled as deleteScheduledDb,
  markSynced as markScheduledSynced,
  type DbScheduledEntry,
} from "../db/scheduled";
import {
  dequeue,
  getQueue,
  removeByDocId,
  type SyncQueueItem,
} from "../db/syncQueue";
import { isTempId, mapTempId } from "./idMapping";
import { getLastSync, setLastSync } from "./syncMetadata";

export const ENTRY_COLLECTION = "entries";
export const EXPENSE_CATEGORY_COLLECTION = "expenseCategories";
export const INCOME_CATEGORY_COLLECTION = "incomeCategories";
export const SCHEDULED_COLLECTION = "scheduledEntries";

export type SyncCollection =
  | "entries"
  | "expenseCategories"
  | "incomeCategories"
  | "scheduledEntries";

// ---- Timestamp <-> ms epoch conversion -------------------------------------

function toTimestamp(ms: number): Timestamp {
  return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
}

// Missing/non-Timestamp values map to 0 (older than any real update), so a
// pre-v1.2 cloud doc can never win a last-write-wins race it did not enter.
function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0;
}

// ---- Cloud doc shapes (field names the rules + consumers expect) -----------

function entryToCloud(row: DbEntry): Record<string, unknown> {
  return {
    uid: row.uid,
    type: row.type,
    amountCents: row.amountCents,
    categoryId: row.categoryId,
    date: row.date,
    description: row.description,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
  };
}

function categoryToCloud(row: DbCategory): Record<string, unknown> {
  return {
    uid: row.uid,
    type: row.type,
    name: row.name,
    icon: row.icon,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
  };
}

function scheduledToCloud(row: DbScheduledEntry): Record<string, unknown> {
  return {
    uid: row.uid,
    type: row.type,
    amountCents: row.amountCents,
    categoryId: row.categoryId,
    date: row.date,
    description: row.description,
    frequency: row.frequency,
    endDate: row.endDate ?? null,
    lastGenerated: row.lastGenerated ?? null,
    isActive: row.isActive,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
  };
}

const isCategoryCollection = (c: string): boolean =>
  c === EXPENSE_CATEGORY_COLLECTION || c === INCOME_CATEGORY_COLLECTION;

const categoryTypeOf = (c: string): CategoryType =>
  c === EXPENSE_CATEGORY_COLLECTION ? "expense" : "income";

// ---- Push -------------------------------------------------------------------

// updatedAt of the cloud copy of a doc, or 0 when the doc does not exist.
// Used by the update push (WR-01) to decide whether a local edit may be
// written without regressing the cloud timestamp: an update op is only
// pushed when local.updatedAt >= cloud updatedAt, otherwise the op is
// dropped and pullChanges converges the local row to the newer cloud copy.
async function cloudUpdatedAtOf(
  collectionName: string,
  docId: string,
): Promise<number> {
  const snap = await getDoc(doc(db, collectionName, docId));
  return snap.exists() ? toMillis(snap.data()?.updatedAt) : 0;
}

export async function pushChanges(uid: string): Promise<number> {
  const queue = await getQueue(uid);
  if (queue.length === 0) return 0;

  // Snapshot of the local rows each queued op must push, keyed by id, so the
  // drain needs no per-item queries. The maps are renamed in place when a
  // temp id is remapped to its Firestore id.
  const entryRows = new Map((await getAllEntries(uid)).map((r) => [r.id, r]));
  const categoryRows = new Map(
    (await getAllCategories(uid)).map((r) => [r.id, r]),
  );
  const scheduledRows = new Map(
    (await getAllScheduled(uid)).map((r) => [r.id, r]),
  );

  // temp -> real id for ops created in the same offline session (an offline
  // create is remapped when pushed; later update/delete ops for the same doc
  // still carry the temp id and resolve through this map).
  const tempToReal = new Map<string, string>();
  let pushed = 0;

  const resolveId = (item: SyncQueueItem): string =>
    tempToReal.get(item.docId) ?? item.docId;

  // Flip the local row to synced = 1 after the cloud write landed — without
  // this the flag would stay 0 forever and remote-delete reconciliation would
  // never clean a row deleted on another device (WR-03 contract).
  const confirmSynced = async (
    collectionName: string,
    docId: string,
  ): Promise<void> => {
    if (collectionName === ENTRY_COLLECTION) await markEntrySynced(uid, docId);
    else if (isCategoryCollection(collectionName))
      await markCategorySynced(uid, docId);
    else if (collectionName === SCHEDULED_COLLECTION)
      await markScheduledSynced(uid, docId);
  };

  for (const item of queue) {
    try {
      const docId = resolveId(item);

      if (item.operation === "create") {
        if (item.collection === ENTRY_COLLECTION) {
          const row = entryRows.get(item.docId);
          if (!row) {
            // Row deleted before it ever pushed — superseded, drop the op.
            await dequeue(uid, item.id);
            continue;
          }
          if (isTempId(item.docId)) {
            const ref = await addDoc(
              collection(db, ENTRY_COLLECTION),
              entryToCloud(row),
            );
            if (ref.id !== item.docId) {
              await mapTempId(ENTRY_COLLECTION, item.docId, ref.id, uid);
              entryRows.delete(item.docId);
              entryRows.set(ref.id, { ...row, id: ref.id, synced: 1 });
              tempToReal.set(item.docId, ref.id);
            }
            await confirmSynced(ENTRY_COLLECTION, ref.id);
          } else {
            // Non-temp create (defensive): upsert so the doc id is preserved.
            await setDoc(doc(db, ENTRY_COLLECTION, docId), entryToCloud(row));
            await confirmSynced(ENTRY_COLLECTION, docId);
          }
        } else if (isCategoryCollection(item.collection)) {
          const row = categoryRows.get(item.docId);
          if (!row) {
            await dequeue(uid, item.id);
            continue;
          }
          if (isTempId(item.docId)) {
            const ref = await addDoc(
              collection(db, item.collection),
              categoryToCloud(row),
            );
            if (ref.id !== item.docId) {
              await mapTempId(item.collection, item.docId, ref.id, uid);
              categoryRows.delete(item.docId);
              categoryRows.set(ref.id, { ...row, id: ref.id, synced: 1 });
              tempToReal.set(item.docId, ref.id);
            }
            await confirmSynced(item.collection, ref.id);
          } else {
            await setDoc(
              doc(db, item.collection, docId),
              categoryToCloud(row),
            );
            await confirmSynced(item.collection, docId);
          }
        } else if (item.collection === SCHEDULED_COLLECTION) {
          const row = scheduledRows.get(item.docId);
          if (!row) {
            await dequeue(uid, item.id);
            continue;
          }
          if (isTempId(item.docId)) {
            const ref = await addDoc(
              collection(db, SCHEDULED_COLLECTION),
              scheduledToCloud(row),
            );
            if (ref.id !== item.docId) {
              await mapTempId(SCHEDULED_COLLECTION, item.docId, ref.id, uid);
              scheduledRows.delete(item.docId);
              scheduledRows.set(ref.id, { ...row, id: ref.id, synced: 1 });
              tempToReal.set(item.docId, ref.id);
            }
            await confirmSynced(SCHEDULED_COLLECTION, ref.id);
          } else {
            await setDoc(
              doc(db, SCHEDULED_COLLECTION, docId),
              scheduledToCloud(row),
            );
            await confirmSynced(SCHEDULED_COLLECTION, docId);
          }
        } else {
          // Unknown collection — nothing to push; drop the op.
          await dequeue(uid, item.id);
          continue;
        }
        pushed += 1;
        await dequeue(uid, item.id);
      } else if (item.operation === "update") {
        // Updates push the row's full current state via setDoc — idempotent,
        // and immune to "doc missing on cloud" races (setDoc creates it).
        // WR-01: before pushing, compare against the cloud copy. A full-doc
        // setDoc carries the LOCAL updatedAt (client clock), so an unsynced
        // stale edit would regress a newer cloud edit — and the pull-side
        // `>=` tie-break would then keep the stale copy forever. Push only
        // when local.updatedAt >= cloud updatedAt; when the cloud is newer,
        // drop the op and let pullChanges converge the local row to it.
        let handled = false;
        if (item.collection === ENTRY_COLLECTION) {
          const row = entryRows.get(docId);
          if (row) {
            if (row.updatedAt >= await cloudUpdatedAtOf(ENTRY_COLLECTION, docId)) {
              await setDoc(doc(db, ENTRY_COLLECTION, docId), entryToCloud(row));
              handled = true;
            }
          }
        } else if (isCategoryCollection(item.collection)) {
          const row = categoryRows.get(docId);
          if (row) {
            if (row.updatedAt >= await cloudUpdatedAtOf(item.collection, docId)) {
              await setDoc(doc(db, item.collection, docId), categoryToCloud(row));
              handled = true;
            }
          }
        } else if (item.collection === SCHEDULED_COLLECTION) {
          const row = scheduledRows.get(docId);
          if (row) {
            if (row.updatedAt >= await cloudUpdatedAtOf(SCHEDULED_COLLECTION, docId)) {
              await setDoc(
                doc(db, SCHEDULED_COLLECTION, docId),
                scheduledToCloud(row),
              );
              handled = true;
            }
          }
        }
        // Row deleted locally before this update was pushed → nothing to push.
        if (handled) {
          pushed += 1;
          await confirmSynced(item.collection, docId);
        }
        await dequeue(uid, item.id);
      } else if (item.operation === "delete") {
        // deleteDoc on a doc that was never created is a no-op success.
        await deleteDoc(doc(db, item.collection, docId));
        pushed += 1;
        await dequeue(uid, item.id);
      } else {
        // "sync" marker ops carry no payload — drop them.
        await dequeue(uid, item.id);
      }
    } catch (e) {
      // Stop draining; this item and everything after it stays queued and
      // retries on the next sync (OFFL-10).
      console.warn(
        `[sync] push failed: ${item.collection}/${item.docId} (${item.operation})`,
        e,
      );
      break;
    }
  }
  return pushed;
}

// ---- Pull -------------------------------------------------------------------

// Replace a local row with the cloud copy (cloud won last-write-wins) and
// drop any queued ops for it — the remote copy is now authoritative.
async function replaceEntryFromCloud(
  uid: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const cloudUpdatedAt = toMillis(data.updatedAt);
  await deleteEntryDb(uid, docId);
  await insertEntry({
    id: docId,
    uid,
    type: data.type === "income" ? "income" : "expense",
    amountCents: typeof data.amountCents === "number" ? data.amountCents : 0,
    categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
    date: typeof data.date === "string" ? data.date : "",
    description: typeof data.description === "string" ? data.description : "",
    createdAt: toMillis(data.createdAt) || Date.now(),
    updatedAt: cloudUpdatedAt,
    synced: 1,
  });
  await removeByDocId(uid, ENTRY_COLLECTION, docId);
}

async function replaceCategoryFromCloud(
  uid: string,
  kind: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const cloudUpdatedAt = toMillis(data.updatedAt);
  await deleteCategoryDb(uid, docId);
  await insertCategory({
    id: docId,
    uid,
    type: categoryTypeOf(kind),
    name: typeof data.name === "string" ? data.name : "",
    icon: typeof data.icon === "string" ? data.icon : "",
    createdAt: toMillis(data.createdAt) || Date.now(),
    updatedAt: cloudUpdatedAt,
    synced: 1,
  });
  await removeByDocId(uid, kind, docId);
}

async function replaceScheduledFromCloud(
  uid: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const cloudUpdatedAt = toMillis(data.updatedAt);
  await deleteScheduledDb(uid, docId);
  await insertScheduled({
    id: docId,
    uid,
    type: data.type === "income" ? "income" : "expense",
    amountCents: typeof data.amountCents === "number" ? data.amountCents : 0,
    categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
    date: typeof data.date === "string" ? data.date : "",
    description: typeof data.description === "string" ? data.description : "",
    frequency: typeof data.frequency === "string" ? data.frequency : "once",
    endDate: typeof data.endDate === "string" ? data.endDate : null,
    lastGenerated:
      typeof data.lastGenerated === "string" ? data.lastGenerated : null,
    isActive: data.isActive === 0 ? 0 : 1,
    createdAt: toMillis(data.createdAt) || Date.now(),
    updatedAt: cloudUpdatedAt,
    synced: 1,
  });
  await removeByDocId(uid, SCHEDULED_COLLECTION, docId);
}

export async function pullChanges(
  uid: string,
  lastSyncTimestamp: number,
): Promise<void> {
  // WR-02: docIds with a queued offline delete must never be resurrected by
  // the pull merge. The user deleted the row locally; the cloud copy is only
  // stale state awaiting the queued deleteDoc. Keep the delete op queued so
  // the push confirms it (dropping it here would permanently discard the
  // user's delete and resurrect the entry).
  const pendingDeletes = new Map<string, Set<string>>();
  for (const item of await getQueue(uid)) {
    if (item.operation !== "delete") continue;
    let set = pendingDeletes.get(item.collection);
    if (!set) {
      set = new Set();
      pendingDeletes.set(item.collection, set);
    }
    set.add(item.docId);
  }
  const isPendingDelete = (collectionName: string, docId: string): boolean =>
    pendingDeletes.get(collectionName)?.has(docId) ?? false;

  // --- Entries: incremental fetch of docs changed since the last sync ---
  // Requires the composite index entries: uid ASC, updatedAt ASC
  // (firestore.indexes.json — Task 9).
  const since = toTimestamp(lastSyncTimestamp);
  const changedSnap = await getDocs(
    query(
      collection(db, ENTRY_COLLECTION),
      where("uid", "==", uid),
      where("updatedAt", ">", since),
    ),
  );
  const cloudEntries = new Map(
    changedSnap.docs.map((d) => [d.id, d.data()] as [string, Record<string, unknown>]),
  );
  const localEntries = new Map(
    (await getAllEntries(uid)).map((r) => [r.id, r]),
  );

  // Merge with last-write-wins by updatedAt (SYNC-02).
  for (const [docId, data] of cloudEntries) {
    if (isPendingDelete(ENTRY_COLLECTION, docId)) continue; // WR-02
    const cloudUpdatedAt = toMillis(data.updatedAt);
    const local = localEntries.get(docId);
    if (local && local.updatedAt >= cloudUpdatedAt) continue; // local wins
    await replaceEntryFromCloud(uid, docId, data);
    localEntries.set(docId, {
      id: docId,
      uid,
      type: data.type === "income" ? "income" : "expense",
      amountCents: typeof data.amountCents === "number" ? data.amountCents : 0,
      categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
      date: typeof data.date === "string" ? data.date : "",
      description: typeof data.description === "string" ? data.description : "",
      createdAt: toMillis(data.createdAt) || Date.now(),
      updatedAt: cloudUpdatedAt,
      synced: 1,
    });
  }

  // --- Entries: remote-delete reconciliation (SYNC-03) ---
  // A clean local row (synced = 1) that is absent from the cloud was deleted
  // on another device. Rows still pending push (synced = 0) are never touched.
  const allCloudIds = new Set(
    (await getDocs(entriesBase(uid))).docs.map((d) => d.id),
  );
  for (const row of localEntries.values()) {
    if (row.synced === 1 && !allCloudIds.has(row.id)) {
      await deleteEntryDb(uid, row.id);
    }
  }

  // --- Categories: full pull of both kinds (tiny collections) + reconcile ---
  for (const kind of [
    EXPENSE_CATEGORY_COLLECTION,
    INCOME_CATEGORY_COLLECTION,
  ] as const) {
    const snap = await getDocs(categoriesOf(uid, kind));
    const cloudCategories = new Map(
      snap.docs.map((d) => [d.id, d.data()] as [string, Record<string, unknown>]),
    );
    const localCategories = new Map(
      (await getAllCategories(uid)).map((r) => [r.id, r]),
    );
    const kindType = categoryTypeOf(kind);
    for (const [docId, data] of cloudCategories) {
      if (isPendingDelete(kind, docId)) continue; // WR-02
      const cloudUpdatedAt = toMillis(data.updatedAt);
      const local = localCategories.get(docId);
      // Only the matching type participates in LWW — a local row of the other
      // type sharing an id would be wrongly overwritten by this kind's merge.
      if (local && local.type === kindType && local.updatedAt >= cloudUpdatedAt) {
        continue; // local wins
      }
      await replaceCategoryFromCloud(uid, kind, docId, data);
      localCategories.set(docId, {
        id: docId,
        uid,
        type: kindType,
        name: typeof data.name === "string" ? data.name : "",
        icon: typeof data.icon === "string" ? data.icon : "",
        createdAt: toMillis(data.createdAt) || Date.now(),
        updatedAt: cloudUpdatedAt,
        synced: 1,
      });
    }
    // Remote-delete reconciliation must only consider rows of THIS kind's
    // type — otherwise the income pass would delete every local expense
    // category (absent from the income collection) and vice versa.
    for (const row of localCategories.values()) {
      if (
        row.type === kindType &&
        row.synced === 1 &&
        !cloudCategories.has(row.id)
      ) {
        await deleteCategoryDb(uid, row.id);
      }
    }
  }

  // --- Scheduled entries: full pull + reconcile (best-effort) ---
  // The collection only exists once the Phase 12 rules (Task 8) are deployed;
  // a pre-deploy permission error must not block entries/categories sync.
  try {
    const snap = await getDocs(
      query(collection(db, SCHEDULED_COLLECTION), where("uid", "==", uid)),
    );
    const cloudScheduled = new Map(
      snap.docs.map((d) => [d.id, d.data()] as [string, Record<string, unknown>]),
    );
    const localScheduled = new Map(
      (await getAllScheduled(uid)).map((r) => [r.id, r]),
    );
    for (const [docId, data] of cloudScheduled) {
      if (isPendingDelete(SCHEDULED_COLLECTION, docId)) continue; // WR-02
      const cloudUpdatedAt = toMillis(data.updatedAt);
      const local = localScheduled.get(docId);
      if (local && local.updatedAt >= cloudUpdatedAt) continue;
      await replaceScheduledFromCloud(uid, docId, data);
      localScheduled.set(docId, {
        id: docId,
        uid,
        type: data.type === "income" ? "income" : "expense",
        amountCents:
          typeof data.amountCents === "number" ? data.amountCents : 0,
        categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
        date: typeof data.date === "string" ? data.date : "",
        description:
          typeof data.description === "string" ? data.description : "",
        frequency: typeof data.frequency === "string" ? data.frequency : "once",
        endDate: typeof data.endDate === "string" ? data.endDate : null,
        lastGenerated:
          typeof data.lastGenerated === "string" ? data.lastGenerated : null,
        isActive: data.isActive === 0 ? 0 : 1,
        createdAt: toMillis(data.createdAt) || Date.now(),
        updatedAt: cloudUpdatedAt,
        synced: 1,
      });
    }
    for (const row of localScheduled.values()) {
      if (row.synced === 1 && !cloudScheduled.has(row.id)) {
        await deleteScheduledDb(uid, row.id);
      }
    }
  } catch (e) {
    console.warn("[sync] scheduledEntries pull skipped (rules not deployed?)", e);
  }
}

// ---- Full sync --------------------------------------------------------------

let inFlight: { uid: string; promise: Promise<void> } | null = null;

// Full push+pull cycle with an in-flight lock. Same-uid concurrent callers
// (SyncButton + auto-sync + both providers' sync()) coalesce into one run; a
// different uid waits for the current run and then starts its own (account
// switch mid-sync can never drain the wrong account's queue).
export function fullSync(uid: string): Promise<void> {
  if (inFlight) {
    if (inFlight.uid === uid) return inFlight.promise;
    return inFlight.promise.then(() => fullSync(uid));
  }
  const promise = (async () => {
    try {
      await pushChanges(uid);
      const lastSync = await getLastSync(uid);
      await pullChanges(uid, lastSync ?? 0);
      await setLastSync(uid, Date.now());
    } finally {
      inFlight = null;
    }
  })();
  inFlight = { uid, promise };
  return promise;
}
