# Requirements: Money Tracking

**Defined:** 2026-08-16
**Core Value:** Logging a money entry must take under 10 seconds — from opening the app to saving — and the data must be there when the phone is offline.

## v1.3 Requirements

Requirements for E2E testing milestone. Each maps to roadmap phases.

### Auth Tests

- [ ] **E2E-AUTH-01**: User can sign in with email and password
- [ ] **E2E-AUTH-02**: User can sign up with new account

### Entry Tests

- [ ] **E2E-ENTR-01**: User can create expense entry
- [ ] **E2E-ENTR-02**: User can create income entry
- [ ] **E2E-ENTR-03**: User can edit existing entry
- [ ] **E2E-ENTR-04**: User can delete existing entry

### Category Tests

- [ ] **E2E-CATG-01**: User can create new category
- [ ] **E2E-CATG-02**: User can view category list
- [ ] **E2E-CATG-03**: User can edit category
- [ ] **E2E-CATG-04**: User can delete category (when empty)

### Export Tests

- [ ] **E2E-EXPT-01**: User can generate PDF export
- [ ] **E2E-EXPT-02**: User can generate Excel export
- [ ] **E2E-EXPT-03**: User can generate CSV export
- [ ] **E2E-EXPT-04**: User can share exported file

### Navigation Tests

- [ ] **E2E-NAVG-01**: User can switch between tabs
- [ ] **E2E-NAVG-02**: User can navigate between screens
- [ ] **E2E-NAVG-03**: User can use back navigation

### Offline Tests

- [ ] **E2E-OFFL-01**: Data persists when app is killed
- [ ] **E2E-OFFL-02**: Data syncs when app comes back online

### Recurring Tests

- [ ] **E2E-RCRG-01**: User can create recurring entry template
- [ ] **E2E-RCRG-02**: User can view recurring templates
- [ ] **E2E-RCRG-03**: User can manage recurring schedule

### Infrastructure

- [ ] **E2E-INFR-01**: Maestro test framework setup
- [ ] **E2E-INFR-02**: Test data seeding utilities
- [ ] **E2E-INFR-03**: CI/CD integration for test runs

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Testing

- **E2E-ADV-01**: Performance testing (entry creation under 10s)
- **E2E-ADV-02**: Stress testing (concurrent user simulation)
- **E2E-ADV-03**: Visual regression testing

## Out of Scope

| Feature | Reason |
|---------|--------|
| iOS testing | Android emulator only for now |
| Browser testing | Mobile-only app |
| Load testing | Personal use, low traffic |
| Security penetration testing | Out of scope for E2E milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| E2E-AUTH-01 | Phase 16 | Pending |
| E2E-AUTH-02 | Phase 16 | Pending |
| E2E-ENTR-01 | Phase 17 | Pending |
| E2E-ENTR-02 | Phase 17 | Pending |
| E2E-ENTR-03 | Phase 17 | Pending |
| E2E-ENTR-04 | Phase 17 | Pending |
| E2E-CATG-01 | Phase 18 | Pending |
| E2E-CATG-02 | Phase 18 | Pending |
| E2E-CATG-03 | Phase 18 | Pending |
| E2E-CATG-04 | Phase 18 | Pending |
| E2E-EXPT-01 | Phase 19 | Pending |
| E2E-EXPT-02 | Phase 19 | Pending |
| E2E-EXPT-03 | Phase 19 | Pending |
| E2E-EXPT-04 | Phase 19 | Pending |
| E2E-NAVG-01 | Phase 20 | Pending |
| E2E-NAVG-02 | Phase 20 | Pending |
| E2E-NAVG-03 | Phase 20 | Pending |
| E2E-OFFL-01 | Phase 21 | Pending |
| E2E-OFFL-02 | Phase 21 | Pending |
| E2E-RCRG-01 | Phase 22 | Pending |
| E2E-RCRG-02 | Phase 22 | Pending |
| E2E-RCRG-03 | Phase 22 | Pending |
| E2E-INFR-01 | Phase 16 | Pending |
| E2E-INFR-02 | Phase 16 | Pending |
| E2E-INFR-03 | Phase 22 | Pending |

**Coverage:**
- v1.3 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-16*
*Last updated: 2026-08-16 after initial definition*