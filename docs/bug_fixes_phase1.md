# Bug Fixes - Phase 1

## Overview
This document tracks bug fixes identified before proceeding with Phase 2 (Field Type Parity Expansion) and Phase 3 (Extend Pattern to Other Form Contexts).

## Bugs to Fix

### Bug 1: Cannot Save Stage Approvals (CRITICAL)
**Status:** FIXED
**Location:** ApprovalWizard, both in project type settings and client detail page custom approvals
**Error:** "Failed to create stage approval field"
**Impact:** Users cannot save any approval forms

**Root Cause Analysis (Updated):**
The error was actually a FOREIGN KEY constraint violation, NOT the CHECK constraint:
1. `stage_approval_fields.library_field_id` has a FK constraint to `approval_field_library.id`
2. When adding fields from the System Field Library, the code was setting `libraryFieldId` to the system field ID
3. This caused FK violation because system field IDs are not in `approval_field_library`

**Fixes Applied:**
1. **Frontend (ApprovalWizard.tsx):** Changed `handleAddFieldFromSystemLibrary` to set `libraryFieldId: null` instead of `systemField.id`
2. **Backend (config.ts):** Added validation in POST and PATCH handlers to check if `libraryFieldId` exists in `approval_field_library`, and clear it if not
3. **Validation:** Added frontend validation in StageApprovalsTab and ApprovalOverridesTab to prevent saving select fields without options (prevents CHECK constraint violations)

**Future Enhancement:**
To properly track system field lineage, add `systemFieldLibraryId` column to `approval_field_library` table.

### Bug 2: Project Type List Not Filtered for Client Task Overrides
**Status:** To Fix
**Location:** Client detail page > Client Project Task Overrides dialog
**Issue:** When creating a custom client project task override, the project type dropdown shows ALL project types instead of only the active services the client currently receives
**Expected:** Filter to show only project types where client has active services

### Bug 3: Missing Drag-and-Drop for System Library Fields
**Status:** To Fix
**Location:** ApprovalWizard and ClientTasksTab left panels
**Issue:** System library fields can only be clicked to add, not dragged like custom field types
**Expected:** System library fields should support drag-and-drop to the canvas, matching the custom fields UX

### Bug 4: Incomplete System Library Fields List
**Status:** To Fix (depends on Field Type Parity)
**Location:** System Library section in form builders
**Issue:** Some field types don't appear in the system library because the ALLOWED_SYSTEM_FIELD_TYPES filter excludes them
**Expected:** After field type parity expansion, all field types should be supported

### Bug 5: Custom Client Project Task Needs "Start Fresh" Option
**Status:** To Fix
**Location:** Client detail page > Create Task Template Override dialog
**Issue:** User must select an existing template to proceed; there's no way to create a completely custom task template from scratch
**Expected:** Add option to start with a blank template instead of requiring template selection

---

## Future Phases (After Bug Fixes)

### Phase 2: Field Type Parity Expansion
Expand from 8 field types to 15+ types across all contexts:
- URL, Phone, Currency, Percentage
- Image Upload, Rating, Signature
- Other specialized types

### Phase 3: Extend Inline System Library to Other Form Contexts
Apply the inline system library pattern to other form builder contexts beyond ApprovalWizard and ClientTasksTab.

---

## Progress Log
- 2024-12-19: Bug list documented
