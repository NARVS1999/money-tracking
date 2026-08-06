# Composite Indexes: `entries`

Two one-time console operations are required for the queries built by
`src/firebase/queries.ts` (NFR-01). Without them, the affected queries fail
with an error that self-links to the index creation page.

| Collection | Fields | Purpose | Query builder |
|-----------|--------|---------|---------------|
| `entries` | `uid ASC, type ASC, date DESC` | Tab lists (type filter + date order) | `entriesByType(uid, type)` |
| `entries` | `uid ASC, date ASC` | Range export/summary | `entriesInRange(uid, start, end)` |

Source of truth: [backend-schema.md](../backend-schema.md) → Indexes table.

## Status

- **Artifact:** created (01-03 Task 2) — see [Task 3 resolution](#task-3-deployment-status).
- **Deployed:** **NO — deferred by user decision (01-03 Task 3 option-c).** The
  console steps below are ready to run; `entriesByType` and `entriesInRange`
  stay unusable until these indexes exist in the console.

## Console steps (tab-list index)

1. Open the **Firebase console** → your project → **Firestore Database** →
   **Indexes** tab.
2. Click **Add index** (or **Create index**).
3. Collection ID: `entries`
4. Fields:
   | Field | Order |
   |-------|-------|
   | `uid` | **Ascending** |
   | `type` | **Ascending** |
   | `date` | **Descending** |
5. Click **Create**. Index build takes a few minutes (status shows
   "Creating" → "Enabled").

> The `uid` column must come first: Firestore serves a query from a composite
> index that covers all of its equality fields (here `uid`, `type`) ahead of
> the orderBy field (`date`). An index on `type`/`date` alone cannot serve
> `entriesByType`, because the query also filters on `uid`.

## How to verify

- Open the app, sign in, and open the Expenses tab (Phase 3): the tab list
  renders entries newest-first. Until then, the quickest check is the query
  error itself — if the index is missing, `entriesByType` throws
  `The query requires an index.` with a console link to create it
  (01-RESEARCH.md Pitfall 8 — the error self-links).

## Why these indexes exist

Every builder in `src/firebase/queries.ts` starts from a `uid ==` equality
filter (rules are not filters — NFR-01, Pitfall 7). Index requirements per
builder:

| Builder | Constraints | Index requirement |
|---------|-------------|-------------------|
| `userDoc(uid)` | — (DocumentReference, not a query) | none |
| `entriesBase(uid)` | `uid ==` | automatic single-field |
| `entriesByType(uid, type)` | `uid ==`, `type ==`, `orderBy date desc` | **composite `uid ASC, type ASC, date DESC`** |
| `entriesInRange(uid, start, end)` | `uid ==`, `date >=`, `date <=` | **composite `uid ASC, date ASC`** |
| `categoryInUse(uid, categoryId)` | `uid ==`, `categoryId ==`, `limit 1` | none — index merging covers multiple equality clauses |
| `categoriesOf(uid, kind)` | `uid ==` | automatic single-field |

The two composite indexes are not auto-created. `entriesByType` needs its
`uid` equality column *ahead of* the `orderBy("date", "desc")` column;
`entriesInRange` needs the `uid` equality column *ahead of* the `date` range
column — an index on `type`/`date` alone cannot serve either query, and the
automatic single-field `date` index does not cover a uid-equality +
date-range query.

## Range index: `entries` — `uid ASC, date ASC`

Second one-time console operation, required for the range queries built by
`entriesInRange(uid, start, end)` in `src/firebase/queries.ts` (Phase 4
export/summary feature). The query combines a `uid ==` equality filter with
date `>=` / `<=` range filters — equality plus range across two different
fields is not served by the automatic single-field indexes, so without this
index the query throws `The query requires an index.` with a console link.

Console steps (same flow as the tab-list index, second index):

1. Open the **Firebase console** → your project → **Firestore Database** →
   **Indexes** tab.
2. Click **Add index** (or **Create index**).
3. Collection ID: `entries`
4. Fields:
   | Field | Order |
   |-------|-------|
   | `uid` | **Ascending** |
   | `date` | **Ascending** |
5. Click **Create**. Index build takes a few minutes (status shows
   "Creating" → "Enabled").

> Note: the automatic single-field index on `date` does **not** cover this
> query — filtering on `uid` (equality) *and* `date` (range) is a two-field
> composite query. The composite must include `uid` first.

## Task 3 deployment status

Deployment of these indexes (and the rules + default-account seed) is part of
01-03 Task 3's one-way console deployment. The user deferred it (option-c):
**do not create these indexes until the user re-opens that decision.** When
deploying, update the Status block above.
