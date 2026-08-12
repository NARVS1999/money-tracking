---
schema_version: 1
open_count: 6
waived_count: 0
fixed_count: 0
total_count: 6
last_updated: 2026-08-12T01:00:39.489Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 11 | unrun-verify | src/db/seed.ts |  | Task 11 manual on-device verification (sign-in seed, kill-and-reopen persistence, new-device idempotency) requires the user's phone via Expo Go QR — not executable in this environment | open |  | 2026-08-11T19:08:06.837Z |  |
| 2 | 12 | unrun-verify | src/sync/syncService.ts |  | Task 11 manual on-device verification (offline CRUD, kill-and-reopen persistence, sync push on wifi) requires the user's phone via Expo Go QR — not executable in this environment | open |  | 2026-08-11T20:50:31.819Z |  |
| 3 | 12 | unrun-verify | src/sync/syncService.ts |  | Task 12 manual two-device verification (new-device seed from Firestore, cross-device change propagation via sync) requires two phones via Expo Go QR — not executable in this environment | open |  | 2026-08-11T20:50:32.334Z |  |
| 4 | 13 | unrun-verify | src/scheduled/scheduler.ts |  | Manual on-device verification (13-01 Task 8): daily template starting yesterday generates yesterday+today; monthly income starting 3 months ago generates one entry per month; generated entries appear in Expenses/Income tabs; offline generation from SQLite | open |  | 2026-08-11T22:23:15.495Z |  |
| 5 | 14 | unrun-verify | src/screens/ExportScreen.tsx |  | Manual on-device verification (14-01 Task 8): Export tab shows Scheduled Entries section; Add Scheduled opens the form; create daily expense appears in Expenses sub-section; swipe edit pre-fills; swipe delete confirms; pause shows Paused badge; resume removes it; monthly income lands in Income sub-section | open |  | 2026-08-12T00:00:29.131Z |  |
| 6 | 15 | unrun-verify | src/screens/HomeScreen.tsx |  | Manual on-device verification (15-01 Task 7): Home shows Upcoming Expenses (yellow-red #DC2626) and Upcoming Income (yellow-blue #45C0CF) between quick-action buttons and chart sections; sections hidden when a type has zero active templates; tapping a row opens ScheduledEntryForm edit mode; amount/frequency/next date display correctly | open |  | 2026-08-12T01:00:39.489Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "11",
    "file": "src/db/seed.ts",
    "line": null,
    "description": "Task 11 manual on-device verification (sign-in seed, kill-and-reopen persistence, new-device idempotency) requires the user's phone via Expo Go QR — not executable in this environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T19:08:06.837Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "12",
    "file": "src/sync/syncService.ts",
    "line": null,
    "description": "Task 11 manual on-device verification (offline CRUD, kill-and-reopen persistence, sync push on wifi) requires the user's phone via Expo Go QR — not executable in this environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T20:50:31.819Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "12",
    "file": "src/sync/syncService.ts",
    "line": null,
    "description": "Task 12 manual two-device verification (new-device seed from Firestore, cross-device change propagation via sync) requires two phones via Expo Go QR — not executable in this environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T20:50:32.334Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "13",
    "file": "src/scheduled/scheduler.ts",
    "line": null,
    "description": "Manual on-device verification (13-01 Task 8): daily template starting yesterday generates yesterday+today; monthly income starting 3 months ago generates one entry per month; generated entries appear in Expenses/Income tabs; offline generation from SQLite",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T22:23:15.495Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "14",
    "file": "src/screens/ExportScreen.tsx",
    "line": null,
    "description": "Manual on-device verification (14-01 Task 8): Export tab shows Scheduled Entries section; Add Scheduled opens the form; create daily expense appears in Expenses sub-section; swipe edit pre-fills; swipe delete confirms; pause shows Paused badge; resume removes it; monthly income lands in Income sub-section",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-12T00:00:29.131Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "15",
    "file": "src/screens/HomeScreen.tsx",
    "line": null,
    "description": "Manual on-device verification (15-01 Task 7): Home shows Upcoming Expenses (yellow-red #DC2626) and Upcoming Income (yellow-blue #45C0CF) between quick-action buttons and chart sections; sections hidden when a type has zero active templates; tapping a row opens ScheduledEntryForm edit mode; amount/frequency/next date display correctly",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-12T01:00:39.489Z",
    "resolved_at": null
  }
]
````
