---
phase: 1
slug: foundation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest-expo (~57.0.3, bundled with the blank-typescript template) |
| **Config file** | `package.json` `"jest": { "preset": "jest-expo" }` (set in 01-01 Task 3) |
| **Quick run command** | `npx jest --ci --silent` |
| **Full suite command** | `npx jest --ci --silent && npx tsc --noEmit && npx expo lint && npx expo-doctor` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --ci --silent`
- **After every plan wave:** Run `npx jest --ci --silent && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01-01 | 1 | NFR-05 | T-1-SC | scaffold + firebase singletons (memory cache) | smoke | `npx jest --ci --silent` | ❌ W0 | ⬜ pending |
| 01-01-T3 | 01-01 | 1 | NFR-05 | — | jest-expo infra + package.json pins | smoke | `npx tsc --noEmit && npx jest --ci --silent && npx expo-doctor` | ❌ W0 | ⬜ pending |
| 01-02-T1 | 01-02 | 2 | AUTH-03 | T-1-02 | error mapping to "Email or password is wrong" | unit | `npx jest --ci --silent src/auth` | ❌ W0 | ⬜ pending |
| 01-03-T1 | 01-03 | 2 | NFR-03 | T-1-01 | money.ts formats cents only | unit | `npx jest --ci --silent src/lib` | ❌ W0 | ⬜ pending |
| 01-03-T2 | 01-03 | 2 | NFR-01, NFR-04 | T-1-01 | dates.ts local YYYY-MM-DD; queries.ts uid filter | unit | `npx jest --ci --silent src/lib src/firebase` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/money-test.ts` — integer-cents formatting/parsing (NFR-03)
- [ ] `src/lib/__tests__/dates-test.ts` — local "YYYY-MM-DD" helpers (NFR-04)
- [ ] `src/auth/__tests__/auth-errors-test.ts` — Firebase error-code → UI copy mapping (AUTH-03)
- [ ] `src/firebase/__tests__/queries-test.ts` — every query builder carries uid filter (NFR-01)
- [ ] jest-expo + jest installed in 01-01 Task 3 (`npx expo install jest-expo jest "--" --dev`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| First launch lands on Sign In; wrong credentials show inline error and user stays | AUTH-01, AUTH-03 | Requires live Firebase project + device | Expo Go on phone → Sign In screen → wrong password → inline error |
| Session persists across app restart | AUTH-02 | Device restart behavior, real AsyncStorage | Sign in → kill app → reopen → lands on Home |
| uid-scoped isolation with second account | NFR-01, NFR-06 | Needs deployed rules + 2nd Firebase account | Second account cannot read default account's data |
| Rules reject cross-account access | NFR-06 | Needs deployed rules in console | Attempt uid-spoofed query from console/device |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
