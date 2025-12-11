# Client-Specific Stage Approval Forms - Implementation Plan

## Executive Summary

This document outlines the implementation of client-specific stage approval forms, allowing individual clients to have custom approval requirements while maintaining analytical consistency through a shared field library.

**Approach:** Binary override (client uses standard OR custom approval) with a reusable field library for consistency and analysis.

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
  expected_value_boolean BOOLEAN,
  comparison_type comparison_type_enum,
  expected_value_number INTEGER,
  options TEXT[],
  is_commonly_required BOOLEAN DEFAULT false,
  usage_hint TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_library_field_name_per_type UNIQUE (project_type_id, field_name)
);

CREATE INDEX idx_approval_field_library_project_type ON approval_field_library(project_type_id);
```

**Field descriptions:**
| Column | Purpose |
|--------|---------|
| `field_name` | Display name (e.g., "Payroll journals added?") |
| `field_type` | boolean, number, long_text, multi_select |
| `description` | Help text shown to users |
| `expected_value_*` | Validation criteria |
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

### Stage 6: Project Type Detail Page Updates

#### 6.1 New Tab: "Field Library"

Location: `client/src/pages/project-type-detail/components/tabs/FieldLibraryTab.tsx`

Features:
- List all library fields for project type
- Create/edit/delete library fields
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

No changes needed to the component itself - it already renders whatever fields it receives.

#### 8.2 Modify: `client/src/hooks/change-status/useStageChangeConfig.ts`

The hook already fetches config from the API. Backend changes handle returning the correct approval, so frontend automatically gets client-specific fields.

Optional enhancement: Show indicator "Custom approval for [Client Name]" in the modal.

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
  COUNT(*) as response_count
FROM stage_approval_responses sar
JOIN stage_approval_fields saf ON sar.field_id = saf.id
JOIN projects p ON sar.project_id = p.id
JOIN clients c ON p.client_id = c.id
JOIN stage_approvals sa ON saf.stage_approval_id = sa.id
WHERE saf.library_field_id = :libraryFieldId
GROUP BY c.name, sa.name, field_source, sar.value_boolean
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

---

## Implementation Phases

### Phase 1: Foundation (Day 1)

**Tasks:**
1. Create database migration for new tables
2. Add `library_field_id` column to `stage_approval_fields`
3. Create TypeScript types and Zod schemas
4. Create `ApprovalFieldLibraryStorage` class
5. Create `ClientApprovalOverrideStorage` class

**Deliverable:** Schema in place, basic storage methods working

### Phase 2: Backend Integration (Day 2)

**Tasks:**
1. Add API routes for library field management
2. Add API routes for client override management
3. Modify `getResolvedApprovalFields` to handle library inheritance
4. Modify stage change config endpoint to check for overrides
5. Add field creation from library endpoint

**Deliverable:** Full API available, stage changes respect client overrides

### Phase 3: Admin UI - Field Library (Day 3)

**Tasks:**
1. Create `FieldLibraryTab` component
2. Add to project type detail page
3. Create/edit/delete library fields
4. Show usage statistics

**Deliverable:** Admins can manage the field library

### Phase 4: Admin UI - Approval Builder (Day 4)

**Tasks:**
1. Add "Add from Library" to approval field creation
2. Visual distinction for library vs custom fields
3. Copy-from-standard functionality for custom approvals

**Deliverable:** Approval creation leverages field library

### Phase 5: Client Override UI (Day 5)

**Tasks:**
1. Create `CustomApprovalsTab` for client detail page
2. Override creation wizard
3. Override removal confirmation
4. Stage change modal indicator for custom approvals

**Deliverable:** Full client-specific approval management

### Phase 6: Testing & Polish (Day 6)

**Tasks:**
1. End-to-end testing of override flow
2. Test library field updates propagate correctly
3. Test analysis queries work as expected
4. Performance testing of stage change flow
5. Documentation updates

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

### User Experience Risks

| Risk | Mitigation |
|------|------------|
| Confusion about which approval applies | Clear indicator in stage change modal |
| Accidentally creating duplicate fields | Unique constraint on (project_type_id, field_name) in library |
| Complex admin UI | Guided wizards, copy-from-standard option |

---

## Success Metrics

1. **Adoption:** Number of clients with custom overrides
2. **Library utilization:** % of approval fields sourced from library
3. **Analysis value:** Reports generated using cross-client field data
4. **Performance:** Stage change time remains under 500ms
5. **Admin efficiency:** Time to create new client approval < 5 minutes

---

## Open Questions

1. **Permissions:** Who can create/modify client overrides? Account managers? Only super admins?
2. **Visibility:** Should clients see that they have custom approvals in the portal?
3. **History:** Should we track when overrides are added/removed?
4. **Bulk assignment:** Should we support assigning the same custom approval to multiple clients?

---

## Appendix: Type Definitions

```typescript
// New types for shared/schema

export interface ApprovalFieldLibraryItem {
  id: string;
  projectTypeId: string;
  fieldName: string;
  fieldType: 'boolean' | 'number' | 'long_text' | 'multi_select';
  description: string | null;
  placeholder: string | null;
  expectedValueBoolean: boolean | null;
  comparisonType: 'equal_to' | 'less_than' | 'greater_than' | null;
  expectedValueNumber: number | null;
  options: string[] | null;
  isCommonlyRequired: boolean;
  usageHint: string | null;
  createdAt: Date;
}

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

export interface ResolvedStageApprovalField {
  id: string;
  stageApprovalId: string;
  libraryFieldId: string | null;
  fieldName: string;           // From library if linked, else from field
  fieldType: string;           // From library if linked, else from field
  description: string | null;  // From library if linked, else from field
  isRequired: boolean;         // Always from field (per-approval setting)
  order: number;               // Always from field (per-approval setting)
  // ... other resolved properties
  isFromLibrary: boolean;      // Convenience flag for UI
}
```

---

*Document created: December 2024*
*Status: Planning Complete - Ready for Implementation*
