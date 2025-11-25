# Stage 4: People Components Extraction

## Overview
**Risk Level:** Medium  
**Estimated Effort:** 4-5 hours  
**Estimated Line Reduction:** ~2,400 lines

This stage extracts all people-related components from `ClientDetailPage.tsx`. These components handle person viewing, editing, and creation with complex form validation, address lookup integration, and inter-component communication.

---

## Component Inventory

| Component | Lines | Start Line | Purpose |
|-----------|-------|------------|---------|
| `AddPersonModal` | ~1,087 | 2151 | Modal for adding new people with full form |
| `PersonTabbedView` | ~1,204 | 3239 | Tabbed interface for viewing/editing person |
| `PersonViewMode` | ~515 | 4446 | Read-only person details display |
| `PersonEditForm` | ~686 | 4964 | Full person edit form with validation |
| `RelatedPersonRow` | ~200 | 5653 | Table row for person in Related People section |

**Total: ~3,692 lines** (some overlap with shared code)

---

## Component Dependencies & Data Flow

### Hierarchy
```
ClientDetailPage
├── AddPersonModal (modal, controlled by isOpen prop)
│   └── Uses: useForm, zodResolver, insertPersonSchema
│
├── "Related People" Section (in Overview tab)
│   └── RelatedPersonRow[] (table rows)
│       └── Uses: PortalStatusColumn (already extracted)
│
└── PersonTabbedView (expandable person cards)
    ├── Tab: Basic Info
    │   ├── PersonViewMode (read-only)
    │   └── PersonEditForm (when editing)
    ├── Tab: Contact Info
    ├── Tab: Personal Services
    └── Tab: Related Companies
        └── Link to Company modal (embedded)
```

### Shared State (from parent ClientDetailPage)
| State Variable | Type | Used By |
|----------------|------|---------|
| `editingPersonId` | `string \| null` | PersonTabbedView, PersonViewMode, PersonEditForm |
| `setEditingPersonId` | `function` | PersonTabbedView, PersonViewMode |
| `revealedIdentifiers` | `Set<string>` | PersonViewMode (for NI/UTR masking) |
| `setRevealedIdentifiers` | `function` | PersonViewMode |
| `updatePersonMutation` | `UseMutationResult` | PersonTabbedView → PersonEditForm |
| `createPersonMutation` | `UseMutationResult` | AddPersonModal (via onSave callback) |

### Queries Used
| Query Key | Component | Purpose |
|-----------|-----------|---------|
| `/api/clients/${id}/people` | Parent (passed as props) | List of client's people |
| `/api/clients?type=company` | PersonTabbedView | Company list for linking |
| `/api/portal-user/by-person/${personId}` | RelatedPersonRow | Portal status |

### Mutations Used
| Mutation | Component | Endpoint |
|----------|-----------|----------|
| `createPersonMutation` | AddPersonModal (via callback) | POST `/api/clients/${id}/people` |
| `updatePersonMutation` | PersonEditForm (via callback) | PATCH `/api/people/${personId}` |
| `linkToCompanyMutation` | PersonTabbedView | POST `/api/clients/${clientId}/people` |
| `sendInviteMutation` | RelatedPersonRow | POST `/api/portal-user/send-invitation` |
| `generateQRMutation` | RelatedPersonRow | POST `/api/portal-user/generate-qr-code` |

---

## Extraction Plan

### File Structure
```
client/src/pages/client-detail/
├── components/
│   └── people/
│       ├── index.tsx                 # Re-exports
│       ├── AddPersonModal.tsx        # ~1,087 lines
│       ├── PersonTabbedView.tsx      # ~1,204 lines
│       ├── PersonViewMode.tsx        # ~515 lines
│       ├── PersonEditForm.tsx        # ~686 lines
│       └── RelatedPersonRow.tsx      # ~200 lines
└── utils/
    └── types.ts                      # Already has person types
```

### Extraction Order (dependency-safe)
1. **PersonEditForm** - Leaf component, no internal dependencies
2. **PersonViewMode** - Leaf component, no internal dependencies  
3. **RelatedPersonRow** - Leaf component, uses PortalStatusColumn (already extracted)
4. **PersonTabbedView** - Uses PersonViewMode, PersonEditForm
5. **AddPersonModal** - Standalone, uses form utilities

---

## Task Checklist

### Pre-Extraction
- [ ] Verify all types exist in `utils/types.ts`:
  - `ClientPersonWithPerson`
  - `InsertPersonData` / `insertPersonSchema`
  - `UpdatePersonData` / `updatePersonSchema`
  - `PeopleServiceWithRelations`
- [ ] Verify `formatPersonName`, `formatDate`, `formatBirthDate`, `maskIdentifier` in `utils/formatters.ts`

### Component Extraction
- [ ] **1. PersonEditForm.tsx**
  - Extract component (~686 lines)
  - Props: `clientPerson`, `onSave`, `onCancel`, `isSaving`
  - Imports: `useForm`, `zodResolver`, `updatePersonSchema`, `AddressLookup`
  - Test: Edit person form renders and validates

- [ ] **2. PersonViewMode.tsx**
  - Extract component (~515 lines)
  - Props: `clientPerson`, `revealedIdentifiers`, `setRevealedIdentifiers`, `onEdit`, `peopleServices`
  - Imports: `formatPersonName`, `formatBirthDate`, `maskIdentifier`
  - Test: View mode displays all fields correctly

- [ ] **3. RelatedPersonRow.tsx**
  - Extract component (~200 lines)
  - Props: `clientPerson`, `clientId`, `clientName`
  - Internal mutations for portal invites
  - Test: Row displays with portal actions

- [ ] **4. PersonTabbedView.tsx**
  - Extract component (~1,204 lines)
  - Props: `clientPerson`, `editingPersonId`, `setEditingPersonId`, `updatePersonMutation`, `revealedIdentifiers`, `setRevealedIdentifiers`, `peopleServices`, `clientId`
  - Uses: PersonViewMode, PersonEditForm
  - Contains: Link to Company modal (embedded)
  - Test: Tab switching, edit mode toggle

- [ ] **5. AddPersonModal.tsx**
  - Extract component (~1,087 lines)
  - Props: `clientId`, `isOpen`, `onClose`, `onSave`, `isSaving`
  - Uses: `useForm`, `insertPersonSchema`, `AddressLookup`
  - Test: Modal opens, form validates, submit works

### Post-Extraction
- [ ] Update imports in `ClientDetailPage.tsx`
- [ ] Remove inline component definitions
- [ ] Verify no TypeScript errors (should remain at 28)
- [ ] Verify application builds and runs

---

## Browser Tests Required

### Test 1: View Person Details
**Path:** Login → Clients → Select Client → Overview Tab → Expand Person Card

**Steps:**
1. Navigate to `/clients`
2. Click on a client with people (e.g., first client)
3. In Overview tab, find "Related People" section
4. Click "View" on a person row to expand
5. Verify person details display (name, DOB, email, phone)
6. Click between tabs (Basic Info, Contact Info, Personal Services, Related Companies)

**Expected Results:**
- Person card expands with tabbed view
- All tabs load without errors
- Data displays correctly in each tab
- Tab switching is smooth

**Test IDs to verify:**
- `person-row-{personId}` - Person row in table
- `text-person-name-{personId}` - Name display
- `button-view-person-{personId}` - View/expand button

---

### Test 2: Edit Person Details
**Path:** Login → Clients → Select Client → Expand Person → Edit Details

**Steps:**
1. Navigate to client detail page
2. Expand a person card
3. Click "Edit Details" button
4. Modify a field (e.g., change occupation)
5. Click "Save Changes"
6. Verify changes are saved

**Expected Results:**
- Edit form loads with current values
- Form validation works (required fields)
- Save button shows loading state
- Success toast appears
- View mode shows updated values

**Test IDs to verify:**
- `button-edit-person-{personId}` - Edit button
- `input-fullName-{personId}` - Name input field
- `input-occupation-{personId}` - Occupation field
- `button-save-person-{personId}` - Save button
- `button-cancel-edit-{personId}` - Cancel button

---

### Test 3: Add New Person
**Path:** Login → Clients → Select Client → Overview Tab → Add Person

**Steps:**
1. Navigate to client detail page
2. Find and click "Add Person" button
3. Fill in required fields:
   - Full Name: "Test Person {unique}"
   - Primary Email: "test{unique}@example.com"
4. Optionally fill other fields
5. Click "Add Person" button
6. Verify person appears in Related People list

**Expected Results:**
- Modal opens with empty form
- Form validation prevents empty submission
- Submit shows loading state
- Success toast appears
- Modal closes
- New person appears in list

**Test IDs to verify:**
- `button-add-person` - Add person button
- `dialog-add-person` - Modal dialog
- `input-add-fullName` - Full name input
- `input-add-primaryEmail` - Email input
- `button-submit-add-person` - Submit button

---

### Test 4: Portal Invite/QR Code (Related People Table)
**Path:** Login → Clients → Select Client → Related People Table

**Steps:**
1. Navigate to client detail page
2. Find Related People table in Overview
3. For a person with email, click "Send Invite" 
4. Verify invite is sent (toast)
5. Click "QR Code" button
6. Verify QR code modal appears

**Expected Results:**
- Send Invite button shows loading during send
- Success toast: "Invitation Sent"
- QR Code button generates and displays QR
- QR modal can be closed

**Test IDs to verify:**
- `button-send-invite-{personId}` - Send invite button
- `button-show-qr-{personId}` - QR code button
- QR code image displays in modal

---

### Test 5: Address Lookup Integration
**Path:** Edit Person → Address Section

**Steps:**
1. Open edit mode for a person
2. Find address section
3. Enter a UK postcode in address lookup
4. Select an address from suggestions
5. Verify address fields populate

**Expected Results:**
- Address lookup component renders
- Postcode search returns results
- Selecting address fills in:
  - Address Line 1
  - Locality
  - Region  
  - Postal Code
  - Country

---

### Test 6: Link Person to Company
**Path:** Person Card → Related Companies Tab → Link

**Steps:**
1. Expand a person card
2. Click "Related Companies" tab
3. Click "Link to Company" button
4. Search for or select a company
5. Click "Connect"
6. Verify person is linked

**Expected Results:**
- Link modal opens
- Company search works
- Connect button submits
- New company appears in Related Companies list

---

## Success Criteria

### Functional Requirements
- [ ] All 5 person-related components extracted to separate files
- [ ] PersonTabbedView displays all 4 tabs correctly
- [ ] PersonViewMode shows all person fields
- [ ] PersonEditForm validates and saves correctly
- [ ] AddPersonModal creates new people
- [ ] RelatedPersonRow displays with portal actions
- [ ] Address lookup integration works
- [ ] Link to Company functionality works

### Technical Requirements  
- [ ] No duplicate component definitions in main file
- [ ] All imports resolve correctly
- [ ] TypeScript errors remain at 28 (pre-existing)
- [ ] Application builds without errors
- [ ] No console errors during normal operation

### Performance
- [ ] Page load time unchanged or improved
- [ ] Tab switching is smooth
- [ ] Form operations don't cause freezing

---

## Risk Mitigation

### Medium Risk Areas
1. **State Lifting**: `editingPersonId` and `revealedIdentifiers` are shared across components
   - **Mitigation**: Pass as props, keep state management in parent

2. **Form Validation**: Complex Zod schemas with UK phone formatting
   - **Mitigation**: Keep phone formatting logic in handleSubmit

3. **Address Lookup**: Third-party integration
   - **Mitigation**: Import AddressLookup component, no changes needed

4. **Embedded Modals**: PersonTabbedView contains Link to Company modal
   - **Mitigation**: Keep modal embedded in PersonTabbedView initially

### Rollback Plan
If issues arise:
1. Git revert to pre-Stage-4 commit
2. Application continues working with Stage 3 state
3. Re-attempt with smaller extraction scope

---

## Estimated Timeline

| Task | Duration |
|------|----------|
| Pre-extraction verification | 15 min |
| Extract PersonEditForm | 30 min |
| Extract PersonViewMode | 30 min |
| Extract RelatedPersonRow | 20 min |
| Extract PersonTabbedView | 45 min |
| Extract AddPersonModal | 45 min |
| Update imports & cleanup | 20 min |
| Browser testing | 45 min |
| Bug fixes (if any) | 30 min |
| **Total** | **~4.5 hours** |

---

## Post-Stage 4 State

**Expected Line Count:** ~6,200 lines (down from 8,603)  
**Reduction:** ~2,400 lines (~28% of remaining)  
**Cumulative Reduction:** ~3,150 lines from original 9,347 (~34%)
