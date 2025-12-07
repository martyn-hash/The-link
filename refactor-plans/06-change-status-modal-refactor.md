# Refactoring Plan: client/src/components/ChangeStatusModal.tsx

## Overview

**File:** `client/src/components/ChangeStatusModal.tsx`  
**Current Size:** 2,189 lines  
**Priority:** #6 (Final in refactoring order)  
**Risk Level:** VERY HIGH - Core workflow component, stage changes, notifications, approvals  
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

`ChangeStatusModal.tsx` is a 2,189-line component handling multiple complex responsibilities:
- Stage/status change functionality
- Client notification composition and sending
- Staff notification composition and sending  
- Dynamic stage approval forms
- Query entry and bulk import
- File uploads for attachments
- Custom field handling
- Voice recording for AI-assisted drafting

The component contains ~45 useState hooks across two components (main + inline NotificationContent), making it extremely difficult to maintain and test.

---

## Scope Definition

### In Scope
- Breaking into smaller, focused components
- Extracting the inline NotificationContent component to its own file
- Extracting state management into custom hooks
- Separating the three modal views into distinct components
- Moving form schemas and validation logic to dedicated files

### Out of Scope
- Changing UI/UX behavior
- Modifying API endpoints or data structures
- Changing notification sending logic
- Adding new features

---

## Success Criteria

1. **Functional Parity:** All modal views and features work identically
2. **File Size Reduction:** Main modal component < 400 lines
3. **State Extraction:** Custom hooks for each state domain
4. **No Regressions:** Stage changes, notifications, approvals, queries all work
5. **Consistent Patterns:** All extracted components follow same patterns
6. **Testability:** Each hook/component can be unit tested independently

---

## Current Structure Analysis

| Section | Lines | Description | Target Location |
|---------|-------|-------------|-----------------|
| Imports | 1-65 (~65) | UI components, icons, utilities | Keep in respective files |
| Helper Functions | 66-200 (~135) | formatStageName, formatRoleName, etc. | `lib/changeStatusUtils.ts` |
| NotificationContent | 202-695 (~495) | Staff notification component | `StaffNotificationContent.tsx` |
| Props Interface | 697-720 (~25) | Main component props | `types/changeStatus.ts` |
| State Declarations | 721-850 (~130) | ~25 useState hooks | Custom hooks |
| Stage Config Query | 851-920 (~70) | useQuery for stage config | `useStageChangeConfig` hook |
| Dynamic Schema | 921-1020 (~100) | Zod schema generation | `useApprovalFormSchema` hook |
| Approval Form | 1021-1150 (~130) | react-hook-form setup | `StageApprovalForm.tsx` |
| Mutations | 1151-1350 (~200) | 4 mutation definitions | `useStatusChangeMutations` hook |
| Custom Field Handlers | 1351-1450 (~100) | Validation, change handlers | `useCustomFields` hook |
| File Upload Handlers | 1451-1520 (~70) | File handling logic | `useFileUpload` hook |
| Queries Handlers | 1521-1620 (~100) | Query add/remove/import | `useQueriesManagement` hook |
| Client Notification JSX | 1621-1780 (~160) | Client notification view | `ClientNotificationView.tsx` |
| Staff Notification JSX | 1781-1920 (~140) | Staff notification view | Uses `StaffNotificationContent.tsx` |
| Status Change JSX | 1921-2189 (~270) | Main form JSX | `StatusChangeForm.tsx` |

---

## Target File Structure

```
client/src/
├── components/
│   └── change-status/
│       ├── ChangeStatusModal.tsx           # Main orchestrator (~300 lines)
│       ├── StatusChangeForm.tsx            # Stage/reason/notes/attachments (~350 lines)
│       ├── StageApprovalForm.tsx           # Dynamic approval form (~250 lines)
│       ├── QueriesForm.tsx                 # Query entry and bulk import (~200 lines)
│       ├── StaffNotificationContent.tsx    # Staff notification view (~500 lines)
│       ├── ClientNotificationView.tsx      # Client notification view (~200 lines)
│       ├── CustomFieldsSection.tsx         # Custom field rendering (~150 lines)
│       └── AttachmentsSection.tsx          # File upload section (~100 lines)
├── hooks/
│   └── change-status/
│       ├── useStageChangeConfig.ts         # Config query + derived data (~100 lines)
│       ├── useStatusChangeMutations.ts     # All 4 mutations (~200 lines)
│       ├── useApprovalFormSchema.ts        # Dynamic Zod schema (~120 lines)
│       ├── useCustomFields.ts              # Custom field state (~80 lines)
│       ├── useFileUpload.ts                # File upload logic (~80 lines)
│       └── useQueriesManagement.ts         # Queries state + handlers (~100 lines)
├── lib/
│   └── changeStatusUtils.ts                # Helper functions (~120 lines)
└── types/
    └── changeStatus.ts                     # Type definitions (~80 lines)
```

---

## Staged Implementation Approach

### Stage 1: Setup and Extract Types
**Goal:** Create infrastructure and shared types

1. Create directory: `client/src/components/change-status/`
2. Create directory: `client/src/hooks/change-status/`
3. Create `client/src/types/changeStatus.ts`:
   ```typescript
   export interface ChangeStatusModalProps {
     projectId: string;
     projectName: string;
     clientName: string;
     clientId: string;
     currentStage: string;
     currentStageIndex: number;
     isOpen: boolean;
     onClose: () => void;
     onStatusChanged?: () => void;
     showClientNotification?: boolean;
     showStaffNotification?: boolean;
     recipientEmail?: string;
     recipientName?: string;
     project?: Project;
   }
   
   export interface StageApprovalField {
     id: string;
     name: string;
     type: "text" | "number" | "date" | "select" | "checkbox" | "file";
     required: boolean;
     options?: string[];
     defaultValue?: any;
   }
   
   export interface CustomFieldValue {
     fieldId: string;
     value: any;
   }
   
   export interface QueryEntry {
     id: string;
     description: string;
     status: "pending" | "resolved";
   }
   
   export type NotificationChannel = "email" | "push" | "sms";
   
   export interface ChannelRecipients {
     email: string[];
     push: string[];
     sms: string[];
   }
   ```
4. Create `client/src/lib/changeStatusUtils.ts`:
   ```typescript
   export function formatStageName(stage: string): string { ... }
   export function formatRoleName(role: string): string { ... }
   export function formatChangeReason(reason: string): string { ... }
   export function formatComparisonType(type: string): string { ... }
   export function getComparisonIcon(type: string): ReactNode { ... }
   export function extractFirstName(fullName: string): string { ... }
   export function getSenderName(user: User): string { ... }
   ```
5. **Verification:** Application compiles and runs

---

### Stage 2: Extract StaffNotificationContent Component
**Goal:** Extract the 495-line inline component

1. Create `components/change-status/StaffNotificationContent.tsx`
2. Move the entire NotificationContent component (lines 202-695)
3. Rename to StaffNotificationContent
4. Define explicit props interface:
   ```typescript
   interface StaffNotificationContentProps {
     projectId: string;
     projectName: string;
     clientName: string;
     currentStage: string;
     newStage: string;
     project?: Project;
     onSend: () => void;
     onCancel: () => void;
     isSending: boolean;
   }
   ```
5. Move all 20+ useState hooks within this component
6. **Verification:**
   - Open a project's status change modal
   - Navigate to staff notification view
   - Verify channel selection works
   - Verify recipient selection works
   - Verify voice recording works (if enabled)
   - Send a test notification

---

### Stage 3: Extract Stage Change Config Hook
**Goal:** Centralize config fetching and derived data

1. Create `hooks/change-status/useStageChangeConfig.ts`
2. Move:
   - Stage change config query
   - Derived data calculations (available stages, required fields, etc.)
3. Return interface:
   ```typescript
   export function useStageChangeConfig(
     projectId: string,
     currentStage: string,
     serviceId?: string
   ) {
     return {
       config,
       isLoading,
       error,
       availableStages,
       stageRequirements,
       approvalFields,
       customFields,
       refetch,
     };
   }
   ```
4. **Verification:**
   - Modal loads stage config correctly
   - Available stages populate in dropdown
   - Custom fields show when required

---

### Stage 4: Extract Mutations Hook
**Goal:** Centralize all mutation logic

1. Create `hooks/change-status/useStatusChangeMutations.ts`
2. Move all 4 mutations:
   - submitApprovalResponses
   - updateStatus
   - sendClientNotification
   - sendNotification (staff)
3. Return interface:
   ```typescript
   export function useStatusChangeMutations(projectId: string) {
     return {
       updateStatus: { mutate, isPending },
       submitApproval: { mutate, isPending },
       sendClientNotification: { mutate, isPending },
       sendStaffNotification: { mutate, isPending },
     };
   }
   ```
4. **Verification:**
   - Change project status
   - Submit approval form
   - Send client notification
   - Send staff notification

---

### Stage 5: Extract Approval Form Schema Hook
**Goal:** Isolate dynamic Zod schema generation

1. Create `hooks/change-status/useApprovalFormSchema.ts`
2. Move:
   - Dynamic schema generation logic
   - Approval field type mapping
   - Default values generation
3. Return interface:
   ```typescript
   export function useApprovalFormSchema(approvalFields: StageApprovalField[]) {
     return {
       schema,
       defaultValues,
       fieldTypes,
     };
   }
   ```
4. **Verification:**
   - Stage with approval form displays correctly
   - All field types render (text, number, date, select, checkbox, file)
   - Validation works on required fields
   - Form submits with correct data

---

### Stage 6: Extract Custom Fields Hook
**Goal:** Isolate custom field state management

1. Create `hooks/change-status/useCustomFields.ts`
2. Move:
   - customFieldValues state
   - validateCustomFields function
   - handleCustomFieldChange function
   - formatFieldResponses function
3. Return interface:
   ```typescript
   export function useCustomFields(customFields: CustomField[]) {
     return {
       values,
       errors,
       handleChange,
       validate,
       formatResponses,
       reset,
     };
   }
   ```
4. **Verification:**
   - Custom fields display correctly
   - Values update on change
   - Validation errors display
   - Values include in submission

---

### Stage 7: Extract File Upload Hook
**Goal:** Isolate file handling logic

1. Create `hooks/change-status/useFileUpload.ts`
2. Move:
   - selectedFiles state
   - File change handler
   - File remove handler
   - File upload logic
3. Return interface:
   ```typescript
   export function useFileUpload() {
     return {
       files,
       addFiles,
       removeFile,
       clearFiles,
       uploadFiles,
       isUploading,
     };
   }
   ```
4. **Verification:**
   - Add attachments to status change
   - Remove attachments
   - Files included in submission

---

### Stage 8: Extract Queries Management Hook
**Goal:** Isolate query entry handling

1. Create `hooks/change-status/useQueriesManagement.ts`
2. Move:
   - queries state
   - currentQuery state
   - handleAddQuery function
   - handleRemoveQuery function
   - handleBulkImport function (from CSV)
3. Return interface:
   ```typescript
   export function useQueriesManagement() {
     return {
       queries,
       currentQuery,
       setCurrentQuery,
       addQuery,
       removeQuery,
       bulkImport,
       clearQueries,
     };
   }
   ```
4. **Verification:**
   - Add queries manually
   - Remove queries
   - Bulk import from CSV
   - Queries included in submission

---

### Stage 9: Extract QueriesForm Component
**Goal:** Separate query UI

1. Create `components/change-status/QueriesForm.tsx`
2. Move query entry JSX:
   - Query input field
   - Add query button
   - Queries list display
   - Bulk import section
3. Accept props from useQueriesManagement hook
4. **Verification:**
   - Query form displays correctly
   - All query actions work

---

### Stage 10: Extract StageApprovalForm Component
**Goal:** Separate approval form UI

1. Create `components/change-status/StageApprovalForm.tsx`
2. Move:
   - Approval form JSX
   - Form field rendering logic
   - File input handling for approval attachments
3. Accept props:
   ```typescript
   interface StageApprovalFormProps {
     fields: StageApprovalField[];
     form: UseFormReturn;
     onSubmit: (data: any) => void;
     isSubmitting: boolean;
   }
   ```
4. **Verification:**
   - Approval form renders all field types
   - Validation works
   - Submit sends correct data

---

### Stage 11: Extract CustomFieldsSection Component
**Goal:** Separate custom fields UI

1. Create `components/change-status/CustomFieldsSection.tsx`
2. Move custom field rendering JSX
3. Accept props from useCustomFields hook
4. **Verification:**
   - All custom field types render correctly
   - Field interactions work

---

### Stage 12: Extract AttachmentsSection Component
**Goal:** Separate file upload UI

1. Create `components/change-status/AttachmentsSection.tsx`
2. Move file upload JSX:
   - File input
   - Selected files display
   - Remove file buttons
3. Accept props from useFileUpload hook
4. **Verification:**
   - File selection works
   - Files display correctly
   - Remove works

---

### Stage 13: Extract ClientNotificationView Component
**Goal:** Separate client notification UI

1. Create `components/change-status/ClientNotificationView.tsx`
2. Move client notification JSX (~160 lines)
3. Include:
   - Recipient selection
   - Message composition
   - Template selection
   - Send button
4. Accept props:
   ```typescript
   interface ClientNotificationViewProps {
     projectId: string;
     projectName: string;
     clientName: string;
     recipientEmail?: string;
     recipientName?: string;
     onSend: (message: string, recipient: string) => void;
     onCancel: () => void;
     isSending: boolean;
   }
   ```
5. **Verification:**
   - Client notification view opens
   - Recipient shows correctly
   - Message can be composed
   - Send works

---

### Stage 14: Extract StatusChangeForm Component
**Goal:** Separate main form UI

1. Create `components/change-status/StatusChangeForm.tsx`
2. Move:
   - Stage selection dropdown
   - Reason selection
   - Notes field
   - Attachments section integration
   - Custom fields section integration
   - Approval form integration
   - Queries form integration
   - Submit button
3. Accept orchestrated props from main modal
4. **Verification:**
   - Stage selection works
   - Reason selection works
   - Notes can be entered
   - All sub-sections integrate correctly
   - Submit changes status

---

### Stage 15: Refactor Main Modal Component
**Goal:** Simplify main modal to orchestrator role

1. Update `ChangeStatusModal.tsx`:
   - Import all extracted hooks
   - Import all extracted components
   - Remove all moved code
   - Compose views based on props (showClientNotification, showStaffNotification)
2. Target structure (~300 lines):
   ```tsx
   export function ChangeStatusModal(props: ChangeStatusModalProps) {
     const { projectId, isOpen, onClose, showClientNotification, showStaffNotification } = props;
     
     // Hooks
     const config = useStageChangeConfig(projectId, props.currentStage);
     const mutations = useStatusChangeMutations(projectId);
     const customFields = useCustomFields(config.customFields);
     const fileUpload = useFileUpload();
     const queries = useQueriesManagement();
     
     // View state
     const [selectedStage, setSelectedStage] = useState("");
     const [reason, setReason] = useState("");
     const [notes, setNotes] = useState("");
     
     // Handlers
     const handleStatusChange = async () => { ... };
     
     // Render based on view type
     if (showClientNotification) {
       return (
         <Dialog open={isOpen} onOpenChange={onClose}>
           <ClientNotificationView {...clientProps} />
         </Dialog>
       );
     }
     
     if (showStaffNotification) {
       return (
         <Dialog open={isOpen} onOpenChange={onClose}>
           <StaffNotificationContent {...staffProps} />
         </Dialog>
       );
     }
     
     return (
       <Dialog open={isOpen} onOpenChange={onClose}>
         <StatusChangeForm
           config={config}
           customFields={customFields}
           fileUpload={fileUpload}
           queries={queries}
           onSubmit={handleStatusChange}
           isSubmitting={mutations.updateStatus.isPending}
           {...formProps}
         />
       </Dialog>
     );
   }
   ```
3. Move file to `components/change-status/ChangeStatusModal.tsx`
4. Update import in `client/src/components/ChangeStatusModal.tsx` to re-export
5. **Verification:** Complete functionality test

---

### Stage 16: Cleanup and Optimization
**Goal:** Final cleanup and performance

1. Remove unused imports from all files
2. Add proper TypeScript types throughout
3. Verify no duplicate code remains
4. Add useCallback where beneficial for performance
5. Consider React.memo for pure components
6. Update `replit.md` with new file structure
7. **Final Verification:** Full regression test of all features

---

## Validation Checklist

After each stage, verify:

### Status Change View
- [ ] Stage dropdown populates correctly
- [ ] Stage selection updates form
- [ ] Reason selection works
- [ ] Notes field works
- [ ] Attachments can be added/removed
- [ ] Custom fields display and validate
- [ ] Approval form displays when required
- [ ] Queries can be added/imported
- [ ] Status change submits successfully

### Client Notification View
- [ ] Recipient displays correctly
- [ ] Message can be composed
- [ ] Templates work (if any)
- [ ] Send notification works
- [ ] Cancel returns to modal

### Staff Notification View
- [ ] Channel selection works (email/push/SMS)
- [ ] Recipient selection per channel works
- [ ] Voice recording works (if enabled)
- [ ] AI draft works (if enabled)
- [ ] Message composition works
- [ ] Send to selected channels works
- [ ] Cancel returns to modal

### Integration
- [ ] Modal opens from project list
- [ ] Modal opens from project detail
- [ ] Modal closes correctly
- [ ] onStatusChanged callback fires
- [ ] Page refreshes with new status

---

## State Management Strategy

The current ~45 useState calls will be organized into these domains:

| Domain | State Variables | Target Hook/Component |
|--------|----------------|----------------------|
| Stage Config | config, availableStages, requirements | useStageChangeConfig |
| Mutations | 4 mutation states | useStatusChangeMutations |
| Custom Fields | values, errors | useCustomFields |
| File Upload | files, isUploading | useFileUpload |
| Queries | queries, currentQuery | useQueriesManagement |
| Form State | selectedStage, reason, notes | Main modal component |
| Approval Form | form state via react-hook-form | StageApprovalForm |
| Notification State | channels, recipients, message (~20 vars) | StaffNotificationContent |
| Client Notification | recipient, message | ClientNotificationView |

---

## Risk Mitigation

1. **Incremental Extraction:** Each stage is independently testable
2. **No API Changes:** Same data flow, just reorganized
3. **Type Safety:** TypeScript catches interface mismatches
4. **Rollback Possible:** Can revert individual stages
5. **Complex State:** StaffNotificationContent keeps its internal state
6. **Form Integration:** Maintain react-hook-form patterns

---

## Estimated Timeline

| Stage | Description | Time |
|-------|-------------|------|
| 1 | Setup and Types | 30 min |
| 2 | StaffNotificationContent | 2 hours |
| 3 | Stage Config Hook | 1 hour |
| 4 | Mutations Hook | 1.5 hours |
| 5 | Approval Form Schema Hook | 1 hour |
| 6 | Custom Fields Hook | 45 min |
| 7 | File Upload Hook | 30 min |
| 8 | Queries Management Hook | 45 min |
| 9 | QueriesForm Component | 1 hour |
| 10 | StageApprovalForm Component | 1.5 hours |
| 11 | CustomFieldsSection Component | 45 min |
| 12 | AttachmentsSection Component | 30 min |
| 13 | ClientNotificationView Component | 1 hour |
| 14 | StatusChangeForm Component | 2 hours |
| 15 | Refactor Main Modal | 1.5 hours |
| 16 | Cleanup | 1 hour |
| **Total** | | **~17 hours** |

---

## Notes for Implementation

1. **StaffNotificationContent is Self-Contained:** It has its own ~20 useState hooks and should remain as a single component to avoid excessive prop drilling
2. **Form Schema is Dynamic:** The approval form schema is generated based on stage config - maintain this pattern
3. **Three Views, One Modal:** The component renders different content based on props - maintain this routing
4. **Voice Recording:** Complex feature in StaffNotificationContent - keep it intact during extraction
5. **Query Keys:** Maintain same query keys for cache consistency
6. **Callback Stability:** Use useCallback for handlers passed to child components

---

## Dependencies Between Hooks

```
ChangeStatusModal (orchestrator)
├── useStageChangeConfig
│   └── depends on: projectId, currentStage, serviceId
├── useStatusChangeMutations
│   └── depends on: projectId
├── useApprovalFormSchema
│   └── depends on: config.approvalFields
├── useCustomFields
│   └── depends on: config.customFields
├── useFileUpload
│   └── standalone
└── useQueriesManagement
    └── standalone
```

---

## Post-Refactoring Improvements (Future)

After the split is complete, consider:

1. Adding unit tests for each custom hook
2. Creating Storybook stories for extracted components
3. Adding proper error boundaries
4. Implementing optimistic updates for status changes
5. Adding loading skeletons for better UX
6. Creating integration tests for the full workflow
