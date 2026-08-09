---
phase: 08-budget
plan: 01
subsystem: budget
tags: [ui, budget, progress-bar, firestore, user-settings]
requires: [phase-07]
provides: [BDGT-01, BDGT-02, BDGT-03, BDGT-04, BDGT-05, BDGT-06, BDGT-07, NFR-08]
affects: [src/auth/AuthProvider.tsx, src/components/BudgetCard.tsx, src/screens/HomeScreen.tsx, src/screens/AccountScreen.tsx]
tech-stack:
  added: []
  patterns: [budget-on-users-doc, progress-bar-thresholds, date-range-picker]
key-files:
  created: [src/components/BudgetCard.tsx]
  modified: [src/auth/AuthProvider.tsx, src/screens/HomeScreen.tsx, src/screens/AccountScreen.tsx]
key-decisions:
  - "Budget stored on users/{uid} doc — no new collections, no new queries"
  - "Progress bar colors: green < 70%, yellow 70-90%, red > 90%"
  - "Budget form uses same DateTimePicker and parsePesoInput as EntryForm"
  - "Budget card hidden when no budget set; 'Set new budget' prompt when expired"
coverage:
  - deliverable: "BudgetCard component with progress bar"
    verification:
      - kind: type-check
        ref: "npx tsc --noEmit"
        status: pass
  - deliverable: "Budget settings in Account screen"
    verification:
      - kind: type-check
        ref: "npx tsc --noEmit"
        status: pass
  - deliverable: "Budget data persisted to Firestore"
    verification:
      - kind: manual
        ref: "QR test on device"
        status: pass
requirements-completed: [BDGT-01, BDGT-02, BDGT-03, BDGT-04, BDGT-05, BDGT-06, BDGT-07, NFR-08]
duration: ~20min
completed: "2026-08-09"
status: complete
---
