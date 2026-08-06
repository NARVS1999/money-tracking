# Project Research Summary

**Project:** Money Tracking — personal expense/income tracker (phone, Expo Go workflow)
**Domain:** Offline-first mobile expense/income logger with per-account private ledgers and PDF/Excel range exports
**Researched:** 2026-08-06
**Confidence:** HIGH (with one resolved conflict and a few flagged gaps — see Confidence Assessment)

## Executive Summary

Money Tracking is a personal, single-owner expense/income logger: manual entry (under 10 seconds), per-type categories, current-month summary, date-range PDF/Excel export, and email/password accounts that each own a private ledger. The market research confirms the chosen scope is a sound v1 — every feature maps to a category baseline — with three genuine gaps vs. competitors: **search/filter** (market-standard, missing), **CSV export** (near-free alongside Excel), and **charts** (deliberately excluded but the highest-demand feature in the category; flag for v1.x). The login-isolated-accounts model, the protected default account, and Copy-entry are deliberate differentiators the market doesn't offer. The recommended stack is Expo SDK 57 + Firebase JS SDK 12 (the only Firebase option that runs in Expo Go), React Context state, expo-print + SheetJS (CDN) for exports — all verified against official sources at specific versions.

**The single most important finding — and the biggest decision facing the owner — is that durable offline persistence does not work in Expo Go.** The draft tech-design's core assumption (Firestore `persistentLocalCache` + AsyncStorage = offline-first with zero sync code) is wrong. Verified against three primary sources (Firebase environments doc updated 2026-08-05, Firebase JS SDK source, GitHub issue firebase/firebase-js-sdk#7947): Firestore's durable cache is IndexedDB-only, React Native has no IndexedDB, and `persistentLocalCache()` throws `unimplemented` and silently falls back to an in-memory cache. Consequences: **within a session** offline works (reads stay available, writes queue and sync on reconnect); **durable offline does not** — queued offline writes are lost if the app is killed before sync, and a cold start with no network shows empty screens. The owner must decide: (a) accept session-scoped offline for the MVP (zero code — ship with the default memory cache and an honest "changes sync when online" indicator), or (b) invest ~1 extra phase in an `expo-sqlite` local-first sync layer (the only Expo Go-compatible path to restart-safe offline). This also partially invalidates ADR-0001's rationale (SQLite was rejected *because* Firestore persistence was assumed to deliver local-first for free) — the decision must be reopened.

Two further corrections to the draft design docs must be carried into every phase: **every Firestore query needs an explicit `where("uid", "==", uid)` clause** (rules are not filters — unscoped queries fail wholesale with `permission-denied`), and the export pipeline has four non-negotiable implementation details (legacy `expo-file-system/legacy` import for SAF, SheetJS from the CDN not npm, base64 writes not `writeFile`, chunked ≤500 cascade deletes). The recommended build order is a dependency chain: Firebase bootstrap + auth gate → categories → entries → summary → export → account lifecycle, with durable offline (if approved) and search/filter as follow-on phases.

## Key Findings

### Verified Stack (from STACK.md)

**Core technologies** (install everything native-adjacent with `npx expo install`; pure-JS with any current version):

| Technology | Version | Why |
|------------|---------|-----|
| Expo SDK | **57** (`expo@^57.0.11`, RN 0.86, React 19.2) | Current SDK; Expo Go store build ships 57; starting here avoids a forced upgrade |
| firebase (JS SDK, modular) | **^12.17.1** | Expo officially requires ≥12.0.0 (older fail with ES-module errors); only Firebase option that runs in Expo Go — never `@react-native-firebase/*` (needs dev builds) |
| @react-native-async-storage/async-storage | **2.2.0** (pin!) | Expo Go SDK 57 bundles 2.2.0; npm latest 3.x breaks in Expo Go. Its role: **auth session persistence** via `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` — NOT Firestore cache |
| @react-navigation/native + bottom-tabs + native-stack | 7.x (7.18.x current) | Current major; native deps bundled in Expo Go |
| expo-print | ~57.0.1 | HTML → PDF (`printToFileAsync`) — the only Expo Go PDF path |
| xlsx (SheetJS) | **0.20.3 from cdn.sheetjs.com** | npm's `xlsx` is frozen at 0.18.5 (stale, unpatched). Install: `npm i -S https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` |
| expo-file-system + expo-sharing | ~57.0.2 / ~57.0.10 | New `File`/`Directory`/`Paths` API; legacy methods (SAF, `writeAsStringAsync`) **throw unless imported from `expo-file-system/legacy`** |
| @react-native-community/datetimepicker | 9.1.0 | Bundled in Expo Go; native date UI; `maximumDate` blocks future dates |
| react-native-keyboard-controller | 1.21.9 | Bundled in Expo Go SDK 57; keyboard handling for the entry form |
| State: React Context + hooks (2 contexts) | — | Sufficient at this scale; no library (Zustand only if state grows past 2 contexts) |

### Expected Features (from FEATURES.md)

**Must have (table stakes) — the chosen v1 scope is validated against the market:**
- Manual entry expense/income (US-1) — the category floor; sub-10-second flow
- Per-type categories with delete guard (US-2) — guard is *stricter* than the market; keep (zero data loss aligns with the core value)
- Edit/delete entries (US-3) — universal expectation
- Current-month summary (US-5) — the "why am I opening this app" screen
- Date-range PDF/Excel export (US-6) — market-standard is Excel/CSV; PDF is the bonus
- Sign in + account isolation (US-7/8/9) — login-as-account is a differentiator
- Offline-first (FR-10) — category heritage — **but see the critical offline correction below**

**Should have (competitive / differentiators):**
- Copy entry with date reset (US-4) — the recurring-payments answer without automation machinery
- Protected default account — stronger safety property than any competitor
- **Search/filter over entries** — the one missing table-stake; P1.5 (v1 or immediately after; reuses the entry list data layer)
- **CSV export** — near-free (same pipeline as Excel, one extra writer); P1.5 — recommend folding into the export phase
- Offline-first as primary UX (within-session only in Expo Go — see correction)

**Defer:**
- v1.x: per-category budgets (trigger: "how much is left for food"), one minimal spending chart (highest-demand exclusion), CSV import
- v2+: recurring automation, shared/guest access, app lock, notifications
- **Anti-features (never/out):** bank integrations, widgets (impossible in Expo Go), receipt photos, tags, multi-currency

### Architecture Approach (from ARCHITECTURE.md, corrected)

A single React Native app talking to two "backends": Firebase (auth + Firestore) and the device filesystem (export pipeline). No server code. Providers own Firestore subscriptions; screens render derived state only; `utils/` is pure (money.js, dates.js, export.js) with filesystem interaction isolated in files.js.

**Major components:**
1. **AuthProvider** — `onAuthStateChanged` gate; signIn/signUp/signOut/deleteAccount (chunked cascade); `initializeAuth` with AsyncStorage persistence
2. **EntriesProvider** — one `onSnapshot` per signed-in account (uid-scoped), CRUD + copy actions, re-subscribe per `user.uid` and detach on sign-out
3. **CategoriesProvider** — two listeners (expense/income); delete guarded by `entries where categoryId == X, limit 1`
4. **Screens** — pure render; Home derives Summary by reducing cached entries over `monthRange()` (no aggregation queries)
5. **utils/** — money.js (integer cents, the only formatter), dates.js (local `"YYYY-MM-DD"`, never `toISOString`), export.js (range query → totals → PDF HTML / XLSX rows), files.js (SAF wrapper, the only `Platform.OS` branch)

**Key patterns:** provider + onSnapshot lifecycle (cache-first snapshot, server catch-up); uid-scoped rules with immutable-field checks (`request.resource.data == resource.data` — the `isDefault` guard is the canonical pattern); chunked `writeBatch` ≤500 ops (never `runTransaction` — transactions fail offline); generate-to-cache → SAF copy (Android) / share sheet (iOS) export pipeline.

### Critical Corrections to the Existing Design Docs

Five concrete corrections from research — three of these are mandatory for the code to work at all:

1. **Offline persistence reality (STACK.md, authoritative — resolves the ARCHITECTURE.md/PITFALLS.md assumption):** `persistentLocalCache()` does not work in Expo Go with the JS SDK (IndexedDB-only; silently falls back to memory cache; GitHub issue #7947). Offline in Expo Go is **session-scoped only**: queued offline writes are lost on app kill; cold-start offline shows empty screens. AsyncStorage backs *auth* persistence, not Firestore. Consequence: the `localCache: persistentLocalCache(...)` initialization in `tech-design.md`/ARCHITECTURE.md must be **dropped** (default memory cache) unless the owner commissions the expo-sqlite sync layer. ADR-0001's rationale ("built-in persistence = zero sync code") is partially invalidated — reopen the decision.
2. **uid-scoping on every query (PITFALLS Pitfall 1):** rules are not filters — any query on `entries`/categories without `where("uid","==",uid)` fails wholesale with `permission-denied`, even for the user's own data. The `backend-schema.md` query patterns (type filters, date ranges, categoryId checks) all lack it. Centralize query builders in one module; test with a second user's data in the emulator.
3. **expo-file-system legacy import (PITFALLS Pitfall 3):** `StorageAccessFramework`/`writeAsStringAsync` throw at runtime unless imported from `expo-file-system/legacy`. Decide this at Phase 1 dependency lock, not Phase 5.
4. **xlsx from CDN + base64 write path (STACK.md + PITFALLS Pitfall 6):** npm `xlsx` is stale (0.18.5, unpatched); install 0.20.3 from cdn.sheetjs.com. `XLSX.writeFile` doesn't work in RN — use `XLSX.write(wb, { type: "base64" })` + `writeAsStringAsync(uri, b64, { encoding: "base64" })`.
5. **Chunked cascade deletes (ARCHITECTURE.md + PITFALLS Pitfall 4):** `writeBatch` caps at 500 ops — the account-delete cascade must page and loop (real after ~2 months at 10 entries/day). Order: reauth (needs network) → data chunks → `users` doc → `deleteUser()` last (deleting auth first fires sign-out mid-cascade → dangling data).

### Critical Pitfalls (from PITFALLS.md)

1. **Unscoped queries fail wholesale under rules** — add `uid` filter to every query; centralize builders; emulator test with 2 users (Phase 1, re-checked every phase)
2. **Offline writes that violate rules succeed locally, then silently revert on sync** — never fire-and-forget writes; `.catch()` everything; use `hasPendingWrites`/`fromCache` for a visible sync indicator
3. **`deleteUser()` needs recent reauth, and cascade ordering corrupts the flow** — reauth first (offline: disable delete), delete data in ≤500 chunks, auth user last; gate behind a modal
4. **`printToFileAsync` writes to the app cache — the user never sees the file** — explicit SAF copy to Downloads (Android) / share sheet (iOS); persist the granted `directoryUri`
5. **`new Date().toISOString().slice(0,10)` = UTC dates** — entries logged 00:00–08:00 PH time land on yesterday; build `today()` from local components; unit-test near midnight (recovery is a data migration — expensive, so prevent early)

## Implications for Roadmap

Recommended build order (from ARCHITECTURE.md, adjusted for the corrections above). The dependency chain: **auth gates everything → categories feed entry forms → entries feed summary and exports → account lifecycle wraps it all.**

### Phase 1: Foundation — Firebase setup + auth gate + data utils
**Rationale:** Every component is uid-scoped; nothing works without auth state, deployed rules, and indexes. All money/date/query-building rules land here while the codebase is small. Decide the offline question (memory cache vs. durable) *before* this phase — it changes only initialization config, not the rest.
**Delivers:** Firebase project (email/password, Firestore, rules, composite index `type ASC, date DESC`, console-seeded default account), `config.js` (memory cache default; `initializeAuth` + AsyncStorage 2.2.0), `AuthProvider` + SignInScreen, `money.js` (manual ₱ formatting — never `Intl.NumberFormat`), `dates.js` (local-date helpers), centralized uid-scoped query builders, `expo-file-system/legacy` import decision.
**Addresses:** US-7 (sign-in), FR-13 (seed default account); date/currency foundations for every later phase.
**Avoids:** P1 (unscoped queries), P7 (UTC dates), P8 (Intl variance); the persistence-init misconfiguration.
**Research flag:** none — standard, well-documented patterns; low risk.

### Phase 2: Categories CRUD
**Rationale:** Simplest domain; validates the provider + listener pattern; the entry form's dropdowns need it.
**Delivers:** CategoriesProvider (two listeners), Categories screen, in-use delete guard (`limit(1)` query — uid-scoped).
**Addresses:** US-2.
**Avoids:** P9 (listener lifecycle — establish unsubscribe discipline here); P1 on the guard query.

### Phase 3: Entries CRUD + entry form (add/edit/delete/copy)
**Rationale:** The core value (10-second logging). Deliberately after categories. Include the offline-sync indicator here if the owner chose session-scoped offline (honest "changes sync when online" state via `hasPendingWrites`).
**Delivers:** EntriesProvider (uid-scoped `onSnapshot`), Expenses/Income tabs, EntryForm (add/edit/copy, datetimepicker, keyboard handling), write-error handling on all mutations.
**Addresses:** US-1, US-3, US-4.
**Avoids:** P2 (silent write revert), P9 (leaks/N+1 listeners), P10 (first-run/empty-state hints, offline test recipe on the physical phone).

### Phase 4: Home Summary
**Rationale:** Purely derived from state already built (month reduce over cached entries) — zero new data plumbing; fastest win.
**Delivers:** Home screen: total spent, total earned, per-category breakdown.
**Addresses:** US-5.
**Avoids:** P7 (month-range correctness at month boundaries).

### Phase 5: Range Export (PDF + Excel + recommended CSV)
**Rationale:** Needs real data volume to be meaningful, and it's the riskiest platform code — isolated after the data layer is proven. **Flag for `/gsd-plan-phase --research-phase 5`** — SAF + base64 file writes are the least textbook code in the app; needs device testing on both platforms via QR workflow.
**Delivers:** `export.js` (range query → totals → PDF HTML / XLSX rows, **CSV writer recommended as near-free add**), `files.js` (SAF grant + persisted `directoryUri`, Android Downloads / iOS share sheet), Export screen. SheetJS 0.20.3 from CDN; `expo-file-system/legacy` import.
**Addresses:** US-6; the CSV gap (P1.5).
**Avoids:** P3 (legacy import), P5 (invisible cache files), P6 (stale xlsx / `writeFile`).
**Research flag:** HIGH — device-test SAF on both platforms; verify the CDN tarball installs cleanly.

### Phase 6: Account lifecycle — create + delete
**Rationale:** The cascade is a cross-cutting teardown of everything phases 2–5 create; it needs every collection and the chunked-batch pattern. Prototype the ≤500 chunk loop here (not earlier — YAGNI — and not omitted — the ceiling is real).
**Delivers:** In-app account creation (sign-up + `users` doc + immediate sign-in), account deletion (reauth → chunked cascade → `deleteUser` → Sign In), default-account UI guard (never offers delete; optional rules hardening `!resource.data.isDefault`).
**Addresses:** US-8, US-9, FR-14.
**Avoids:** P4 (reauth + ordering + partial cascade). Verification: delete an account with 600+ entries; confirm no dangling docs.
**Research flag:** MEDIUM — cascade concurrency/partial-failure surface; keep it idempotent.

### Phase 7 (conditional): Durable offline via expo-sqlite — ONLY if the owner confirms restart-safe offline
**Rationale:** The only Expo Go-compatible path to durable offline; ~1 phase of real work (sync queue, tombstones for deletes, last-write-wins conflict policy). Do not build speculatively.
**Delivers:** Local-first write-through cache; Firestore stays the sync backend with the same rules and model.
**Avoids:** the "offline writes lost on kill" consequence of the STACK.md finding.
**Research flag:** HIGH if approved — this is greenfield sync-engine design, not a documented pattern. `expo-sqlite` is bundled in Expo Go, so the constraint holds.

### Phase 8 (candidate v1.x): Search/filter over entries
**Rationale:** The one missing table-stake; reuses the Phase 3 list data layer. Decision for the owner: ship in v1 (P1.5) or immediately after. Low risk either way.

### Phase Ordering Rationale
- **Dependency-driven:** auth → categories → entries → summary → export → teardown; each phase is buildable and testable once its dependencies exist.
- **Risk isolation:** the two platform-riskiest pieces (export SAF pipeline, cascade delete) are last, after the data layer proves the provider pattern.
- **Decision-first:** the offline decision (Phase 0/1 gate), the legacy-filesystem import choice (Phase 1), and the CSV inclusion (Phase 5) are all explicit earlier than the draft design scheduled them.
- **Every phase re-checks P1** (uid clause on each new query) — it's the failure mode that only surfaces with a second account.

### Research Flags Summary
- **Needs research-phase during planning:** Phase 5 (SAF/base64 export pipeline — device-specific), Phase 7 if approved (sync-engine design), search/filter phase (only UI-pattern scoping, low need).
- **Standard patterns (skip research-phase):** Phase 1 (Firebase console setup, auth, rules — all documented), Phase 2/3/4 (provider+listener and pure-derivation patterns are canonical), Phase 6 (cascade pattern documented; verification-heavy rather than research-heavy).

## Open Decisions for the Owner (must be resolved before/during roadmap planning)

1. **Durable offline or session-scoped offline?** The single biggest decision. Session-scoped (zero code, honest indicator) vs. expo-sqlite local-first layer (+1 phase). Note the core value as written ("data must be there when the phone is offline") is only met within a session in Expo Go — either adjust expectations or fund the sync layer. Reopens ADR-0001.
2. **Search/filter in v1 or v1.x?** Market-standard gap; P1.5. Cheap to schedule as a Phase 8; must be *decided* now so the entry-list data layer isn't built in a way that makes it awkward later (it won't be — it reuses the list layer — but scope expectations should be set).
3. **CSV export in Phase 5?** Near-free once the Excel writer exists (same pipeline). Recommend include; confirm.
4. **Budgets / charts flags:** v1.x candidates with explicit triggers (user asks "how much is left for food" / wants trends). Deferring costs nothing architecturally — summary aggregates are the same queries.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry, Expo SDK 57 docs/`bundledNativeModules.json`, Firebase docs & SDK source |
| Features | MEDIUM | Official competitor pages fetched directly and cross-checked across 3–4 sources for load-bearing claims; per-product claims are single-source (no paid search providers available); search/filter gap and CSV/charts reads are consistent across all competitors |
| Architecture | HIGH (corrected) | Patterns verified against official Firebase/Expo docs; **one core assumption (persistent cache) corrected by STACK.md** — corrected architecture is the memory-cache variant |
| Pitfalls | HIGH | Verified against official docs fetched 2026-08-06 (Firebase, Expo, SheetJS, Hermes); a few community/experience items flagged MEDIUM/LOW inline |

**Overall confidence:** HIGH — the one material disagreement (offline persistence) was resolved with primary-source evidence from STACK.md; remaining uncertainty is in feature-market claims (MEDIUM) and the unbuilt sync-layer design (future research if approved).

### Gaps to Address
- **Offline semantics UX:** if session-scoped is chosen, the exact wording/placement of the "changes sync when online" indicator needs design attention in Phase 3 (uses `hasPendingWrites`/`fromCache` metadata).
- **expo-file-system new API vs. legacy:** Phase 5 can use either the legacy SAF path (documented, works) or the new `File` API with `contentUri` for sharing; the legacy SAF route is the pragmatic one for Downloads writes — decide at Phase 1 dependency lock to avoid churn.
- **Durable-offline design (if approved):** tombstone/conflict-policy research is greenfield — commission a research-phase before planning Phase 7.
- **Feature-market depth:** FEATURES.md per-competitor claims rest on single official pages; re-verify the search/filter and CSV reads against the owner's actual usage before scheduling.
- **Persistence claim in PROJECT.md:** the Context/Key-Decisions rows citing "built-in offline persistence" and ADR-0001 need updating once the owner decides — flag for the roadmap planning pass.

## Sources

### Primary (HIGH confidence)
- Firebase environments guide (updated 2026-08-05) — Firestore "(except persistence)" for React Native; Expo guide "Using Firebase" (2026-07-17) — firebase ≥12 requirement, JS-SDK-only in Expo Go; Firebase JS SDK source (`cache_config.ts`, `index.rn.ts`) + GitHub issue firebase/firebase-js-sdk#7947 — the offline-persistence finding
- Firebase docs: enable-offline, rules-query ("rules are not filters"), rules-conditions, transactions, listen, quotas, pricing, delete-collections (500-op batch), auth manage-users (recent-login)
- Expo docs (SDK 57): expo-print, expo-file-system + /legacy, expo-sharing, datetimepicker, keyboard-controller, async-storage, bundledNativeModules.json, expo.dev/go, SDK 57 changelog
- docs.sheetjs.com (updated 2026-08-03) — CDN 0.20.3 install, RN demo (base64 + expo-file-system + SAF)
- Hermes IntlAPIs.md — platform-ICU variance, `formatToParts` Android-only
- npm registry API (2026-08-06) — version verification for all packages

### Secondary (MEDIUM confidence)
- Competitor official pages (fetched 2026-08-06): realbyteapps.com / Play listing, youneedabudget.com/features, spendee.com, bluecoinsapp.com (incl. Excel/CSV settings) — feature matrices; cross-checked across products for chart/search/CSV/recurring claims
- NerdWallet "Best Budget Apps for 2026" — market framing
- AsyncStorage README — platform support; 6MB Android SQLite budget (community-documented)
- Community-reported stuck-pending-write edge case; Expo Go LAN/tunnel behavior

### Tertiary (LOW confidence)
- Mint shutdown date (well-known market context, not load-bearing)
- Per-product single-page feature observations not cross-verified

---
*Research completed: 2026-08-06*
*Ready for roadmap: yes*
