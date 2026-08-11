---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-11T19:08:06.837Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 11 | unrun-verify | src/db/seed.ts |  | Task 11 manual on-device verification (sign-in seed, kill-and-reopen persistence, new-device idempotency) requires the user's phone via Expo Go QR — not executable in this environment | open |  | 2026-08-11T19:08:06.837Z |  |

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
  }
]
````
