# Client-Detail.tsx Refactoring Plan

## Executive Summary

The `client/src/pages/client-detail.tsx` file is currently **9,347 lines** - a critical "god component" that violates single-responsibility principles and makes the codebase difficult to maintain, test, and develop. This document outlines a staged refactoring approach with clear success criteria and testing requirements for each phase.

---

## ⚠️ TESTING PREREQUISITES - READ BEFORE EACH BROWSER TEST SESSION

### Login Credentials
- **URL:** Root page (`/`)
- **Tab:** Password tab
- **Email:** `admin@example.com`
- **Password:** `admin123`

### Known Bugs
1. **Projects Loading Bug:** Sometimes projects do not load on the client detail page
   - **Workaround:** Refresh the browser and restart the testing session
   - **Impact:** May affect Projects tab and service-related project lists

### Pre-Test Checklist
Before each browser testing session:
- [ ] Ensure you're logged out or in a fresh session
- [ ] Navigate to root page `/`
- [ ] Select Password tab
- [ ] Login with admin@example.com / admin123
- [ ] If projects don't load, refresh browser and restart test session

---

## Current State Analysis

### File Statistics
- **Total Lines:** 9,347
- **Internal Components:** 21 function components defined inline
- **Main Tabs:** 8 (Overview, Services, Projects, Communications, Chronology, Documents, Tasks, Risk)
- **Imports:** 55+ imports from various libraries and components
- **State Variables:** 30+ useState hooks in main component
- **Queries:** 15+ useQuery hooks
- **Mutations:** 20+ useMutation hooks

### Internal Components Identified (by line count)

| Component | Lines | Purpose |
|-----------|-------|---------|
| `CommunicationsTimeline` | ~1,200 | Communications tab content with email/SMS/call dialogs |
| `PersonTabbedView` | ~600 | Person card with tabbed interface for viewing/editing |
| `PersonEditForm` | ~550 | Full person editing form |
| `PersonViewMode` | ~500 | Read-only person view with inline editing |
| `AddPersonModal` | ~550 | Add new person dialog |
| `AddServiceModal` | ~700 | Service assignment dialog |
| `EditServiceModal` | ~300 | Edit service dialog |
| `EditableServiceDetails` | ~200 | Inline service details editing |
| `ProjectsList` | ~200 | Projects table component |
| `CompanyCreationForm` | ~130 | Company creation form |
| `CallDialog` | ~180 | RingCentral call dialog |
| `PortalStatusColumn` | ~180 | Portal access status and actions |
| `ClientDetail` (main) | ~2,700 | Main page component |

### Utility Functions
- `formatPersonName()` - Name formatting (line 57)
- `formatDate()` - Date formatting (line 76)
- `formatBirthDate()` - Birth date formatting (line 90)
- `maskIdentifier()` - Mask sensitive data (line 1761)

### Already Extracted Components (Reusable)
These components already exist and are properly imported:
- `RiskAssessmentTab` - Risk assessments
- `ClientNotificationsView` - Notifications management
- `ClientChronology` - Activity timeline
- `DocumentFolderView` - Documents management
- `SignatureRequestsPanel` - E-signature requests
- `TagManager` - Client tags
- `AddressLookup` / `AddressMap` - Address components
- `CommunicationCard` - Communication display card
- `EmailThreadViewer` - Email thread viewer
- `CreateTaskDialog` - Internal task creation

---

## Refactoring Strategy

### Target Architecture

```
client/src/pages/client-detail/
├── index.tsx                          # Re-export (for clean imports)
├── ClientDetailPage.tsx               # Main container (~300 lines)
│
├── components/
│   ├── ClientHeader.tsx               # Page header with client info
│   ├── ClientTabNavigation.tsx        # Desktop/Mobile tab navigation
│   │
│   ├── tabs/
│   │   ├── OverviewTab.tsx            # Company details & people section
│   │   ├── ServicesTab.tsx            # Services management
│   │   ├── ProjectsTab.tsx            # Open/completed projects
│   │   ├── CommunicationsTab.tsx      # Communications timeline
│   │   ├── ChronologyTab.tsx          # Client chronology (wrapper)
│   │   ├── DocumentsTab.tsx           # Documents & signatures
│   │   ├── TasksTab.tsx               # Internal tasks & client requests
│   │   └── RiskNotificationsTab.tsx   # Risk & notifications (wrapper)
│   │
│   ├── people/
│   │   ├── PeopleSection.tsx          # People list and management
│   │   ├── PersonCard.tsx             # Individual person display
│   │   ├── PersonTabbedView.tsx       # Tabbed person details
│   │   ├── PersonViewMode.tsx         # Read-only person view
│   │   └── PersonEditForm.tsx         # Person editing form
│   │
│   ├── services/
│   │   ├── ServicesList.tsx           # Services display list
│   │   ├── ServiceRow.tsx             # Individual service row
│   │   ├── ServiceDetails.tsx         # Service details panel
│   │   └── PersonalServicesList.tsx   # Personal services section
│   │
│   ├── communications/
│   │   ├── CommunicationsTimeline.tsx # Main timeline component
│   │   ├── CommunicationFilters.tsx   # Filter controls
│   │   ├── CommunicationList.tsx      # List/table display
│   │   └── dialogs/
│   │       ├── AddCommunicationDialog.tsx
│   │       ├── SMSDialog.tsx
│   │       ├── EmailDialog.tsx
│   │       ├── CallDialog.tsx
│   │       └── MessageThreadDialog.tsx
│   │
│   └── projects/
│       ├── ProjectsList.tsx           # Projects table
│       ├── OpenProjectRow.tsx         # Open project row
│       └── CompletedProjectRow.tsx    # Completed project row
│
├── forms/
│   ├── AddPersonModal.tsx             # Add person dialog
│   ├── AddServiceModal.tsx            # Add service dialog
│   ├── EditServiceModal.tsx           # Edit service dialog
│   └── CompanyCreationForm.tsx        # Company creation form
│
├── hooks/
│   ├── useClientData.ts               # Client data fetching
│   ├── useClientPeople.ts             # People operations
│   ├── useClientServices.ts           # Services operations
│   ├── useClientProjects.ts           # Projects queries
│   ├── useClientCommunications.ts     # Communications operations
│   └── useClientDocuments.ts          # Documents operations
│
└── utils/
    ├── formatters.ts                  # Name/date formatting utilities
    └── types.ts                       # Shared types for client-detail
```

---

## Staged Refactoring Plan

### Stage 1: Foundation - Utilities & Types Extraction
**Estimated Effort:** 2-3 hours  
**Risk Level:** Low

#### Tasks
1. Create `client-detail/utils/formatters.ts`
   - Extract `formatPersonName()`
   - Extract `formatDate()`
   - Extract `formatBirthDate()`
   - Extract `maskIdentifier()`

2. Create `client-detail/utils/types.ts`
   - Extract shared types (`CommunicationWithRelations`, `EnhancedClientService`, etc.)
   - Export type aliases for commonly used type combinations

3. Update imports in `client-detail.tsx` to use new utility files

#### Success Criteria
- [ ] All utility functions work identically (test with sample data)
- [ ] No TypeScript errors after refactor
- [ ] Application loads and displays client detail page correctly
- [ ] All date/name formatting displays correctly

#### Testing Required
- Manual verification of client detail page loading
- Verify name formatting (e.g., "SMITH, John" → "John Smith")
- Verify date formatting in various contexts
- Run existing test suite (if any)

---

### Stage 2: Directory Structure & Index Setup
**Estimated Effort:** 1 hour  
**Risk Level:** Low

#### Tasks
1. Create directory structure:
   ```
   client/src/pages/client-detail/
   ├── index.tsx
   ├── components/
   ├── forms/
   ├── hooks/
   └── utils/
   ```

2. Move utility files from Stage 1 into `utils/`

3. Create `index.tsx` that re-exports the main component for backward compatibility

#### Success Criteria
- [ ] Directory structure exists
- [ ] Existing imports still work via `@/pages/client-detail`
- [ ] Application builds without errors

#### Testing Required
- Application build verification
- Basic page load test

---

### Stage 3: Extract Simple Row Components
**Estimated Effort:** 2-3 hours  
**Risk Level:** Low

#### Tasks
1. Create `components/projects/OpenProjectRow.tsx`
   - Extract `OpenProjectRow` component
   - Keep same props interface

2. Create `components/projects/CompletedProjectRow.tsx`
   - Extract `CompletedProjectRow` component

3. Create `components/projects/ProjectsList.tsx`
   - Extract `ProjectsList` component
   - Include both row components

4. Create `components/services/ServiceProjectsList.tsx`
   - Extract `ServiceProjectsList` component

5. Create `components/PortalStatusColumn.tsx`
   - Extract portal status display and actions

6. Create `components/ProjectLink.tsx`
   - Extract simple project link component

#### Success Criteria
- [ ] All extracted components render correctly
- [ ] Projects tab displays open and completed projects
- [ ] Service-specific projects display correctly
- [ ] Portal status indicators work correctly

#### Testing Required
- Navigate to Projects tab and verify both sections
- Click on project links and verify navigation
- Test portal invite/QR code generation buttons

---

### Stage 4: Extract People Components
**Estimated Effort:** 4-5 hours  
**Risk Level:** Medium

#### Tasks
1. Create `components/people/PersonEditForm.tsx`
   - Extract `PersonEditForm` component (~550 lines)
   - Ensure form validation works

2. Create `components/people/PersonViewMode.tsx`
   - Extract `PersonViewMode` component (~500 lines)
   - Maintain inline edit triggers

3. Create `components/people/PersonTabbedView.tsx`
   - Extract `PersonTabbedView` component (~600 lines)
   - Uses PersonViewMode and PersonEditForm

4. Create `forms/AddPersonModal.tsx`
   - Extract `AddPersonModal` component (~550 lines)
   - Maintain form validation and submission

5. Create `components/people/PeopleSection.tsx`
   - Extract the "Connected People" section from Overview tab
   - Orchestrates person list and add person button

#### Success Criteria
- [ ] People section displays in Overview tab
- [ ] Add Person modal works (form validation, submission)
- [ ] Person inline editing works (view/edit toggle)
- [ ] Person tabbed view displays all tabs correctly
- [ ] Address lookup integration works
- [ ] Phone number formatting (UK mobile) works correctly

#### Testing Required
- Add a new person via modal
- Edit existing person details inline
- Toggle between person view tabs
- Test address lookup functionality
- Verify primary phone/email fields update correctly

---

### Stage 5: Extract Service Components
**Estimated Effort:** 4-5 hours  
**Risk Level:** Medium

#### Tasks
1. Create `components/services/ServiceRow.tsx`
   - Extract `ClientServiceRow` component

2. Create `components/services/EditableServiceDetails.tsx`
   - Extract UDF editing functionality

3. Create `forms/AddServiceModal.tsx`
   - Extract `AddServiceModal` (~700 lines)
   - Maintain service/role selection logic

4. Create `forms/EditServiceModal.tsx`
   - Extract `EditServiceModal` (~300 lines)

5. Create `components/services/ServicesList.tsx`
   - Extract client services list

6. Create `components/services/PersonalServicesList.tsx`
   - Extract personal services section

7. Create `components/tabs/ServicesTab.tsx`
   - Compose all service components
   - Handle company vs individual client type display

#### Success Criteria
- [ ] Services tab displays correctly
- [ ] Add Service modal works with all options
- [ ] Service UDF editing works
- [ ] Personal services display for individual clients
- [ ] Service role assignments work correctly

#### Testing Required
- Add a new service to a client
- Edit service UDF values
- Test personal service assignment
- Verify role assignments display

---

### Stage 6: Extract Communications Components (Largest)
**Estimated Effort:** 6-8 hours  
**Risk Level:** High

#### Tasks
1. Create `components/communications/CommunicationFilters.tsx`
   - Extract filter dropdown component

2. Create `components/communications/dialogs/AddCommunicationDialog.tsx`
   - Extract add communication modal

3. Create `components/communications/dialogs/SMSDialog.tsx`
   - Extract SMS sending dialog

4. Create `components/communications/dialogs/EmailDialog.tsx`
   - Extract email sending dialog (with TiptapEditor)

5. Create `components/communications/dialogs/CallDialog.tsx`
   - Extract RingCentral call dialog

6. Create `components/communications/dialogs/MessageThreadDialog.tsx`
   - Extract instant message thread creation

7. Create `components/communications/CommunicationList.tsx`
   - Extract table/card view logic

8. Create `components/communications/CommunicationsTimeline.tsx`
   - Compose all communication components
   - Handle combined timeline (comms + threads + emails)

9. Create `components/tabs/CommunicationsTab.tsx`
   - Wrapper for communications timeline

#### Success Criteria
- [ ] Communications tab displays all types (calls, notes, SMS, email, threads)
- [ ] Filter dropdown works correctly
- [ ] Add Communication dialog works
- [ ] Send SMS dialog works (with person selection)
- [ ] Send Email dialog works (with rich text editor)
- [ ] View communication detail modal works
- [ ] Email thread viewer integration works

#### Testing Required
- View communications timeline
- Filter by type
- Add a note
- Send SMS (verify person mobile validation)
- Send email (verify rich text, signature appending)
- View email thread
- Click to call (RingCentral integration)

---

### Stage 7: Extract Tab Components
**Estimated Effort:** 3-4 hours  
**Risk Level:** Medium

#### Tasks
1. Create `components/tabs/OverviewTab.tsx`
   - Company details section
   - People section
   - Connected companies (for individuals)

2. Create `components/tabs/ProjectsTab.tsx`
   - Open projects section
   - Completed projects section

3. Create `components/tabs/ChronologyTab.tsx`
   - Wrapper for existing ClientChronology component

4. Create `components/tabs/DocumentsTab.tsx`
   - Client docs sub-tab
   - Signed docs sub-tab
   - Signature requests panel

5. Create `components/tabs/TasksTab.tsx`
   - Internal tasks section
   - Client requests section

6. Create `components/tabs/RiskNotificationsTab.tsx`
   - Wrapper for RiskAssessmentTab and ClientNotificationsView
   - Handle risk/notifications toggle

#### Success Criteria
- [ ] All 8 tabs render correctly
- [ ] Tab switching works (desktop and mobile)
- [ ] Tab content matches current behavior
- [ ] Nested tabs work (Services, Documents)

#### Testing Required
- Navigate through all tabs
- Test mobile tab navigation (swipe, arrows)
- Verify nested tabs in Services and Documents tabs

---

### Stage 8: Extract Custom Hooks
**Estimated Effort:** 4-5 hours  
**Risk Level:** Medium

#### Tasks
1. Create `hooks/useClientData.ts`
   - Extract main client query
   - Client update mutation
   - Related queries (services, people, etc.)

2. Create `hooks/useClientPeople.ts`
   - People queries
   - Create/update/delete mutations
   - Company connections for individuals

3. Create `hooks/useClientServices.ts`
   - Client services queries
   - People services queries
   - Service mutations

4. Create `hooks/useClientProjects.ts`
   - Projects query
   - Task instances query

5. Create `hooks/useClientCommunications.ts`
   - Communications query
   - Message threads query
   - Email threads query
   - Communication mutations (add, send SMS, send email)

6. Create `hooks/useClientDocuments.ts`
   - Documents query
   - Document delete mutation

#### Success Criteria
- [ ] All data fetching works correctly
- [ ] Cache invalidation works properly
- [ ] Mutations trigger correct query refetches
- [ ] Loading states display correctly

#### Testing Required
- Verify all data loads correctly
- Test mutation → cache invalidation flow
- Verify loading skeletons appear during fetches

---

### Stage 9: Create Main Page Container
**Estimated Effort:** 3-4 hours  
**Risk Level:** Medium

#### Tasks
1. Create `components/ClientHeader.tsx`
   - Client name, company number, status badge
   - Formation date

2. Create `components/ClientTabNavigation.tsx`
   - Desktop grid tabs
   - Mobile carousel tabs with arrows
   - "More..." dropdown for Risk/Notifications

3. Create `ClientDetailPage.tsx`
   - Compose header, navigation, and tab content
   - Handle activeTab state
   - Handle riskView sub-state
   - Mobile responsiveness
   - Activity tracker integration

4. Update `index.tsx`
   - Re-export ClientDetailPage as default

5. Delete or archive original `client-detail.tsx`

#### Success Criteria
- [ ] Page renders identically to before
- [ ] URL routing works correctly
- [ ] Tab state persists correctly
- [ ] Mobile and desktop layouts work
- [ ] All functionality preserved

#### Testing Required
- Full end-to-end test of all features
- Mobile responsiveness test
- Tab navigation test
- Deep link testing (if applicable)

---

### Stage 10: Cleanup & Documentation
**Estimated Effort:** 2-3 hours  
**Risk Level:** Low

#### Tasks
1. Remove unused code from original file (if archived)
2. Add JSDoc comments to exported components
3. Update `replit.md` with new file structure
4. Create component storybook stories (optional)
5. Add unit tests for utility functions
6. Performance audit (check for unnecessary re-renders)

#### Success Criteria
- [ ] No dead code remains
- [ ] Components are documented
- [ ] All tests pass
- [ ] Performance is equal or better than before

#### Testing Required
- Run full test suite
- Performance profiling (React DevTools)
- Lighthouse audit for page load metrics

---

## Risk Mitigation

### High-Risk Areas
1. **Communications Timeline** - Largest component with many integrations (SMS, Email, RingCentral)
2. **Service Mutations** - Complex state management with role assignments
3. **Person Editing** - Multiple form fields with validation

### Mitigation Strategies
1. **Incremental Commits** - Commit after each successful extraction
2. **Feature Flags** - Consider using environment variable to switch between old/new
3. **Parallel Development** - Keep original file until fully validated
4. **Automated Testing** - Add tests before refactoring critical sections
5. **User Testing** - Test with real users after major stages

---

## Timeline Estimate

| Stage | Duration | Dependencies |
|-------|----------|--------------|
| Stage 1 | 2-3 hours | None |
| Stage 2 | 1 hour | Stage 1 |
| Stage 3 | 2-3 hours | Stage 2 |
| Stage 4 | 4-5 hours | Stage 3 |
| Stage 5 | 4-5 hours | Stage 4 |
| Stage 6 | 6-8 hours | Stage 5 |
| Stage 7 | 3-4 hours | Stage 6 |
| Stage 8 | 4-5 hours | Stage 7 |
| Stage 9 | 3-4 hours | Stage 8 |
| Stage 10 | 2-3 hours | Stage 9 |

**Total Estimated Time: 32-41 hours** (4-5 working days)

---

## Success Metrics

After refactoring, we should achieve:

1. **File Size Reduction**
   - Main page component: <300 lines
   - Largest tab component: <500 lines
   - No single file >600 lines

2. **Code Organization**
   - Clear separation of concerns
   - Reusable components across pages
   - Testable individual units

3. **Developer Experience**
   - Faster IDE performance
   - Easier code navigation
   - Reduced merge conflicts
   - Faster onboarding for new developers

4. **Performance**
   - Lazy-loadable tab content
   - Reduced initial bundle size
   - Faster hot module replacement during development

---

## Post-Refactor Considerations

1. **Apply Pattern to Similar Pages**
   - `project-detail.tsx` (1,153 lines)
   - `person-detail.tsx` (1,199 lines)
   - `project-type-detail.tsx` (3,773 lines)

2. **Create Shared Component Library**
   - Many extracted components could be generalized for reuse
   - Consider creating a "detail page" pattern/template

3. **Performance Optimization**
   - Implement React.lazy() for tab content
   - Add React.memo() to pure components
   - Consider virtualization for long lists
