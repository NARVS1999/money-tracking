// Auto-generation engine for recurring entries (Phase 13, SCHD-02/03/04).
// runScheduler(uid) is called once at app startup (after entries + categories
// load): it reads every ACTIVE scheduled template from SQLite, materializes
// the real entries owed between the template's lastGenerated (or start date)
// and today, inserts them into SQLite as ordinary entries, enqueues each for
// Firestore sync, then advances the template's lastGenerated so the next run
// only generates what is newly due.
//
// Offline behavior (SCHD-09): everything reads/writes SQLite — templates,
// generated entries, and the sync queue — so a device with no network still
// generates and stores its recurring entries; the queue pushes them when
// connectivity returns.
//
// Generated entries use temp ids (src/sync/idMapping) exactly like
// user-created offline entries; the sync service remaps them after push.
import { insertEntry, type EntryType } from "../db/entries";
import {
  getActiveScheduled,
  updateScheduled,
  type DbScheduledEntry,
} from "../db/scheduled";
import { enqueue } from "../db/syncQueue";
import { generateTempId } from "../sync/idMapping";
import { addDays, compare, today } from "../lib/dates";
import { matchesFrequency, type Frequency } from "../lib/frequency";

// Structural twin of EntriesProvider's EntryInput, declared here so the
// engine stays dependency-free (no React/firebase graph) and testable with
// only the sqlite mock.
export type GeneratedEntryInput = {
  type: EntryType;
  amount: number; // integer cents
  categoryId: string;
  date: string; // YYYY-MM-DD
  description: string;
};

// Safety bound for the day-by-day scan — ~13.7 years of daily catch-up is
// far beyond any real template, and the loop must never spin forever on
// corrupted data.
const MAX_SCAN_DAYS = 5000;

// Dates between the template's start/lastGenerated and `todayStr` that are
// real occurrences of the frequency pattern, not yet generated, and within
// endDate. The scan starts at the start date on the first ever run (the
// start date itself is an occurrence — "once" generates exactly it), and the
// day after lastGenerated on later runs. In-range check is day-by-day with
// a bound; a personal ledger makes this trivially cheap.
export function getDatesToGenerate(
  scheduled: Pick<
    DbScheduledEntry,
    "date" | "frequency" | "endDate" | "lastGenerated"
  >,
  todayStr: string,
): string[] {
  const frequency = scheduled.frequency as Frequency;
  const start = scheduled.date;
  const lastGenerated = scheduled.lastGenerated;
  const endDate = scheduled.endDate;
  const dates: string[] = [];
  let d = lastGenerated ? addDays(lastGenerated, 1) : start;
  for (let i = 0; i <= MAX_SCAN_DAYS && compare(d, todayStr) <= 0; i++) {
    if (matchesFrequency(d, frequency, start)) {
      if (!endDate || compare(d, endDate) <= 0) dates.push(d);
    }
    d = addDays(d, 1);
  }
  return dates;
}

// Build the entry payload a template generates for one specific occurrence
// date. Description passes through verbatim so users can recognize the
// recurring source by eye (no prefix marker in the plan).
export function generateEntry(
  scheduled: Pick<
    DbScheduledEntry,
    "type" | "amountCents" | "categoryId" | "description"
  >,
  date: string,
): GeneratedEntryInput {
  return {
    type: scheduled.type,
    amount: scheduled.amountCents,
    categoryId: scheduled.categoryId,
    date,
    description: scheduled.description,
  };
}

// Generate every entry currently owed by the uid's active templates.
// Returns the number of entries generated (0 = nothing due). Each generated
// entry is inserted into SQLite and queued as a create on the "entries"
// collection; after a template's dates are all materialized, lastGenerated
// advances to its last generated date and that advancement is enqueued as a
// "scheduledEntries" update — push is strictly queue-driven, so this op is
// what propagates the advancement to Firestore (SCHD-05, CR-01).
export async function runScheduler(uid: string): Promise<number> {
  const templates = await getActiveScheduled(uid);
  const todayStr = today();
  let generated = 0;
  for (const template of templates) {
    const dates = getDatesToGenerate(template, todayStr);
    if (dates.length === 0) continue;
    for (const date of dates) {
      const input = generateEntry(template, date);
      const id = generateTempId();
      const now = Date.now();
      await insertEntry({
        id,
        uid,
        type: input.type,
        amountCents: input.amount,
        categoryId: input.categoryId,
        date: input.date,
        description: input.description,
        createdAt: now,
        updatedAt: now,
        synced: 0,
      });
      await enqueue(uid, "entries", id, "create");
      generated++;
    }
    await updateScheduled(uid, template.id, {
      lastGenerated: dates[dates.length - 1],
      // Bump updatedAt like the provider's own updateScheduled: the cloud
      // copy must lose last-write-wins to this advancement on other devices
      // (CR-01), and the push-time gate (syncService WR-01) must see the
      // local copy as at-least-as-new before it will setDoc it.
      updatedAt: Date.now(),
    });
    // CR-01: the advancement must reach Firestore or a fresh pull of this
    // template (second device, reinstall, DB wipe + reseed) regenerates the
    // whole history — duplicate entries in the ledger. Without this op the
    // cloud copy keeps its old lastGenerated forever.
    await enqueue(uid, "scheduledEntries", template.id, "update");
  }
  return generated;
}
