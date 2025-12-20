# Forms Wave 2 - Standardization Implementation Plan

This document outlines the current progress, remaining gaps, and implementation plan for standardizing form creation across the application, with a focus on Client Project Tasks (at both project type and client levels) and Client Request Templates (at both system and client levels).

---

## Testing Environment Notes

**CRITICAL:** The system is multi-threaded with a web process and a cron process. When opening browser testing sessions:
- **Allow adequate boot time** - The system may take 10-15 seconds to fully initialize
- **Login credentials:** Navigate to root page → Passwords tab → `admin@example.com` / `admin123`
- **Only method to login** - This is the ONLY valid authentication path for testing

---

## Progress Summary

### Completed (Wave 1)

| Component | Location | Status | Features |
|-----------|----------|--------|----------|
| **ApprovalWizard** | `client/src/components/approval-builder/ApprovalWizard.tsx` | ✅ Gold Standard | Full-screen wizard, System Library, drag-drop, field config modal |
| **System Field Library** | `client/src/pages/system-field-library.tsx` | ✅ Complete | CRUD, categories, usage tracking, search/filter |
| **Shared FieldConfigModal** | `client/src/components/field-builder/FieldConfigModal.tsx` | ✅ Complete | Unified field editing with capabilities system |
| **ConditionalLogicEditor** | `client/src/components/field-builder/ConditionalLogicEditor.tsx` | ✅ Complete | Standalone reusable component |
| **Field Adapters** | `client/src/components/field-builder/adapters.ts` | ✅ Complete | Mapping for all contexts with capability flags |
| **ClientTasksTab** (Project Type level) | `client/src/pages/project-type-detail/components/tabs/ClientTasksTab.tsx` | ✅ Complete | Sections, conditional logic, system library |
| **ApprovalOverridesTab** (Client custom approvals) | `client/src/pages/client-detail/components/tabs/ApprovalOverridesTab.tsx` | ✅ Complete | Reuses ApprovalWizard |

### Partially Complete

| Component | Location | Status | Missing Features |
|-----------|----------|--------|------------------|
| **request-template-edit** | `client/src/pages/request-template-edit.tsx` | ⚠️ Needs Work | System Library, wizard modal pattern |
| **custom-request-edit** | `client/src/pages/custom-request-edit.tsx` | ⚠️ Needs Work | System Library, wizard modal pattern |
| **ClientTaskOverridesSection** | `client/src/pages/client-detail/components/tabs/ClientTaskOverridesSection.tsx` | ⚠️ Needs Work | Missing sections, missing conditional logic |

---

## Gap Analysis

### 1. ClientTaskOverridesSection (Custom Client Project Tasks)
**Location:** `client/src/pages/client-detail/components/tabs/ClientTaskOverridesSection.tsx`
**Path:** Client Detail → Custom Approvals Tab → Client Project Task Overrides section

**Current State:**
- ✅ Can create overrides based on project type templates
- ✅ Can add/remove/edit custom questions
- ✅ Has System Library picker integration
- ❌ **Missing sections support** - Questions are flat, no section grouping
- ❌ **Missing conditional logic** - `EditingQuestion` interface lacks conditionalLogic field
- ❌ **Not using shared FieldConfigModal** - Uses inline question editor dialog

**Required Changes:**
1. Add `conditionalLogic` field to `EditingQuestion` interface
2. Add section management (inherit from base template sections + allow adding custom sections)
3. Replace inline question dialog with shared `FieldConfigModal` component
4. Pass `availableFieldsForConditions` for conditional logic support
5. Apply gold standard wizard patterns (colorful icons, consistent styling)

### 2. ClientTasksTab (Project Type Level) - Verification Needed
**Location:** `client/src/pages/project-type-detail/components/tabs/ClientTasksTab.tsx`
**Path:** Settings → Project Types → [Select Type] → Client Tasks tab

**Current State:**
- ✅ Full-screen wizard builder
- ✅ Sections support with drag-drop reordering
- ✅ Conditional logic in `ClientTaskQuestionConfigModal`
- ✅ System Library integration with category filter
- ⚠️ **Needs verification** - Confirm all features work end-to-end

**Verification Tasks:**
1. Test creating a new template with sections
2. Test adding questions with conditional logic
3. Test conditional logic evaluation on client portal
4. Test adding fields from System Library
5. Verify sections render correctly on portal submission form

### 3. Request Templates (System Level)
**Location:** `client/src/pages/request-template-edit.tsx`
**Path:** Settings → Request Templates → Create/Edit

**Current State:**
- ✅ Has sections support with dedicated sections table
- ✅ Has `ConditionalLogicEditor` imported and used
- ✅ Has drag-drop reordering for sections and questions
- ❌ **Missing System Library integration** - No picker for library fields
- ❌ **Page-based layout** - Not using full-screen wizard modal
- ⚠️ **Conditional logic partially implemented** - Needs verification

**Required Changes:**
1. Add System Library section to sidebar
2. Convert to full-screen wizard modal (or validate page-based is acceptable)
3. Verify conditional logic saves and evaluates correctly
4. Apply colorful field type styling

### 4. Custom Requests (Client Level)
**Location:** `client/src/pages/custom-request-edit.tsx`
**Path:** Client Detail → Tasks Tab → Custom Requests → Create/Edit

**Current State:**
- ✅ Has sections support
- ✅ Has `ConditionalLogicEditor` import
- ✅ Has drag-drop reordering
- ❌ **Missing System Library integration**
- ❌ **Page-based layout**
- ⚠️ **Conditional logic needs verification**

**Required Changes:**
1. Add System Library section to sidebar
2. Verify conditional logic saves and evaluates correctly
3. Apply colorful field type styling
4. Consistent with request-template-edit patterns

---

## Schema Verification

### Conditional Logic Support

| Table | Column | Status |
|-------|--------|--------|
| `client_project_task_questions` | `conditional_logic` JSONB | ✅ Exists |
| `client_project_task_override_questions` | `conditional_logic` JSONB | ✅ Exists |
| `client_request_template_questions` | `conditional_logic` JSONB | ✅ Exists |
| `client_custom_request_questions` | `conditional_logic` JSONB | ✅ Exists |

### Sections Support

| Table | Parent Table | Status |
|-------|--------------|--------|
| `client_project_task_sections` | `client_project_task_templates` | ✅ Exists |
| `client_project_task_override` | N/A (uses base template sections) | ⚠️ No dedicated sections table |
| `client_request_template_sections` | `client_request_templates` | ✅ Exists |
| `client_custom_request_sections` | `client_custom_requests` | ✅ Exists |

---

## Implementation Phases

### Phase 1: Verification & Gap Documentation (0.5 days)
**Goal:** Confirm current implementations work and document specific gaps

| Task ID | Task | Priority |
|---------|------|----------|
| 1.1 | Test ClientTasksTab sections creation and rendering | High |
| 1.2 | Test ClientTasksTab conditional logic (config and portal) | High |
| 1.3 | Test request-template-edit conditional logic | High |
| 1.4 | Test custom-request-edit conditional logic | High |
| 1.5 | Document all failures and specific bug locations | High |

**Verification Script:**
```
1. Login: root page → Passwords tab → admin@example.com / admin123
2. Wait 10-15 seconds for system boot

Client Project Tasks (Project Type Level):
3. Settings → Project Types → Select any type with services
4. Client Tasks tab → Create New Task Template
5. Add 2 sections with names
6. Add 3 questions to section 1
7. Add 2 questions to section 2 with conditional logic (show if Q1 equals "Yes")
8. Save and verify template appears in list
9. Verify sections and conditional logic saved (edit template)

Request Templates (System Level):
10. Settings → Request Templates → Create
11. Add sections and questions with conditional logic
12. Save and verify persistence

Custom Client Project Tasks (Client Level):
13. Clients → Select client → Custom Approvals tab
14. Client Project Task Overrides section → Add Override
15. Attempt to add sections (document if missing)
16. Attempt to add conditional logic (document if missing)
```

### Phase 2: ClientTaskOverridesSection Fix (1 day)
**Goal:** Bring custom client project tasks to parity with project type level

| Task ID | Task | Priority |
|---------|------|----------|
| 2.1 | Add `conditionalLogic` to `EditingQuestion` interface | High |
| 2.2 | Replace inline question dialog with shared `FieldConfigModal` | High |
| 2.3 | Build `availableFieldsForConditions` from base + override questions | High |
| 2.4 | Add section support (create `client_project_task_override_sections` table if needed OR inherit from base) | High |
| 2.5 | Update API endpoints to handle sections | High |
| 2.6 | Add section UI to override builder | Medium |
| 2.7 | Apply colorful field type styling | Medium |

**Decision Required:** Section inheritance strategy
- **Option A:** Override inherits base template sections, only allows adding/removing questions
- **Option B:** Override can have completely custom sections
- **Recommendation:** Option A is simpler and maintains consistency

### Phase 3: Request Templates Enhancement (1 day)
**Goal:** Add System Library and verify conditional logic

| Task ID | Task | Priority |
|---------|------|----------|
| 3.1 | Add System Library picker component to sidebar | High |
| 3.2 | Wire up library field selection to question creation | High |
| 3.3 | Verify conditional logic saves correctly | High |
| 3.4 | Verify conditional logic evaluates on client form | High |
| 3.5 | Apply colorful field type palette styling | Medium |
| 3.6 | Add loading states and error handling | Medium |

### Phase 4: Custom Requests Enhancement (0.5 days)
**Goal:** Match request-template-edit patterns

| Task ID | Task | Priority |
|---------|------|----------|
| 4.1 | Add System Library picker (copy from Phase 3) | High |
| 4.2 | Verify conditional logic end-to-end | High |
| 4.3 | Apply consistent styling | Medium |

### Phase 5: End-to-End Testing & Polish (0.5 days)
**Goal:** Comprehensive verification across all flows

| Task ID | Task | Priority |
|---------|------|----------|
| 5.1 | Test all 4 form builders create flows | High |
| 5.2 | Test all 4 form builders edit flows | High |
| 5.3 | Test conditional logic on client portal (all contexts) | High |
| 5.4 | Test section rendering on client portal | High |
| 5.5 | Cross-browser verification (Chrome, Safari) | Medium |
| 5.6 | Mobile responsiveness check | Medium |

---

## Success Criteria

### ClientTasksTab (Project Type Level)
- [ ] Can create template with multiple sections
- [ ] Can add questions to specific sections
- [ ] Can reorder sections via drag-drop
- [ ] Can add conditional logic to any question (except first)
- [ ] Can select source question from previous questions
- [ ] Conditional logic persists after save
- [ ] Questions hidden/shown correctly on portal based on conditions
- [ ] Can add fields from System Library

### ClientTaskOverridesSection (Custom Client Project Tasks)
- [ ] Can create override from base template
- [ ] Can add custom questions with conditional logic
- [ ] Section structure preserved or customizable
- [ ] Conditional logic works with both inherited and custom questions
- [ ] System Library picker available
- [ ] Uses shared FieldConfigModal for question editing

### Request Templates (System Level)
- [ ] Can create template with sections
- [ ] Can add questions with conditional logic
- [ ] System Library picker available
- [ ] Conditional logic evaluates correctly on client request form
- [ ] Colorful field type styling applied

### Custom Requests (Client Level)
- [ ] Can create request with sections
- [ ] Can add questions with conditional logic
- [ ] System Library picker available
- [ ] Conditional logic works on client form

---

## Testing Criteria

### Browser Testing Setup
```
IMPORTANT: Multi-threaded system requires boot time

1. Open browser testing session
2. Wait 10-15 seconds for full initialization
3. Navigate to root page
4. Click "Passwords" tab
5. Enter: admin@example.com / admin123
6. Wait for dashboard to load
```

### Test Case: Client Project Tasks - Sections
```
Path: Settings → Project Types → [Type] → Client Tasks → Create

Steps:
1. Click "Create Task Template"
2. Enter template name
3. Click "Add Section" 
4. Enter section name: "Personal Information"
5. Click "Add Section" again
6. Enter section name: "Company Details"
7. Drag question type to "Personal Information" section
8. Configure question (label, type, required)
9. Add 2 more questions
10. Click "Next" or "Save"
11. Verify template saved with sections

Expected:
- Sections visible in template editor
- Questions grouped under correct sections
- Section order preserved
```

### Test Case: Client Project Tasks - Conditional Logic
```
Path: Settings → Project Types → [Type] → Client Tasks → Edit template

Steps:
1. Open existing template with 2+ questions
2. Click edit on second question
3. Enable "Conditional Logic" toggle
4. Select first question as source
5. Set operator to "Equals"
6. Set value (based on first question type)
7. Save question
8. Save template
9. Verify conditional logic saved (edit question again)

Expected:
- Toggle appears for non-first questions
- Source question dropdown shows previous questions
- Operator dropdown shows all operators
- Value field appropriate for source question type
- Settings persist after save
```

### Test Case: Conditional Logic Portal Evaluation
```
Path: Client Portal → Task submission

Steps:
1. Create test project for client with task template
2. Access client portal with task
3. Fill in source question that triggers conditional
4. Observe dependent question visibility

Expected:
- Dependent question hidden initially (if condition not met)
- Dependent question appears when condition met
- Form validation respects visibility
```

### Test Case: Request Template Conditional Logic
```
Path: Settings → Request Templates → Create/Edit

Steps:
1. Create/edit request template
2. Add section with 2+ questions
3. Enable conditional logic on second question
4. Configure condition
5. Save template
6. Trigger request for client
7. Submit from client portal

Expected:
- Conditional logic UI available
- Settings persist
- Client form respects conditions
```

### Test Case: ClientTaskOverridesSection
```
Path: Clients → [Client] → Custom Approvals tab → Task Overrides

Steps:
1. Click "Add Task Override"
2. Select project type and template
3. Expand override
4. Add custom question with conditional logic
5. Verify sections are visible/manageable
6. Save override

Expected:
- Override created successfully
- Custom questions can have conditional logic
- Sections honored or customizable
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing templates | Low | High | All changes additive, test with existing data |
| Schema migration needed for override sections | Medium | Medium | Use JSONB or inherit from base |
| Conditional logic edge cases | Medium | Low | Copy tested patterns from ClientTasksTab |
| Portal rendering issues | Medium | Medium | Test all question types with conditions |

---

## Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Verification | 0.5 days | None |
| Phase 2: ClientTaskOverridesSection | 1 day | Phase 1 |
| Phase 3: Request Templates | 1 day | Phase 1 |
| Phase 4: Custom Requests | 0.5 days | Phase 3 |
| Phase 5: End-to-End Testing | 0.5 days | Phases 2-4 |
| **Total** | **3.5 days** | |

---

## Appendix: Component Reference

### Shared Components to Use
- `FieldConfigModal` - `client/src/components/field-builder/FieldConfigModal.tsx`
- `ConditionalLogicEditor` - `client/src/components/field-builder/ConditionalLogicEditor.tsx`
- `SystemFieldLibraryPicker` - `client/src/components/system-field-library-picker.tsx`
- `clientTaskQuestionAdapter` - `client/src/components/field-builder/adapters.ts`

### Context-Specific Adapters (adapters.ts)
```typescript
// Client Task Questions
clientTaskQuestionAdapter.capabilities = {
  supportsConditionalLogic: true,
  supportsOptions: true,
  supportsPlaceholder: true,
  supportsHelpText: true,
  supportsLibraryPicker: true,
};

// Request Template Questions - needs similar adapter
// Custom Request Questions - needs similar adapter
```

### Conditional Logic Data Structure
```typescript
interface ConditionalLogic {
  showIf?: {
    questionId: string;  // ID or tempId of source question
    operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
    value?: string | number | boolean | string[];
  };
  logic?: 'and' | 'or';  // For future multi-condition support
  conditions?: ConditionalLogicCondition[];
}
```

---

*Document created: December 2024*
*Last updated: December 2024*
*Status: Planning*
