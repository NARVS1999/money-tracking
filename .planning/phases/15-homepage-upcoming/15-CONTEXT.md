# Phase 15: Homepage — Upcoming Indicators - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Home screen shows "Upcoming Expenses" (yellow-red theme) and "Upcoming Income" (yellow-blue theme) sections listing active scheduled entries with next occurrence date, between the quick-action buttons and the chart sections. UpcomingSection component + theme tokens; taps navigate to ScheduledEntryForm edit mode. Sections hidden when empty.
</domain>

<decisions>
## Implementation Decisions

### UpcomingSection Component
- Two sections: expenses then income, ordered next-occurrence ascending (soonest first), null-next entries last by start date
- Card: yellow bg rgba(248,197,25,0.08), border rgba(248,197,25,0.15); expense accent #DC2626 (red), income accent #45C0CF (teal)
- Row reuse: ScheduledEntryRow visual contract (44px icon, primary/secondary lines, tabular amount) with locked deltas — themed amount color (teal on Home, not green #16A34A) and tap-only rows (no Swipeable — management stays in Export tab)
- No CTA, no subtotal badge — informational indicators only
- Empty state = absence: section returns null at zero active entries (HOME-UP-05); both-zero leaves Home exactly as v1.1
- No per-section loading/error UI — SQLite-synchronous provider, degrade-to-hidden

### HomeScreen Integration
- Import UpcomingSection + useScheduledEntries; filter active by type
- Render between quick-action buttons and chart sections
- onTapItem → navigate to ScheduledEntryForm edit mode

### Theme Tokens
- New: upcomingExpenseBg, upcomingExpenseBorder, upcomingIncomeBg, upcomingIncomeBorder (distinct names, same yellow values — may diverge later)

### the agent's Discretion
Any visual details not covered above are at the agent's discretion using the UI-SPEC (15-UI-SPEC.md) and design tokens (src/theme/tokens.ts).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/screens/HomeScreen.tsx — quick-action buttons + chart sections layout
- src/components/ScheduledEntryRow.tsx (Phase 14) — row contract (tap-only variant on Home)
- src/scheduled/ScheduledEntriesProvider.tsx (Phase 13) — useScheduledEntries hook
- src/theme/tokens.ts — design tokens (add upcoming colors)
- src/components/CategorySection.tsx — section styling pattern

### Established Patterns
- Section components with title + row list; design tokens from src/theme/tokens.ts
- Provider context consumption via hooks; navigation via Stack Navigator (EntryForm/ScheduledEntryForm modal)

### Integration Points
- HomeScreen.tsx — section insertion between quick actions and charts
- ScheduledEntryForm edit navigation (Phase 14 pattern, passes type)

</code_context>

<specifics>
## Specific Ideas

Follow the UI-SPEC design contract (15-UI-SPEC.md) exactly — it was approved 6/6 by the UI checker.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>
