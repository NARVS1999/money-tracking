---
slug: income-tab-no-add-entry-button
status: resolved
trigger: |
  in income tab there are no button to add an entry, like in expenses tab they have a entry add button
created: 2026-08-09
updated: 2026-08-09
---

# Debug Session: income-tab-no-add-entry-button

## Symptoms

- Expected: The Income tab shows an add-entry button (same as the Expenses tab), letting the user log income.
- Actual: Button missing entirely — no add-entry affordance anywhere on the Income tab.
- Error: (none reported)
- Timeline: It never worked — the Income tab has never had an add button.
- Layout: Separate Income and Expenses tabs in the app.

## Current Focus

- hypothesis: IncomeScreen renders the FAB (+) only in its NON-empty branch; the empty-state branch (lines 90-99) returns early WITHOUT the FAB, so a user with zero income entries sees a dead-end screen whose copy even says "Tap the + button below" — a button that does not exist. The identical latent defect exists in ExpensesScreen, but it is masked because the user already has expense entries (which can be created from the Home CTA), so the Expenses list branch (with FAB) renders. Income has NO alternative entry path anywhere (Home CTA hardcodes type: "expense"), so the first income entry can never be created — a bootstrap deadlock. Confirmed root cause.
- test: IncomeScreen.test.tsx — empty state renders the add-entry FAB ("+") and tapping it navigates to EntryForm with { mode: "add", type: "income" }; ExpensesScreen.test.tsx — empty state renders the FAB navigating to { mode: "add", type: "expense" }
- expecting: RED — both tests fail on current code (empty-state branch has no FAB)
- next_action: DONE — tests written (RED confirmed), both screens fixed (FAB moved outside the empty-state branch), GREEN confirmed, full suite passes
- tdd_checkpoint: RED confirmed 2026-08-09 — IncomeScreen.test.tsx x2 failed with `Text "+" not found` (empty-state branch renders no FAB); user confirmed; fix applied
- reasoning_checkpoint:
  hypothesis: "IncomeScreen returns the empty-state branch (incomeEntries.length === 0) early WITHOUT the FAB — the button only renders inside the non-empty branch. The empty-state copy ('Tap the + button below to log your first income.') references a button that is not rendered, and the Home CTA hardcodes type: 'expense', so there is no alternative path to create the first income entry — a bootstrap deadlock."
  confirming_evidence:
    - "IncomeScreen.tsx (pre-fix, HEAD) lines 90-99 — `if (incomeEntries.length === 0) return (<View style={styles.centered}>…)</View>` with no TouchableOpacity FAB; FAB only in the non-empty branch (lines 131-138)"
    - "ExpensesScreen.tsx (pre-fix) lines 91-99 — identical structure, identical latent defect"
    - "HomeScreen.tsx:116 — EmptyState onAddPress hardcodes `navigation.navigate('EntryForm', { mode: 'add', type: 'expense' })` — income has no other entry point"
    - "git log -p: FAB added to BOTH screens in the same commit 384ade9 (03-02); no later removal — source never regressed in git"
    - "App.tsx:39-43 — EntryForm registered as root stack modal; navigation infra proven working (prior session home-add-entry-not-working)"
  falsification_test: "If the empty-state branch rendered the FAB, a test asserting Text '+' exists with entries=[] would pass on the pre-fix code — it failed (Text '+' not found), confirming the branch omission"
  fix_rationale: "Move the FAB outside the empty-state conditional so it renders in BOTH branches — the empty state is precisely when a user needs the add affordance most; identical fix applied to ExpensesScreen which had the same latent dead-end"
  blind_spots: "No physical-device runtime verification in this environment; render-path analysis + component tests cover the change (FAB is pure presentational, no logic changed)"
  candidate_causes:
    - "cause in category: code — empty-state branch omits the FAB (CONFIRMED in both IncomeScreen and ExpensesScreen)"
    - "cause in category: code — FAB removed by a regression commit (ELIMINATED — git history shows FAB present in both screens since 384ade9, clean working tree)"
    - "cause in category: config — EntryForm route not registered / navigation broken (ELIMINATED — registered in App.tsx; identical pattern proven working on Expenses tab and in prior resolved session)"
    - "cause in category: environment — stale deployed build (ELIMINATED — no web deployment exists, Expo Go workflow; bug reproduces in current source by render-path analysis)"
  and_gate: "no — single contributing cause: the empty-state branch's early return omitted the FAB; the same one-line structural defect existed in both screens"

## Evidence

- timestamp: 2026-08-09
  checked: src/screens/IncomeScreen.tsx (HEAD, clean working tree)
  found: FAB TouchableOpacity (lines 131-138) renders ONLY inside the non-empty `return (<View style={styles.container}>` block (lines 101-139). The empty-state branch (lines 90-99) returns `<View style={styles.centered}>` with title/subtitle only — no FAB. Empty copy: "Tap the + button below to log your first income."
  implication: With zero income entries the user sees a screen telling them to tap a button that is not rendered — exactly the reported symptom
- timestamp: 2026-08-09
  checked: src/screens/ExpensesScreen.tsx (HEAD)
  found: Identical structure — empty-state branch (lines 91-99) omits the FAB; FAB only in non-empty branch (lines 132-139). Same latent dead-end.
  implication: Same defect class; masked for this user because they already have expense entries, so the non-empty branch (with FAB) renders
- timestamp: 2026-08-09
  checked: git log -p --follow -- src/screens/IncomeScreen.tsx + src/screens/ExpensesScreen.tsx
  found: FAB added to BOTH screens in the same commit 384ade9 (03-02). At 51db111/eafd0e8 (03-01) neither screen had a FAB. No later commit removed it. Current HEAD has FAB in both files.
  implication: Source has never regressed in git; the report "never worked" is explained by the empty-state dead-end, not a missing commit
- timestamp: 2026-08-09
  checked: src/screens/HomeScreen.tsx + MainTabs.tsx + App.tsx
  found: Home empty-state CTA hardcodes `navigation.navigate("EntryForm", { mode: "add", type: "expense" })` (line 116); MainTabs registers Income → IncomeScreen; App.tsx registers EntryForm as a root stack modal. EntryForm accepts type: "income" (per EntryForm tests + handleEdit/copy patterns in IncomeScreen).
  implication: The ONLY path to create an income entry is the Income tab FAB — which is hidden when there are no income entries. Bootstrap deadlock confirmed. Navigation infrastructure is proven working (prior resolved session home-add-entry-not-working).
- timestamp: 2026-08-09
  checked: .planning/debug/resolved/home-add-entry-not-working.md + knowledge-base.md
  found: Prior session confirmed EntryForm modal navigation works from Income/Expenses screens; FAB pattern verified on device.
  implication: Not a navigation/config issue — a rendering-branch bug
- timestamp: 2026-08-09
  checked: jest.config.js + src/screens/__tests__/HomeScreen.test.tsx
  found: jest-expo preset, react-test-renderer pattern with useNavigation/useEntries mocks exists for screen tests; no IncomeScreen or ExpensesScreen test file exists yet
  implication: TDD test can follow the established HomeScreen test pattern
- timestamp: 2026-08-09
  checked: TDD RED run — npx jest src/screens/__tests__/IncomeScreen.test.tsx (pre-fix)
  found: 2 tests FAIL — `Text "+" not found` in the empty-state render; both the FAB-presence and FAB-navigation assertions fail
  implication: Bug reproduced as failing tests; user confirmed RED; TDD gate passed
- timestamp: 2026-08-09
  checked: TDD GREEN run — npx jest (post-fix)
  found: 17 suites / 127 tests pass (was 123 — 4 new regression tests: IncomeScreen x2, ExpensesScreen x2); tsc --noEmit exit 0; expo lint exit 0
  implication: Fix verified — FAB now renders and navigates in the empty state on both tabs; no regressions

## Eliminated

- hypothesis: FAB never existed in source / removed by a regression commit
  evidence: git history shows FAB present in both screens since 384ade9; clean working tree at HEAD contains it
  timestamp: 2026-08-09
- hypothesis: EntryForm route not registered or navigation broken from Income tab
  evidence: App.tsx registers EntryForm modal; identical navigate pattern proven working in prior resolved session (home-add-entry-not-working) and on the Expenses tab
  timestamp: 2026-08-09
- hypothesis: Stale deployed bundle / web build
  evidence: No web deployment exists (deploy/ only holds firestore rules); Expo Go workflow — the bug reproduces in current source by rendering path analysis (empty branch lacks FAB)
  timestamp: 2026-08-09

## Resolution

root_cause: IncomeScreen's empty-state branch (zero income entries) returned early WITHOUT rendering the FAB (+), so a brand-new Income tab was a dead-end — the copy said "Tap the + button below" but no button existed, and no other screen offers an income entry path (Home CTA hardcodes type: "expense"). ExpensesScreen carried the identical latent defect, masked only because the user already had expense entries.
fix: Move the FAB (+) outside the empty-state conditional in both IncomeScreen and ExpensesScreen so it renders in the empty AND non-empty branches — the empty state is exactly when the add affordance is needed most.
verification: |
  - 4 new regression tests GREEN (IncomeScreen.test.tsx x2 — empty-state FAB present + navigates to EntryForm add/income; ExpensesScreen.test.tsx x2 — empty-state FAB present + navigates to EntryForm add/expense)
  - Full suite: 17 suites / 127 tests pass
  - tsc --noEmit: clean (exit 0)
  - expo lint: clean (exit 0)
  - guardrail_verdict: accepted
files_changed:
  - src/screens/IncomeScreen.tsx
  - src/screens/ExpensesScreen.tsx
  - src/screens/__tests__/IncomeScreen.test.tsx
  - src/screens/__tests__/ExpensesScreen.test.tsx
