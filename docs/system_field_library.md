# System Field Library - Design Document

## Implementation Status

| Phase | Status | Completion Date |
|-------|--------|-----------------|
| Phase 0: Discovery | ✅ Complete | Dec 2024 |
| Phase 1: Schema & API | ✅ Complete | Dec 2024 |
| Phase 2: UI Components | ✅ Complete | Dec 2024 |
| Phase 3: Context Integration | 🔲 Pending | - |

### Phase 1 Implementation Summary

Created the foundational System Field Library infrastructure:

**Schema Layer:**
- `shared/schema/system-field-library/tables.ts` - 3 enums (system_field_type, field_context, field_category), 2 tables (systemFieldLibrary, systemFieldUsage)
- `shared/schema/system-field-library/schemas.ts` - Zod validation schemas with proper field type validation
- 15 unified field types covering all contexts
- 7 contexts for usage tracking, 7 categories for organization

**Storage Layer:**
- `server/storage/system-field-library/systemFieldLibraryStorage.ts` - Full CRUD, archive/restore, usage tracking
- Usage count analytics with automatic increment/decrement

**API Layer:**
- `server/routes/systemFieldLibrary.ts` - Complete REST API
- Endpoints: list, get, create, update, archive, restore, delete, copy-to-context, usage tracking

**Database:**
- Tables created: `system_field_library`, `system_field_usage`
- Indexes for performance on common queries

**Verification Checklist (All Passed):**
- ✅ Database tables exist with correct column structure
- ✅ All 3 enums created (system_field_type, field_context, field_category)
- ✅ 9 indexes created for query performance
- ✅ Schema exported from `shared/schema/index.ts`
- ✅ Routes registered in `server/routes.ts`
- ✅ Storage module registered in `server/storage/index.ts`
- ✅ No LSP/TypeScript errors
- ✅ Server starts successfully with no errors

### Phase 2 Implementation Summary

Built the System Field Library management UI:

**Page Component:**
- `client/src/pages/system-field-library.tsx` - Complete management interface

**Features:**
- Table view listing all fields with search, category/type filters, archive toggle
- Create/Edit modal with full form for all 15 field types
- Field type icons (lucide-react) and color-coded category badges
- Archive/restore functionality with confirmation dialogs
- Usage tracking dialog showing where fields are used
- Dropdown menu with edit, view usage, archive/restore, delete actions
- Responsive design following existing UI patterns
- All interactive elements have data-testid attributes

**Navigation:**
- Route registered at `/system-field-library`
- Added to Admin dropdown menu as "Field Library"

**Form Validation:**
- Zod schema with field type validation
- Options field synced with textarea for select types
- useEffect resets form state when modal opens/field changes

---

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

## Phase 0 Discovery Findings

### Context Audit Summary

The application has **9 distinct form-building contexts** with field definitions. Each uses different schemas, enums, and UI patterns. One context (Signature Fields) is specialized for document signing and may not need System Field Library integration.

### 1. Stage Approvals (Staff-Facing)

**Location:** `shared/schema/projects/tables.ts`

| Aspect | Details |
|--------|---------|
| **Enum** | `stageApprovalFieldTypeEnum` |
| **Types (8)** | `boolean`, `number`, `short_text`, `long_text`, `single_select`, `multi_select`, `date`, `image_upload` |
| **Tables** | `stageApprovals`, `stageApprovalFields`, `stageApprovalResponses` |
| **Library** | `approvalFieldLibrary` (project-type scoped) |
| **Overrides** | `clientStageApprovalOverrides` (approval reassignment only, not field overrides) |
| **Sections** | ❌ Not supported |
| **Conditional Logic** | ❌ Not supported |
| **Expected Values** | ✅ `expectedValueBoolean`, `expectedValueNumber`, `comparisonType`, `dateComparisonType`, `expectedDate`, `expectedDateEnd` |
| **Current UI** | ApprovalWizard with drag-and-drop FieldCanvas |

**Key Observations:**
- Already has a `libraryFieldId` column on `stageApprovalFields` for field library linking
- Response table has typed columns: `valueBoolean`, `valueNumber`, `valueShortText`, `valueLongText`, `valueSingleSelect`, `valueMultiSelect`, `valueDate`, `valueImageUrl`
- Most mature form builder with 2-step wizard pattern

---

### 2. Client Project Tasks (Client-Facing)

**Location:** `shared/schema/client-project-tasks/tables.ts`

| Aspect | Details |
|--------|---------|
| **Enum** | `questionTypeEnum` |
| **Types (10)** | `short_text`, `long_text`, `email`, `number`, `date`, `single_choice`, `multi_choice`, `dropdown`, `yes_no`, `file_upload` |
| **Tables** | `clientProjectTaskTemplates`, `clientProjectTaskQuestions`, `clientProjectTaskResponses` |
| **Sections** | ✅ `clientProjectTaskSections` (name, description, order) |
| **Overrides** | ✅ `clientProjectTaskOverrides`, `clientProjectTaskOverrideQuestions` (full field overrides per client) |
| **Conditional Logic** | ✅ `conditionalLogic` JSONB with operators: `equals`, `not_equals`, `contains`, `is_empty`, `is_not_empty` |
| **File Handling** | Custom `TaskFileAttachment` interface with object storage |
| **OTP Security** | ✅ Optional email verification |

**Key Observations:**
- Full section support with ordering
- Rich conditional logic system
- Client can have completely different questions via override system
- Response table has: `valueText`, `valueNumber`, `valueDate`, `valueBoolean`, `valueMultiSelect`, `valueFile`
- Uses `yes_no` (maps to `boolean`), `single_choice`/`multi_choice` (maps to `single_select`/`multi_select`)

---

### 3. Request Templates (Client-Facing)

**Location:** `shared/schema/requests/tables.ts`

| Aspect | Details |
|--------|---------|
| **Enum** | `questionTypeEnum` (shared with Client Project Tasks) |
| **Types (10)** | Same as Client Project Tasks |
| **Tables** | `clientRequestTemplates`, `clientRequestTemplateSections`, `clientRequestTemplateQuestions` |
| **Sections** | ✅ Full section support with title, description, order |
| **Overrides** | ✅ `clientCustomRequests`, `clientCustomRequestSections`, `clientCustomRequestQuestions` (per-client custom requests) |
| **Conditional Logic** | ✅ Same schema as Client Project Tasks |
| **Categories** | ✅ `clientRequestTemplateCategories` for organizing templates |

**Key Observations:**
- Shares `questionTypeEnum` with Client Project Tasks - good candidate for unification
- Has `validationRules` JSONB column for custom validation
- Categories provide organizational structure

---

### 4. Campaign Pages (Client-Facing)

**Location:** `shared/schema/pages/schemas.ts`

| Aspect | Details |
|--------|---------|
| **Enum** | Inline Zod schema (not database enum) |
| **Types (7)** | `text`, `email`, `phone`, `textarea`, `select`, `checkbox`, `date` |
| **Tables** | `pages`, `pageComponents`, `pageActions`, `pageActionLogs` |
| **Storage** | Forms stored as JSONB in `pageComponents.content` |
| **Sections** | ❌ Not structured (flat field list) |
| **Conditional Logic** | ❌ Not supported |

**Key Observations:**
- Uses different type names: `text` (→ `short_text`), `textarea` (→ `long_text`), `checkbox` (→ `boolean`)
- Forms are embedded in page components, not first-class entities
- No field library concept - fields defined inline per form
- Needs migration to use system field types

---

### 5. Reason Custom Fields (Staff-Facing)

**Location:** `shared/schema/projects/tables.ts`

| Aspect | Details |
|--------|---------|
| **Enum** | `customFieldTypeEnum` |
| **Types (5)** | `boolean`, `number`, `short_text`, `long_text`, `multi_select` |
| **Tables** | `reasonCustomFields`, `reasonFieldResponses` |
| **Context** | Custom data collection when selecting a change reason for project stage transitions |
| **Sections** | ❌ Not supported |
| **Conditional Logic** | ❌ Not supported |

**Key Observations:**
- Subset of stage approval types (missing `single_select`, `date`, `image_upload`)
- Tied to `changeReasons` table
- Response table has strict check constraint ensuring only one value column is populated
- Simple use case - could adopt system field types

---

### 6. Service UDFs (Staff-Facing)

**Location:** `shared/schema/services/schemas.ts`

| Aspect | Details |
|--------|---------|
| **Schema** | `udfDefinitionSchema` (Zod, stored as JSONB) |
| **Types (6)** | `number`, `date`, `boolean`, `short_text`, `long_text`, `dropdown` |
| **Storage** | JSONB array in `services.udfDefinitions` |
| **Values** | JSONB in `clientServices.udfValues` |
| **Sections** | ❌ Not supported |
| **Validation** | ✅ Optional `regex` and `regexError` for custom validation |

**Key Observations:**
- Not database-normalized - definitions stored as JSONB
- Uses `dropdown` type (exists in `questionTypeEnum` but not `stageApprovalFieldTypeEnum`)
- Has `placeholder` and `options` support
- Per-service definitions, per-client-service values

---

### 7. Risk Assessments (Staff-Facing)

**Location:** `shared/schema/requests/tables.ts`

| Aspect | Details |
|--------|---------|
| **Enum** | `riskResponseEnum` |
| **Types (3)** | `yes`, `no`, `na` (hardcoded responses, not configurable field types) |
| **Tables** | `riskAssessments`, `riskAssessmentResponses` |
| **Fields** | Hardcoded `questionKey` values (not dynamic) |
| **Sections** | ❌ Not supported |

**Key Observations:**
- **NOT a form builder** - predefined questions with fixed response options
- Questions are defined in code, not database
- May not need System Field Library integration
- Could be enhanced to support custom questions in future

---

### 8. Page Templates (Admin-Facing)

**Location:** `shared/schema/pages/tables.ts`

| Aspect | Details |
|--------|---------|
| **Storage** | JSONB in `pageTemplates.componentsTemplate` and `actionsTemplate` |
| **Purpose** | Reusable page layouts for campaigns |
| **Forms** | Inherits from Campaign Pages schema |

**Key Observations:**
- Templates for Campaign Pages
- Same form field limitations as Campaign Pages
- Enhancement would cascade from Campaign Pages work

---

### 9. Signature Fields (Client-Facing, Specialized)

**Location:** `shared/schema/documents/tables.ts`

| Aspect | Details |
|--------|---------|
| **Enum** | `signatureFieldTypeEnum` |
| **Types (2)** | `signature`, `typed_name` |
| **Tables** | `signatureRequests`, `signatureFields`, `signatures`, `signatureRequestRecipients` |
| **Context** | Electronic document signing with positioned fields on PDF pages |
| **Sections** | ❌ Not applicable (fields positioned on document pages) |
| **Positioning** | `pageNumber`, `xPosition`, `yPosition`, `width`, `height` |

**Key Observations:**
- **Specialized use case** - not a general form builder
- Fields are positioned spatially on PDF pages, not in a form layout
- Only 2 types: drawn signature and typed name
- UK eIDAS-compliant electronic signatures
- **May not need System Field Library integration** - too specialized

---

### Field Type Consolidation Matrix

| Unified Type | Stage Approvals | Task Questions | Custom Fields | Service UDFs | Campaign Pages |
|-------------|-----------------|----------------|---------------|--------------|----------------|
| `short_text` | ✅ | ✅ | ✅ | ✅ | ✅ (`text`) |
| `long_text` | ✅ | ✅ | ✅ | ✅ | ✅ (`textarea`) |
| `email` | ❌ | ✅ | ❌ | ❌ | ✅ |
| `phone` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `url` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `number` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `currency` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `percentage` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `boolean` | ✅ | ✅ (`yes_no`) | ✅ | ✅ | ✅ (`checkbox`) |
| `single_select` | ✅ | ✅ (`single_choice`) | ❌ | ❌ | ✅ (`select`) |
| `multi_select` | ✅ | ✅ (`multi_choice`) | ✅ | ❌ | ❌ |
| `dropdown` | ❌ | ✅ | ❌ | ✅ | ❌ |
| `user_select` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `date` | ✅ | ✅ | ❌ | ✅ | ✅ |
| `file_upload` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `image_upload` | ✅ | ❌ | ❌ | ❌ | ❌ |

**New types to add:** `currency`, `phone`, `url`, `percentage`, `user_select`

---

### Common Patterns Identified

#### 1. Response Storage Patterns

| Pattern | Used By | Approach |
|---------|---------|----------|
| **Typed columns** | Stage Approvals, Reason Fields | Separate column per type (`valueBoolean`, `valueNumber`, etc.) |
| **Generic text** | Request Templates | Single `valueText` with type coercion |
| **JSONB** | Service UDFs | Flexible key-value storage |

**Recommendation:** Typed columns provide better query performance and type safety.

#### 2. Section Support

| Context | Has Sections | Implementation |
|---------|--------------|----------------|
| Client Project Tasks | ✅ | Dedicated `clientProjectTaskSections` table |
| Request Templates | ✅ | Dedicated `clientRequestTemplateSections` table |
| Stage Approvals | ❌ | Needs addition |
| Campaign Pages | ❌ | Needs addition |
| Reason Custom Fields | ❌ | Not needed (simple use case) |

#### 3. Conditional Logic

| Context | Has Conditional Logic | Schema |
|---------|----------------------|--------|
| Client Project Tasks | ✅ | `showIf` with `questionId`, `operator`, `value` |
| Request Templates | ✅ | Same schema |
| Stage Approvals | ❌ | Needs addition |
| Campaign Pages | ❌ | Needs addition |

#### 4. Override Patterns

| Context | Override Level | Implementation |
|---------|---------------|----------------|
| Stage Approvals | Client can use different approval per stage | `clientStageApprovalOverrides` |
| Client Project Tasks | Client can add/remove questions | `clientProjectTaskOverrides` + `clientProjectTaskOverrideQuestions` |
| Request Templates | Client can have custom requests | `clientCustomRequests` + related tables |

---

### Existing Field Library Analysis

The `approvalFieldLibrary` table already exists and is scoped to `projectTypeId`:

```typescript
approvalFieldLibrary = pgTable("approval_field_library", {
  id: varchar("id"),
  projectTypeId: varchar("project_type_id"),  // Scoped to project type
  fieldName: varchar("field_name"),
  fieldType: stageApprovalFieldTypeEnum,
  description: text,
  placeholder: varchar,
  expectedValueBoolean: boolean,
  comparisonType: comparisonTypeEnum,
  expectedValueNumber: integer,
  dateComparisonType: dateComparisonTypeEnum,
  expectedDate: timestamp,
  expectedDateEnd: timestamp,
  options: text[],
  isCommonlyRequired: boolean,
  usageHint: text,
});
```

**Decision Required:** 
- **Option A:** Extend `approvalFieldLibrary` to be system-wide (remove `projectTypeId` requirement)
- **Option B:** Create new `systemFieldLibrary` table and migrate data
- **Recommendation:** Option B - cleaner separation, allows gradual migration

---

### UI Component Inventory

| Context | Current UI | Builder Quality | Wizard Pattern |
|---------|-----------|-----------------|----------------|
| Stage Approvals | ApprovalWizard | ⭐⭐⭐⭐⭐ | 2-step with drag-drop |
| Client Project Tasks | TaskTemplateEditor | ⭐⭐⭐ | Basic form |
| Request Templates | RequestTemplateEditor | ⭐⭐⭐ | Basic form |
| Campaign Pages | PageBuilder | ⭐⭐⭐⭐ | Visual builder |
| Reason Custom Fields | Inline editor | ⭐⭐ | Modal |
| Service UDFs | ServiceForm | ⭐⭐ | Inline |

**Target:** All contexts should match ApprovalWizard quality (⭐⭐⭐⭐⭐)

---

### Shared Fields Across Contexts

Common accounting/bookkeeping fields that would benefit from library:

1. **Quality Checks**
   - Bank Reconciliation Checked
   - Directors Approved
   - Senior Review Completed
   - All Queries Resolved

2. **Client Information**
   - VAT Registration Number
   - Company UTR
   - Accounting Reference Date

3. **Document Requests**
   - Bank Statements Required
   - Receipts Uploaded
   - Payroll Information

---

### Migration Complexity Assessment

| Context | Complexity | Effort | Notes |
|---------|-----------|--------|-------|
| Stage Approvals | Low | 1 week | Already has `libraryFieldId` column |
| Client Project Tasks | Medium | 1.5 weeks | Need to add `libraryFieldId`, preserve conditional logic |
| Request Templates | Medium | 1.5 weeks | Similar to Client Project Tasks |
| Campaign Pages | High | 2 weeks | JSONB → normalized structure |
| Reason Custom Fields | Low | 0.5 week | Simple structure |
| Service UDFs | Medium | 1 week | JSONB → normalized or keep hybrid |
| Risk Assessments | Skip | - | Hardcoded, not dynamic forms |
| Signature Fields | Skip | - | Specialized document signing, not general forms |

**Total estimated migration effort:** 7.5 weeks (can be parallelized)

---

### Validated Assumptions

✅ **Confirmed:** `stageApprovalFields.libraryFieldId` column exists (line 85 in `shared/schema/projects/tables.ts`)

✅ **Confirmed:** No hidden form builders missed - signature fields identified as 9th context (specialized, skip integration)

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
