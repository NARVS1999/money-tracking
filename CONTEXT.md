# Money Tracking

A personal expense and income tracker on a phone. Entries are logged manually into Firestore (offline-first), scoped per account, and exported as date-range PDF/Excel summaries.

## Accounts

**Account**:
A login identity (email + password) that owns a private ledger — its own entries and categories. Accounts can be created and deleted in the app.
_Avoid_: User, profile, login

**Default Account**:
The account seeded once during setup; the only account that can never be deleted in-app.
_Avoid_: Main account, primary account, admin

**Sign In**:
Entering an account's email and password to open its ledger. Required on first launch; sessions persist afterwards.
_Avoid_: Login, authenticate, onboarding

## Core

**Entry**:
A single logged record of money moving in or out, with a type, amount, category, date, and optional description.
_Avoid_: Transaction, record, log, item

**Income**:
An entry where money arrives (salary, gifts, side earnings).
_Avoid_: Incoming money, money in, credit, deposit

**Expense**:
An entry where money leaves (food, rent, transport).
_Avoid_: Outgoing, spending entry, debit, withdrawal

**Amount**:
The money value of an entry, always in PHP and stored as integer cents (₱24.50 = 2450).
_Avoid_: Value, cost, price, total

**Description**:
An optional free-text note attached to an entry. Never required.
_Avoid_: Note, memo, details

## Categories

**Category**:
A named bucket an entry is filed under, used for breakdowns and the entry form dropdown.
_Avoid_: Tag, group, label, type

**Expense Category**:
A category that only appears in the expense dropdown and the Expense Categories group.

**Income Category**:
A category that only appears in the income dropdown and the Income Categories group.

## Features

**Copy**:
Creating a new entry by duplicating an existing one — same category, amount, and description, with the date reset to today.
_Avoid_: Duplicate, repeat, clone

**Range Export**:
Generating a PDF or Excel summary of all entries between a chosen start and end date, containing totals, a category breakdown, and the entry list.
_Avoid_: Report, report generation, download

**Summary**:
The current-month view on the Home screen showing total spent, total earned, and the per-category breakdown.
_Avoid_: Dashboard, overview, home view
