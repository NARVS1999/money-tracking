---
phase: 2
slug: categories
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-08
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → Firestore | Category addDoc/deleteDoc writes cross this boundary; uid scoping enforced client-side (NFR-01) and server-side (rules deployed Phase 1) | category docs (uid, name, group, createdAt) |
| gesture layer | Swipeable from react-native-gesture-handler processes touch input at the native layer | touch coordinates, swipe velocity |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-2-01 | Information Disclosure | categoriesOf query (queries.ts) | high | mitigate | `where("uid","==",uid)` applied first in the uid-scoped builder (Phase 1, test-verified); server rules reject unscoped reads | closed |
| T-2-02 | Elevation of Privilege | addDoc payload (addCategory) | high | mitigate | `uid: user.uid` hardcoded in payload; screen has no direct Firestore access; server rules reject mismatched uid (test-verified) | closed |
| T-2-03 | Tampering | Category name text injection via inline input | medium | mitigate | Rendered in RN `<Text>` (escapes natively, no HTML/innerHTML); trimmed + case-normalized before comparison/storage | closed |
| T-2-04 | Denial of Service | Race: deleteCategory while entry added | low | accept | categoryInUse guard runs at delete time; `.catch()` surfaces transient 'Category is in use' error; no data loss | closed |
| T-2-05 | Information Disclosure | Memory leak from orphaned onSnapshot listeners | medium | mitigate | useEffect cleanup unsubscribes all three listeners; `[user]` dep array; test-verified (listener cleanup on sign-out) | closed |
| T-2-06 | Tampering | Swipeable gesture interception by compromised native module | low | accept | gesture-handler ~2.32.0 is a first-party Expo Go bundled module (Software Mansion, no postinstall scripts, RESEARCH Package Legitimacy Audit approved) | closed |
| T-2-SC | Tampering | npm installs (gesture-handler) | high | mitigate | Installed via `npx expo install` pinning ~2.32.0 (Expo Go bundled build), not npm latest; package audit approved | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-2-01 | T-2-04 | Delete-vs-add race window is milliseconds; worst case is a transient 'Category is in use' alert with no data loss | owner | 2026-08-08 |
| R-2-02 | T-2-06 | gesture-handler is canonical React Native infrastructure bundled in Expo Go; compromise risk negligible for a personal utility app | owner | 2026-08-08 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-08 | 7 | 7 | 0 | opencode (gsd-secure-phase, register from PLAN.md threat models) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-08
