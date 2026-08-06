<!-- GSD:project-start source:PROJECT.md -->

## Project

**Money Tracking**

A personal expense and income tracker on the phone. Entries are logged manually (under 10 seconds), stored in Firebase Firestore with offline-first persistence, and exported as date-range PDF/Excel summaries. Each account (email + password) owns a private ledger with its own categories; a seeded **default account** can never be deleted in-app.

**Core Value:** Logging a money entry must take under 10 seconds — from opening the app to saving — and the data must be there when the phone is offline.

### Constraints

- **Tech stack**: Expo Go workflow only — every library must run in Expo Go (no custom native modules)
- **Tech stack**: Firebase JS SDK (not native modules); Firestore the only database
- **Firebase**: Free Spark plan only
- **Auth**: Email/password only; default account seeded via Firebase console, never in-app
- **Currency**: PHP only, integer-cents storage, never floats
- **Compatibility**: Android + iOS; QR-code tested on the user's phone

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Expo SDK | **57** (`expo@^57.0.11`) | App framework; Expo Go QR testing | Current SDK (released 2026-06-30), RN 0.86 + React 19.2; Expo Go store builds now ship SDK 57 (expo.dev/go). SDK 54 support ends with the next SDK (Sep/Oct 2026) — starting on 57 avoids a forced upgrade mid-project. Expo Go remains acceptable for this personal app (Expo warns it's not for production apps, but that's not this project's situation). |
| React Native | 0.86.x (via SDK 57) | UI runtime | Pinned by Expo SDK 57; do not install separately. |
| Navigation | `@react-navigation/native@7` + `bottom-tabs@7.18.x` + `native-stack@7.18.x` | 4 tabs + full-screen forms | v7 is current (bottom-tabs 7.18.15, native-stack 7.18.7 on npm, Aug 2026); pure JS; its native deps (`react-native-screens ~4.26.0`, `safe-area-context ~5.7.0`) are bundled in Expo Go. v6 is two majors behind — no reason to use it. |
| Database | `firebase@^12.17.1` (JS SDK, modular API) | Firestore + Email/Password auth | **Expo officially requires firebase >= 12.0.0** (older versions fail with ES module resolution errors in Metro). v12.17.1 is current (npm, Aug 2026). JS SDK is the *only* Firebase option that runs in Expo Go — `@react-native-firebase/*` needs a development build. |
| Auth persistence | `@react-native-async-storage/async-storage@2.2.0` | AsyncStorage backing for auth session + Firebase auth persistence | **Must be 2.2.0, not npm latest.** Expo Go SDK 57 bundles native AsyncStorage 2.2.0 (`bundledNativeModules.json`); installing 3.x breaks in Expo Go (native module version mismatch). AsyncStorage's role here is **auth token persistence** via `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` — required for "sessions persist across restarts". |
| PDF | `expo-print@~57.0.1` | HTML → PDF (`printToFileAsync`) | Confirmed current in SDK 57 and included in Expo Go. Returns `{ uri, numberOfPages }` written to cache. No viable alternative for Expo Go (native PDF libs require dev builds). |
| Excel | `xlsx` **0.20.3 from SheetJS CDN** | Generate .xlsx in pure JS | npm's `xlsx` is frozen at 0.18.5 (no functional releases since 2023); SheetJS LLC distributes the current 0.20.3 from `cdn.sheetjs.com` (tested 2026-01-12, docs updated Aug 2026). Official install: `npm i -S https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Pure JS, runs in Expo Go. |
| File output | `expo-file-system@~57.0.2` + `expo-sharing@~57.0.10` | Write cache files; SAF copy to Downloads (Android); share sheet (iOS fallback) | Both in Expo Go. SDK 57 ships a **new** `File`/`Directory`/`Paths` API; the legacy API (incl. `StorageAccessFramework`) moved to `expo-file-system/legacy` — importing legacy methods from the main module **throws at runtime**. SAF (`requestDirectoryPermissionsAsync` → `createFileAsync` → `writeAsStringAsync`) is still the documented way to write to public Downloads in Expo Go. |
| State | React Context + hooks (2 contexts) | Auth session; entries + categories | Sufficient at this scale: 5 screens, two state domains, low-frequency user-driven updates. Matches official React guidance (Context for low-frequency state; reducer+context for shared write logic). No library needed — see Alternatives. |
| Date picker | `@react-native-community/datetimepicker@9.1.0` | System date UI for entry form | Bundled in Expo Go (expo docs `inExpoGo: true`); `maximumDate={new Date()}` blocks future dates (FR-5). Native picker = free UX. |
| Keyboard handling | `react-native-keyboard-controller@1.21.9` | KeyboardAwareScrollView for the entry form | **New in Expo Go SDK 57** (bundled, `inExpoGo: true`, expo docs page). Consistent iOS/Android keyboard behavior; replaces the unmaintained `react-native-keyboard-aware-scroll-view`. Core `KeyboardAvoidingView` remains the zero-dependency fallback. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-constants` | ~57.x | `expoConfig`/project metadata if needed | Only if the app needs config values at runtime (likely not for this app). |
| `@expo/vector-icons` | bundled w/ Expo | Icons | Only if icons are added; the design brief is text-only — skip unless needed. |
| `zustand` | 5.0.14 | Lightweight global store | **Only if** state grows beyond 2 contexts (e.g. export screen state, form drafts across tabs). Not needed for MVP. |
| `expo-sqlite` | ~57.0.1 | Durable local store | **Only if** the team decides durable offline (surviving app restarts) is required — see Critical Finding below. It is bundled in Expo Go. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npx expo start` | Dev server + QR | Expo Go on the phone connects to the Metro dev server. |
| `npx expo install <pkg>` | Install Expo-Go-compatible versions | **Mandatory rule for every native-adjacent package** (async-storage, datetimepicker, keyboard-controller, expo-*). Plain `npm install` can select versions whose native modules don't match Expo Go's bundled build. |
| `npx expo-doctor` | Version compatibility check | Run after installs; catches SDK/pin mismatches. |
| `expo start --tunnel` | QR testing across networks | Needed if the phone isn't on the same LAN as the dev machine. |
| Firebase console + rules | Firestore schema/rules, seed default account | One-time manual setup per tech-design.md (unchanged). |

## Installation

# Scaffold (Expo SDK 57)

# Core

# Excel — NOT from npm; SheetJS CDN tarball (npm's xlsx is stale at 0.18.5)

# TypeScript (recommended for this codebase; create-expo-app default template)

# dev deps come with the default template

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Firebase JS SDK (`firebase@12`) | `@react-native-firebase/*` (native) | When Expo Go is dropped for development builds. Gives **real durable offline** (SQLite-backed), Crashlytics, Analytics. This is the only way to get durable Firestore offline persistence. |
| Expo Go workflow | Development builds (`expo-dev-client` + EAS) | When native modules or durable offline become requirements; when the app ships to stores. Expo's own guidance: Expo Go is a sandbox, not a production environment. |
| `persistentLocalCache()` | Local-first: `expo-sqlite` mirror + Firestore sync | When "works fully offline" must survive app restarts (the project's stated NFR) — the JS SDK cannot do this in Expo Go (see Critical Finding). |
| React Context | Zustand 5.x | If context count grows (3+), or if fine-grained re-render control matters. Cheap to adopt later — both can coexist. |
| `@react-native-community/datetimepicker` | `@expo/ui` datetimepicker (SwiftUI/Compose) | New in SDK 57; consider for a more native feel on a future phase. Community picker is the battle-tested standard. |
| `KeyboardAwareScrollView` (keyboard-controller) | Core `KeyboardAvoidingView` | Zero-dependency fallback for the single entry form; acceptable if the team wants to avoid the extra dep — but keyboard-controller is already in Expo Go, so there's no cost. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@react-native-firebase/*` | Requires custom native code → development builds; **cannot run in Expo Go** (explicitly stated in Expo's Firebase guide). | Firebase JS SDK `firebase@12` |
| `firebase` < 12.0.0 | ES module resolution errors with current Expo/Metro (Expo docs: "Expo SDK only supports firebase@12.0.0 and above"). Draft tech-design says "v10/11" — **outdated**. | `firebase@^12.17.1` |
| `persistentLocalCache()` + AsyncStorage in Expo Go (draft tech-design's offline plan) | **Does not work.** Firestore's durable cache is IndexedDB-only; React Native has no IndexedDB, so the SDK throws `unimplemented` and silently falls back to an in-memory cache. AsyncStorage is used by *Auth* persistence, not Firestore. See Critical Finding. | Memory cache (session-scoped offline) for MVP, or expo-sqlite local-first sync layer for durable offline |
| `expo-firestore-offline-persistence` (community IndexedDB shim) | Unmaintained (author's README: "no longer maintained"); built for the old v8/v9 API (`enablePersistence`), risky with firebase 12. | None — do not attempt IndexedDB shimming in Hermes |
| `@react-native-async-storage/async-storage@3.x` (npm latest) | Expo Go SDK 57 bundles native 2.2.0 — version mismatch crashes/warns at runtime. | `npx expo install` → 2.2.0 |
| `xlsx` from npm registry | Frozen at 0.18.5 since 2023; SheetJS's newer 0.20.x fixes bugs and is the supported line. | CDN tarball `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` |
| Legacy `expo-file-system` methods from the main module (`writeAsStringAsync`, `StorageAccessFramework`, …) | Deprecated in SDK 57; **throw at runtime** when imported from `expo-file-system`. | New `File`/`Directory`/`Paths` API for cache/doc writes; `expo-file-system/legacy` import for SAF Downloads writes |
| `react-native-keyboard-aware-scroll-view` | Unmaintained; inconsistent with modern RN. | `react-native-keyboard-controller` (bundled in Expo Go) or core `KeyboardAvoidingView` |
| Redux / Redux Toolkit | Massive overkill for 2 contexts and ~10 writes/day. | React Context now; Zustand if it grows |
| SQLite for MVP (ADR-0001 stays) | Adds a sync engine (tombstones, conflict policy) — real complexity the project explicitly deferred. | Revisit only if durable offline is confirmed as a hard requirement |

## Critical Finding — Firestore offline persistence does NOT work in Expo Go

- **Per-session offline works**: entries loaded earlier in the session stay readable; writes queue and sync when the network returns (latency compensation).
- **Durable offline does not work**: after the app is killed, the cache is gone; **queued offline writes are lost** if the app is killed before sync.
- The stated Core Value ("data must be there when the phone is offline") and NFR ("fully usable with no network") are only met *within a session*.
- **MVP (Phase 1–2):** Ship with the JS SDK + memory cache. The real-world pattern is: user opens the app online (syncs), uses it through the day (session offline OK), and the phone has periodic connectivity. Cost: zero code. Flag the limitation honestly in the app (e.g., a subtle "offline — changes sync when online" indicator).
- **Durable offline (later phase, only if the owner confirms it matters):** add a local-first layer — `expo-sqlite` (bundled in Expo Go) as the write-through cache with last-write-wins sync to Firestore. This is the only Expo Go-compatible way to get restart-safe offline. ~1 phase of extra work (tombstones for deletes, sync queue, conflict policy).
- **Do NOT** switch to dev builds just for this: the project constraint (Expo Go QR testing) is a deliberate workflow choice.

## Stack Patterns by Variant

- Use `firebase@12` JS SDK with the **default memory cache** — do NOT pass `persistentLocalCache()` (it fails and falls back anyway, but the error noise misleads).
- Configure auth explicitly: `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` — this is what makes sessions survive restarts (AsyncStorage 2.2.0).
- Keep the `onSnapshot` listener architecture from tech-design.md — live updates and optimistic UI work unchanged.
- Use `expo-sqlite` as the local source of truth + a sync service (push/pull deltas, tombstones, last-write-wins per entry).
- Keep Firestore as the sync backend with the same rules; entries/categories model unchanged.
- Add a phase for this — it is the single biggest architectural risk in the project.
- Migrate to `@react-native-firebase/firestore` (development builds via EAS) — durable SQLite offline out of the box, then delete the sync layer. Keep the rest of the stack identical.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| expo 57.0.x | react-native 0.86.x, react 19.2.x | SDK-pinned; use `npx expo install --fix` |
| expo 57.0.x | Expo Go store build | Store Expo Go now supports SDK 57 (expo.dev/go) |
| @react-native-async-storage/async-storage | **2.2.0** (Expo Go SDK 57 pin) | npm latest 3.1.1 is NOT Expo Go compatible |
| @react-native-community/datetimepicker | 9.1.0 (pin) | matches npm latest |
| react-native-keyboard-controller | 1.21.9 (pin) | npm latest 1.22.3 — install via `npx expo install` to get 1.21.9 |
| react-native-screens | ~4.26.0 (pin) | required by react-navigation v7 native-stack |
| react-native-safe-area-context | ~5.7.0 (pin) | required by react-navigation v7 |
| @react-navigation/bottom-tabs / native-stack | 7.18.x (any 7.x) | pure JS — no Expo pin needed |
| firebase | ^12.17.1 | Expo requires ≥12.0.0; no Expo pin (pure JS) |
| xlsx (SheetJS CDN) | 0.20.3 | standalone; no native deps |
| expo-print / expo-file-system / expo-sharing | ~57.0.x each | must match SDK 57 |

## Sources

- Expo SDK 57 changelog (expo.dev/changelog/sdk-57, 2026-06-30) — SDK 57, RN 0.86, React 19.2, Expo Go approval status — MEDIUM (official, high trust)
- expo.dev/go — Expo Go store SDK version = 57 — HIGH
- Expo docs: `expo-file-system` (new File API), `expo-file-system/legacy` (StorageAccessFramework, SAF URI), `expo-print` (printToFileAsync), `expo-sharing`, `@react-native-community/datetimepicker` (inExpoGo), `react-native-keyboard-controller` (inExpoGo), `@react-native-async-storage/async-storage` (inExpoGo) — all v57.0.0 reference — HIGH
- Expo `bundledNativeModules.json` (sdk-57 branch) — authoritative Expo Go version pins — HIGH
- Expo guide "Using Firebase" (updated 2026-07-17) — firebase≥12 requirement; JS SDK vs RN Firebase for Expo Go — HIGH
- expo.fyi/firebase-js-auth-setup — `initializeAuth` + `getReactNativePersistence(AsyncStorage)` — HIGH
- firebase.google.com/support/guides/environments_js-sdk (updated 2026-08-05) — React Native: Firestore "(except persistence)" — HIGH
- firebase-js-sdk GitHub source (main): `cache_config.ts` / `database.ts` (IndexedDB-only persistence), `index.rn.ts` (no RN persistence) — HIGH
- GitHub issue firebase/firebase-js-sdk#7947 (open, last comment 2025-07) — `unimplemented` IndexedDB error in Expo; community shim nandorojo/expo-firestore-offline-persistence (unmaintained) — HIGH
- docs.sheetjs.com (updated 2026-08-03) — CDN 0.20.3 install, RN demo with expo-file-system + SAF — HIGH
- npm registry API (2026-08-06) — versions: expo 57.0.11, firebase 12.17.1, bottom-tabs 7.18.15, native-stack 7.18.7, datetimepicker 9.1.0, async-storage 3.1.1, keyboard-controller 1.22.3, xlsx 0.18.5, zustand 5.0.14 — HIGH

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
