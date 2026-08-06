# Feature Research

**Domain:** Personal expense/income tracker — mobile app (manual entry, offline-first)
**Researched:** 2026-08-06
**Confidence:** MEDIUM (findings from official competitor sources cross-checked across 4+ products; research environment had no paid search providers — see Sources for what each claim rests on)

## Scope Ground-Check Verdict (project vs market)

**Verdict: the chosen scope is a solid, market-aligned v1.** Every feature in the chosen scope maps to an expectation the market treats as baseline, and the deliberate exclusions are defensible. Three genuine gaps vs market norms were identified — **search/filter** (missing, market-standard), **CSV export** (near-free add alongside Excel), and **charts** (deliberately excluded but the single highest-demand feature in the category — flag for v1.x).

| Chosen scope item | Market status | Verdict |
|---|---|---|
| Manual expense/income entry | Absolute floor — every competitor | ✅ Table stakes, keep |
| Categories per type, delete-guarded | Category systems are universal; the "block delete while in use" guard is *stricter* than the market (most apps allow delete + re-file) | ✅ Table stakes, keep |
| Edit/delete entries | Universal | ✅ Table stakes, keep |
| Copy entry (date reset) | Unique substitute for recurring transactions + bookmark templates (market standard: Money Manager bookmarks & recurrence, Bluecoins reminders) | ✅ Clever differentiator-lite, keep |
| Current-month summary | Universal (weekly/monthly totals everywhere; calendar views in Money Manager/Bluecoins) | ✅ Table stakes, keep |
| Date-range PDF/Excel export | Excel/CSV is the market standard (Bluecoins, Money Manager, YNAB); PDF is offered but less common | ✅ Table stakes, keep — **add CSV**, see gaps |
| Email/password accounts, protected default account | Unusual — the market's "accounts" are *wallets within one app*, not login identities; login-isolation is a differentiator, not an expectation | ✅ Differentiator by design, keep |
| Offline-first | Category heritage — YNAB markets "even offline!", Bluecoins/Money Manager are local-first with optional sync | ✅ Table stakes, keep |
| **Search/filter over entries** | Standard: Money Manager has a Search page + reinforced filters; Bluecoins has filters + multi-select batch ops | ❌ **GAP — missing, should add** |
| **CSV export** | Dominant interchange format (Bluecoins exports CSV, Money Manager Excel backup, YNAB CSV) | ⚠️ **Near-free add** — same code path as Excel |
| **Charts/graphs** | Near-universal and a primary marketing hook for every competitor | ⚠️ Deliberately excluded — defensible, but highest-demand v1.x item |
| Budgets | Near-universal in leaders, but defines a different sub-category ("budget apps") | ⚠️ Correct to exclude from v1 logger; revisit at v1.x |

## Feature Landscape

### Table Stakes (Users Expect These)

Features every competitor ships and users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Manual entry (expense + income, amount, category, date, description) | The core act — every tracker has a sub-10-second entry flow; Money Manager, Spendee, Bluecoins, YNAB all center on it | LOW | Project US-1 ✓. Amount-as-cents + separate tabs matches market |
| Per-type category management (create, list, delete) | Universal — categories are the primary classification dimension in every product; hierarchy (sub-categories/groups) is the market norm but single-level is fine for v1 | LOW | Project US-2 ✓. Delete-guard is stricter than market (Money Manager/Bluecoins allow deleting used categories); keep the guard — zero data loss aligns with project's core value |
| Edit / delete entries | Universal — users log late from memory and fix mistakes | LOW | Project US-3 ✓ |
| Monthly totals + per-category breakdown | Every app shows current month spent/earned (Money Manager weekly/monthly totals, Spendee cashflow overview, Bluecoins dashboard) | MEDIUM | Project US-5 ✓. Requires query design for month-range aggregation |
| Date-range export (Excel/CSV) | Standard data-ownership feature — Bluecoins exports transactions/reminders/balance sheet to Excel/CSV; Money Manager Excel backup; YNAB CSV export | MEDIUM | Project US-6 ✓ (PDF+Excel). **CSV should be added** — same export pipeline, one extra writer |
| Offline-first local persistence | Category heritage: Bluecoins/Money Manager are local-first with optional cloud; YNAB markets "even offline!" | HIGH | Project FR-10 ✓ (Firestore offline persistence). Not a niche — it IS the category default |
| Find/filter entries (search by description/category/date, filter list) | Standard navigation aid — Money Manager ships a Search page + "reinforced filter"; Bluecoins has filters + batch multi-select | MEDIUM | **GAP — project has none.** Without it, "I logged it last week, find it" is scrolling. Add to v1 or v1.1; reuses the entry list data layer |

### Differentiators (Competitive Advantage)

Not required, but valuable — these are where the project competes or deliberately substitutes.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Copy entry with date reset to today | Repeating payments (rent, subscriptions) without recurring-transaction machinery — 3 taps instead of automation complexity. Money Manager solves this with bookmarks + recurrence; the Copy approach is simpler and honest | LOW | Project US-4 ✓. Aligns with "under 10 seconds" core value. Keep as the recurring-payments answer for v1 |
| Login-isolated private ledgers (email/password accounts) | Each family member gets a private ledger with real identity — the market's shared-wallet model (Spendee shared wallets, YNAB Together) requires sync/ownership complexity the project avoids | MEDIUM | Project US-7/8/9 ✓. Differentiator by design; cascade delete + protected default account are sound, and stricter than market norms |
| Protected default account (undeletable, console-seeded) | Guarantees the owner always has a recovery account — no competitor offers this because none have login-based ledgers | LOW | Project FR-13 ✓. Security-rules-enforced (isDefault immutable) |
| Offline-first as the primary UX (not a fallback) | Most apps treat offline as a degradation; this project's optimistic UI + Firestore persistence makes it the primary path | HIGH | Project FR-10 ✓. Genuine differentiator vs cloud-dependent apps |
| PDF export | Rarer than CSV/Excel in the category (Money Manager offers PDF/Excel; most offer CSV) — a shareable, human-readable artifact for the owner's own use | MEDIUM | Project US-6 ✓. PDF via expo-print; keep |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this project's constraints (Expo Go, free Firebase, personal single-owner use, text-first design).

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Bank/payment integrations (auto-import) | The premium hook in YNAB/Spendee; users love auto-import | High complexity; paid-tier feature in the market; Expo Go + PHP banks (GCash/BPI/UnionBank APIs) not feasible; conflicts with the manual-entry core value | Manual entry stays; CSV import (v1.x) covers migration |
| Budgets | Near-universal in category leaders (Money Manager per-category budgets, Spendee smart budgets, YNAB budget-first) | Defines a different product category with ongoing-maintenance UX; the owner's use case is logging, not planning | Keep excluded from v1; if the user starts asking "how much is left for food", add per-category monthly budgets at v1.x (reuses summary aggregates) |
| Charts/graphs | Every competitor's marketing hook (Spendee is charts-first, Money Manager chart packs, YNAB reports) | Design brief rejects (numbers are the interface); chart libraries add bundle + native-module risk in Expo Go | The summary's per-category breakdown list carries the insight; revisit a month-over-month bar at v1.x |
| Recurring transaction automation | Market standard (Money Manager recurrence, Bluecoins reminders, Spendee alerts) | Scheduling engine + notifications + edit-conflict handling = significant complexity for a logger; the owner logs manually anyway | Copy entry (US-4) is the deliberate v1 answer; automated recurring is v2 |
| Shared/family wallets | Spendee's flagship; YNAB Together | Ownership/conflict semantics; contradicts the privacy-per-account design | Accounts are already per-person; sharing is v2+ territory |
| Receipt photos | Money Manager (photo save) and Spendee (picture per expense) ship it | Storage (Firebase free tier), backup semantics, and camera/permission work in Expo Go; text-first design | Skip — description field covers the "what was this" need |
| Tags (as a second classification axis) | Power users ask for them | Category + description search covers the need; tags add UI + query complexity | Categories only (already chosen); revisit only if search shows demand |
| App passcode / biometric lock | Money Manager ships a passcode; finance apps commonly lock | Email/password sign-in already gates access; Expo Go biometrics (expo-local-authentication) work but add auth-state complexity for marginal gain on a personal device | Sign-in session is the lock; revisit at v1.x if the device is shared |
| Home-screen widgets (quick-add) | Popular: Money Manager quick-add widgets, Spendee/YNAB widgets | **Technically impossible in Expo Go** — widgets need native modules | None; requires a dev build, so it stays out permanently for this project |
| Daily log reminders / notifications | Spendee alerts, Bluecoins reminders | Expo Go supports local notifications, but reminder UX + scheduling adds scope the owner hasn't asked for | The Copy flow makes catch-up logging fast; revisit at v2 |
| CSV import | Migration/power feature (Bluecoins import guide, YNAB file import) | Only useful for switching users; greenfield owner starts empty | Add at v1.x alongside export — it completes the data-portability story |

## Feature Dependencies

```
Manual entry (US-1)
    ├──requires──> Categories per type (US-2) — the form's dropdown needs categories
    ├──requires──> Money formatting (integer cents) — every feature displays amounts
    └──requires──> Sign-in / account data scoping (US-7) — entries are scoped per account

Edit/delete (US-3) ──requires──> Manual entry (entry form + data layer)

Copy (US-4) ──requires──> Edit/delete (same pre-filled form mechanics)

Monthly summary (US-5) ──requires──> Manual entry data + date-as-string query design
    └──enhances──> Budgets (v1.x) — budgets aggregate the same category totals
    └──enhances──> Charts (v1.x) — charts render the same aggregates

Range export (US-6) ──requires──> Monthly summary (date-range aggregation pattern)
    ├──enhances──> CSV export — same range query + export pipeline, new writer
    └──enhances──> CSV import (v1.x) — imports into the same entry model

Account create/delete (US-8/US-9) ──requires──> Sign-in (US-7) + cascade delete design
    └──requires──> Categories + entries scoped per account (delete order: entries → categories → auth)

Search/filter (GAP) ──requires──> Entry list data layer (already built for Expenses/Income tabs)
    └──enhances──> Edit/delete — search results open the entry form
```

### Dependency Notes

- **Copy requires Edit/delete:** both use the shared pre-filled entry form (FR-2). Build edit first, Copy is then ~a day.
- **Monthly summary requires the date-as-string decision:** `"YYYY-MM-DD"` lexicographic range queries make both the summary and range export trivial and timezone-safe — this one decision is the backbone of two features.
- **Budgets/charts (v1.x) enhance the summary:** the aggregation queries built for US-5 are the same queries budgets and charts need. Deferring them costs nothing architecturally.
- **Search/filter enhances Edit/delete:** the biggest missing feature, and it plugs into existing screens without new data models.
- **CSV export conflicts with nothing** — it is the same pipeline as Excel with a different writer, which is why it is recommended now rather than later.

## MVP Definition

### Launch With (v1)

The chosen scope, validated against the market:

- [x] **Manual entry** (US-1) — the absolute category floor; without it the product does not exist
- [x] **Categories per type with delete guard** (US-2) — the second floor; the dropdown needs it
- [x] **Edit/delete entries** (US-3) — users log late from memory and must fix mistakes
- [x] **Copy entry** (US-4) — the recurring-payments answer; cheap, aligned with the 10-second core value
- [x] **Current-month summary** (US-5) — the "why am I opening this app" screen
- [x] **Date-range export PDF+Excel** (US-6) — data ownership; market-standard (Excel/CSV), PDF is the bonus
- [x] **Sign in + account isolation** (US-7/8/9, FR-13/14) — the differentiator; protected default account is a strong safety property
- [x] **Offline-first** (FR-10) — the category heritage and the project's core value

### Add After Validation (v1.x)

- [ ] **Search/filter over entries** — trigger: the user has 2+ months of data and starts hunting for entries. Reuses the list data layer; MEDIUM complexity. **This is the highest-priority post-launch add — the market treats it as standard.**
- [ ] **CSV export** — trigger: any need to open data outside the app (spreadsheets, other apps). Near-free alongside Excel; completes the data-portability story.
- [ ] **Per-category monthly budgets** — trigger: the user asks "how much is left for food". Reuses summary aggregates; the most common category feature after logging.
- [ ] **A single spending chart (month-over-month or by-category bars)** — trigger: the user wants to see trends. The highest-demand market feature the project deliberately excludes; one simple chart is the minimal concession.

### Future Consideration (v2+)

- [ ] **Recurring transaction automation** — when Copy feels repetitive; needs scheduling + notification machinery (Expo Go local notifications are available, but this is a real feature, not a day's work)
- [ ] **CSV import** — if the user ever switches from another tool or wants bulk migration
- [ ] **App lock (passcode/biometric)** — if the device becomes shared; sign-in session already gates access
- [ ] **Shared/guest access between accounts** — if family members ever want to see each other's ledgers (contradicts current privacy design)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Manual entry (US-1) | HIGH | LOW | P1 |
| Categories per type (US-2) | HIGH | LOW | P1 |
| Edit/delete entries (US-3) | HIGH | LOW | P1 |
| Monthly summary (US-5) | HIGH | MEDIUM | P1 |
| Sign-in + account isolation (US-7/8/9) | HIGH | MEDIUM | P1 |
| Offline-first (FR-10) | HIGH | HIGH | P1 (architectural — must be designed in from day one) |
| Range export PDF+Excel (US-6) | MEDIUM | MEDIUM | P1 (in chosen scope) |
| Copy entry (US-4) | MEDIUM | LOW | P1 (cheap, in chosen scope) |
| **Search/filter** | **HIGH** | **MEDIUM** | **P1.5 — the one missing table-stake; add v1 or immediately after** |
| CSV export | MEDIUM | LOW | P1.5 — nearly free once Excel writer exists |
| Budgets | MEDIUM | MEDIUM | P2 — v1.x, only if the user's behavior demands it |
| Charts (minimal) | MEDIUM | MEDIUM | P2 — v1.x, highest-demand exclusion |
| Recurring automation | MEDIUM | HIGH | P3 — v2 |
| CSV import | LOW | MEDIUM | P3 — v1.x/2 |

**Priority key:**
- P1: Must have for launch
- P1.5: Should have — cheap, closes a real market gap
- P2: Should have, add when possible (after validation)
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Money Manager (RealByte) | YNAB | Spendee | Bluecoins | Our Approach |
|---------|--------------------------|------|---------|-----------|--------------|
| Manual entry | ✅ core | ✅ (import-centric) | ✅ (cash) | ✅ core | ✅ Expenses/Income tabs, <10s |
| Categories | ✅ + sub-categories | ✅ groups + templates | ✅ custom | ✅ custom | ✅ per-type, single level, delete-guarded |
| Edit/delete entries | ✅ | ✅ | ✅ | ✅ + batch multi-select | ✅ (batch edit deferred — noted in Money Manager reviews as a pain point) |
| Recurring / repeat | ✅ bookmarks + recurrence | ✅ scheduled | ✅ alerts/reminders | ✅ reminders | ✅ **Copy** (deliberate manual substitute) |
| Monthly summary | ✅ weekly/monthly totals | ✅ spending reports | ✅ cashflow overview | ✅ dashboard cards | ✅ Home summary with big totals |
| Charts | ✅ many | ✅ reports/net worth | ✅ charts-first | ✅ insights cards | ⚠️ deliberately excluded (v1.x candidate) |
| Budgets | ✅ per-category monthly | ✅ budget-first (whole product) | ✅ smart budgets | ✅ | ⚠️ excluded (v1.x candidate) |
| Export | ✅ Excel backup + PDF | ✅ CSV | ✅ (premium) | ✅ CSV/Excel (transactions, reminders, balance sheet) | ✅ PDF + Excel; **CSV recommended** |
| Import | ⚠️ (PC editor) | ✅ bank + file/CSV | ✅ bank (premium) | ✅ CSV import | ⚠️ excluded (v1.x candidate) |
| Cloud sync | ✅ optional sync | ✅ multi-device incl. offline | ✅ sync/backup | ✅ Drive/Dropbox/OneDrive | ✅ Firestore = sync + backup built in |
| Offline | ✅ local-first | ✅ "even offline!" | ⚠️ sync-dependent | ✅ local-first | ✅ offline-first (primary path) |
| Multi-account (wallets) | ✅ double-entry accounts | ✅ budget accounts | ✅ wallets + shared wallets | ✅ accounts | ⚠️ different model — accounts are login identities, not wallets |
| Multi-currency | ✅ | ✅ | ✅ | ✅ | ❌ PHP only (correct for owner's use) |
| Bank integration | ❌ | ✅ flagship | ✅ flagship | ⚠️ SMS import | ❌ excluded (anti-feature) |
| Receipt photos | ✅ photo save | ⚠️ attachments | ✅ picture per expense | ❌ | ❌ excluded (text-first) |
| Search/filter | ✅ Search page + filters | ✅ | ✅ | ✅ filters | ❌ **GAP — add v1.x** |
| App lock | ✅ passcode | ✅ 2FA + security | ✅ | ✅ data security | ⚠️ sign-in gates access; v1.x candidate |
| Widgets | ✅ quick-add widgets (4.12) | ✅ mobile widgets | ✅ | ❌ | ❌ impossible in Expo Go |
| Passwords/accounts | ❌ (single user) | ✅ login + 2FA | ✅ login | ❌ (local) | ✅ email/password, protected default — **project differentiator** |

## Sources

Primary (fetched 2026-08-06):
- **Money Manager / RealByte** — official site https://www.realbyteapps.com/ and Google Play listing https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree (4.8★, 461K reviews, 10M+ downloads; features: recurrence, bookmarks, budgets, passcode, Excel backup, search page, batch edit, quick-add widgets; PH reviewer visible in reviews — market overlap with the Philippines confirmed). Confidence: LOW (single official source each).
- **YNAB** — official features page https://www.youneedabudget.com/features/ (2026; bank import, offline sync, sharing for 6, goals, loan calculator, reports, widgets; 4.7★, 102K App Store reviews). Confidence: LOW.
- **Spendee** — official site https://www.spendee.com/ (shared wallets, bank/crypto connect, smart budgets, multi-currency, alerts/reminders, charts; 4.7★ App Store, UX award 2017). Confidence: LOW.
- **Bluecoins** — official site https://bluecoinsapp.com/ + Excel/CSV settings page https://www.bluecoinsapp.com/settings/excel-csv-data-settings/ (CSV import/export of transactions/reminders/balance sheet, Drive/Dropbox/OneDrive sync, local backup, bank SMS import, reminders, multi-select batch ops; 1M+ downloads). Confidence: LOW.
- **NerdWallet** — "Best Budget Apps for 2026" roundup https://www.nerdwallet.com/article/finance/best-budget-apps (market framing: budget apps evaluated on features/usability; category breadth for individuals and couples). Confidence: LOW.

Cross-cutting claims (e.g., "charts are near-universal", "recurring is standard", "CSV is the dominant export format") are **verified across 3–4 independent official sources** — MEDIUM confidence collectively, per the verification protocol. Mint's shutdown (March 2024) is treated as well-known market context (not fetchable from primary source in this environment) — LOW confidence as a dated claim, not load-bearing for this research.

**Confidence note:** the research environment had no paid web-search providers (Brave/Exa/Tavily unavailable — no API keys), so all findings come from direct fetches of official product pages (webfetch) plus cross-checks. Official-page findings are cited per source above; anything marked ⚠️ or ❌ in the competitor table that was not directly observed on a fetched page is flagged as such in the feature rows.

---
*Feature research for: Money Tracking (personal expense/income tracker)*
*Researched: 2026-08-06*
