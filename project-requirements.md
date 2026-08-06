# Project Requirements — Money Tracking

## Overview

A personal expense and income tracker with email/password accounts. Entries are logged manually on a phone, stored in Firebase Firestore with offline support, and can be exported as a date-range summary to PDF or Excel. Each account owns a private ledger; the default account is protected.

## Goals

- Log an expense or income entry in under 10 seconds
- Copy an existing entry with a new date (for repeating payments)
- See a current-month summary (spent / earned) on opening the app
- Work fully offline; sync when back online
- Export a date-range summary to PDF and Excel

## Non-Goals (explicitly out of scope)

- No bank / payment integrations (manual entry only)
- No cross-account sharing or family ledgers — each account's data is private to that account
- No budgets, no savings goals, no recurring-entry automation
- No multi-currency (PHP only)
- No web/desktop version

## Users

Multi-account, email + password auth (Firebase Email/Password). Each account owns a private ledger and can sign in on any device. The **default account** is seeded once during setup (its email/password chosen by the owner in the Firebase console); it can never be deleted in-app. Additional accounts are created in-app and can be deleted (cascade). No sign-up screen at first launch — the app opens with a Sign In screen and the owner signs in with the default account.

## User Stories

### US-1: Log an entry
As a user, I want to add an expense or income with a category, amount, date, and optional description.

**Acceptance criteria:**
- Expenses and Income are separate tabs
- Category is selected from a dropdown of existing categories
- Amount accepts 2 decimals (e.g. ₱24.50)
- Date defaults to today; any past date can be picked; future dates are blocked
- Description is optional
- The entry is saved and visible immediately, even offline

### US-2: Manage categories
As a user, I want to create categories per tab, so my dropdowns match how I think about money.

**Acceptance criteria:**
- Categories tab shows Expense and Income categories in two groups
- New categories can be added
- A category that is in use by any entry cannot be deleted (deletion is blocked with a message)
- An empty category can be deleted

### US-3: Edit and delete entries
As a user, I want to fix or remove past entries, because I often log things later from memory.

**Acceptance criteria:**
- Tapping an entry opens the entry form pre-filled
- Changes save back to the same entry
- Deletion asks for confirmation, then removes the entry

### US-4: Copy an entry
As a user, I want to duplicate an entry with a new date, for expenses that repeat (rent, subscriptions).

**Acceptance criteria:**
- "Copy" opens the entry form pre-filled with the same category, amount, and description
- The date resets to today
- Works for both expenses and income
- The copy saves as a new entry; the original is untouched

### US-5: Monthly summary
As a user, I want to open the app and see how the current month looks.

**Acceptance criteria:**
- Home screen shows large totals: total spent and total earned for the current month
- A per-category breakdown for the month is shown
- Data reflects entries made offline once synced

### US-6: Export summary
As a user, I want to export a date-range summary to PDF and Excel, saved on my phone.

**Acceptance criteria:**
- Default range is the current month; start and end dates are selectable
- PDF contains: total expense, total income, category-by-category totals, and the list of entries in range
- Excel contains the same data in spreadsheet form (one sheet, one row per entry)
- File is saved to the phone's Downloads folder (with share-sheet fallback)
- A confirmation shows the file name after export

### US-7: Sign in
As a user, I want to sign in with my account so my ledger follows me.

**Acceptance criteria:**
- First launch shows a Sign In screen (email + password) — no sign-up on first launch
- The default account (seeded at setup) signs in like any other account
- After sign-in the user lands on Home; the session persists across app restarts
- Wrong credentials show an inline error; offline sign-in works if signed in before (Firestore offline persistence)

### US-8: Create another account
As a user, I want to create additional accounts from the Account tab.

**Acceptance criteria:**
- "Create account" asks for display name, email, and password (min 6 chars)
- The new account starts with an empty ledger (no categories, no entries)
- Creation signs into the new account immediately (or returns to the signed-in account — see design)
- A default account can be created only via the setup seed, never in-app

### US-9: Delete an account
As a user, I want to delete an account and all its data.

**Acceptance criteria:**
- Delete requires confirmation and re-entry of the account's password (reauthentication)
- Deletion cascades: the account's entries and categories are deleted, then the auth account
- The default account shows "Default — can't be deleted" and deletion is blocked
- After deletion the app returns to the Sign In screen

## Functional Requirements (condensed)

| ID | Requirement |
|----|-------------|
| FR-1 | Two entry tabs: Expenses, Income |
| FR-2 | One shared entry form used for add, edit, and copy |
| FR-3 | Category dropdown lists only the matching tab's categories |
| FR-4 | Amount stored as integer cents; display with ₱ and 2 decimals |
| FR-5 | Date picker: default today, past allowed, future blocked |
| FR-6 | Copy = pre-filled form with date reset to today |
| FR-7 | Category deletion blocked while entries reference it |
| FR-8 | Home screen = current-month summary with big totals |
| FR-9 | Export: date-range summary → PDF + Excel → Downloads folder |
| FR-10 | All data reads/writes go through Firestore; offline persistence enabled |
| FR-11 | Email/password sign-in screen at first launch; session persists |
| FR-12 | Account tab: create account, delete account (password reauth), sign out |
| FR-13 | Default account is undeletable and can only be seeded at setup |
| FR-14 | Deleting an account cascades: entries, categories, then auth account |

## Non-Functional Requirements

- **Offline-first:** app must be fully usable with no network
- **Single currency:** PHP (₱), integer-cents storage to avoid float errors
- **Scale:** a handful of accounts, each well under Firebase free tier (50K reads / 20K writes / 1 GB per day)
- **Platform:** Android + iOS via React Native (Expo); tested by QR code on the user's phone
- **Simplicity over features:** no budgets, no graphs beyond the summary, no sharing

## Constraints

- Firebase free tier only
- Expo Go workflow (no custom native modules) — testing is QR-code based
- Email/password auth only (no Google/OAuth); default account seeded via Firebase console
