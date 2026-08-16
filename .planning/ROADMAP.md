# Roadmap: Money Tracking v1.3

**Milestone:** v1.3 — End-to-End Testing
**Created:** 2026-08-16
**Granularity:** Standard

## Phases

- [ ] **Phase 16: Test Infrastructure & Auth** - Maestro setup and authentication flow tests
- [ ] **Phase 17: Entry Management Tests** - Expense and income CRUD test coverage
- [ ] **Phase 18: Category Tests** - Category management test coverage
- [ ] **Phase 19: Export Tests** - PDF, Excel, CSV export test coverage
- [ ] **Phase 20: Navigation Tests** - Tab and screen navigation test coverage
- [ ] **Phase 21: Offline & Sync Tests** - Data persistence and sync test coverage
- [ ] **Phase 22: Recurring Entries Tests** - Scheduled entries test coverage

## Phase Details

### Phase 16: Test Infrastructure & Auth
**Goal**: E2E test framework is operational and auth flows are validated
**Depends on**: Nothing (first phase)
**Requirements**: E2E-INFR-01, E2E-INFR-02, E2E-AUTH-01, E2E-AUTH-02
**Success Criteria** (what must be TRUE):
  1. Maestro tests can be executed against Android emulator
  2. Test data seeding utilities work consistently
  3. User can sign in with valid credentials via E2E test
  4. User can sign up with new account via E2E test
**Plans**: TBD

### Phase 17: Entry Management Tests
**Goal**: All entry CRUD operations are validated through E2E tests
**Depends on**: Phase 16
**Requirements**: E2E-ENTR-01, E2E-ENTR-02, E2E-ENTR-03, E2E-ENTR-04
**Success Criteria** (what must be TRUE):
  1. User can create expense entry and see it in list
  2. User can create income entry and see it in list
  3. User can edit existing entry and changes persist
  4. User can delete entry and it removes from list
**Plans**: TBD

### Phase 18: Category Tests
**Goal**: Category management operations are validated through E2E tests
**Depends on**: Phase 16
**Requirements**: E2E-CATG-01, E2E-CATG-02, E2E-CATG-03, E2E-CATG-04
**Success Criteria** (what must be TRUE):
  1. User can create new category and it appears in list
  2. User can view all categories in category management screen
  3. User can edit category name and changes persist
  4. User can delete category when it has no entries
**Plans**: TBD

### Phase 19: Export Tests
**Goal**: All export formats are validated through E2E tests
**Depends on**: Phase 17
**Requirements**: E2E-EXPT-01, E2E-EXPT-02, E2E-EXPT-03, E2E-EXPT-04
**Success Criteria** (what must be TRUE):
  1. User can generate PDF export and file is created
  2. User can generate Excel export and file is created
  3. User can generate CSV export and file is created
  4. User can share exported file via system share dialog
**Plans**: TBD

### Phase 20: Navigation Tests
**Goal**: App navigation flows are validated through E2E tests
**Depends on**: Phase 16
**Requirements**: E2E-NAVG-01, E2E-NAVG-02, E2E-NAVG-03
**Success Criteria** (what must be TRUE):
  1. User can switch between all tabs and correct screen appears
  2. User can navigate between screens via buttons and links
  3. User can use back navigation to return to previous screen
**Plans**: TBD

### Phase 21: Offline & Sync Tests
**Goal**: Offline behavior and data sync are validated through E2E tests
**Depends on**: Phase 17
**Requirements**: E2E-OFFL-01, E2E-OFFL-02
**Success Criteria** (what must be TRUE):
  1. Data persists when app is killed and restarted
  2. Data syncs to cloud when app comes back online
**Plans**: TBD

### Phase 22: Recurring Entries Tests
**Goal**: Recurring entry functionality is validated through E2E tests
**Depends on**: Phase 17
**Requirements**: E2E-RCRG-01, E2E-RCRG-02, E2E-RCRG-03, E2E-INFR-03
**Success Criteria** (what must be TRUE):
  1. User can create recurring entry template
  2. User can view list of recurring templates
  3. User can manage recurring schedule (frequency, end date)
  4. CI/CD pipeline runs E2E tests automatically
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 16. Test Infrastructure & Auth | 0/2 | Not started | - |
| 17. Entry Management Tests | 0/1 | Not started | - |
| 18. Category Tests | 0/1 | Not started | - |
| 19. Export Tests | 0/1 | Not started | - |
| 20. Navigation Tests | 0/1 | Not started | - |
| 21. Offline & Sync Tests | 0/1 | Not started | - |
| 22. Recurring Entries Tests | 0/1 | Not started | - |

---
*Roadmap created: 2026-08-16*