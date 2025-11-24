# Stage 5 Action Prompt - Projects Configuration Extraction

## ⚠️ CRITICAL TESTING REMINDERS - READ BEFORE EVERY BROWSER TEST

### Authentication Credentials
- **Login Page:** Navigate to root page `/`
- **Tab:** Click "Password" tab
- **Email:** `admin@example.com`
- **Password:** `admin123`

### Known Browser Bug - Projects Page
**SYMPTOM:** Projects page sometimes shows "0 tasks" or doesn't load properly even when projects exist in database.

**WORKAROUND:**
1. Refresh the browser (F5 or Cmd+R)
2. Restart the test from the beginning
3. If issue persists after 2 refreshes, check server logs for errors

**ROOT CAUSE:** Pre-existing race condition in projects page rendering (unrelated to refactoring work)

---

## Stage 5 Overview

**Objective:** Extract project configuration domain (project types, kanban stages, change reasons, approvals) from monolithic storage.ts into 3 focused storage modules.

**Risk Level:** HIGH (configuration affects core project workflows)

**Estimated Time:** 6-8 hours

**Complexity:** High - many cross-dependencies with ProjectStorage helpers currently in use

---

## Files to Create

### 1. `server/storage/projects/projectTypesStorage.ts`
**Methods to Extract (9 total):**
- `getAllProjectTypes()`
- `getProjectTypeById(id)`
- `createProjectType(projectType)`
- `updateProjectType(id, projectType)`
- `deleteProjectType(id)`
- `getProjectTypeByName(name)` ← Currently used as helper in ProjectStorage
- `countActiveProjectsUsingProjectType(projectTypeId)`
- `getProjectTypeDependencySummary(projectTypeId)`
- `forceDeleteProjectType(projectTypeId, confirmName)`

**Helper Exports Required:**
```typescript
// These must be exported for helper injection
export const projectTypesHelpers = {
  getProjectTypeByName: (name: string) => Promise<ProjectType | undefined>
};
```

### 2. `server/storage/projects/projectStagesStorage.ts`
**Methods to Extract (28 total):**

**Kanban Stages (6):**
- `getAllKanbanStages()`
- `getKanbanStagesByProjectTypeId(projectTypeId)`
- `getKanbanStagesByServiceId(serviceId)`
- `createKanbanStage(stage)`
- `updateKanbanStage(id, stage)`
- `deleteKanbanStage(id)`

**Stage Validation (7):**
- `isStageNameInUse(stageName)`
- `getStageById(id)`
- `validateStageCanBeDeleted(id)`
- `validateStageCanBeRenamed(id, newName)`
- `validateProjectStatus(status)`
- `getDefaultStage()`

**Change Reasons (5):**
- `getAllChangeReasons()`
- `getChangeReasonsByProjectTypeId(projectTypeId)`
- `createChangeReason(reason)`
- `updateChangeReason(id, reason)`
- `deleteChangeReason(id)`

**Stage-Reason Mappings (6):**
- `getAllStageReasonMaps()`
- `createStageReasonMap(mapping)`
- `getStageReasonMapsByStageId(stageId)`
- `deleteStageReasonMap(id)`
- `validateStageReasonMapping(stageId, reasonId)` ← Currently used as helper in ProjectStorage
- `getValidChangeReasonsForStage(stageId)`

**Custom Fields (6):**
- `getAllReasonCustomFields()`
- `getReasonCustomFieldsByReasonId(reasonId)`
- `createReasonCustomField(field)`
- `updateReasonCustomField(id, field)`
- `deleteReasonCustomField(id)`
- `validateRequiredFields(reasonId, fieldResponses)` ← Currently used as helper in ProjectStorage

**Field Responses (2):**
- `createReasonFieldResponse(response)`
- `getReasonFieldResponsesByChronologyId(chronologyId)`

**Helper Exports Required:**
```typescript
// These must be exported for helper injection
export const projectStagesHelpers = {
  validateStageReasonMapping: (stageId: string, reasonId: string | null) => Promise<void>,
  validateRequiredFields: (reasonId: string, fieldResponses: any) => Promise<void>
};
```

### 3. `server/storage/projects/projectApprovalsStorage.ts`
**Methods to Extract (14 total):**

**Stage Approvals (6):**
- `getAllStageApprovals()`
- `getStageApprovalsByProjectTypeId(projectTypeId)`
- `createStageApproval(approval)`
- `updateStageApproval(id, approval)`
- `deleteStageApproval(id)`
- `getStageApprovalById(id)`

**Approval Fields (5):**
- `getAllStageApprovalFields()`
- `getStageApprovalFieldsByApprovalId(approvalId)`
- `createStageApprovalField(field)`
- `updateStageApprovalField(id, field)`
- `deleteStageApprovalField(id)`

**Approval Responses (3):**
- `createStageApprovalResponse(response)`
- `upsertStageApprovalResponse(response)`
- `getStageApprovalResponsesByProjectId(projectId)`
- `validateStageApprovalResponses(approvalId, responses)`

---

## Critical Dependencies

### Current Helper Usage in ProjectStorage
ProjectStorage currently uses these helpers that will be extracted in Stage 5:

```typescript
// From projectTypesStorage (Stage 5)
this.getProjectTypeByName

// From projectStagesStorage (Stage 5)
this.validateStageReasonMapping
this.validateRequiredFields
```

### Migration Strategy
1. Extract methods into new storage classes
2. Export helper functions from each storage module
3. Update facade to instantiate new storage classes
4. Update facade helper registration to use new modules
5. ProjectStorage continues to use helpers through injection (no changes needed)

---

## Execution Plan

### Task 1: Create ProjectTypesStorage
1. Create `server/storage/projects/projectTypesStorage.ts`
2. Extract all 9 project type methods
3. Export helper functions for cross-domain use
4. Add imports: db, schema types, drizzle-orm operators

### Task 2: Create ProjectStagesStorage
1. Create `server/storage/projects/projectStagesStorage.ts`
2. Extract all 28 stage/reason/field methods
3. Export helper functions (validateStageReasonMapping, validateRequiredFields)
4. Handle complex validation logic carefully

### Task 3: Create ProjectApprovalsStorage
1. Create `server/storage/projects/projectApprovalsStorage.ts`
2. Extract all 14 approval methods
3. Maintain approval validation logic

### Task 4: Update Facade
1. Import new storage classes in `server/storage/index.ts`
2. Instantiate in DatabaseStorage constructor
3. Delegate all 51 methods to new classes
4. Update helper registration to use new module exports

### Task 5: Update Index Exports
1. Update `server/storage/projects/index.ts`
2. Export all new storage classes
3. Export helper functions

### Task 6: Verification
1. Check LSP diagnostics for TypeScript errors
2. Verify workflow restarts successfully
3. Check server logs for clean boot
4. Run architecture review

### Task 7: Testing
1. **REMEMBER:** Check testing credentials and browser bug workaround above
2. Create E2E test plan for project configuration CRUD
3. Test project type creation/update/deletion
4. Test kanban stage configuration
5. Test change reason workflows
6. Verify no regressions in existing project operations

---

## Success Criteria

✅ All 51 configuration methods extracted into 3 storage modules
✅ Helper functions exported and registered correctly
✅ Facade delegates all methods to new classes
✅ No TypeScript errors (LSP clean)
✅ Server starts successfully
✅ All E2E tests pass
✅ Architect approval received
✅ No regressions in existing functionality

---

## Risk Mitigation

### High-Risk Areas
1. **Validation Logic:** Stage reason mapping and required fields validation are complex
2. **Helper Dependencies:** ProjectStorage depends on configuration helpers
3. **Cross-Domain Calls:** Approvals may call other domains

### Mitigation Steps
1. Extract validation logic verbatim (no changes)
2. Test helper injection thoroughly
3. Verify all cross-domain calls work through facade
4. Test rollback plan (facade can delegate back to oldStorage if needed)

---

## Testing Checklist

Before running ANY browser test, verify:
- [ ] I have read the testing credentials section above
- [ ] I know the workaround for the projects page bug
- [ ] I have the login credentials ready (admin@example.com / admin123)
- [ ] I am prepared to refresh browser if projects don't load

During testing:
- [ ] Login via root page → Password tab
- [ ] Use correct credentials
- [ ] If projects page shows "0 tasks", refresh and restart
- [ ] Check server logs if issues persist

After testing:
- [ ] Document any new bugs discovered
- [ ] Note any required workarounds
- [ ] Update testing notes if needed

---

## Architectural Guidance from Review

**Key Insights:**
- Stage 4 Part 2 is stable - no blocking technical debt
- Helper calls map directly to Stage 5 extraction targets
- Migration will eliminate temporary façade reliance
- Use focused storage modules with explicit helper registries
- Avoid circular imports by keeping helpers injectable
- Preserve ProjectStorage helper contracts (no breaking changes)

**Approach:**
1. Three focused storage modules (types, stages/reasons, approvals)
2. Each exposes explicit helper registry
3. ProjectStorage rebinds without circular imports
4. Shared validation helpers remain injectable

---

## Post-Completion Actions

After Stage 5 completion:
1. Update `refactor_storage.md` with Stage 5 completion status
2. Run architect review
3. Document lessons learned
4. Update progress tracking
5. Prepare for Stage 6 (Services domain)

---

## Emergency Rollback Plan

If critical issues arise:
1. Facade can delegate methods back to `oldStorage`
2. Comment out new storage instantiation
3. Restore old delegation temporarily
4. Debug and fix issues
5. Re-enable new storage delegation

---

## Notes Section

Use this space to track issues, decisions, and learnings during Stage 5 execution:

- 
- 
- 

---

**Remember: Read the testing reminders at the top BEFORE every browser test session!**
