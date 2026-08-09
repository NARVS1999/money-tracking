# Phase 4 — UI Review

**Audited:** 2026-08-09
**Baseline:** 04-UI-SPEC.md design contract
**Screenshots:** not captured (no dev server)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | All specified copy present; error state text contract unimplemented |
| 2. Visuals | 3/4 | Layout matches spec; LoadingSkeleton missing section headers; EmptyState no-op CTA |
| 3. Color | 4/4 | All tokens from tokens.ts; no hardcoded colors; 60/30/10 split correct |
| 4. Typography | 4/4 | All sizes/weights match spec; tabular-nums on totals; no unused scales |
| 5. Spacing | 3/4 | All spacing from tokens.ts; arbitrary 44px height used but documented as accessibility requirement |
| 6. Experience Design | 2/4 | No error state handling; EmptyState CTA is no-op; no feedback on failed loads |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **No error state handling** — When Firestore onSnapshot fails, the user sees nothing (no error message, no retry guidance) — HomeScreen.tsx must destructure `lastError` from `useEntries()` and render the spec'd error copy inline when non-null
2. **EmptyState CTA is a no-op** — Tapping "Add an entry" does nothing — `HomeScreen.tsx:111` passes `() => {}` — must wire to navigation to an entry form tab
3. **LoadingSkeleton missing section headers** — The skeleton shows raw gray blocks but omits the "Expenses"/"Income" heading placeholders that appear in the populated state — creates a jarring visual jump when content loads

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Spec compliance:**
- ✅ `EmptyState.tsx:13` — "Nothing logged this month" (exact match)
- ✅ `EmptyState.tsx:14` — "Start tracking to see your summary here." (exact match)
- ✅ `EmptyState.tsx:16` — "Add an entry" CTA label (exact match)
- ✅ `HomeScreen.tsx:124` — "Expenses" section header (exact match)
- ✅ `HomeScreen.tsx:132` — "Income" section header (exact match)
- ✅ `HomeScreen.tsx:43` — Month label derived as "MMMM YYYY" from `today()` (correct format)

**Missing:**
- ❌ **Error state copy unimplemented.** UI-SPEC line 91 declares: `"Couldn't load entries — check your connection and pull down to retry."` — `HomeScreen.tsx` destructures `{ entries, isLoading }` from `useEntries()` (line 31) but does NOT destructure `lastError` or `clearError`. `EntriesProvider.tsx:69` exposes `lastError: string | null` but it is never read by HomeScreen. When onSnapshot fails, the user sees no feedback.

**Finding type:** WARNING — degrades error UX but doesn't break happy path.

---

### Pillar 2: Visuals (3/4)

**Layout contract (spec lines 116-153):**
- ✅ SafeAreaView top/bottom inset via Expo's default
- ✅ Month header → Totals → Divider → Sections flow (HomeScreen.tsx:114-138)
- ✅ CategorySection renders rows with `flexDirection: 'row'`, `justifyContent: 'space-between'` (CategorySection.tsx:63-71)
- ✅ Subtotal aligned right under last row (CategorySection.tsx:88-96)
- ✅ EmptyState centered column with heading + body + CTA (EmptyState.tsx:11-19)

**Issues:**
- ⚠️ **LoadingSkeleton omits section headers.** UI-SPEC loading state (line 108) specifies "two gray 44px rectangles for totals, 3 gray rows for categories" — but the populated state shows section headers ("Expenses", "Income") with different padding. The skeleton (LoadingSkeleton.tsx:27-45) shows raw gray blocks without header placeholders, creating a layout jump on transition.
- ⚠️ **EmptyState CTA is non-functional.** HomeScreen.tsx:111 passes `onAddPress={() => {}}` — the button renders but does nothing on press. Spec line 149 shows this as a CTA, implying navigational intent.
- ✅ Row height: `minHeight: 44` (CategorySection.tsx:66) matches spec accessibility requirement (line 42).

**Finding type:** WARNING — skeleton layout jump degrades perceived performance; no-op CTA breaks user task completion.

---

### Pillar 3: Color (4/4)

**Token compliance (all from `src/theme/tokens.ts`):**
- ✅ Background: `#F7F7F8` → `colors.background` (HomeScreen.tsx:145, LoadingSkeleton.tsx:51)
- ✅ Surface: `#FFFFFF` → `colors.surface` (not used in this phase — correct, surfaces are category row backgrounds)
- ✅ Accent: `#111827` → `colors.accent` (EmptyState.tsx:45 — CTA button background only)
- ✅ Expense: `#DC2626` → `colors.expense` (SummaryTotals.tsx:23, CategorySection via color prop)
- ✅ Income: `#16A34A` → `colors.income` (SummaryTotals.tsx:33, CategorySection via color prop)
- ✅ Text primary: `#1A1A1A` → `colors.textPrimary` (HomeScreen.tsx:155, CategorySection.tsx:57,79)
- ✅ Text secondary: `#6B7280` → `colors.textSecondary` (SummaryTotals.tsx:23,33 for zero state, CategorySection.tsx:92)
- ✅ Border: `#E5E7EB` → `colors.border` (HomeScreen.tsx:162, CategorySection.tsx:70)
- ✅ onAccent: `#FFFFFF` → `colors.onAccent` (EmptyState.tsx:54 — CTA text)

**60/30/10 distribution:**
- 60% background (#F7F7F8): full screen — ✅
- 30% surface (#FFFFFF): category row backgrounds — ✅
- 10% accent (#111827): active tab indicator only in this phase — ✅ (EmptyState CTA uses accent bg, which is acceptable per spec)

**No hardcoded colors found** — All style values sourced from tokens.ts.

**Finding type:** None — pillar passes.

---

### Pillar 4: Typography (4/4)

**Spec compliance:**

| Role | Spec Size | Spec Weight | Actual | File:Line |
|------|-----------|-------------|--------|-----------|
| Totals | 44px | 700 | `fontSize: 44, fontWeight: "700"` | SummaryTotals.tsx:50-51 |
| Heading | 20px | 700 | `typography.heading` (20/700) | HomeScreen.tsx:152-153, CategorySection.tsx:54-55 |
| Body | 16px | 400 | `typography.body` (16/400) | CategorySection.tsx:76-77,84-85 |
| Label | 14px | 400 | `typography.label` (14/400) | CategorySection.tsx:89-90, EmptyState.tsx:38 |

**Extras:**
- ✅ `fontVariant: ["tabular-nums"]` on SummaryTotals (line 53) and CategorySection row amounts (line 86) — digits align vertically as spec requires
- ✅ Line heights match spec: heading 24px, body 24px, label 20px
- ✅ No unused typography scales — `display` (28px) correctly not used in this phase
- ✅ Font weight casts (`as "700"`, `as "400"`) are standard React Native patterns — not a concern

**Finding type:** None — pillar passes.

---

### Pillar 5: Spacing (3/4)

**Token compliance:**
- ✅ `spacing.md` (16px) used for horizontal padding on all containers (HomeScreen.tsx:156, CategorySection.tsx:51,67,94)
- ✅ `spacing.sm` (8px) used for compact gaps (SummaryTotals.tsx:47, CategorySection.tsx:59-60)
- ✅ `spacing.lg` (24px) used for section padding (HomeScreen.tsx:157, SummaryTotals.tsx:46)
- ✅ `spacing.xl` (32px) used for EmptyState container padding (EmptyState.tsx:27)

**Issues:**
- ⚠️ **44px row height is hardcoded, not from tokens.** CategorySection.tsx:66 uses `minHeight: 44` and LoadingSkeleton.tsx:60,75 use `height: 44`. This is documented as an accessibility requirement (UI-SPEC line 42: "44px minimum touch target height"), not a spacing token. Acceptable deviation, but should be noted as a constant or token if reused elsewhere.
- ✅ No arbitrary bracket values (`[12px]`, `[1rem]`) found in any component.

**Finding type:** INFO — documented deviation, not a defect.

---

### Pillar 6: Experience Design (2/4)

**State coverage analysis:**

| State | Spec Status | Implemented | File |
|-------|-------------|-------------|------|
| Loading | ✅ covered | ✅ LoadingSkeleton.tsx — animated pulse | LoadingSkeleton.tsx |
| Empty | ✅ covered | ✅ EmptyState.tsx — heading + body + CTA | EmptyState.tsx |
| Populated | ✅ covered | ✅ CategorySection renders rows | CategorySection.tsx |
| Error | ✅ covered | ❌ **NOT implemented** | HomeScreen.tsx |
| Zero totals | ✅ covered | ✅ SummaryTotals shows gray "₱ 0.00" | SummaryTotals.tsx:23,33 |

**Critical gaps:**
- ❌ **Error state not handled.** `EntriesProvider` exposes `lastError: string | null` and `clearError: () => void` (EntriesProvider.tsx:58-60,69). `HomeScreen.tsx:31` only destructures `{ entries, isLoading }` — `lastError` is available but never read. When Firestore onSnapshot fails (network error, permission denied), the user sees no feedback. Spec line 91 requires inline error text with retry guidance.
- ❌ **EmptyState CTA is no-op.** HomeScreen.tsx:111 passes `() => {}` — tapping "Add an entry" does nothing. The user completes the mental model of "I need to add an entry" but gets no system response. Spec line 149-150 implies this should navigate to an entry form.
- ⚠️ **No disabled state for CTA button.** EmptyState.tsx Pressable (line 15) has no `disabled` prop or visual feedback for disabled state — acceptable for MVP since the button is always actionable when visible.

**Live update behavior:**
- ✅ Derived state recalculates via useMemo when entries context changes (HomeScreen.tsx:48-104)
- ✅ No loading state on re-render — instant update via onSnapshot (spec line 199-200)

**Finding type:** BLOCKER — missing error state breaks user task completion when network fails.

---

## Files Audited

| File | Lines | Role |
|------|-------|------|
| `src/screens/HomeScreen.tsx` | 165 | Main summary screen — month header, totals, sections, state routing |
| `src/components/SummaryTotals.tsx` | 55 | Two large 44px expense/income totals |
| `src/components/CategorySection.tsx` | 97 | Section header, category rows, subtotal |
| `src/components/EmptyState.tsx` | 57 | Centered empty state with CTA |
| `src/components/LoadingSkeleton.tsx` | 82 | Animated pulse skeleton |
| `src/theme/tokens.ts` | 17 | Design tokens (colors, spacing, typography, radius) |
| `src/lib/money.ts` | 22 | formatCents utility |
| `src/entries/EntriesProvider.tsx` | 261 | Entries context (exposes lastError, not consumed by HomeScreen) |
| `.planning/phases/04-summary/04-UI-SPEC.md` | 226 | Design contract baseline |
| `.planning/phases/04-summary/04-REVIEW-FIX.md` | 45 | Prior code review fixes (onAccent token added) |

---

## Registry Safety

Registry audit: shadcn not initialized — no third-party blocks to check. Registry Safety section not applicable.

---

_UI Review: 2026-08-09_
_Reviewer: gsd-ui-auditor_
_Baseline: 04-UI-SPEC.md_
