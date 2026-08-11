# Roadmap: Money Tracking

## Overview

A personal expense/income tracker for the phone (Expo Go workflow): sign in with email/password, log entries in under 10 seconds with session-scoped offline persistence, manage per-type categories, view the current-month summary, and export date-range PDF/Excel/CSV summaries to the phone. The journey is a dependency chain — auth gates everything → categories feed entry forms → entries feed summary and exports → account lifecycle wraps it all. Export (Phase 5) is the riskiest platform code and is deliberately isolated after the data layer is proven.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-08-09) — [full roadmap](milestones/v1.0-ROADMAP.md) · [requirements](milestones/v1.0-REQUIREMENTS.md)
- ✅ **v1.1 Theme, Budget, Icons, Charts** — Phases 7-10 (shipped 2026-08-09) — [full roadmap](milestones/v1.1-ROADMAP.md) · [requirements](milestones/v1.1-REQUIREMENTS.md)

## Phases

**Phase Numbering:**

- Integer phases (1–6): v1.0 (archived)
- Integer phases (7–10): v1.1 (archived)
- Future phases: v1.2+ (to be defined)

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-08-09</summary>

- [x] Phase 1: Foundation — Expo SDK 57, Firebase, auth, navigation
- [x] Phase 2: Categories — Firestore CRUD, default categories
- [x] Phase 3: Entries — Entry logging, offline-first, list views
- [x] Phase 4: Summary — Current-month summary, totals
- [x] Phase 5: Export — PDF/Excel/CSV export via expo-print, xlsx
- [x] Phase 6: Account Lifecycle — Create/delete accounts, cascade

</details>

<details>
<summary>✅ v1.1 Theme, Budget, Icons, Charts (Phases 7-10) — SHIPPED 2026-08-09</summary>

- [x] Phase 7: Theme Overhaul (1/1 plans) — completed 2026-08-09
- [x] Phase 8: Budget (1/1 plans) — completed 2026-08-09
- [x] Phase 9: Category Icons (1/1 plans) — completed 2026-08-09
- [x] Phase 10: Charts (1/1 plans) — completed 2026-08-09

</details>

### 📋 v1.2 Offline-First + Recurring Entries (Planned)

- [ ] **Phase 11: SQLite Local Database** — expo-sqlite setup, schema, seed from Firestore
- [ ] **Phase 12: Offline-First Providers + Sync** — Refactor providers to SQLite; sync service with push/pull
- [ ] **Phase 13: Recurring Entries Data Layer** — scheduledEntries table, provider, auto-generation engine
- [ ] **Phase 14: Export Tab — Scheduled UI** — Management list + create/edit form in ExportScreen
- [ ] **Phase 15: Homepage — Upcoming Indicators** — Yellow-red expenses, yellow-blue income sections

## Phase Details

### Phase 11: SQLite Local Database

**Goal**: Establish expo-sqlite as the local source of truth — database schema (entries, categories, scheduledEntries, syncQueue), CRUD modules, and Firestore seed on first sign-in.
**Mode:** mvp
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: OFFL-01, OFFL-02, NFR-11, NFR-12, NFR-13, NFR-16
**Success Criteria** (what must be TRUE):

  1. expo-sqlite installed via `npx expo install` — bundled in Expo Go SDK 57, no dev build
  2. `src/db/database.ts` initializes the DB and creates tables on first run (entries, categories, scheduledEntries, syncQueue)
  3. `src/db/entries.ts` provides SQLite CRUD: getAllEntries, getEntriesByType, insertEntry, updateEntry, deleteEntry, getUnsyncedEntries, markSynced
  4. `src/db/categories.ts` provides the same SQLite CRUD surface for categories
  5. `src/db/scheduled.ts` provides SQLite CRUD for scheduled entries (all/active variants)
  6. `src/db/syncQueue.ts` provides enqueue/dequeue/getQueue/clearQueue/removeByDocId
  7. `seedFromFirestore(uid)` fetches all entries/categories from Firestore into SQLite — idempotent (skips if uid already seeded)
  8. App.tsx wires seed on auth state change: empty SQLite → seed, populated → skip
  9. `npx tsc --noEmit` passes; manual verification: sign-in seeds data, kill+reopen persists from SQLite

### Phase 12: Offline-First Providers + Sync

**Goal**: Entries and Categories providers read/write SQLite first; a sync service pushes syncQueue changes to Firestore and pulls remote changes with last-write-wins; auto-sync on foreground plus manual sync button.
**Mode:** mvp
**Depends on**: Phase 11
**Requirements**: OFFL-03, OFFL-04, OFFL-05, OFFL-06, OFFL-07, OFFL-08, OFFL-09, OFFL-10, SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07, SYNC-08
**Success Criteria** (what must be TRUE):

  1. EntriesProvider reads from SQLite (getAllEntries) and writes SQLite + syncQueue for create/update/delete — same external API
  2. CategoriesProvider follows the same SQLite-first pattern
  3. `src/sync/syncService.ts` provides pushChanges (creates/updates/deletes via queue), pullChanges (since lastSyncTimestamp, LWW by updatedAt), fullSync (push then pull)
  4. `src/sync/idMapping.ts` remaps temp IDs to Firestore doc IDs after push
  5. `src/sync/syncMetadata.ts` persists lastSyncTimestamp
  6. Auto-sync on app foreground (AppState) when online; manual SyncButton wired to fullSync with pending count + last sync time
  7. Firestore rules add scheduledEntries (uid-scoped); indexes add scheduledEntries composite (uid, isActive, date)
  8. Offline: add/edit/delete works with no network; kill+reopen offline keeps data; reconnecting syncs to Firestore
  9. New device sign-in seeds from Firestore without duplicating (idempotent)
  10. `npx tsc --noEmit` passes

### Phase 13: Recurring Entries Data Layer

**Goal**: ScheduledEntriesProvider (SQLite-backed), frequency utilities, and an auto-generation engine that creates real entries on app startup for active scheduled entries.
**Mode:** mvp
**Depends on**: Phase 11, Phase 12
**Requirements**: SCHD-01, SCHD-02, SCHD-03, SCHD-04, SCHD-05, SCHD-06, SCHD-07, SCHD-08, SCHD-09, SCHD-10, NFR-15
**Success Criteria** (what must be TRUE):

  1. ScheduledEntriesProvider exposes scheduledEntries, addScheduled, updateScheduled, deleteScheduled, pauseScheduled, resumeScheduled — SQLite-backed with sync queue
  2. Provider wired in App.tsx alongside existing providers
  3. `src/lib/frequency.ts` provides matchesFrequency, getNextDate, formatFrequency (Once/Daily/Weekly/Monthly/Yearly)
  4. `src/lib/dates.ts` gains isSameDay, daysBetween, addMonths, addYears
  5. `src/scheduled/scheduler.ts` provides runScheduler(uid), getDatesToGenerate, generateEntry — creates entries from lastGenerated/date to today, updates lastGenerated
  6. Scheduler runs on app startup in background (non-blocking); generated entries appear in the entries list
  7. once → generates once then deactivates; daily/weekly/monthly/yearly generate per boundary; offline generation works (SQLite + queue)
  8. Paused (isActive=false) entries do not generate
  9. `npx tsc --noEmit` passes; manual verification: daily expense from yesterday generates yesterday+today on reopen

### Phase 14: Export Tab — Scheduled UI

**Goal**: Scheduled entry management UI in ExportScreen — ScheduledEntryRow list grouped by type, add/edit form (frequency picker, optional end date), swipe actions for edit/delete/pause/resume.
**Mode:** mvp
**Depends on**: Phase 13
**Requirements**: SCHD-UI-01, SCHD-UI-02, SCHD-UI-03, SCHD-UI-04, SCHD-UI-05, SCHD-UI-06, SCHD-UI-07, SCHD-UI-08, SCHD-UI-09
**Success Criteria** (what must be TRUE):

  1. ScheduledEntryRow renders category icon, description/name, formatted amount, frequency label, next date — matching EntryRow styling
  2. Swipe actions: Edit (blue), Delete (red, confirmation), Pause/Resume (grey)
  3. ScheduledEntryForm: same base fields as EntryForm plus frequency picker (5 options) and optional end date (hidden when frequency = once)
  4. Form validates: amount > 0, category selected, endDate after startDate when provided
  5. Form registered as modal screen in the Stack Navigator (EntryForm pattern)
  6. ExportScreen gains "Scheduled Entries" section below export controls with "Add Scheduled" button, Expenses/Income sub-sections, empty state message
  7. Tap row → edit mode; swipe edit/delete/pause/resume all functional
  8. `npx tsc --noEmit` passes

### Phase 15: Homepage — Upcoming Indicators

**Goal**: Home screen shows "Upcoming Expenses" (yellow-red) and "Upcoming Income" (yellow-blue) sections listing active scheduled entries with next occurrence, between quick-action buttons and chart sections.
**Mode:** mvp
**Depends on**: Phase 13
**Requirements**: HOME-UP-01, HOME-UP-02, HOME-UP-03, HOME-UP-04, HOME-UP-05, HOME-UP-06, HOME-UP-07
**Success Criteria** (what must be TRUE):

  1. UpcomingSection component: title, items, color theme, onTapItem — renders icon, description/name, amount, frequency, next date
  2. Expenses theme: yellow background (rgba(248,197,25,0.08)), red accent (#DC2626); Income theme: yellow background, teal accent (#45C0CF)
  3. Sections hidden when empty; all active scheduled entries shown (not limited to 7 days)
  4. HomeScreen renders both sections between quick-action buttons and chart sections
  5. Tapping a row navigates to ScheduledEntryForm in edit mode
  6. Theme tokens added for upcoming backgrounds/borders
  7. `npx tsc --noEmit` passes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-08-09 |
| 2. Categories | v1.0 | 2/2 | Complete | 2026-08-09 |
| 3. Entries | v1.0 | 3/3 | Complete | 2026-08-09 |
| 4. Summary | v1.0 | 1/1 | Complete | 2026-08-09 |
| 5. Export | v1.0 | 2/2 | Complete | 2026-08-09 |
| 6. Account Lifecycle | v1.0 | 1/1 | Complete | 2026-08-09 |
| 7. Theme Overhaul | v1.1 | 1/1 | Complete | 2026-08-09 |
| 8. Budget | v1.1 | 1/1 | Complete | 2026-08-09 |
| 9. Category Icons | v1.1 | 1/1 | Complete | 2026-08-09 |
| 10. Charts | v1.1 | 1/1 | Complete | 2026-08-09 |
| 11. SQLite Local Database | v1.2 | 0/1 | Planned | — |
| 12. Offline-First Providers + Sync | v1.2 | 0/1 | Planned | — |
| 13. Recurring Entries Data Layer | v1.2 | 0/1 | Planned | — |
| 14. Export Tab — Scheduled UI | v1.2 | 0/1 | Planned | — |
| 15. Homepage — Upcoming Indicators | v1.2 | 0/1 | Planned | — |
