# Deferred Items — Phase 11 (sqlite-local-db)

Out-of-scope issues discovered while executing plans. Pre-existing problems in
unrelated code — logged per the GSD scope boundary rule (not fixed here).

| Plan | Item | Detail | Status |
|------|------|--------|--------|
| 11-01 | Lint errors (5) in pre-existing files | `react-hooks/set-state-in-effect` errors in src/auth/AuthProvider.tsx, src/categories/CategoriesProvider.tsx, src/entries/EntriesProvider.tsx; unrelated warnings in ExportScreen.tsx and lib tests. All pre-existing on HEAD before this plan. | open |
| 11-01 | Jest smoke-test theme token assertions fail | src/__tests__/smoke-test.ts expects colors.background `#F7F7F8` but tokens now `#FAFAFA` (theme changed since; test not updated). Fails identically on pristine HEAD. Also: jest env lacks EXPO_PUBLIC_FIREBASE_* vars, so firebase module init fails unless env sourced. | open |
