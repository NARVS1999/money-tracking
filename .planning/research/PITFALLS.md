# Pitfalls Research

**Domain:** Personal expense/income tracker — React Native (Expo Go, QR-tested), Firebase JS SDK + Firestore offline-first, AsyncStorage persistence, PHP integer-cents, `"YYYY-MM-DD"` string dates, expo-print/SheetJS exports
**Researched:** 2026-08-06
**Confidence:** HIGH where verified against official docs fetched today (Firebase, Expo, SheetJS, Hermes); MEDIUM/LOW flagged inline

## Critical Pitfalls

### Pitfall 1: Queries missing the `uid` filter fail wholesale under security rules

**What goes wrong:**
Every query on `entries`, `expenseCategories`, `incomeCategories` that does **not** include `where("uid", "==", currentUser.uid)` fails with `permission-denied` — even for the user's own data. Tab lists, date-range exports, category-in-use checks, and the Home summary all break at once.

**Why it happens:**
Firestore official docs, verbatim: *"security rules are not filters — queries are all or nothing… If a query could potentially return documents that the client does not have permission to read, the entire request fails."* Rules evaluate the query against its *potential* result set. Since `entries` holds many users' docs and the rules scope reads by `resource.data.uid == request.auth.uid`, an unscoped query can *potentially* match another user's doc, so the whole query is rejected. **The query patterns in `backend-schema.md` (`where type == "expense"` order by date, date-range, `where categoryId == X`) all lack the `uid` filter and will fail as written.**

**How to avoid:**
- Add `where("uid", "==", uid)` to **every** collection query, including the category-in-use check (`entries where uid == X AND categoryId == Y, limit 1`).
- Centralize query builders in one module (e.g. `src/firebase/queries.js`) so the uid clause can't be forgotten per-call-site.
- Test against the emulator with a second user's data present — that reproduces the failure immediately.

**Warning signs:**
- `FirebaseError: permission-denied` in console for reads that "should" work.
- Works on a fresh database with one user; breaks only after a second account adds data.

**Phase to address:** Phase 1 (Data Foundation — query builders + rules written together) and re-checked in every later phase that adds a query.

---

### Pitfall 2: Offline writes that violate rules succeed locally, then silently revert on sync

**What goes wrong:**
A write queued while offline is applied optimistically to the UI and cache. Security rules are **not** evaluated until the write reaches the server. If the write violates rules (e.g. a buggy client writes another uid, or an entry create without category), it syncs, gets rejected, the write promise rejects, and the local document reverts — the user sees an entry they logged **disappear** later. In the worst known JS-SDK edge cases (community-reported, MEDIUM confidence) a rejected write can linger in the pending queue.

**Why it happens:**
Offline-first design plus "rules evaluated at sync time" semantics. Nothing tells the UI at write time that the write will fail.

**How to avoid:**
- Always `.catch()` write promises (`addDoc`, `updateDoc`, `deleteDoc`, batched writes) and surface a user-visible error; never fire-and-forget.
- Subscribe with `onSnapshot(q, { includeMetadataChanges: true })` and read `snapshot.metadata.hasPendingWrites` / `snapshot.metadata.fromCache` to show a "syncing / not yet saved" indicator and detect reverted docs (pending → not-pending without a data change means rejection).
- Keep writes simple and rule-compatible by construction (client always writes `uid` from `auth.currentUser.uid`, never from state).

**Warning signs:**
- Entries visible in the list after logging while in airplane mode, then gone after reconnect.
- `hasPendingWrites` stays true for docs that were written while offline.

**Phase to address:** Phase 2 (Entry Logging — write error handling + sync status) and Phase 6 (Hardening — offline write tests).

---

### Pitfall 3: expo-file-system legacy API (StorageAccessFramework, writeAsStringAsync) throws in current Expo SDKs

**What goes wrong:**
`tech-design.md` calls for `expo-file-system` `StorageAccessFramework` + `writeAsStringAsync` + `documentDirectory`. In Expo SDK 54+ (docs show SDK 57 as current, 2026-08), **the legacy API is deprecated and the docs state it "will throw in runtime"** unless imported from `expo-file-system/legacy`. The export screen crashes on the first export.

**Why it happens:**
expo-file-system introduced a new class-based API (`File`, `Directory`, `Paths`, `FileHandle`) and moved the old flat API to `expo-file-system/legacy`. Most tutorials and older designs reference the legacy names.

**How to avoid:**
- Decide explicitly at Phase 4 (Export): either `import * as FileSystem from "expo-file-system/legacy"` (keeps the tech-design code path — SAF + base64 writes still work and run in Expo Go), or migrate to the new API (`new File(Paths.cache, "x.pdf")`, `File.contentUri` on Android for sharing).
- Note: in the new API, SAF `content://` URIs do not support `ReadWrite` file handles; the legacy SAF methods are the pragmatic path for writing into a user-picked Downloads folder.
- Add a smoke test that performs one real export on device in the phase, not just at the end.

**Warning signs:**
- `TypeError: FileSystem.writeAsStringAsync is not a function` or "Deprecated … will throw in runtime" errors on export.
- Undefined exports from `expo-file-system` after `npx expo install`.

**Phase to address:** Phase 4 (Range Export) — but flag it in Phase 1 dependency selection so the choice is made early.

---

### Pitfall 4: `deleteUser()` fails with `auth/requires-recent-login`, and cascade ordering corrupts the flow

**What goes wrong:**
- Account deletion throws `auth/requires-recent-login` unless the user reauthenticated recently (official docs: delete is a "security-sensitive action" needing recent sign-in; reauth via `reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password))` grants a fresh — short, minutes-scale — window).
- Reauthentication **requires network**: offline, the cascade cannot run at all (auth calls don't work from cache).
- Deleting the auth user **first** fires `onAuthStateChanged(null)` immediately — the app flips to the Sign In screen mid-cascade, React unmounts providers, and the remaining Firestore deletes may be aborted → **dangling entries/categories with no auth user**.
- Firestore `writeBatch` is capped at **500 operations** per batch (official limit); an account with >500 entries needs chunked batches.

**Why it happens:**
Auth state changes are immediate and global; Firestore deletes are async and batched. Developers naturally do "delete auth user" first because it feels like the root object.

**How to avoid:**
- Cascade order: (1) reauthenticate, (2) delete Firestore data in chunks of ≤500 (query own entries and categories, delete in batches, loop), (3) delete the `users` doc, (4) `deleteUser()` last, (5) then let `onAuthStateChanged` land on the Sign In screen.
- Gate the whole cascade behind a "deleting…" modal/flag so navigation can't be triggered mid-flow; wrap each step so a network failure stops with a clear message and a retryable state (idempotent: re-run deletes safely).
- Handle the reauth failure distinctly ("password incorrect" vs "requires-recent-login → show password prompt first").

**Warning signs:**
- `FirebaseError: auth/requires-recent-login` (code 17031 / `auth/requires-recent-login`) on delete.
- After a "successful" delete, the Firebase console still shows the user's `entries` collection.
- App lands on Sign In while the delete spinner is still up.

**Phase to address:** Phase 5 (Accounts & Auth).

---

### Pitfall 5: `printToFileAsync` writes PDFs to the app cache directory — the user never sees the "exported" file

**What goes wrong:**
expo-print docs (fetched 2026-08): `printToFileAsync` "Prints HTML to PDF file and saves it to [app's cache directory]". On Android, that cache is app-internal — invisible to the user and **cleared by the OS under storage pressure**. The app says "Export complete" and the user can't find the file in Downloads.

**Why it happens:**
`printToFileAsync` returns a `{ uri }` in cache; there is no automatic "save to Downloads" — the design brief requires the file in Downloads, so an explicit copy step is mandatory. The same applies to the Excel file (wherever it's written first).

**How to avoid:**
- Always take the `uri` from `printToFileAsync` (or use `base64: true` and encode directly) and then:
  - **Android:** `StorageAccessFramework.requestDirectoryPermissionsAsync(...)` → `createFileAsync(uri, name, "application/pdf")` → `writeAsStringAsync(file, base64, { encoding: "base64" })` (legacy import — see Pitfall 3). The user picks Downloads once; subsequent exports skip the picker while the permission lasts.
  - **iOS:** `Sharing.shareAsync(uri, { UTI: "com.adobe.pdf", mimeType: "application/pdf" })` — the share sheet is the only reliable Expo Go path (Expo Go can't apply `UIFileSharingEnabled`/`LSSupportsOpeningDocumentsInPlace` Info.plist keys).
- Filename pattern `expenses-2026-08-01_31.pdf` is fine; include it in `createFileAsync`.

**Warning signs:**
- "Export succeeded" toast but no file in Downloads/Files app.
- On Android, export works once then breaks after the system clears cache.
- Files found under `/data/data/host.exp.exponent/...` cache paths (Expo Go's internal storage).

**Phase to address:** Phase 4 (Range Export).

---

### Pitfall 6: SheetJS — stale npm package, and `XLSX.writeFile` doesn't work in Expo Go

**What goes wrong:**
- The npm-registry `xlsx` package is **stale (0.18.5)**; SheetJS's official docs call the registry "out of date" and point to `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (current 0.20.3, 2026-08) — security fixes (prototype-pollution, fixed ≥0.19.3) and bug fixes are missing from the npm version.
- `XLSX.writeFile(wb, path)` does **not** work out of the box in React Native/Expo — the SheetJS official RN demo never uses `writeFile`; it uses `XLSX.write(wb, { type: "base64", bookType: "xlsx" })` and writes the base64 string with expo-file-system.

**Why it happens:**
`writeFile` assumes Node/fs shims; RN has none by default. The npm package being stale is a known registry bug (documented by SheetJS).

**How to avoid:**
- Install via the CDN tarball (or vendor it per SheetJS recommendation): `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
- Export pattern: `const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" })` → `writeAsStringAsync(uri, b64, { encoding: "base64" })` → SAF copy (Android) / share (iOS).
- UTF-8/peso sign: fine with modern SheetJS; the `cpexcel` codepage module is only needed for legacy formats (skip it).
- Beware "Unsupported scheme for location …" — expo-file-system can't read some `content://` URIs; only relevant if the app later imports files (keep `copyToCacheDirectory: true`).

**Warning signs:**
- `TypeError: XLSX.writeFile is not a function` or a silent no-op on device.
- `npm audit` reporting the stale 0.18.5 prototype-pollution issue.

**Phase to address:** Phase 4 (Range Export).

---

### Pitfall 7: `new Date().toISOString().slice(0, 10)` produces UTC dates — entries near midnight land on the wrong day

**What goes wrong:**
Any date-string helper built on `toISOString()` returns the **UTC** calendar date. In the Philippines (UTC+8), entries logged between 00:00 and 08:00 local get stamped with **yesterday's** date: the Home summary misses them, and range exports split them across months.

**Why it happens:**
`toISOString()` is UTC by definition. It's the most common snippet found in tutorials and LLM output, and the bug only shows in the morning hours — easy to miss during daytime testing.

**How to avoid:**
- Build `today()` from local components: `new Date(getFullYear(), getMonth(), getDate())` → pad to `YYYY-MM-DD`. Never derive the local date from `toISOString`/`toUTCString`/`getUTCDate`.
- Month range: compute first/last day using local `Date` math (`new Date(y, m, 1)` and `new Date(y, m+1, 0)`), format locally.
- Unit-test `today()`/`monthRange()` with a mocked local timezone near midnight (Phase 1 tests).

**Warning signs:**
- A test entry logged at 1 AM shows yesterday's date.
- Home summary "misses" the first entry of the month for early-morning logs.

**Phase to address:** Phase 1 (Data Foundation — `dates.js`) and Phase 3 (Summary).

---

### Pitfall 8: `Intl.NumberFormat` currency output varies per device — never use it for the ₱ display

**What goes wrong:**
Hermes's `Intl.NumberFormat` is implemented by delegating to the **platform's ICU/CLDR** (Hermes IntlAPIs doc). Currency symbol rendering for `en-PH`/`PHP` therefore varies across Android OS versions (CLDR 28 → 36.1 depending on API level) and iOS versions — some devices render `₱ 1,234.50`, others `PHP 1,234.50` or `₱1,234.50` with different spacing. `formatToParts()` — the usual workaround for custom layout — is **Android-only** and throws/undefined on iOS.

**Why it happens:**
Hermes deliberately avoided bundling ICU; platform-provided facilities are version-dependent. The design brief demands a fixed presentation (₱ + tabular numbers).

**How to avoid:**
- Keep all formatting in `money.js` (ADR-0003): manual `"1,234.50"` from integer cents with a fixed peso prefix, no `Intl.NumberFormat` anywhere.
- Parse user input by stripping `₱/P/PHP`, commas, and spaces, matching digits and a single decimal point, then `Math.round(Number(digits + cents))` — never `parseFloat(input) * 100` (float drift) and never `toFixed(2)` on a float path for storage.
- If `Intl` is ever needed (e.g. localized list formatting), use it only for non-currency text.

**Warning signs:**
- Formatting looks right on the dev's phone but wrong on the test phone (different OS version).
- `formatToParts` returns `undefined` on an iOS device.

**Phase to address:** Phase 1 (Data Foundation — `money.js`), regression-checked in Phases 2–4.

---

### Pitfall 9: Firestore listener leaks and unbounded snapshots in React Context providers

**What goes wrong:**
- `onSnapshot` subscriptions created in provider `useEffect` without cleanup (or with cleanup that re-runs on every render due to unstable query objects) accumulate listeners. Each reload in Expo Go dev (Fast Refresh) can double subscriptions; each listener holds a network stream and bills reads on its initial snapshot.
- Subscribing once per entry (N+1 document listeners) instead of one collection query explodes connection count and read billing.
- Rendering the full unbounded snapshot array re-renders every row on every change (including remote updates from a second device or sync bursts after backgrounding).

**Why it happens:**
React Context + `useEffect` + Firestore listeners is a classic leak vector: providers mount once but re-create subscriptions when deps change; Expo Go dev reloads re-execute modules.

**How to avoid:**
- Create subscriptions in `useEffect` with a stable query object and return the `unsubscribe` function; add a `unsubscribe` guard on unmount.
- One query per tab/list (all entries of a type), derive everything in-memory — the app's scale makes per-item listeners pure waste.
- Memoize the query (`useMemo`) so effects don't re-fire.
- Verify listener count in dev: log on subscribe/unsubscribe; expect 2–4 active listeners for 4 tabs + summary, not dozens.

**Warning signs:**
- Console shows repeated "subscribe" for the same query after navigation/reload.
- Firestore usage dashboard shows read counts much higher than user actions would produce.
- Memory grows while navigating tabs; app slows after many reloads.

**Phase to address:** Phase 2 (Entry Logging — providers) and Phase 6 (Hardening — listener audit).

---

### Pitfall 10: First-run-offline gives empty screens; offline behavior in Expo Go is only testable after the bundle loads

**What goes wrong:**
- On a fresh install (or after clearing app data) with no network, Firestore queries return **only cached documents** — the cache is empty, so Home/Expenses/Income show empty lists (official docs: offline queries "initially run only against the cached documents"). Combined with the Expo Go dev workflow (Metro serves the JS bundle over the LAN), a cold start with airplane mode on can't even load the app.
- Also: new query *shapes* executed only offline may behave inconsistently until they've run online once (cache is populated by prior online use).

**Why it happens:**
Offline-first ≠ offline-first-run. The cache is a mirror of previously-observed data; Expo Go dev mode has no bundled app binary.

**How to avoid:**
- In the UI, distinguish "empty because no data" from "empty because offline & no cache" (from `snapshot.metadata.fromCache` + `snapshot.empty`) and show a "No entries yet — connect once to sync" hint.
- Document and rehearse the offline test recipe: (1) open app online, (2) use it, (3) airplane mode, (4) verify adds/edits/deletes + summary still work, (5) reconnect, (6) verify sync. Put this in the phase's verification checklist — it's the app's core value.
- Keep the seed/import path (console or a one-time script) available so a second device can pre-populate the cache for tests.

**Warning signs:**
- "Offline works!" verified only in a web build or simulator; on the physical phone the Metro connection masks/breaks offline flows.
- User reports data "missing" after reinstall while offline.

**Phase to address:** Phase 2 (Entry Logging) with explicit offline UAT in Phase 6 (Hardening).

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store amounts as JS `number` (pesos) instead of integer cents | Simpler input parsing | Float drift in totals/groupings; ADR-0003 violated | Never — integer cents is the domain rule |
| Format money with `Intl.NumberFormat` instead of `money.js` | One-liner | Device-dependent output breaks the design language (Pitfall 8) | Never |
| Fire-and-forget Firestore writes (no `.catch`) | Less code | Silent data loss when offline writes revert (Pitfall 2) | Never for entry writes |
| Global `console.log`-style listener without unsubscribe | Quick wiring | Leaks accumulate across navigation/reloads (Pitfall 9) | Only in throwaway spikes |
| Build export files straight into cache and rely on the OS to keep them | Saves 10 lines | Files vanish; user can't find exports (Pitfall 5) | Never — copy/share step is the feature |
| Share one Firestore instance created at module top-level with `getFirestore()` default settings | Simple | Can't add `persistentLocalCache` later without a migration (init order) | Never — initialize with cache from day one |
| AsyncStorage for non-Firestore app state too | One storage lib | Firebase's cache shares the 6MB Android SQLite budget; unrelated keys bloat it | OK only for tiny settings, flagged MEDIUM confidence |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Firebase JS SDK + Expo Go | Installing `@react-native-firebase/*` (native modules) and "debugging" why Expo Go crashes | JS SDK only; verify every new Firebase import runs in Expo Go (tech design's critical constraint) |
| Firestore init | Calling `getFirestore()` before `initializeFirestore(app, { localCache })`, or initializing twice under Fast Refresh | One `initializeFirestore` at module load with `persistentSingleTabManager`; guard re-init; never `persistentMultipleTabManager` on RN (IndexedDB/web only) |
| Firestore + AsyncStorage | Assuming persistence auto-enables; forgetting `@react-native-async-storage/async-storage` | Install async-storage explicitly; SDK RN build (`dist/index.rn.js`, verified npm 4.17.0) uses it; if missing, persistence fails at startup — check for init errors |
| Composite indexes | Forgetting `type ASC, date DESC`; app errors with a console URL to create it | Create both indexes in the one-time setup; add index links to setup docs (errors link to console) |
| Security rules | Rules deployed after the app is live; offline client writes bypass rules until sync | Deploy rules before first device test; test with the emulator + a second user's data (Pitfall 1) |
| Auth email/password | Creating the default account in-app (rules will reject `isDefault: true`) | Seed via console/Admin SDK only (also: Spark plan has no Cloud Functions for outbound seeding) |
| expo-print HTML | Using unsupported CSS (flexbox in some WebViews), or local image URLs (iOS WKWebView) | Keep HTML simple (tables); no images needed here; set `@page` margins on Android |
| SheetJS | `npm i xlsx` (stale 0.18.5) or `writeFile` | CDN tarball install + `XLSX.write` base64 (Pitfall 6) |
| expo-sharing | Sharing a `file://` cache URI with wrong mime | `shareAsync(uri, { mimeType: "application/pdf" })`; iOS needs explicit mime/UTI |
| Firebase quota | Adding a second (named) Firestore database "for testing" | Spark allows exactly one free database per project; a second database requires billing |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| One `onSnapshot` per entry (N+1 listeners) | Slow tabs, huge read counts, connection churn | One collection query per screen; filter/group in memory | ~50+ listeners |
| Unbounded snapshots rendered whole | Jank on every sync burst after background | FlatList with stable keys; memoized rows; optional `limit(200)` on lists | ~500+ visible rows on low-end phones |
| Re-creating queries in effects (new query objects each render) | Listener subscribe/unsubscribe loops | `useMemo` queries; stable module-level query builders | Immediately (dev logs show churn) |
| Backgrounding with many listeners | Excessive reads on foreground resume | Persistence keeps reconnect reads free (no re-fetch with persistence); keep listener count low anyway | Any heavy usage |
| Export building full HTML for years of entries | Export screen freeze | Chunk rows; the date-range filter bounds it (per-month exports fine) | Years of data in one range |
| Category-in-use check querying all entries | Slow delete of categories on huge ledgers | `limit(1)` (already in design) — fine at this scale; no counter needed | 10K+ entries (not this project) |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rules deployed without uid scoping (or queries without uid filter) | Cross-account data exposure or wholesale query failure (Pitfall 1) | Every collection rule keys on `request.auth.uid`; every query includes the uid clause; test with 2 accounts |
| Relying on rules to validate offline writes | Silent revert / UI lying about saved state (Pitfall 2) | Client-side validation mirrors rules; catch write errors; show sync status |
| Client-crafted `isDefault: true` on create | Forged default account | Rules already reject it (schema is correct); keep the update rule's immutability check |
| Default-account delete protection only in UI | Rules allow deleting the default `users` doc; UI-only guard is bypassable | Accept as designed (console admin can always delete); ensure the app *never* offers delete for default; optionally add a rule using `isDefault` to deny delete when true (cheap hardening: `allow delete: if ... && !resource.data.isDefault`) |
| Leaving seed credentials in app code | Anyone with the config could seed a fake default | Firestore rules are the backstop; seed only via console/Admin SDK |
| `amountCents` stored as float (e.g. `24.5` instead of `2450`) | Math drift and validation mismatches | Integer validation on write (`Number.isInteger(amountCents)`) in rules (rules can't check types deeply, but `request.resource.data.amountCents is int` works) |
| Logging full entry data in dev console | Sensitive spending habits visible in logs | No entry-level logging; log only counts/errors |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No pending-sync indicator while offline | User can't tell if an entry will survive | Subtle "saving… / queued" state from `hasPendingWrites`; clear "saved" when synced |
| "Export complete" but file is in app cache | User hunts for a file that isn't there (Pitfall 5) | Always copy to Downloads (Android) or share sheet (iOS) with the filename visible |
| Decimal/keyboard: numeric keypad without decimal on some locales | Slow entry; breaks 10-second goal | `keyboardType="decimal-pad"`; auto-insert `0.` prefix; parse leniently |
| Deleting a category silently blocked | Confusing "in use" error | Explain which categories block deletion; show the entry count in the dialog |
| Copy resets date to today without confirmation | User expects identical copy | Show a one-line "Date set to today" hint in the copied row (design decision, but verify) |
| Signing into a fresh account shows empty everything with no hint | "Where's my data?" | Empty-state copy: "This account has no entries yet" (Pitfall 10) |
| Deleting an account mid-offline | Cascade can't run (reauth needs network); user stuck | Disable delete action when offline with a "connect to delete" message |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Offline persistence:** App works offline — but was it tested by (1) running online, (2) airplane mode, (3) writing, (4) reconnecting? The cache must be populated first.
- [ ] **Security rules:** Rules "work" for the main user — but have they been tested with a **second account's data present** (Pitfall 1)? One unscoped query fails only then.
- [ ] **Export:** PDF/Excel generates — but is the file actually visible in Downloads/Files, and does it survive a system cache clear (Pitfall 5)?
- [ ] **Account deletion:** Cascade "works" on a fresh test account — but was it tested with >500 entries (batch limit) and with the auth user still present in the console afterward (Pitfall 4)?
- [ ] **Money display:** Formatting "looks right" — but on the other device (different Android version / iOS) (Pitfall 8)? Test on both phones.
- [ ] **Date logic:** Entries "save fine" — but was one logged just after midnight (Pitfall 7)?
- [ ] **Listener cleanup:** App "works" — but does the Firestore usage dashboard show read counts consistent with user actions, and does dev console stop at the expected listener count (Pitfall 9)?
- [ ] **Default account:** Seed script runs — but is the `users` doc `isDefault: true`, and does the app actually refuse in-app deletion (not just hide the button)?
- [ ] **Free tier:** Usage is "tiny" — but was the daily read budget (50K) sanity-checked against 4 always-on tab listeners + summary (each initial snapshot counts per doc)?
- [ ] **Composite index:** `type ASC, date DESC` — created in the console, or does the first run of the tab query fail with an index link?

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Unscoped queries failing everywhere (Pitfall 1) | LOW | Add the uid filter to all query builders; rules unchanged; redeploy JS only |
| Offline write reverted (Pitfall 2) | LOW | Catch and display rejection; the doc reverts server-side automatically; re-enter if needed |
| Legacy expo-file-system crash (Pitfall 3) | MEDIUM | Switch imports to `expo-file-system/legacy` (one-line per file) or port to `File`/`Directory` API |
| deleteUser mid-cascade dangling data (Pitfall 4) | MEDIUM | Console: delete the leftover `entries`/categories via console or Admin SDK; fix order in code |
| Exported files in cache (Pitfall 5) | LOW | Re-export with copy/share step; old files are cleaned by the OS |
| Stale SheetJS from npm (Pitfall 6) | LOW | Uninstall, install CDN tarball, re-run export test |
| UTC date mislabeling (Pitfall 7) | HIGH | Data was written with wrong `date` strings; write a one-time Admin-SDK migration (shift by +8h where local date differs); prevent by fixing `dates.js` |
| Listener leak (Pitfall 9) | LOW | Add cleanup + stable queries; restart app; verify count |
| Intl formatting mismatch (Pitfall 8) | LOW | Switch to manual formatting; pure display change, no data migration |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Unscoped queries fail under rules (1) | Phase 1 (Data Foundation) | Emulator test with 2 users; every query includes uid; check each later phase's new query |
| Offline writes vs rules / silent revert (2) | Phase 2 (Entry Logging) | Airplane-mode write → reject path test; `hasPendingWrites` indicator visible |
| expo-file-system legacy API throws (3) | Phase 1 (dependency lock) + Phase 4 (Export) | Export smoke test on device in Phase 4 |
| deleteUser reauth + cascade order (4) | Phase 5 (Accounts & Auth) | Delete account with 600 entries offline-test; console shows no dangling docs |
| printToFileAsync cache path (5) | Phase 4 (Range Export) | File visible in Downloads (Android) / share sheet (iOS); survives cache clear |
| SheetJS install + writeFile (6) | Phase 4 (Range Export) | .xlsx opens on device; `npm ls xlsx` shows 0.20.x |
| UTC date bug (7) | Phase 1 (Data Foundation) | Unit tests for `today()`/`monthRange()` at midnight-local |
| Intl/currency variance (8) | Phase 1 (Data Foundation) | Screenshot comparison on two devices (different OS versions) |
| Listener leaks (9) | Phase 2 (Entry Logging) + Phase 6 (Hardening) | Listener-count audit; read-count sanity check vs actions |
| First-run offline / Expo Go test recipe (10) | Phase 2 (Entry Logging) + Phase 6 (Hardening) | Written offline UAT checklist executed on physical phone |
| Index missing / setup | Phase 1 | First tab query runs green |
| Free-tier / one-database / no-Functions on Spark | Phase 1 (Firebase setup) | Setup doc followed; usage dashboard under 1% of quota |
| Default-account seeding & delete protection | Phase 1 (seed) + Phase 5 (Accounts) | Seed via console; app refuses delete of default |
| Money input parsing (decimal/comma) | Phase 2 (Entry Form) | Boundary tests: `1,234.50`, `₱24`, `0.05`, leading zeros |

## Sources

- Firebase Firestore "Access data offline" (enable-offline) — fetched 2026-08-06: persistence options, `persistentSingleTabManager` default, cache-size config, offline query behavior, `disableNetwork`/`enableNetwork`. https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Firebase "Securely query data" — fetched 2026-08-06: verbatim "rules are not filters" / all-or-nothing queries. https://firebase.google.com/docs/firestore/security/rules-query
- Firebase Auth "Manage Users" (Web) — fetched 2026-08-06: deleteUser requires recent sign-in; `reauthenticateWithCredential`. https://firebase.google.com/docs/auth/web/manage-users
- Firebase Firestore "Usage and limits" — fetched 2026-08-06: free tier 50K reads / 20K writes / 20K deletes / 1 GiB, daily reset ~midnight Pacific, exactly one free database per project, 500-op batch limit. https://firebase.google.com/docs/firestore/quotas
- Firebase Firestore "Understand Cloud Firestore billing" — fetched 2026-08-06: read/write/delete billing, index-entry reads (≤1 range field free), listener reconnect re-read only without persistence. https://firebase.google.com/docs/firestore/pricing
- Expo Print docs (SDK 57) — fetched 2026-08-06: `printToFileAsync` saves to cache; Expo Go inclusion; iOS base64-images note; `@page` margins. https://docs.expo.dev/versions/latest/sdk/print/
- Expo FileSystem docs (SDK 57) — fetched 2026-08-06: new `File`/`Directory`/`Paths` API; legacy API deprecated and "will throw in runtime"; SAF content:// read-only handles. https://docs.expo.dev/versions/latest/sdk/filesystem/
- SheetJS docs — fetched 2026-08-06: stale npm registry (0.18.5) vs CDN 0.20.3; React Native demo (Expo integration uses `XLSX.write` base64 + expo-file-system; SAF folder flow); Snyk false positive. https://docs.sheetjs.com/docs/getting-started/installation/frameworks + https://docs.sheetjs.com/docs/demos/mobile/reactnative
- Hermes IntlAPIs.md (facebook/hermes) — fetched 2026-08-06: platform-ICU delegation, per-OS-version variance, `formatToParts` Android-only. https://github.com/facebook/hermes/blob/static_h/doc/IntlAPIs.md
- npm registry `@firebase/firestore@4.17.0` — fetched 2026-08-06: dedicated `react-native` export (`dist/index.rn.js`) confirming JS-SDK RN support. https://registry.npmjs.org/@firebase/firestore/latest
- AsyncStorage README — fetched 2026-08-06 (platform support; Android SQLite 6MB default cap is community-documented, MEDIUM confidence).
- Community/experience-based items (stuck-pending-write edge cases, Expo Go LAN/tunnel behavior, offline test recipes) — LOW/MEDIUM confidence, flagged inline.

---
*Pitfalls research for: Money Tracking — offline-first Expo + Firestore expense/income tracker*
*Researched: 2026-08-06*
