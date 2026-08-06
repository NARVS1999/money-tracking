# Category deletion blocked until empty

A category cannot be deleted while any entry references it; deletion is refused with a message until all its entries are removed or recategorized.

The user's ledger must never silently lose or orphan data. Alternatives were cascade delete (rejected: destroys history the user logged deliberately), an "Uncategorized" bucket (rejected: pollutes breakdowns and reports with a meaningless group), and blocking deletion (chosen: zero data loss, forces an explicit choice). The check is a live query at delete time — no counter to maintain.

**Status:** accepted

**Consequences:** the app must expose how many entries use a category (usage count shown in the Categories tab) so the user can act; no orphaned `categoryId` values are possible.
