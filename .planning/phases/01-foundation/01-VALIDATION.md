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
| **Config file** | `jest.config.js` (root, after Wave 0 install) |
| **Quick run command** | `npx jest --watch=false` |
| **Full suite command** | `npx jest --watch=false` + `npx tsc --noEmit` + `npx expo lint` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --watch=false`
- **After every plan wave:** Run `npx jest --watch=false` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | 01 | 1 | NFR-03 | T-1-01 / — | money.js formats cents only | unit | `npx jest money` | ❌ W0 | ⬜ pending |
| (filled by planner) | 01 | 1 | NFR-04 | — | dates.js local YYYY-MM-DD only | unit | `npx jest dates` | ❌ W0 | ⬜ pending |
| (filled by planner) | 01 | 1 | AUTH-03 | T-1-02 / — | error mapping to "Email or password is wrong" | unit | `npx jest auth` | ❌ W0 | ⬜ pending |
| (filled by planner) | 01 | 1 | NFR-01 | T-1-03 / — | uid filter on every query | unit | `npx jest queries` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/money.test.ts` — integer-cents formatting/parsing (NFR-03)
- [ ] `__tests__/dates.test.ts` — local "YYYY-MM-DD" helpers (NFR-04)
- [ ] `__tests__/auth-errors.test.ts` — Firebase error-code → UI copy mapping (AUTH-03)
- [ ] `__tests__/queries.test.ts` — every query builder carries uid filter (NFR-01)
- [ ] jest-expo + jest deps installed (`npx expo install jest-expo jest`)

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
