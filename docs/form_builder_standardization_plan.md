# Form Builder Standardization Plan

This document outlines the phased approach to standardizing all form builders across the application to follow the gold standard wizard pattern defined in `docs/form_creation_standards.md`.

## Key Principles

### Golden Rule: Sections for Client-Facing Forms
| Form Type | Sections Required | Reasoning |
|-----------|------------------|-----------|
| Stage Approvals | No | Internal staff verification |
| Custom Stage Approvals | No | Client-specific internal verification |
| Client Project Tasks | **Yes** | Client-facing pre-work checklists |
| Custom Client Project Tasks | **Yes** | Client-specific pre-work |
| Client Request Templates | **Yes** | Client-facing request forms |
| Custom Requests | **Yes** | Ad-hoc client requests |

### Feature Matrix

| Component | Wizard Modal | System Library | Sections | Conditional Logic | Current State |
|-----------|-------------|----------------|----------|-------------------|---------------|
| ApprovalWizard | ✅ | ✅ | ❌ | ❌ | Gold Standard |
| ClientTasksTab | ✅ | ✅ | ✅ | ✅ | Complete |
| ApprovalOverridesTab | ✅ (reuses) | ✅ | ❌ | ❌ | Complete (uses ApprovalWizard) |
| ClientTaskOverridesSection | ⚠️ Different | ✅ | ✅ | ✅ | Uses modal picker (valid alternative) |
| request-template-edit | ❌ Page-based | ❌ | ✅ | ❌ Needs adding | **Needs Work** |
| custom-request-edit | ❌ Page-based | ❌ | ✅ | ❌ Needs adding | **Needs Work** |
| signature-request-builder | N/A | N/A | N/A | N/A | Different paradigm (PDF annotation) |

---

## Component Analysis

### 1. ApprovalOverridesTab (Custom Stage Approvals)
**File:** `client/src/pages/client-detail/components/tabs/ApprovalOverridesTab.tsx`

**Current State:** ✅ Already complete
- Already imports and uses `ApprovalWizard` component
- Opens wizard in create/edit/view modes
- No sections needed (internal staff form)
- Uses table-based data view with proper patterns

**Action:** No work required - verify functionality only

---

### 2. request-template-edit (Client Request Templates)
**File:** `client/src/pages/request-template-edit.tsx`

**Current State:** Page-based editor with sidebar, not wizard modal
- Has sections support ✅
- Has drag-drop question reordering ✅
- Missing: Full-screen wizard modal
- Missing: System Library integration
- Missing: Conditional logic
- Missing: Collapsible palette sections

**Required Changes:**
1. Convert to full-screen wizard modal pattern
2. Add System Library section (collapsible, emerald theme)
3. Add conditional logic support (copy from ClientTasksTab)
4. Apply colorful field type palette
5. Preserve existing sections functionality

**Complexity:** High - Major refactor with new feature (conditional logic)

---

### 3. custom-request-edit (Custom Client Requests)
**File:** `client/src/pages/custom-request-edit.tsx`

**Current State:** Nearly identical to request-template-edit
- Has sections support ✅
- Has drag-drop question reordering ✅
- Same missing features as request-template-edit

**Required Changes:**
1. Convert to full-screen wizard modal pattern
2. Add System Library section
3. Add conditional logic support
4. Apply colorful field type palette
5. Preserve existing sections functionality

**Complexity:** High - But can share code with request-template-edit

---

### 4. signature-request-builder (E-Signature Documents)
**File:** `client/src/pages/signature-request-builder.tsx`

**Current State:** Multi-step wizard for PDF signature placement
- Step 1: Select document
- Step 2: Add recipients
- Step 3: Place signature fields on PDF pages
- Step 4: Review and send

**Analysis:** This is NOT a form builder - it's a document signing workflow. The "fields" are signature/name placement boxes on PDF documents, not form questions.

**Action:** **EXCLUDE from this effort** - Different paradigm, already has its own wizard pattern

---

## Phased Implementation Plan

### Phase 0: Verification & Preparation
**Duration:** 0.5 days
**Goal:** Confirm existing implementations work correctly

| Task | Description | Status |
|------|-------------|--------|
| 0.1 | Verify conditional logic works in ClientTasksTab | Pending |
| 0.2 | Verify conditional logic works in ClientTaskOverridesSection | Pending |
| 0.3 | Document conditional logic data structure | Pending |
| 0.4 | Create shared conditional logic components if not exists | Pending |

---

### Phase 1: Shared Infrastructure
**Duration:** 1 day
**Goal:** Extract reusable components for form builders with sections

| Task | Description | Priority |
|------|-------------|----------|
| 1.1 | Create `SectionedFormBuilder` component that wraps common patterns | High |
| 1.2 | Create `SectionCard` reusable component | High |
| 1.3 | Create `SectionEditor` modal component | High |
| 1.4 | Extract `ConditionalLogicEditor` as standalone component | High |
| 1.5 | Create adapter for request template questions | Medium |
| 1.6 | Update `form_creation_standards.md` with sections documentation | Medium |

**Deliverables:**
- `client/src/components/field-builder/SectionedFormBuilder.tsx`
- `client/src/components/field-builder/SectionCard.tsx`
- `client/src/components/field-builder/ConditionalLogicEditor.tsx`
- `client/src/components/field-builder/adapters/requestTemplateAdapter.ts`

---

### Phase 2: Client Request Templates
**Duration:** 2 days
**Goal:** Refactor request-template-edit to gold standard

| Task | Description | Priority |
|------|-------------|----------|
| 2.1 | Convert page layout to full-screen wizard modal | High |
| 2.2 | Add wizard header with cancel/save buttons | High |
| 2.3 | Replace sidebar with collapsible System Library + Custom Fields | High |
| 2.4 | Integrate conditional logic into question configuration | High |
| 2.5 | Apply colorful field type badges and styling | Medium |
| 2.6 | Ensure sections still work with new layout | High |
| 2.7 | Add proper skeleton loading states | Medium |
| 2.8 | Test end-to-end template creation flow | High |

**Database Changes:** 
- Add `conditionalLogic` JSONB column to `clientRequestTemplateQuestions` table (if not exists)

**Breaking Changes:** None expected - enhancement only

---

### Phase 3: Custom Client Requests
**Duration:** 1.5 days
**Goal:** Refactor custom-request-edit to gold standard

| Task | Description | Priority |
|------|-------------|----------|
| 3.1 | Apply same wizard modal pattern as Phase 2 | High |
| 3.2 | Reuse components from Phase 1 and Phase 2 | High |
| 3.3 | Add conditional logic support | High |
| 3.4 | Preserve "Assign to Person" functionality | High |
| 3.5 | Preserve "Send Request" workflow | High |
| 3.6 | Test end-to-end custom request flow | High |

**Database Changes:**
- Add `conditionalLogic` JSONB column to `customRequestQuestions` table (if not exists)

**Note:** Much of this can reuse Phase 2 work

---

### Phase 4: Documentation & Cleanup
**Duration:** 0.5 days
**Goal:** Ensure consistency and maintainability

| Task | Description | Priority |
|------|-------------|----------|
| 4.1 | Update `form_creation_standards.md` with sections pattern | High |
| 4.2 | Add conditional logic documentation | High |
| 4.3 | Create migration guide for future form builders | Medium |
| 4.4 | Remove deprecated/duplicate code | Medium |
| 4.5 | Final testing across all form builders | High |

---

## Conditional Logic Specification

### Data Structure
Based on ClientTasksTab implementation:

```typescript
interface ConditionalLogicCondition {
  questionId: string;      // ID of the question to check
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
  value?: string | number | boolean;
}

interface ConditionalLogic {
  showIf?: ConditionalLogicCondition;  // Single condition
  logic?: 'and' | 'or';                // For multiple conditions
  conditions?: ConditionalLogicCondition[];  // Multiple conditions
}
```

### UI Pattern
- Toggle switch to enable/disable conditional logic per question
- When enabled, show:
  - Dropdown to select "depends on" question (only previous questions)
  - Operator dropdown (equals, not equals, contains, is empty, is not empty)
  - Value input (hidden for is_empty/is_not_empty operators)
  - For questions with options (single_choice, dropdown), show options picker

### Evaluation
- Questions with unmet conditions should be hidden from client view
- When evaluating: check the referenced question's current value against condition
- Support for dependent question chains (A → B → C)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing templates | Low | High | Preserve all existing functionality, add features only |
| Migration complexity | Medium | Medium | Use JSONB columns to avoid schema migrations |
| UI inconsistency during transition | Medium | Low | Phase approach with isolated changes |
| Conditional logic edge cases | Medium | Medium | Copy tested implementation from ClientTasksTab |

---

## Success Criteria

### Phase 0
- [ ] Conditional logic in ClientTasksTab demonstrated working
- [ ] Conditional logic in ClientTaskOverridesSection demonstrated working

### Phase 1
- [ ] Shared components created and exported
- [ ] Components used by at least 2 form builders

### Phase 2
- [ ] request-template-edit uses full-screen wizard modal
- [ ] System Library accessible in template builder
- [ ] Conditional logic works for template questions
- [ ] All existing templates still work

### Phase 3
- [ ] custom-request-edit matches request-template-edit pattern
- [ ] Custom requests can be created, edited, assigned, and sent
- [ ] Conditional logic works for custom request questions

### Phase 4
- [ ] Documentation updated
- [ ] No duplicate component implementations
- [ ] All form builders follow documented patterns

---

## Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 | 0.5 days | None |
| Phase 1 | 1 day | Phase 0 complete |
| Phase 2 | 2 days | Phase 1 complete |
| Phase 3 | 1.5 days | Phase 2 complete |
| Phase 4 | 0.5 days | Phases 2-3 complete |
| **Total** | **5.5 days** | |

---

## Appendix: Components Reference

### Existing (Gold Standard)
- `client/src/components/approval-builder/ApprovalWizard.tsx`
- `client/src/components/field-builder/FieldConfigModal.tsx`
- `client/src/components/field-builder/adapters.ts`
- `client/src/components/field-builder/types.ts`

### To Be Created (Phase 1)
- `client/src/components/field-builder/SectionedFormBuilder.tsx`
- `client/src/components/field-builder/SectionCard.tsx`
- `client/src/components/field-builder/ConditionalLogicEditor.tsx`
- `client/src/components/field-builder/adapters/requestTemplateAdapter.ts`

### To Be Refactored
- `client/src/pages/request-template-edit.tsx`
- `client/src/pages/custom-request-edit.tsx`
