# Stage 7: Tab Components Extraction - Detailed Planning Document

## Executive Summary

Stage 7 focuses on extracting the **8 main tab content areas** from the monolithic ClientDetailPage.tsx into separate, focused components. This is the most complex stage as it involves careful dependency analysis, state management patterns, and ensuring seamless data flow between the main container and tab components.

**Current State:** 2,915 lines
**Expected Reduction:** ~800-1,000 lines  
**Target Post-Stage 7:** ~1,900-2,100 lines (~78% total reduction from original)

---

## Component Inventory & Line Analysis

### Tab Content Breakdown

| Tab | Lines | Current Location | Complexity | Priority |
|-----|-------|------------------|------------|----------|
| Overview | ~304 | lines 1078-1382 | High | 1 |
| Services | ~729 | lines 1384-2113 | Very High | 3 |
| Projects | ~36 | lines 2115-2151 | Low (already extracted) | 8 |
| Communications | ~3 | lines 2153-2155 | Low (already extracted) | 7 |
| Chronology | ~13 | lines 2157-2169 | Low | 6 |
| Documents | ~60 | lines 2171-2231 | Medium | 4 |
| Tasks | ~394 | lines 2233-2627 | High | 2 |
| Risk | ~7 | lines 2629-2635 | Low | 5 |

### Inline Components to Extract

| Component | Lines | Current Location | Target Location |
|-----------|-------|------------------|-----------------|
| ProjectLink | ~20 | lines 95-115 | utils/ProjectLink.tsx |
| CompanyCreationForm | ~127 | lines 118-245 | forms/CompanyCreationForm.tsx |

**Total Extractable Code:** ~1,160+ lines

---

## Dependency Analysis

### Shared State from Parent Component

The following state variables are used across multiple tabs and must be passed as props:

```typescript
interface TabCommonProps {
  clientId: string;
  client: Client;
  isMobile: boolean;
  user: User | null;
  navigate: (path: string) => void;
  setLocation: (path: string) => void;
}
```

### Tab-Specific Dependencies

#### Overview Tab
```typescript
interface OverviewTabProps extends TabCommonProps {
  // People-related
  relatedPeople: ClientPersonWithPerson[] | undefined;
  peopleLoading: boolean;
  peopleError: Error | null;
  setIsAddPersonModalOpen: (open: boolean) => void;
  
  // Company connections (for individual clients)
  companyConnections: CompanyConnection[] | undefined;
  connectionsLoading: boolean;
  showCompanySelection: boolean;
  setShowCompanySelection: (show: boolean) => void;
  showCompanyCreation: boolean;
  setShowCompanyCreation: (show: boolean) => void;
  linkToCompanyMutation: UseMutationResult;
  unlinkFromCompanyMutation: UseMutationResult;
  companyClients: Client[] | undefined;
}
```

#### Services Tab
```typescript
interface ServicesTabProps extends TabCommonProps {
  // Client services
  clientServices: EnhancedClientService[] | undefined;
  servicesLoading: boolean;
  servicesError: Error | null;
  refetchServices: () => void;
  
  // People services
  peopleServices: PeopleServiceWithRelations[] | undefined;
  peopleServicesLoading: boolean;
  
  // Company services (for individuals)
  companyConnections: CompanyConnection[] | undefined;
  companyServicesQueries: UseQueryResult;
  
  // Service expansion state
  expandedClientServiceId: string | null;
  setExpandedClientServiceId: (id: string | null) => void;
  expandedPersonalServiceId: string | null;
  setExpandedPersonalServiceId: (id: string | null) => void;
  
  // Edit modals
  setEditingServiceId: (id: string | null) => void;
  setEditingPersonalServiceId: (id: string | null) => void;
  
  // Related data
  servicesWithRoles: ServiceWithRoles[] | undefined;
}
```

#### Projects Tab
```typescript
interface ProjectsTabProps extends TabCommonProps {
  projects: ProjectWithRelations[] | undefined;
  isLoading: boolean;
}
// Already mostly extracted - just needs wrapper
```

#### Tasks Tab
```typescript
interface TasksTabProps extends TabCommonProps {
  // Internal tasks
  clientInternalTasks: any[] | undefined;
  clientInternalTasksLoading: boolean;
  
  // Client requests
  taskInstances: any[] | undefined;
  taskInstancesLoading: boolean;
  
  // New request dialog
  isNewRequestDialogOpen: boolean;
  setIsNewRequestDialogOpen: (open: boolean) => void;
  requestType: 'template' | 'custom' | null;
  setRequestType: (type: 'template' | 'custom' | null) => void;
  
  // Template selection
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  selectedPersonId: string;
  setSelectedPersonId: (id: string) => void;
  taskCategories: any[] | undefined;
  clientRequestTemplates: any[] | undefined;
  relatedPeople: ClientPersonWithPerson[] | undefined;
  
  // Mutations
  createTaskInstanceMutation: UseMutationResult;
  createCustomRequestMutation: UseMutationResult;
  customRequestForm: UseFormReturn;
}
```

#### Documents Tab
```typescript
interface DocumentsTabProps extends TabCommonProps {
  // No additional data dependencies - uses existing components
}
```

#### Chronology Tab
```typescript
interface ChronologyTabProps {
  clientId: string;
  // Uses only ClientChronology component
}
```

#### Risk Tab
```typescript
interface RiskTabProps {
  clientId: string;
  riskView: 'risk' | 'notifications';
  // Uses only RiskAssessmentTab and ClientNotificationsView
}
```

---

## Data Flow Architecture

### Current Flow (Before Refactor)
```
ClientDetailPage
├── All queries (15+)
├── All mutations (20+)
├── All state (30+)
└── All tabs inline
```

### Target Flow (After Refactor)
```
ClientDetailPage (Orchestrator ~300-400 lines)
├── Core queries: client, relatedPeople
├── Core state: activeTab, riskView, modal states
├── Tab-specific data passed as props
│
├── OverviewTab
│   ├── Receives: client, people, companyConnections
│   └── Uses: RelatedPersonRow, CompanyCreationForm
│
├── ServicesTab
│   ├── Receives: clientServices, peopleServices, expansion state
│   └── Uses: AddServiceModal, ClientServiceRow, PersonalServicesList
│
├── ProjectsTab
│   ├── Receives: projects, loading state
│   └── Uses: ProjectsList (already extracted)
│
├── CommunicationsTab (Already extracted)
│   └── Uses: CommunicationsTimeline
│
├── ChronologyTab
│   └── Uses: ClientChronology
│
├── DocumentsTab
│   ├── Receives: clientId
│   └── Uses: DocumentFolderView, SignatureRequestsPanel
│
├── TasksTab
│   ├── Receives: tasks, requests, form state, mutations
│   └── Contains: InternalTasksList, ClientRequestsList, NewRequestDialog
│
└── RiskTab
    ├── Receives: riskView
    └── Uses: RiskAssessmentTab, ClientNotificationsView
```

---

## Extraction Phases

### Phase 7.1: Foundation & Simple Tabs (1 hour)
**Files to Create:**
- `components/tabs/ChronologyTab.tsx` (~30 lines)
- `components/tabs/RiskTab.tsx` (~40 lines)
- `components/tabs/DocumentsTab.tsx` (~80 lines)
- `components/tabs/index.tsx` (re-exports)

**Rationale:** Start with simplest tabs that have minimal dependencies.

### Phase 7.2: Projects Tab Wrapper (30 min)
**Files to Create:**
- `components/tabs/ProjectsTab.tsx` (~50 lines)

**Rationale:** Already uses extracted ProjectsList, just needs wrapper and Card/CardHeader structure.

### Phase 7.3: Overview Tab (1.5 hours)
**Files to Create:**
- `components/tabs/OverviewTab.tsx` (~350 lines)
- `forms/CompanyCreationForm.tsx` (~140 lines)
- `utils/ProjectLink.tsx` (~25 lines)

**Key Challenges:**
- Company details section with address/map
- Related people table with RelatedPersonRow
- Connected companies section (for individuals) with add/unlink functionality
- Company creation form in dialog

**Dependencies to Pass:**
- client, relatedPeople, companyConnections
- Modal and mutation handlers
- Link/unlink mutations

### Phase 7.4: Tasks Tab (2 hours)
**Files to Create:**
- `components/tabs/TasksTab.tsx` (~200 lines)
- `components/tabs/tasks/InternalTasksList.tsx` (~180 lines)
- `components/tabs/tasks/ClientRequestsList.tsx` (~200 lines)
- `components/tabs/tasks/NewRequestDialog.tsx` (~250 lines)

**Key Challenges:**
- Mobile vs desktop views for both lists
- Complex dialog with template/custom toggle
- Category → Template → Person cascading selection
- Custom request form with Zod validation

### Phase 7.5: Services Tab (2 hours)
**Files to Create:**
- `components/tabs/ServicesTab.tsx` (~200 lines)
- `components/tabs/services/ClientServicesSection.tsx` (~350 lines)
- `components/tabs/services/PersonalServicesSection.tsx` (~250 lines)

**Key Challenges:**
- Most complex tab with nested accordions
- Conditional logic for company vs individual clients
- Service expansion state management
- Nested tabs within expanded service rows

**Dependencies to Pass:**
- All service-related queries and loading states
- Expansion state setters
- Edit modal triggers

---

## Component Boundaries

### What Stays in Parent (ClientDetailPage.tsx)

1. **Core Setup:**
   - Route params extraction
   - Auth context access
   - Main layout structure (TopNavigation, BottomNav)
   - Tab state management (activeTab, SwipeableTabsWrapper)

2. **Core Queries:**
   - Client data query
   - Related people query
   - Client services query
   - All other data queries that feed into tabs

3. **Core Mutations:**
   - All mutations remain in parent
   - Passed to tabs via props or callbacks

4. **Core State:**
   - Modal open states
   - Tab selection states
   - Form instances

5. **Modal Components:**
   - AddPersonModal
   - EditServiceModal (both client and personal)
   - NewRequestDialog (if not extracted to Tasks tab)

### What Moves to Tab Components

1. **UI Structure:**
   - Card wrappers
   - Section headers
   - Table/List layouts

2. **Display Logic:**
   - Mobile vs desktop conditionals
   - Empty states
   - Loading skeletons

3. **Local Component State:**
   - Accordion/collapsible expansion (if self-contained)
   - Local form state

---

## Prop Drilling vs Context Considerations

### Recommendation: Prop Drilling (Not Context)

**Why Prop Drilling for Stage 7:**

1. **Explicit Dependencies:** Each tab clearly declares what data it needs
2. **Easier Testing:** Components can be tested in isolation with mock props
3. **No Hidden Dependencies:** No "magic" data appearing from context
4. **TypeScript Benefits:** Full type safety on all passed props
5. **Refactor Safety:** Renaming/removing props causes compile-time errors

**When to Consider Context (Stage 8+):**
- If 10+ props need to pass through 3+ levels
- If same data needed by many sibling components
- After hooks extraction provides cleaner data access

### Prop Grouping Strategy

Group related props into objects:

```typescript
// Instead of 10 individual props:
interface TasksTabProps {
  clientId: string;
  isMobile: boolean;
  
  // Group internal tasks
  internalTasks: {
    data: any[] | undefined;
    isLoading: boolean;
  };
  
  // Group client requests
  clientRequests: {
    data: any[] | undefined;
    isLoading: boolean;
  };
  
  // Group dialog controls
  newRequestDialog: {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    requestType: 'template' | 'custom' | null;
    setRequestType: (type: 'template' | 'custom' | null) => void;
    // ... other dialog state
  };
}
```

---

## Type Definitions

### New Types to Add (in utils/types.ts)

```typescript
// Tab common props
export interface TabCommonProps {
  clientId: string;
  client: Client;
  isMobile: boolean;
}

// Company connection type (for individuals)
export interface CompanyConnection {
  client: Client;
  officerRole?: string;
  isPrimaryContact?: boolean;
}

// Internal task type (from API)
export interface InternalTask {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'closed';
  dueDate?: string;
  assignee?: User;
  taskType?: { name: string };
}

// Task instance type (client request)
export interface TaskInstanceWithDetails {
  id: string;
  template?: { name: string };
  customRequest?: { name: string };
  status: 'not_started' | 'in_progress' | 'submitted' | 'approved';
  progress?: { completed: number; total: number; percentage: number };
  relatedPerson?: { fullName: string };
  categoryName?: string;
  createdAt: string;
  dueDate?: string;
}
```

---

## Success Criteria

### Functional Requirements
- [ ] All 8 tabs render correctly with identical behavior
- [ ] Tab switching works (desktop tabs + mobile swipe)
- [ ] Mobile/desktop views display correctly per tab
- [ ] All CRUD operations work (add, edit, delete)
- [ ] Loading states and error states display correctly
- [ ] Empty states display correctly

### Technical Requirements
- [ ] No TypeScript errors introduced
- [ ] All props are properly typed
- [ ] No duplicate component definitions
- [ ] Clean separation of concerns
- [ ] Consistent import patterns

### Performance Requirements
- [ ] No unnecessary re-renders when switching tabs
- [ ] Lazy loading maintained (queries only run when tab is active)
- [ ] No memory leaks from unmounted component effects

---

## Testing Plan

### Unit Tests (Per Tab)

1. **ChronologyTab** - Renders ClientChronology with correct clientId
2. **RiskTab** - Toggles between Risk and Notifications views
3. **DocumentsTab** - Renders nested tabs for Client Docs / Signed Docs
4. **ProjectsTab** - Renders ProjectsList with correct filters
5. **OverviewTab** - Renders company details and people table
6. **TasksTab** - Renders both task lists and dialog
7. **ServicesTab** - Renders client services and personal services

### E2E Test Scenarios

1. **Tab Navigation:**
   - Navigate through all 8 tabs on desktop
   - Swipe through tabs on mobile viewport
   - Verify URL doesn't change on tab switch

2. **Overview Tab:**
   - Verify company details display
   - Verify people table with correct columns
   - Test Add Person modal opens

3. **Services Tab:**
   - Verify active/inactive service separation
   - Test accordion expansion
   - Test Add Service modal opens

4. **Projects Tab:**
   - Verify open/completed project separation
   - Test project link navigation

5. **Tasks Tab:**
   - Verify internal tasks display
   - Verify client requests display
   - Test New Request dialog flow

6. **Documents Tab:**
   - Verify nested tabs work
   - Test Create Signature Request button

---

## Risk Assessment

### High Risk
- **Services Tab Complexity:** Multiple nested accordions, conditional rendering for company vs individual, nested tabs within expanded rows
- **Mitigation:** Extract in smaller chunks, test each section independently

### Medium Risk
- **State Synchronization:** Modals and mutations triggered from tabs need to update parent state correctly
- **Mitigation:** Use callback props with clear naming, test mutation → invalidation flow

### Low Risk
- **Simple Tabs (Chronology, Risk, Documents):** Minimal logic, mostly wrappers
- **Already Extracted Components:** Projects and Communications mostly done

---

## File Structure After Stage 7

```
client/src/pages/client-detail/
├── index.tsx
├── ClientDetailPage.tsx (~1,900-2,100 lines)
│
├── components/
│   ├── PortalStatusColumn.tsx
│   │
│   ├── tabs/
│   │   ├── index.tsx
│   │   ├── OverviewTab.tsx (~350 lines)
│   │   ├── ServicesTab.tsx (~200 lines)
│   │   ├── ProjectsTab.tsx (~50 lines)
│   │   ├── ChronologyTab.tsx (~30 lines)
│   │   ├── DocumentsTab.tsx (~80 lines)
│   │   ├── TasksTab.tsx (~200 lines)
│   │   ├── RiskTab.tsx (~40 lines)
│   │   │
│   │   ├── services/
│   │   │   ├── ClientServicesSection.tsx (~350 lines)
│   │   │   └── PersonalServicesSection.tsx (~250 lines)
│   │   │
│   │   └── tasks/
│   │       ├── InternalTasksList.tsx (~180 lines)
│   │       ├── ClientRequestsList.tsx (~200 lines)
│   │       └── NewRequestDialog.tsx (~250 lines)
│   │
│   ├── projects/
│   │   └── ... (existing)
│   │
│   ├── people/
│   │   └── ... (existing)
│   │
│   ├── services/
│   │   └── ... (existing)
│   │
│   └── communications/
│       └── ... (existing)
│
├── forms/
│   ├── AddPersonModal.tsx (existing)
│   ├── CompanyCreationForm.tsx (~140 lines) ← NEW
│   └── ... (existing)
│
├── hooks/
│   └── ... (to be added in Stage 8)
│
└── utils/
    ├── formatters.ts
    ├── types.ts
    ├── projectHelpers.ts
    └── ProjectLink.tsx (~25 lines) ← NEW
```

---

## Execution Checklist

### Pre-Extraction
- [ ] Review all tab content in ClientDetailPage.tsx
- [ ] Document all props/state each tab needs
- [ ] Create type definitions in utils/types.ts
- [ ] Create tabs/ directory structure

### Phase 7.1: Simple Tabs
- [ ] Extract ChronologyTab
- [ ] Extract RiskTab
- [ ] Extract DocumentsTab
- [ ] Create tabs/index.tsx re-exports
- [ ] Update imports in ClientDetailPage
- [ ] Test all three tabs work

### Phase 7.2: Projects Tab
- [ ] Extract ProjectsTab wrapper
- [ ] Update imports
- [ ] Test projects display correctly

### Phase 7.3: Overview Tab
- [ ] Extract CompanyCreationForm to forms/
- [ ] Extract ProjectLink to utils/
- [ ] Extract OverviewTab with all sections
- [ ] Update imports
- [ ] Test company details, people table, company connections

### Phase 7.4: Tasks Tab
- [ ] Extract InternalTasksList
- [ ] Extract ClientRequestsList
- [ ] Extract NewRequestDialog
- [ ] Extract TasksTab orchestrator
- [ ] Update imports
- [ ] Test both lists and dialog flow

### Phase 7.5: Services Tab
- [ ] Extract ClientServicesSection
- [ ] Extract PersonalServicesSection
- [ ] Extract ServicesTab orchestrator
- [ ] Update imports
- [ ] Test all service functionality

### Post-Extraction
- [ ] Run full E2E test suite
- [ ] Verify no TypeScript errors
- [ ] Update client-detail_refactor.md
- [ ] Update replit.md
- [ ] Architect review

---

## Notes for Implementation

1. **Start with simple tabs** to establish the pattern before tackling complex ones
2. **Keep mutations in parent** - tabs trigger them via callbacks
3. **Group related props** to reduce prop count
4. **Test each phase** before moving to next
5. **Preserve all data-testid** attributes for E2E compatibility
6. **Watch for circular dependencies** when creating new files
