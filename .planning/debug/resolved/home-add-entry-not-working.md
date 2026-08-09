---
slug: home-add-entry-not-working
status: resolved
trigger: |
  in home add an entry not working when i click
created: 2026-08-09
updated: 2026-08-09
---

# Debug Session: home-add-entry-not-working

## Symptoms

- Expected: Tapping the add-entry action on the Home tab opens the entry form screen.
- Actual: Nothing happens — the tap appears completely ignored (no navigation, no visual feedback).
- Error: No error messages, no red screen, no console errors reported.
- Timeline: It never worked — present since the feature was first used, not a regression.
- Reproduction: On the Home tab, tapping the empty state / list row area (the add-entry affordance) does nothing.

## Current Focus

- hypothesis: Three defects found in round-2 human verification — (1) EntriesProvider writes `amount` but rules/schema require `amountCents`, so every entry create is denied (Save failed); (2) App.tsx lacks KeyboardProvider so KeyboardAwareScrollView logs WARN and keyboard behavior is degraded (flaky amount-input re-focus); (3) hidden amount TextInput is zero-size (0x0) which breaks Android re-focus after repeated taps
- test: All three RED — EntriesProvider.test.tsx (addEntry + copyEntry payload assert amountCents), keyboard-provider-test.tsx (App mounts KeyboardProvider), EntryForm.test.tsx (hidden input non-zero size)
- expecting: RED confirmed — 5 failing tests
- next_action: Apply fixes: (1) EntriesProvider writes/reads amountCents, (2) App.tsx mounts KeyboardProvider, (3) EntryForm hidden input gets non-zero size; verify GREEN + full suite
- tdd_checkpoint: RED confirmed 2026-08-09 — EntriesProvider.test.tsx (2), keyboard-provider-test.tsx (1), EntryForm.test.tsx (1) all fail as expected
- reasoning_checkpoint:
  hypothesis: "HomeScreen.tsx line 111 passes onAddPress={() => {}} — an empty callback — to EmptyState, so pressing the CTA has no effect, while EntryForm is registered as a modal stack screen in App.tsx and Expenses/Income screens navigate to it successfully"
  confirming_evidence:
    - "HomeScreen.tsx:111 — return <EmptyState onAddPress={() => {}} />"
    - "EmptyState.tsx:15 — Pressable onPress={onAddPress} correctly wires the CTA to the prop"
    - "App.tsx:38-42 — EntryForm registered as root stack modal screen named 'EntryForm'"
    - "ExpensesScreen.tsx:134-136 — identical navigate('EntryForm', { mode: 'add', type: 'expense' }) pattern works from the tab navigator"
    - "git log 213aa6c — CTA added with no-op handler by design ('for MVP just show the CTA without navigation'); 04-UI-REVIEW.md flags it as a defect"
  falsification_test: "If onAddPress actually navigated (or EntryForm were not registered), the press would either navigate or throw — neither happens; a test asserting navigate is called would pass on fixed code"
  fix_rationale: "Wiring onAddPress to navigation.navigate('EntryForm', { mode: 'add', type: 'expense' }) makes the CTA open the entry form exactly like Expenses/Income tabs — addresses root cause (missing handler), not a symptom"
  blind_spots: "No runtime test on a physical device in this environment; navigation bubble from tab navigator to parent stack is the same pattern ExpensesScreen/IncomeScreen already use successfully"
  candidate_causes:
    - "cause in category: code — no-op onAddPress handler in HomeScreen (CONFIRMED)"
    - "cause in category: config — EntryForm route not registered (ELIMINATED — registered in App.tsx)"
    - "cause in category: environment — Pressable not receiving taps (ELIMINATED — EmptyState renders Pressable with onPress wired; other Pressables in app work)"
  and_gate: "no — single contributing cause: the no-op handler; navigation infra is proven working by Expenses/Income tabs"

## Evidence

- timestamp: 2026-08-09
  checked: knowledge-base.md
  found: No matching prior session (only safeareaview-deprecated, unrelated)
  implication: No known-pattern shortcut; investigate fresh
- timestamp: 2026-08-09
  checked: src/screens/HomeScreen.tsx
  found: Line 111 — `if (monthEntries.length === 0) { return <EmptyState onAddPress={() => {}} />; }` — onAddPress is an empty arrow function
  implication: Tapping "Add an entry" CTA invokes a no-op — nothing happens. Matches symptom exactly.
- timestamp: 2026-08-09
  checked: src/components/EmptyState.tsx
  found: Pressable CTA ("Add an entry") with `onPress={onAddPress}` — the component correctly forwards the press
  implication: Bug is in the caller (HomeScreen), not EmptyState
- timestamp: 2026-08-09
  checked: App.tsx + ExpensesScreen.tsx + IncomeScreen.tsx
  found: EntryForm registered as root stack modal (`presentation: "modal"`); Expenses/Income screens navigate with `navigation.navigate("EntryForm", { mode: "add", type: "..." })` from within the tab navigator
  implication: Navigation to EntryForm from the Home tab (same tab navigator) is valid and works elsewhere — infrastructure is fine
- timestamp: 2026-08-09
  checked: git log -- src/screens/HomeScreen.tsx + .planning/phases/04-summary/04-02-PLAN.md + 04-UI-REVIEW.md
  found: Commit 213aa6c introduced the CTA with a no-op handler ("for MVP just show the CTA without navigation" per CONTEXT.md); 04-UI-REVIEW.md line 144 explicitly flags: "EmptyState CTA is no-op — must wire to navigation to an entry form tab"
  implication: Deliberate MVP deferral, never revisited — "never worked" timeline explained; UI review already flagged it as a defect
- timestamp: 2026-08-09
  checked: src/screens/__tests__/HomeScreen.test.tsx (new) — TDD RED run
  found: Test "tapping 'Add an entry' navigates to EntryForm in add mode" FAILS on current code — navigate called 0 times after pressing CTA
  implication: Bug reproduced as a failing test; the no-op handler is the confirmed root cause
- timestamp: 2026-08-09
  checked: Human verification (Expo Go) after HomeScreen fix
  found: Home CTA now opens the entry form — original issue fixed. BUT user reports: (1) Cancel/Save buttons are at the very top of the screen (under status bar/notch — no safe-area top inset); (2) tapping the amount number to edit/type does nothing once the keyboard is dismissed
  implication: EntryForm modal has two additional UX defects — header ignores top safe area; amount display is a non-interactive View (hidden TextInput can only be focused on mount)
- timestamp: 2026-08-09
  checked: src/components/EntryForm.tsx
  found: container View has no SafeAreaView/inset handling (header paddingVertical only, no top inset); amountContainer is a plain View with Text display — no onPress; hidden TextInput (height/width 0, opacity 0) auto-focused only via mount effect
  implication: Both user-reported EntryForm defects confirmed in code
- timestamp: 2026-08-09
  checked: Round-2 human verification (Expo Go) + code review
  found: (1) Save fails with generic alert — EntriesProvider.addEntry writes `amount` but firestore.rules + backend-schema.md require `amountCents is int` (rule line 34) — every entries create denied since commit 4aea4b4; (2) console WARN "Couldn't find real values for KeyboardContext... inside of KeyboardProvider" — App.tsx never mounts KeyboardProvider, so react-native-keyboard-controller is non-functional (KeyboardAwareScrollView can't track keyboard); (3) user can tap amount input twice, then focus stops working — hidden TextInput is 0x0 (height/width 0), a known Android re-focus failure
  implication: Save has NEVER worked (schema/rules mismatch predates the form); KeyboardProvider missing breaks keyboard handling; zero-size hidden input breaks repeated focus
- timestamp: 2026-08-09
  checked: git log -S amountCents + firestore.rules + backend-schema.md
  found: rules/schema consistently require `amountCents` since 4aea4b4 (WR-04); EntriesProvider (51db111) always wrote `amount` — schema/rules never updated to match app
  implication: App is the outlier — align writes/reads to amountCents, matching schema + rules (rules deployed via console, changing them requires human redeploy)

## Eliminated

- hypothesis: EntryForm route not registered / navigation broken
  evidence: App.tsx registers EntryForm modal stack screen; Expenses/Income tabs navigate to it successfully with identical pattern
  timestamp: 2026-08-09

## Resolution

root_cause: (1) HomeScreen.tsx passed an empty callback (() => {}) as onAddPress to EmptyState, so the Home tab's "Add an entry" CTA never navigated to the EntryForm screen; (2) EntryForm modal had no safe-area top handling so the Cancel/Save header rendered under the status bar/notch; (3) EntryForm's amount display was a plain View so the hidden amount TextInput could not be re-focused after the keyboard dismissed; (4) EntriesProvider wrote `amount` while firestore.rules + backend-schema.md require `amountCents is int` — every entry create was denied, so saving always failed ("Save failed. Please try again."); (5) App.tsx never mounted KeyboardProvider, so react-native-keyboard-controller logged the KeyboardContext WARN and keyboard handling was degraded; (6) the hidden amount TextInput was 0x0 — Android stops re-focusing zero-size inputs after repeated show/dismiss cycles ("works twice, third time no")
fix: (1) HomeScreen navigates to EntryForm ({ mode: "add", type: "expense" }); (2) EntryForm wrapped in SafeAreaView (react-native-safe-area-context); (3) amount display wrapped in TouchableOpacity that focuses the input; (4) EntriesProvider writes/reads `amountCents` at the Firestore boundary (addEntry, updateEntry, copyEntry, fetchAllEntries) — internal Entry type keeps `amount`; (5) App.tsx mounts KeyboardProvider; (6) hidden input resized to 1x1 (non-zero, still invisible)
verification: |
  - 6 new regression tests GREEN (HomeScreen.test.tsx x2, EntryForm.test.tsx x3, keyboard-provider-test.tsx x1, EntriesProvider.test.tsx x2)
  - Full suite: 15 suites / 123 tests pass
  - tsc --noEmit: clean (exit 0)
  - expo lint: no new warnings/errors in changed files
  - guardrail_verdict: accepted
files_changed:
  - src/screens/HomeScreen.tsx
  - src/screens/__tests__/HomeScreen.test.tsx
  - src/components/EntryForm.tsx
  - src/components/__tests__/EntryForm.test.tsx
  - src/entries/EntriesProvider.tsx
  - src/entries/__tests__/EntriesProvider.test.tsx
  - App.tsx
  - src/__tests__/keyboard-provider-test.tsx
