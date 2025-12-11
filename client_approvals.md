# Client-Specific Stage Approval Forms - Implementation Plan

## Executive Summary

This document outlines the implementation of client-specific stage approval forms, allowing individual clients to have custom approval requirements while maintaining analytical consistency through a shared field library.

**Approach:** Binary override (client uses standard OR custom approval) with a reusable field library for consistency and analysis.

**Includes:** Expansion of available field types from 4 to 7 for greater flexibility.

---

## Current Architecture

### How Stage Approvals Work Today

```
projectTypes
    └── stageApprovals (defined per project type)
            └── stageApprovalFields (questions/validations)
                    └── stageApprovalResponses (answers per project)

kanbanStages
    └── stageApprovalId → stageApprovals.id (which approval to show)
```

**Key tables:**
- `stageApprovals` - Approval form definitions, scoped to project type
- `stageApprovalFields` - Individual fields (boolean, number, text, multi_select) with validation rules
- `stageApprovalResponses` - Responses stored per project/field
- `kanbanStages` - Links stages to approvals via `stageApprovalId`

**Limitation:** All clients using the same project type see identical approval forms.

---

## Field Type Expansion

### Current Field Types (4)

| Type | Purpose | Validation |
|------|---------|------------|
| `boolean` | Yes/No confirmation | Must match expected value |
| `number` | Numeric entry | Comparison (=, <, >) against expected |
| `long_text` | Free-form notes | Required check only |
| `multi_select` | Multiple checkbox options | Options validation |

### New Field Types (3 additions)

| Type | Purpose | Validation | Use Cases |
|------|---------|------------|-----------|
| `short_text` | Single-line text | Required check, optional max length | Supplier name, invoice reference, account code |
| `single_select` | Pick ONE from list | Must be one of defined options | Bank account reconciled, payment method used |
| `date` | Date picker | Required, optional before/after/between | Date payroll processed, bank statement date |

### Updated Enum

```typescript
// BEFORE
stageApprovalFieldTypeEnum = ["boolean", "number", "long_text", "multi_select"]

// AFTER
stageApprovalFieldTypeEnum = [
  "boolean",        // Yes/No with expected value
  "number",         // Numeric with comparison
  "short_text",     // Single line text (NEW)
  "long_text",      // Multi-line text
  "single_select",  // Pick one from list (NEW)
  "multi_select",   // Pick multiple from list
  "date"            // Date picker (NEW)
]
```

### Response Storage for New Types

The `stage_approval_responses` table needs new columns:

```sql
ALTER TABLE stage_approval_responses
ADD COLUMN value_short_text VARCHAR(255),
ADD COLUMN value_single_select VARCHAR,
ADD COLUMN value_date TIMESTAMP;
```

Update the check constraint to allow exactly one value column populated:

```sql
ALTER TABLE stage_approval_responses
DROP CONSTRAINT check_single_value_populated;

ALTER TABLE stage_approval_responses
ADD CONSTRAINT check_single_value_populated CHECK (
  (value_boolean IS NOT NULL)::int +
  (value_number IS NOT NULL)::int +
  (value_short_text IS NOT NULL)::int +
  (value_long_text IS NOT NULL)::int +
  (value_single_select IS NOT NULL)::int +
  (value_multi_select IS NOT NULL)::int +
  (value_date IS NOT NULL)::int = 1
);
```

### Validation Rules for New Types

| Type | Schema Column | Validation Options |
|------|---------------|-------------------|
| `short_text` | `value_short_text` | Required only, max 255 chars |
| `single_select` | `value_single_select` | Must be one of `options[]`, required check |
| `date` | `value_date` | Required, optional: `date_comparison_type` (before/after/between) with `expected_date` / `expected_date_end` |

### New Schema Columns for Date Validation

```sql
ALTER TABLE stage_approval_fields
ADD COLUMN date_comparison_type VARCHAR CHECK (date_comparison_type IN ('before', 'after', 'between', 'exact')),
ADD COLUMN expected_date TIMESTAMP,
ADD COLUMN expected_date_end TIMESTAMP;

-- Validation: date fields should have date comparison if validation needed
ALTER TABLE stage_approval_fields
ADD CONSTRAINT check_date_field_validation CHECK (
  field_type != 'date' OR (
    date_comparison_type IS NULL OR 
    (date_comparison_type IN ('before', 'after', 'exact') AND expected_date IS NOT NULL) OR
    (date_comparison_type = 'between' AND expected_date IS NOT NULL AND expected_date_end IS NOT NULL)
  )
);
```

### Frontend Component Updates

The `StageApprovalForm.tsx` component needs new field renderers:

```typescript
// short_text
{field.fieldType === "short_text" && (
  <FormControl>
    <Input
      {...formField}
      maxLength={255}
      placeholder={field.placeholder || ""}
      data-testid={`input-approval-${field.id}`}
    />
  </FormControl>
)}

// single_select
{field.fieldType === "single_select" && field.options && (
  <FormControl>
    <Select onValueChange={formField.onChange} value={formField.value}>
      <SelectTrigger data-testid={`select-approval-${field.id}`}>
        <SelectValue placeholder={field.placeholder || "Select an option"} />
      </SelectTrigger>
      <SelectContent>
        {field.options.map((option: string) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </FormControl>
)}

// date
{field.fieldType === "date" && (
  <FormControl>
    <DatePicker
      date={formField.value}
      onSelect={formField.onChange}
      data-testid={`date-approval-${field.id}`}
    />
  </FormControl>
)}
```

---

## Proposed Architecture

### New Concept: Field Library + Client Overrides

```
approvalFieldLibrary (NEW)
    └── Reusable field definitions per project type
    
stageApprovalFields (MODIFIED)
    └── Can reference libraryFieldId OR define custom field

clientStageApprovalOverrides (NEW)
    └── Maps client + stage to a custom approval
```

### How It Will Work

1. **Library fields** are defined once per project type (e.g., "Payroll journals added?")
2. **Standard approvals** reference library fields
3. **Custom client approvals** can:
   - Pick fields from the same library (enabling cross-client analysis)
   - Add truly unique fields (null `libraryFieldId`)
4. **Runtime:** Check if client has override → use that approval, else use standard
5. **Analysis:** Group responses by `libraryFieldId` regardless of which approval they came from

---

## Database Schema Changes

### Stage 1: Expand Field Types

#### 1.0 Update Field Type Enum

```sql
-- Add new values to the enum
ALTER TYPE stage_approval_field_type ADD VALUE 'short_text';
ALTER TYPE stage_approval_field_type ADD VALUE 'single_select';
ALTER TYPE stage_approval_field_type ADD VALUE 'date';
```

#### 1.0a Add Response Columns

```sql
ALTER TABLE stage_approval_responses
ADD COLUMN value_short_text VARCHAR(255),
ADD COLUMN value_single_select VARCHAR,
ADD COLUMN value_date TIMESTAMP;

-- Update check constraint
ALTER TABLE stage_approval_responses
DROP CONSTRAINT check_single_value_populated;

ALTER TABLE stage_approval_responses
ADD CONSTRAINT check_single_value_populated CHECK (
  (value_boolean IS NOT NULL)::int +
  (value_number IS NOT NULL)::int +
  (value_short_text IS NOT NULL)::int +
  (value_long_text IS NOT NULL)::int +
  (value_single_select IS NOT NULL)::int +
  (value_multi_select IS NOT NULL)::int +
  (value_date IS NOT NULL)::int = 1
);
```

#### 1.0b Add Date Validation Columns

```sql
ALTER TABLE stage_approval_fields
ADD COLUMN date_comparison_type VARCHAR,
ADD COLUMN expected_date TIMESTAMP,
ADD COLUMN expected_date_end TIMESTAMP;

ALTER TABLE stage_approval_fields
ADD CONSTRAINT check_date_comparison_type CHECK (
  date_comparison_type IS NULL OR date_comparison_type IN ('before', 'after', 'between', 'exact')
);

ALTER TABLE stage_approval_fields
ADD CONSTRAINT check_date_field_validation CHECK (
  field_type != 'date' OR (
    date_comparison_type IS NULL OR 
    (date_comparison_type IN ('before', 'after', 'exact') AND expected_date IS NOT NULL) OR
    (date_comparison_type = 'between' AND expected_date IS NOT NULL AND expected_date_end IS NOT NULL)
  )
);
```

### Stage 1: New Tables

#### 1.1 Approval Field Library

```sql
CREATE TABLE approval_field_library (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type_id VARCHAR NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
  field_name VARCHAR NOT NULL,
  field_type stage_approval_field_type_enum NOT NULL,
  description TEXT,
  placeholder VARCHAR,
  -- Boolean validation
  expected_value_boolean BOOLEAN,
  -- Number validation
  comparison_type comparison_type_enum,
  expected_value_number INTEGER,
  -- Date validation (NEW)
  date_comparison_type VARCHAR,
  expected_date TIMESTAMP,
  expected_date_end TIMESTAMP,
  -- Select options
  options TEXT[],
  -- Library metadata
  is_commonly_required BOOLEAN DEFAULT false,
  usage_hint TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_library_field_name_per_type UNIQUE (project_type_id, field_name),
  CONSTRAINT check_date_comparison_type CHECK (
    date_comparison_type IS NULL OR date_comparison_type IN ('before', 'after', 'between', 'exact')
  )
);

CREATE INDEX idx_approval_field_library_project_type ON approval_field_library(project_type_id);
CREATE INDEX idx_approval_field_library_field_type ON approval_field_library(field_type);
```

**Field descriptions:**
| Column | Purpose |
|--------|---------|
| `field_name` | Display name (e.g., "Payroll journals added?") |
| `field_type` | boolean, number, short_text, long_text, single_select, multi_select, date |
| `description` | Help text shown to users |
| `expected_value_*` | Validation criteria for boolean/number |
| `date_comparison_type` | Validation type for dates (before/after/between/exact) |
| `expected_date` / `expected_date_end` | Date validation boundaries |
| `options` | Choices for single_select and multi_select |
| `is_commonly_required` | Hint for UI - suggests this field is typically required |
| `usage_hint` | Admin guidance (e.g., "Use for clients with payroll services") |

#### 1.2 Client Stage Approval Overrides

```sql
CREATE TABLE client_stage_approval_overrides (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_type_id VARCHAR NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
  stage_id VARCHAR NOT NULL REFERENCES kanban_stages(id) ON DELETE CASCADE,
  override_approval_id VARCHAR NOT NULL REFERENCES stage_approvals(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by_user_id VARCHAR REFERENCES users(id),
  
  CONSTRAINT unique_client_stage_override UNIQUE (client_id, project_type_id, stage_id)
);

CREATE INDEX idx_client_overrides_client ON client_stage_approval_overrides(client_id);
CREATE INDEX idx_client_overrides_project_type ON client_stage_approval_overrides(project_type_id);
CREATE INDEX idx_client_overrides_stage ON client_stage_approval_overrides(stage_id);
```

### Stage 2: Modify Existing Table

#### 2.1 Add Library Reference to Stage Approval Fields

```sql
ALTER TABLE stage_approval_fields 
ADD COLUMN library_field_id VARCHAR REFERENCES approval_field_library(id) ON DELETE SET NULL;

CREATE INDEX idx_stage_approval_fields_library ON stage_approval_fields(library_field_id);
```

**Behavior:**
- If `library_field_id` is set → field inherits definition from library (field_name, field_type, description, validation rules)
- If `library_field_id` is null → field uses its own column values (existing behavior)
- `is_required` and `order` are ALWAYS per-approval (not inherited)

---

## Backend Implementation

### Stage 3: Storage Layer

#### 3.0 Update Validation Logic

Modify `projectApprovalsStorage.ts` → `validateStageApprovalResponses` to handle new types:

```typescript
// Add validation for new field types

} else if (field.fieldType === 'short_text') {
  // Short text: just check required and length
  if (field.isRequired && (!response.valueShortText || response.valueShortText.trim() === '')) {
    failedFields.push(field.fieldName);
  }
  if (response.valueShortText && response.valueShortText.length > 255) {
    failedFields.push(`${field.fieldName}: exceeds 255 character limit`);
  }

} else if (field.fieldType === 'single_select') {
  // Single select: must be one of options
  if (field.isRequired && !response.valueSingleSelect) {
    failedFields.push(field.fieldName);
  }
  if (response.valueSingleSelect && field.options && !field.options.includes(response.valueSingleSelect)) {
    failedFields.push(`${field.fieldName}: invalid option selected`);
  }

} else if (field.fieldType === 'date') {
  // Date: check required and optional date comparison
  if (field.isRequired && !response.valueDate) {
    failedFields.push(field.fieldName);
  }
  if (response.valueDate && field.dateComparisonType && field.expectedDate) {
    const responseDate = new Date(response.valueDate);
    const expectedDate = new Date(field.expectedDate);
    let isValid = true;
    
    switch (field.dateComparisonType) {
      case 'before':
        isValid = responseDate < expectedDate;
        break;
      case 'after':
        isValid = responseDate > expectedDate;
        break;
      case 'exact':
        isValid = responseDate.toDateString() === expectedDate.toDateString();
        break;
      case 'between':
        const endDate = new Date(field.expectedDateEnd!);
        isValid = responseDate >= expectedDate && responseDate <= endDate;
        break;
    }
    
    if (!isValid) {
      failedFields.push(field.fieldName);
    }
  }
}
```

#### 3.1 New File: `server/storage/projects/approvalFieldLibraryStorage.ts`

```typescript
export class ApprovalFieldLibraryStorage extends BaseStorage {
  
  // Get all library fields for a project type
  async getLibraryFieldsByProjectType(projectTypeId: string): Promise<ApprovalFieldLibraryItem[]>
  
  // Get a single library field
  async getLibraryFieldById(id: string): Promise<ApprovalFieldLibraryItem | undefined>
  
  // Create a new library field
  async createLibraryField(field: InsertApprovalFieldLibraryItem): Promise<ApprovalFieldLibraryItem>
  
  // Update a library field (propagates to all usages)
  async updateLibraryField(id: string, updates: Partial<InsertApprovalFieldLibraryItem>): Promise<ApprovalFieldLibraryItem>
  
  // Delete a library field (only if not in use)
  async deleteLibraryField(id: string): Promise<void>
  
  // Get usage count for a library field
  async getLibraryFieldUsageCount(id: string): Promise<number>
  
  // Get all approvals using a library field
  async getApprovalsUsingLibraryField(id: string): Promise<StageApproval[]>
}
```

#### 3.2 New File: `server/storage/projects/clientApprovalOverrideStorage.ts`

```typescript
export class ClientApprovalOverrideStorage extends BaseStorage {
  
  // Check if client has override for a stage
  async getClientOverride(
    clientId: string, 
    projectTypeId: string, 
    stageId: string
  ): Promise<ClientStageApprovalOverride | undefined>
  
  // Get all overrides for a client
  async getOverridesByClient(clientId: string): Promise<ClientStageApprovalOverrideWithDetails[]>
  
  // Get all overrides for a project type (admin view)
  async getOverridesByProjectType(projectTypeId: string): Promise<ClientStageApprovalOverrideWithDetails[]>
  
  // Create an override
  async createOverride(override: InsertClientStageApprovalOverride): Promise<ClientStageApprovalOverride>
  
  // Delete an override (revert to standard)
  async deleteOverride(id: string): Promise<void>
  
  // Batch check overrides for multiple stages (optimization)
  async getClientOverridesForProject(
    clientId: string, 
    projectTypeId: string
  ): Promise<Map<string, string>> // stageId → overrideApprovalId
}
```

#### 3.3 Modify: `server/storage/projects/projectApprovalsStorage.ts`

Add method to resolve fields with library inheritance:

```typescript
async getResolvedApprovalFields(approvalId: string): Promise<ResolvedStageApprovalField[]> {
  // 1. Get all fields for approval
  // 2. For each field with libraryFieldId, merge library definition
  // 3. Return unified field list with inherited values resolved
}
```

### Stage 4: Modify Stage Change Flow

#### 4.1 Update: `server/routes/projects/status.ts`

In the stage change config endpoint (`GET /api/projects/:id/stage-change-config`):

```typescript
// BEFORE: Get approval from stage
const stageApproval = stage.stageApprovalId 
  ? await storage.getStageApprovalById(stage.stageApprovalId)
  : null;

// AFTER: Check for client override first
const clientOverride = await storage.getClientOverride(
  project.clientId,
  project.projectTypeId,
  targetStageId
);

const effectiveApprovalId = clientOverride?.overrideApprovalId ?? stage.stageApprovalId;
const stageApproval = effectiveApprovalId
  ? await storage.getStageApprovalById(effectiveApprovalId)
  : null;

// Get resolved fields (with library inheritance)
const approvalFields = stageApproval
  ? await storage.getResolvedApprovalFields(stageApproval.id)
  : [];
```

**Impact:** +1 query to check for override. Minimal performance impact.

---

## API Routes

### Stage 5: New Endpoints

#### 5.1 Library Field Management

```
GET    /api/project-types/:id/approval-field-library
POST   /api/project-types/:id/approval-field-library
PATCH  /api/approval-field-library/:id
DELETE /api/approval-field-library/:id
GET    /api/approval-field-library/:id/usage
```

#### 5.2 Client Override Management

```
GET    /api/clients/:id/approval-overrides
POST   /api/clients/:id/approval-overrides
DELETE /api/clients/:id/approval-overrides/:overrideId

GET    /api/project-types/:id/client-overrides  (admin view: which clients have overrides)
```

#### 5.3 Enhanced Approval Field Endpoints

```
POST   /api/stage-approvals/:id/fields/from-library
       Body: { libraryFieldId, order, isRequired }
       (Creates field referencing library item)
```

---

## Frontend Implementation

### Stage 6: Update Stage Approval Form for New Field Types

#### 6.0 Modify: `client/src/components/change-status/StageApprovalForm.tsx`

Add renderers for new field types:

```typescript
// Add imports
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker"; // or Popover + Calendar

// In the render, add cases for new types:

{field.fieldType === "short_text" && (
  <div className="space-y-3">
    <FormControl>
      <Input
        {...formField}
        maxLength={255}
        placeholder={field.placeholder || "Enter text..."}
        data-testid={`input-short-text-approval-${field.id}`}
      />
    </FormControl>
    <FormMessage />
  </div>
)}

{field.fieldType === "single_select" && field.options && field.options.length > 0 && (
  <div className="space-y-3">
    <FormControl>
      <Select onValueChange={formField.onChange} value={formField.value || ""}>
        <SelectTrigger data-testid={`select-approval-${field.id}`}>
          <SelectValue placeholder={field.placeholder || "Select an option..."} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option: string) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormControl>
    <FormMessage />
  </div>
)}

{field.fieldType === "date" && (
  <div className="space-y-3">
    {field.dateComparisonType && field.expectedDate && (
      <FormDescription className="flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Date must be {field.dateComparisonType}{" "}
        <strong>{format(new Date(field.expectedDate), "PP")}</strong>
        {field.dateComparisonType === "between" && field.expectedDateEnd && (
          <> and <strong>{format(new Date(field.expectedDateEnd), "PP")}</strong></>
        )}
      </FormDescription>
    )}
    <FormControl>
      <DatePicker
        date={formField.value}
        onSelect={formField.onChange}
        data-testid={`date-approval-${field.id}`}
      />
    </FormControl>
    <FormMessage />
  </div>
)}
```

### Stage 6: Project Type Detail Page Updates

#### 6.1 New Tab: "Field Library"

Location: `client/src/pages/project-type-detail/components/tabs/FieldLibraryTab.tsx`

Features:
- List all library fields for project type
- Create/edit/delete library fields
- **Support all 7 field types with appropriate config UI**
- Show usage count per field
- Filter by field type
- "Commonly required" toggle

#### 6.2 Modify: "Stage Approvals" Tab

When adding fields to an approval:
- New button: "Add from Library"
- Opens modal showing available library fields
- One-click add with order/required settings
- Visual indicator for library-sourced vs custom fields

### Stage 7: Client Detail Page Updates

#### 7.1 New Tab: "Custom Approvals"

Location: `client/src/pages/client-detail/components/tabs/CustomApprovalsTab.tsx`

Features:
- List stages with overrides for this client
- "Add Override" button → select project type → select stage → select/create approval
- "Remove Override" → revert to standard
- Quick view of what fields are in custom vs standard

#### 7.2 Override Creation Flow

```
1. Select project type (e.g., "Monthly Bookkeeping")
2. Select stage (e.g., "Review Complete")
3. Either:
   a. Select existing custom approval (if one exists)
   b. Create new approval:
      - Start blank OR copy from standard
      - Add fields from library / create custom
      - Save and assign as override
```

### Stage 8: Stage Change Modal Updates

#### 8.1 Modify: `client/src/components/change-status/StageApprovalForm.tsx`

Already covered in Stage 6.0 - new field type renderers.

#### 8.2 Modify: `client/src/hooks/change-status/useStageChangeConfig.ts`

The hook already fetches config from the API. Backend changes handle returning the correct approval, so frontend automatically gets client-specific fields.

Optional enhancement: Show indicator "Custom approval for [Client Name]" in the modal.

#### 8.3 Modify: `client/src/hooks/change-status/useApprovalFormSchema.ts`

Update schema generation to handle new field types:

```typescript
// Add schema rules for new types
case 'short_text':
  schema[field.id] = field.isRequired
    ? z.string().min(1, "This field is required").max(255)
    : z.string().max(255).optional();
  break;

case 'single_select':
  schema[field.id] = field.isRequired
    ? z.string().min(1, "Please select an option")
    : z.string().optional();
  break;

case 'date':
  schema[field.id] = field.isRequired
    ? z.date({ required_error: "Please select a date" })
    : z.date().optional();
  break;
```

---

## Analysis Capabilities

### Stage 9: Reporting Queries

#### 9.1 Cross-Client Field Analysis

```sql
-- Responses to a library field across all clients
SELECT 
  c.name as client_name,
  sa.name as approval_name,
  CASE 
    WHEN saf.library_field_id IS NOT NULL THEN 'Library'
    ELSE 'Custom'
  END as field_source,
  sar.value_boolean,
  sar.value_number,
  sar.value_short_text,
  sar.value_single_select,
  sar.value_date,
  COUNT(*) as response_count
FROM stage_approval_responses sar
JOIN stage_approval_fields saf ON sar.field_id = saf.id
JOIN projects p ON sar.project_id = p.id
JOIN clients c ON p.client_id = c.id
JOIN stage_approvals sa ON saf.stage_approval_id = sa.id
WHERE saf.library_field_id = :libraryFieldId
GROUP BY c.name, sa.name, field_source, 
  sar.value_boolean, sar.value_number, sar.value_short_text, 
  sar.value_single_select, sar.value_date
ORDER BY c.name;
```

#### 9.2 Library Field Usage Report

```sql
-- Which library fields are most used?
SELECT 
  afl.field_name,
  afl.field_type,
  COUNT(DISTINCT saf.stage_approval_id) as approval_count,
  COUNT(DISTINCT sar.project_id) as project_response_count
FROM approval_field_library afl
LEFT JOIN stage_approval_fields saf ON saf.library_field_id = afl.id
LEFT JOIN stage_approval_responses sar ON sar.field_id = saf.id
WHERE afl.project_type_id = :projectTypeId
GROUP BY afl.id, afl.field_name, afl.field_type
ORDER BY approval_count DESC;
```

#### 9.3 Clients with Custom Approvals

```sql
-- Which clients have overrides and for which stages?
SELECT 
  c.name as client_name,
  pt.name as project_type,
  ks.name as stage_name,
  sa.name as custom_approval_name,
  csao.created_at as override_created
FROM client_stage_approval_overrides csao
JOIN clients c ON csao.client_id = c.id
JOIN project_types pt ON csao.project_type_id = pt.id
JOIN kanban_stages ks ON csao.stage_id = ks.id
JOIN stage_approvals sa ON csao.override_approval_id = sa.id
ORDER BY c.name, pt.name, ks.order;
```

#### 9.4 Field Type Distribution

```sql
-- What field types are most commonly used?
SELECT 
  field_type,
  COUNT(*) as library_count,
  COUNT(DISTINCT project_type_id) as project_types_using
FROM approval_field_library
GROUP BY field_type
ORDER BY library_count DESC;
```

---

## Implementation Phases

### Phase 1: Foundation (Day 1)

**Tasks:**
1. Create database migration:
   - Expand `stage_approval_field_type` enum with new values
   - Add new columns to `stage_approval_fields` (date validation)
   - Add new columns to `stage_approval_responses` (value_short_text, value_single_select, value_date)
   - Update check constraint for single value populated
   - Create `approval_field_library` table
   - Create `client_stage_approval_overrides` table
   - Add `library_field_id` column to `stage_approval_fields`
2. Create TypeScript types and Zod schemas for all new types
3. Create `ApprovalFieldLibraryStorage` class
4. Create `ClientApprovalOverrideStorage` class

**Deliverable:** Schema in place, basic storage methods working

### Phase 2: Backend Integration (Day 2)

**Tasks:**
1. Update validation logic in `projectApprovalsStorage.ts` for new field types
2. Add API routes for library field management
3. Add API routes for client override management
4. Modify `getResolvedApprovalFields` to handle library inheritance
5. Modify stage change config endpoint to check for overrides
6. Add field creation from library endpoint

**Deliverable:** Full API available, stage changes respect client overrides

### Phase 3: Frontend - New Field Types (Day 3)

**Tasks:**
1. Update `StageApprovalForm.tsx` with renderers for short_text, single_select, date
2. Update `useApprovalFormSchema.ts` for new field type validation
3. Update `ApprovalFieldForm.tsx` to allow creating/editing new field types
4. Test new field types work in stage change flow

**Deliverable:** New field types fully functional in existing approval flow

### Phase 4: Admin UI - Field Library (Day 4)

**Tasks:**
1. Create `FieldLibraryTab` component
2. Add to project type detail page
3. Create/edit/delete library fields (all 7 types)
4. Show usage statistics

**Deliverable:** Admins can manage the field library

### Phase 5: Admin UI - Approval Builder (Day 5)

**Tasks:**
1. Add "Add from Library" to approval field creation
2. Visual distinction for library vs custom fields
3. Copy-from-standard functionality for custom approvals

**Deliverable:** Approval creation leverages field library

### Phase 6: Client Override UI (Day 6)

**Tasks:**
1. Create `CustomApprovalsTab` for client detail page
2. Override creation wizard
3. Override removal confirmation
4. Stage change modal indicator for custom approvals

**Deliverable:** Full client-specific approval management

### Phase 7: Testing & Polish (Day 7)

**Tasks:**
1. End-to-end testing of all 7 field types
2. End-to-end testing of override flow
3. Test library field updates propagate correctly
4. Test analysis queries work as expected
5. Performance testing of stage change flow
6. Documentation updates

**Deliverable:** Production-ready feature

---

## Risk Mitigation

### Performance Risks

| Risk | Mitigation |
|------|------------|
| Extra query per stage change | Single indexed lookup, <5ms |
| Library field inheritance resolution | Eager join in single query |
| Many overrides to check | Batch fetch for project on modal open |

### Data Integrity Risks

| Risk | Mitigation |
|------|------------|
| Deleting library field in use | Prevent deletion, or set `library_field_id` to null (field becomes custom) |
| Updating library field | Changes propagate to all usages (feature, not bug) |
| Orphaned overrides | Cascade delete when stage/approval deleted |
| Invalid date comparisons | Database constraints prevent invalid config |

### User Experience Risks

| Risk | Mitigation |
|------|------------|
| Confusion about which approval applies | Clear indicator in stage change modal |
| Accidentally creating duplicate fields | Unique constraint on (project_type_id, field_name) in library |
| Complex admin UI | Guided wizards, copy-from-standard option |
| Date picker confusion | Show expected date range/comparison in description |

---

## Success Metrics

1. **Adoption:** Number of clients with custom overrides
2. **Library utilization:** % of approval fields sourced from library
3. **Field type usage:** Distribution of field types used (expect increase in single_select, date)
4. **Analysis value:** Reports generated using cross-client field data
5. **Performance:** Stage change time remains under 500ms
6. **Admin efficiency:** Time to create new client approval < 5 minutes

---

## Open Questions

1. **Permissions:** Who can create/modify client overrides? Account managers? Only super admins?
2. **Visibility:** Should clients see that they have custom approvals in the portal?
3. **History:** Should we track when overrides are added/removed?
4. **Bulk assignment:** Should we support assigning the same custom approval to multiple clients?
5. **Date defaults:** Should date fields allow "today", "project due date", etc. as dynamic defaults?

---

## Appendix A: Complete Type Definitions

```typescript
// New types for shared/schema

// Field type enum (expanded)
export type StageApprovalFieldType = 
  | 'boolean' 
  | 'number' 
  | 'short_text' 
  | 'long_text' 
  | 'single_select' 
  | 'multi_select' 
  | 'date';

// Date comparison type
export type DateComparisonType = 'before' | 'after' | 'between' | 'exact';

// Library field definition
export interface ApprovalFieldLibraryItem {
  id: string;
  projectTypeId: string;
  fieldName: string;
  fieldType: StageApprovalFieldType;
  description: string | null;
  placeholder: string | null;
  // Boolean validation
  expectedValueBoolean: boolean | null;
  // Number validation
  comparisonType: 'equal_to' | 'less_than' | 'greater_than' | null;
  expectedValueNumber: number | null;
  // Date validation
  dateComparisonType: DateComparisonType | null;
  expectedDate: Date | null;
  expectedDateEnd: Date | null;
  // Select options
  options: string[] | null;
  // Library metadata
  isCommonlyRequired: boolean;
  usageHint: string | null;
  createdAt: Date;
}

// Client override
export interface ClientStageApprovalOverride {
  id: string;
  clientId: string;
  projectTypeId: string;
  stageId: string;
  overrideApprovalId: string;
  notes: string | null;
  createdAt: Date;
  createdByUserId: string | null;
}

// Resolved field (with library inheritance applied)
export interface ResolvedStageApprovalField {
  id: string;
  stageApprovalId: string;
  libraryFieldId: string | null;
  // Core field properties (from library if linked)
  fieldName: string;
  fieldType: StageApprovalFieldType;
  description: string | null;
  placeholder: string | null;
  // Validation (from library if linked)
  expectedValueBoolean: boolean | null;
  comparisonType: 'equal_to' | 'less_than' | 'greater_than' | null;
  expectedValueNumber: number | null;
  dateComparisonType: DateComparisonType | null;
  expectedDate: Date | null;
  expectedDateEnd: Date | null;
  options: string[] | null;
  // Per-approval settings (never inherited)
  isRequired: boolean;
  order: number;
  // Metadata
  isFromLibrary: boolean;
}

// Response with all value columns
export interface StageApprovalResponse {
  id: string;
  projectId: string;
  fieldId: string;
  valueBoolean: boolean | null;
  valueNumber: number | null;
  valueShortText: string | null;
  valueLongText: string | null;
  valueSingleSelect: string | null;
  valueMultiSelect: string[] | null;
  valueDate: Date | null;
  createdAt: Date;
}
```

---

## Appendix B: Field Type Summary

| Type | Response Column | Validation Options | UI Component |
|------|-----------------|-------------------|--------------|
| `boolean` | `value_boolean` | Expected value (true/false) | Switch |
| `number` | `value_number` | Comparison (=, <, >) | Input[type=number] |
| `short_text` | `value_short_text` | Required only, max 255 | Input[type=text] |
| `long_text` | `value_long_text` | Required only | Textarea |
| `single_select` | `value_single_select` | Must be in options | Select dropdown |
| `multi_select` | `value_multi_select` | All must be in options | Checkbox group |
| `date` | `value_date` | Before/after/between/exact | DatePicker |

---

*Document created: December 2024*
*Last updated: December 2024*
*Status: Planning Complete - Ready for Implementation*
