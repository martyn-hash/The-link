# Project-Type-Detail Refactoring - Revised Plan (Phase 2)

## Executive Summary

This document outlines the remaining work to complete the project-type-detail refactoring, targeting reduction from **2,253 lines to ~400 lines** (82% additional reduction). The refactoring follows proven patterns from the client-detail page refactoring.

---

## ✅ STAGE R1 COMPLETED - November 25, 2025

### Results
- **Lines Before:** 2,253
- **Lines After:** 1,745
- **Lines Saved:** 508 (22.5% reduction)
- **Total Reduction from Original 3,773:** 2,028 lines (53.7%)

### Hooks Created (8 total)
| Hook | Location | Mutations |
|------|----------|-----------|
| useStageMutations | hooks/useStageMutations.ts | create, update, delete |
| useReasonMutations | hooks/useReasonMutations.ts | create, update, delete |
| useStageApprovalMutations | hooks/useStageApprovalMutations.ts | create, update, delete |
| useStageReasonMapMutations | hooks/useStageReasonMapMutations.ts | create, delete |
| useProjectTypeSettingsMutations | hooks/useProjectTypeSettingsMutations.ts | serviceLinkage, notificationsActive, active, singleProject |
| useCustomFieldMutations | hooks/useCustomFieldMutations.ts | create, update, delete |
| useApprovalFieldMutations | hooks/useApprovalFieldMutations.ts | create, update, delete |
| useNotificationMutations | hooks/useNotificationMutations.ts | create, update, delete, reschedule, + reminder CRUD |

### Key Patterns Applied
- All hooks accept `callbacks` parameter for state management
- Toast notifications and query invalidation handled within hooks
- Main component passes state setters via callbacks
- Handler functions (handleActiveToggle, handleSingleProjectToggle) remain in main component for validation logic

### Testing
- E2E tests passed for stage CRUD operations
- E2E tests passed for reason CRUD operations
- Architect review passed

---

---

## ⚠️ TESTING PREREQUISITES - READ BEFORE EACH BROWSER TEST SESSION

### Login Credentials
- **URL:** Root page (`/`)
- **Tab:** Password tab
- **Email:** `admin@example.com`
- **Password:** `admin123`

### Known Bugs
1. **Projects Loading Bug:** Sometimes projects do not load
   - **Workaround:** Refresh the browser and restart the testing session
   - **Impact:** May affect overall application behavior

### Pre-Test Checklist
Before each browser testing session:
- [ ] Ensure you're logged out or in a fresh session
- [ ] Navigate to root page `/`
- [ ] Select Password tab
- [ ] Login with admin@example.com / admin123
- [ ] If projects don't load, refresh browser and restart test session
- [ ] Navigate to Settings → click on any Project Type to access project-type-detail page

### Test Navigation Path
1. Login → Settings page
2. Click on any project type (e.g., "Annual Accounts", "VAT Return")
3. Verify all 5 tabs load: Kanban Stages, Change Reasons, Stage Approvals, Notifications, Settings

---

## Current State Analysis

### File Statistics (After Phase 1)
- **Current Lines:** 2,253
- **Target Lines:** ~400
- **Reduction Needed:** ~1,850 lines (~82%)

### Code Structure Breakdown

| Section | Lines | Start-End | Description |
|---------|-------|-----------|-------------|
| Imports | 78 | 1-78 | External and local imports |
| State Variables | 38 | 87-119 | useState declarations |
| Auth & Queries | 90 | 118-208 | Auth effects, useProjectTypeQueries hook call |
| **Mutations** | **596** | **210-805** | 28 useMutation hooks |
| Loading States | 60 | 807-866 | Auth loading, projectType loading, not found |
| Handler Functions | 102 | 867-969 | handleStageSubmit, handleReasonSubmit, handleStageApprovalSubmit |
| Header JSX | 96 | 971-1067 | TopNavigation, breadcrumbs, toggles |
| Tab List | 27 | 1069-1096 | TabsList with 5 triggers |
| **Kanban Stages Tab** | **366** | **1097-1463** | Full stage management UI |
| **Change Reasons Tab** | **302** | **1466-1768** | Reason management with custom fields |
| **Stage Approvals Tab** | **258** | **1770-2027** | Approval management with fields |
| **Notifications Tab** | **208** | **2028-2236** | Project & stage notifications |
| Settings Tab | 15 | 2239-2253 | Already extracted component |

### Mutations Inventory (28 Total)

| Domain | Mutation | Lines | Callbacks |
|--------|----------|-------|-----------|
| **Stages** | createStageMutation | 19 | toast, invalidate, setIsAddingStage, setEditingStage |
| | updateStageMutation | 17 | toast, invalidate, setEditingStage |
| | deleteStageMutation | 16 | toast, invalidate |
| **Reasons** | createReasonMutation | 18 | toast, invalidate, setIsAddingReason, setEditingReason |
| | updateReasonMutation | 16 | toast, invalidate, setEditingReason |
| | deleteReasonMutation | 15 | toast, invalidate |
| **Stage Approvals** | createStageApprovalMutation | 19 | toast, invalidate, setIsAddingStageApproval, setEditingStageApproval |
| | updateStageApprovalMutation | 16 | toast, invalidate, setEditingStageApproval |
| | deleteStageApprovalMutation | 15 | toast, invalidate |
| **Stage-Reason Maps** | createStageReasonMapMutation | 13 | invalidate |
| | deleteStageReasonMapMutation | 13 | toast, invalidate |
| **Project Type Settings** | updateProjectTypeServiceLinkageMutation | 27 | toast, invalidate, setIsEditingServiceLinkage, setSelectedServiceId |
| | toggleNotificationsActiveMutation | 22 | toast, invalidate |
| | updateProjectTypeActiveMutation | 39 | toast (with error cases), invalidate |
| | updateProjectTypeSingleProjectMutation | 23 | toast, invalidate |
| **Custom Fields** | createCustomFieldMutation | 17 | toast, invalidate |
| | updateCustomFieldMutation | 14 | invalidate |
| | deleteCustomFieldMutation | 17 | toast, invalidate |
| **Approval Fields** | createApprovalFieldMutation | 14 | invalidate |
| | updateApprovalFieldMutation | 17 | toast, invalidate |
| | deleteApprovalFieldMutation | 17 | toast, invalidate |
| **Notifications** | createNotificationMutation | 19 | toast, invalidate, setIsAddingProjectNotification, setIsAddingStageNotification, setEditingNotification |
| | updateNotificationMutation | 15 | toast, invalidate, setEditingNotification |
| | deleteNotificationMutation | 15 | toast, invalidate |
| | rescheduleNotificationsMutation | 27 | toast, setShowRescheduleDialog, invalidate |
| **Reminders** | createReminderMutation | 16 | toast, invalidate, setAddingReminderForNotification |
| | updateReminderMutation | 16 | toast, invalidate, setEditingReminder |
| | deleteReminderMutation | 15 | toast, invalidate |

---

## Revised Refactoring Stages

### Stage R1: Extract Domain Mutation Hooks (~300 lines saved)
**Goal:** Extract all mutations into domain-specific hooks with callback parameters

#### R1.1: Stage Mutations Hook
**File:** `hooks/useStageMutations.ts`
**Lines to extract:** ~52 (lines 210-264)
**Pattern:**
```typescript
interface StageMutationCallbacks {
  onStageCreated?: () => void;
  onStageUpdated?: () => void;
  onStageDeleted?: () => void;
}

export function useStageMutations(
  projectTypeId: string | undefined,
  callbacks: StageMutationCallbacks = {}
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createStageMutation = useMutation({
    mutationFn: async (stage: Omit<EditingStage, 'id'>) => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", "/api/config/stages", { ...stage, projectTypeId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stages"] });
      callbacks.onStageCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create stage",
        variant: "destructive",
      });
    },
  });
  
  // ... updateStageMutation, deleteStageMutation
  
  return { createStageMutation, updateStageMutation, deleteStageMutation };
}
```

**Success Criteria:**
- [ ] Hook accepts `projectTypeId` and callbacks object
- [ ] Returns all three stage mutations
- [ ] Main component uses hook with callbacks to reset state
- [ ] All stage CRUD operations work correctly

**Testing:**
1. Navigate to any project type detail page
2. Click "Add Stage" → fill form → save → verify stage created
3. Click edit on existing stage → modify → save → verify updated
4. Click delete on stage → verify deleted
5. Check toast messages appear correctly

---

#### R1.2: Reason Mutations Hook
**File:** `hooks/useReasonMutations.ts`
**Lines to extract:** ~49 (lines 266-320)

**Success Criteria:**
- [ ] Hook accepts `projectTypeId` and callbacks object
- [ ] Returns create/update/delete reason mutations
- [ ] Custom field mutations remain in parent (they're used with editing form state)

**Testing:**
1. Navigate to Change Reasons tab
2. Add new reason → verify created
3. Edit existing reason → verify updated
4. Delete reason → verify deleted

---

#### R1.3: Stage Approval Mutations Hook
**File:** `hooks/useStageApprovalMutations.ts`
**Lines to extract:** ~52 (lines 322-376)

**Success Criteria:**
- [ ] Hook handles create/update/delete for stage approvals
- [ ] Approval field mutations remain separate (complex state interactions)

**Testing:**
1. Navigate to Stage Approvals tab
2. Add new approval → verify created
3. Edit approval → verify updated
4. Delete approval → verify deleted

---

#### R1.4: Stage-Reason Map Mutations Hook
**File:** `hooks/useStageReasonMapMutations.ts`
**Lines to extract:** ~26 (lines 378-409)

**Success Criteria:**
- [ ] Simple hook with create/delete mutations
- [ ] Used in handleStageSubmit for managing mappings

**Testing:**
1. Edit a stage → check/uncheck change reasons
2. Save stage → verify mappings created/deleted correctly

---

#### R1.5: Project Type Settings Mutations Hook
**File:** `hooks/useProjectTypeSettingsMutations.ts`
**Lines to extract:** ~111 (lines 411-604)
**Includes:** serviceLinkage, notificationsActive, active, singleProject

**Note:** This hook handles more complex mutations with error handling for specific cases (PROJECTS_USING_TYPE, NO_FINAL_STAGE)

**Success Criteria:**
- [ ] All 4 project type setting mutations extracted
- [ ] Error handling for specific error codes preserved
- [ ] handleActiveToggle and handleSingleProjectToggle remain in main (they use local state/stages)

**Testing:**
1. Settings tab → change service linkage → verify works
2. Toggle "Active" status → verify validation for final stage
3. Toggle "Single Project Per Client" → verify saves
4. Toggle "Notifications Active" → verify saves

---

#### R1.6: Custom Field Mutations Hook
**File:** `hooks/useCustomFieldMutations.ts`
**Lines to extract:** ~48 (lines 466-521)

**Success Criteria:**
- [ ] Create/update/delete mutations for custom fields
- [ ] Used in Change Reasons tab for field management

**Testing:**
1. Edit reason → add custom field → verify created
2. Delete custom field → verify deleted

---

#### R1.7: Approval Field Mutations Hook
**File:** `hooks/useApprovalFieldMutations.ts`
**Lines to extract:** ~52 (lines 610-665)

**Success Criteria:**
- [ ] Create/update/delete mutations for approval fields
- [ ] Used in Stage Approvals tab

**Testing:**
1. Edit stage approval → add field → verify created
2. Edit field → verify updated
3. Delete field → verify deleted

---

#### R1.8: Notification Mutations Hook
**File:** `hooks/useNotificationMutations.ts`
**Lines to extract:** ~95 (lines 667-805)
**Includes:** create, update, delete, reschedule notifications + reminder mutations

**Success Criteria:**
- [ ] All notification and reminder mutations in one hook
- [ ] Reschedule mutation with complex success handling preserved

**Testing:**
1. Notifications tab → add project notification → verify created
2. Add stage notification → verify created
3. Delete notification → verify deleted
4. Admin: click "Reschedule Notifications" → verify dialog and action work

---

### Stage R2: Kanban Stages Tab Extraction (~366 lines saved)
**Goal:** Extract the entire Kanban Stages tab content to a standalone component

**File:** `components/tabs/KanbanStagesTab.tsx`
**Lines to extract:** 1097-1463

#### Props Interface
```typescript
interface KanbanStagesTabProps {
  // Data
  projectType: ProjectType;
  stages: KanbanStage[] | undefined;
  stagesLoading: boolean;
  reasons: ChangeReason[] | undefined;
  reasonsLoading: boolean;
  stageApprovals: StageApproval[] | undefined;
  stageApprovalsLoading: boolean;
  availableRoles: Array<{ value: string; label: string }>;
  rolesLoading: boolean;
  usersLoading: boolean;
  allStageReasonMaps: any[] | undefined;
  
  // Edit state
  editingStage: EditingStage | null;
  setEditingStage: (stage: EditingStage | null) => void;
  isAddingStage: boolean;
  setIsAddingStage: (adding: boolean) => void;
  selectedStageReasons: string[];
  setSelectedStageReasons: (reasons: string[]) => void;
  selectedStageApprovalId: string | null;
  setSelectedStageApprovalId: (id: string | null) => void;
  
  // Mutations
  stageMutations: ReturnType<typeof useStageMutations>;
  stageReasonMapMutations: ReturnType<typeof useStageReasonMapMutations>;
  
  // Handlers
  onStageSubmit: () => void;
  getStageRoleLabel: (stage: any) => string;
}
```

#### Internal Structure
- Stage list with cards (view mode)
- Empty state with add button
- Stage editing form card with:
  - Name, role, order, color inputs
  - Max instance/total time inputs
  - Stage approval selector
  - "Can be final stage" checkbox
  - Change reasons multi-select
  - Save/Cancel buttons

**Success Criteria:**
- [ ] Tab renders identical to current implementation
- [ ] All stage CRUD operations work
- [ ] Stage-reason mappings work
- [ ] Color picker works
- [ ] Role selection works for both service-linked and non-service types

**Testing:**
1. Full stage CRUD cycle
2. Edit stage → select reasons → save → verify mappings
3. Verify color picker functionality
4. Verify role dropdown shows correct options based on service linkage

---

### Stage R3: Change Reasons Tab Extraction (~302 lines saved)
**Goal:** Extract the Change Reasons tab to a standalone component

**File:** `components/tabs/ChangeReasonsTab.tsx`
**Lines to extract:** 1466-1768

#### Props Interface
```typescript
interface ChangeReasonsTabProps {
  // Data
  reasons: ChangeReason[] | undefined;
  reasonsLoading: boolean;
  stageApprovals: StageApproval[] | undefined;
  stageApprovalsLoading: boolean;
  allCustomFields: any[] | undefined;
  
  // Edit state
  editingReason: EditingReason | null;
  setEditingReason: (reason: EditingReason | null) => void;
  isAddingReason: boolean;
  setIsAddingReason: (adding: boolean) => void;
  isAddingCustomField: boolean;
  setIsAddingCustomField: (adding: boolean) => void;
  
  // Mutations
  reasonMutations: ReturnType<typeof useReasonMutations>;
  customFieldMutations: ReturnType<typeof useCustomFieldMutations>;
  
  // Handlers
  onReasonSubmit: () => void;
}
```

#### Internal Structure
- Reason list with cards
- Empty state
- Reason editing form with:
  - Name, description inputs
  - Show count checkbox + label input
  - Stage approval selector
  - Custom fields management section
  - CustomFieldForm integration

**Success Criteria:**
- [ ] Tab renders identically
- [ ] All reason CRUD works
- [ ] Custom fields can be added/deleted from reasons
- [ ] Stage approval selector works

**Testing:**
1. Full reason CRUD cycle
2. Add reason → enable "show count" → set label → save
3. Edit reason → add custom field → save → verify field shows
4. Delete custom field → verify removed

---

### Stage R4: Stage Approvals Tab Extraction (~258 lines saved)
**Goal:** Extract the Stage Approvals tab to a standalone component

**File:** `components/tabs/StageApprovalsTab.tsx`
**Lines to extract:** 1770-2027

#### Props Interface
```typescript
interface StageApprovalsTabProps {
  // Data
  stageApprovals: StageApproval[] | undefined;
  stageApprovalsLoading: boolean;
  allStageApprovalFields: StageApprovalField[] | undefined;
  stageApprovalFieldsLoading: boolean;
  
  // Edit state
  editingStageApproval: EditingStageApproval | null;
  setEditingStageApproval: (approval: EditingStageApproval | null) => void;
  isAddingStageApproval: boolean;
  setIsAddingStageApproval: (adding: boolean) => void;
  editingStageApprovalField: EditingStageApprovalField | null;
  setEditingStageApprovalField: (field: EditingStageApprovalField | null) => void;
  isAddingApprovalField: boolean;
  setIsAddingApprovalField: (adding: boolean) => void;
  
  // Mutations
  stageApprovalMutations: ReturnType<typeof useStageApprovalMutations>;
  approvalFieldMutations: ReturnType<typeof useApprovalFieldMutations>;
  
  // Handlers
  onStageApprovalSubmit: () => void;
}
```

#### Internal Structure
- Approval list with cards showing field count
- Empty state
- Approval editing form with:
  - Name, description inputs
  - Approval fields management section
  - ApprovalFieldForm integration (add/edit modes)

**Success Criteria:**
- [ ] Tab renders identically
- [ ] All stage approval CRUD works
- [ ] Approval fields can be added/edited/deleted
- [ ] Field types (boolean, number, text, multi-select) work correctly

**Testing:**
1. Full stage approval CRUD cycle
2. Add approval → add boolean field → save
3. Add number field with min/max → save
4. Add multi-select field with options → save
5. Edit field → verify changes persist
6. Delete field → verify removed

---

### Stage R5: Notifications Tab Extraction (~208 lines saved)
**Goal:** Extract the Notifications tab to a standalone component

**File:** `components/tabs/NotificationsTab.tsx`
**Lines to extract:** 2028-2236

#### Props Interface
```typescript
interface NotificationsTabProps {
  // Data
  projectType: ProjectType;
  projectTypeId: string | undefined;
  notifications: ProjectTypeNotification[] | undefined;
  notificationsLoading: boolean;
  stages: KanbanStage[] | undefined;
  clientRequestTemplates: ClientRequestTemplate[] | undefined;
  isAdmin: boolean;
  
  // UI state
  isAddingProjectNotification: boolean;
  setIsAddingProjectNotification: (adding: boolean) => void;
  isAddingStageNotification: boolean;
  setIsAddingStageNotification: (adding: boolean) => void;
  showRescheduleDialog: boolean;
  setShowRescheduleDialog: (show: boolean) => void;
  
  // Mutations
  notificationMutations: ReturnType<typeof useNotificationMutations>;
}
```

#### Internal Structure
- Notifications master toggle card
- Project Notifications section:
  - Add button
  - ProjectNotificationForm (conditional)
  - Table with NotificationRow components
- Stage Notifications section:
  - Reschedule button (admin only)
  - Add button
  - StageNotificationForm (conditional)
  - Table with NotificationRow components

**Special Considerations:**
- Admin-only reschedule functionality
- AlertDialog for confirmation
- Loading state for reschedule mutation

**Success Criteria:**
- [ ] Tab renders identically
- [ ] Master notifications toggle works
- [ ] Project notifications CRUD works
- [ ] Stage notifications CRUD works
- [ ] Admin can see and use reschedule button
- [ ] Non-admin cannot see reschedule button

**Testing:**
1. Toggle notifications master switch → verify saves
2. Add project notification → verify created
3. Add stage notification → verify created
4. Delete notification → verify deleted
5. (Admin) Click reschedule → confirm → verify action

---

### Stage R6: Header Component Extraction (~100 lines saved)
**Goal:** Extract the page header with breadcrumbs and toggles

**File:** `components/ProjectTypeHeader.tsx`
**Lines to extract:** 971-1067

#### Props Interface
```typescript
interface ProjectTypeHeaderProps {
  projectType: ProjectType;
  stages: KanbanStage[] | undefined;
  
  // Mutation states
  activeTogglePending: boolean;
  singleProjectTogglePending: boolean;
  
  // Handlers
  onActiveToggle: (checked: boolean) => void;
  onSingleProjectToggle: (checked: boolean) => void;
}
```

**Success Criteria:**
- [ ] Header renders with breadcrumbs
- [ ] Active toggle works with validation
- [ ] Single Project Per Client toggle works
- [ ] Description shows when present

**Testing:**
1. Verify breadcrumb navigation works
2. Toggle active status → verify validation and save
3. Toggle single project → verify saves
4. Verify description displays correctly

---

### Stage R7: Final Cleanup and Barrel Exports (~50 lines overhead)
**Goal:** Create barrel exports, update main component, final verification

#### Tasks:
1. **Create barrel export:** `components/tabs/index.ts`
```typescript
export { KanbanStagesTab } from './KanbanStagesTab';
export { ChangeReasonsTab } from './ChangeReasonsTab';
export { StageApprovalsTab } from './StageApprovalsTab';
export { NotificationsTab } from './NotificationsTab';
export { SettingsTab } from './SettingsTab';
```

2. **Update hooks barrel export:** `hooks/index.ts`
```typescript
export { useProjectTypeQueries } from './useProjectTypeQueries';
export { useStageMutations } from './useStageMutations';
export { useReasonMutations } from './useReasonMutations';
export { useStageApprovalMutations } from './useStageApprovalMutations';
export { useStageReasonMapMutations } from './useStageReasonMapMutations';
export { useProjectTypeSettingsMutations } from './useProjectTypeSettingsMutations';
export { useCustomFieldMutations } from './useCustomFieldMutations';
export { useApprovalFieldMutations } from './useApprovalFieldMutations';
export { useNotificationMutations } from './useNotificationMutations';
```

3. **Update main component** to use all extracted components and hooks

4. **Remove unused imports** from main component

5. **Update replit.md** with final architecture

**Success Criteria:**
- [ ] Main component is ~400 lines
- [ ] All imports clean and organized
- [ ] No dead code
- [ ] Documentation updated

---

## Final Testing Checklist

### Pre-Deployment Verification

#### Tab-by-Tab Testing
- [ ] **Kanban Stages Tab:**
  - Create stage with all fields
  - Edit stage
  - Delete stage
  - Stage-reason mappings
  - Stage approval assignment
  - Color selection
  - "Can be final stage" checkbox

- [ ] **Change Reasons Tab:**
  - Create reason
  - Edit reason with description
  - Enable/disable show count
  - Add/delete custom fields
  - Stage approval override

- [ ] **Stage Approvals Tab:**
  - Create approval
  - Edit approval description
  - Add boolean field
  - Add number field with constraints
  - Add text field
  - Add multi-select field with options
  - Edit/delete fields

- [ ] **Notifications Tab:**
  - Toggle master notifications switch
  - Create project notification (date-based)
  - Create stage notification (trigger-based)
  - Delete notification
  - (Admin) Reschedule all notifications

- [ ] **Settings Tab:**
  - View service linkage
  - Change service linkage
  - Remove service linkage

#### Cross-Tab Validation
- [ ] Changes in one tab reflect in others (e.g., stage approvals appear in Reasons tab)
- [ ] Toast messages appear for all actions
- [ ] Loading states show during mutations
- [ ] Error handling displays correctly

---

## Target Directory Structure

```
client/src/pages/project-type-detail/
├── index.tsx                              # Re-export
├── ProjectTypeDetailPage.tsx              # ~400 lines (orchestration only)
│
├── components/
│   ├── index.ts                           # Barrel export
│   ├── ProjectTypeHeader.tsx              # ~100 lines
│   │
│   ├── tabs/
│   │   ├── index.ts                       # Barrel export
│   │   ├── KanbanStagesTab.tsx            # ~366 lines
│   │   ├── ChangeReasonsTab.tsx           # ~302 lines
│   │   ├── StageApprovalsTab.tsx          # ~258 lines
│   │   ├── NotificationsTab.tsx           # ~208 lines
│   │   └── SettingsTab.tsx                # ~199 lines (existing)
│   │
│   ├── fields/
│   │   ├── index.ts
│   │   ├── CustomFieldForm.tsx            # Existing
│   │   └── ApprovalFieldForm.tsx          # Existing
│   │
│   └── notifications/
│       ├── index.ts
│       ├── ProjectNotificationForm.tsx    # Existing
│       ├── StageNotificationForm.tsx      # Existing
│       ├── NotificationRow.tsx            # Existing
│       └── ReminderForm.tsx               # Existing
│
├── hooks/
│   ├── index.ts                           # Barrel export
│   ├── useProjectTypeQueries.ts           # Existing (~137 lines)
│   ├── useStageMutations.ts               # ~60 lines
│   ├── useReasonMutations.ts              # ~55 lines
│   ├── useStageApprovalMutations.ts       # ~55 lines
│   ├── useStageReasonMapMutations.ts      # ~35 lines
│   ├── useProjectTypeSettingsMutations.ts # ~120 lines
│   ├── useCustomFieldMutations.ts         # ~55 lines
│   ├── useApprovalFieldMutations.ts       # ~55 lines
│   └── useNotificationMutations.ts        # ~110 lines
│
└── utils/
    ├── index.ts
    ├── constants.ts                       # Existing
    ├── types.ts                           # Existing
    └── helpers.tsx                        # Existing
```

---

## Stage Execution Order

| Stage | Description | Lines Saved | Dependencies |
|-------|-------------|-------------|--------------|
| R1.1 | Stage Mutations Hook | ~52 | None |
| R1.2 | Reason Mutations Hook | ~49 | None |
| R1.3 | Stage Approval Mutations Hook | ~52 | None |
| R1.4 | Stage-Reason Map Mutations Hook | ~26 | None |
| R1.5 | Project Type Settings Mutations Hook | ~111 | None |
| R1.6 | Custom Field Mutations Hook | ~48 | None |
| R1.7 | Approval Field Mutations Hook | ~52 | None |
| R1.8 | Notification Mutations Hook | ~95 | None |
| R2 | Kanban Stages Tab | ~366 | R1.1, R1.4 |
| R3 | Change Reasons Tab | ~302 | R1.2, R1.6 |
| R4 | Stage Approvals Tab | ~258 | R1.3, R1.7 |
| R5 | Notifications Tab | ~208 | R1.5, R1.8 |
| R6 | Header Component | ~100 | R1.5 |
| R7 | Final Cleanup | N/A | All stages |

**Estimated Total Time:** 12-16 hours

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.0 | 2025-11-25 | Agent | Revised plan for Phase 2 completion |
