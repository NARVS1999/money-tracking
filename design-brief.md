# Design Brief — Minimal Money Tracker

## Design principles

1. **Log in under 10 seconds** — entry form is the fastest path; two taps to reach it from anywhere
2. **Numbers first** — the summary screen is big type, not charts. The user reads ₱ numbers, not graphs
3. **One hand, one thumb** — bottom tab bar, FAB reachable, list rows tall enough to tap
4. **Calm and neutral** — white surfaces, gray text, green/red reserved for money direction only
5. **No decoration** — no icons for categories, no gradients, no illustrations. Text is the interface

## Color palette

| Token | Hex | Use |
|-------|-----|-----|
| `background` | `#F7F7F8` | Screen background |
| `surface` | `#FFFFFF` | Cards, list rows, forms |
| `textPrimary` | `#1A1A1A` | Headlines, amounts |
| `textSecondary` | `#6B7280` | Descriptions, labels, dates |
| `border` | `#E5E7EB` | Hairlines, dividers |
| `income` | `#16A34A` | Income amounts, income accents |
| `expense` | `#DC2626` | Expense amounts, expense accents |
| `accent` | `#111827` | FAB, primary buttons (black — neutral, not colorful) |
| `danger` | `#DC2626` | Delete actions |

Money direction is the **only** color meaning: green = money in, red = money out. Everything else stays monochrome.

## Typography

- **Summary totals:** 40–48pt, `fontWeight: "700"`, `fontVariant: ["tabular-nums"]` (digits don't jitter when values change)
- **Entry amounts:** 16–17pt, tabular-nums, colored by type
- **Body/labels:** 15–16pt system font
- **Currency:** ₱ symbol always rendered, space before digits (`₱ 24.50`)
- Thousand separators always shown (`₱ 12,000.00`)

## Layouts

### Sign In
```
┌─────────────────────────────┐
│ Money                       │  ← app name, 28pt bold,
│                             │    centered above fields
│ Email       [            ]  │
│ Password    [            ]  │
│                             │
│      [ Sign in ]            │  ← full-width black button
│                             │
│  No account? [ Create one ] │  ← link-style, gray
└─────────────────────────────┘
```
- Centered card on `surface`; nothing else on screen
- Inline error below the fields in `danger` ("Email or password is wrong")
- `Create one` expands the card: adds **Display name** field above Email and turns the button into **Create account**; returns to sign-in view when done

### Home (Summary)
```
┌─────────────────────────────┐
│ Money                 [⇩]   │  ← title + export icon
│                             │
│ Spent                     ▲ │
│ ₱ 8,432.50                 │  ← 48pt bold red
│ Earned                    ▲ │
│ ₱ 25,000.00                │  ← 48pt bold green
│ ───────────────────────    │
│ Food        ▓▓▓ ₱ 3,120    │  ← category rows with
│ Transport   ▓▓  ₱ 1,005    │    inline bar (optional,
│ Rent        ▓▓▓▓₱ 4,000    │    width ∝ share of spend)
└─────────────────────────────┘
```
Layout: one card (`surface`) containing Spent block, Earned block, then category breakdown list. Export icon top-right of the screen header.

### List rows (Expenses / Income tabs)
```
┌─────────────────────────────┐
│ Coffee shop      ₱ 120.00   │  ← amount right, colored
│ Food · Aug 4               │  ← category + date, gray
└─────────────────────────────┘
```
- Row: single line of primary text (description or category if no description), secondary line `Category · date`
- Grouped under month headers ("August 2026")
- FAB bottom-right: `+`, black circle, white plus
- Long-press or tap row → action sheet: Edit / Copy / Delete (Delete in red, bottom position)

### Entry form
- Amount first (top field, focused on open, numeric keypad)
- Date row with inline `⌄` opening a picker; today shown as "Today"
- Category dropdown (custom bottom sheet listing the tab's categories)
- Description below as plain input, placeholder "Description (optional)"
- Save = full-width black button pinned at bottom of the sheet
- Copy mode: banner strip "Copying entry — date set to today" in gray

### Categories tab
- Two sections with uppercase gray headers: **EXPENSE CATEGORIES**, **INCOME CATEGORIES**
- Rows: category name left, usage count right, `✕` icon on the right edge
- `✕` on a category in use → bottom alert: "Category in use — move or delete its entries first"
- `+ Add category` as a dashed-border row at the bottom of each section; tapping turns it into an inline text input with a check button

### Account tab
- Profile row at top: display name (bold) + email (gray); a gray `DEFAULT` badge when the signed-in account is the default
- `Sign out` as a full-width outlined button near the top
- `Create another account` — link-style row, expands the same form as Sign In's create view; confirming signs into the new account
- `Delete this account` — full-width button in `danger` styling (red text, red border). **Hidden for the default account.** Flow: confirmation sheet → password field → destructive confirm in solid red
- No settings/theme options here — it is an account screen, not a settings screen

### Export
- Two date rows (From / To) with pickers; below them two equal-width buttons: **Export PDF** (black) and **Export Excel** (outlined)
- Success state: green check + file name, e.g. `expenses-2026-08-01_31.pdf`
- Error state: red inline message (e.g. "To date before From date" — also prevented by picker)

## Empty states

- **No entries this month (Home):** "Nothing logged this month" + `+ Log an expense` button
- **Empty tab:** "No expenses yet" + FAB is the answer
- **No categories:** expense/income form shows hint "Create a category first" with a jump link to the Categories tab

## Motion & feedback

- Save → brief success (button flashes, row appears via listener update)
- Delete → confirmation dialog, then row removal
- No screens transitions beyond platform defaults; no springy animations
- Pull-to-refresh not needed — Firestore listeners update live

## What this brief explicitly rejects

- Charts, graphs, pie charts (numbers only)
- Emoji or icon categories (text only)
- Onboarding, walkthroughs, password-reset screens (console handles that)
- Dark mode (v1), themes, custom fonts
