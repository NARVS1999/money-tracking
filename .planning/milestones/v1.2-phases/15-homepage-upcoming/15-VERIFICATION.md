---
phase: 15-homepage-upcoming
verified: 2026-08-12T02:00:00Z
status: human_needed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "On-device (Expo Go QR): open Home — confirm 'Upcoming Expenses' section renders with yellow-tinted card (rgba(248,197,25,0.08) bg, rgba(248,197,25,0.15) border) and red #DC2626 amounts, positioned between the quick-action buttons and the chart sections"
    expected: "Upcoming Expenses section visible, yellow-red theme, between quick actions and charts (HOME-UP-01, HOME-UP-07)"
    why_human: "Visual color/placement confirmation requires the real device; grep/tests prove the wiring, not the rendered pixels"
  - test: "On-device: confirm 'Upcoming Income' section below Upcoming Expenses with yellow-tinted card and teal #45C0CF amounts"
    expected: "Upcoming Income section visible, yellow-blue theme (HOME-UP-02)"
    why_human: "Visual theme confirmation requires the real device"
  - test: "On-device: with scheduled templates present, confirm each row shows category icon, description (or category name), formatted amount, '{Frequency} · Next: {date}'; 'once' templates show their start date without a 'Next:' prefix"
    expected: "Row content contract correct (HOME-UP-04)"
    why_human: "Typography/layout legibility on the actual phone screen; component tests assert text content, not visual rendering"
  - test: "On-device: pause/delete all scheduled templates of one type (or seed none) — confirm only that type's section hides; with zero of both types, confirm Home looks exactly as v1.1"
    expected: "Per-type hidden at zero; both-zero leaves Home unchanged (HOME-UP-05)"
    why_human: "Runtime provider behavior on device; integration tests use mock providers"
  - test: "On-device: tap an upcoming row — confirm ScheduledEntryForm opens in edit mode, pre-filled, with the correct category type (expense rows → expense categories)"
    expected: "Row tap navigates to edit form (HOME-UP-06)"
    why_human: "Real navigation flow on device; navigation mock in tests proves the call, not the user-visible flow"
---

# Phase 15: Homepage — Upcoming Indicators Verification Report

**Phase Goal:** Home screen shows "Upcoming Expenses" (yellow-red) and "Upcoming Income" (yellow-blue) sections listing active scheduled entries with next occurrence, between quick-action buttons and chart sections.
**Verified:** 2026-08-12T02:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UpcomingSection component exists: title, items, color theme, onTapItem props; rows render category icon, description-or-category-name, amount, frequency, next date (ROADMAP SC1, HOME-UP-04) | ✓ VERIFIED | `src/components/UpcomingSection.tsx` (186 lines, substantive) — props `{title, items, theme, onTapItem}`; UpcomingRow renders CategoryIcon 44px, `description \|\| categoryName`, `formatCents(amount)`, `{formatFrequency} · Next: {formatNextDate}`. 12 component tests pass, covering title, description, category-name fallback, "Next:" line, once-without-"Next:", last-row border |
| 2 | Expense theme yellow-red: bg `rgba(248,197,25,0.08)`, accent `#DC2626`; Income theme yellow-blue: bg `rgba(248,197,25,0.08)`, accent `#45C0CF` (ROADMAP SC2, HOME-UP-01/02) | ✓ VERIFIED | `src/theme/tokens.ts` lines 11-14: `upcomingExpenseBg`/`upcomingExpenseBorder`/`upcomingIncomeBg`/`upcomingIncomeBorder` with exact spec values; HomeScreen passes `accent: colors.expense` (#DC2626) and `accent: colors.teal` (#45C0CF); tokens.test.ts asserts values + distinct names; UpcomingSection tests assert `#DC2626` and `#45C0CF` amount colors and card bg/border/radius 24 |
| 3 | Sections hidden when empty; ALL active scheduled entries shown — no 7-day horizon (ROADMAP SC3, HOME-UP-03/05) | ✓ VERIFIED | UpcomingSection returns `null` at `items.length === 0`; HomeScreen filters `s.isActive && s.type === "expense"/"income"` with `hasUpcomingOccurrence` — no date-horizon filter anywhere; tests: "returns null when there are no items", "hides Upcoming Income when no active income templates", "hides both sections when no scheduled entries", "both-zero v1.1" |
| 4 | HomeScreen renders both sections between quick-action buttons and chart sections, expenses first (ROADMAP SC4, HOME-UP-07) | ✓ VERIFIED | `src/screens/HomeScreen.tsx` lines 246-283: `quickActions` View → UpcomingSection ("Upcoming Expenses") → UpcomingSection ("Upcoming Income") → `expenseChartData` chart section; test at HomeScreenUpcoming.test.tsx:338 "places the upcoming sections between the quick-action buttons and the chart sections" passes |
| 5 | Tapping a row navigates to ScheduledEntryForm in edit mode (ROADMAP SC5, HOME-UP-06) | ✓ VERIFIED | `openScheduledEdit` → `navigation.navigate("ScheduledEntryForm", { mode: "edit", id: entry.id, type: entry.type })`; onTapItem wired on both sections; tests "navigates to ScheduledEntryForm in edit mode with the row id and type on tap" and "passes the income type through" pass |
| 6 | Theme tokens added for upcoming backgrounds/borders (ROADMAP SC6) | ✓ VERIFIED | 4 tokens present with exact spec values; consumed by HomeScreen (wired); `src/theme/__tests__/tokens.test.ts` (3 tests) passes |
| 7 | `npx tsc --noEmit` passes (ROADMAP SC7) | ✓ VERIFIED | Ran from repo root: exit 0, no output |

**Score:** 7/7 truths verified (0 present-behavior-unverified, 0 overrides)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/components/UpcomingSection.tsx` | Yellow-tinted card, themed tap-only rows, null at zero | ✓ VERIFIED | Exists (186 lines), substantive (full render contract), wired (imported by HomeScreen), data flows from HomeScreen filtered/sorted props |
| `src/screens/HomeScreen.tsx` | Both sections between quick actions and charts; edit navigation | ✓ VERIFIED | Exists (408 lines), substantive, `useScheduledEntries` wired, `sortUpcoming`/`hasUpcomingOccurrence` pure helpers |
| `src/theme/tokens.ts` | 4 upcoming tokens | ✓ VERIFIED | Lines 11-14, exact spec values, distinct names, consumed at HomeScreen call sites |
| `src/lib/frequency.ts` | `getUpcomingOccurrence` display helper | ✓ VERIFIED | Lines 80-100: engine-consistent next clamped to today with forward day-scan (WR-01 fix); used by UpcomingSection, ScheduledEntryRow, and HomeScreen sort; 13+ unit tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| HomeScreen | UpcomingSection | JSX render with `items`/`theme`/`onTapItem` props | ✓ WIRED | Lines 264-283; both sections, expenses first |
| HomeScreen | ScheduledEntriesProvider | `useScheduledEntries()` hook | ✓ WIRED | Line 81; `scheduledEntries` feeds both memos; provider wraps tree in App.tsx (confirmed in 15-REVIEW) |
| HomeScreen | ScheduledEntryForm | `navigation.navigate("ScheduledEntryForm", {mode:"edit", id, type})` | ✓ WIRED | `openScheduledEdit` line 194-203; CR-02 pattern from phase 14 |
| UpcomingSection | `src/lib/frequency.ts` | `getUpcomingOccurrence`/`formatFrequency`/`formatNextDate` imports | ✓ WIRED | Lines 11-15; date math never re-implemented in UI |
| HomeScreen | `src/lib/frequency.ts` | `getUpcomingOccurrence` in `sortUpcoming` + `hasUpcomingOccurrence` | ✓ WIRED | Lines 31-74; sort key matches displayed date |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| UpcomingSection (×2) | `items` | `upcomingExpenses`/`upcomingIncome` memos ← `scheduledEntries` from `useScheduledEntries()` (SQLite provider, phase 13) | Yes — real provider data, filtered `isActive` + `hasUpcomingOccurrence`, sorted | ✓ FLOWING |
| UpcomingSection | `theme` | `colors.upcomingExpenseBg/Border` + `colors.expense`; `colors.upcomingIncomeBg/Border` + `colors.teal` | Yes — real tokens | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Phase-15 component suite | `npx jest --testPathPattern="src/components/__tests__/UpcomingSection\|src/screens/__tests__/HomeScreen\|src/lib/__tests__/frequency\|src/theme/__tests__"` | 74/74 tests passed; 4 suites passed; 1 suite (`src/screens/__tests__/HomeScreen.test.tsx`) fails at **module load** with `Firebase: Error (auth/invalid-api-key)` — pre-existing environment limitation (legacy test `requireActual`s EntriesProvider → firebase init; documented in 15-REVIEW-FIX.md, TEST-REPORT.md, 15-01-SUMMARY.md; no phase-15 code involved, zero assertion failures) | ✓ PASS (phase-15 suites) |

### Probe Execution

No probes declared for this phase (UI component phase, not migration/tooling). SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| HOME-UP-01 | 15-01-PLAN | Home shows "Upcoming Expenses" section with yellow-red theme | ✓ SATISFIED | HomeScreen title="Upcoming Expenses", theme `{upcomingExpenseBg, upcomingExpenseBorder, accent: colors.expense}`; tests assert `#DC2626` amount + yellow card |
| HOME-UP-02 | 15-01-PLAN | Home shows "Upcoming Income" section with yellow-blue theme | ✓ SATISFIED | HomeScreen title="Upcoming Income", theme `{upcomingIncomeBg, upcomingIncomeBorder, accent: colors.teal}`; tests assert `#45C0CF` amount (teal, not Export green) |
| HOME-UP-03 | 15-01-PLAN | Sections display ALL active scheduled entries (not just next 7 days) | ✓ SATISFIED | Filter is `isActive && type === X && hasUpcomingOccurrence` — no date-horizon cap; WR-02 filter keeps only genuinely upcoming entries |
| HOME-UP-04 | 15-01-PLAN | Each row: category icon, description, amount, frequency, next occurrence date | ✓ SATISFIED | UpcomingRow: CategoryIcon 44px, `description \|\| categoryName`, `formatCents`, `{Frequency} · Next: {date}`; component tests cover each element |
| HOME-UP-05 | 15-01-PLAN | Sections hidden when no scheduled entries exist for that type | ✓ SATISFIED | `return null` at zero items; per-type independent memos; tests: per-type hide, both-zero v1.1, all-exhausted hide |
| HOME-UP-06 | 15-01-PLAN | Tapping an upcoming row navigates to edit the scheduled entry | ✓ SATISFIED | `openScheduledEdit` → `navigate("ScheduledEntryForm", {mode:"edit", id, type})`; 2 navigation tests pass (expense + income type) |
| HOME-UP-07 | 15-01-PLAN | Sections appear between the quick-action buttons and the chart sections | ✓ SATISFIED | JSX order: quickActions → Upcoming Expenses → Upcoming Income → chart sections; placement test at HomeScreenUpcoming.test.tsx:338 |

All 7 requirement IDs (HOME-UP-01..07) declared in PLAN frontmatter are accounted for — **no orphaned requirements**. Requirement mapping in REQUIREMENTS.md matches Phase 15 for all 7 IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | No `TBD`/`FIXME`/`XXX`/`PLACEHOLDER` markers in phase-15 files; no empty implementations; `return null` at UpcomingSection.tsx:40 is the intentional null-at-zero empty state (HOME-UP-05), not a stub |

### Human Verification Required

On-device verification via Expo Go QR (plan Task 7; WINDOWS.md ledger id 6, open). The code-side behaviors are proven by 74 passing tests; these items confirm the rendered experience on the user's phone:

1. **Upcoming Expenses theme + placement** — Home shows "Upcoming Expenses" (yellow tint + red `#DC2626` amounts) between the quick-action buttons and the chart sections. *Why human:* visual color/placement confirmation requires the real device.
2. **Upcoming Income theme** — Home shows "Upcoming Income" below it (yellow tint + teal `#45C0CF` amounts). *Why human:* visual theme confirmation requires the real device.
3. **Row content contract** — Rows show description (or category name), "{Frequency} · Next: {date}", and the formatted amount; once templates show their start date without "Next:". *Why human:* typography/layout legibility on the actual screen.
4. **Hidden-when-empty** — A type with zero active templates hides only its own section; zero of both leaves Home exactly as v1.1. *Why human:* runtime provider behavior on device.
5. **Edit-form navigation** — Tapping a row opens ScheduledEntryForm in edit mode, pre-filled, with the correct category type. *Why human:* real navigation flow on device.

### Gaps Summary

No gaps found. All 7 roadmap success criteria verified by code evidence and 74 passing automated tests (typecheck clean; phase-15 suites all green). The single failing suite in the run (`src/screens/__tests__/HomeScreen.test.tsx`) is a pre-existing, documented environment limitation — it fails at firebase module load, not at any assertion, and involves no phase-15 code. Status is **human_needed** only because the on-device visual verification items (plan Task 7) remain open, matching the phases 11-14 convention.

---

_Verified: 2026-08-12T02:00:00Z_
_Verifier: the agent (gsd-verifier)_
