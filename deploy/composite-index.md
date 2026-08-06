# Composite Index: `entries` — `type ASC, date DESC`

One-time console operation required for the tab-list queries built by
`entriesByType(uid, type)` in `src/firebase/queries.ts` (NFR-01). Without it,
that query fails with an error that self-links to the index creation page.

Source of truth: [backend-schema.md](../backend-schema.md) → Indexes table
(`entries | type ASC, date DESC | Tab lists`).

## Status

- **Artifact:** created (01-03 Task 2) — see [Task 3 resolution](#task-3-deployment-status).
- **Deployed:** **NO — deferred by user decision (01-03 Task 3 option-c).** The
  console steps below are ready to run; `entriesByType` stays unusable until
  this index exists in the console.

## Console steps

1. Open the **Firebase console** → your project → **Firestore Database** →
   **Indexes** tab.
2. Click **Add index** (or **Create index**).
3. Collection ID: `entries`
4. Fields:
   | Field | Order |
   |-------|-------|
   | `type` | **Ascending** |
   | `date` | **Descending** |
5. Click **Create**. Index build takes a few minutes (status shows
   "Creating" → "Enabled").

## How to verify

- Open the app, sign in, and open the Expenses tab (Phase 3): the tab list
  renders entries newest-first. Until then, the quickest check is the query
  error itself — if the index is missing, `entriesByType` throws
  `The query requires an index.` with a console link to create it
  (01-RESEARCH.md Pitfall 8 — the error self-links).

## Why this index exists

`entriesByType` combines an equality filter (`type == "expense"`) with an
`orderBy("date", "desc")` — Firestore requires a composite index for that
combination; it is not auto-created. Range queries (`entriesInRange`, date
`>=` / `<=`) use the automatic single-field index on `date` and need nothing
here.

## Task 3 deployment status

Deployment of this index (and the rules + default-account seed) is part of
01-03 Task 3's one-way console deployment. The user deferred it (option-c):
**do not create this index until the user re-opens that decision.** When
deploying, update the Status block above.
