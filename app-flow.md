# App Flow — Screens & Navigation

## Navigation model

Auth gate: on cold start the app shows **Sign In** until an account is signed in (session persists, so returning users go straight through). After sign-in, a bottom tab bar with 5 tabs: **Home, Expenses, Income, Categories, Account**. Entry form and Export open as full-screen stack screens on top of the tabs.

```
Launch
  │  signed in? ── no ──▶ SIGN IN  (email + password,
  │                          │      "Create account" link)
  │ yes                      │  valid → Home
  ▼                          ▼
HOME  ← landing screen
─────────────────────────────────────────────
 │
 ▼
┌─────────────────────────────────────────────┐
│ Current month                    [Export ↗] │
│                                             │
│   Spent    ₱ 8,432.50                       │
│   Earned   ₱ 25,000.00                      │
│                                             │
│   Food ............. ₱ 3,120.00             │
│   Transport ........ ₱ 1,005.00             │
│   Rent ............. ₱ 4,000.00             │
│                                             │
│   + [Add expense]   + [Add income]          │
└─────────────────────────────────────────────┘
  Home   Expenses   Income   Categories   Account
```

## Screen-by-screen flows

### 0. Sign In (auth gate)
```
┌─────────────────────────────────────────────┐
│ Money                                      │
│                                             │
│ Email     [ you@example.com      ]          │
│ Password  [ ••••••••             ]          │
│                                             │
│        [ Sign in ]                          │
│                                             │
│  No account?  [ Create one ]                │
└─────────────────────────────────────────────┘
```
- First launch: sign in with the **default account** (seeded at setup)
- `Create one` → inline expansion: display name, email, password → creates the account (empty ledger) and signs into it
- Wrong credentials → inline error under the password field
- Success → Home; session persists, so cold starts after this skip straight to Home

### 1. Home (Summary)
- Shows current-month totals: big "Spent" and "Earned" numbers, per-category breakdown for the month
- `[Export]` → **Export screen** (date range defaults to current month)
- Shortcut buttons to open the entry form directly

### 2. Expenses tab / Income tab
```
┌─────────────────────────────────────────────┐
│ Expenses                         [＋ FAB]   │
│                                             │
│ Aug 4 · Coffee shop              ₱ 120.00  │
│        Food                                  │
│ Aug 3 · Groceries                ₱ 2,450.50 │
│        Food                                  │
│ Aug 1 · Rent                     ₱ 12,000   │
│        Housing                               │
└─────────────────────────────────────────────┘
```
- List of entries for that tab, newest first (grouped by month headers)
- FAB (+) → **Entry form** with `type` preset to this tab
- Tap a row → action sheet: **Edit / Copy / Delete**
  - Edit → Entry form pre-filled
  - Copy → Entry form pre-filled, date reset to today
  - Delete → confirmation dialog → remove

### 3. Entry form (shared: add / edit / copy)
```
┌─────────────────────────────────────────────┐
│ New Expense                    [Save]       │
│                                             │
│ Amount        [ ₱ 24.50        ]            │
│ Date          [ 2026-08-06  ⌄ ] ← default   │
│ Category      [ Food        ▾ ] ← dropdown  │
│ Description   [ optional note  ]            │
│                                             │
│              [ Save entry ]                 │
└─────────────────────────────────────────────┘
```
- Title adapts: "New Expense" / "New Income" / "Edit Entry" / "Copy Entry"
- Amount: numeric keypad, ₱ prefix, 2 decimals
- Date: picker, past dates allowed, **future dates blocked**
- Category: dropdown of the current tab's categories only; if none exist, prompt to create one in Categories tab
- Copy mode: fields pre-filled, date reset to today, Save creates a new document

### 4. Categories tab
```
┌─────────────────────────────────────────────┐
│ Categories                        [+ Add]   │
│                                             │
│ EXPENSE CATEGORIES                          │
│  Food                       (14 entries) ✕  │
│  Transport                  (5 entries)  ✕  │
│  Housing                    (1 entry)   ✕   │
│                                             │
│ INCOME CATEGORIES                           │
│  Salary                     (2 entries)  ✕  │
│  Side hustle                (0 entries)  ✕  │
└─────────────────────────────────────────────┘
```
- Two groups: Expense Categories, Income Categories
- `[+ Add]` → inline input for a new category name (saves into the active group)
- `✕` on a category **with entries → deletion blocked** with message ("Move or remove its entries first")
- `✕` on an empty category → confirm → delete

### 5. Account tab
```
┌─────────────────────────────────────────────┐
│ Account                            [Sign ⇡] │
│                                             │
│   John Doe                    signed in     │
│   johndoe@example.com                       │
│   (Default — can't be deleted)              │  ← only on default
│                                             │
│  [ Create another account ]                 │
│  [ Delete this account ]                    │  ← grayed out for
│                                             │     default account
└─────────────────────────────────────────────┘
```
- Profile row: display name, email, "Default" badge when applicable
- `Create another account` → same inline form as the Sign In screen's create flow; signs into the new account (see design note below)
- `Delete this account` (hidden/grayed for default):
  - Confirm dialog → re-enter password → cascade delete (entries, categories, users doc, auth account) → back to Sign In
- `Sign ⇡` → sign out → back to Sign In screen

> Design note: after creating an account the app signs into it immediately — the new empty ledger is where you land. To get back, sign out and sign in with the default account.

### 6. Export screen
```
┌─────────────────────────────────────────────┐
│ Export Summary                    [Done]    │
│                                             │
│ From  [ 2026-08-01  ⌄ ]                     │
│ To    [ 2026-08-31  ⌄ ]        (default:    │
│                                     current │
│                                     month)  │
│                                             │
│  [ Export PDF ]   [ Export Excel ]          │
│                                             │
│  ✓ Saved: expenses-2026-08-01_31.pdf        │
└─────────────────────────────────────────────┘
```
- Both date pickers independent; To cannot be before From
- PDF: totals, per-category totals, then entry list (date, category, description, amount)
- Excel: single sheet, one row per entry, with a totals row
- File written to the phone's Downloads folder; share sheet used as fallback (iOS)
- Success confirmation shows the file name

## End-to-end flows

**First run:** open app → Sign In (default account) → Home.

**Log fast (10s):** open app (already signed in) → Expenses tab → FAB → amount → category → Save.

**Repeat expense:** open app → Expenses tab → tap "Rent" → Copy → Save (date already today).

**Monthly report:** open app → Home → Export → (range pre-set) → Export PDF → confirm file in Downloads.

**New category:** Categories tab → Add → type name → then pick it in the expense dropdown.

**New account:** Account tab → Create another account → fill form → lands in the new empty ledger.

**Delete account:** Account tab → Delete this account → confirm + password → everything cascades → Sign In screen. (Default account: option is absent.)

**Offline:** everything above works with no network; Firestore offline persistence syncs in the background when connectivity returns. Signing in for the first time requires network (auth is server-side).
