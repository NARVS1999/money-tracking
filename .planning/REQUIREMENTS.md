# Requirements: Money Tracking

**Defined:** 2026-08-06
**Core Value:** Logging a money entry must take under 10 seconds — from opening the app to saving — and the data must be there when the phone is offline.

## v1 Requirements

### Accounts (AUTH)

- [x] **AUTH-01**: User can sign in with email/password on first launch (no sign-up screen on first run; the seeded default account signs in like any other)
- [x] **AUTH-02**: User session persists across app restarts
- [x] **AUTH-03**: Wrong credentials show an inline error on the Sign In screen
- [ ] **AUTH-04**: User can create an additional account in-app (display name, email, password min 6 chars) which starts with an empty ledger and signs into the new account immediately
- [ ] **AUTH-05**: The default account (seeded at setup, `isDefault: true`) shows a "Default" badge and cannot be deleted in-app
- [ ] **AUTH-06**: User can delete an account: password reauthentication → cascade delete (entries → categories → users doc → auth account, chunked ≤500 docs/batch) → back to Sign In
- [ ] **AUTH-07**: User can sign out from the Account tab

### Categories (CATS)

- [x] **CATS-01**: Categories tab shows Expense Categories and Income Categories as two separate groups
- [x] **CATS-02**: User can add a category to either group (inline input)
- [x] **CATS-03**: Each category row shows its usage count (number of entries using it)
- [x] **CATS-04**: A category in use cannot be deleted — deletion is blocked with a message; an empty category can be deleted after confirmation

### Entries (ENTR)

- [x] **ENTR-01**: User can log an expense or income entry with amount, category, date, and optional description (≤200 chars)
- [ ] **ENTR-02**: Entry form category dropdown lists only the matching tab's categories (expense tab → expense categories)
- [ ] **ENTR-03**: Amount input accepts up to 2 decimals (₱24.50); stored as integer cents; displayed with ₱ and thousand separators
- [ ] **ENTR-04**: Date defaults to today; any past date selectable; future dates blocked
- [x] **ENTR-05**: Saved entry is visible immediately, even offline (session-scoped offline persistence; no network required mid-session)
- [ ] **ENTR-06**: User can edit an entry — tapping it opens the form pre-filled; changes save back to the same entry
- [ ] **ENTR-07**: User can delete an entry after a confirmation dialog
- [ ] **ENTR-08**: User can copy an entry — form pre-filled with same category, amount, description, date reset to today; saves as a new entry, original untouched

### Summary (SUMM)

- [ ] **SUMM-01**: Home screen shows large total spent and total earned for the current month
- [ ] **SUMM-02**: Home screen shows a per-category breakdown for the current month
- [ ] **SUMM-03**: A month with no entries shows an empty state ("Nothing logged this month" + add CTA)

### Export (EXPT)

- [ ] **EXPT-01**: Export screen defaults to the current month; start and end dates selectable independently; To cannot be before From
- [ ] **EXPT-02**: PDF export contains total expense, total income, per-category totals, and the entry list in range
- [ ] **EXPT-03**: Excel export contains the same data, one sheet, one row per entry, with a totals row
- [ ] **EXPT-04**: CSV export contains the same data (one row per entry + totals)
- [ ] **EXPT-05**: Exports are saved to the phone's Downloads folder (Android) with share-sheet fallback (iOS); success confirmation shows the file name

### Non-Functional (NFR)

- [x] **NFR-01**: Every Firestore query includes a `uid` equality filter (security rules are not filters)
- [ ] **NFR-02**: App is fully usable with no network mid-session; Firestore listeners reconcile on reconnect
- [x] **NFR-03**: Money computed and stored as integer cents only; formatting via a single `money.js` utility (no float math, no device-dependent `Intl` output)
- [x] **NFR-04**: Dates computed and stored as local `"YYYY-MM-DD"` strings (no UTC-based slicing)
- [x] **NFR-05**: All libraries are Expo Go compatible on Expo SDK 57; Firebase JS SDK ^12; AsyncStorage 2.2.0 for auth persistence; SheetJS from CDN tarball
- [x] **NFR-06**: Firestore security rules deployed matching backend-schema.md (uid scoping; `isDefault` immutable; in-app default creation impossible)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Search

- **SEAR-01**: User can search/filter entries (text + date range) — first v1.x slice after launch

### Budgets & Charts

- **BUDG-01**: Per-category monthly budgets (v1.x candidate — reuses summary aggregates)
- **CHRT-01**: A minimal spending chart (v1.x candidate)

### Offline

- **OFFL-01**: Durable offline (data survives app restarts) via a local-first expo-sqlite sync layer — only if the owner confirms it matters; requires new research

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bank/payment integrations | Manual entry only by design |
| Cross-account sharing / family ledgers | Each account's data is private to that account |
| Recurring-entry automation | Copy covers repeating payments at near-zero complexity |
| Multi-currency | PHP only; `currency` field is future-proofing only |
| Web/desktop version | Phone-only app, Expo Go testing |
| Dark mode, themes, custom fonts | Explicitly rejected in design brief |
| Receipt photos, tags, widgets | Anti-features — widgets impossible in Expo Go |
| Push notifications | No recurring automation to notify about |
| Charts beyond summary | Numbers are the interface (design principle) — revisit as CHRT-01 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1: Foundation | Complete |
| AUTH-02 | Phase 1: Foundation | Complete |
| AUTH-03 | Phase 1: Foundation | Complete |
| AUTH-04 | Phase 6: Account Lifecycle | Pending |
| AUTH-05 | Phase 6: Account Lifecycle | Pending |
| AUTH-06 | Phase 6: Account Lifecycle | Pending |
| AUTH-07 | Phase 6: Account Lifecycle | Pending |
| CATS-01 | Phase 2: Categories | Complete |
| CATS-02 | Phase 2: Categories | Complete |
| CATS-03 | Phase 2: Categories | Complete |
| CATS-04 | Phase 2: Categories | Complete |
| ENTR-01 | Phase 3: Entries | Complete |
| ENTR-02 | Phase 3: Entries | Pending |
| ENTR-03 | Phase 3: Entries | Pending |
| ENTR-04 | Phase 3: Entries | Pending |
| ENTR-05 | Phase 3: Entries | Complete |
| ENTR-06 | Phase 3: Entries | Pending |
| ENTR-07 | Phase 3: Entries | Pending |
| ENTR-08 | Phase 3: Entries | Pending |
| SUMM-01 | Phase 4: Summary | Pending |
| SUMM-02 | Phase 4: Summary | Pending |
| SUMM-03 | Phase 4: Summary | Pending |
| EXPT-01 | Phase 5: Export | Pending |
| EXPT-02 | Phase 5: Export | Pending |
| EXPT-03 | Phase 5: Export | Pending |
| EXPT-04 | Phase 5: Export | Pending |
| EXPT-05 | Phase 5: Export | Pending |
| NFR-01 | Phase 1: Foundation | Complete |
| NFR-02 | Phase 3: Entries | Pending |
| NFR-03 | Phase 1: Foundation | Complete |
| NFR-04 | Phase 1: Foundation | Complete |
| NFR-05 | Phase 1: Foundation | Complete |
| NFR-06 | Phase 1: Foundation | Complete |

**Coverage:**

- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-06*
*Last updated: 2026-08-06 after initial definition*
