# Requirements: Money Tracking v1.2

**Defined:** 2026-08-12
**Core Value:** Logging a money entry must take under 10 seconds — from opening the app to saving — and the data must be there when the phone is offline.

## v1.2 Requirements

### Offline Storage (OFFL)

- [ ] **OFFL-01**: App uses expo-sqlite as the local source of truth for entries, categories, and scheduled entries — all reads come from SQLite, never directly from Firestore
- [ ] **OFFL-02**: On first sign-in (or new device), app fetches all Firestore data and seeds it into local SQLite — subsequent reads are local-only
- [ ] **OFFL-03**: App is fully functional without internet — all screens (Home, Expenses, Income, Categories, Export, Account) work offline with data from the last sync
- [ ] **OFFL-04**: All writes (add/edit/delete entry, add/edit/delete category) go to SQLite first, then queue for Firestore sync
- [ ] **OFFL-05**: A `syncQueue` table tracks pending changes (create/update/delete) with collection name, doc ID, operation, and timestamp
- [ ] **OFFL-06**: When online, app pushes pending syncQueue items to Firestore in order (creates first, then updates, then deletes)
- [ ] **OFFL-07**: When online, app pulls remote changes from Firestore since last sync timestamp and merges into SQLite (last-write-wins by `updatedAt`)
- [ ] **OFFL-08**: On new device sign-in, Firestore data is pulled and seeded into empty SQLite — existing entries are not duplicated (idempotent)
- [ ] **OFFL-09**: Sync status indicator shows when data is pending sync (offline badge or sync count)
- [ ] **OFFL-10**: App handles network errors gracefully during sync — queued changes persist in SQLite until next successful sync

### Cloud Sync (SYNC)

- [ ] **SYNC-01**: Push operations: entries, categories, and scheduled entries are synced to Firestore with correct collection paths and field names (amountCents, not amount)
- [ ] **SYNC-02**: Pull operations: Firestore documents are merged into SQLite using last-write-wins based on `updatedAt` timestamp
- [ ] **SYNC-03**: Delete sync: local deletes propagate to Firestore; remote deletes propagate to local SQLite
- [ ] **SYNC-04**: ID mapping: locally-created entries with temp IDs are remapped to Firestore doc IDs after successful push
- [ ] **SYNC-05**: Manual sync button triggers full push+pull cycle (existing SyncButton wired to new sync service)
- [ ] **SYNC-06**: Auto-sync on app foreground: when app comes to foreground and is online, attempt sync
- [ ] **SYNC-07**: Firestore security rules unchanged — `scheduledEntries` collection added with same uid-scoping pattern
- [ ] **SYNC-08**: Firestore composite indexes updated for scheduledEntries queries

### Scheduled Entries (SCHD)

- [ ] **SCHD-01**: New Firestore collection `scheduledEntries` with fields: uid, type, amountCents, categoryId, date, description, frequency, endDate, lastGenerated, isActive, createdAt
- [ ] **SCHD-02**: Frequency options: `once`, `daily`, `weekly`, `monthly`, `yearly`
- [ ] **SCHD-03**: `endDate` is optional — when set, the scheduled entry stops generating after that date
- [ ] **SCHD-04**: On app startup, auto-generation engine runs: for each active scheduled entry, generate real Entry docs for dates between `lastGenerated` (or `date` if never generated) and today
- [ ] **SCHD-05**: Frequency matching: `once` generates once then deactivates; `daily` generates each day; `weekly` generates each 7 days; `monthly` generates on month boundaries; `yearly` generates on year boundaries
- [ ] **SCHD-06**: Auto-generated entries are written to SQLite and queued for Firestore sync (works offline)
- [ ] **SCHD-07**: `lastGenerated` is updated after each generation run to prevent duplicates
- [ ] **SCHD-08**: Scheduled entries can be paused (isActive=false) without deleting them
- [ ] **SCHD-09**: CRUD operations for scheduled entries (create, read, update, delete) via SQLite provider
- [ ] **SCHD-10**: Same input fields as regular entries (amount, category, date, description) plus frequency and optional end date

### Export Tab — Scheduled UI (SCHD-UI)

- [ ] **SCHD-UI-01**: Export screen gains a "Scheduled Entries" section below the existing export controls
- [ ] **SCHD-UI-02**: Section shows a list of all scheduled entries grouped by type (expenses, income)
- [ ] **SCHD-UI-03**: Each row shows: category icon, description (or category name), amount, frequency label, next date
- [ ] **SCHD-UI-04**: Swipe actions: Edit (opens form), Delete (with confirmation), Pause/Resume toggle
- [ ] **SCHD-UI-05**: "Add Scheduled" button opens a creation form
- [ ] **SCHD-UI-06**: Creation/edit form has same fields as EntryForm (amount, category, date, description) plus frequency picker and optional end date
- [ ] **SCHD-UI-07**: Frequency picker: segmented control or dropdown with 5 options (once, daily, weekly, monthly, yearly)
- [ ] **SCHD-UI-08**: End date field only shown when frequency is not "once" (since once has no repeat range)
- [ ] **SCHD-UI-09**: Form validates: amount > 0, category selected, date not in the past, endDate after startDate if provided

### Homepage — Upcoming Indicators (HOME-UP)

- [ ] **HOME-UP-01**: Home screen shows "Upcoming Expenses" section with yellow-red color theme
- [ ] **HOME-UP-02**: Home screen shows "Upcoming Income" section with yellow-blue color theme
- [ ] **HOME-UP-03**: Sections display ALL active scheduled entries (not just next 7 days)
- [ ] **HOME-UP-04**: Each upcoming row shows: category icon, description, amount, frequency, next occurrence date
- [ ] **HOME-UP-05**: Sections are hidden when no scheduled entries exist for that type
- [ ] **HOME-UP-06**: Tapping an upcoming row navigates to edit the scheduled entry
- [ ] **HOME-UP-07**: Sections appear between the quick-action buttons and the chart sections

### Non-Functional (NFR)

- [ ] **NFR-11**: expo-sqlite is bundled in Expo Go SDK 57 — no dev build required
- [ ] **NFR-12**: SQLite operations do not block the UI — async reads, minimal synchronous writes
- [ ] **NFR-13**: Existing entry/category data from v1.0/v1.1 is preserved during migration to SQLite
- [ ] **NFR-14**: Sync queue does not grow unbounded — items are removed after successful Firestore sync
- [ ] **NFR-15**: Scheduled entry auto-generation runs in <500ms for up to 50 active scheduled entries
- [ ] **NFR-16**: App startup time (SQLite load) is under 1 second for up to 1000 entries

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OFFL-01 | Phase 11: SQLite Local Database | Pending |
| OFFL-02 | Phase 11: SQLite Local Database | Pending |
| OFFL-03 | Phase 12: Offline-First Providers | Pending |
| OFFL-04 | Phase 12: Offline-First Providers | Pending |
| OFFL-05 | Phase 12: Offline-First Providers | Pending |
| OFFL-06 | Phase 12: Offline-First Providers + Sync | Pending |
| OFFL-07 | Phase 12: Offline-First Providers + Sync | Pending |
| OFFL-08 | Phase 12: Offline-First Providers + Sync | Pending |
| OFFL-09 | Phase 12: Offline-First Providers | Pending |
| OFFL-10 | Phase 12: Offline-First Providers + Sync | Pending |
| SYNC-01 | Phase 12: Sync Service | Pending |
| SYNC-02 | Phase 12: Sync Service | Pending |
| SYNC-03 | Phase 12: Sync Service | Pending |
| SYNC-04 | Phase 12: Sync Service | Pending |
| SYNC-05 | Phase 12: Sync Service | Pending |
| SYNC-06 | Phase 12: Sync Service | Pending |
| SYNC-07 | Phase 12: Firestore Rules | Pending |
| SYNC-08 | Phase 12: Firestore Indexes | Pending |
| SCHD-01 | Phase 13: Scheduled Entries Data | Pending |
| SCHD-02 | Phase 13: Scheduled Entries Data | Pending |
| SCHD-03 | Phase 13: Scheduled Entries Data | Pending |
| SCHD-04 | Phase 13: Auto-Generation Engine | Pending |
| SCHD-05 | Phase 13: Auto-Generation Engine | Pending |
| SCHD-06 | Phase 13: Auto-Generation Engine | Pending |
| SCHD-07 | Phase 13: Auto-Generation Engine | Pending |
| SCHD-08 | Phase 13: Scheduled Entries Data | Pending |
| SCHD-09 | Phase 13: Scheduled Entries Provider | Pending |
| SCHD-10 | Phase 13: Scheduled Entries Form | Pending |
| SCHD-UI-01 | Phase 14: Export Tab UI | Pending |
| SCHD-UI-02 | Phase 14: Export Tab UI | Pending |
| SCHD-UI-03 | Phase 14: Export Tab UI | Pending |
| SCHD-UI-04 | Phase 14: Export Tab UI | Pending |
| SCHD-UI-05 | Phase 14: Export Tab UI | Pending |
| SCHD-UI-06 | Phase 14: Scheduled Entry Form | Pending |
| SCHD-UI-07 | Phase 14: Scheduled Entry Form | Pending |
| SCHD-UI-08 | Phase 14: Scheduled Entry Form | Pending |
| SCHD-UI-09 | Phase 14: Scheduled Entry Form | Pending |
| HOME-UP-01 | Phase 15: Homepage Upcoming | Pending |
| HOME-UP-02 | Phase 15: Homepage Upcoming | Pending |
| HOME-UP-03 | Phase 15: Homepage Upcoming | Pending |
| HOME-UP-04 | Phase 15: Homepage Upcoming | Pending |
| HOME-UP-05 | Phase 15: Homepage Upcoming | Pending |
| HOME-UP-06 | Phase 15: Homepage Upcoming | Pending |
| HOME-UP-07 | Phase 15: Homepage Upcoming | Pending |
| NFR-11 | Phase 11: SQLite Local Database | Pending |
| NFR-12 | Phase 11: SQLite Local Database | Pending |
| NFR-13 | Phase 11: Migration | Pending |
| NFR-14 | Phase 12: Sync Service | Pending |
| NFR-15 | Phase 13: Auto-Generation Engine | Pending |
| NFR-16 | Phase 11: SQLite Local Database | Pending |

## Coverage

- v1.2 requirements: 43 total
- Completed: 0
- Pending: 43
- Mapped to phases: 43
- Unmapped: 0 ✓

---

*Requirements defined: 2026-08-12*
