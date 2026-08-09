# Phase 3 — UI Review

**Audited:** 2026-08-09
**Baseline:** UI-SPEC.md design contract
**Screenshots:** not captured (no dev server)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Empty state and delete confirmation copy match spec; error toast text diverges from spec contract |
| 2. Visuals | 3/4 | Clean layout with FAB focal point; entry row amount fontSize is 16px instead of spec's 44px |
| 3. Color | 3/4 | Token system used consistently; FAB has spec-forbidden shadow |
| 4. Typography | 2/4 | Entry row amount font is 16px — spec mandates 44px for amount prominence |
| 5. Spacing | 3/4 | Token-based spacing throughout; one hardcoded 2px margin in date description |
| 6. Experience Design | 2/4 | Error toast uses "Dismiss" instead of spec's "Retry"; EntryForm uses Alert.alert instead of toast |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **Entry row amount fontSize is 16px instead of 44px** — Amounts appear as regular text, destroying the visual hierarchy that makes amounts the dominant element in each row. **Fix:** In `EntryRow.tsx` line 125, change `fontSize: 16` to `fontSize: 44` to match `typography.amount` or the spec's 44px value.

2. **Error toast copy doesn't match spec** — UI-SPEC requires "Save failed — retry?" with a "Retry" tappable action. Actual implementation shows the raw `lastError` string with a "Dismiss" button, removing the retry affordance. **Fix:** In `ExpensesScreen.tsx` and `IncomeScreen.tsx`, change error toast body to "Save failed — retry?" and replace the Dismiss button with a Retry button that re-attempts the failed operation.

3. **Entry row date shows raw "YYYY-MM-DD" instead of formatted "Mon DD"** — The `DateSectionHeader` formats dates as "Today"/"Yesterday"/"Aug 7" but `EntryRow` renders the raw `entry.date` string (e.g., "2026-08-08"), creating an inconsistent date presentation within the same screen. **Fix:** In `EntryRow.tsx` line 79, use a date formatter to display "Mon DD" format instead of the raw ISO string.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Matching spec:**
- Empty state heading: "No entries yet" — matches spec (`ExpensesScreen.tsx:94`, `IncomeScreen.tsx:93`)
- Empty state body: "Tap the + button below to log your first expense/income." — matches spec exactly (`ExpensesScreen.tsx:96`, `IncomeScreen.tsx:95`)
- FAB icon: "+" — matches spec (`ExpensesScreen.tsx:138`, `IncomeScreen.tsx:137`)
- Delete confirmation: "Delete this entry?" / "This entry will be permanently removed." / Cancel + Delete (destructive) — matches spec (`EntryRow.tsx:49-61`)
- Sync indicator text: "Syncing…" — matches spec (`EntryRow.tsx:85`)
- Form title: "Add Entry" / "Edit Entry" / "Copy Entry" — matches spec (`EntryForm.tsx:147-152`)
- Category picker empty: "No {type} categories yet" — reasonable, not in spec but appropriate

**Diverging from spec:**
- `ExpensesScreen.tsx:126-129`: Error toast shows `{lastError}` (raw error string) with "Dismiss" action. **Spec requires:** "Save failed — retry?" with a "Retry" tappable text. The raw error message is developer-facing, not user-friendly copy. **WARNING**
- `EntryForm.tsx:141`: Catch block shows `Alert.alert("Error", "Save failed. Please try again.")` — generic alert instead of spec's toast-style banner with Retry action. **WARNING**
- "Add one" CTA from spec is not rendered anywhere. The spec defines it as the primary CTA on the empty state, but the implementation only has the FAB. The empty state is text-only with no button. This is a minor deviation since the FAB serves the same purpose. **WARNING**

### Pillar 2: Visuals (3/4)

**Strong:**
- FAB is 56×56px circle with accent background, white "+", properly positioned above tab bar (`ExpensesScreen.tsx:170-185`)
- Swipe actions follow the CategoriesScreen pattern with 80px-wide Edit/Copy/Delete (`EntryRow.tsx:27-68`)
- Empty state has clear vertical hierarchy: title → subtitle → FAB
- Modal bottom sheet has handle bar, proper max height, and slide animation (`EntryForm.tsx:232-272`)
- Sync indicator with red dot + "Syncing…" text is visually clear (`EntryRow.tsx:82-87`)

**Issues:**
- **BLOCKER:** `EntryRow.tsx:125`: Amount `fontSize: 16` — spec mandates 44px for the amount to be the dominant visual element in each row. At 16px, the amount is the same size as the category name, destroying the intended left-text/right-amount hierarchy. **Fix:** Change to `fontSize: 44` with `fontWeight: "700"` to match spec.
- `ExpensesScreen.tsx:180-184`, `IncomeScreen.tsx:179-183`: FAB has `elevation: 4`, `shadowColor: "#000"`, `shadowOpacity: 0.25`, `shadowRadius: 4`. **Spec explicitly states: "Shadow: none (monochrome, no elevation)."** The shadow adds unnecessary visual weight. **Fix:** Remove all shadow/elevation properties from FAB style.
- `EntryRow.tsx:79`: Date display shows raw `entry.date` ("2026-08-08") instead of spec's "Mon DD" format ("Aug 8"). This creates a visual inconsistency with `DateSectionHeader` which correctly formats dates. **Fix:** Apply the same date formatting logic used in `DateSectionHeader.tsx` to `EntryRow.tsx`.

### Pillar 3: Color (3/4)

**Token compliance:**
- All components import from `tokens.ts` and use `colors.*` tokens consistently
- 60/30/10 distribution maintained: `#F7F7F8` background (60%), `#FFFFFF` surface + `#E5E7EB` border (30%), `#111827` accent (10%)
- Income green (`#16A34A`) and expense red (`#DC2626`) used correctly on amounts and indicators
- `textPrimary` (#1A1A1A) for category names, `textSecondary` (#6B7280) for date/description — matches spec

**Hardcoded colors (not from tokens):**
- `ExpensesScreen.tsx:181`, `IncomeScreen.tsx:180`: `shadowColor: "#000"` — spec says no shadow on FAB
- `ExpensesScreen.tsx:189`, `IncomeScreen.tsx:188`: `color: "#FFFFFF"` on FAB text — standard white, acceptable
- `ExpensesScreen.tsx:212`, `IncomeScreen.tsx:211`: `color: "#FFFFFF"` on error text — standard white, acceptable
- `EntryRow.tsx:63`: `color: "#FFFFFF"` on delete swipe text — standard white, acceptable
- `EntryForm.tsx:388`: `rgba(0,0,0,0.4)` modal overlay — standard pattern, acceptable

**Verdict:** Color system is well-implemented. The FAB shadow is the only spec deviation. Hardcoded whites are standard and don't constitute a finding.

### Pillar 4: Typography (2/4)

**Font sizes in use:**
- `typography.body.size` (16px): Entry row category, form labels, picker text — **correct**
- `typography.label.size` (14px): Date/description, section headers, sync text — **correct**
- `typography.heading.size` (20px): Form header title, sheet title — **correct**
- `fontSize: 44`: Entry form amount display — **matches spec's custom 44px amount**
- `fontSize: 28`: FAB "+" icon — **matches spec**
- `fontSize: 24`: Form chevron icon — **minor, not in spec but acceptable**
- **`fontSize: 16`: Entry row amount — spec mandates 44px. BLOCKER.**

**Font weights in use:**
- `typography.body.weight` ("400"): Used via token on category names, labels — **correct**
- `typography.label.weight` ("400"): Used via token on date text, section headers — **correct** (spec says 700 for section headers, but `DateSectionHeader` uses `typography.label.weight as "700"` which correctly overrides)
- Hardcoded `"700"`: Used in `EntryRow.tsx:126` (amount), `EntryForm.tsx:321,339,351,429` (save, amount display, labels, selected category) — inconsistent with token pattern

**tabular-nums:**
- `EntryRow.tsx:127`: `fontVariant: ["tabular-nums"]` on amount — **correct**
- `EntryForm.tsx:340`: `fontVariant: ["tabular-nums"]` on amount display — **correct**

**Critical finding:** The entry row amount at 16px is the same size as the category name. The spec's design intent is that amounts are the visually dominant element in each row (44px, bold, color-coded). This single issue significantly degrades the visual hierarchy of the entry list.

### Pillar 5: Spacing (3/4)

**Token usage:**
- `spacing.md` (16px): Screen edge padding, row horizontal padding, form content padding, header padding — **consistent**
- `spacing.sm` (8px): Row left margin, label bottom margin, sheet handle margin — **consistent**
- `spacing.lg` (24px): Label top margin, FAB bottom/right positioning — **consistent**
- `spacing.xl` (32px): Amount container padding, empty state padding, bottom sheet bottom padding — **consistent**
- `spacing.xs` (4px): Empty title bottom margin, sync dot right margin — **consistent**

**Hardcoded spacing:**
- `EntryRow.tsx:122`: `marginTop: 2` — not from tokens. Minor, but inconsistent with the token system. **Fix:** Use `spacing.xs / 2` or add a dedicated token.
- `EntryForm.tsx:374`: `fontSize: 24` — this is a font size, not spacing, but the chevron icon has no spacing token reference for its size.

**Verdict:** Spacing is almost entirely token-based. The single `marginTop: 2` is the only deviation and is minor.

### Pillar 6: Experience Design (2/4)

**State coverage:**

| State | Status | Evidence |
|-------|--------|----------|
| Loading | ✅ | `ActivityIndicator` with accent color (`ExpensesScreen.tsx:83-89`, `IncomeScreen.tsx:82-88`) |
| Empty | ✅ | "No entries yet" + contextual subtitle for both tabs |
| Populated | ✅ | FlatList with date-section headers and entry rows |
| Overflow | ✅ | FlatList virtualizes automatically |
| Disabled | ✅ | Save button disabled when amount=0 or no category (`EntryForm.tsx:113,162-164`) |
| Destructive | ✅ | Alert.alert with "Delete" in destructive style (`EntryRow.tsx:49-61`) |
| Sync pending | ✅ | Red dot + "Syncing…" text per entry (`EntryRow.tsx:82-87`) |
| Entry deleted while form open | ✅ | Guard alert + navigation back (`EntryForm.tsx:50-56`) |

**Issues:**
- **Error handling deviation:** UI-SPEC defines error toast as "Save failed — retry?" with a "Retry" tappable text. Implementation uses "Dismiss" button (`ExpensesScreen.tsx:127-129`, `IncomeScreen.tsx:126-128`). This removes the retry affordance — users must manually re-trigger the operation. **WARNING**
- **EntryForm error handling:** `EntryForm.tsx:141` catches save errors with `Alert.alert("Error", "Save failed. Please try again.")` — a blocking system alert instead of the spec's non-blocking toast banner. This interrupts the user's flow. **WARNING**
- **EntryForm modal architecture:** The UI-SPEC defines EntryForm as a native-stack screen with `presentation: 'modal'`. The implementation uses a React Native `<Modal>` component (`EntryForm.tsx:232`). While functionally similar, this deviates from the spec's navigation architecture. **WARNING**
- **No retry mechanism on error toast:** The spec's "Retry" action implies re-attempting the failed write. The current "Dismiss" only hides the error, requiring the user to re-enter data if they want to try again. **WARNING**

---

## Files Audited

| File | Lines | Role |
|------|-------|------|
| `src/components/EntryRow.tsx` | 159 | Entry row with swipe actions, sync indicator |
| `src/components/EntryForm.tsx` | 438 | Full-screen modal form for add/edit/copy |
| `src/components/DateSectionHeader.tsx` | 47 | Sticky date section header |
| `src/screens/ExpensesScreen.tsx` | 221 | Expense entry list with FAB and error toast |
| `src/screens/IncomeScreen.tsx` | 220 | Income entry list with FAB and error toast |
| `src/theme/tokens.ts` | 17 | Design tokens (colors, spacing, typography, radius) |
| `.planning/phases/03-entries/03-UI-SPEC.md` | 360 | UI design contract (audit baseline) |
