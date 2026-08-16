---
slug: sync-scheduled-delete-permissions
status: investigating
trigger: |
  effect i cannot sync my local changes :  WARN  [sync] push failed: scheduledEntries/local-msuu4tct-hlya09ub (delete) [FirebaseError: Missing or insufficient permissions.]
created: 2026-08-16
updated: 2026-08-16
---

# Debug Session: sync-scheduled-delete-permissions

## Symptoms

- Expected: Local changes sync to Firestore without errors.
- Actual: Sync fails with `FirebaseError: Missing or insufficient permissions.` when pushing a delete operation for a scheduled entry.
- Error: `[sync] push failed: scheduledEntries/local-msuu4tct-hlya09ub (delete) [FirebaseError: Missing or insufficient permissions.]`
- Timeline: Started when deleting a scheduled entry that was created locally (temp ID).
- Reproduction: Delete a scheduled entry that hasn't been synced yet (has local temp ID starting with `local-`).

## Current Focus

- hypothesis: CONFIRMED. The docId is a local temp ID (`local-*`) that was never created in Firestore. The Firestore delete rule requires `resource.data.uid == request.auth.uid` — but if the doc doesn't exist, `resource.data` is undefined, causing a permission error. The sync service's delete path (`syncService.ts:321-325`) calls `deleteDoc(doc(db, item.collection, docId))` unconditionally without checking if the docId is a local temp ID.
- test: (pending)
- expecting: The sync service should skip delete operations for local temp IDs since those docs were never created in Firestore.
- next_action: Apply fix to syncService.ts delete path to check isTempId before calling deleteDoc.

## Evidence

- timestamp: 2026-08-16 — Error message shows docId starts with `local-` prefix, indicating a local temp ID
- timestamp: 2026-08-16 — Firestore rules at deploy/firestore.rules:42-46 require `resource.data.uid == request.auth.uid` for deletes
- timestamp: 2026-08-16 — syncService.ts:321-323 shows delete path: `await deleteDoc(doc(db, item.collection, docId))` — no check for local temp IDs
- timestamp: 2026-08-16 — idMapping.ts:21-22 confirms `isTempId()` recognizes `local-*` prefix pattern
- timestamp: 2026-08-16 — syncService.ts:203-251 shows create path correctly checks `isTempId()` before pushing

## Fix Applied

1. **src/sync/syncService.ts (delete path)** — Added `isTempId(docId)` check before calling `deleteDoc`. If the docId is a local temp ID, the delete is skipped (doc was never created in Firestore) and the queue item is drained. This matches the create path's temp-ID handling pattern.

## Resolution

- status: resolved
- root_cause: The sync service's delete path called `deleteDoc` unconditionally without checking if the docId was a local temp ID. Firestore's delete rule requires `resource.data.uid == request.auth.uid`, but if the doc doesn't exist, `resource.data` is undefined, causing the permission error. The comment "deleteDoc on a doc that was never created is a no-op success" was incorrect — it's only true when security rules don't check `resource.data` on deletes.
- fix: Added `isTempId(docId)` guard before the `deleteDoc` call, matching the pattern used in the create path.
- fix_satisfies: syncService-test.ts existing tests pass (delete temp ID now skipped instead of failing).
- guardrail_verdict: passed
