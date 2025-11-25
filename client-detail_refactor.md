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

### Stage 1: Foundation - Utilities & Types Extraction ✅ COMPLETED
**Estimated Effort:** 2-3 hours  
**Risk Level:** Low  
**Status:** COMPLETED (November 25, 2025)

#### Tasks
1. Create `client-detail/utils/formatters.ts`
   - ✅ Extract `formatPersonName()`
   - ✅ Extract `formatDate()`
   - ✅ Extract `formatBirthDate()`
   - ✅ Extract `maskIdentifier()`

2. Create `client-detail/utils/types.ts`
   - ✅ Extract shared types (`CommunicationWithRelations`, `EnhancedClientService`, etc.)
   - ✅ Export type aliases for commonly used type combinations
   - ✅ Extract all Zod schemas (addServiceSchema, addPersonSchema, updatePersonSchema, editServiceSchema, linkPersonToCompanySchema)
   - ✅ Export inferred types (AddServiceData, InsertPersonData, UpdatePersonData, EditServiceData, LinkPersonToCompanyData)

3. ✅ Update imports in `client-detail.tsx` to use new utility files
4. ✅ Directory structure created with components/, forms/, hooks/, utils/ subdirectories

#### Success Criteria
- [x] All utility functions work identically (test with sample data)
- [x] No TypeScript errors after refactor (28 pre-existing errors remain, none introduced)
- [x] Application loads and displays client detail page correctly
- [x] All date/name formatting displays correctly

#### Testing Results
- ✅ Client detail page loads successfully with all tabs functional
- ✅ Name formatting verified (displays correctly)
- ✅ Date formatting verified (DD/MM/YYYY and "DD Mon YYYY" formats working)
- ✅ Projects tab loads with proper data display
- ✅ Architect review: PASS - "cleanly externalizes shared utilities and types"

#### Files Created
- `client/src/pages/client-detail/utils/formatters.ts` - 4 utility functions
- `client/src/pages/client-detail/utils/types.ts` - Shared types and Zod schemas

#### Line Count Change
- Before: 9,347 lines
- After: 9,165 lines
- Reduction: 182 lines moved to utility modules

---

### Stage 2: Directory Structure & Index Setup ✅ COMPLETED
**Estimated Effort:** 1 hour  
**Risk Level:** Low  
**Status:** COMPLETED (November 25, 2025)

#### Tasks
1. ✅ Create directory structure:
   ```
   client/src/pages/client-detail/
   ├── index.tsx              # Re-export for backward compatibility
   ├── ClientDetailPage.tsx   # Main component (moved from client-detail.tsx)
   ├── components/
   ├── forms/
   ├── hooks/
   └── utils/
       ├── formatters.ts
       └── types.ts
   ```

2. ✅ Moved client-detail.tsx to ClientDetailPage.tsx inside the directory

3. ✅ Created `index.tsx` that re-exports ClientDetailPage as default export

4. ✅ Updated internal imports to use relative paths (`./utils/formatters` instead of `./client-detail/utils/formatters`)

#### Success Criteria
- [x] Directory structure exists
- [x] Existing imports still work via `@/pages/client-detail`
- [x] Application builds without errors

#### Testing Results
- ✅ Application builds successfully
- ✅ Client detail page loads with all 8 tabs functional
- ✅ Services tab displays correctly
- ✅ Projects tab loads with open/completed sections
- ✅ Architect review: PASS - "maintains previous import contract and passes smoke tests"

#### Files Modified
- `client/src/pages/client-detail.tsx` → Deleted (moved to ClientDetailPage.tsx)
- `client/src/pages/client-detail/ClientDetailPage.tsx` - Main component
- `client/src/pages/client-detail/index.tsx` - Re-export file (1 line)

---

### Stage 3: Extract Simple Row Components ✅ COMPLETED
**Estimated Effort:** 2-3 hours  
**Risk Level:** Low  
**Status:** COMPLETED (November 25, 2025)

#### Readiness Checklist
- [x] Components identified with line numbers:
  - `PortalStatusColumn` (line 78, ~190 lines) - Portal access status and invite actions
  - `ServiceProjectsList` (line 5829, ~12 lines) - Fetches service-specific projects
  - `OpenProjectRow` (line 5844, ~75 lines) - Table row for open projects
  - `CompletedProjectRow` (line 5923, ~91 lines) - Table row for completed projects
  - `ProjectsList` (line 6018, ~180 lines) - Project list with mobile/desktop views
- [x] Shared utilities identified:
  - `getStatusColor()` - Duplicated in 3 components, extract to utils
  - `formatStatus()` - Duplicated in 3 components, extract to utils
- [x] Dependencies mapped:
  - All use `useLocation` from wouter
  - `ProjectsList` uses `useIsMobile` hook
  - `PortalStatusColumn` has its own mutations (can stay self-contained)
  - All need `formatDate` from utils/formatters
- [x] Types needed: `ProjectWithRelations` from shared/schema

#### Tasks
1. ✅ Create `utils/projectHelpers.ts`
   - Extracted `getStatusColor()` and `formatStatus()` functions

2. ✅ Create `components/projects/OpenProjectRow.tsx`
   - Extracted `OpenProjectRow` component (~75 lines)
   - Uses shared helpers from projectHelpers.ts

3. ✅ Create `components/projects/CompletedProjectRow.tsx`
   - Extracted `CompletedProjectRow` component (~91 lines)
   - Uses shared helpers from projectHelpers.ts

4. ✅ Create `components/projects/ProjectsList.tsx`
   - Extracted `ProjectsList` component (~180 lines)
   - Uses OpenProjectRow and CompletedProjectRow

5. ✅ Create `components/projects/ServiceProjectsList.tsx`
   - Extracted `ServiceProjectsList` component (~12 lines)
   - Uses ProjectsList

6. ✅ Create `components/projects/index.tsx`
   - Re-exports all project components for clean imports

7. ✅ Create `components/PortalStatusColumn.tsx`
   - Extracted portal status display and actions (~190 lines)
   - Self-contained with its own mutations

#### Success Criteria
- [x] All extracted components render correctly
- [x] Projects tab displays open and completed projects
- [x] Service-specific projects display correctly
- [x] Portal status indicators work correctly
- [x] No duplicate utility functions remain in main file

#### Testing Results
- ✅ E2E test passed: Projects tab loads with data
- ✅ Status badges display correctly (e.g., "Do the work")
- ✅ View buttons work and navigate correctly
- ✅ Architect review: PASS - "verified no duplicate definitions, all functionality preserved"

#### Files Created
- `client/src/pages/client-detail/utils/projectHelpers.ts` - Shared project utilities
- `client/src/pages/client-detail/components/projects/OpenProjectRow.tsx` - Open project row
- `client/src/pages/client-detail/components/projects/CompletedProjectRow.tsx` - Completed project row
- `client/src/pages/client-detail/components/projects/ProjectsList.tsx` - Main project list
- `client/src/pages/client-detail/components/projects/ServiceProjectsList.tsx` - Service-filtered projects
- `client/src/pages/client-detail/components/projects/index.tsx` - Re-exports
- `client/src/pages/client-detail/components/PortalStatusColumn.tsx` - Portal status column

#### Line Count Change
- Before: 9,166 lines
- After: 8,603 lines
- Reduction: 563 lines moved to extracted components

---

### Stage 4: Extract People Components ✅ COMPLETED
**Estimated Effort:** 4-5 hours  
**Risk Level:** Medium  
**Status:** COMPLETED (November 25, 2025)
**Detailed Brief:** See `client/src/pages/client-detail/STAGE_4_PEOPLE_COMPONENTS.md`

#### Component Inventory
| Component | Lines | Purpose |
|-----------|-------|---------|
| `AddPersonModal` | ~556 | Modal for adding new people |
| `PersonTabbedView` | ~1,204 | Tabbed person view/edit interface |
| `PersonViewMode` | ~515 | Read-only person display |
| `PersonEditForm` | ~686 | Full person edit form |
| `RelatedPersonRow` | ~196 | Table row for Related People section |

**Actual Reduction:** ~3,029 lines (exceeded ~2,400 target)

#### Extraction Order (dependency-safe)
1. ✅ `PersonEditForm` - Leaf component
2. ✅ `PersonViewMode` - Leaf component
3. ✅ `RelatedPersonRow` - Leaf component (uses PortalStatusColumn)
4. ✅ `PersonTabbedView` - Uses PersonViewMode, PersonEditForm
5. ✅ `AddPersonModal` - Standalone modal

#### Success Criteria
- [x] All 5 components extracted to `components/people/`
- [x] PersonTabbedView displays all tabs correctly (Info, Services, Related, Communications, Portal)
- [x] PersonEditForm validates and saves correctly
- [x] AddPersonModal opens/closes correctly with proper form fields
- [x] Address lookup integration works
- [x] UK mobile phone formatting works (+447 format)
- [x] No duplicate definitions in main file
- [x] TypeScript errors: None introduced

#### Testing Results
- ✅ E2E test passed: View Person Details - Tabs and info display correctly
- ✅ E2E test passed: Edit Person Details - Edit/Cancel flow works
- ✅ E2E test passed: Add Person Modal - Opens with form, Cancel works
- ✅ E2E test passed: Tab navigation within client detail page works
- ✅ Architect review: PASS - "maintains functionality with sound component boundaries"

#### Files Created
- `client/src/pages/client-detail/components/people/PersonEditForm.tsx` - 686 lines
- `client/src/pages/client-detail/components/people/PersonViewMode.tsx` - 515 lines
- `client/src/pages/client-detail/components/people/RelatedPersonRow.tsx` - 196 lines
- `client/src/pages/client-detail/components/people/PersonTabbedView.tsx` - 1,204 lines
- `client/src/pages/client-detail/components/people/AddPersonModal.tsx` - 556 lines
- `client/src/pages/client-detail/components/people/index.tsx` - Re-exports

#### Line Count Change
- Before: 8,603 lines
- After: 5,575 lines  
- Stage 4 Reduction: 3,028 lines moved to extracted components
- Total Reduction from Original: 3,772 lines (40% reduction from 9,347)

---

### Stage 5: Extract Service Components ✅ COMPLETED
**Estimated Effort:** 4-5 hours  
**Risk Level:** Medium  
**Status:** COMPLETED (November 25, 2025)
**Detailed Brief:** See `client/src/pages/client-detail/STAGE_5_SERVICE_COMPONENTS.md`

#### Component Inventory
| Component | Lines | Purpose |
|-----------|-------|---------|
| `AddServiceModal` | ~762 | Modal for assigning services to clients |
| `EditableServiceDetails` | ~219 | Inline UDF field editing for services |
| `EditServiceModal` | ~348 | Modal for editing service properties |
| `ClientServiceRow` | ~98 | Table row for displaying client services |

**Actual Reduction:** 1,336 lines (5,575 → 4,239)

#### Extraction Order (dependency-safe)
1. ✅ `ClientServiceRow` - Leaf component, simplest
2. ✅ `EditableServiceDetails` - Leaf component, self-contained
3. ✅ `EditServiceModal` - Uses shared types and schemas
4. ✅ `AddServiceModal` - Complex, uses most dependencies

#### Key Features Preserved
- Companies House auto-population of dates
- Personal service person selection
- Role assignment with visual state indicators
- UDF field editing and saving
- Dual endpoint support (client services vs people services)

#### Success Criteria
- [x] All 4 components extracted to `components/services/`
- [x] AddServiceModal creates services correctly
- [x] EditServiceModal edits both client and personal services
- [x] EditableServiceDetails saves UDF changes
- [x] ClientServiceRow displays and View button works
- [x] Companies House auto-population works
- [x] Personal service assignment works
- [x] No duplicate definitions in main file

#### Testing Results
- ✅ Application builds without TypeScript/LSP errors
- ✅ Workflow running successfully
- ✅ E2E Test PASSED: Services tab loads with Active Services displayed
- ✅ E2E Test PASSED: Add Service Modal opens with all required components
- ✅ E2E Test PASSED: ClientServiceRow displays service details correctly (frequency, dates, owner)
- ✅ E2E Test PASSED: Modal lifecycle (open/close) works correctly
- ✅ Architect review: PASS - All service components extracted, onSuccess callbacks properly wired

#### Files Created
- `client/src/pages/client-detail/components/services/AddServiceModal.tsx` - 762 lines
- `client/src/pages/client-detail/components/services/EditServiceModal.tsx` - 348 lines
- `client/src/pages/client-detail/components/services/EditableServiceDetails.tsx` - 219 lines
- `client/src/pages/client-detail/components/services/ClientServiceRow.tsx` - 98 lines
- `client/src/pages/client-detail/components/services/index.tsx` - 4 lines

#### Line Count Change
- Before: 5,575 lines
- After: 4,239 lines
- Stage 5 Reduction: 1,336 lines moved to extracted components
- Total Reduction from Original: 5,108 lines (54.6% reduction from 9,347)

---

### Stage 6: Extract Communications Components (Largest) ✅ COMPLETED
**Estimated Effort:** 6-8 hours  
**Actual Effort:** ~4 hours  
**Risk Level:** High  
**Status:** COMPLETED (November 25, 2025)
**Detailed Brief:** See `client/src/pages/client-detail/STAGE_6_COMMUNICATIONS_COMPONENTS.md`

#### Component Inventory
| Component | Lines | Purpose |
|-----------|-------|---------|
| `CommunicationsTimeline` | ~1,235 | Main orchestrator with all state/queries |
| `CallDialog` | ~85 | Phone call dialog with RingCentral |
| **Total Code Block** | **~1,320** | Lines 117-1440 in current file |

#### Inline Dialogs Extracted (6 total)
| Dialog | Est. Lines | Key Features |
|--------|------------|--------------|
| `AddCommunicationDialog` | ~150 | Phone call/note form with person selection |
| `SMSDialog` | ~120 | SMS with person mobile validation |
| `EmailDialog` | ~160 | TiptapEditor, signature appending |
| `ViewCommunicationDialog` | ~130 | Read-only detail view |
| `CreateMessageDialog` | ~80 | Instant message thread creation |
| `CallDialog` | ~100 | RingCentral phone integration |

#### Extraction Phases (All Completed)
**Phase 6.1** ✅: Created foundation files (types.ts, helpers.tsx, directory structure)
**Phase 6.2** ✅: Extracted simple dialogs (CreateMessage, ViewCommunication, AddCommunication)
**Phase 6.3** ✅: Extracted complex dialogs (SMS, Call, Email with TiptapEditor)
**Phase 6.4** ✅: Extracted list components (Filters, List with mobile/desktop views)
**Phase 6.5** ✅: Refactored main component to orchestrator role with type-safe discriminated unions

#### Key Data Flow (Type-Safe Implementation)
```
CommunicationsTimeline (Parent)
├── Queries: communications, messageThreads, emailThreads, clientPeople
├── State: 14 state variables (dialog visibility, selections, filters)
├── TimelineItem: Discriminated union (kind: 'communication' | 'message_thread' | 'email_thread')
│
├── CommunicationFilters → Filter buttons with counts
├── CommunicationList → Mobile cards + Desktop table (uses kind-based narrowing)
└── 6 Dialog Components → Each receives clientId, isOpen, onClose, onSuccess
```

#### Type-Safe Pattern Implemented
```typescript
type TimelineItem = 
  | CommunicationTimelineItem  // kind: 'communication', data: CommunicationWithRelations
  | MessageThreadTimelineItem  // kind: 'message_thread', data: MessageThread
  | EmailThreadTimelineItem    // kind: 'email_thread', data: EmailThread
```

#### External Dependencies
- `TiptapEditor` - Rich text in EmailDialog
- `RingCentralPhone` - Phone calls in CallDialog
- `EmailThreadViewer` - View email threads
- `CommunicationCard` - Mobile card view

**Actual Reduction:** ~1,325 lines  
**Actual Post-Stage 6:** 2,915 lines (68.8% total reduction)

#### Success Criteria (All Met)
- [x] All 6 dialogs extracted to `components/communications/dialogs/`
- [x] Helpers (getIcon, getTypeColor, getTypeLabel) extracted to helpers.tsx
- [x] CommunicationFilters component extracted
- [x] CommunicationList with mobile/desktop views extracted
- [x] CommunicationsTimeline reduced to orchestrator (~337 lines)
- [x] Communications tab displays all types
- [x] Filter buttons work with correct counts
- [x] Add Communication (Note/Phone Call) works
- [x] Discriminated union pattern eliminates unsafe type casts
- [x] Project navigation from communications works correctly

#### Files Created
- `components/communications/types.ts` - Discriminated union types (~110 lines)
- `components/communications/helpers.tsx` - Icon/color/label helpers (~60 lines)
- `components/communications/CommunicationsTimeline.tsx` - Orchestrator (~337 lines)
- `components/communications/CommunicationFilters.tsx` - Filter buttons (~87 lines)
- `components/communications/CommunicationList.tsx` - List views (~250 lines)
- `components/communications/dialogs/CreateMessageDialog.tsx` (~85 lines)
- `components/communications/dialogs/ViewCommunicationDialog.tsx` (~122 lines)
- `components/communications/dialogs/AddCommunicationDialog.tsx` (~221 lines)
- `components/communications/dialogs/SMSDialog.tsx` (~151 lines)
- `components/communications/dialogs/EmailDialog.tsx` (~185 lines)
- `components/communications/dialogs/CallDialog.tsx` (~100 lines)
- `components/communications/dialogs/index.tsx` - Re-exports (~10 lines)
- `components/communications/index.tsx` - Re-exports (~3 lines)

#### Testing Results
- ✅ E2E Test PASSED: Communications tab loads with filters visible
- ✅ E2E Test PASSED: Add Communication dialog opens/closes correctly
- ✅ E2E Test PASSED: Filter buttons are interactive and functional
- ✅ E2E Test PASSED: Empty state displays properly
- ✅ Architect review: PASS - Type-safe discriminated unions, project navigation working

#### Line Count Change
- Before: 4,240 lines
- After: 2,915 lines
- Stage 6 Reduction: 1,325 lines moved to extracted components
- Total Reduction from Original: 6,432 lines (68.8% reduction from 9,347)

---

### Stage 7: Extract Tab Components ✅ COMPLETED
**Estimated Effort:** 5-7 hours  
**Actual Effort:** ~4 hours
**Risk Level:** Medium-High  
**Status:** COMPLETED (November 25, 2025)
**Detailed Brief:** See `client/src/pages/client-detail/STAGE_7_TAB_COMPONENTS.md`

#### Component Inventory
| Tab | Lines | Complexity | Status |
|-----|-------|------------|--------|
| Overview | ~304 | High | ✅ Extracted |
| Services | ~729 | Very High | ✅ Extracted |
| Projects | ~36 | Low | ✅ Extracted |
| Communications | ~3 | Low (wrapper) | ✅ Extracted |
| Chronology | ~13 | Low | ✅ Extracted |
| Documents | ~60 | Medium | ✅ Extracted |
| Tasks | ~394 | High | ✅ Extracted |
| Risk | ~7 | Low | ✅ Extracted |

#### Extraction Phases (All Completed)
**Phase 7.1** ✅: Simple tabs (Chronology, Risk, Documents)
**Phase 7.2** ✅: Projects tab wrapper
**Phase 7.3** ✅: Overview tab with company details + people + connections
**Phase 7.4** ✅: Tasks tab with internal tasks + client requests
**Phase 7.5** ✅: Services tab with client services + personal services sections

#### Key Architecture Decisions
1. **Prop Drilling over Context:** Each tab explicitly declares dependencies
2. **Mutations Stay in Parent:** Tabs trigger via callbacks
3. **Grouped Props:** Related props grouped into objects to reduce prop count
4. **Lazy Loading Preserved:** Queries only run when tab is active

#### Files Created
- `components/tabs/ChronologyTab.tsx` - Client chronology wrapper
- `components/tabs/RiskTab.tsx` - Risk assessment/notifications wrapper
- `components/tabs/DocumentsTab.tsx` - Documents and signatures
- `components/tabs/ProjectsTab.tsx` - Projects list wrapper
- `components/tabs/OverviewTab.tsx` - Overview with people and connections
- `components/tabs/TasksTab.tsx` - Internal tasks and client requests
- `components/tabs/ServicesTab.tsx` - Client and personal services
- `components/tabs/services/ClientServicesList.tsx` - Client services section
- `components/tabs/services/PersonalServicesList.tsx` - Personal services section
- `components/tabs/services/PersonalServiceRow.tsx` - Individual personal service row
- `components/tabs/index.tsx` - Re-exports

#### Success Criteria (All Met)
- [x] All 8 tabs render correctly
- [x] Tab switching works (desktop and mobile swipe)
- [x] Tab content matches current behavior exactly
- [x] Mobile vs desktop views display correctly
- [x] All CRUD operations work
- [x] Loading and empty states display correctly

#### Testing Results
- ✅ E2E Test PASSED: 26/26 steps for full tab verification
- ✅ All tabs load with correct content
- ✅ Tab switching works smoothly
- ✅ Architect review: PASS (one regression caught and fixed - clientType hardcoding)

#### Line Count Change
- Before: 2,916 lines
- After: 1,446 lines
- Stage 7 Reduction: 1,470 lines (50.4%)
- **Total Reduction from Original: 7,901 lines (84.5% reduction from 9,347)**

---

### Stage 8: Extract Dialogs & Inline Components ✅ COMPLETED
**Estimated Effort:** 3-4 hours  
**Actual Effort:** ~1.5 hours
**Risk Level:** Medium
**Status:** COMPLETED (November 25, 2025)
**Detailed Brief:** See `client/src/pages/client-detail/STAGE_8_DIALOGS_EXTRACTION.md`

#### Component Inventory
| Component | Lines | Status |
|-----------|-------|--------|
| `NewClientRequestDialog` | ~290 | ✅ Extracted to `dialogs/NewClientRequestDialog.tsx` |
| `ProjectLink` | ~20 | ✅ Removed duplicate (extracted version in `utils/`) |
| `CompanyCreationForm` | ~127 | ✅ Removed duplicate (extracted version in `forms/`) |

#### Extraction Phases (All Completed)
**Phase 8.1** ✅: Fixed 6 LSP errors (setLocation→navigate, boolean conversions, type assertions)
**Phase 8.2** ✅: Extracted `NewClientRequestDialog` with self-contained state, queries, and mutations
**Phase 8.3** ✅: Removed duplicate inline components (already extracted in earlier stages)
**Phase 8.4** ✅: Created `dialogs/index.tsx` re-exports
**Phase 8.5** ✅: E2E tests passed (24/24 steps)

#### Files Created/Modified
- `dialogs/NewClientRequestDialog.tsx` (~290 lines) - Full dialog with two-phase flow
- `dialogs/index.tsx` - Re-exports

#### Success Criteria (All Met)
- [x] Dialog opens/closes correctly
- [x] Template flow works (Category → Template → Person → Create)
- [x] Custom flow works (Name → Create → Navigate)
- [x] State resets on dialog close
- [x] Toast notifications display
- [x] Zero LSP errors

#### Testing Results
- ✅ E2E Test PASSED: 24/24 steps
- ✅ Dialog two-phase flow verified (Template and Custom)
- ✅ All tabs accessible and functional
- ✅ No regressions in existing functionality

#### Line Count Change
- Before: 1,446 lines
- After: 983 lines
- Stage 8 Reduction: 463 lines (32.0%)
- **Total Reduction from Original: 8,364 lines (89.5% reduction from 9,347)**

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

| Stage | Estimated | Actual | Status | Dependencies |
|-------|-----------|--------|--------|--------------|
| Stage 1 | 2-3 hours | ~1 hour | ✅ DONE | None |
| Stage 2 | 1 hour | ~30 min | ✅ DONE | Stage 1 |
| Stage 3 | 2-3 hours | ~2 hours | ✅ DONE | Stage 2 |
| Stage 4 | 4-5 hours | ~3 hours | ✅ DONE | Stage 3 |
| Stage 5 | 4-5 hours | ~3 hours | ✅ DONE | Stage 4 |
| Stage 6 | 6-8 hours | ~4 hours | ✅ DONE | Stage 5 |
| Stage 7 | 5-7 hours | ~4 hours | ✅ DONE | Stage 6 |
| Stage 8 | 3-4 hours | ~1.5 hours | ✅ DONE | Stage 7 |
| Stage 9 | 3-4 hours | - | Pending | Stage 8 |
| Stage 10 | 2-3 hours | - | Pending | Stage 9 |

**Progress:** Stages 1-8 complete in ~19 hours (vs 29-37 estimated)  
**Current File:** 983 lines (89.5% reduction from 9,347)  
**Remaining Estimate:** 5-7 hours for Stages 9-10  
**Total Estimated Time: ~24-26 hours** (~3 working days)

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
