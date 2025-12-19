# System Field Library - Design Document

## Overview

This document outlines the design and implementation plan for a **System-Level Field Library** - a unified, company-wide repository of reusable form fields that can be deployed across all form-building contexts in The Link application.

### Problem Statement

Currently, form fields are fragmented across multiple domains with:
- **3 different field type enums** with overlapping but inconsistent types
- **Per-context field definitions** requiring duplicate creation (e.g., "Bank Rec Checked" must be recreated for each project type)
- **Inconsistent UI/UX** across different form builders
- **No standardization** of common accounting/bookkeeping fields

### Solution

A centralized System Field Library where:
1. Fields are defined once at the system level (company-wide)
2. Fields can be used across all form contexts with per-context overrides
3. Consistent, world-class UI across all form builders
4. Standardized field types supporting all use cases

---

## Field Types

### Unified Field Type Set

| Category | Type | Label | Description |
|----------|------|-------|-------------|
| **Text** | `short_text` | Short Text | Single-line text input (max 255 chars) |
| | `long_text` | Long Text | Multi-line textarea |
| | `email` | Email | Email input with validation |
| | `phone` | Phone | Phone number with format validation |
| | `url` | URL | Website URL with validation |
| **Numeric** | `number` | Number | Integer/decimal input |
| | `currency` | Currency | Money input with currency symbol |
| | `percentage` | Percentage | Percentage input (0-100%) |
| **Selection** | `boolean` | Yes/No | Toggle/checkbox |
| | `single_select` | Single Select | Radio buttons or dropdown |
| | `multi_select` | Multi Select | Checkboxes |
| | `dropdown` | Dropdown | Searchable dropdown |
| | `user_select` | User Select | Select system user(s) |
| **Date/Time** | `date` | Date | Date picker |
| **Files** | `file_upload` | File Upload | Document upload |
| | `image_upload` | Image Upload | Image upload with preview |

### Enum Mapping Strategy

Create a unified `system_field_type` enum that encompasses all existing types:

```sql
CREATE TYPE system_field_type AS ENUM (
  'short_text', 'long_text', 'email', 'phone', 'url',
  'number', 'currency', 'percentage',
  'boolean', 'single_select', 'multi_select', 'dropdown', 'user_select',
  'date',
  'file_upload', 'image_upload'
);
```

**Mapping from existing enums:**

| Existing Enum | Existing Value | Maps To |
|---------------|----------------|---------|
| `stageApprovalFieldTypeEnum` | `boolean` | `boolean` |
| | `number` | `number` |
| | `short_text` | `short_text` |
| | `long_text` | `long_text` |
| | `single_select` | `single_select` |
| | `multi_select` | `multi_select` |
| | `date` | `date` |
| | `image_upload` | `image_upload` |
| `questionTypeEnum` | `yes_no` | `boolean` |
| | `single_choice` | `single_select` |
| | `multi_choice` | `multi_select` |
| | `dropdown` | `dropdown` |
| | `file_upload` | `file_upload` |
| | `email` | `email` |
| | `short_text` | `short_text` |
| | `long_text` | `long_text` |
| | `number` | `number` |
| | `date` | `date` |
| `customFieldTypeEnum` | All values | Direct mapping |

---

## Database Schema

### New Tables

#### Architecture Note: Single-Tenant Deployment

The Link is deployed as a **single-tenant application** - each company gets their own Replit deployment with isolated database. There is no `tenantId` column pattern in the existing schema because tenant isolation is handled at the infrastructure level (separate databases per deployment).

This means:
- No tenantId columns needed in new tables
- No cross-tenant data concerns
- Simpler queries without tenant filters
- Consistent with existing tables (users, clients, projects, etc.)

#### 1. `system_field_library`
Central repository of field definitions for this company's deployment.

```typescript
export const systemFieldLibrary = pgTable("system_field_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Core definition
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  fieldType: systemFieldTypeEnum("field_type").notNull(),
  description: text("description"),
  
  // Configuration
  placeholder: varchar("placeholder"),
  helpText: text("help_text"),
  isCommonlyRequired: boolean("is_commonly_required").default(false),
  
  // Type-specific config
  options: text("options").array(),  // For select types
  validationRules: jsonb("validation_rules"),  // Min/max, regex patterns, etc.
  defaultValue: jsonb("default_value"),
  
  // Expected values (for approval-style validation)
  expectedValueBoolean: boolean("expected_value_boolean"),
  expectedValueNumber: integer("expected_value_number"),
  comparisonType: comparisonTypeEnum("comparison_type"),
  
  // Currency/percentage specific
  currencyCode: varchar("currency_code", { length: 3 }),  // GBP, USD, EUR
  decimalPlaces: integer("decimal_places"),
  
  // Categorization
  category: varchar("category"),  // e.g., "Quality Checks", "Client Info"
  tags: text("tags").array(),
  
  // Audit
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isArchived: boolean("is_archived").default(false),
}, (table) => [
  unique("unique_field_slug").on(table.slug),
  index("idx_system_field_library_type").on(table.fieldType),
  index("idx_system_field_library_category").on(table.category),
  index("idx_system_field_library_archived").on(table.isArchived),
]);
```

#### 2. `form_sections`
Reusable section definitions for client-facing forms.

```typescript
export const formSections = pgTable("form_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contextType: varchar("context_type").notNull(), // 'task_template', 'request_template', 'campaign_page'
  contextId: varchar("context_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  isCollapsible: boolean("is_collapsible").default(false),
  isInitiallyCollapsed: boolean("is_initially_collapsed").default(false),
  conditionalLogic: jsonb("conditional_logic"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_form_sections_context").on(table.contextType, table.contextId),
  index("idx_form_sections_order").on(table.contextType, table.contextId, table.order),
]);
```

#### 3. Context Instance Tables
Each context maintains a join table linking to library fields with overrides.

**Pattern for all contexts:**
```typescript
// Example: stage_approval_field_instances
export const stageApprovalFieldInstances = pgTable("stage_approval_field_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stageApprovalId: varchar("stage_approval_id").notNull().references(() => stageApprovals.id, { onDelete: "cascade" }),
  sectionId: varchar("section_id").references(() => formSections.id, { onDelete: "set null" }),
  
  // Library reference (nullable for ad-hoc fields)
  libraryFieldId: varchar("library_field_id").references(() => systemFieldLibrary.id, { onDelete: "restrict" }),
  
  // Per-instance overrides
  labelOverride: varchar("label_override"),
  descriptionOverride: text("description_override"),
  placeholderOverride: varchar("placeholder_override"),
  helpTextOverride: text("help_text_override"),
  isRequired: boolean("is_required").default(false),
  order: integer("order").notNull(),
  
  // For ad-hoc fields (when libraryFieldId is null)
  fieldType: systemFieldTypeEnum("field_type"),
  fieldName: varchar("field_name"),
  options: text("options").array(),
  validationRules: jsonb("validation_rules"),
  
  // Conditional logic
  conditionalLogic: jsonb("conditional_logic"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_safi_approval").on(table.stageApprovalId),
  index("idx_safi_library_field").on(table.libraryFieldId),
  index("idx_safi_order").on(table.stageApprovalId, table.order),
]);
```

---

## Contexts to Support

### Complete Context Inventory

| # | Context | Current Table | Current Enum | Current UI Location | Needs Sections | Priority |
|---|---------|---------------|--------------|---------------------|----------------|----------|
| 1 | Stage Approvals | `stageApprovalFields` | `stageApprovalFieldTypeEnum` | `ApprovalWizard.tsx` ✅ | No | P1 |
| 2 | Custom Approvals | `clientStageApprovalOverrides` | `stageApprovalFieldTypeEnum` | `ApprovalWizard.tsx` ✅ | No | P1 |
| 3 | Approval Field Library | `approvalFieldLibrary` | `stageApprovalFieldTypeEnum` | `FieldLibraryTab.tsx` | No | P1 |
| 4 | Client Project Tasks | `clientProjectTaskQuestions` | `questionTypeEnum` | `TaskTemplateBuilder.tsx` | Yes | P2 |
| 5 | Task Overrides | `clientProjectTaskOverrideQuestions` | `questionTypeEnum` | `TaskOverrideBuilder.tsx` | Yes | P2 |
| 6 | Request Templates | `clientRequestTemplateQuestions` | `questionTypeEnum` | `RequestTemplateBuilder.tsx` | Yes | P3 |
| 7 | Client Requests | `clientCustomRequestQuestions` | `questionTypeEnum` | `CustomRequestBuilder.tsx` | Yes | P3 |
| 8 | Reason Custom Fields | `reasonCustomFields` | `customFieldTypeEnum` | `ReasonFieldsBuilder.tsx` | No | P4 |
| 9 | Campaign Pages | `pageComponents` (JSONB) | N/A (JSON config) | `PageFormEditor.tsx` | Yes | P4 |

### UI Status Assessment

| Context | Current State | Required Work |
|---------|---------------|---------------|
| Stage Approvals | ✅ Modern wizard (ApprovalWizard) | Update to use system library |
| Custom Approvals | ✅ Uses ApprovalWizard | Same as above |
| Client Project Tasks | ⚠️ Basic form builder | Full rebuild with wizard UX |
| Task Overrides | ⚠️ Basic override UI | Align with new task builder |
| Request Templates | ⚠️ Section-based but dated | Modernize with drag-drop |
| Client Requests | ⚠️ Similar to templates | Align with templates |
| Reason Custom Fields | ⚠️ Simple list UI | Modernize with palette |
| Campaign Pages | ⚠️ Component-based editor | Integrate field library |

---

## Implementation Phases

### Phase 0: Discovery & Preparation
**Duration:** 1-2 days  
**Dependencies:** None  
**Goal:** Complete inventory of all existing form fields and UIs

**Tasks:**
- [ ] Count existing fields in each context (production data)
- [ ] Document all current field builders and their file locations
- [ ] Identify shared UI patterns that exist
- [ ] Create field type mapping matrix
- [ ] Identify high-risk migration scenarios
- [ ] Document current section implementations

**Deliverables:**
- `docs/field_audit.md` - Complete inventory
- Field type mapping spreadsheet
- Migration risk assessment

**Success Criteria:**
- ✅ All 9 contexts documented with field counts
- ✅ All UI component files identified
- ✅ Migration risks catalogued with mitigations

---

### Phase 1: Schema & Core Infrastructure
**Duration:** 3-4 days  
**Dependencies:** Phase 0 complete  
**Goal:** Establish database foundation and API layer

**Tasks:**
- [ ] Create `system_field_type` enum with all 16 types
- [ ] Create `system_field_library` table
- [ ] Create `form_sections` table
- [ ] Build storage layer: `server/storage/systemFieldLibrary.ts`
- [ ] Build API routes: `server/routes/systemFieldLibrary.ts`
- [ ] Create Zod schemas for validation
- [ ] Create TypeScript types: `shared/schema/field-library/`
- [ ] Add proper indexes for performance
- [ ] Write unit tests for storage layer

**API Endpoints:**
```
GET    /api/system-field-library              # List all fields
GET    /api/system-field-library/:id          # Get single field
POST   /api/system-field-library              # Create field
PATCH  /api/system-field-library/:id          # Update field
DELETE /api/system-field-library/:id          # Archive field (soft delete)
GET    /api/system-field-library/:id/usage    # Get usage across contexts
POST   /api/system-field-library/seed         # Seed common fields
```

**Success Criteria:**
- ✅ Database schema deployed via `npm run db:push`
- ✅ All CRUD endpoints functional
- ✅ Field usage tracking works
- ✅ Can create/edit/archive fields via API

---

### Phase 2: Field Library Management UI
**Duration:** 2-3 days  
**Dependencies:** Phase 1 complete  
**Goal:** Admin interface for managing system fields

**New Files:**
```
client/src/pages/settings/field-library/
├── index.tsx                    # Main page
├── components/
│   ├── FieldLibraryTable.tsx   # Table view of all fields
│   ├── FieldLibraryForm.tsx    # Create/edit form
│   ├── FieldUsagePanel.tsx     # Shows where field is used
│   ├── FieldPreview.tsx        # Live preview of field
│   └── CategoryFilter.tsx      # Filter by category
```

**Tasks:**
- [ ] Create `/settings/field-library` page route
- [ ] Build `FieldLibraryTable` with sorting, filtering, search
- [ ] Build `FieldLibraryForm` with all field type configurations
- [ ] Build `FieldUsagePanel` showing cross-context usage
- [ ] Add field preview component
- [ ] Implement category management
- [ ] Add bulk actions (archive multiple)
- [ ] Seed button for common accounting fields
- [ ] Add navigation link in settings sidebar

**UI Features:**
- Table view with columns: Name, Type, Category, Usage Count, Created
- Type-specific configuration panels in form
- Live preview while editing
- Usage panel shows: "Used in 3 approvals, 2 task templates"
- Category dropdown with auto-complete

**Success Criteria:**
- ✅ Admins can CRUD system fields from UI
- ✅ Field usage is visible before deletion
- ✅ Can filter/search fields efficiently
- ✅ Common fields can be seeded with one click

---

### Phase 3: Reusable Field Builder Components
**Duration:** 2-3 days  
**Dependencies:** Phase 2 complete  
**Goal:** Extract and create shared builder components

**New Component Library:**
```
client/src/components/field-builder/
├── index.ts                      # Exports
├── types.ts                      # Shared types
├── FieldPalette.tsx              # Left sidebar: library + custom fields
├── FieldCanvas.tsx               # Drop zone with DnD reordering
├── FieldCard.tsx                 # Individual field in canvas
├── FieldConfigModal.tsx          # Field settings dialog
├── SectionManager.tsx            # Section CRUD for client-facing forms
├── SectionHeader.tsx             # Collapsible section header
├── WizardHeader.tsx              # Step indicator + navigation
├── WizardLayout.tsx              # Full-screen wizard container
├── DragHandle.tsx                # Consistent drag grip
├── FieldTypeIcon.tsx             # Icon for each field type
├── FieldTypeLabel.tsx            # Label for each field type
└── hooks/
    ├── useFieldBuilder.ts        # State management hook
    ├── useFieldDragDrop.ts       # DnD logic
    └── useFieldValidation.ts     # Validation logic
```

**Tasks:**
- [ ] Extract common types from ApprovalWizard
- [ ] Create `FieldPalette` with library/custom tabs
- [ ] Create `FieldCanvas` with drop zone
- [ ] Create `FieldCard` with edit/delete actions
- [ ] Create `FieldConfigModal` for all 16 field types
- [ ] Create `SectionManager` for adding/editing sections
- [ ] Create `WizardLayout` wrapper component
- [ ] Create `useFieldBuilder` hook for state
- [ ] Create `useFieldDragDrop` hook for DnD
- [ ] Write Storybook stories for each component
- [ ] Test components in isolation

**Success Criteria:**
- ✅ All components work independently
- ✅ Components support all 16 field types
- ✅ Section support works for client-facing contexts
- ✅ DnD works smoothly for reordering

---

### Phase 4: Stage Approvals Integration
**Duration:** 2-3 days  
**Dependencies:** Phase 3 complete  
**Goal:** Migrate ApprovalWizard to use system library and shared components

**Tasks:**
- [ ] Refactor `ApprovalWizard.tsx` to use shared components
- [ ] Update field palette to fetch from system library API
- [ ] Support both library fields and ad-hoc fields
- [ ] Add "Save to Library" option for ad-hoc fields
- [ ] Migrate `approvalFieldLibrary` data to `system_field_library`
- [ ] Update storage layer for stage approval fields
- [ ] Update API routes
- [ ] Test full create/edit/view flow
- [ ] Test existing approvals still work

**Migration Script:**
```sql
-- Migrate existing approval_field_library to system_field_library
INSERT INTO system_field_library (name, slug, field_type, ...)
SELECT field_name, slugify(field_name), field_type, ...
FROM approval_field_library
WHERE NOT EXISTS (SELECT 1 FROM system_field_library WHERE slug = slugify(field_name));
```

**Success Criteria:**
- ✅ ApprovalWizard uses shared components
- ✅ System library fields appear in palette
- ✅ Existing approvals continue to work
- ✅ Can use library fields with per-instance overrides
- ✅ Can still create ad-hoc fields

---

### Phase 5: Client Project Tasks Integration
**Duration:** 3-4 days  
**Dependencies:** Phase 4 complete  
**Goal:** World-class task form builder with sections

**New/Updated Files:**
```
client/src/pages/project-type-detail/components/tabs/
├── TaskTemplatesTab.tsx          # Updated list view
└── TaskTemplateWizard.tsx        # New wizard builder

client/src/pages/client-detail/components/tabs/
├── TaskOverridesTab.tsx          # Updated list view
└── TaskOverrideWizard.tsx        # New wizard builder
```

**Tasks:**
- [ ] Create `TaskTemplateWizard` using shared components
- [ ] Add section management (add/edit/delete/reorder)
- [ ] Integrate system field library
- [ ] Support conditional logic between fields
- [ ] Create `TaskOverrideWizard` for client overrides
- [ ] Update task preview to show sections
- [ ] Migrate existing `clientProjectTaskQuestions` to new structure
- [ ] Update storage and API layers
- [ ] Test client-facing task form rendering
- [ ] Test task submission flow

**Section Features:**
- Add section with title + optional description
- Drag sections to reorder
- Drag fields between sections
- Collapsible sections option
- Conditional section visibility

**Success Criteria:**
- ✅ Modern wizard-style task builder
- ✅ Section support with drag-and-drop
- ✅ System library fields available
- ✅ Existing tasks still functional
- ✅ Client portal renders sections correctly

---

### Phase 6: Request Templates Integration
**Duration:** 2-3 days  
**Dependencies:** Phase 5 complete  
**Goal:** Unified form builder for client request templates

**Tasks:**
- [ ] Create `RequestTemplateWizard` using shared components
- [ ] Add section management
- [ ] Integrate system field library
- [ ] Support conditional logic
- [ ] Create `CustomRequestWizard` for ad-hoc requests
- [ ] Migrate existing template questions to new structure
- [ ] Update client portal request form rendering
- [ ] Test request submission flow

**Success Criteria:**
- ✅ Modern request template builder
- ✅ Parity with task form builder
- ✅ Existing templates preserved
- ✅ Client portal renders correctly

---

### Phase 7: Reason Custom Fields Integration
**Duration:** 1-2 days  
**Dependencies:** Phase 6 complete  
**Goal:** Update change reason field configuration

**Tasks:**
- [ ] Create `ReasonFieldWizard` or inline builder
- [ ] Integrate system field library
- [ ] Migrate existing reason fields
- [ ] Update stage change modal to use new fields
- [ ] Test reason field capture flow

**Success Criteria:**
- ✅ Reason fields use system library
- ✅ Consistent with other builders
- ✅ Stage change flow works correctly

---

### Phase 8: Campaign Pages Integration
**Duration:** 3-4 days  
**Dependencies:** Phase 7 complete  
**Goal:** Form components in campaign pages use system library

**Current State:**
- Pages use `pageComponents` with `componentType = 'form'`
- Form config stored in JSONB `content` column
- `pageActions` with `actionType = 'custom_form'`

**Tasks:**
- [ ] Update page form component editor
- [ ] Add field palette for form fields
- [ ] Integrate system field library
- [ ] Support sections in page forms
- [ ] Support field overrides in page context
- [ ] Ensure form submissions capture responses correctly
- [ ] Test campaign page form flow end-to-end

**Success Criteria:**
- ✅ Campaign page forms use system library
- ✅ Form responses properly captured
- ✅ Consistent UX with other builders
- ✅ Existing campaign pages still work

---

### Phase 9: Legacy Cleanup & Documentation
**Duration:** 2-3 days  
**Dependencies:** All previous phases complete  
**Goal:** Remove deprecated code, document new system

**Tasks:**
- [ ] Verify all data migrated successfully
- [ ] Remove old `approval_field_library` table (after verification)
- [ ] Remove deprecated storage modules
- [ ] Clean up unused enum values if safe
- [ ] Update `replit.md` with new architecture
- [ ] Create user documentation for field library
- [ ] Performance testing with production-scale data
- [ ] Add monitoring for field library API
- [ ] Final regression testing across all contexts

**Success Criteria:**
- ✅ No deprecated code remains
- ✅ Documentation complete in replit.md
- ✅ Performance acceptable (<200ms API responses)
- ✅ All contexts tested and working

---

## Reusable UI Components Summary

### Component Hierarchy

```
WizardLayout
├── WizardHeader (steps, navigation)
└── WizardContent
    ├── FieldPalette
    │   ├── LibraryFieldsTab
    │   │   └── LibraryFieldItem[] (draggable)
    │   └── CustomFieldsTab
    │       └── FieldTypeItem[] (draggable)
    └── FieldCanvas
        ├── SectionManager (for client-facing)
        │   └── SectionHeader[]
        └── FieldCard[] (sortable)
            └── DragHandle
```

### Props Interface Examples

```typescript
// FieldPalette
interface FieldPaletteProps {
  libraryFields: SystemField[];
  onAddLibraryField: (field: SystemField) => void;
  onAddCustomField: (type: FieldType) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

// FieldCanvas
interface FieldCanvasProps {
  fields: FieldInstance[];
  sections?: FormSection[];
  onReorderFields: (fields: FieldInstance[]) => void;
  onEditField: (index: number) => void;
  onDeleteField: (index: number) => void;
  onReorderSections?: (sections: FormSection[]) => void;
  showSections?: boolean;
  disabled?: boolean;
}

// FieldConfigModal
interface FieldConfigModalProps {
  field: FieldInstance;
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: FieldInstance) => void;
  isViewOnly?: boolean;
  allowSaveToLibrary?: boolean;
  onSaveToLibrary?: (field: SystemField) => void;
}
```

---

## Risk Mitigation

### Migration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | Critical | Full backup before each phase; reversible migrations; verification scripts |
| Enum value gaps | Medium | High | Complete mapping matrix before migration; handle unknown types gracefully |
| Performance degradation | Medium | Medium | Proper indexes; lazy load library; pagination; query optimization |
| Breaking existing forms | Low | Critical | Dual-write during transition; feature flags; extensive regression testing |
| User confusion during transition | Medium | Low | Clear communication; phased rollout; documentation |

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| File upload handling | Medium | Medium | Reuse existing object storage; test thoroughly |
| Conditional logic complexity | High | Medium | Start simple (show/hide); enhance incrementally |
| Override conflicts | Low | Low | Clear precedence: instance > library; validation |
| Cross-context field deletion | Medium | Medium | Soft delete; show usage before deletion; prevent if in use |

### Rollback Strategy

Each phase includes:
1. **Pre-migration backup** of affected tables
2. **Feature flags** to disable new UI if needed
3. **Dual-write period** where old and new systems coexist
4. **Verification queries** to confirm data integrity
5. **Rollback scripts** for database changes

---

## Testing Strategy

### Per Phase Testing

| Phase | Unit Tests | Integration Tests | E2E Tests |
|-------|------------|-------------------|-----------|
| 1 | Storage CRUD | API endpoints | - |
| 2 | - | API + UI | Field library CRUD |
| 3 | Components | - | Component interactions |
| 4 | Storage | API | Full approval flow |
| 5 | Storage | API | Task builder + client submission |
| 6 | Storage | API | Request flow |
| 7 | Storage | API | Reason capture |
| 8 | Storage | API | Campaign page form |
| 9 | - | - | Full regression suite |

### Critical E2E Test Scenarios

1. **Library Field Lifecycle**
   - Create library field → use in approval → submit approval → verify response
   
2. **Task with Sections**
   - Create task template with sections → assign to client → client submits → verify data

3. **Field Override**
   - Use library field in context → override "required" setting → verify validation

4. **Edit Library Field**
   - Edit library field name → verify all instances show new name

5. **Archive Protection**
   - Try to delete field in use → verify prevented with usage message

6. **Migration Verification**
   - Compare pre/post migration data counts and field types

---

## Success Metrics

### Quantitative Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Time to create new form field | ~2 min (per context) | ~30 sec (once) | User testing |
| Field reuse rate | 0% | 50%+ fields used in 2+ contexts | Database query |
| UI component code duplication | High (8 builders) | Low (1 shared library) | Lines of code |
| API response time | - | <200ms for field list | Performance monitoring |

### Qualitative Metrics

- [ ] Admins report finding and reusing existing fields is easy
- [ ] Field library feels like a natural part of the system
- [ ] No regression in existing functionality
- [ ] Consistent UX across all form builders
- [ ] Documentation is clear and helpful

---

## Timeline Summary

| Phase | Duration | Cumulative | Key Deliverable |
|-------|----------|------------|-----------------|
| Phase 0: Discovery | 1-2 days | 2 days | Audit document |
| Phase 1: Schema | 3-4 days | 6 days | Database + API |
| Phase 2: Library UI | 2-3 days | 9 days | Settings page |
| Phase 3: Components | 2-3 days | 12 days | Shared component library |
| Phase 4: Approvals | 2-3 days | 15 days | Migrated approvals |
| Phase 5: Tasks | 3-4 days | 19 days | Task builder + sections |
| Phase 6: Requests | 2-3 days | 22 days | Request builder |
| Phase 7: Reasons | 1-2 days | 24 days | Reason fields |
| Phase 8: Campaigns | 3-4 days | 28 days | Page form fields |
| Phase 9: Cleanup | 2-3 days | 31 days | Complete system |

**Total estimated effort:** 5-6 weeks

---

## Appendix A: Pre-Seeded Common Fields

Fields to include by default for accounting/bookkeeping firms:

### Quality Checks Category
| Name | Type | Description |
|------|------|-------------|
| Bank Reconciliation Checked | boolean | Confirm bank rec is complete |
| VAT Reconciled | boolean | Confirm VAT is reconciled |
| Trial Balance Reviewed | boolean | Confirm TB reviewed |
| Profit & Loss Reviewed | boolean | Confirm P&L reviewed |
| Balance Sheet Reviewed | boolean | Confirm BS reviewed |
| Control Accounts Cleared | boolean | Confirm control accounts cleared |
| Suspense Account Cleared | boolean | Confirm suspense cleared |
| Prior Year Comparison Done | boolean | Confirm PY comparison complete |

### Approvals Category
| Name | Type | Description |
|------|------|-------------|
| Client Sign-Off Obtained | boolean | Client has approved |
| Manager Approval | boolean | Manager has approved |
| Partner Review Complete | boolean | Partner has reviewed |
| Fee Quote Accepted | boolean | Client accepted fee quote |

### Documentation Category
| Name | Type | Description |
|------|------|-------------|
| Screenshot Evidence | image_upload | Screenshot for evidence |
| Supporting Documents | file_upload | Attach supporting docs |
| Internal Notes | long_text | Notes for team |
| Notes for Client | long_text | Notes visible to client |

### Scheduling Category
| Name | Type | Description |
|------|------|-------------|
| Deadline Date | date | Work deadline |
| Client Response Due | date | When client response needed |
| Estimated Completion | date | Expected completion date |

### Resourcing Category
| Name | Type | Description |
|------|------|-------------|
| Estimated Hours | number | Estimated time in hours |
| Actual Hours | number | Actual time spent |
| Assigned Reviewer | user_select | Who should review |
| Assigned Preparer | user_select | Who prepared the work |

### Billing Category
| Name | Type | Description |
|------|------|-------------|
| Fee Amount | currency | Amount to bill |
| Write-Off Amount | currency | Amount written off |
| Billing Notes | long_text | Notes for billing |

### Client Information Category
| Name | Type | Description |
|------|------|-------------|
| Client Email | email | Client email address |
| Client Phone | phone | Client phone number |
| Client Website | url | Client website |
| UTR Number | short_text | Unique Taxpayer Reference |
| Company Number | short_text | Companies House number |

---

## Appendix B: File Location Reference

### Current Implementation Files

```
shared/schema/
├── enums.ts                              # stageApprovalFieldTypeEnum, questionTypeEnum, customFieldTypeEnum
├── projects/tables.ts                    # stageApprovalFields, approvalFieldLibrary, reasonCustomFields
├── client-project-tasks/tables.ts        # clientProjectTaskQuestions, clientProjectTaskOverrideQuestions
├── requests/tables.ts                    # clientRequestTemplateQuestions, clientCustomRequestQuestions
├── pages/tables.ts                       # pageComponents (JSONB forms)
└── campaigns/tables.ts                   # Campaign infrastructure

server/storage/
├── stageApprovalStorage.ts               # Stage approval field CRUD
├── clientProjectTaskStorage.ts           # Task question CRUD
├── requestStorage.ts                     # Request question CRUD
└── [to be created] systemFieldLibrary.ts # New centralized storage

client/src/components/
├── approval-builder/ApprovalWizard.tsx   # Current approval field builder ✅
└── [to be created] field-builder/        # New shared components
```

### New Files to Create

```
shared/schema/field-library/
├── tables.ts                             # system_field_library, form_sections
├── types.ts                              # TypeScript types
├── schemas.ts                            # Zod schemas
├── relations.ts                          # Drizzle relations
└── index.ts                              # Exports

server/storage/
└── systemFieldLibraryStorage.ts          # Library CRUD

server/routes/
└── systemFieldLibrary.ts                 # API routes

client/src/components/field-builder/
├── FieldPalette.tsx
├── FieldCanvas.tsx
├── FieldCard.tsx
├── FieldConfigModal.tsx
├── SectionManager.tsx
├── WizardLayout.tsx
├── hooks/useFieldBuilder.ts
├── types.ts
└── index.ts

client/src/pages/settings/field-library/
├── index.tsx
└── components/
    ├── FieldLibraryTable.tsx
    ├── FieldLibraryForm.tsx
    └── FieldUsagePanel.tsx
```

---

## Appendix C: API Contract Examples

### List System Fields
```
GET /api/system-field-library?category=Quality%20Checks&type=boolean&archived=false

Response:
{
  "fields": [
    {
      "id": "uuid",
      "name": "Bank Reconciliation Checked",
      "slug": "bank-rec-checked",
      "fieldType": "boolean",
      "category": "Quality Checks",
      "usageCount": 5,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### Create System Field
```
POST /api/system-field-library
{
  "name": "VAT Return Status",
  "fieldType": "single_select",
  "category": "Quality Checks",
  "options": ["Not Started", "In Progress", "Submitted", "Acknowledged"],
  "isCommonlyRequired": true,
  "helpText": "Current status of VAT return submission"
}

Response:
{
  "id": "uuid",
  "name": "VAT Return Status",
  "slug": "vat-return-status",
  ...
}
```

### Get Field Usage
```
GET /api/system-field-library/:id/usage

Response:
{
  "fieldId": "uuid",
  "fieldName": "Bank Reconciliation Checked",
  "usage": {
    "stageApprovals": [
      { "id": "uuid", "name": "Monthly Review", "projectType": "Bookkeeping" }
    ],
    "taskTemplates": [
      { "id": "uuid", "name": "Month End Checklist", "projectType": "Bookkeeping" }
    ],
    "requestTemplates": [],
    "reasonFields": [],
    "campaignPages": []
  },
  "totalUsage": 2
}
```

---

*Document created: December 2024*  
*Last updated: December 2024*  
*Status: Planning*
