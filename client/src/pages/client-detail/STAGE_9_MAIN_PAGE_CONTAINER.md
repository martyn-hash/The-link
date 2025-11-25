# Stage 9: Create Main Page Container

**Date Started:** November 25, 2025  
**Status:** Planning  
**Estimated Effort:** 3-4 hours  
**Risk Level:** Medium

---

## Current State Analysis

### File: ClientDetailPage.tsx (983 lines)

| Section | Lines | Line Count | Description |
|---------|-------|------------|-------------|
| Imports | 1-103 | 103 | Many imports, some potentially unused |
| Component Setup | 104-128 | 25 | Hooks, state declarations |
| Debug Code | 129-230 | 102 | Tab debugging, performance observers, event listeners |
| Queries | 232-286 | 55 | 8 data queries |
| Person Mutations | 288-331 | 44 | updatePerson, createPerson |
| Company Connections | 333-462 | 130 | State, queries, mutations for company links |
| Documents | 464-488 | 25 | Query and delete mutation |
| Loading/Error States | 490-533 | 44 | Skeleton and error UI |
| Header | 535-574 | 40 | Client name, badges, metadata |
| Tab Navigation | 576-831 | 256 | Desktop grid, mobile carousel, section title |
| Tab Content | 832-919 | 88 | SwipeableTabsWrapper + 8 TabsContent |
| Modals | 921-971 | 51 | EditServiceModal x2, AddPersonModal, NewClientRequestDialog |
| Bottom Nav | 973-983 | 11 | BottomNav, SuperSearch |

---

## Stage 9 Goals

1. **Remove Debug Code** - Eliminate ~100 lines of tab debugging code
2. **Extract Header Component** - Create `components/ClientHeader.tsx` (~40 lines saved)
3. **Extract Tab Navigation** - Create `components/ClientTabNavigation.tsx` (~260 lines saved)
4. **Create Custom Hook for Queries** - Create `hooks/useClientData.ts` (~180 lines saved)
5. **Create Custom Hook for Mutations** - Create `hooks/useClientMutations.ts` (~175 lines saved)
6. **Clean Up Imports** - Remove unused imports after extractions

### Expected Result
- **Target:** Main page reduced to ~250-350 lines
- **Pattern:** Thin orchestration layer that composes extracted components and hooks

---

## Detailed Task Breakdown

### Phase 9.1: Remove Debug Code
**Lines to Remove:** 129-230 (~102 lines)
**Risk:** Low

The debug code was added for tab jumping investigation. Since the issue has been addressed by SwipeableTabsWrapper, this code can be safely removed:

```typescript
// REMOVE: Lines 129-230
// - DEBUG: Tab jumping investigation (useLayoutEffect)
// - DEBUG: Layout shift observer and global event listeners (useEffect)
// - DEBUG: Click event logging on tab triggers (useEffect)
```

**Success Criteria:**
- [ ] All console.log debug statements removed
- [ ] PerformanceObserver code removed
- [ ] debugMetricsRef removed
- [ ] No runtime errors after removal
- [ ] Tab navigation still works correctly

---

### Phase 9.2: Create useClientData Hook
**New File:** `hooks/useClientData.ts`
**Estimated Size:** ~120 lines
**Lines Saved from Main:** ~80 lines

Consolidate all data fetching queries into a single custom hook:

```typescript
// hooks/useClientData.ts
export interface UseClientDataResult {
  // Core client
  client: Client | undefined;
  isLoading: boolean;
  error: Error | null;
  
  // Related data
  relatedPeople: ClientPersonWithPerson[] | undefined;
  peopleLoading: boolean;
  peopleError: Error | null;
  
  clientServices: EnhancedClientService[] | undefined;
  servicesLoading: boolean;
  servicesError: Error | null;
  refetchServices: () => void;
  
  peopleServices: PeopleServiceWithRelations[] | undefined;
  peopleServicesLoading: boolean;
  peopleServicesError: Error | null;
  refetchPeopleServices: () => void;
  
  servicesWithRoles: (Service & { roles: WorkRole[] })[] | undefined;
  
  clientProjects: ProjectWithRelations[] | undefined;
  projectsLoading: boolean;
  projectsError: Error | null;
  
  taskInstances: any[] | undefined;
  taskInstancesLoading: boolean;
  
  clientInternalTasks: any[] | undefined;
  clientInternalTasksLoading: boolean;
  
  clientDocuments: Document[] | undefined;
  documentsLoading: boolean;
}

export function useClientData(clientId: string | undefined): UseClientDataResult
```

**Queries to Move:**
1. `client` query (lines 232-236)
2. `relatedPeople` query (lines 238-244)
3. `clientServices` query (lines 246-251)
4. `peopleServices` query (lines 253-258)
5. `servicesWithRoles` query (lines 260-265)
6. `clientProjects` query (lines 267-274)
7. `taskInstances` query (lines 276-280)
8. `clientInternalTasks` query (lines 282-286)
9. `clientDocuments` query (lines 465-468)

**Success Criteria:**
- [ ] All 9 queries moved to hook
- [ ] Hook returns typed result object
- [ ] All consuming components receive data correctly
- [ ] Query keys remain unchanged (cache compatibility)
- [ ] Loading/error states propagate correctly

---

### Phase 9.3: Create useClientMutations Hook
**New File:** `hooks/useClientMutations.ts`
**Estimated Size:** ~150 lines
**Lines Saved from Main:** ~170 lines

Consolidate all mutations into a single custom hook:

```typescript
// hooks/useClientMutations.ts
export interface UseClientMutationsResult {
  // Person mutations
  updatePerson: UseMutationResult<...>;
  createPerson: UseMutationResult<...>;
  
  // Company connection mutations
  linkToCompany: UseMutationResult<...>;
  unlinkFromCompany: UseMutationResult<...>;
  convertToCompany: UseMutationResult<...>;
  
  // Document mutations
  deleteDocument: UseMutationResult<...>;
}

export function useClientMutations(
  clientId: string | undefined,
  callbacks: {
    onPersonUpdated?: () => void;
    onPersonCreated?: () => void;
    onCompanyLinked?: () => void;
    onCompanyUnlinked?: () => void;
    onCompanyCreated?: () => void;
    onDocumentDeleted?: () => void;
  }
): UseClientMutationsResult
```

**Mutations to Move:**
1. `updatePersonMutation` (lines 288-308)
2. `createPersonMutation` (lines 310-330)
3. `linkToCompanyMutation` (lines 382-406)
4. `unlinkFromCompanyMutation` (lines 408-427)
5. `convertToCompanyMutation` (lines 429-456)
6. `deleteDocumentMutation` (lines 470-488)

**Success Criteria:**
- [ ] All 6 mutations moved to hook
- [ ] Callbacks allow parent to handle UI state (modal closing, etc.)
- [ ] Toast notifications remain functional
- [ ] Query invalidation works correctly
- [ ] Mutation states (isPending) accessible

---

### Phase 9.4: Create useCompanyConnections Hook
**New File:** `hooks/useCompanyConnections.ts`
**Estimated Size:** ~80 lines
**Lines Saved from Main:** ~50 lines

Extract the company connections logic (specific to individual clients):

```typescript
// hooks/useCompanyConnections.ts
export interface UseCompanyConnectionsResult {
  companyConnections: CompanyConnection[];
  connectionsLoading: boolean;
  
  companyServices: EnhancedClientService[] | undefined;
  companyServicesLoading: boolean;
  companyServicesError: boolean;
  
  availableCompanies: Client[];
  
  // State
  showCompanySelection: boolean;
  setShowCompanySelection: (show: boolean) => void;
  showCompanyCreation: boolean;
  setShowCompanyCreation: (show: boolean) => void;
}

export function useCompanyConnections(
  clientId: string | undefined,
  clientType: 'individual' | 'company' | undefined,
  showCompanySelection: boolean
): UseCompanyConnectionsResult
```

**Logic to Move:**
- `companyConnections` query (lines 338-346)
- `companyServicesQueries` query (lines 348-373)
- `companyClients` query (lines 375-380)
- `availableCompanies` computed value (lines 458-462)
- State: `showCompanySelection`, `showCompanyCreation` (lines 334-335)

**Success Criteria:**
- [ ] Company connections query works for individual clients only
- [ ] Services query fetches all connected company services
- [ ] Available companies filters correctly
- [ ] State management preserved

---

### Phase 9.5: Extract ClientHeader Component
**New File:** `components/ClientHeader.tsx`
**Estimated Size:** ~60 lines
**Lines Saved from Main:** ~40 lines

```typescript
// components/ClientHeader.tsx
interface ClientHeaderProps {
  client: Client;
}

export function ClientHeader({ client }: ClientHeaderProps) {
  return (
    <div className="border-b bg-background/95 backdrop-blur...">
      {/* Client name, company number, formation date, status badge */}
    </div>
  );
}
```

**JSX to Move:** Lines 539-574

**Success Criteria:**
- [ ] Header displays client name
- [ ] Company number shown when available
- [ ] Formation date shown when available
- [ ] Status badge with correct variant
- [ ] Responsive layout preserved

---

### Phase 9.6: Extract ClientTabNavigation Component
**New File:** `components/ClientTabNavigation.tsx`
**Estimated Size:** ~280 lines
**Lines Saved from Main:** ~260 lines

This is the largest extraction, handling both desktop and mobile tab layouts:

```typescript
// components/ClientTabNavigation.tsx
interface ClientTabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  riskView: 'risk' | 'notifications';
  onRiskViewChange: (view: 'risk' | 'notifications') => void;
  isMobile: boolean;
}

export function ClientTabNavigation({
  activeTab,
  onTabChange,
  riskView,
  onRiskViewChange,
  isMobile,
}: ClientTabNavigationProps) {
  return (
    <>
      {/* Desktop Tabs - Grid Layout */}
      {/* Mobile Tabs - Carousel with arrows */}
      {/* Mobile Section Title */}
    </>
  );
}
```

**JSX to Move:** Lines 585-830

**Success Criteria:**
- [ ] Desktop grid tabs work correctly
- [ ] Mobile carousel with arrows works
- [ ] More dropdown opens and navigates to Risk/Notifications
- [ ] Mobile section title updates correctly
- [ ] Tab scroll behavior preserved

---

### Phase 9.7: Clean Up Modals Section
**Current State:** Inline IIFE patterns for conditional modals
**Improvement:** Simplify conditional rendering

```typescript
// Before (lines 923-936)
{editingServiceId && (() => {
  const currentService = clientServices?.find(cs => cs.id === editingServiceId);
  if (currentService) {
    return <EditServiceModal ... />;
  }
  return null;
})()}

// After
{editingServiceId && clientServices?.find(cs => cs.id === editingServiceId) && (
  <EditServiceModal 
    service={clientServices.find(cs => cs.id === editingServiceId)!}
    isOpen={!!editingServiceId}
    onClose={() => setEditingServiceId(null)}
  />
)}
```

**Success Criteria:**
- [ ] All modals render correctly
- [ ] Modal open/close logic preserved
- [ ] Code is more readable

---

### Phase 9.8: Clean Up Imports
**Current:** ~103 lines of imports
**Expected After:** ~50-60 lines

Remove imports that are no longer directly used in main file after extractions:
- Query-related types (moved to hooks)
- Mutation-related imports
- UI components only used in extracted components

**Success Criteria:**
- [ ] No unused imports remain
- [ ] No LSP errors about missing imports
- [ ] Build succeeds

---

## Execution Order

1. **Phase 9.1: Remove Debug Code** (Low risk, immediate wins)
2. **Phase 9.2: Create useClientData Hook** (Foundation for other phases)
3. **Phase 9.3: Create useClientMutations Hook** (Depends on 9.2 patterns)
4. **Phase 9.4: Create useCompanyConnections Hook** (Specialized logic)
5. **Phase 9.5: Extract ClientHeader** (Simple extraction)
6. **Phase 9.6: Extract ClientTabNavigation** (Largest extraction)
7. **Phase 9.7: Clean Up Modals** (Quick cleanup)
8. **Phase 9.8: Clean Up Imports** (Final polish)

---

## Files to Create

| File | Estimated Lines | Purpose |
|------|-----------------|---------|
| `hooks/useClientData.ts` | ~120 | All data queries |
| `hooks/useClientMutations.ts` | ~150 | All mutations |
| `hooks/useCompanyConnections.ts` | ~80 | Individual client company links |
| `components/ClientHeader.tsx` | ~60 | Header with client info |
| `components/ClientTabNavigation.tsx` | ~280 | Tab navigation (desktop + mobile) |

**Total New Code:** ~690 lines across 5 files

---

## Expected Final Structure

```
client/src/pages/client-detail/
├── ClientDetailPage.tsx (~250-350 lines) ← Thin orchestration layer
├── components/
│   ├── ClientHeader.tsx (NEW)
│   ├── ClientTabNavigation.tsx (NEW)
│   ├── PortalStatusColumn.tsx
│   ├── tabs/
│   │   ├── index.tsx
│   │   ├── OverviewTab.tsx
│   │   ├── ServicesTab.tsx
│   │   ├── ProjectsTab.tsx
│   │   ├── TasksTab.tsx
│   │   ├── ChronologyTab.tsx
│   │   ├── DocumentsTab.tsx
│   │   └── RiskTab.tsx
│   ├── services/
│   ├── people/
│   ├── projects/
│   └── communications/
├── dialogs/
│   ├── index.tsx
│   └── NewClientRequestDialog.tsx
├── forms/
├── hooks/
│   ├── index.ts (create for re-exports)
│   ├── useClientData.ts (NEW)
│   ├── useClientMutations.ts (NEW)
│   └── useCompanyConnections.ts (NEW)
└── utils/
    ├── formatters.ts
    ├── projectHelpers.ts
    └── types.ts
```

---

## Success Criteria for Stage 9

### Functional Requirements
- [ ] Page renders identically to before
- [ ] All 8 tabs work correctly
- [ ] All data loads correctly
- [ ] All mutations work (create/update person, link/unlink company, delete document)
- [ ] Mobile and desktop layouts work
- [ ] Tab navigation works on both platforms
- [ ] All modals open/close correctly

### Code Quality Requirements
- [ ] Main page ≤ 350 lines
- [ ] No single new file > 300 lines
- [ ] Zero LSP errors
- [ ] Zero TypeScript errors
- [ ] All hooks follow React conventions (use* naming)
- [ ] Proper separation of concerns

### Performance Requirements
- [ ] No additional re-renders introduced
- [ ] Query caching still works correctly
- [ ] No memory leaks from removed debug code

---

## Testing Plan

### E2E Test Scenarios
1. Navigate to client detail page
2. Verify header displays correctly
3. Click through all 8 tabs
4. Verify mobile tab navigation (arrows, swipe)
5. Test "More..." dropdown (Risk/Notifications)
6. Add a person (if test data allows)
7. Open/close modals

### Regression Tests
- All functionality from Stages 1-8 still works
- No visual regressions in header or tabs
- Tab content loads correctly for each tab

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Query hook breaks data flow | Low | High | Test each query individually |
| Mutation callbacks misconfigured | Medium | Medium | Verify cache invalidation |
| Tab navigation breaks on mobile | Low | High | Test on mobile viewport |
| Import cleanup breaks build | Low | Medium | Check LSP before committing |

---

## Line Count Projection

| Phase | Lines Removed | Lines Added | Net Change |
|-------|---------------|-------------|------------|
| 9.1 Debug removal | -102 | 0 | -102 |
| 9.2 useClientData | -80 | +120 | +40 (moved to hook) |
| 9.3 useClientMutations | -170 | +150 | -20 |
| 9.4 useCompanyConnections | -50 | +80 | +30 (moved to hook) |
| 9.5 ClientHeader | -40 | +60 | +20 (moved to component) |
| 9.6 ClientTabNavigation | -260 | +280 | +20 (moved to component) |
| 9.7 Modal cleanup | -10 | 0 | -10 |
| 9.8 Import cleanup | -40 | 0 | -40 |

**Main File:** 983 → ~250-350 lines (~63-74% reduction in Stage 9)
**Total Lines (with new files):** Net neutral (code is reorganized, not removed)

---

## Post-Stage 9 State

After Stage 9:
- **Main Page:** ~300 lines (thin orchestration)
- **Total Reduction:** ~97% from original 9,347 lines
- **Architecture:** Clean separation with custom hooks and components
- **Maintainability:** Significantly improved, each concern in its own file

Ready for **Stage 10: Final Cleanup & Documentation**
