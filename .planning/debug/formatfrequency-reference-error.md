---
slug: formatfrequency-reference-error
status: resolved
trigger: |
  ERROR  [ReferenceError: Property 'formatFrequency' doesn't exist]
created: 2026-08-16
updated: 2026-08-16
resolution:
  root_cause: UpcomingSection.tsx used formatFrequency, getUpcomingOccurrence, and formatNextDate without importing them from ../lib/frequency
  fix: Added missing import: `import { formatFrequency, getUpcomingOccurrence, formatNextDate } from "../lib/frequency"`
---

# Debug Session: formatfrequency-reference-error

## Symptoms

- Expected: App renders without runtime errors when UpcomingSection displays scheduled entries.
- Actual: `ReferenceError: Property 'formatFrequency' doesn't exist` thrown at runtime.
- Error: `ERROR  [ReferenceError: Property 'formatFrequency' doesn't exist]`
- Timeline: Regression — likely introduced when UpcomingSection was created or modified without adding the frequency import.
- Reproduction: Navigate to Home screen with active scheduled entries; UpcomingSection renders and hits the missing binding.

## Current Focus

- hypothesis: UpcomingSection.tsx uses formatFrequency, getUpcomingOccurrence, and formatNextDate from ../lib/frequency but does not import them — missing import block.
- test: Add import for { formatFrequency, getUpcomingOccurrence, formatNextDate } from "../lib/frequency" to UpcomingSection.tsx and verify error resolves.
- expecting: ReferenceError disappears; UpcomingSection renders frequency labels and next dates correctly.
- next_action: Apply import fix, run tests and typecheck to verify.
- result: ✓ Fix applied successfully. TypeScript check passes with no errors.

## Evidence

- timestamp: 2026-08-16T00:00:00Z finding: Confirmed UpcomingSection.tsx was missing import for frequency utilities
- timestamp: 2026-08-16T00:00:00Z fix: Added import line to UpcomingSection.tsx
- timestamp: 2026-08-16T00:00:00Z verification: TypeScript compilation passes with no errors
