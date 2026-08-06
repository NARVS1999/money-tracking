# Architecture Research

**Domain:** Offline-first personal expense/income tracker — React Native + Expo (Expo Go), Firebase JS SDK + Firestore, per-account private ledgers
**Researched:** 2026-08-06
**Confidence:** HIGH (claims verified against official vendor docs — firebase.google.com, docs.expo.dev, npm registry; fetch-level LOW from the research seam is a provider heuristic, not a claim verdict — see Sources)

## Standard Architecture

### System Overview

The system is a single React Native app talking to two "backends": Firebase (auth + Firestore, which is also the local store via the persistent cache) and the device filesystem (export pipeline). There is no server code, no local SQLite — Firestore's persistent cache *is* the offline store, and `onSnapshot` listeners *are* the optimistic-UI mechanism. Verified: with offline persistence enabled, the SDK "automatically manages online and offline data access and synchronizes local data when the device is back online" (official docs).

```
┌──────────────────────────────────────────────────────────────────┐
│                      UI LAYER (screens + components)              │
│  SignIn  Home  Expenses  Income  Categories  Account  Export      │
│  EntryForm (add/edit/copy)  +  EntryRow  CategoryPicker  AmountInput│
└─────────────────────────────────┬────────────────────────────────┘
                                  │ context state + action calls
┌─────────────────────────────────▼────────────────────────────────┐
│                    STATE LAYER (React Context)                    │
│  AuthProvider      — onAuthStateChanged; gates SignIn vs tabs     │
│  EntriesProvider   — onSnapshot(entries) → state; add/update/     │
│                      delete/copy actions                          │
│  CategoriesProvider— onSnapshot ×2 (expense + income) → state;    │
│                      add/delete (with in-use guard)               │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ Firebase API (listen/write)
┌─────────────────────────────────▼────────────────────────────────┐
│                   DATA LAYER (Firebase JS SDK)                    │
│  Firestore: persistentLocalCache({persistentSingleTabManager})    │
│             backed by @react-native-async-storage/async-storage   │
│  Auth: email/password                                             │
│  utils (pure): money.js (cents⇄₱)  dates.js (YYYY-MM-DD)          │
│                 export.js (PDF/XLSX builders)                     │
└───────────────┬──────────────────────────────┬───────────────────┘
                │ auto-sync on reconnect       │ generated files
┌───────────────▼──────────────┐   ┌───────────▼───────────────────┐
│  FIREBASE BACKEND            │   │  DEVICE FILESYSTEM             │
│  Auth (email/password)       │   │  cache/ ← printToFileAsync     │
│  Firestore (rules, indexes)  │   │  SAF → Downloads (Android)     │
│  console-seeded default acct │   │  shareAsync (iOS share sheet)  │
└──────────────────────────────┘   └───────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| AuthProvider | Observe auth state; expose `user`, `signIn`, `signUp` (creates `users/{uid}` doc), `signOut`, `deleteAccount` (cascade, reauth) | `onAuthStateChanged` subscription in a context provider mounted at App root; renders SignInScreen until user present |
| EntriesProvider | Single source of truth for the signed-in account's entries; live updates; CRUD + copy actions | One `onSnapshot` on `entries` (or two type-scoped listeners), state array in context, `unsubscribe` on unmount / uid change |
| CategoriesProvider | Expense + income category lists; add/delete with in-use guard | Two `onSnapshot` listeners; delete action queries `entries where categoryId == X, limit 1` first |
| Screens | Render derived data only — never own Firestore queries | Home derives Summary (month totals + per-category) by reducing the cached entries state; Export screen calls `export.js` |
| utils/money.js | Only place pesos are formatted/parsed; integer cents everywhere | `toPeso(amountCents)`, `parsePeso(string)` |
| utils/dates.js | Local calendar date helpers; `"YYYY-MM-DD"` strings; `today()`, `monthRange()`, `isFuture()` | Lexicographic compares → timezone-proof range queries |
| utils/export.js | Range query → totals + breakdown → PDF HTML / XLSX rows → save to Downloads (Android) or share (iOS) | `printToFileAsync` → cache; SAF create+write; SheetJS `write({type:'base64'})` |
| Firebase config | Initialize app + Firestore with persistent cache | `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) })` |

## Recommended Project Structure

Validated against the draft `tech-design.md`; two additions: a dedicated filesystem helper (SAF persistence) and an explicit legacy-import for `expo-file-system`.

```
money-tracking/
├── App.js                     # Auth gate + navigation shell
├── src/
│   ├── firebase/
│   │   ├── config.js          # Firebase init (persistent cache)
│   │   └── rules/             # security rules source (deployable)
│   ├── auth/
│   │   ├── AuthProvider.js    # sign-in state, signIn/signUp/signOut,
│   │   │                      #   deleteAccount (chunked cascade), reauth
│   │   └── deleteAccount.js   # cascade routine (queries + chunked batches)
│   ├── context/
│   │   ├── EntriesProvider.js
│   │   └── CategoriesProvider.js
│   ├── screens/               # SignIn, Home, Expenses, Income, Categories,
│   │                          #   Account, EntryForm, Export
│   ├── components/            # EntryRow, CategoryPicker, AmountInput
│   ├── utils/
│   │   ├── money.js           # cents ⇄ "₱ 1,234.50"
│   │   ├── dates.js           # "YYYY-MM-DD" helpers, month range
│   │   ├── export.js          # PDF + Excel builders, aggregation
│   │   └── files.js           # SAF wrapper: request Downloads dir once,
│   │                          #   persist directoryUri (AsyncStorage),
│   │                          #   createFile + writeAsStringAsync
│   └── theme.js
```

### Structure Rationale

- **providers own subscriptions, screens own rendering:** the reactive-core pattern; screens never call Firestore directly, so offline/cache behavior stays in one place per data type.
- **`utils/` is pure and platform-agnostic:** `export.js` builds HTML/rows; `files.js` owns all device-filesystem interaction (the only place `Platform.OS` branches).
- **`auth/deleteAccount.js` separated from the provider:** the cascade is the most failure-prone routine (chunking, reauth, ordering); isolating it makes it testable without mounting React.
- **`expo-file-system/legacy` import required:** SDK 52+ reworked the API; `StorageAccessFramework` lives only in the legacy module (`import * as FileSystem from 'expo-file-system/legacy'`), confirmed on docs.expo.dev for SDK 57.

## Architectural Patterns

### Pattern 1: Firestore-as-local-store (offline-first with zero sync code)

**What:** Enable `persistentLocalCache` at startup; every read goes through listeners; writes are `setDoc`/`addDoc`/`deleteDoc` with no manual sync layer.
**When to use:** Always in this project — it is the core value (entries must be there offline; log in <10s).
**Trade-offs:** Offline behavior is SDK-managed (good) but implicit (bad — need `snapshot.metadata.fromCache` to know data provenance). Cache grows to a 100 MB default threshold with LRU cleanup of older unused docs; configurable via `cacheSizeBytes` (min 1 MB) or `CACHE_SIZE_UNLIMITED`. At this scale (a handful of accounts, ~10 writes/day) eviction is a non-issue.

**Example:**
```js
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});
```

### Pattern 2: Provider + onSnapshot subscription lifecycle

**What:** One listener per provider, registered when a user is present, torn down on sign-out or uid change. Listeners fire immediately with cached data, then again when the server catches up (verified behavior: "the query snapshot will be initially populated with the cached data, then updated with the server's data when the client has caught up"); while offline they fire on local cache changes.
**When to use:** Every data provider.
**Trade-offs:** Requires discipline: forgetting `unsubscribe()` leaks bandwidth and — critically — a listener from a previous account keeps pushing another account's data after sign-out/sign-in. The uid-scoped `where` clauses make cross-account reads *fail closed* via rules, but the provider must still re-subscribe per uid.

**Example:**
```js
useEffect(() => {
  if (!user) return;
  const q = query(collection(db, "entries"), where("uid", "==", user.uid), orderBy("date", "desc"));
  const unsub = onSnapshot(q, (snap) => {
    setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    // snap.metadata.fromCache === true → offline/cached view
  });
  return unsub; // MUST detach on unmount AND when user changes
}, [user?.uid]);
```

### Pattern 3: uid-scoped rules + immutable-field enforcement

**What:** Rules key every collection on `request.auth.uid`, matching the `uid` field stored in each document; updates compare `request.resource.data` (future state) against `resource.data` (current state) to make fields immutable.
**When to use:** Whole database; verified canonical patterns from official docs (the `isDefault` immutability rule in `backend-schema.md` is exactly the documented `request.resource.data.name == resource.data.name` pattern).
**Trade-offs:** Rules cannot call Firestore transactions; cross-doc `get()`/`exists()` in rules are billed reads (limit 10 per single op, 20 per batch/transaction). Console/admin writes bypass rules (IAM), which is what makes console-seeding the default account legal — no code path in the app can create a default.

### Pattern 4: Chunked batched writes for the cascade delete

**What:** Account deletion is a multi-collection cascade (entries → categories → `users` doc → auth account). Use `writeBatch` (atomic; executes even offline — writes queue in the local cache and sync later), **never** `runTransaction` (transactions fail when the client is offline). Batch ceiling: official docs — "deleting a collection of more than 500 documents requires multiple batched write operations" — so the cascade must loop: query a page of docs → batch-delete ≤500 → repeat until empty.
**When to use:** `deleteAccount` only. (At 10 entries/day an account exceeds 500 docs after ~2 months, so chunking is not theoretical.)
**Trade-offs:** The cascade is *not* atomic across batches — a crash mid-cascade leaves partial data. Acceptable here: deletion is idempotent (re-run deletes the rest), and rules allow own-data delete, so a retried delete converges. Order matters: data first, `users` doc second, auth account last (after data is gone, the app no longer needs the session).

**Example (shape):**
```js
const batch = writeBatch(db);
let count = 0;
const pushDelete = (ref) => {           // chunk ≤500 per commit
  batch.delete(ref);
  if (++count === 500) { batch.commit(); }
};
// page through entries: query(entries, where("uid","==",uid)) → delete all → next page
```

### Pattern 5: Generate-to-cache → SAF/share pipeline (exports)

**What:** `printToFileAsync({ html })` renders a PDF **into the app's cache directory** (verified on docs.expo.dev) — it does not write to Downloads. Second step: Android — `StorageAccessFramework.requestDirectoryPermissionsAsync()` (Android 11+, works in Expo Go) lets the user pick the Downloads folder once; persist the returned `directoryUri`; then `createFileAsync(dirUri, name, mimeType)` (name **without** extension) and `writeAsStringAsync(safUri, contents, { encoding: 'base64' })` (SAF URIs cannot be `moveAsync`'d — destination must be `file://`). iOS — no Downloads equivalent: `Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' })`.
**When to use:** Both export formats. XLSX (SheetJS) follows the same path: `XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })` → write base64 string to the SAF URI. Note `XLSX.writeFile` is Node-flavored and does not integrate with RN's filesystem — use `write` + FileSystem.
**Trade-offs:** SAF adds a one-time user prompt per folder; persist the granted URI in AsyncStorage and fall back to the picker only when it's missing or the write fails. The file must be fully buffered in memory (base64) — fine for personal-scale ledgers.

## Data Flow

### Request Flow — log an entry (the 10-second core)

```
User taps Save (EntryForm)
    ↓
EntriesProvider.addEntry({ type, amountCents, categoryId, date, description })
    ↓  addDoc(collection(db, "entries"), { ...fields, uid: user.uid, createdAt: serverTimestamp() })
Firestore client → writes to LOCAL CACHE immediately (returns instantly, offline-safe)
    ↓ auto-sync when online (queued while offline)
Cloud Firestore backend → rules check (uid match) → committed
    ↓
onSnapshot fires → provider state updates → list/Home re-render (single echo, no manual refresh)
```

### State Management

```
Firestore (server + persistent local cache)
    ↓ onSnapshot (cache-first, then server catch-up)
Providers (Context state) ──actions(add/update/delete/copy)──→ Firestore
    ↓ derived
Screens (pure render)  ←── useSummary(entries, monthRange) for Home
```

### Key Data Flows

1. **Auth gate:** `AuthProvider` subscribes to `onAuthStateChanged` → app renders SignInScreen until a user exists, then mounts the tab navigator **and only then mounts Entries/Categories providers** (they require `user.uid`). Sign-out unmounts providers (which unsubscribes listeners). New-account creation signs into the new account immediately → providers re-subscribe with the new uid (fresh empty ledger).
2. **Entry lifecycle:** form → provider action → Firestore write → local cache instant + eventual sync → listener echo. Edit = `updateDoc` (same doc id); delete = `deleteDoc`; copy = `addDoc` with a fresh id and today's date (date reset lives in `dates.js`).
3. **Summary (Home):** derived client-side — `monthRange()` yields `["2026-08-01","2026-08-31"]`; reduce the already-cached entries state for the month: total spent (expense), total earned (income), per-category breakdown. No aggregation query, no server work, works offline.
4. **Category in-use guard:** `deleteCategory` runs `getDocs(query(entries, where("categoryId","==",id), limit(1)))` — non-empty → user-visible refusal; empty → delete. Verified against schema; needs the automatic single-field index on `categoryId`.
5. **Export:** ExportScreen → `export.js` runs one range query (`date >= start && date <= end` — automatic single-field index) → group by category, compute totals → build HTML (PDF) or worksheet rows (XLSX) → `files.js`: printToFileAsync to cache (PDF) / SheetJS base64 (XLSX) → SAF create+write to Downloads (Android) or share sheet (iOS).
6. **Account deletion cascade:** reauth with password (`reauthenticateWithCredential` — required for `deleteUser`) → loop: page all own entries, batch-delete in ≤500 chunks → same for both category collections → delete own `users` doc → `deleteUser()` → sign-out state → SignIn. Default account: blocked in UI before step 1 (rule-level protection is impossible — console admins bypass rules; this is a documented, accepted app-level guard).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users (this project: a handful of accounts) | Nothing changes. Free tier (50K reads / 20K writes daily) is 3+ orders of magnitude above usage. Persistent cache at default 100 MB is far beyond years of entries. |
| 1k–100k users | Export queries and cascade deletes become the first real bottleneck: switch export to a server-side generation path (Cloud Function) instead of device-side buffering; cascade could move server-side (callable function with `recursiveDelete`-style logic, verified documented pattern). |
| 100k+ users | Per-account hot spots and listener fan-out: real-time listener count per user is already 3 (entries + 2 categories); keep it there. Consider paginating lists (the current no-limit tab queries are fine only at this scale). |

### Scaling Priorities

1. **First bottleneck:** the cascade delete and export buffering (both are unbounded over document count). Mitigation at this scale: chunked batches (already required) and page-through queries with `limit`.
2. **Second bottleneck:** bundle size / startup with the full Firebase JS SDK — a non-issue for a personal app; if it ever mattered, modular imports already tree-shake.

## Anti-Patterns

### Anti-Pattern 1: Using `runTransaction` for the cascade delete
**What people do:** Wrap multi-collection deletes in a transaction "for atomicity".
**Why it's wrong:** Transactions **fail when the client is offline** (verified) — exactly when a user on a phone is most likely to delete an account; also capped at 500 operations and 10 MiB per commit.
**Do this instead:** `writeBatch` chunks (executes offline, queued and synced), idempotent cascade that converges on retry.

### Anti-Pattern 2: One big batch of all entries at account deletion
**What people do:** `batch.delete(ref)` for every entry in one commit.
**Why it's wrong:** Fails above 500 operations per batch (verified: "deleting a collection of more than 500 documents requires multiple batched write operations"); ~10 writes/day means >500 docs after two months.
**Do this instead:** Chunked loop — page with `limit(500)`, batch-delete, repeat until the query returns empty.

### Anti-Pattern 3: Forgetting to detach listeners (or listening per-screen)
**What people do:** Each screen calls `onSnapshot` itself; listeners survive sign-out/uid switches.
**Why it's wrong:** Stale listeners keep billing reads, leak state, and can momentarily surface the previous account's cached data after sign-out (cache is per-device, not per-account).
**Do this instead:** One listener per provider, subscribed only when `user` exists, `unsubscribe()` in effect cleanup keyed on `user?.uid`.

### Anti-Pattern 4: `moveAsync` to move the generated PDF into Downloads
**What people do:** Try `FileSystem.moveAsync({ from: cacheUri, to: downloads })` after `printToFileAsync`.
**Why it's wrong:** SAF `content://` URIs are not valid `moveAsync` destinations (destination must be `file://`); on Android a plain `file://` path outside app storage isn't writable anyway (scoped storage).
**Do this instead:** `createFileAsync` in the granted directory + `writeAsStringAsync` with the file's base64 content.

### Anti-Pattern 5: Installing `xlsx` from the npm registry
**What people do:** `npm install xlsx` (resolves to 0.18.5 — the registry version has been frozen since 2022 and carries CVE-2023-30533; verified via registry API today).
**Why it's wrong:** Stale, unpatched distribution channel.
**Do this instead:** Install from the official SheetJS CDN (`https://cdn.sheetjs.com/xlsx-0.20.x/...` per docs.sheetjs.com). For a self-generated workbook with no untrusted input the risk is low either way, but pin the maintained build.

### Anti-Pattern 6: Formatting money anywhere except `money.js`
**What people do:** `(amountCents / 100).toFixed(2)` in screens or export HTML.
**Why it's wrong:** Float drift in sums, inconsistent separators, mixed concerns (already ADR-0003).
**Do this instead:** Sum integer cents; format once via `toPeso()`; `parsePeso()` is the only input parser (and the only place comma handling exists).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Firebase Auth (email/password) | JS SDK `signInWithEmailAndPassword` / `createUserWithEmailAndPassword` / `deleteUser`; `onAuthStateChanged` | Recent-sign-in required for `deleteUser` → reauth first. Sessions persist across restarts automatically. |
| Cloud Firestore | JS SDK, persistent cache, `onSnapshot`, `writeBatch` | Rules bypassed by console/admin writes — seeding the default account via console is legal and intended. |
| expo-print | `Print.printToFileAsync({ html, margins })` → cache URI | iOS: no local asset URLs in HTML (irrelevant for text tables). Android page margins via `@page` CSS. |
| SheetJS (`xlsx`) | `XLSX.write(wb, { type: 'base64' })` → FileSystem write | Install from cdn.sheetjs.com (not npm). |
| expo-file-system (legacy) | `StorageAccessFramework` namespace (Android, Expo Go compatible) | `requestDirectoryPermissionsAsync` needs Android 11+; persist `directoryUri`. |
| expo-sharing | `shareAsync(uri, { UTI, mimeType })` | iOS-only path in this design; Android could offer it as fallback. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| AuthProvider ↔ Entries/Categories providers | Mount gating (children rendered only when `user` exists) + `user.uid` prop through context | Prevents any listener from running without a uid |
| Providers ↔ Screens | Context read + action calls | Screens never touch Firestore directly |
| Screens/export.js ↔ files.js | Function calls (`savePdf(html, name)`, `saveXlsx(base64, name)`) | Only files.js branches on `Platform.OS` |
| export.js ↔ utils/money.js, dates.js | Pure function calls | All aggregation is integer-cents math |

## Gaps Found in the Draft (tech-design.md / backend-schema.md)

These are **missing components the roadmap must add** — the draft architecture is sound, but four concrete details are absent:

1. **Cascade chunking** — `tech-design.md` says "batch-delete own entries"; without a ≤500-chunk loop this fails once an account passes ~500 entries. Must be a paginated loop.
2. **SAF directory persistence** — the design implies a Downloads write but never states that the user must grant the folder once, or that the `directoryUri` must be stored (AsyncStorage) and reused. Also: `createFileAsync` takes the name **without** extension; `moveAsync` cannot be used.
3. **XLSX binary write path** — `writeFile` (as written in the draft) is not the RN path; it must be `XLSX.write(..., { type: 'base64' })` + `writeAsStringAsync(..., { encoding: base64 })`, and the package must come from cdn.sheetjs.com, not npm.
4. **Listener re-subscription on uid change** — providers must subscribe per `user.uid` and detach on sign-out; otherwise account switches leak listeners and can flash the previous account's cached data.

## Suggested Build Order (dependency-ordered)

The dependency graph is a chain: **auth gates everything → categories feed entry forms → entries feed summary and exports → account lifecycle wraps it all**. Each component below is buildable and testable once its listed dependencies exist.

| Step | Component | Depends on | Why this position |
|------|-----------|-----------|-------------------|
| 1 | **Firebase bootstrap + auth gate** — console setup (project, email/password, Firestore, rules deploy, composite index `type ASC, date DESC`, seed default account), `config.js` with persistent cache, AuthProvider + SignInScreen | — (external setup only) | Every other component is uid-scoped; nothing works without auth state and deployed rules. Seed the default account here so account-deletion tests have a protected target. |
| 2 | **Categories CRUD** — CategoriesProvider + Categories screen + in-use delete guard | Auth gate, rules, `categoryId` single-field index (automatic) | Simplest domain; validates the provider+listener pattern; required before the entry form's dropdowns exist. |
| 3 | **Entries CRUD + lists + Entry form (add/edit/delete/copy)** | Auth gate, Categories (dropdown source), composite index | The core value (10-second logging). Deliberately last of the data components — the entry form is untestable without categories. |
| 4 | **Home Summary** | Entries + Categories providers | Purely derived from already-built state (month reduce); zero new data plumbing — fastest win after step 3. |
| 5 | **Export (PDF + XLSX)** — `export.js` + `files.js` (SAF grant + persistence), Export screen | Entries + Categories; SheetJS installed from cdn.sheetjs.com | Needs real data volume to be meaningful; also the phase with the most platform risk (SAF, base64 writes) — doing it after the data layer is proven isolates that risk. |
| 6 | **Account lifecycle** — create account (sign-up + `users` doc + immediate sign-in), delete account (reauth + chunked cascade + `deleteUser`), default-account UI guard | Auth gate, all four collections, chunked-batch pattern | The cascade touches every collection and the auth account — only sensible once all data components exist; the 500-doc chunking loop is the only genuinely novel routine left. |

**Phase-ordering rationale:** auth (1) is the hard dependency of everything; categories (2) before entries (3) because the form's dropdown is not constructible without them; summary (4) before export (5) because it is free derivation versus new platform plumbing; account deletion (6) last because it is a cross-cutting teardown that must delete exactly what 2–5 create. The chunked-batch delete routine should be **prototyped in step 6** — do not add it early (YAGNI) and do not omit it (500-doc ceiling is real after ~2 months at 10 entries/day).

**Research flags for phases:**
- Phase 1: low risk — standard Firebase console work; verify rule deployment via the rules emulator if available.
- Phase 5: HIGH risk — SAF + base64 file writes are the least "textbook" code in the app; needs device testing on both platforms (QR-code workflow) and the SheetJS CDN install decision.
- Phase 6: MEDIUM risk — the cascade has a real concurrency/partial-failure surface; keep it idempotent.

## Sources

| Claim area | Source (URL) | Fetch confidence |
|------------|--------------|------------------|
| Offline persistence mechanics, cache size (100 MB default), `fromCache`, offline queries, `disableNetwork` | firebase.google.com/docs/firestore/manage-data/enable-offline | HIGH (official; seam: LOW) |
| Listener behavior: cache-first snapshot then server catch-up; `added` initial events; detach | firebase.google.com/docs/firestore/query-data/listen | HIGH (official; seam: LOW) |
| Rules: `request.auth.uid` scoping, `resource.data` vs `request.resource.data` immutability, access-call limits, rules bypass for server writes | firebase.google.com/docs/firestore/security/rules-conditions | HIGH (official; seam: LOW) |
| Transactions fail offline; batched writes execute offline; atomicity; batch size caution | firebase.google.com/docs/firestore/manage-data/transactions | HIGH (official; seam: LOW) |
| ">500 documents requires multiple batched write operations"; 10 MiB request cap; 270 s transaction limit | firebase.google.com/docs/firestore/solutions/delete-collections; firebase.google.com/docs/firestore/quotas | HIGH (official; seam: LOW) |
| `printToFileAsync` → cache directory; `@page` margins; iOS asset restriction; shareAsync pattern | docs.expo.dev/versions/latest/sdk/print | HIGH (official; seam: LOW) |
| Legacy FileSystem: SAF namespace, `requestDirectoryPermissionsAsync` (Android 11+), `createFileAsync` (no extension), `writeAsStringAsync` SAF support, `moveAsync` destination `file://` only | docs.expo.dev/versions/latest/sdk/filesystem-legacy | HIGH (official; seam: LOW) |
| `xlsx` npm latest = 0.18.5 (frozen); CDN distribution guidance; CVE-2023-30533 | registry.npmjs.org/xlsx (verified live); docs.sheetjs.com | MEDIUM (registry verified; CVE from training) |
| 500 operations/batch ceiling (canonical figure; docs confirm via delete-collections wording) | firebase.google.com/docs/firestore (multiple pages) | HIGH (cross-checked) |

*Note on confidence:* the `classify-confidence` seam rates `webfetch` provider fetches LOW by default; claims above were verified directly against official vendor documentation (top tier of the source hierarchy) and cross-checked across ≥2 pages where load-bearing (batch limits, rules patterns). Treat claims as HIGH unless marked otherwise.

---
*Architecture research for: money-tracking (offline-first expense tracker)*
*Researched: 2026-08-06*
