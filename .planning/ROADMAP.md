# Roadmap: Money Tracking

## Overview

A personal expense/income tracker for the phone (Expo Go workflow): sign in with email/password, log entries in under 10 seconds with session-scoped offline persistence, manage per-type categories, view the current-month summary, and export date-range PDF/Excel/CSV summaries to the phone. The journey is a dependency chain — auth gates everything → categories feed entry forms → entries feed summary and exports → account lifecycle (create/delete) wraps it all. Export (Phase 5) is the riskiest platform code and is deliberately isolated after the data layer is proven.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Expo SDK 57 + Firebase bootstrap, auth gate with persistent session, money/date utils, uid-scoped query scaffolding, security rules (completed 2026-08-07)
- [ ] **Phase 2: Categories** - Two category groups with inline add, usage counts, and in-use delete guard
- [ ] **Phase 3: Entries** - Expenses/Income tabs with shared entry form: add/edit/delete/copy, per-type dropdowns, session-scoped offline
- [ ] **Phase 4: Summary** - Home screen current-month totals and per-category breakdown with empty state
- [ ] **Phase 5: Export** - Date-range PDF/Excel/CSV exports saved to Downloads with share-sheet fallback (HIGH risk — SAF/SheetJS)
- [ ] **Phase 6: Account Lifecycle** - In-app account creation, cascading account deletion, default-account protection, sign out

## Phase Details

### Phase 1: Foundation

**Goal**: User can sign in with email/password and reach an empty, uid-scoped app shell; the ledger is secure and every later phase has its money/date/query foundations.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, NFR-01, NFR-03, NFR-04, NFR-05, NFR-06
**Success Criteria** (what must be TRUE):

  1. On first launch the app opens to the Sign In screen (no sign-up screen on first run); signing in with the seeded default account's credentials opens the app
  2. Wrong credentials show an inline error on the Sign In screen and the user stays there
  3. The session persists across an app restart — reopening the app lands on Home without signing in again
  4. A signed-in user's ledger is uid-scoped: queries carry a `uid` filter and the deployed security rules reject cross-account access (verified with a second test account)
  5. Amounts enter/leave as integer cents formatted via `money.js` only, and dates are local `"YYYY-MM-DD"` strings (no UTC slicing) — spot-checked in the entry form and console

**Plans**: 3/3 plans executed

Plans:

- [x] 01-01-PLAN.md
- [x] 01-02-PLAN.md
- [x] 01-03-PLAN.md

**Wave 1**

- [x] 01-01: Expo SDK 57 bootstrap + Firebase init — `firebase` ^12 JS SDK, AsyncStorage 2.2.0 auth persistence via `initializeAuth`, memory-cache Firestore (no `persistentLocalCache`), `expo-file-system/legacy` import decision

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02: AuthProvider + Sign In screen + auth gate — `onAuthStateChanged` gating, inline credential errors, session persistence across restarts
- [x] 01-03: `money.js` + `dates.js` utils, centralized uid-scoped query builders, Firestore security rules + composite index (`type ASC, date DESC`) deployment

### Phase 2: Categories

**Goal**: User can manage their two category groups (expense/income) with inline add, usage counts, and a safe delete guard.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CATS-01, CATS-02, CATS-03, CATS-04
**Success Criteria** (what must be TRUE):

  1. The Categories tab shows Expense Categories and Income Categories as two separate groups
  2. User can add a category to either group via inline input; it appears in its group and in the matching entry dropdown immediately
  3. Each category row shows its usage count (number of entries using it), updating as entries are added
  4. A category in use cannot be deleted — deletion is blocked with a message; an unused category deletes only after confirmation

**Plans**: 1/2 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — TDD: CategoriesProvider — addCategory (dup check), deleteCategory (in-use guard), usageMap from entries onSnapshot

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — Tracer: CategoriesScreen — SectionList 2 groups + sticky headers + per-group inline add + Swipeable rows (in-use/delete) + live usage counts + App.tsx wiring

### Phase 3: Entries

**Goal**: User can log, edit, delete, and copy expense/income entries in under 10 seconds — with the data visible even offline mid-session.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ENTR-01, ENTR-02, ENTR-03, ENTR-04, ENTR-05, ENTR-06, ENTR-07, ENTR-08, NFR-02
**Success Criteria** (what must be TRUE):

  1. User logs an expense or income entry (amount, category, date, optional description ≤200 chars) and sees it in the list immediately
  2. The entry form's category dropdown lists only the matching tab's categories (expense tab → expense categories)
  3. Amount input accepts up to 2 decimals (₱24.50) and displays with ₱ and thousand separators; the date defaults to today, past dates are selectable, future dates are blocked
  4. User can edit an entry (form pre-filled, saves to the same entry), delete it after a confirmation dialog, and copy it (same category/amount/description, date reset to today, saved as a new entry with the original untouched)
  5. With the phone in airplane mode mid-session, entries still save and appear immediately; a visible indicator shows pending sync, and data reconciles when the network returns

**Plans**: 3 plans

Plans:

- [ ] 03-01: EntriesProvider (uid-scoped `onSnapshot`, re-subscribe per `user.uid`, unsubscribe on sign-out) + Expenses/Income tabs with entry lists
- [ ] 03-02: Shared entry form — add/edit/copy pre-fill, per-type dropdown, integer-cents amount input, local-date picker with `maximumDate`, keyboard handling
- [ ] 03-03: Delete confirmation + offline-sync indicator (`hasPendingWrites`/`fromCache`) and `.catch()` handling on every write

### Phase 4: Summary

**Goal**: User can see at a glance what was spent and earned this month, and per category.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SUMM-01, SUMM-02, SUMM-03
**Success Criteria** (what must be TRUE):

  1. The Home screen shows large total spent and total earned for the current month (40–48pt tabular numerals, green/red by direction)
  2. The Home screen shows a per-category breakdown (spent and/or earned per category) for the current month
  3. A month with no entries shows an empty state ("Nothing logged this month") with an add CTA
  4. The summary updates immediately when an entry is added, edited, or deleted — no manual refresh, correct at month boundaries

**Plans**: 2 plans

Plans:

- [ ] 04-01: Home screen derived summary — reduce cached entries over `monthRange()` for totals + per-category breakdown (no aggregation queries)
- [ ] 04-02: Empty state + add CTA, month-boundary correctness, and live update verification

### Phase 5: Export

**Goal**: User can export any date range to PDF, Excel, and CSV — with the file saved to Downloads (Android) or shared (iOS) and a success confirmation showing the file name.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: EXPT-01, EXPT-02, EXPT-03, EXPT-04, EXPT-05
**Success Criteria** (what must be TRUE):

  1. The Export screen defaults to the current month; start and end dates are selectable independently; To before From is blocked
  2. PDF export contains total expense, total income, per-category totals, and the entry list for the range; the file lands in Downloads (Android) or the share sheet (iOS) and success shows the file name
  3. Excel export contains the same data in one sheet, one row per entry, with a totals row
  4. CSV export contains the same data (one row per entry + totals)
  5. Exported entries respect the date range exactly (first/last day included, outside entries excluded)

**Plans**: 3 plans
**Research flag**: HIGH — SAF (StorageAccessFramework via `expo-file-system/legacy`) + SheetJS CDN tarball + base64 writes are the least textbook code in the app; needs a research pass at plan time and device testing on both platforms via QR workflow.

Plans:

- [ ] 05-01: Export screen — date range picker, uid-scoped range query, range validation, filename confirmation flow
- [ ] 05-02: PDF pipeline — `export.js` (range query → totals → PDF HTML) + `expo-print` `printToFileAsync` → cache → SAF copy to Downloads / share sheet (iOS)
- [ ] 05-03: Excel + CSV writers — SheetJS 0.20.3 from CDN, `XLSX.write(..., { type: "base64" })` + `writeAsStringAsync` base64 path, `files.js` SAF wrapper (the only `Platform.OS` branch)

### Phase 6: Account Lifecycle

**Goal**: User can create additional accounts in-app and delete an account (with full cascade), while the seeded default account stays protected — and sign out from anywhere.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):

  1. User can create an account in-app (display name, email, password ≥6 chars); it starts with an empty ledger and the app signs into the new account immediately
  2. The default account shows a "Default" badge and never offers a delete option in the Account tab
  3. User can delete a non-default account: password reauthentication → all data gone (verified with 600+ entries: no dangling docs) → back to Sign In
  4. User can sign out from the Account tab and sign back into any account

**Plans**: 2 plans
**Research flag**: MEDIUM — cascade concurrency/partial-failure surface; keep the chunked loop idempotent.

Plans:

- [ ] 06-01: In-app account creation — sign-up, `users/{uid}` doc write, immediate sign-in to the new empty ledger
- [ ] 06-02: Account deletion — reauth gate (disabled offline) → chunked cascade ≤500 docs/batch (entries → categories → users doc → `deleteUser()` last) → Sign In; default-account badge/guard; sign out

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete    | 2026-08-07 |
| 2. Categories | 1/2 | In Progress|  |
| 3. Entries | 0/3 | Not started | - |
| 4. Summary | 0/2 | Not started | - |
| 5. Export | 0/3 | Not started | - |
| 6. Account Lifecycle | 0/2 | Not started | - |
