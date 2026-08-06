---
phase: 2
slug: categories
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.7.0 + jest-expo ~57.0.3 |
| **Config file** | `jest.config.js` (Phase 1, unchanged) |
| **Quick run command** | `npx jest src/categories --passWithNoTests` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest src/categories --passWithNoTests`
- **After every plan wave:** Run `npx jest` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CATS-02 | T-02-01 | addDoc includes uid in payload | unit | `npx jest src/categories/__tests__/CategoriesProvider.test.ts -t "uid"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | CATS-02 | T-02-02 | Duplicate name rejected case-insensitive | unit | `npx jest src/categories/__tests__/CategoriesProvider.test.ts -t "duplicate"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | CATS-04 | T-02-03 | In-use category delete blocked | unit | `npx jest src/categories/__tests__/CategoriesProvider.test.ts -t "delete guard"` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | CATS-03 | — | usageMap derived from entries snapshot | unit | `npx jest src/categories/__tests__/CategoriesProvider.test.ts -t "usage"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | CATS-01 | — | Two section groups with sticky headers rendered | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "sections"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | CATS-01 | — | Empty state per group ("No expense categories yet" / "No income categories yet") | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "empty state"` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | CATS-02 | — | Inline input adds category on submit | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "add"` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 2 | CATS-02 | — | Duplicate name shows "Already exists" error | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "duplicate error"` | ❌ W0 | ⬜ pending |
| 02-02-05 | 02 | 2 | CATS-03 | — | Usage count "N entries" per row | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "usage count"` | ❌ W0 | ⬜ pending |
| 02-02-06 | 02 | 2 | CATS-03 | — | Count shows "—" while loading | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "loading count"` | ❌ W0 | ⬜ pending |
| 02-02-07 | 02 | 2 | CATS-04 | — | In-use category: grey "In use" swipe, no delete | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "in use swipe"` | ❌ W0 | ⬜ pending |
| 02-02-08 | 02 | 2 | CATS-04 | — | Unused category: red "Delete" + Alert confirmation → delete | component | `npx jest src/screens/__tests__/CategoriesScreen.test.ts -t "delete confirmation"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/categories/__tests__/CategoriesProvider.test.ts` — covers CATS-02 (add/duplicate), CATS-04 (delete guard), NFR-01 (uid in documents)
- [ ] `src/screens/__tests__/CategoriesScreen.test.ts` — covers CATS-01 (groups), CATS-03 (usage counts), CATS-04 (swipe states)
- [ ] `npx expo install react-native-gesture-handler` — not installed yet
- [ ] jest mock for `react-native-gesture-handler`'s `Swipeable` export (jest-expo preset handles basic RN mocks)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Swipeable right-action width (80px) visual fit on device | CATS-04 | Gesture-based interaction — jest cannot simulate swipe gestures accurately | Open Expo Go on phone, swipe a category row left, verify action width and visual alignment |
| Categories tab keyboard behavior on iOS vs Android | CATS-02 | Keyboard interactions are platform-specific — jest mocking is unreliable | Open Categories tab, tap inline input, verify keyboard avoids input on both platforms |
| Gesture-handler install in Expo Go `npx expo install` | NFR-05 | Expo Go compatibility requires real install verification | Run `npx expo install react-native-gesture-handler`, verify no version mismatch, test in Expo Go |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
