# Backend Schema — Firestore Data Model

## Overview

Firestore is the only database (see ADR-0001). Offline persistence is enabled client-side, so the device holds a local mirror automatically — no separate local schema exists.

All collections are scoped to the signed-in user via `uid` (email/password auth, see ADR-0005 — supersedes ADR-0002).

## Collections

### `users`

One document per account. The document itself is created by a one-time seed (console/script) for the default account and on first sign-in of any created account.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `uid` | string | yes | Firebase auth user id |
| `displayName` | string | yes | Shown in the Account tab |
| `isDefault` | boolean | yes | `true` only for the seeded default account; **immutable** — rules reject in-app writes |
| `createdAt` | timestamp | yes | Server time |

**Default account lifecycle:** seeded once at setup (auth user + `users` doc with `isDefault: true`, created with admin privileges). In-app account creation writes `isDefault: false` only — rules enforce this so an app-created account can never become or forge a default.

### `entries`

One document per logged expense or income entry.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `uid` | string | yes | Email/password auth user id |
| `type` | string | yes | `"expense"` or `"income"` |
| `amountCents` | number | yes | Integer cents — ₱24.50 stored as `2450`. Never floats (see ADR-0003 money note) |
| `currency` | string | yes | `"PHP"` constant for future-proofing |
| `categoryId` | string | yes | Ref to category doc (id). Required — entries must always have a category |
| `description` | string | no | Optional note, max 200 chars |
| `date` | string | yes | Local calendar date `"YYYY-MM-DD"` (e.g. `"2026-08-06"`). Stored as string to make range queries timezone-safe |
| `createdAt` | timestamp | yes | Server time |
| `updatedAt` | timestamp | yes | Server time |

**Query patterns:**
- Tab lists: `where type == "expense"` order by `date` desc → needs composite index `type ASC, date DESC`
- Range export / summary: `where uid == X` + `where date >= start` and `date <= end` → composite index `uid ASC, date ASC` (the automatic single-field `date` index does not cover a uid-equality + date-range query)
- Category-in-use check (blocked delete): `where categoryId == X` limit 1

### `expenseCategories` and `incomeCategories`

Identical shape, separate collections per entry type — keeps each tab's dropdown clean and rules trivial.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `uid` | string | yes | Owner |
| `name` | string | yes | Display name, max 40 chars |
| `createdAt` | timestamp | yes | Server time |

No `usageCount` counter is maintained — "category in use" is derived by querying `entries` at delete time (keeps schema simple; per-account scale is tiny, no scale concern).

## Referential integrity

Firestore has no foreign keys. Two constraints are app-enforced:

1. **Category deletion is blocked while entries reference it.** App checks `entries where categoryId == X` first; if any exist, deletion is refused with a message. No cascade, no `Uncategorized` bucket (ADR-0004).
2. **Entry `categoryId` must point at an existing category of the matching `type`.** Enforced in the entry form (dropdown only offers valid categories), not in rules.

## Security rules

All rules key on the auth `uid`. In-app creation of a default account is impossible by rule:

```
match /users/{uid} {
  allow read, delete: if resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
                 && request.resource.data.uid == request.auth.uid
                 && request.resource.data.isDefault == false;
  allow update: if resource.data.uid == request.auth.uid
                 && request.resource.data.isDefault == resource.data.isDefault;
}

match /entries/{id} {
  allow read, update, delete: if resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
                 && request.resource.data.uid == request.auth.uid;
}

match /expenseCategories/{id} {
  allow read, update, delete: if resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
                 && request.resource.data.uid == request.auth.uid;
}

match /incomeCategories/{id} {
  allow read, update, delete: if resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
                 && request.resource.data.uid == request.auth.uid;
}
```

Note: the `incomeCategories` block is written in full (not as the "identical to expenseCategories" shorthand) — a comment-only match block **denies all access**, so the shorthand is not deploy-safe.

Note: the `users` delete rule is the cascade's Firestore side — an account's own doc is removable, and deletion of the **default** account's doc is blocked only by app logic (its auth account would still exist; a console admin can always delete anything — this protection is in-app by design).

## Account deletion (cascade)

App-side routine, runs against the signed-in user's own data only:

1. Reauthenticate with the account password (`reauthenticateWithCredential`) — Firebase requires recent sign-in for `deleteUser`
2. Query all own `entries`, batch-delete
3. Query all own `expenseCategories` and `incomeCategories`, batch-delete
4. Delete the own `users` doc
5. `deleteUser()` — the auth account is removed
6. App returns to the Sign In screen

The default account is exempt: the Account tab blocks the flow before step 1.

## Indexes

| Collection | Fields | Purpose |
|-----------|--------|---------|
| `entries` | `type ASC, date DESC` | Tab lists |
| `entries` | `uid ASC, date ASC` | Range export/summary (`entriesInRange`) |

## Free-tier fit

A handful of accounts, each ~10 writes/day and ~100 reads/day. Firestore free tier (50K reads, 20K writes, 1 GB storage daily) is 3+ orders of magnitude above usage. No usage concern.
