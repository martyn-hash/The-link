# Refactoring Plan: server/routes/projects.ts

## Overview

**File:** `server/routes/projects.ts`  
**Current Size:** 3,114 lines  
**Priority:** #2 (Second in refactoring order)  
**Risk Level:** HIGH - Contains critical project management functionality  
**Estimated Effort:** Large (4-6 days)

---

## Browser Testing Login Details

For all verification steps, use these credentials:

- **URL:** Root page (`/`)
- **Tab:** "Passwords" tab
- **Email:** `jamsplan1@gmail.com`
- **Password:** `admin123`

---

## Problem Statement

`projects.ts` has become a monolithic file containing 17+ distinct functional domains. It handles everything from basic project CRUD to scheduling, notifications, bulk operations, and dashboard metrics. The file violates single responsibility principle and makes maintenance, debugging, and agent navigation extremely difficult.

### Issues:
1. **Duplicate schemas** - `paramUuidSchema` and `validateParams` are redefined (already in `routeHelpers.ts`)
2. **Helper function** - `htmlToPlainText` should be extracted to a shared utility
3. **Mixed concerns** - Dashboard, scheduling, notifications all in one file
4. **Difficult testing** - Changes to one domain risk breaking unrelated functionality

---

## Scope Definition

### In Scope
- Splitting `projects.ts` into domain-specific route files
- Removing duplicate validation schemas (use `routeHelpers.ts` instead)
- Extracting `htmlToPlainText` to shared utility
- Creating new domain-organized route files
- Updating `routes.ts` registration to use new modules
- Ensuring all existing functionality continues to work

### Out of Scope
- Changing route paths/URLs (no breaking API changes)
- Modifying business logic within routes
- Refactoring storage layer calls
- Frontend changes
- Adding new features

---

## Success Criteria

1. **Functional Parity:** All existing API endpoints work identically after refactoring
2. **File Size Reduction:** `projects.ts` eliminated or reduced to <100 lines (index only)
3. **Domain Separation:** Each new file has a single, clear domain responsibility
4. **No Duplicate Code:** Validation schemas imported from `routeHelpers.ts`
5. **Consistent Patterns:** All new files follow the same structure pattern
6. **Tests Pass:** If any existing tests exist, they must continue to pass
7. **No Regressions:** Application runs without errors after each stage

---

## Current Domain Analysis

The file contains these distinct domains (with line ranges and routes):

| Domain | Line Range | Routes | Lines | New File Location |
|--------|------------|--------|-------|-------------------|
| Project Views | 81-188 | 4 | ~110 | `projects/views.ts` |
| User Project Preferences | 194-227 | 2 | ~35 | `projects/preferences.ts` |
| Service Due Dates | 234-247 | 1 | ~15 | `projects/core.ts` |
| Projects Core CRUD | 250-390 | 5 | ~140 | `projects/core.ts` |
| Stage Change Config | 394-475 | 1 | ~80 | `projects/status.ts` |
| Status Updates | 477-800 | 1 | ~325 | `projects/status.ts` |
| Bulk Operations | 803-1071 | 2 | ~270 | `projects/bulk.ts` |
| Stage Attachments | 1074-1155 | 2 | ~80 | `projects/attachments.ts` |
| Stage Notifications | 1158-1663 | 3 | ~510 | `projects/notifications.ts` |
| Project Updates | 1665-1865 | 2 | ~200 | `projects/core.ts` |
| Bench Operations | 1871-2014 | 2 | ~145 | `projects/bench.ts` |
| CSV Upload | 2016-2102 | 1 | ~90 | `projects/csv-upload.ts` |
| Stage Approvals | 2104-2192 | 2 | ~90 | `projects/approvals.ts` |
| Assignees/Roles | 2195-2428 | 3 | ~235 | `projects/assignees.ts` |
| Scheduled Services | 2434-2442 | 1 | ~10 | `projects/scheduling.ts` |
| Project Scheduling | 2448-2773 | 8 | ~330 | `projects/scheduling.ts` |
| Batch Due Dates | 2780-2907 | 2 | ~130 | `projects/batch-updates.ts` |
| Dashboard Metrics | 2914-3042 | 3 | ~130 | `projects/dashboard.ts` |
| Dashboard Cache | 3049-3113 | 2 | ~65 | `projects/dashboard.ts` |

---

## Target File Structure

```
server/routes/projects/
├── index.ts              # Re-exports and registers all project routes (~50 lines)
├── core.ts               # Projects CRUD, get, update, complete (~355 lines)
├── views.ts              # Project views CRUD (~110 lines)
├── preferences.ts        # User project preferences (~35 lines)
├── status.ts             # Status updates, stage change config (~405 lines)
├── bulk.ts               # Bulk move eligibility, bulk status (~270 lines)
├── attachments.ts        # Stage change attachments upload/download (~80 lines)
├── notifications.ts      # Stage change notifications, client value (~510 lines)
├── bench.ts              # Bench/unbench operations (~145 lines)
├── csv-upload.ts         # CSV project upload (~90 lines)
├── approvals.ts          # Stage approval responses, field responses (~90 lines)
├── assignees.ts          # Assignees, role resolution, service roles (~235 lines)
├── scheduling.ts         # All project scheduling + scheduled services (~340 lines)
├── batch-updates.ts      # Batch due date updates (~130 lines)
└── dashboard.ts          # Dashboard metrics, my-projects, my-tasks, cache (~195 lines)
```

---

## Duplicate Code to Remove

The following are duplicated and should be removed, using imports from `routeHelpers.ts`:

1. **`paramUuidSchema`** (lines 28-30) - Already in routeHelpers.ts
2. **`validateParams`** (lines 33-38) - Already in routeHelpers.ts

### Code to Extract to Shared Utility

**`htmlToPlainText`** (lines 41-67) - Move to `server/utils/text.ts`:

```typescript
// server/utils/text.ts
export const htmlToPlainText = (html: string): string => {
  return html
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/[uo]l>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<\/th>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};
```

---

## Staged Implementation Approach

### Stage 1: Setup and Preparation
**Goal:** Create infrastructure without changing functionality

1. Create `server/routes/projects/` directory
2. Create `server/utils/text.ts` with `htmlToPlainText` function
3. Create empty `server/routes/projects/index.ts` with proper structure
4. **Verification:** Application still starts and runs

**Browser Test:**
- Login with credentials above
- Navigate to Projects page
- Verify projects load correctly

---

### Stage 2: Extract Project Views Routes (Low Risk)
**Goal:** Start with simplest, isolated domain

1. Create `projects/views.ts` with:
   - `GET /api/project-views`
   - `POST /api/project-views`
   - `PATCH /api/project-views/:id`
   - `DELETE /api/project-views/:id`
2. Import `validateParams` and `paramUuidSchema` from `routeHelpers.ts`
3. Remove these routes from `projects.ts`
4. Update `projects/index.ts` to import and register

**Verification:**
- [ ] Application starts without errors
- [ ] Can save/load project views

**Browser Test:**
- Login → Projects → Try saving a custom view filter
- Verify view persists after refresh

---

### Stage 3: Extract User Preferences Routes
**Goal:** Extract small, isolated domain

1. Create `projects/preferences.ts` with:
   - `GET /api/user-project-preferences`
   - `POST /api/user-project-preferences`
2. Remove from `projects.ts`
3. Update index

**Verification:**
- [ ] Column preferences save correctly
- [ ] View mode preferences persist

---

### Stage 4: Extract Core CRUD Routes
**Goal:** Move primary project operations

1. Create `projects/core.ts` with:
   - `GET /api/services/:serviceId/due-dates`
   - `GET /api/projects`
   - `GET /api/clients/:clientId/projects`
   - `GET /api/projects/:id`
   - `GET /api/projects/:id/communications`
   - `GET /api/projects/:id/most-recent-stage-change`
   - `PATCH /api/projects/:id`
   - `PATCH /api/projects/:id/complete`
2. Remove from `projects.ts`
3. Update index

**Verification:**
- [ ] Projects list loads
- [ ] Individual project details load
- [ ] Can update project fields
- [ ] Can complete a project

**Browser Test:**
- Login → Projects → Click on any project
- Verify details load
- Make a minor edit → Save → Verify saves correctly

---

### Stage 5: Extract Status Update Routes
**Goal:** Move stage change functionality (complex but critical)

1. Create `projects/status.ts` with:
   - `GET /api/projects/:id/stage-change-config`
   - `PATCH /api/projects/:id/status`
2. Note: This includes significant background processing logic
3. Remove from `projects.ts`
4. Update index

**Verification:**
- [ ] Stage changes work
- [ ] Stage change config loads correctly
- [ ] Chronology entries created
- [ ] Email notifications triggered (if configured)

**Browser Test:**
- Login → Projects → Open a project
- Change stage → Verify modal works
- Submit → Verify project moves to new stage
- Check chronology shows the change

---

### Stage 6: Extract Bulk Operations Routes
**Goal:** Move bulk status operations

1. Create `projects/bulk.ts` with:
   - `POST /api/projects/bulk-move-eligibility`
   - `POST /api/projects/bulk-status`
2. Remove from `projects.ts`
3. Update index

**Verification:**
- [ ] Bulk move eligibility check works
- [ ] Bulk status updates work

**Browser Test:**
- Login → Projects → Select multiple projects
- Use bulk action dropdown
- Verify eligibility check works
- Perform bulk move → Verify all projects update

---

### Stage 7: Extract Attachments Routes
**Goal:** Move stage change attachment handling

1. Create `projects/attachments.ts` with:
   - `POST /api/projects/:id/stage-change-attachments/upload-url`
   - `GET /api/projects/:id/stage-change-attachments/*`
2. Import `ObjectStorageService`, `ObjectNotFoundError`
3. Remove from `projects.ts`
4. Update index

**Verification:**
- [ ] Attachment uploads work during stage changes
- [ ] Attachments download correctly

**Browser Test:**
- Login → Projects → Open project → Change stage
- Upload an attachment in the stage change modal
- Complete stage change
- Verify attachment is accessible

---

### Stage 8: Extract Notifications Routes
**Goal:** Move stage change notification logic (large section)

1. Create `projects/notifications.ts` with:
   - `POST /api/projects/:id/send-stage-change-notification`
   - `POST /api/projects/:id/prepare-client-value-notification`
   - `POST /api/projects/:id/send-client-value-notification`
2. Import `htmlToPlainText` from `utils/text.ts`
3. Remove from `projects.ts`
4. Update index

**Verification:**
- [ ] Stage change notifications send
- [ ] Client value notifications prepare correctly
- [ ] Email content renders properly

**Browser Test:**
- Login → Projects → Open project with email notifications enabled
- Change stage → Verify notification option appears
- Send notification → Check email delivery (or logs)

---

### Stage 9: Extract Bench Operations Routes
**Goal:** Move bench/unbench functionality

1. Create `projects/bench.ts` with:
   - `POST /api/projects/:id/bench`
   - `POST /api/projects/:id/unbench`
2. Remove from `projects.ts`
3. Update index

**Verification:**
- [ ] Bench operation works
- [ ] Unbench restores previous status
- [ ] Chronology entries created

**Browser Test:**
- Login → Projects → Find unbenchable project
- Bench it → Verify moves to "On The Bench" status
- Unbench it → Verify returns to previous status

---

### Stage 10: Extract CSV Upload Routes
**Goal:** Move CSV import functionality

1. Create `projects/csv-upload.ts` with:
   - `POST /api/projects/upload`
2. Note: Requires `upload` middleware parameter
3. Remove from `projects.ts`
4. Update index

**Verification:**
- [ ] CSV upload parses correctly
- [ ] Projects created from CSV data

---

### Stage 11: Extract Approvals Routes
**Goal:** Move stage approval responses

1. Create `projects/approvals.ts` with:
   - `POST /api/projects/:id/stage-approval-responses`
   - `GET /api/projects/:projectId/field-responses`
2. Remove from `projects.ts`
3. Update index

**Verification:**
- [ ] Stage approval responses can be created
- [ ] Field responses can be retrieved

---

### Stage 12: Extract Assignees Routes
**Goal:** Move assignee and role resolution

1. Create `projects/assignees.ts` with:
   - `GET /api/projects/:projectId/assignees`
   - `GET /api/projects/:projectId/role-assignee`
   - `GET /api/projects/:projectId/service-roles`
2. Remove from `projects.ts`
3. Update index

**Verification:**
- [ ] Assignee resolution works
- [ ] Role assignments display correctly

**Browser Test:**
- Login → Projects → Open project with role-based assignment
- Verify correct user shows as assignee
- Check role tooltip shows service roles

---

### Stage 13: Extract Scheduling Routes
**Goal:** Move all project scheduling functionality

1. Create `projects/scheduling.ts` with:
   - `GET /api/scheduled-services`
   - `POST /api/project-scheduling/run`
   - `POST /api/project-scheduling/preview`
   - `GET /api/project-scheduling/analysis`
   - `GET /api/project-scheduling/monitoring`
   - `POST /api/project-scheduling/test-dry-run`
   - `POST /api/project-scheduling/seed-test-data`
   - `POST /api/project-scheduling/reset-test-data`
   - `POST /api/project-scheduling/mock-time-progression`
   - `POST /api/project-scheduling/generate-test-scenario`
2. Import scheduling functions from `../project-scheduler`
3. Remove from `projects.ts`
4. Update index

**Verification:**
- [ ] Scheduling preview works
- [ ] Scheduling run works
- [ ] Analysis endpoint returns data
- [ ] Monitoring data loads

**Browser Test (Admin only):**
- Login as admin → Admin menu → Project Scheduling
- Run scheduling preview → Verify results display
- Check monitoring dashboard loads

---

### Stage 14: Extract Batch Updates Routes
**Goal:** Move batch due date update functionality

1. Create `projects/batch-updates.ts` with:
   - `GET /api/projects/batch-update/due-dates/:projectTypeId`
   - `POST /api/projects/batch-update/due-dates`
2. Remove from `projects.ts`
3. Update index

**Verification:**
- [ ] Distinct due dates fetch correctly
- [ ] Batch update modifies correct projects

**Browser Test (Admin only):**
- Login as admin → Admin menu → Batch Updates (if UI exists)
- Select project type → See due date groupings
- Test batch update (carefully!)

---

### Stage 15: Extract Dashboard Routes
**Goal:** Move dashboard metrics and cache

1. Create `projects/dashboard.ts` with:
   - `GET /api/dashboard/metrics`
   - `GET /api/dashboard/my-projects`
   - `GET /api/dashboard/my-tasks`
   - `GET /api/dashboard/cache`
   - `POST /api/dashboard/cache/refresh`
2. Import `dashboardCache` schema and `db`
3. Remove from `projects.ts`
4. Update index

**Verification:**
- [ ] Dashboard loads with correct metrics
- [ ] My Projects section shows owned projects
- [ ] My Tasks section shows assigned projects
- [ ] Cache refresh works

**Browser Test:**
- Login → Main Dashboard
- Verify metrics display correctly
- Check "My Projects" shows correct count
- Check "My Tasks" shows correct count
- Click refresh → Verify counts update

---

### Stage 16: Cleanup and Finalization
**Goal:** Remove original file and finalize

1. Verify all routes have been moved
2. Delete `projects.ts` or convert to minimal index
3. Update main `server/routes.ts` to import from `projects/index.ts`
4. Remove all duplicate schemas
5. Clean up unused imports

**Verification:**
- [ ] Application starts without errors
- [ ] All project-related features work
- [ ] No console errors
- [ ] No TypeScript errors

**Full Browser Test:**
- Login with credentials
- Navigate through all main project features
- Create, update, move projects
- Check dashboard
- Test bulk operations
- Verify notifications

---

## Route Registration Pattern

Each new file should follow this pattern:

```typescript
import type { Express } from "express";
import { storage } from "../../storage/index";
import { 
  validateParams,
  paramUuidSchema,
} from "../routeHelpers";

export function registerProjectXxxRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any,
  upload?: any  // Only needed for csv-upload.ts
): void {
  // ===== DOMAIN NAME ROUTES =====
  
  app.get('/api/xxx', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Route implementation
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to..." });
    }
  });
}
```

---

## Index File Pattern

`server/routes/projects/index.ts`:

```typescript
import type { Express } from "express";
import { registerProjectCoreRoutes } from "./core";
import { registerProjectViewsRoutes } from "./views";
import { registerProjectPreferencesRoutes } from "./preferences";
import { registerProjectStatusRoutes } from "./status";
import { registerProjectBulkRoutes } from "./bulk";
import { registerProjectAttachmentsRoutes } from "./attachments";
import { registerProjectNotificationsRoutes } from "./notifications";
import { registerProjectBenchRoutes } from "./bench";
import { registerProjectCsvUploadRoutes } from "./csv-upload";
import { registerProjectApprovalsRoutes } from "./approvals";
import { registerProjectAssigneesRoutes } from "./assignees";
import { registerProjectSchedulingRoutes } from "./scheduling";
import { registerProjectBatchUpdatesRoutes } from "./batch-updates";
import { registerProjectDashboardRoutes } from "./dashboard";

export function registerProjectRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any,
  upload: any
): void {
  registerProjectViewsRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectPreferencesRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectCoreRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectStatusRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectBulkRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectAttachmentsRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectNotificationsRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectBenchRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectCsvUploadRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager, upload);
  registerProjectApprovalsRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectAssigneesRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectSchedulingRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectBatchUpdatesRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectDashboardRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
}
```

---

## Main Routes File Update

Update `server/routes.ts`:

```typescript
// Replace:
import { registerProjectRoutes } from "./routes/projects";

// With:
import { registerProjectRoutes } from "./routes/projects/index";

// The function signature remains the same, so no other changes needed
```

---

## Risk Mitigation

1. **Incremental Changes:** Each stage is small and testable independently
2. **No URL Changes:** API paths remain identical
3. **Middleware Preservation:** All auth/admin middleware remains the same
4. **Rollback Points:** Can revert any single stage without affecting others
5. **Feature Flag Approach:** Keep old routes commented until new ones verified
6. **Browser Testing:** Each stage includes specific browser verification steps

---

## Dependencies Between Stages

Most stages are independent, but note these dependencies:

1. **Stage 1 (Setup)** must complete before any other stage
2. **Stage 4 (Core)** should complete before Stages 5-9 (they reference project operations)
3. **Stage 8 (Notifications)** depends on `htmlToPlainText` from Stage 1
4. **Stage 16 (Cleanup)** must be last

Recommended groupings for parallel work:
- Group A: Views, Preferences (Stages 2-3)
- Group B: Core, Status, Bulk (Stages 4-6)
- Group C: Attachments, Notifications (Stages 7-8)
- Group D: Bench, CSV, Approvals, Assignees (Stages 9-12)
- Group E: Scheduling, Batch, Dashboard (Stages 13-15)

---

## Estimated Timeline

| Stage | Description | Time |
|-------|-------------|------|
| 1 | Setup and Preparation | 30 min |
| 2 | Project Views | 30 min |
| 3 | User Preferences | 15 min |
| 4 | Core CRUD | 1.5 hours |
| 5 | Status Updates | 2 hours |
| 6 | Bulk Operations | 1 hour |
| 7 | Attachments | 30 min |
| 8 | Notifications | 2 hours |
| 9 | Bench Operations | 30 min |
| 10 | CSV Upload | 30 min |
| 11 | Approvals | 30 min |
| 12 | Assignees | 45 min |
| 13 | Scheduling | 1.5 hours |
| 14 | Batch Updates | 30 min |
| 15 | Dashboard | 45 min |
| 16 | Cleanup/Finalization | 1 hour |
| **Total** | | **~14 hours** |

---

## Validation Checklist

After each stage, verify:

- [ ] Application starts without errors
- [ ] No TypeScript compilation errors
- [ ] Routes respond correctly (manual or automated testing)
- [ ] No 404 errors on previously working endpoints
- [ ] Authentication still works
- [ ] No console errors in browser or server

---

## Schemas to Add to routeHelpers.ts

If not already present, add these reusable schemas:

```typescript
export const paramProjectIdSchema = z.object({
  id: z.string().min(1, "Project ID is required").uuid("Invalid project ID format")
});

export const paramClientIdSchema = z.object({
  clientId: z.string().min(1, "Client ID is required").uuid("Invalid client ID format")
});

export const paramServiceIdSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required").uuid("Invalid service ID format")
});

export const paramProjectTypeIdSchema = z.object({
  projectTypeId: z.string().min(1, "Project Type ID is required").uuid("Invalid project type ID format")
});
```

---

## Notes for Implementation

1. **Import Order:** When moving routes, ensure all necessary imports are included
2. **Schema Dependencies:** Some routes use schemas from `@shared/schema` - maintain those imports
3. **Error Handling:** Maintain consistent error handling patterns
4. **Logging:** Keep existing console.error patterns for now
5. **Type Safety:** Use `any` for middleware types initially (can be improved later)
6. **Upload Middleware:** Only `csv-upload.ts` needs the `upload` parameter

---

## Post-Refactoring Improvements (Future)

After the split is complete, consider:

1. Adding proper TypeScript types for middleware
2. Creating route tests for critical paths
3. Improving error response consistency
4. Adding request validation middleware
5. Documenting API endpoints with OpenAPI/Swagger
6. Consolidating dashboard routes with analytics routes from auth.ts refactor

---

## Completion Status

**STATUS: COMPLETED** ✅

**Completed Date:** December 7, 2025

### Summary of Changes

The 3,115 line `server/routes/projects.ts` file has been successfully refactored into 15 domain-specific files:

| File | Description | Approx Lines |
|------|-------------|--------------|
| `index.ts` | Module registration and re-export | 60 |
| `views.ts` | Project views CRUD | 110 |
| `preferences.ts` | User project preferences | 35 |
| `core.ts` | Core CRUD, due-dates, communications | 355 |
| `status.ts` | Status updates, stage change config | 405 |
| `bulk.ts` | Bulk operations | 270 |
| `attachments.ts` | Stage change attachments | 80 |
| `notifications.ts` | Stage change notifications | 510 |
| `bench.ts` | Bench/unbench operations | 145 |
| `csv-upload.ts` | CSV project upload | 90 |
| `approvals.ts` | Stage approval responses | 90 |
| `assignees.ts` | Assignees, role resolution | 235 |
| `scheduling.ts` | All project scheduling | 340 |
| `batch-updates.ts` | Batch due date updates | 130 |
| `dashboard.ts` | Dashboard metrics, cache | 195 |

### Verification Results

- ✅ Application starts without errors
- ✅ No TypeScript compilation errors
- ✅ All project routes respond correctly
- ✅ GET /api/projects returns 200 with 51 projects
- ✅ GET /api/project-views returns 200 with 24 views
- ✅ Authentication works correctly
- ✅ E2E tests pass

### Additional Changes

1. Created `server/utils/text.ts` with `htmlToPlainText` utility function
2. Original `projects.ts` (129KB) deleted after successful verification
