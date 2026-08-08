# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## safeareaview-deprecated — RN SafeAreaView deprecation warning in AccountScreen
- **Date:** 2026-08-09
- **Error patterns:** SafeAreaView, deprecated, react-native-safe-area-context, WARN, Metro
- **Root cause(s):** `src/screens/AccountScreen.tsx` imported `SafeAreaView` from `react-native` (deprecated — getter emits WARN on render; component will be removed in a future RN release)
- **Fix:** Switched the `SafeAreaView` import to `react-native-safe-area-context` (already a dependency; `SafeAreaProvider` already mounted in `App.tsx`)
- **Files changed:** src/screens/AccountScreen.tsx, src/screens/__tests__/AccountScreen.test.tsx
- **Why not caught:** none (no gate existed for this class — deprecation warnings surface only at runtime in Metro console, not in tests/typecheck/lint)
- **Recurrence guard:** regression test `src/screens/__tests__/AccountScreen.test.tsx` (3 tests) asserting the screen renders via `react-native-safe-area-context` SafeAreaView and does not render RN's deprecated SafeAreaView
---
