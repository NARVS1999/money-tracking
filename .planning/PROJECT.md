# Money Tracking

## What This Is

A personal expense and income tracker on the phone. Entries are logged manually (under 10 seconds), stored in Firebase Firestore with offline-first persistence, and exported as date-range PDF/Excel summaries. Each account (email + password) owns a private ledger with its own categories; a seeded **default account** can never be deleted in-app.

## Core Value

Logging a money entry must take under 10 seconds — from opening the app to saving — and the data must be there when the phone is offline.

## Business Context

- **Customer**: The owner (and optionally family members via separate accounts) — personal use
- **Revenue model**: None — free-tier Firebase, personal tool
- **Success metric**: Entries logged daily; the phone is the only device
- **Strategy notes**: None — personal project, not commercial

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Log expense/income entries (type, amount, category, date, optional description) that save instantly, even offline
- [ ] Manage expense and income categories separately; block deletion of categories still in use
- [ ] Edit and delete entries
- [ ] Copy an entry with the date reset to today (repeating payments)
- [ ] Current-month summary on Home: total spent, total earned, per-category breakdown
- [ ] Export date-range summary to PDF and Excel, saved to the phone's Downloads folder
- [ ] Sign in with email/password on first launch; session persists
- [ ] Create additional accounts in-app (empty ledger, signs into the new account)
- [ ] Delete an account (password reauth) with full cascade: entries → categories → users doc → auth account
- [ ] Default account is undeletable in-app and seedable only at setup

### Out of Scope

- Bank/payment integrations — manual entry only
- Cross-account sharing or family ledgers — each account's data is private
- Budgets, savings goals, recurring-entry automation
- Multi-currency — PHP only
- Web/desktop version — phone only (Expo Go testing)
- Charts/graphs beyond the summary — numbers are the interface
- Dark mode, themes, custom fonts, onboarding — rejected in design brief

## Context

- **Platform**: React Native + Expo (latest SDK), Expo Go workflow — no custom native modules; testing is QR-code based
- **Stack**: Firebase JS SDK (`firebase` npm package) — NOT `@react-native-firebase/*` (requires dev build, fails in Expo Go); AsyncStorage-backed persistence; `expo-print` for PDF; `xlsx` (SheetJS) for Excel; `expo-file-system` + `expo-sharing` for output; `@react-navigation/bottom-tabs` + `native-stack`; React Context for state
- **Data**: Firestore is the only database (ADR-0001); offline persistence enabled at startup via `persistentLocalCache`; live `onSnapshot` listeners for optimistic UI
- **Money**: integer cents everywhere (₱24.50 = `2450`), formatted only in `money.js` (ADR-0003)
- **Dates**: local calendar date as `"YYYY-MM-DD"` strings — lexicographic range queries, no timezone bugs
- **Auth**: Email/Password; `users/{uid}` docs with `displayName` + immutable `isDefault`; rules reject in-app default creation (ADR-0005, supersedes ADR-0002)
- **Design language**: monochrome (`#F7F7F8` bg, `#1A1A1A` text), green/red reserved for money direction only; 40–48pt tabular-nums totals; text is the interface — no category icons, no gradients
- **Screens**: Sign In, Home, Expenses, Income, Categories (two groups), Account, shared Entry form, Export
- **Firebase setup** (manual, one-time): create project, enable Email/Password, create Firestore, deploy rules, composite index `type ASC, date DESC`, seed default account via console
- **Scale**: a handful of accounts, ~10 writes/day each — 3+ orders of magnitude under free tier

## Constraints

- **Tech stack**: Expo Go workflow only — every library must run in Expo Go (no custom native modules)
- **Tech stack**: Firebase JS SDK (not native modules); Firestore the only database
- **Firebase**: Free Spark plan only
- **Auth**: Email/password only; default account seeded via Firebase console, never in-app
- **Currency**: PHP only, integer-cents storage, never floats
- **Compatibility**: Android + iOS; QR-code tested on the user's phone

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Firestore only, no local SQLite | Built-in offline persistence = local-first behavior with zero sync code (ADR-0001) | — Pending |
| Anonymous auth → email/password accounts | Owner wants real login identity with protected default + account create/delete (ADR-0005 supersedes ADR-0002) | — Pending |
| Amounts as integer cents | Exact math, standard currency practice, no float errors (ADR-0003) | — Pending |
| Category deletion blocked until empty | Zero data loss; forces explicit choice; no orphaned refs (ADR-0004) | — Pending |
| Dates as `"YYYY-MM-DD"` strings | Timezone-safe range queries, no midnight-offset bugs | — Pending |
| Firebase JS SDK instead of native modules | Only option that runs in Expo Go | — Pending |
| expo-print + SheetJS for exports | Expo Go compatible, no native builds | — Pending |
| App signs into newly created account immediately | New empty ledger is where you land; sign out to return | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-06 after initialization*
