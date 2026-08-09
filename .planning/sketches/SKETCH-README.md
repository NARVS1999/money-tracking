# Homepage Theme Sketches

## Overview
Five homepage theme variants for the Money Tracking app. Each explores a different visual direction while displaying the same data.

**Data used in all mockups:**
- Month: August 2026
- Expenses: P8,432.50
- Income: P25,000.00
- Balance: P16,567.50
- Categories: Rent (P4,000), Food (P3,120), Transport (P1,005)

## Themes

### 1. theme-original.html
**Style:** Minimal, faithful to current `tokens.ts`
- Background: `#F7F7F8`
- Clean typography, no shadows
- Current component layout (month header, large totals, category rows)

### 2. theme-basic.html
**Style:** High contrast, utilitarian
- Background: `#FFFFFF` with black borders
- Bold uppercase labels
- Heavy 2px dividers, no rounded corners on buttons
- Maximum readability

### 3. theme-money-tracker.html
**Style:** Dark financial app
- Background: `#0F172A` (dark navy)
- Gradient hero section with balance as hero number
- Card-based stat display
- Subtle glassmorphism on cards

### 4. theme-liquid-glass.html
**Style:** iOS 26 Liquid Glass (glassmorphism)
- Gradient background (purple/pink)
- Frosted glass panels with `backdrop-filter: blur(20px)`
- Translucent surfaces with subtle borders
- Floating orb background elements for depth
- Category icons in rounded glass containers

### 5. theme-modern-ui.html
**Style:** Contemporary app design
- Soft gradient hero card (purple)
- Rounded corners (24px) everywhere
- Color-coded category icons with pastel backgrounds
- Frosted glass tab bar
- Avatar placeholder for personal touch
- Subtle shadows and hover states

## How to View
Open any `.html` file directly in a browser. All mockups are optimized for 375px width (iPhone viewport).

## Recommendation
- **Original** = safest, matches existing codebase
- **Money Tracker** = best for financial focus
- **Liquid Glass** = most visually striking (iOS 26 aesthetic)
- **Modern UI** = best balance of style and usability
