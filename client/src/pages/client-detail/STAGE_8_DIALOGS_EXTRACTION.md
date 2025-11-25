# Stage 8: Dialogs Extraction - Comprehensive Planning Document

## Executive Summary

**Objective:** Extract remaining dialogs and inline helper components from ClientDetailPage.tsx to achieve further modularization and reduce the main component to ~800-900 lines.

**Current State:** 1,446 lines (after Stage 7 - 84.5% reduction from original 9,347 lines)
**Target State:** ~900-1,000 lines (90%+ total reduction)
**Estimated Reduction:** ~450-550 lines

**Risk Level:** Medium - Dialogs have complex form state and mutations
**Estimated Effort:** 3-4 hours

---

## Pre-Stage Checklist

### Outstanding LSP Errors to Fix First
Before beginning Stage 8 extractions, fix these 6 LSP errors:

| Line | Error | Fix |
|------|-------|-----|
| 526 | Cannot find name 'setLocation' | Change to `navigate` (already destructured) |
| 1113 | Type 'Error \| null' not assignable to 'boolean' | Convert to `!!servicesError` |
| 1118 | Type 'Error \| null' not assignable to 'boolean' | Convert to `!!peopleServicesError` |
| 1138 | 'string \| undefined' not assignable to 'string' | Add non-null assertion `id!` |
| 1204 | 'string \| undefined' not assignable to 'string' | Add non-null assertion `id!` |
| 1210 | 'clientId' does not exist in insert type | Remove `clientId: id` from data spread |

### Login Credentials (For Testing)
- **URL:** Root page (`/`)
- **Tab:** Password tab
- **Email:** `admin@example.com`
- **Password:** `admin123`

---

## Component Inventory

### Components to Extract

| Component | Lines | Location | Complexity | Priority |
|-----------|-------|----------|------------|----------|
| `NewClientRequestDialog` | ~220 | 1216-1434 | High | P1 |
| `ProjectLink` | ~20 | 104-124 | Low | P3 |
| `CompanyCreationForm` | ~127 | 127-254 | Medium | P2 |

### Already Extracted (Reference)
These dialogs are already imported and just need usage cleanup:
- `EditServiceModal` - Imported from `./components/services`
- `AddPersonModal` - Imported from `./components/people`

---

## Detailed Extraction Plan

### Phase 8.1: Fix LSP Errors (15 minutes)

**Tasks:**
1. Line 526: Change `setLocation` to `navigate`
2. Lines 1113, 1118: Convert error props to boolean with `!!`
3. Line 1138, 1204: Add non-null assertions
4. Line 1210: Remove `clientId` from mutation data (it's already included in the API path)

**Success Criteria:**
- [ ] Zero LSP errors in ClientDetailPage.tsx
- [ ] Application builds without TypeScript errors

---

### Phase 8.2: Extract NewClientRequestDialog (2 hours)

**Target File:** `client/src/pages/client-detail/dialogs/NewClientRequestDialog.tsx`

**Component Structure:**
```typescript
interface NewClientRequestDialogProps {
  clientId: string;
  relatedPeople: ClientPersonWithPerson[] | undefined;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

**State to Move:**
- `requestType: 'template' | 'custom' | null`
- `selectedCategoryId: string`
- `selectedTemplateId: string`
- `selectedPersonId: string`
- `customRequestForm` (useForm hook)

**Queries to Move:**
- `taskCategories` query
- `clientRequestTemplates` query

**Mutations to Move:**
- `createTaskInstanceMutation`
- `createCustomRequestMutation`

**Key Dependencies:**
- `formatPersonName` from `./utils/formatters`
- Form components: `Form`, `FormField`, `FormControl`, `FormLabel`, `FormMessage`, `FormDescription`
- UI components: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`
- `Card`, `Button`, `Input`, `Textarea`
- `FileText`, `Plus` icons from `lucide-react`
- `useQuery`, `useMutation` from `@tanstack/react-query`
- `useForm` from `react-hook-form`
- `zodResolver` from `@hookform/resolvers/zod`
- `useLocation` from `wouter`
- `useToast` from `@/hooks/use-toast`
- `queryClient`, `apiRequest` from `@/lib/queryClient`

**Internal Logic to Preserve:**
1. Two-phase dialog flow: Type selection → Form
2. Template mode: Category → Template → Person selection
3. Custom mode: Name + Description form
4. Navigation to custom request builder after creation
5. Reset state on dialog close

**Sub-components within Dialog:**
- `RequestTypeSelection` - Initial choice cards
- `TemplateRequestForm` - Category/Template/Person selects
- `CustomRequestForm` - Name/Description form

**Success Criteria:**
- [ ] Dialog opens and closes correctly
- [ ] Template flow works: Category → Template → Person → Create
- [ ] Custom flow works: Name → Description → Create → Navigate to builder
- [ ] State resets properly on dialog close
- [ ] Query invalidation works after creation
- [ ] Toast notifications display on success/error

---

### Phase 8.3: Move ProjectLink and CompanyCreationForm (30 minutes)

**ProjectLink:**
- Already a small self-contained component
- Move to `client/src/pages/client-detail/components/ProjectLink.tsx`
- Uses: `useLocation`, `useQuery`
- Export from components index

**CompanyCreationForm:**
- Already extracted but defined inline in the main file
- Move to `client/src/pages/client-detail/forms/CompanyCreationForm.tsx` (file exists but may need update)
- Uses: `useForm`, Form components, `Building2` icon
- Receives: `onSubmit`, `onCancel`, `isSubmitting` props

**Success Criteria:**
- [ ] Both components work identically after extraction
- [ ] No duplicate component definitions remain
- [ ] All imports resolved correctly

---

### Phase 8.4: Clean Up Main Component (30 minutes)

**Tasks:**
1. Remove extracted component definitions
2. Update imports to use new file locations
3. Remove unused state variables (if any become unused)
4. Remove related dead code (if any)
5. Consider extracting tab navigation to `ClientTabNavigation.tsx` (future Stage 9)

**Code Organization Review:**
After extractions, the main component should contain:
- URL params and auth hooks (~10 lines)
- Essential state variables (~20 lines)
- Queries for client data (~80 lines)
- Mutations for core operations (~100 lines)
- Loading/error states (~50 lines)
- Header rendering (~30 lines)
- Tab navigation (~250 lines) - candidate for Stage 9
- Tab content delegation (~40 lines)
- Dialog instances (~30 lines)
- Mobile navigation (~10 lines)

**Success Criteria:**
- [ ] Main component reduced to ~900-1000 lines
- [ ] No duplicate code
- [ ] All functionality preserved
- [ ] No unused imports

---

### Phase 8.5: Create Dialogs Index (15 minutes)

**File:** `client/src/pages/client-detail/dialogs/index.tsx`

```typescript
export { NewClientRequestDialog } from './NewClientRequestDialog';
// Future dialogs can be added here
```

**Directory Structure After Stage 8:**
```
client/src/pages/client-detail/
├── index.tsx                          
├── ClientDetailPage.tsx               # ~900-1000 lines (target)
│
├── components/
│   ├── ProjectLink.tsx                # NEW
│   ├── PortalStatusColumn.tsx         
│   ├── projects/
│   ├── people/
│   ├── services/
│   ├── communications/
│   └── tabs/
│
├── dialogs/                           # NEW DIRECTORY
│   ├── index.tsx                      
│   └── NewClientRequestDialog.tsx     
│
├── forms/
│   ├── CompanyCreationForm.tsx        # Already exists, verify/update
│   └── (other forms)
│
├── hooks/
└── utils/
```

---

## Testing Strategy

### Unit Testing Checklist

For each extracted component:
- [ ] Component renders without errors
- [ ] Props are correctly typed
- [ ] State management works internally
- [ ] Callbacks fire correctly
- [ ] Loading states display properly
- [ ] Error states handle gracefully

### E2E Test Plan

**Test 1: New Client Request Dialog - Template Flow**
```
1. Navigate to client detail page
2. Go to Tasks tab
3. Click "New Client Request" button
4. Verify dialog opens with two options
5. Click "Use Template" card
6. Select a category from dropdown
7. Select a template from dropdown
8. Select a person from dropdown
9. Click "Create Request"
10. Verify toast success message
11. Verify dialog closes
12. Verify request appears in list
```

**Test 2: New Client Request Dialog - Custom Flow**
```
1. Navigate to client detail page
2. Go to Tasks tab
3. Click "New Client Request" button
4. Click "Create Custom" card
5. Enter request name
6. Enter description (optional)
7. Click "Create Custom Request"
8. Verify navigation to custom request builder
9. Verify toast success message
```

**Test 3: Dialog Cancel/Close Behavior**
```
1. Open New Client Request dialog
2. Click "Use Template"
3. Select a category
4. Click "Back" button
5. Verify return to type selection
6. Close dialog (click X or outside)
7. Reopen dialog
8. Verify state is reset (no selections retained)
```

**Test 4: Existing Functionality Regression**
```
1. Navigate to client detail page
2. Verify all 8 tabs still work
3. Verify Add Person modal works
4. Verify Edit Service modal works
5. Verify project navigation works
6. Verify company creation form works (for individual clients)
```

---

## Risk Assessment

### High Risk Items
| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking form validation | Users can't create requests | Keep Zod schemas identical |
| Query key mismatch | Cache invalidation fails | Copy exact query keys |
| Missing navigation | Users stuck after create | Test navigate() calls |

### Medium Risk Items
| Risk | Impact | Mitigation |
|------|--------|------------|
| Toast not showing | No user feedback | Test toast calls in mutations |
| State not resetting | Stale data on reopen | Test onOpenChange cleanup |
| Type errors | Build failures | Fix LSP errors first |

### Low Risk Items
| Risk | Impact | Mitigation |
|------|--------|------------|
| Unused imports | Build warnings | ESLint cleanup |
| Duplicate types | Code smell | Use shared types.ts |

---

## Dependencies Map

### NewClientRequestDialog Dependencies

```
External:
├── @tanstack/react-query (useQuery, useMutation)
├── react-hook-form (useForm)
├── @hookform/resolvers/zod (zodResolver)
├── wouter (useLocation)
├── zod (z)
├── lucide-react (FileText, Plus)

Internal - UI Components:
├── @/components/ui/dialog
├── @/components/ui/card
├── @/components/ui/button
├── @/components/ui/form
├── @/components/ui/select
├── @/components/ui/input
├── @/components/ui/textarea

Internal - Hooks:
├── @/hooks/use-toast (useToast)

Internal - Utils:
├── @/lib/queryClient (apiRequest, queryClient)
├── ./utils/formatters (formatPersonName)
├── ./utils/types (ClientPersonWithPerson)

API Endpoints:
├── GET /api/client-request-template-categories
├── GET /api/client-request-templates
├── POST /api/task-instances
├── POST /api/clients/{id}/custom-requests
```

---

## Code Patterns to Follow

### Dialog Component Pattern
```typescript
export function NewClientRequestDialog({
  clientId,
  relatedPeople,
  isOpen,
  onOpenChange,
  onSuccess,
}: NewClientRequestDialogProps) {
  // Local state for dialog-specific data
  const [requestType, setRequestType] = useState<'template' | 'custom' | null>(null);
  
  // Queries scoped to dialog
  const { data: categories } = useQuery({...});
  
  // Mutations with proper callbacks
  const createMutation = useMutation({
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
      // Reset state
    },
  });
  
  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setRequestType(null);
      // Reset other state...
    }
    onOpenChange(open);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      ...
    </Dialog>
  );
}
```

### Prop Drilling Pattern (from Stage 7)
- Pass required data explicitly rather than using Context
- Keep mutations in parent, pass callbacks to children
- Group related props when they're always used together

---

## Success Metrics

| Metric | Before Stage 8 | Target | Measurement |
|--------|---------------|--------|-------------|
| Main file lines | 1,446 | 900-1,000 | `wc -l ClientDetailPage.tsx` |
| Total reduction | 84.5% | 89-90% | (9347 - new) / 9347 |
| LSP errors | 6 | 0 | `get_latest_lsp_diagnostics` |
| Dialog components | 1 inline | 0 inline | Grep for `<Dialog` in main file |
| E2E tests passing | N/A | 100% | `run_test` tool |

---

## Post-Stage 8 Cleanup

### Documentation Updates
1. Update `client-detail_refactor.md` with Stage 8 completion
2. Update `replit.md` with new file structure
3. Document dialog component API

### Future Considerations (Stage 9+)
1. Extract tab navigation to `ClientTabNavigation.tsx` (~250 lines potential reduction)
2. Extract debug logging to a custom hook or remove entirely (~100 lines)
3. Consider extracting header to `ClientHeader.tsx`
4. Consolidate state into a custom `useClientDetailState` hook

---

## Execution Checklist

### Pre-Execution
- [ ] Read and understand all components to extract
- [ ] Verify no other developers are working on these files
- [ ] Create backup checkpoint (automatic via Replit)

### During Execution
- [ ] Phase 8.1: Fix LSP errors first
- [ ] Phase 8.2: Extract NewClientRequestDialog
- [ ] Phase 8.3: Move ProjectLink and verify CompanyCreationForm
- [ ] Phase 8.4: Clean up main component
- [ ] Phase 8.5: Create dialogs index

### Post-Execution
- [ ] Run E2E tests
- [ ] Get architect review
- [ ] Update documentation
- [ ] Verify no console errors
- [ ] Test on mobile viewport

---

## Rollback Plan

If Stage 8 introduces regressions:
1. Use Replit checkpoints to restore previous state
2. Key files to restore:
   - `ClientDetailPage.tsx`
   - Any new files in `dialogs/`
3. Clear browser cache and restart workflow

---

## Appendix: Current File Structure

```
client/src/pages/client-detail/
├── index.tsx (1 line - re-export)
├── ClientDetailPage.tsx (1,446 lines - main component)
│
├── components/
│   ├── PortalStatusColumn.tsx
│   ├── communications/
│   │   ├── index.tsx
│   │   ├── types.ts
│   │   ├── helpers.tsx
│   │   ├── CommunicationsTimeline.tsx
│   │   ├── CommunicationFilters.tsx
│   │   ├── CommunicationList.tsx
│   │   └── dialogs/
│   │       ├── index.tsx
│   │       ├── CreateMessageDialog.tsx
│   │       ├── ViewCommunicationDialog.tsx
│   │       ├── AddCommunicationDialog.tsx
│   │       ├── SMSDialog.tsx
│   │       ├── EmailDialog.tsx
│   │       └── CallDialog.tsx
│   ├── people/
│   │   ├── index.tsx
│   │   ├── AddPersonModal.tsx
│   │   ├── PersonEditForm.tsx
│   │   ├── PersonViewMode.tsx
│   │   ├── PersonTabbedView.tsx
│   │   └── RelatedPersonRow.tsx
│   ├── projects/
│   │   ├── index.tsx
│   │   ├── ProjectsList.tsx
│   │   ├── OpenProjectRow.tsx
│   │   ├── CompletedProjectRow.tsx
│   │   └── ServiceProjectsList.tsx
│   ├── services/
│   │   ├── index.tsx
│   │   ├── AddServiceModal.tsx
│   │   ├── EditServiceModal.tsx
│   │   ├── EditableServiceDetails.tsx
│   │   └── ClientServiceRow.tsx
│   └── tabs/
│       ├── index.tsx
│       ├── ChronologyTab.tsx
│       ├── DocumentsTab.tsx
│       ├── OverviewTab.tsx
│       ├── ProjectsTab.tsx
│       ├── RiskTab.tsx
│       ├── ServicesTab.tsx
│       ├── TasksTab.tsx
│       └── services/
│           ├── ClientServicesList.tsx
│           ├── PersonalServicesList.tsx
│           └── PersonalServiceRow.tsx
│
├── forms/
│   └── CompanyCreationForm.tsx (exists - verify content)
│
├── hooks/
│   └── (empty - future use)
│
└── utils/
    ├── formatters.ts
    ├── projectHelpers.ts
    └── types.ts
```

---

*Document Created: November 25, 2025*
*Author: Replit Agent*
*Stage: 8 of 10*
*Previous Stage: 7 (Tab Components) - COMPLETED*
