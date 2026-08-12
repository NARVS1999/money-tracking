# Milestones: Money Tracking

## v1.2 — Offline-First + Recurring Entries

**Status:** Planning
**Phases:** 11-15 (5 phases)
**Started:** 2026-08-12

### Planned

- Offline-first storage via expo-sqlite — fully usable without internet
- Firestore cloud sync — push/pull changes when online
- Recurring/scheduled entries — auto-generate real entries by frequency
- Homepage upcoming indicators — yellow-red expenses, yellow-blue income

### Requirements

- 43 requirements defined (OFFL-01–10, SYNC-01–08, SCHD-01–10, SCHD-UI-01–09, HOME-UP-01–07, NFR-11–16)

---

## v1.1 — Theme, Budget, Icons, Charts

**Shipped:** 2026-08-09
**Phases:** 7-10 (4 phases, 4 plans)
**Commits:** 33
**LOC:** ~8,700 TypeScript
**Files changed:** 62 (4,166 insertions, 557 deletions)

### Delivered

- Full Modern UI theme overhaul with orange/red gradient summary card, rounded surfaces, frosted tab bar
- Single global budget with custom date range and color-coded progress bar
- 50+ preset Ionicons for categories with backward-compatible data model
- Custom SVG donut charts for expense/income breakdowns with smart "Other" grouping

### Requirements

- 31/31 requirements satisfied (THEM-01–08, BDGT-01–07, ICNS-01–06, CHRT-01–06, NFR-07–10)
- Audit: passed (30/31 UAT tests passed, 1 cosmetic issue fixed)

### Archived

- [Full roadmap](milestones/v1.1-ROADMAP.md)
- [Requirements](milestones/v1.1-REQUIREMENTS.md)

---

## v1.0 — MVP

**Shipped:** 2026-08-09
**Phases:** 1-6
**Commits:** 50+

### Delivered

- Email/password auth with protected default account
- Category management (CRUD, blocked until empty)
- Entry logging (<10s, offline-first)
- Current-month summary with totals
- PDF/Excel/CSV export
- Account creation/deletion with cascade

### Archived

- [Full roadmap](milestones/v1.0-ROADMAP.md)
- [Requirements](milestones/v1.0-REQUIREMENTS.md)
