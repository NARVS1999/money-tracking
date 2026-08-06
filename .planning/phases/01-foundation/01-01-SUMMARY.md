---
phase: 01-foundation
plan: 01-01
subsystem: infra
tags: [expo, react-native, firebase, auth-persistence, async-storage, jest-expo, typescript]

# Dependency graph
requires: []
provides:
  - Expo SDK 57 scaffold (blank-typescript) at repo root with Firebase JS SDK ^12 wired as module-load singletons
  - Auth persistence via initializeAuth + AsyncStorage 2.2.0 (AUTH-02); memory-cache Firestore (no persistentLocalCache)
  - Design tokens (src/theme/tokens.ts) per UI-SPEC Implementation Contract
  - jest-expo Wave 0 test infrastructure + working smoke test
  - Auth-gate skeleton in App.tsx (initializing / signed-out / signed-in states)
affects: [01-02, 01-03, phases 2-6]

# Tech tracking
tech-stack:
  added: [expo ~57.0.11, firebase ^12.17.1, @react-native-async-storage/async-storage 2.2.0, react-navigation v7 set, jest-expo ~57.0.3, babel-preset-expo, eslint-config-expo]
  patterns: [module-load singleton init (app/auth/db), initializeAuth before any getAuth call, CJS moduleNameMapper for @firebase in jest on Windows]

key-files:
  created: [src/firebase/app.ts, src/firebase/config.ts, src/theme/tokens.ts, src/__tests__/smoke-test.ts, jest.config.js, babel.config.js]
  modified: [package.json, app.json, tsconfig.json, App.tsx, .gitignore]

key-decisions:
  - "Firebase config deferred with PLACEHOLDER strings per user checkpoint decision (option-b) — code is placeholder-safe"
  - "@firebase/* imports resolved via @firebase/auth RN build (firebase 12.17.1 umbrella dropped the react-native condition)"
  - "jest on Windows: moduleNameMapper redirects @firebase packages to CJS builds + jest-expo preset (transformIgnorePatterns alone proved unreliable)"
  - "babel.config.js added — blank-typescript template did not ship one; required for babel-jest ESM transforms"

patterns-established:
  - "Firebase init order is load-bearing: initializeApp → initializeAuth (AsyncStorage persistence) → initializeFirestore (memory cache)"
  - "Placeholder-safe config: all non-config modules build/test against PLACEHOLDER strings"

requirements-completed: [AUTH-02, NFR-05]

coverage:
  - id: D1
    description: "Expo SDK 57 app scaffolded at repo root (blank-typescript) with pinned versions matching STACK.md"
    requirement: NFR-05
    verification:
      - kind: unit
        ref: "npx expo-doctor — 20/20 checks passed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Firebase singletons (app/auth/db) with initializeAuth + AsyncStorage 2.2.0 persistence wired at module load; memory-cache Firestore"
    requirement: AUTH-02
    verification:
      - kind: unit
        ref: "src/__tests__/smoke-test.ts#loads the app component as a function (imports auth + firebase graph)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Design tokens module matching UI-SPEC color/spacing/typography/radius contract"
    verification:
      - kind: unit
        ref: "src/__tests__/smoke-test.ts#locks the background color contract"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real Firebase project credentials inserted into src/firebase/config.ts (deferred — placeholder-safe)"
    requirement: AUTH-02
    verification: []
    human_judgment: true
    rationale: "One-way-door console setup deferred by user decision; device sign-in verification blocked until credentials land"

# Metrics
duration: 55min
completed: 2026-08-06
status: complete
---

# Phase 01: Foundation Summary — Plan 01-01

**Expo SDK 57 app scaffold with Firebase JS SDK v12 module-load singletons, AsyncStorage 2.2.0 auth persistence, design tokens, and jest-expo Wave 0 test infra**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-06T22:35:00+08:00
- **Completed:** 2026-08-06T23:30:00+08:00
- **Tasks:** 3 (Task 1 tracer, Task 2 checkpoint deferred, Task 3 infra)
- **Files modified:** 12

## Accomplishments
- Blank-typescript SDK 57 scaffold at repo root with `--no-agents-md` (AGENTS.md byte-identical) via temp-dir fallback
- `src/firebase/app.ts`: module-load singletons — initializeApp → initializeAuth (`getReactNativePersistence(AsyncStorage)`) → initializeFirestore (default memory cache; NO persistentLocalCache)
- `src/firebase/config.ts`: placeholder-safe 6-field config (checkpoint option-b — deferred)
- `src/theme/tokens.ts`: UI-SPEC Implementation Contract verbatim (colors/spacing/typography/radius)
- `App.tsx`: auth-gate skeleton via `onAuthStateChanged` (initializing/signed-out/signed-in)
- jest-expo Wave 0: smoke test imports the App module graph (auth + Firebase singletons load under jest) and locks token contract
- Verified: `tsc --noEmit` 0, `jest --ci --silent` 3/3 pass, `expo lint` clean, `expo-doctor` 20/20, `expo export --platform android` bundles (607 modules)

## Task Commits

1. **Task 1: Expo scaffold + Firebase singletons + tokens + auth-gate skeleton** - `502ecc8` (feat)
2. **Task 2: Firebase project credentials checkpoint** - resolved option-b (defer placeholders) — user decision, no code change
3. **Task 3: Wave 0 test infra (jest-expo, lint, scripts, smoke test)** - `c910bb2` (feat)

**Plan metadata:** `007517e` (docs: create phase plan)

## Files Created/Modified
- `package.json` — pins: expo ~57.0.11, firebase ^12.17.1, async-storage 2.2.0, react-navigation v7; scripts test/lint; jest-expo devDeps
- `app.json` — name "Money", light UI style
- `tsconfig.json` — strict + types [jest] + @firebase/auth path mapping
- `babel.config.js` — babel-preset-expo (missing from template)
- `jest.config.js` — jest-expo preset + @firebase CJS moduleNameMapper (Windows)
- `App.tsx` — auth-gate skeleton (initializing/signed-out/signed-in)
- `src/firebase/app.ts` — singletons app/auth/db
- `src/firebase/config.ts` — placeholder-safe firebaseConfig
- `src/theme/tokens.ts` — design tokens per UI-SPEC
- `src/__tests__/smoke-test.ts` — Wave 0 smoke + token contract
- `.gitignore`, `LICENSE`, `assets/` — template output

## Decisions Made
- **Firebase config deferred (option-b)** — one-way-door checkpoint resolved by user: placeholders now, real credentials inserted before device verification
- **@firebase/auth RN build import** — firebase 12.17.1's umbrella `./auth` dropped the react-native condition; use `@firebase/auth` with tsconfig path mapping to `dist/rn/index.rn.d.ts`
- **jest CJS redirects on Windows** — `transformIgnorePatterns` normalization proved unreliable on win32; moduleNameMapper to `index.cjs.js` builds is deterministic
- **babel.config.js added** — the blank-typescript template ships without it; babel-jest needed the preset to transpile ESM node_modules

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking] jest failed to parse @firebase ESM builds**
- **Found during:** Task 3 (Wave 0 test infra)
- **Issue:** `@firebase/util/dist/index.esm.js` (ESM) failed with "Unexpected token 'export'" — babel-jest had no babel config (template missing babel.config.js), and transformIgnorePatterns normalization on Windows was unreliable
- **Fix:** Added `babel.config.js` (babel-preset-expo), installed `babel-preset-expo`, moved jest config to `jest.config.js` with moduleNameMapper redirects: `@firebase/util|logger|component|app` → CJS builds, `@firebase/auth` → RN build, async-storage → official jest mock
- **Files modified:** babel.config.js, jest.config.js, package.json
- **Verification:** `npx jest --ci --silent` 3/3 pass
- **Committed in:** `c910bb2` (Task 3 commit)

**2. [Blocking] jest-expo preset merge issue**
- **Found during:** Task 3
- **Issue:** jest config in package.json `jest` key produced escaped-dot patterns (`\.*`) in resolved config, breaking the transform ignore logic
- **Fix:** Moved jest config to dedicated `jest.config.js`
- **Files modified:** package.json, jest.config.js
- **Verification:** jest green
- **Committed in:** `c910bb2`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes required for a working test suite; no scope creep.

## Issues Encountered
- Executor agent returned a truncated signal without writing SUMMARY.md or committing Task 3 — orchestrator spot-checked the filesystem, completed Task 3 verification and commits per the completion-signal fallback
- `babel-preset-expo` not a direct dependency of the template — installed explicitly

## User Setup Required

**Firebase console (deferred, one-way door):**
- Create Firebase project + register web app → insert the 6 `firebaseConfig` values into `src/firebase/config.ts` (currently PLACEHOLDER strings)
- Deploy `deploy/firestore.rules` + create composite index + seed default account (see 01-03 plan Task 3 checkpoint)

## Next Phase Readiness
- Wave 1 foundation proven: app boots, Firebase singletons load, auth-gate skeleton in place
- 01-02 (AuthProvider + Sign In + tabs) and 01-03 (money/dates/queries/rules) can run in parallel on top of this scaffold
- Device verification of AUTH-01/02/03 requires real Firebase credentials (deferred)

---
*Phase: 01-foundation*
*Completed: 2026-08-06*
