# Money Tracking

## Current State

**v1.1 shipped 2026-08-09.** Full personal expense/income tracker: email/password auth, category management, entry logging (<10s), current-month summary, PDF/Excel/CSV export, account creation/deletion with cascade, session-scoped offline persistence. Modern UI theme with orange/red gradient, global budget tracking, 50+ preset category icons, and custom SVG donut charts.

**Built with:** Expo SDK 57, Firebase JS SDK 12, React Native 0.86, React Context state, Expo Go QR workflow, react-native-svg for charts.

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

- ✓ Email/password auth with protected default account — v1.0
- ✓ Category management (CRUD, blocked until empty) — v1.0
- ✓ Entry logging (<10s, offline-first) — v1.0
- ✓ Current-month summary with totals — v1.0
- ✓ PDF/Excel/CSV export — v1.0
- ✓ Account creation/deletion with cascade — v1.0
- ✓ Modern UI theme (orange/red gradient, rounded surfaces, frosted tab bar) — v1.1
- ✓ Global budget with custom date range and progress bar — v1.1
- ✓ 50+ preset category icons (optional, backward-compatible) — v1.1
- ✓ Custom SVG donut charts for expense/income breakdowns — v1.1

### Active

To be defined via `/gsd-new-milestone`

### Out of Scope

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
| Durable offline via expo-sqlite | Deferred to v2 — adds sync engine complexity |
| Search/filter over entries | Deferred to v2 |

## Context

- **Platform**: React Native + Expo SDK 57, Expo Go workflow — no custom native modules; testing is QR-code based
- **Stack**: Firebase JS SDK (`firebase` npm package) — NOT `@react-native-firebase/*` (requires dev build, fails in Expo Go); AsyncStorage-backed persistence; `expo-print` for PDF; `xlsx` (SheetJS) for Excel; `expo-file-system` + `expo-sharing` for output; `@react-navigation/bottom-tabs` + `native-stack`; React Context for state; `react-native-svg` for charts; `expo-linear-gradient` for theme
- **Data**: Firestore is the only database (ADR-0001); session-scoped offline via memory cache; live `onSnapshot` listeners for optimistic UI
- **Money**: integer cents everywhere (₱24.50 = `2450`), formatted only in `money.js` (ADR-0003)
- **Dates**: local calendar date as `"YYYY-MM-DD"` strings — lexicographic range queries, no timezone bugs
- **Auth**: Email/Password; `users/{uid}` docs with `displayName` + immutable `isDefault`; rules reject in-app default creation (ADR-0005, supersedes ADR-0002)
- **Design language**: Modern UI — orange/red gradient (`#EF6D40` → `#DB281C`), white backgrounds with shadows, rounded surfaces (24px cards), 50+ Ionicons for categories, custom SVG donut charts with 8-color palette
- **Screens**: Sign In, Home, Expenses, Income, Categories (two groups), Account, shared Entry form, Export
- **Firebase setup** (manual, one-time): create project, enable Email/Password, create Firestore, deploy rules, composite index `type ASC, date DESC`, seed default account via console
- **Scale**: a handful of accounts, ~10 writes/day each — 3+ orders of magnitude under free tier
- **LOC**: ~8,700 lines TypeScript in src/

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
| Firestore only, no local SQLite | Built-in offline persistence = local-first behavior with zero sync code (ADR-0001) | Implemented v1.0 |
| Anonymous auth → email/password accounts | Owner wants real login identity with protected default + account create/delete (ADR-0005 supersedes ADR-0002) | Implemented v1.0 |
| Amounts as integer cents | Exact math, standard currency practice, no float errors (ADR-0003) | Implemented v1.0 |
| Category deletion blocked until empty | Zero data loss; forces explicit choice; no orphaned refs (ADR-0004) | Implemented v1.0 |
| Dates as `"YYYY-MM-DD"` strings | Timezone-safe range queries, no midnight-offset bugs | Implemented v1.0 |
| Firebase JS SDK instead of native modules | Only option that runs in Expo Go | Implemented v1.0 |
| expo-print + SheetJS for exports | Expo Go compatible, no native builds | Implemented v1.0 |
| App signs into newly created account immediately | New empty ledger is where you land; sign out to return | Implemented v1.0 |
| Orange/red gradient via expo-linear-gradient | Expo Go compatible, no dev build required | ✓ Good, v1.1 |
| Budget on users/{uid} doc with setDoc merge:true | No new collections, no new queries | ✓ Good, v1.1 |
| 50+ Ionicons for categories | Backward-compatible optional icon field, no emoji inconsistencies | ✓ Good, v1.1 |
| Custom SVG donut charts via react-native-svg | No external charting lib, Expo Go compatible | ✓ Good, v1.1 |
| Chart data from cached entries via memo | No Firestore aggregation queries, UI not blocked | ✓ Good, v1.1 |

---

*Last updated: 2026-08-09 after v1.1 milestone completion*
