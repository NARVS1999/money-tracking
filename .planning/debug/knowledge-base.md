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

## home-add-entry-not-working — Home "Add an entry" CTA dead; save fails; form header/input broken
- **Date:** 2026-08-09
- **Error patterns:** tap does nothing, no-op handler, Save failed, permission-denied, amountCents, KeyboardContext, KeyboardProvider, focus, zero-size TextInput, SafeAreaView, status bar, notch
- **Root cause(s):** HomeScreen passed `onAddPress={() => {}}` to EmptyState (CTA never navigated); EntryForm modal header had no top safe-area inset; amount display was a plain View (hidden input unre-focusable); EntriesProvider wrote `amount` while rules/schema require `amountCents is int` (every entry create denied); App.tsx lacked KeyboardProvider (keyboard-controller degraded); hidden amount TextInput was 0x0 (Android re-focus stops after repeated cycles)
- **Fix:** HomeScreen navigates to EntryForm ({mode:"add",type:"expense"}); EntryForm wrapped in SafeAreaView + tappable amount display; EntriesProvider writes/reads `amountCents` at the Firestore boundary (internal type keeps `amount`); App.tsx mounts KeyboardProvider; hidden input resized to 1x1
- **Files changed:** src/screens/HomeScreen.tsx, src/components/EntryForm.tsx, src/entries/EntriesProvider.tsx, App.tsx, + 4 test files (HomeScreen.test.tsx, EntryForm.test.tsx, EntriesProvider.test.tsx, keyboard-provider-test.tsx)
- **Why not caught:** no gate existed — the no-op handler was a deliberate MVP deferral never revisited (flagged in 04-UI-REVIEW but not fixed); the amountCents mismatch was a schema-vs-implementation drift only the rules would catch (rules live in Firebase console, no emulator gate); KeyboardProvider omission and zero-size input are runtime-only symptoms
- **Recurrence guard:** regression tests — HomeScreen.test.tsx (CTA navigates), EntryForm.test.tsx (SafeAreaView + amount display focuses input + hidden input non-zero size), EntriesProvider.test.tsx (write contract: amountCents, never amount), keyboard-provider-test.tsx (App mounts KeyboardProvider)
---
