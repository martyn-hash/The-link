# Refactoring Plan: server/routes/auth.ts

## Overview

**File:** `server/routes/auth.ts`  
**Current Size:** 2,984 lines  
**Priority:** #1 (First in refactoring order)  
**Risk Level:** HIGH - Contains authentication critical path  
**Estimated Effort:** Large (3-5 days)

---

## Browser Testing Login Details

For all verification steps, use these credentials:

- **URL:** Root page (`/`)
- **Tab:** "Passwords" tab
- **Email:** `jamsplan1@gmail.com`
- **Password:** `admin123`

---

## Problem Statement

Despite its name, `auth.ts` has become a "kitchen sink" file containing 18+ unrelated domains. Only ~10% of the code is actually authentication-related. The file violates single responsibility principle and makes maintenance, debugging, and agent navigation extremely difficult.

---

## Scope Definition

### In Scope
- Splitting `auth.ts` into domain-specific route files
- Removing duplicate validation schemas (use `routeHelpers.ts` instead)
- Creating new domain-organized route files
- Updating `routes.ts` to import and register new route modules
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
2. **File Size Reduction:** `auth.ts` reduced to <300 lines (core auth only)
3. **Domain Separation:** Each new file has a single, clear domain responsibility
4. **No Duplicate Code:** Validation schemas imported from `routeHelpers.ts`
5. **Consistent Patterns:** All new files follow the same structure pattern
6. **Tests Pass:** If any existing tests exist, they must continue to pass
7. **No Regressions:** Application runs without errors after each stage

---

## Current Domain Analysis

The file contains these distinct domains (with approximate line counts):

| Domain | Lines | Routes | New File Location |
|--------|-------|--------|-------------------|
| Health/Feature Flags | ~25 | 2 | `routes/system.ts` |
| Auth Core | ~80 | 4 | `routes/auth/core.ts` |
| Bootstrap/Dev | ~125 | 2 | `routes/auth/bootstrap.ts` |
| Users CRUD | ~400 | 8 | `routes/users.ts` |
| User Profile | ~200 | 4 | `routes/users.ts` |
| User Notifications | ~100 | 3 | `routes/users.ts` |
| Fallback User | ~50 | 2 | `routes/users.ts` |
| Dashboards | ~160 | 5 | `routes/dashboards.ts` |
| Project Preferences | ~40 | 1 | `routes/preferences.ts` |
| Dashboard Data/Analytics | ~180 | 3 | `routes/analytics.ts` |
| Search | ~25 | 1 | `routes/search.ts` |
| Activity Tracking | ~30 | 1 | `routes/activity.ts` |
| Object Storage/Upload | ~140 | 4 | `routes/objects.ts` |
| Documents | ~160 | 5 | `routes/documents.ts` |
| Portal Users | ~300 | 8 | `routes/portal-users.ts` |
| Risk Assessments | ~100 | 4 | `routes/risk-assessments.ts` |
| Company Views | ~80 | 3 | `routes/views.ts` |
| Column Preferences | ~85 | 3 | `routes/preferences.ts` |
| Import | ~460 | 2 | `routes/import.ts` |
| Admin Routes | ~300 | 5 | `routes/admin/misc.ts` |
| Address Lookup | ~120 | 3 | `routes/address.ts` |

---

## Target File Structure

```
server/routes/
├── auth/
│   ├── index.ts          # Re-exports and registers auth routes
│   ├── core.ts           # Login, user info, impersonation (~150 lines)
│   └── bootstrap.ts      # Bootstrap admin, dev reset (~125 lines)
├── admin/
│   ├── index.ts          # Existing admin routes
│   └── misc.ts           # Delete test data, frequency issues, etc. (~300 lines)
├── users.ts              # User CRUD, profile, notifications, fallback (~750 lines)
├── dashboards.ts         # Dashboard CRUD and management (~160 lines)
├── analytics.ts          # Dashboard data, analytics endpoints (~180 lines)
├── documents.ts          # Document CRUD, folders (~160 lines)
├── portal-users.ts       # Portal user management (~300 lines)
├── risk-assessments.ts   # Risk assessment CRUD (~100 lines)
├── views.ts              # Company views, project views (~80 lines)
├── preferences.ts        # Project prefs, column prefs (~125 lines)
├── objects.ts            # Object storage, upload (~140 lines)
├── import.ts             # Import validate/execute (~460 lines)
├── search.ts             # Search endpoint (~25 lines)
├── activity.ts           # Activity tracking (~30 lines)
├── address.ts            # Address lookup endpoints (~120 lines)
├── system.ts             # Health check, feature flags (~25 lines)
└── routeHelpers.ts       # Existing shared helpers (already exists)
```

---

## Staged Implementation Approach

### Stage 1: Setup and Preparation
**Goal:** Create infrastructure without changing functionality

1. Create `server/routes/auth/` directory
2. Create `server/routes/admin/` directory if needed
3. Create empty route files with proper structure
4. Add registration function pattern to each new file:
   ```typescript
   export async function registerXxxRoutes(
     app: Express,
     isAuthenticated: any,
     resolveEffectiveUser: any,
     requireAdmin: any,
     requireManager: any
   ) {
     // Routes will be added here
   }
   ```
5. **Verification:** Application still starts and runs

---

### Stage 2: Extract System Routes (Low Risk)
**Goal:** Extract simplest routes first to validate approach

1. Create `routes/system.ts` with:
   - `GET /api/health`
   - `GET /api/feature-flags`
2. Remove these routes from `auth.ts`
3. Update main routes registration to include new file
4. **Verification:** Both endpoints still work

---

### Stage 3: Extract Auth Core Routes
**Goal:** Keep only true authentication in auth directory

1. Create `routes/auth/core.ts` with:
   - `GET /api/auth/user`
   - `POST /api/auth/impersonate/:userId`
   - `DELETE /api/auth/impersonate`
   - `GET /api/auth/impersonation-state`
2. Create `routes/auth/bootstrap.ts` with:
   - `POST /api/bootstrap-admin`
   - `POST /api/dev/reset-password`
3. Create `routes/auth/index.ts` to register both
4. Remove from `auth.ts`
5. **Verification:** Auth flow works, impersonation works

---

### Stage 4: Extract Users Routes
**Goal:** Move all user-related routes

1. Create `routes/users.ts` with:
   - `GET /api/users`
   - `GET /api/users/for-messaging`
   - `GET /api/users/:id`
   - `POST /api/users`
   - `PATCH /api/users/:id`
   - `DELETE /api/users/:id`
   - `GET /api/users/profile`
   - `PUT /api/users/profile`
   - `PUT /api/users/password`
   - `GET /api/users/:userId/notification-preferences`
   - `PUT /api/users/:userId/notification-preferences`
   - `POST /api/users/:userId/notification-preferences/reset`
   - `POST /api/fallback-user`
   - `GET /api/fallback-user`
2. Import schemas from `routeHelpers.ts`:
   - `paramUserIdSchema`
   - `paramUserIdAsIdSchema`
3. Remove from `auth.ts`
4. **Verification:** User management works, profile updates work

---

### Stage 5: Extract Dashboard Routes
**Goal:** Separate dashboard management

1. Create `routes/dashboards.ts` with:
   - `GET /api/dashboards`
   - `GET /api/dashboards/:id`
   - `POST /api/dashboards`
   - `PUT /api/dashboards/:id`
   - `DELETE /api/dashboards/:id`
2. Create `routes/analytics.ts` with:
   - `GET /api/dashboard/:dashboardId` (dashboard data)
   - `POST /api/analytics`
   - `GET /api/analytics/projects-over-time` (if exists)
3. Remove from `auth.ts`
4. **Verification:** Dashboard builder works, analytics data loads

---

### Stage 6: Extract Document and Storage Routes
**Goal:** Separate file management concerns

1. Create `routes/documents.ts` with:
   - `GET /api/documents`
   - `GET /api/documents/:id`
   - `POST /api/documents`
   - `DELETE /api/documents/:id`
   - `GET /api/clients/:id/folders`
   - `POST /api/clients/:id/folders`
   - `DELETE /api/folders/:id`
2. Create `routes/objects.ts` with:
   - `POST /api/objects/upload`
   - `POST /api/objects/upload/multipart/*`
   - `GET /api/objects/:key`
   - `DELETE /api/objects/:key`
3. Remove from `auth.ts`
4. **Verification:** File uploads work, document viewing works

---

### Stage 7: Extract Portal User Routes
**Goal:** Separate client portal management

1. Create `routes/portal-users.ts` with:
   - `GET /api/portal-user/magic-link`
   - `POST /api/portal-user/magic-link`
   - `GET /api/portal-user/request/:clientId`
   - `POST /api/portal-user/request`
   - `GET /api/portal-users/:clientId`
   - `POST /api/portal-users`
   - `PATCH /api/portal-users/:id`
   - `DELETE /api/portal-users/:id`
   - `GET /api/portal-status`
2. Remove from `auth.ts`
3. **Verification:** Portal access works, magic links work

---

### Stage 8: Extract Remaining Domain Routes
**Goal:** Complete the extraction

1. Create `routes/risk-assessments.ts` with risk assessment routes
2. Create `routes/views.ts` with company/project views routes
3. Create `routes/preferences.ts` with:
   - Project preferences routes
   - Column preferences routes
4. Create `routes/import.ts` with:
   - `POST /api/import/validate`
   - `POST /api/import/execute`
5. Create `routes/search.ts` with `GET /api/search`
6. Create `routes/activity.ts` with `POST /api/track-activity`
7. Create `routes/address.ts` with address lookup routes
8. Move admin misc routes to `routes/admin/misc.ts`
9. Remove all from `auth.ts`
10. **Verification:** All features work

---

### Stage 9: Cleanup and Finalization
**Goal:** Clean up the original file and validate

1. Verify `auth.ts` is now empty or minimal
2. If minimal routes remain, rename to appropriate file or keep as auth index
3. Remove unused imports from `auth.ts`
4. Delete `auth.ts` if completely empty
5. Update main `routes.ts` to import all new modules
6. Remove duplicate schemas that are now in `routeHelpers.ts`
7. **Verification:** Full application test, all routes work

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

## Common Code to Centralize in routeHelpers.ts

The following schemas are duplicated in `auth.ts` and should use the existing ones from `routeHelpers.ts`:

1. `paramUserIdSchema` - Already in routeHelpers.ts
2. `paramUserIdAsIdSchema` - Already in routeHelpers.ts  
3. `paramUuidSchema` - Already in routeHelpers.ts
4. `validateParams` - Already in routeHelpers.ts
5. `analyticsQuerySchema` - Already in routeHelpers.ts

**Action:** Remove duplicate definitions from `auth.ts` and import from `routeHelpers.ts`

---

## New Schemas to Add to routeHelpers.ts

These schemas from `auth.ts` should be moved to `routeHelpers.ts`:

```typescript
// Dashboard schemas
export const paramDashboardIdSchema = z.object({
  id: z.string().min(1, "Dashboard ID is required").uuid("Invalid dashboard ID format")
});

// Document schemas  
export const paramDocumentIdSchema = z.object({
  id: z.string().min(1, "Document ID is required").uuid("Invalid document ID format")
});

// Portal user schemas
export const paramPortalUserIdSchema = z.object({
  id: z.string().min(1, "Portal user ID is required").uuid("Invalid portal user ID format")
});
```

---

## Route Registration Pattern

Each new file should follow this pattern:

```typescript
import type { Express } from "express";
import { storage } from "../storage/index";
import { 
  validateParams,
  paramUuidSchema,
  // other needed schemas
} from "./routeHelpers";

export async function registerXxxRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // ===== DOMAIN NAME ROUTES =====
  
  app.get('/api/xxx', isAuthenticated, async (req: any, res: any) => {
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

## Main Routes File Update

Update `server/routes.ts` to register all new route modules:

```typescript
import { registerSystemRoutes } from "./routes/system";
import { registerAuthRoutes } from "./routes/auth/index";
import { registerUsersRoutes } from "./routes/users";
import { registerDashboardsRoutes } from "./routes/dashboards";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerDocumentsRoutes } from "./routes/documents";
import { registerObjectsRoutes } from "./routes/objects";
import { registerPortalUsersRoutes } from "./routes/portal-users";
import { registerRiskAssessmentsRoutes } from "./routes/risk-assessments";
import { registerViewsRoutes } from "./routes/views";
import { registerPreferencesRoutes } from "./routes/preferences";
import { registerImportRoutes } from "./routes/import";
import { registerSearchRoutes } from "./routes/search";
import { registerActivityRoutes } from "./routes/activity";
import { registerAddressRoutes } from "./routes/address";
// ... existing imports

export async function registerRoutes(app: Express) {
  // ... existing middleware setup
  
  // Register route modules
  await registerSystemRoutes(app);
  await registerAuthRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  await registerUsersRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  await registerDashboardsRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  // ... continue for all modules
}
```

---

## Risk Mitigation

1. **Incremental Changes:** Each stage is small and can be tested independently
2. **No URL Changes:** API paths remain identical
3. **Middleware Preservation:** All auth/admin middleware remains the same
4. **Rollback Points:** Can revert any single stage without affecting others
5. **Feature Flag Approach:** Keep old routes commented until new ones verified

---

## Estimated Timeline

| Stage | Description | Time |
|-------|-------------|------|
| 1 | Setup and Preparation | 30 min |
| 2 | System Routes | 30 min |
| 3 | Auth Core Routes | 1 hour |
| 4 | Users Routes | 2 hours |
| 5 | Dashboard Routes | 1 hour |
| 6 | Document/Storage Routes | 1 hour |
| 7 | Portal User Routes | 1 hour |
| 8 | Remaining Routes | 2 hours |
| 9 | Cleanup/Finalization | 1 hour |
| **Total** | | **~10 hours** |

---

## Notes for Implementation

1. **Import Order:** When moving routes, ensure all necessary imports are included
2. **Schema Dependencies:** Some routes may use schemas defined inline - extract these
3. **Error Handling:** Maintain consistent error handling patterns
4. **Logging:** Keep existing console.error patterns for now
5. **Type Safety:** Use `any` for middleware types initially (can be improved later)

---

## Post-Refactoring Improvements (Future)

After the split is complete, consider:

1. Adding proper TypeScript types for middleware
2. Creating route tests for critical paths
3. Improving error response consistency
4. Adding request validation middleware
5. Documenting API endpoints
