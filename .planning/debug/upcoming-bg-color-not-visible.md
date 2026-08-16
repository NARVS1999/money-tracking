---
slug: upcoming-bg-color-not-visible
status: resolved
trigger: |
  still the pallette color of background of upcoming expenses was not fixed
created: 2026-08-16
updated: 2026-08-16
---

# Debug Session: upcoming-bg-color-not-visible

## Symptoms

- Expected: Upcoming Expenses / Upcoming Income cards on Home screen show a visible yellow-tinted background per the UI spec (15-UI-SPEC §3).
- Actual: The card background appears white — the yellow tint is not visible or extremely subtle.
- Error: None — visual styling issue, no console error.
- Timeline: The tokens were defined in Phase 15 (upcomingExpenseBg = rgba(248,197,25,0.08)) but the tint was never visibly noticeable on device.
- Reproduction: Open Home screen with active scheduled entries; Upcoming sections render with a white-looking card instead of a yellow-tinted one.

## Current Focus

- hypothesis: Two issues: (1) rgba(248,197,25,0.08) at 8% opacity is nearly invisible on a white background — needs higher opacity (15-20%); (2) card StyleSheet style lacks borderWidth:1 so the borderColor override from theme.border never renders.
- test: Increase upcomingExpenseBg/upcomingIncomeBg opacity from 0.08 to 0.15, add borderWidth:1 to card style, verify yellow tint is visible on device.
- expecting: Yellow-tinted card background clearly distinguishable from white; yellow border visible.
- next_action: Apply token and style fixes, run tests.

## Root Cause

Confirmed hypothesis. Two issues:

1. **Token opacity too low**: `upcomingExpenseBg` and `upcomingIncomeBg` used `rgba(248, 197, 25, 0.08)` — only 8% opacity. On a white (#FFFFFF) background, this produces an imperceptible ~20/255 RGB shift. The border tokens (`upcomingExpenseBorder`/`upcomingIncomeBorder`) at 0.15 opacity were also too subtle.

2. **Missing borderWidth**: The `card` StyleSheet in `UpcomingSection.tsx` had no `borderWidth` property. The inline style applied `borderColor: theme.border` but without `borderWidth: 1`, React Native renders no border at all.

## Resolution

**root_cause**: RGBA opacity 0.08 is invisible on white; card style missing borderWidth:1
**fix**: 
- Increased bg opacity from 0.08 → 0.15, border opacity from 0.15 → 0.25 in tokens.ts
- Added `borderWidth: 1` to card style in UpcomingSection.tsx
- Updated token tests and test fixtures to match new values
**applied**: yes
