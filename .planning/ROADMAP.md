# Roadmap: Money Tracking

## Overview

A personal expense/income tracker for the phone (Expo Go workflow): sign in with email/password, log entries in under 10 seconds with session-scoped offline persistence, manage per-type categories, view the current-month summary, and export date-range PDF/Excel/CSV summaries to the phone. The journey is a dependency chain — auth gates everything → categories feed entry forms → entries feed summary and exports → account lifecycle wraps it all. Export (Phase 5) is the riskiest platform code and is deliberately isolated after the data layer is proven.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-08-09) — [full roadmap](milestones/v1.0-ROADMAP.md) · [requirements](milestones/v1.0-REQUIREMENTS.md)
- ✅ **v1.1 Theme, Budget, Icons, Charts** — Phases 7-10 (shipped 2026-08-09) — [full roadmap](milestones/v1.1-ROADMAP.md) · [requirements](milestones/v1.1-REQUIREMENTS.md)
- ✅ **v1.2 Offline-First + Recurring Entries** — Phases 11-15 (shipped 2026-08-16) — [full roadmap](milestones/v1.2-ROADMAP.md) · [requirements](milestones/v1.2-REQUIREMENTS.md)

## Phases

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

<details>
<summary>✅ v1.2 Offline-First + Recurring Entries (Phases 11-15) — SHIPPED 2026-08-16</summary>

- [x] Phase 11: SQLite Local Database (1/1 plans) — completed 2026-08-16
- [x] Phase 12: Offline-First Providers + Sync (1/1 plans) — completed 2026-08-16
- [x] Phase 13: Recurring Entries Data Layer (1/1 plans) — completed 2026-08-16
- [x] Phase 14: Export Tab — Scheduled UI (1/1 plans) — completed 2026-08-16
- [x] Phase 15: Homepage — Upcoming Indicators (1/1 plans) — completed 2026-08-16

</details>

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
| 11. SQLite Local Database | v1.2 | 1/1 | Complete | 2026-08-16 |
| 12. Offline-First Providers + Sync | v1.2 | 1/1 | Complete | 2026-08-16 |
| 13. Recurring Entries Data Layer | v1.2 | 1/1 | Complete | 2026-08-16 |
| 14. Export Tab — Scheduled UI | v1.2 | 1/1 | Complete | 2026-08-16 |
| 15. Homepage — Upcoming Indicators | v1.2 | 1/1 | Complete | 2026-08-16 |
