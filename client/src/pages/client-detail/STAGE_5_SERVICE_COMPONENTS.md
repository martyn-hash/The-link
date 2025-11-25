# Stage 5: Service Components Extraction

## Overview
**Risk Level:** Medium  
**Estimated Effort:** 4-5 hours  
**Estimated Line Reduction:** ~1,335 lines  
**Current File Size:** 5,575 lines  
**Target File Size:** ~4,240 lines

This stage extracts all service-related components from `ClientDetailPage.tsx`. These components handle service assignment, editing, UDF (User Defined Fields) management, and service display with complex form validation, Companies House integration, and role assignment logic.

---

## Component Inventory

| Component | Lines | Start Line | End Line | Purpose |
|-----------|-------|------------|----------|---------|
| `AddServiceModal` | ~720 | 1436 | 2155 | Modal for assigning services to clients |
| `EditableServiceDetails` | ~207 | 2157 | 2363 | Inline UDF field editing for services |
| `EditServiceModal` | ~318 | 2366 | 2683 | Modal for editing service properties |
| `ClientServiceRow` | ~90 | 2815 | 2904 | Table row for displaying client services |

**Total: ~1,335 lines**

**Note:** `CompanyCreationForm` (lines 2684-2812, ~129 lines) is NOT included in this stage as it belongs to the People domain (used for linking a person to a company). It will be addressed in a future stage.

---

## Component Dependencies & Data Flow

### Hierarchy
```
ClientDetailPage
├── Services Tab
│   ├── AddServiceModal (header action button)
│   │   └── Uses: useForm, zodResolver, addServiceSchema
│   │   └── Features: Service selection, role assignments, 
│   │       Companies House auto-population, personal service support
│   │
│   ├── Client Services Section
│   │   ├── Mobile: Service cards (inline)
│   │   └── Desktop: Table with ClientServiceRow[]
│   │       └── Uses: formatDate, useLocation
│   │
│   ├── Personal Services Section (expandable accordion)
│   │   └── EditableServiceDetails (for UDF editing)
│   │       └── Uses: useMutation, apiRequest
│   │
│   └── Edit Service Modal (footer, when editing)
│       └── EditServiceModal
│           └── Uses: useForm, zodResolver, editServiceSchema
│
└── State Variables (from parent)
    ├── editingServiceId / setEditingServiceId
    ├── editingPersonalServiceId / setEditingPersonalServiceId
    ├── expandedClientServiceId / setExpandedClientServiceId
    └── expandedPersonalServiceId / setExpandedPersonalServiceId
```

### Shared State (from parent ClientDetailPage)
| State Variable | Type | Used By | Purpose |
|----------------|------|---------|---------|
| `editingServiceId` | `string \| null` | EditServiceModal | Controls which service is being edited |
| `setEditingServiceId` | `function` | ClientServiceRow (future), Services tab | Opens edit modal |
| `editingPersonalServiceId` | `string \| null` | EditServiceModal | Controls personal service editing |
| `setEditingPersonalServiceId` | `function` | Personal services accordion | Opens edit modal for personal services |
| `expandedClientServiceId` | `string \| null` | Services accordion | Which service card is expanded |
| `expandedPersonalServiceId` | `string \| null` | Personal services accordion | Which personal service is expanded |

### Queries Used
| Query Key | Component | Purpose |
|-----------|-----------|---------|
| `/api/services/client-assignable` | AddServiceModal | Available services for assignment |
| `/api/services` | AddServiceModal (individual) | All services (filtered to personal) |
| `/api/clients/${clientId}/people` | AddServiceModal | People for personal service assignment |
| `/api/users` | AddServiceModal, EditServiceModal | Staff for role assignments |
| `/api/work-roles` | EditServiceModal | Work roles for assignments |
| `/api/clients/${clientId}` | AddServiceModal | Client data for CH auto-population |
| `/api/client-services/client/${clientId}` | Parent (passed as props) | Existing client services |
| `/api/people-services/client/${clientId}` | Parent (passed as props) | Personal services |

### Mutations Used
| Mutation | Component | Endpoint | Purpose |
|----------|-----------|----------|---------|
| `createClientServiceMutation` | AddServiceModal | POST `/api/client-services` | Create new client service |
| `createPeopleServiceMutation` | AddServiceModal | POST `/api/people-services` | Create personal service |
| `updateServiceMutation` | EditableServiceDetails | PUT `/api/client-services/${id}` | Update UDF values |
| `updateServiceMutation` | EditServiceModal | PUT `/api/client-services/${id}` or `/api/people-services/${id}` | Update service properties |

---

## Types Required in utils/types.ts

### Existing Types (already in types.ts)
- `EnhancedClientService` - Extended service with relations
- `ClientServiceWithService` - Basic service relation
- `ServiceWithDetails` - Service definition with UDFs
- `AddServiceData` - Form data for adding service
- `EditServiceData` - Form data for editing service
- `addServiceSchema` - Zod schema for add form
- `editServiceSchema` - Zod schema for edit form
- `AddServiceModalProps` - Props interface

### Types to Verify
```typescript
// Verify these exist or add them
export interface ClientServiceRowProps {
  clientService: EnhancedClientService;
}

export interface EditableServiceDetailsProps {
  clientService: EnhancedClientService;
  onUpdate: () => void;
}

export interface EditServiceModalProps {
  service: EnhancedClientService;
  isOpen: boolean;
  onClose: () => void;
}
```

---

## Extraction Plan

### File Structure
```
client/src/pages/client-detail/
├── components/
│   └── services/
│       ├── index.tsx                  # Re-exports
│       ├── AddServiceModal.tsx        # ~720 lines
│       ├── EditServiceModal.tsx       # ~318 lines
│       ├── EditableServiceDetails.tsx # ~207 lines
│       └── ClientServiceRow.tsx       # ~90 lines
└── utils/
    └── types.ts                       # Already has service types
```

### Extraction Order (dependency-safe)
1. **ClientServiceRow** - Leaf component, simplest
2. **EditableServiceDetails** - Leaf component, self-contained mutation
3. **EditServiceModal** - Uses shared types and schemas
4. **AddServiceModal** - Complex, uses most dependencies

---

## Task Checklist

### Pre-Extraction
- [ ] Verify all types exist in `utils/types.ts`:
  - `EnhancedClientService`
  - `ServiceWithDetails`
  - `AddServiceData` / `addServiceSchema`
  - `EditServiceData` / `editServiceSchema`
  - `AddServiceModalProps`
- [ ] Verify `formatDate` in `utils/formatters.ts`
- [ ] Verify shared schema imports work

### Component Extraction

#### 1. ClientServiceRow.tsx (~90 lines)
**Location:** Lines 2815-2904
**Dependencies:**
- `useLocation` from wouter
- `formatDate` from utils/formatters
- `EnhancedClientService` from utils/types
- UI: `TableRow`, `TableCell`, `Badge`, `Button`
- Icons: `Eye`

**Props Interface:**
```typescript
interface ClientServiceRowProps {
  clientService: EnhancedClientService;
}
```

**Key Features:**
- Displays service name with badges (Static, Personal, CH)
- Shows frequency, start date, due date, owner
- View button navigates to `/client-service/${id}`

**Test:** Row displays correctly with all data and View button works

---

#### 2. EditableServiceDetails.tsx (~207 lines)
**Location:** Lines 2157-2363
**Dependencies:**
- `useState` from react
- `useMutation` from tanstack/react-query
- `useToast` from hooks/use-toast
- `apiRequest`, `queryClient` from lib/queryClient
- `EnhancedClientService` from utils/types
- UI: `Button`, `Input`, `Checkbox`, `Select`
- Icons: `FileText`, `Edit2`, `Save`, `X`

**Props Interface:**
```typescript
interface EditableServiceDetailsProps {
  clientService: EnhancedClientService;
  onUpdate: () => void;
}
```

**Key Features:**
- Displays UDF fields based on service definition
- Toggle between view/edit mode
- Date value formatting for HTML inputs
- Inline save/cancel with mutation

**Test:** UDF fields display and save correctly

---

#### 3. EditServiceModal.tsx (~318 lines)
**Location:** Lines 2366-2683
**Dependencies:**
- `useForm` from react-hook-form
- `zodResolver` from @hookform/resolvers/zod
- `useMutation`, `useQuery` from tanstack/react-query
- `editServiceSchema`, `EditServiceData` from utils/types
- `EnhancedClientService` from utils/types
- UI: `Dialog`, `Form`, `Select`, `Button`, `Switch`, `Input`
- Icons: Various

**Props Interface:**
```typescript
interface EditServiceModalProps {
  service: EnhancedClientService;
  isOpen: boolean;
  onClose: () => void;
}
```

**Key Features:**
- Form with frequency, dates, owner, active status
- Detects Companies House services (locks frequency to annual)
- Detects people services (uses different API endpoint)
- Role assignments section
- Handles both client services and people services

**Test:** Edit modal opens, validates, and saves changes

---

#### 4. AddServiceModal.tsx (~720 lines)
**Location:** Lines 1436-2155
**Dependencies:**
- `useState` from react
- `useForm` from react-hook-form
- `zodResolver` from @hookform/resolvers/zod
- `useMutation`, `useQuery` from tanstack/react-query
- `addServiceSchema`, `AddServiceData` from utils/types
- `ServiceWithDetails`, `ClientPersonWithPerson` from utils/types
- UI: `Dialog`, `Form`, `Select`, `Button`, `Input`, `Badge`
- Icons: `Plus`, `AlertCircle`, `Info`

**Props Interface (already exists):**
```typescript
interface AddServiceModalProps {
  clientId: string;
  clientType?: 'company' | 'individual';
  onSuccess?: () => void;
}
```

**Key Features:**
- Service selection with filtering by client type
- Companies House auto-population of dates
- Personal service person selection
- Role assignment with visual state indicators
- Field state helpers (required-empty, required-filled, error)
- Separate mutations for client services vs people services

**Complex Logic:**
1. `getFieldState()` - Visual indicator for form field validation state
2. `getRoleFieldState()` - Visual indicator for role assignment state
3. `getPersonFieldState()` - Visual indicator for person selection
4. `handleServiceChange()` - Auto-populates dates from Companies House
5. `canSubmit()` - Validates all required fields before allowing submit

**Test:** Modal opens, service selection works, form validates and submits

---

### Post-Extraction
- [ ] Create `components/services/index.tsx` with re-exports
- [ ] Update imports in `ClientDetailPage.tsx`
- [ ] Remove inline component definitions (lines 1436-2904)
- [ ] Verify no TypeScript errors
- [ ] Verify application builds and runs
- [ ] Test all service functionality in browser

---

## Browser Tests Required

### Test 1: View Services Tab
**Path:** Login → Clients → Select Client → Services Tab

**Steps:**
1. Navigate to `/clients`
2. Click on a client
3. Click "Services" tab
4. Verify services display (if any)

**Expected Results:**
- Services tab loads without errors
- Active services section displays correctly
- Inactive services section displays if applicable
- Service badges show correctly (Static, Personal, CH)

**Test IDs to verify:**
- `tab-services` - Services tab
- `section-client-services` - Services section
- `service-row-{id}` or `service-card-{id}` - Individual services
- `text-service-name-{id}` - Service name display

---

### Test 2: Add Service Modal
**Path:** Services Tab → Click "Add Service" button

**Steps:**
1. Navigate to a client's Services tab
2. Click "Add Service" button (or similar)
3. Verify modal opens
4. Select a service from dropdown
5. Verify form fields appear based on service type
6. For Companies House services, verify dates auto-populate
7. For personal services, verify person selection appears
8. Fill required fields
9. Click Add/Submit

**Expected Results:**
- Modal opens with service selection
- Form fields dynamically update based on service
- Required field indicators work
- Submit creates service and closes modal

**Test IDs to verify:**
- `button-add-service` - Add service trigger
- `select-service` - Service dropdown
- `input-start-date`, `input-due-date` - Date fields
- `select-service-owner` - Owner dropdown
- `button-save-service` - Submit button
- `button-cancel-add-service` - Cancel button

---

### Test 3: View Service Details
**Path:** Services Tab → Click "View" on a service

**Steps:**
1. Navigate to Services tab
2. Click "View" button on any service row
3. Verify navigation to service detail page

**Expected Results:**
- Navigates to `/client-service/{serviceId}`
- Service detail page loads

**Test IDs to verify:**
- `button-view-service-{id}` - View button on row

---

### Test 4: Edit Service (via Edit Modal)
**Path:** This test requires finding where edit is triggered

**Note:** The EditServiceModal is controlled by `editingServiceId` state, but the trigger mechanism needs to be verified in the Services tab or service detail page.

**Steps:**
1. Find how to trigger edit mode for a service
2. Verify modal opens with current values pre-filled
3. Modify a field (e.g., frequency, owner, dates)
4. Click Save
5. Verify changes are saved

**Expected Results:**
- Edit modal opens with correct data
- Changes can be made
- Save updates the service

**Test IDs to verify:**
- `button-cancel-edit` - Cancel button
- `button-save-service` - Save button

---

### Test 5: Edit Service Details (UDF)
**Path:** Services Tab → Expand service → Edit Details

**Steps:**
1. Navigate to Services tab
2. Find a service with UDF definitions
3. Click Edit on the details section
4. Modify a UDF field value
5. Click Save

**Expected Results:**
- UDF fields display in view mode
- Edit button enables editing
- Save updates the UDF values

**Test IDs to verify:**
- `input-service-detail-{fieldId}` - UDF input fields
- `button-edit-service-details` - Edit toggle
- `button-save-service-details` - Save button
- `button-cancel-service-details` - Cancel button

---

## Detailed Component Analysis

### AddServiceModal - Complex Logic Breakdown

#### State Management
```typescript
const [isOpen, setIsOpen] = useState(false);                    // Modal visibility
const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);  // Selected service
const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});       // Role→User mapping
const [selectedPersonId, setSelectedPersonId] = useState<string>("");  // For personal services
```

#### Visual Field State System
The component uses a visual indicator system for form fields:
- `required-empty` - Required field with no value (red indicator)
- `required-filled` - Required field with value (green indicator)
- `optional` - Optional field (neutral)
- `error` - Field has validation error

Helper functions:
- `getFieldState(fieldName, isRequired)` → Returns visual state
- `getRoleFieldState(roleId)` → Returns role assignment state
- `getPersonFieldState()` → Returns person selection state

#### Companies House Integration
When a Companies House connected service is selected:
1. Force frequency to 'annually'
2. Auto-populate `nextStartDate` from `client[service.chStartDateField]`
3. Auto-populate `nextDueDate` from `client[service.chDueDateField]`

#### Personal Service Detection
When `isPersonalService` is true:
1. Show person selection dropdown
2. Use `/api/people-services` endpoint instead of `/api/client-services`
3. Require person selection before submit

---

### EditServiceModal - Dual Endpoint Logic

The modal detects service type and calls appropriate endpoint:
```typescript
const isPeopleService = 'personId' in service;

// In mutation:
if (isPeopleService) {
  await apiRequest("PUT", `/api/people-services/${data.serviceId}`, serviceUpdateData);
} else {
  await apiRequest("PUT", `/api/client-services/${data.serviceId}`, serviceUpdateData);
}
```

Also invalidates appropriate cache:
- People services: `['/api/people-services/client/${clientId}']`
- Client services: `['/api/client-services/client/${clientId}']`

---

## Risk Areas & Mitigation

### 1. Companies House Auto-Population
**Risk:** Date field auto-population relies on client data with specific field names
**Mitigation:** Test with a client that has Companies House data; verify fallback when fields are missing

### 2. Dual Service Types (Client vs People)
**Risk:** Logic branches for client services vs people services throughout
**Mitigation:** Test both paths explicitly; ensure cache invalidation works for both

### 3. Role Assignments
**Risk:** Complex mapping between work roles and users
**Mitigation:** Verify role assignment display and editing in EditServiceModal

### 4. UDF Value Formatting
**Risk:** Date values need conversion between ISO format and HTML date input format
**Mitigation:** Test date UDF fields specifically; verify round-trip (display→edit→save)

---

## Success Criteria

- [x] All 4 components extracted to `components/services/`
- [x] AddServiceModal creates services correctly
- [x] EditServiceModal edits both client and personal services
- [x] EditableServiceDetails saves UDF changes
- [x] ClientServiceRow displays correctly and View works
- [x] Companies House auto-population works
- [x] Personal service assignment works
- [x] No duplicate definitions in main file
- [x] Application builds and runs without errors
- [x] All browser tests pass

---

## Completion Status

**Status:** ✅ COMPLETED  
**Completed Date:** November 25, 2025  
**Actual Line Reduction:** 1,336 lines (5,575 → 4,239)  
**Files Created:**
- `components/services/AddServiceModal.tsx` (762 lines)
- `components/services/EditServiceModal.tsx` (348 lines)
- `components/services/EditableServiceDetails.tsx` (219 lines)
- `components/services/ClientServiceRow.tsx` (98 lines)
- `components/services/index.tsx` (4 lines)

**Total Service Components:** 1,431 lines

**Notes:**
- CompanyCreationForm (129 lines) remains in main file as it belongs to People domain
- All components properly import shared types from utils/types.ts
- Application builds without LSP errors
