# Service Configuration UI Redesign

---

## ⚠️ CRITICAL: Browser Testing Requirements

**All browser-based tests for this feature MUST follow the requirements in `Core-Development-Principles/how-to-test.md`.**

Before executing ANY browser test:

1. **Internal Readiness Check** - Verify `/readyz` returns 200 status
2. **External Readiness Check** - Verify the public Replit URL `/readyz` returns 200 (proxy must be ready)
3. **Authentication** - Use `/api/dev-login` endpoint with Bearer token authorization
4. **Retry Protocol** - Handle 502/503 proxy errors with exponential backoff

**Reference Files:**
- `Core-Development-Principles/how-to-test.md` - Browser testing protocol (REQUIRED)
- `Core-Development-Principles/Testing-Principles.md` - Atomic test case standards

**Failure to follow how-to-test.md will result in flaky or failing browser tests due to proxy timing issues.**

---

## Overview

This document outlines the redesign of the Service Configuration page (`/admin/service-config`) to use a wizard-based approach for creating and editing services. The goal is to create a world-class user experience that guides users through a logical series of steps.

## Current State

The current implementation uses a monolithic 2,100+ line page with inline card-based forms. All fields are shown at once, which can be overwhelming and lacks clear guidance for users.

**Current pain points:**
- All options shown at once (overwhelming)
- No logical grouping or progression
- UDF editor is basic and lacks the polish of other form builders
- No drag-and-drop for field ordering
- No system field library integration for UDFs

## Proposed Solution

### Design Principles

1. **Progressive Disclosure** - Show users only what they need at each step
2. **Clear Visual Hierarchy** - Use step indicators to show progress
3. **Consistency** - Follow the gold standard wizard pattern (ApprovalWizard reference)
4. **Flexibility** - Allow navigation back and forth between steps
5. **Persistence** - Save state between steps (in-memory until final save)

### Wizard Steps

#### Step 1: Basic Details
**Purpose:** Capture the core identity of the service

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Name | Text input | Yes | Unique service name |
| Description | Textarea | No | Service description |
| Applicable Client Types | Select | Yes | Company Only / Individual Only / Both |

**Validation:**
- Name must be unique across all services
- Name is required and cannot be empty

---

#### Step 2: Service Settings
**Purpose:** Configure special service behaviors

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Static Service | Toggle | No | Mark as display-only (no scheduling) |
| Companies House Integration | Toggle | No | Enable CH data auto-population |
| - CH Start Date Field | Select (conditional) | If CH enabled | Which CH field maps to start date |
| - CH Due Date Field | Select (conditional) | If CH enabled | Which CH field maps to due date |
| - Target Delivery Offset | Number (conditional) | No | Days before deadline for target delivery |
| VAT Service | Toggle | No | Enable HMRC VAT integration |

**Validation:**
- If CH integration enabled, both date field mappings are required
- Target Delivery Offset must be >= 0 if provided

---

#### Step 3: Work Roles
**Purpose:** Define which work roles are associated with this service

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Work Roles | Multi-select checkboxes | No | Select applicable work roles |

**UI Pattern:**
- Checkbox list of all available work roles
- Shows role descriptions on hover
- Count badge showing selected roles

---

#### Step 4: Display Settings
**Purpose:** Configure how this service appears in other contexts

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Show in Project | Multi-select checkboxes | No | Select services where this appears as priority indicator |

**UI Pattern:**
- Checkbox list of all other services
- Visual preview of what the indicator will look like

---

#### Step 5: Custom Fields (UDFs)
**Purpose:** Define custom data fields for this service using the gold standard field builder

**UI Pattern:** Full field builder experience:
- Left sidebar with Field Palette
  - System Library section (collapsible)
  - Custom Fields section
- Main canvas with drop zone
- Drag-and-drop field ordering
- Field configuration modal on click

**Supported Field Types:**
- Short Text
- Long Text (mapped to short_text in UDF)
- Number
- Date
- Yes/No (Boolean)
- Dropdown (single select)

**Field Properties:**
- Field Name (required)
- Field Type (required)
- Required toggle
- Placeholder text
- Options (for dropdown type)
- Regex validation pattern
- Regex error message

---

### Step Navigation

```
[1. Details] → [2. Settings] → [3. Roles] → [4. Display] → [5. Custom Fields]
```

**Navigation Rules:**
- Steps 1-4 can be navigated freely (Next/Previous buttons)
- Step 5 (Custom Fields) is the final step before saving
- Cancel at any point discards changes
- Save only available on Step 5 (or earlier if all required fields are complete)
- Edit mode starts at Step 1 but all steps are accessible

### Visual Design

Following the gold standard pattern from `form_creation_standards.md`:

```tsx
<div className="fixed inset-0 z-50 bg-background flex flex-col">
  {/* Header with step indicators */}
  <div className="border-b bg-card px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <h1 className="text-xl font-semibold">Create Service</h1>
      </div>
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => (
          <StepIndicator key={step.id} step={step} isActive={currentStep === step.id} isComplete={currentStep > step.id} />
        ))}
      </div>
      <Button onClick={handleSave} disabled={!canSave}>Save Service</Button>
    </div>
  </div>
  
  {/* Main content area - changes based on step */}
  <div className="flex-1 overflow-hidden">
    {/* Step content */}
  </div>
  
  {/* Footer with navigation */}
  <div className="border-t bg-card px-6 py-4">
    <div className="flex items-center justify-between">
      <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
        Previous
      </Button>
      <Button onClick={handleNext} disabled={currentStep === 5}>
        Next
      </Button>
    </div>
  </div>
</div>
```

### Step 5 (Custom Fields) Layout

```tsx
<div className="flex-1 flex overflow-hidden">
  {/* Left Sidebar - 400px */}
  <div className="w-[400px] border-r bg-muted/30 flex flex-col">
    {/* System Library Section - Collapsible */}
    <Collapsible>
      {/* Emerald color scheme */}
    </Collapsible>
    
    {/* Custom Fields Section - Always visible */}
    <div className="flex-1">
      {/* Blue color scheme */}
      {FIELD_TYPES.map(type => <PaletteItem key={type} />)}
    </div>
  </div>
  
  {/* Main Canvas */}
  <div className="flex-1 p-6 overflow-y-auto">
    <div className="max-w-3xl mx-auto">
      {/* Summary card */}
      <Card className="mb-6">
        <CardContent>
          <h3>{serviceName}</h3>
          <p>{fields.length} custom fields</p>
        </CardContent>
      </Card>
      
      {/* Drop zone with sortable fields */}
      <DropZone>
        <SortableContext items={fieldIds}>
          {fields.map(field => <FieldCard key={field.id} />)}
        </SortableContext>
      </DropZone>
    </div>
  </div>
</div>
```

## Data Model

### No Schema Changes Required

The existing schema already supports all required functionality:

**services table:**
```typescript
{
  id: string;
  name: string;
  description: string | null;
  projectTypeId: string | null;
  udfDefinitions: UdfDefinition[]; // Already JSON
  isCompaniesHouseConnected: boolean;
  chStartDateField: string | null;
  chDueDateField: string | null;
  chTargetDeliveryDaysOffset: number | null;
  isPersonalService: boolean;
  applicableClientTypes: "company" | "individual" | "both";
  isStaticService: boolean;
  isVatService: boolean;
  isActive: boolean;
  showInProjectServiceId: string | null;
}
```

**UdfDefinition (unchanged):**
```typescript
{
  id: string;
  name: string;
  type: "number" | "date" | "boolean" | "short_text" | "long_text" | "dropdown";
  required: boolean;
  placeholder?: string;
  options?: string[];
  regex?: string;
  regexError?: string;
}
```

### Migration Notes

**No data migration required.** The existing UDF definitions are already stored in the correct format. Client service mappings (`udfValues`) will continue to work since they reference field IDs that won't change.

## File Structure

### New/Modified Files

```
client/src/
├── pages/
│   └── services.tsx (modified - simplified to list view only)
├── components/
│   └── service-wizard/
│       ├── ServiceWizard.tsx (main wizard component)
│       ├── steps/
│       │   ├── BasicDetailsStep.tsx
│       │   ├── ServiceSettingsStep.tsx
│       │   ├── WorkRolesStep.tsx
│       │   ├── DisplaySettingsStep.tsx
│       │   └── CustomFieldsStep.tsx
│       ├── ServiceFieldPalette.tsx
│       ├── ServiceFieldCard.tsx
│       ├── ServiceFieldConfigModal.tsx
│       └── types.ts
```

## Testing Plan

---

### ⚠️ MANDATORY: Read `Core-Development-Principles/how-to-test.md` Before Testing

**This is not optional.** Browser tests WILL FAIL without following the how-to-test.md protocol.

---

### Pre-Test Requirements (from how-to-test.md)

**Every browser test session must complete these steps IN ORDER:**

```
1. INTERNAL CHECK:  GET /readyz → expect 200
2. EXTERNAL CHECK:  GET https://<replit-public-url>/readyz → expect 200
3. AUTHENTICATE:    POST /api/dev-login with Bearer token
4. RETRY PROTOCOL:  On 502/503, wait and retry with exponential backoff
```

**Why this matters:** The Replit proxy takes time to become ready after app startup. Testing before the external readyz check passes will result in 502 errors and false test failures.

See `Core-Development-Principles/how-to-test.md` for complete implementation details.

### Atomic Test Cases

#### Step 1: Basic Details

| # | Test Case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| 1.1 | Navigate to create wizard | Logged in as admin | Click "Create Service" | Wizard opens on Step 1 |
| 1.2 | Name field required | On Step 1 | Try to proceed without name | Validation error shown |
| 1.3 | Name field accepts input | On Step 1 | Enter "Test Service" | Field displays input |
| 1.4 | Description is optional | On Step 1 | Leave description empty, enter name | Can proceed to Step 2 |
| 1.5 | Client type defaults to company | On Step 1 fresh | Check default | "Company Only" selected |
| 1.6 | Can change client type | On Step 1 | Select "Individual Only" | Selection updates |
| 1.7 | Navigation to Step 2 | Valid Step 1 data | Click Next | Moves to Step 2 |

#### Step 2: Service Settings

| # | Test Case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| 2.1 | Static service toggle | On Step 2 | Toggle static service ON | Toggle shows enabled |
| 2.2 | CH toggle shows fields | On Step 2 | Toggle CH ON | Date field selectors appear |
| 2.3 | CH validation | CH enabled, no dates | Try to proceed | Validation error |
| 2.4 | CH fields populate | CH enabled | Select both date fields | Fields populated |
| 2.5 | VAT toggle works | On Step 2 | Toggle VAT ON | Info message appears |
| 2.6 | Navigation forward | Valid Step 2 | Click Next | Moves to Step 3 |
| 2.7 | Navigation backward | On Step 2 | Click Previous | Returns to Step 1 |

#### Step 3: Work Roles

| # | Test Case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| 3.1 | Roles list displays | On Step 3 | View step | All work roles shown |
| 3.2 | Can select role | On Step 3 | Check a role | Role marked as selected |
| 3.3 | Can deselect role | Role selected | Uncheck role | Role unmarked |
| 3.4 | Multiple selection | On Step 3 | Select 3 roles | All 3 shown as selected |
| 3.5 | Count badge updates | Select roles | Check count | Badge shows correct count |

#### Step 4: Display Settings

| # | Test Case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| 4.1 | Services list displays | On Step 4 | View step | Other services shown |
| 4.2 | Can select indicator | On Step 4 | Check a service | Service marked |
| 4.3 | Selected count shows | Select 2 | Check display | "2 service(s)" shown |

#### Step 5: Custom Fields

| # | Test Case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| 5.1 | Field palette displays | On Step 5 | View step | Custom field types visible |
| 5.2 | System library collapsed | On Step 5 initial | Check library | Collapsed by default |
| 5.3 | System library expands | On Step 5 | Click to expand | System fields shown |
| 5.4 | Add custom field | On Step 5 | Click Short Text | Field added to canvas |
| 5.5 | Configure field | Field added | Click on field | Config modal opens |
| 5.6 | Set field name | In modal | Enter "Client Reference" | Name saved |
| 5.7 | Mark field required | In modal | Toggle required ON | Field shows required badge |
| 5.8 | Delete field | Field on canvas | Click delete | Field removed |
| 5.9 | Reorder fields | 2+ fields | Drag field 1 below 2 | Order changes |
| 5.10 | Add from system library | Library expanded | Click library field | Field added with pre-filled name |

#### End-to-End: Create Service

| # | Test Case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| E2E.1 | Full create flow | Admin logged in | Complete all steps + Save | Service appears in list |
| E2E.2 | Service has UDFs | E2E.1 complete | View service details | UDFs displayed |
| E2E.3 | Add service to client | Service with UDFs | Add service to client | UDF fields appear in modal |
| E2E.4 | Fill UDF values | E2E.3 in progress | Fill required fields | Service can be added |

#### Edit Mode

| # | Test Case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| Edit.1 | Open edit wizard | Service exists | Click Edit | Wizard opens with data |
| Edit.2 | Existing data loaded | Edit mode | Check Step 1 | Name/description populated |
| Edit.3 | Edit name | Edit mode Step 1 | Change name | Name updates |
| Edit.4 | Navigate to Step 5 | Edit mode | Click to Step 5 | Existing UDFs shown |
| Edit.5 | Add new UDF | Edit Step 5 | Add field | Field added to existing |
| Edit.6 | Save edits | Made changes | Click Save | Changes persisted |
| Edit.7 | Reload shows changes | E6 complete | Refresh, open edit | Changes visible |

### Negative Tests

| # | Test Case | Setup | Action | Expected |
|---|-----------|-------|--------|----------|
| N.1 | Duplicate name | Service "Test" exists | Create with same name | Error: name must be unique |
| N.2 | Empty name submit | Step 1 | Clear name, click Next | Validation error |
| N.3 | CH without dates | CH enabled | Leave dates empty, Next | Validation error |
| N.4 | Cancel discards | Made changes | Click Cancel | Changes not saved |
| N.5 | UDF empty name | Add field | Save with empty name | Validation error |

### Regression Tests

| # | Test Case | Description |
|---|-----------|-------------|
| R.1 | Existing services display | List page shows all existing services correctly |
| R.2 | Existing UDFs work | Services with UDFs can be edited |
| R.3 | Client service mapping | Adding service to client still shows UDF fields |
| R.4 | Work roles preserved | Editing service doesn't lose work role assignments |

## Implementation Phases

### Phase 1: Core Wizard Structure
1. Create ServiceWizard component shell
2. Implement step navigation logic
3. Create step indicator UI
4. Set up form state management

### Phase 2: Basic Steps (1-4)
1. Implement BasicDetailsStep
2. Implement ServiceSettingsStep
3. Implement WorkRolesStep
4. Implement DisplaySettingsStep
5. Wire up form data flow

### Phase 3: Custom Fields Step
1. Create field palette component
2. Implement drag-and-drop with @dnd-kit
3. Create field card component
4. Create field config modal
5. Integrate system field library

### Phase 4: Integration
1. Connect wizard to API (create/update)
2. Update list page to open wizard
3. Handle edit mode loading
4. Implement validation

### Phase 5: Testing & Polish
1. Execute all test cases
2. Fix identified issues
3. Final UI polish
4. Performance optimization

## Success Criteria

1. **Functional:** All existing service configuration functionality works in new wizard
2. **UX:** Users can intuitively create services without documentation
3. **Performance:** Wizard loads and navigates in <500ms
4. **Compatibility:** Existing services and client mappings continue to work
5. **Testing:** All atomic tests pass

## Dependencies

- @dnd-kit/core, @dnd-kit/sortable (already installed)
- Existing System Field Library API
- Existing Services API
- Existing Work Roles API
