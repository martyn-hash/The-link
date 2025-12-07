# Refactoring Plan: client/src/pages/projects.tsx

## Overview

**File:** `client/src/pages/projects.tsx`  
**Current Size:** 2,508 lines  
**Priority:** #5 (Fifth in refactoring order)  
**Risk Level:** HIGH - Main workspace page, core user experience  
**Estimated Effort:** Large (4-6 days)

---

## Browser Testing Login Details

For all verification steps, use these credentials:

- **URL:** Root page (`/`)
- **Tab:** "Passwords" tab
- **Email:** `jamsplan1@gmail.com`
- **Password:** `admin123`

---

## Problem Statement

`projects.tsx` is a monolithic "god component" containing 2,500+ lines of code that handles:
- Two completely different workspaces (Projects and Tasks)
- Four different view modes (List, Kanban, Calendar, Dashboard)
- ~50+ useState hooks for state management
- Complex filtering logic (~160 lines)
- Six different modal dialogs
- Mobile and desktop rendering variants

This makes the component extremely difficult to maintain, test, and debug.

---

## Scope Definition

### In Scope
- Breaking into smaller, focused components
- Extracting state management into custom hooks
- Moving filtering logic into dedicated utilities
- Separating view-specific code into sub-components
- Extracting modal dialogs into standalone components

### Out of Scope
- Changing UI/UX behavior
- Modifying API endpoints or data structures
- Changing child component implementations
- Adding new features

---

## Success Criteria

1. **Functional Parity:** All views and features work identically
2. **File Size Reduction:** Main page component < 400 lines
3. **State Extraction:** Custom hooks for each state domain
4. **No Regressions:** All view modes, filters, and modals work
5. **Consistent Patterns:** All extracted components follow same patterns
6. **Testability:** Each hook/component can be unit tested independently

---

## Current Structure Analysis

| Section | Lines | Description | Target Location |
|---------|-------|-------------|-----------------|
| Imports/Types | 1-98 (~100) | Imports and type definitions | Keep in page, types to shared |
| State Management | 99-238 (~140) | 50+ useState hooks | Custom hooks |
| URL Sync Effects | 240-508 (~270) | URL param sync, service normalization | `useProjectsUrlSync` hook |
| Data Queries | 282-401 (~120) | useQuery calls | `useProjectsData` hook |
| View Handlers | 510-690 (~180) | handleLoadSavedView, etc. | `useViewManagement` hook |
| Mutations | 706-930 (~225) | CRUD mutations | `useProjectsMutations` hook |
| Dashboard Handlers | 931-1032 (~100) | Widget/dashboard handlers | `useDashboardManagement` hook |
| Auth Effects | 1034-1064 (~30) | Auth redirect effects | Keep in page |
| Filtering Logic | 1067-1283 (~215) | filteredProjects useMemo | `useProjectFiltering` hook |
| Header JSX | 1285-1702 (~420) | Toolbar, view buttons | `ProjectsHeader` component |
| Main Content JSX | 1704-1978 (~275) | View rendering | `ProjectsContent` component |
| Modal Dialogs | 1979-2508 (~530) | 6 different modals | Individual modal components |

---

## Target File Structure

```
client/src/
├── pages/
│   └── projects.tsx                        # Main orchestrator (~350 lines)
├── components/
│   └── projects-page/
│       ├── ProjectsHeader.tsx              # Header/toolbar (~200 lines)
│       ├── ProjectsContent.tsx             # Main content area (~250 lines)
│       ├── WorkspaceModeToggle.tsx         # Projects/Tasks toggle (~50 lines)
│       └── modals/
│           ├── CreateDashboardModal.tsx    # Create dashboard (~300 lines)
│           ├── AddWidgetDialog.tsx         # Add widget to dashboard (~80 lines)
│           ├── SaveViewDialog.tsx          # Save view (~80 lines)
│           └── DeleteConfirmDialogs.tsx    # Delete confirmations (~80 lines)
├── hooks/
│   └── projects-page/
│       ├── useProjectsPageState.ts         # Main state coordinator (~100 lines)
│       ├── useProjectsData.ts              # Data fetching queries (~120 lines)
│       ├── useProjectFiltering.ts          # Filtering logic (~180 lines)
│       ├── useViewManagement.ts            # View load/save (~200 lines)
│       ├── useDashboardManagement.ts       # Dashboard CRUD (~150 lines)
│       ├── useProjectsMutations.ts         # All mutations (~150 lines)
│       └── useProjectsUrlSync.ts           # URL parameter sync (~100 lines)
└── lib/
    └── projectFilterUtils.ts               # Filter utility functions (~100 lines)
```

---

## Staged Implementation Approach

### Stage 1: Setup and Extract Types
**Goal:** Create infrastructure and shared types

1. Create directory: `client/src/components/projects-page/`
2. Create directory: `client/src/hooks/projects-page/`
3. Extract types to `client/src/types/projects-page.ts`:
   ```typescript
   export type ViewMode = "kanban" | "list" | "dashboard" | "calendar";
   export type WorkspaceMode = "projects" | "tasks";
   
   export interface Widget {
     id: string;
     type: "bar" | "pie" | "number" | "line";
     title: string;
     groupBy: "projectType" | "status" | "assignee" | "serviceOwner" | "daysOverdue";
     metric?: string;
   }
   
   export interface Dashboard { ... }
   
   export interface ProjectFilters {
     serviceFilter: string;
     taskAssigneeFilter: string;
     serviceOwnerFilter: string;
     userFilter: string;
     showArchived: boolean;
     showCompletedRegardless: boolean;
     dynamicDateFilter: string;
     customDateRange: { from: Date | undefined; to: Date | undefined };
     serviceDueDateFilter: string;
     scheduleStatusFilter: string;
   }
   
   export interface DashboardFilters extends ProjectFilters {
     clientFilter: string;
     projectTypeFilter: string;
   }
   ```
4. **Verification:** Application compiles and runs

---

### Stage 2: Extract Data Fetching Hook
**Goal:** Centralize all useQuery calls

1. Create `hooks/projects-page/useProjectsData.ts`
2. Move these queries:
   - projects query
   - users query
   - allServices query
   - savedViews query
   - dashboards query
   - userProjectPreferences query
   - allClients query
   - allProjectTypes query
   - allStages query
   - openTasksData query
3. Return data and loading states as a single object
4. **Verification:**
   - Projects page loads
   - All dropdowns populate correctly
   - Task badge shows correct count

**Hook interface:**
```typescript
export function useProjectsData(userId: string, isAuthenticated: boolean, isAdmin: boolean, viewMode: ViewMode) {
  return {
    projects,
    projectsLoading,
    users,
    usersLoading,
    allServices,
    savedViews,
    dashboards,
    userProjectPreferences,
    allClients,
    allProjectTypes,
    allStages,
    allStagesMap,
    stagesLoading,
    stagesError,
    openTasksAndRemindersCount,
    handleRefresh,
    error,
  };
}
```

---

### Stage 3: Extract Filtering Logic
**Goal:** Centralize complex filtering

1. Create `lib/projectFilterUtils.ts` for pure filter functions:
   ```typescript
   export function filterByService(project, serviceId) { ... }
   export function filterByAssignee(project, assigneeId) { ... }
   export function filterByDateRange(project, dateFilter, customRange) { ... }
   export function filterByScheduleStatus(project, status, stagesMap) { ... }
   export function filterByArchiveStatus(project, showArchived, viewMode) { ... }
   ```

2. Create `hooks/projects-page/useProjectFiltering.ts`:
   ```typescript
   export function useProjectFiltering(
     projects: ProjectWithRelations[],
     filters: ProjectFilters,
     stagesMap: Map<string, number>,
     stagesLoading: boolean,
     stagesError: boolean,
     viewMode: ViewMode,
     isManagerOrAdmin: boolean
   ) {
     const filteredProjects = useMemo(() => { ... }, [deps]);
     const activeFilterCount = useMemo(() => { ... }, [deps]);
     return { filteredProjects, activeFilterCount };
   }
   ```

3. Move the massive ~160 line `filteredProjects` useMemo logic
4. **Verification:**
   - Apply filters and verify correct results
   - Check schedule status filtering works
   - Verify pagination works with filtered data

---

### Stage 4: Extract URL Sync Hook
**Goal:** Isolate URL parameter handling

1. Create `hooks/projects-page/useProjectsUrlSync.ts`
2. Move:
   - URL query parameter reading on mount
   - scheduleStatus URL sync effect
   - Location-based filter updates
3. **Verification:**
   - Navigate with query params (?taskAssigneeFilter=xxx)
   - Verify filters apply correctly
   - Check URL updates when filters change

---

### Stage 5: Extract Mutations Hook
**Goal:** Centralize all mutation logic

1. Create `hooks/projects-page/useProjectsMutations.ts`
2. Move all mutations:
   - saveViewMutation
   - updateViewMutation
   - saveDashboardMutation
   - deleteViewMutation
   - deleteDashboardMutation
   - saveLastViewedMutation
3. Return mutation functions and pending states
4. **Verification:**
   - Save a new view
   - Update an existing view
   - Delete a view
   - Create/edit/delete dashboards

---

### Stage 6: Extract View Management Hook
**Goal:** Centralize view loading/saving logic

1. Create `hooks/projects-page/useViewManagement.ts`
2. Move:
   - handleLoadSavedView
   - handleLoadDashboard
   - handleSaveCurrentView
   - handleUpdateCurrentView
   - handleViewAllProjects
   - handleManualViewModeChange
   - handleCalendarEventClick
   - Default view application effect
3. **Verification:**
   - Load saved views
   - Load dashboards
   - Save new views
   - "View All Projects" resets correctly

---

### Stage 7: Extract Dashboard Management Hook
**Goal:** Centralize dashboard widget handling

1. Create `hooks/projects-page/useDashboardManagement.ts`
2. Move:
   - Dashboard state (currentDashboard, dashboardWidgets, etc.)
   - Dashboard filter state (dashboardServiceFilter, etc.)
   - handleAddWidgetToNewDashboard
   - handleRemoveWidgetFromNewDashboard
   - handleSaveNewDashboard
   - handleSaveDashboardAsNew
   - New widget state (newWidgetType, etc.)
3. **Verification:**
   - Create new dashboard with widgets
   - Edit existing dashboard
   - Add/remove widgets
   - Save dashboard changes

---

### Stage 8: Extract Create Dashboard Modal
**Goal:** Separate largest modal component

1. Create `components/projects-page/modals/CreateDashboardModal.tsx`
2. Move the ~315 lines of modal JSX
3. Accept props:
   ```typescript
   interface CreateDashboardModalProps {
     open: boolean;
     onOpenChange: (open: boolean) => void;
     isCreating: boolean;
     dashboardState: DashboardState;
     filters: DashboardFilters;
     widgets: Widget[];
     services: Service[];
     users: User[];
     taskAssignees: User[];
     serviceOwners: User[];
     allClients: Client[];
     allProjectTypes: ProjectType[];
     isManagerOrAdmin: boolean;
     onSave: () => void;
     onAddWidget: () => void;
     onRemoveWidget: (id: string) => void;
     isSaving: boolean;
   }
   ```
4. **Verification:**
   - Open create dashboard modal
   - Configure filters
   - Add/remove widgets
   - Save dashboard

---

### Stage 9: Extract Smaller Modals
**Goal:** Extract remaining modal components

1. Create `components/projects-page/modals/AddWidgetDialog.tsx` (~80 lines)
2. Create `components/projects-page/modals/SaveViewDialog.tsx` (~80 lines)
3. Create `components/projects-page/modals/DeleteConfirmDialogs.tsx`:
   - DeleteViewDialog
   - DeleteDashboardDialog
4. **Verification:**
   - All modals open and function correctly
   - Confirmations trigger correct actions

---

### Stage 10: Extract Header Component
**Goal:** Separate toolbar/header rendering

1. Create `components/projects-page/ProjectsHeader.tsx`
2. Move:
   - Workspace mode toggle
   - Desktop toolbar (view buttons, filters, compact mode)
   - Mobile toolbar
   - Tasks filter popover
3. Accept props for all state and callbacks
4. **Verification:**
   - Switch between Projects/Tasks modes
   - Switch view modes (list/kanban/calendar/dashboard)
   - Open filter panel
   - Toggle compact mode

---

### Stage 11: Extract Content Component
**Goal:** Separate main content rendering

1. Create `components/projects-page/ProjectsContent.tsx`
2. Move:
   - TasksWorkspace rendering
   - Mobile PullToRefresh wrapper
   - Desktop content area
   - Loading states
   - Conditional view rendering (Dashboard/Kanban/Calendar/List)
   - Pagination controls
3. **Verification:**
   - All view modes render correctly
   - Pull-to-refresh works on mobile
   - Pagination works in list view

---

### Stage 12: Create Main State Coordinator
**Goal:** Orchestrate all hooks in main page

1. Create `hooks/projects-page/useProjectsPageState.ts`
2. Combine all hooks into single orchestrator:
   ```typescript
   export function useProjectsPageState() {
     const { user, isLoading, isAuthenticated } = useAuth();
     
     // Core state
     const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("projects");
     const [viewMode, setViewMode] = useState<ViewMode>("list");
     const [filters, setFilters] = useState<ProjectFilters>(defaultFilters);
     
     // Data
     const data = useProjectsData(user?.id, isAuthenticated, user?.isAdmin, viewMode);
     
     // Filtering
     const { filteredProjects, activeFilterCount } = useProjectFiltering(...);
     
     // URL sync
     useProjectsUrlSync(filters, setFilters);
     
     // Mutations
     const mutations = useProjectsMutations();
     
     // View management
     const viewManagement = useViewManagement(...);
     
     // Dashboard management
     const dashboardManagement = useDashboardManagement(...);
     
     return {
       user,
       isLoading,
       workspaceMode,
       setWorkspaceMode,
       viewMode,
       filters,
       setFilters,
       data,
       filteredProjects,
       activeFilterCount,
       mutations,
       viewManagement,
       dashboardManagement,
       // ... other state
     };
   }
   ```
3. **Verification:** Full application test

---

### Stage 13: Refactor Main Page Component
**Goal:** Simplify main page to orchestrator role

1. Update `pages/projects.tsx`:
   - Import useProjectsPageState hook
   - Import extracted components
   - Remove all moved code
   - Compose components with state from hook
2. Target structure (~350 lines):
   ```tsx
   export default function Projects() {
     const state = useProjectsPageState();
     
     if (state.isLoading || !state.user) {
       return <LoadingState />;
     }
     
     return (
       <div className="min-h-screen bg-background flex flex-col">
         <TopNavigation user={state.user} />
         
         <ProjectsHeader {...headerProps} />
         
         <ProjectsContent {...contentProps} />
         
         <BottomNav />
         
         <FilterPanel {...filterProps} />
         
         <CreateDashboardModal {...dashboardModalProps} />
         <AddWidgetDialog {...widgetDialogProps} />
         <SaveViewDialog {...viewDialogProps} />
         <DeleteConfirmDialogs {...deleteDialogProps} />
       </div>
     );
   }
   ```
3. **Verification:** Complete functionality test

---

### Stage 14: Cleanup and Optimization
**Goal:** Final cleanup and performance

1. Remove unused imports from all files
2. Add proper TypeScript types throughout
3. Verify no duplicate code remains
4. Add useCallback where beneficial for performance
5. Consider React.memo for pure components
6. **Final Verification:** Full regression test of all features

---

## Validation Checklist

After each stage, verify:

### View Modes
- [ ] List view displays projects correctly
- [ ] Kanban board displays and allows drag-drop
- [ ] Calendar view shows events
- [ ] Dashboard view shows widgets

### Filtering
- [ ] Service filter works
- [ ] Assignee filter works
- [ ] Date filters work
- [ ] Schedule status filter works
- [ ] "Show archived" toggle works
- [ ] Filter count badge updates correctly

### Views & Dashboards
- [ ] Can load saved views
- [ ] Can save new views
- [ ] Can update existing views
- [ ] Can create dashboards
- [ ] Can edit dashboards
- [ ] Can delete views and dashboards

### Tasks Workspace
- [ ] Tasks workspace renders
- [ ] Task filters work
- [ ] Create task/reminder works

### Mobile
- [ ] Mobile toolbar works
- [ ] Pull-to-refresh works
- [ ] Bottom navigation works

---

## State Management Strategy

The current 50+ useState calls will be organized into these domains:

| Domain | State Variables | Target Hook |
|--------|----------------|-------------|
| Core | workspaceMode, viewMode, mobileSearchOpen | useProjectsPageState (root) |
| List Filters | serviceFilter, assigneeFilter, etc. (10 vars) | useProjectsPageState |
| Dashboard Filters | dashboardServiceFilter, etc. (12 vars) | useDashboardManagement |
| Dashboard State | currentDashboard, widgets, editMode (6 vars) | useDashboardManagement |
| New Dashboard | newDashboardName, widgets, etc. (8 vars) | useDashboardManagement |
| Widget Creation | newWidgetType, title, groupBy (3 vars) | useDashboardManagement |
| Kanban State | compactMode, expandedStages (2 vars) | useProjectsPageState |
| Calendar | calendarSettings (1 var) | useViewManagement |
| Modal States | 6 boolean states for dialogs | Respective modal components |
| Pagination | currentPage, itemsPerPage (2 vars) | useProjectFiltering |
| Tasks Filters | ownershipFilter, statusFilter, etc. (4 vars) | Separate or keep in page |

---

## Risk Mitigation

1. **Incremental Extraction:** Each stage is independently testable
2. **No API Changes:** Same data flow, just reorganized
3. **Type Safety:** TypeScript catches interface mismatches
4. **Rollback Possible:** Can revert individual stages
5. **Prop Drilling Managed:** State coordinator pattern prevents excessive drilling

---

## Estimated Timeline

| Stage | Description | Time |
|-------|-------------|------|
| 1 | Setup and Types | 30 min |
| 2 | Data Fetching Hook | 1.5 hours |
| 3 | Filtering Logic | 2 hours |
| 4 | URL Sync Hook | 1 hour |
| 5 | Mutations Hook | 1.5 hours |
| 6 | View Management Hook | 2 hours |
| 7 | Dashboard Management Hook | 2 hours |
| 8 | Create Dashboard Modal | 1.5 hours |
| 9 | Smaller Modals | 1 hour |
| 10 | Header Component | 2 hours |
| 11 | Content Component | 2 hours |
| 12 | State Coordinator | 1.5 hours |
| 13 | Refactor Main Page | 1 hour |
| 14 | Cleanup | 1 hour |
| **Total** | | **~20 hours** |

---

## Notes for Implementation

1. **State Dependencies:** Be careful about state dependencies between hooks
2. **Callback Stability:** Use useCallback for handlers passed to child components
3. **Prop Types:** Create comprehensive interface types before implementing
4. **Testing Order:** Test after each extraction before moving to next
5. **Effect Dependencies:** Carefully review useEffect dependencies when moving
6. **Query Keys:** Maintain same query keys for cache consistency

---

## Dependencies Between Hooks

```
useProjectsPageState (orchestrator)
├── useAuth (external)
├── useProjectsData
│   └── depends on: user, isAuthenticated, viewMode
├── useProjectFiltering
│   └── depends on: projects, filters, stagesMap, viewMode
├── useProjectsUrlSync
│   └── depends on: filters (reads and writes)
├── useViewManagement
│   └── depends on: filters, viewMode, mutations, data
├── useDashboardManagement
│   └── depends on: mutations, data.services
└── useProjectsMutations
    └── standalone (no internal dependencies)
```

---

## Post-Refactoring Improvements (Future)

After the split is complete, consider:

1. Adding unit tests for each custom hook
2. Creating Storybook stories for extracted components
3. Adding performance monitoring for heavy computations
4. Implementing React.lazy for modal components
5. Adding error boundaries around view components
6. Creating integration tests for view switching
