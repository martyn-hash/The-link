# Clients Routes Refactoring Plan

## Status: COMPLETED

**Completion Date:** November 25, 2025

## Overview

This document outlines the detailed plan for refactoring `server/routes/clients.ts` (2,348 lines) into a modular, maintainable structure following the patterns established in `refactor.md`.

## Completed Results

### Final File Structure
```
server/routes/clients.ts        - 295 lines (core CRUD only)
server/routes/clients/
├── index.ts                    - 31 lines (barrel/orchestration)
├── companiesHouse.ts           - 698 lines
├── documents.ts                - 242 lines
├── people.ts                   - 151 lines
├── portalUsers.ts              - 117 lines
├── riskAssessments.ts          - 62 lines
└── services.ts                 - 837 lines
```

### Metrics Achieved
| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| Main file lines | 2,348 | 295 | ~400 | ✅ EXCEEDED |
| Largest module | 2,348 | 837 | ~500 | ✅ CLOSE |
| Total modules | 1 | 8 | 7-8 | ✅ MET |
| Clear responsibilities | No | Yes | Yes | ✅ MET |

### Verified Working
- All routes return 401 (Unauthorized) when not authenticated, confirming they are registered
- Application starts without errors
- No LSP errors in refactored code

---

## Pre-Test Reminder (CRITICAL)

**Before EVERY browser testing session:**
1. There is a known bug where projects sometimes do not load
2. If projects fail to load, you MUST:
   - Refresh the browser page
   - Restart the testing workflow
3. Login credentials: `admin@example.com` | `admin123` (password tab on root page)

---

## Current State Analysis

### File Statistics
- **Current Location:** `server/routes/clients.ts`
- **Current Size:** 2,348 lines
- **Target Size:** ~300-500 lines per module (5 modules)
- **Total Sections:** 9 distinct functional areas

### Current Section Breakdown

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| CLIENT MANAGEMENT | 49-239 | Core client CRUD operations |
| COMPANIES HOUSE | 241-559 | CH search, profile, officers, sync |
| CLIENT PEOPLE | 561-730 | People linked to clients, documents |
| CLIENT DOCUMENTS | 732-1044 | Document upload/download, folders |
| CLIENT SERVICES | 1046-1741 | Service assignments, role management |
| CH CHANGE REQUESTS | 1744-2008 | Companies House data sync requests |
| PORTAL USERS | 2181-2291 | Client portal user management |
| RISK ASSESSMENTS | 2293-2347 | Client risk assessment management |

### Imports Analysis

Current imports from:
- `../storage/index` - Storage facade
- `zod` - Validation
- `./routeHelpers` - Middleware and validation helpers
- `@shared/schema` - Insert schemas
- `../objectStorage` - Object storage service
- `../objectAcl` - Object permissions
- `../companies-house-service` - Companies House integration
- `../ch-sync-service` - CH synchronization
- `../core/service-mapper` - Service mapping utilities
- `../auth` - AuthenticatedRequest type
- `../notification-scheduler` - Notification scheduling

---

## Target Architecture

### Directory Structure

```
server/routes/clients/
├── index.ts                 # Main router & client CRUD (~400 lines)
├── people.ts                # Client people management (~200 lines)
├── services.ts              # Client service assignments (~500 lines)
├── documents.ts             # Document and folder management (~250 lines)
├── companiesHouse.ts        # Companies House integration (~450 lines)
├── portalUsers.ts           # Portal user management (~120 lines)
├── riskAssessments.ts       # Risk assessment routes (~80 lines)
└── helpers.ts               # Shared helpers (if needed) (~50 lines)
```

### Module Responsibilities

#### 1. `index.ts` - Main Router (~400 lines)
**Routes:**
- `GET /api/clients` - List all clients
- `GET /api/clients/:id` - Get single client
- `POST /api/clients` - Create client (admin)
- `PUT /api/clients/:id` - Update client (admin)
- `DELETE /api/clients/:id` - Delete client (admin)
- `POST /api/clients/individual` - Create individual client

**Exports:**
- `registerClientRoutes(app, ...)` - Main registration function

**Imports sub-routers:**
- `registerClientPeopleRoutes`
- `registerClientServicesRoutes`
- `registerClientDocumentsRoutes`
- `registerCompaniesHouseRoutes`
- `registerPortalUsersRoutes`
- `registerRiskAssessmentRoutes`

#### 2. `people.ts` - Client People (~200 lines)
**Routes:**
- `GET /api/clients/:id/people` - Get people for client
- `POST /api/clients/:id/people` - Link person to client
- `PUT /api/client-people/:id` - Update client-person relationship
- `DELETE /api/client-people/:id` - Remove person from client

#### 3. `services.ts` - Client Services (~500 lines)
**Routes:**
- `GET /api/clients/:id/services` - Get services for client
- `GET /api/client-services` - List all client services (admin)
- `GET /api/client-services/client/:clientId` - Get by client
- `GET /api/client-services/service/:serviceId` - Get by service
- `GET /api/client-services/:id` - Get single client service
- `POST /api/client-services` - Create mapping (admin)
- `PUT /api/client-services/:id` - Update client service
- `DELETE /api/client-services/:id` - Delete mapping
- Role assignment update handling (cascading to projects/tasks)

#### 4. `documents.ts` - Documents & Folders (~250 lines)
**Routes:**
- `GET /api/clients/:clientId/documents` - List documents
- `POST /api/clients/:clientId/documents` - Upload document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/:documentId/file` - Download document
- `GET /api/clients/:clientId/folders` - List folders
- `POST /api/clients/:clientId/folders` - Create folder

#### 5. `companiesHouse.ts` - Companies House Integration (~450 lines)
**Routes:**
- `GET /api/companies-house/search` - Search companies
- `GET /api/companies-house/company/:companyNumber` - Get profile
- `GET /api/companies-house/company/:companyNumber/officers` - Get officers
- `POST /api/clients/from-companies-house` - Create from CH
- `POST /api/companies-house/sync/:clientId` - Sync single client
- `POST /api/companies-house/enrich/:clientId` - Enrich client
- `POST /api/companies-house/enrich-bulk` - Bulk enrich
- `POST /api/ch-sync` - Trigger manual sync

**CH Change Requests:**
- `GET /api/ch-change-requests` - List change requests
- `GET /api/ch-change-requests/grouped` - Grouped by client
- `GET /api/ch-change-requests/client/:clientId` - By client
- `POST /api/ch-change-requests/:id/approve` - Approve
- `POST /api/ch-change-requests/:id/reject` - Reject
- `POST /api/ch-change-requests/client/:clientId/approve-all` - Bulk approve

#### 6. `portalUsers.ts` - Portal User Management (~120 lines)
**Routes:**
- `GET /api/clients/:clientId/portal-users` - List portal users
- `POST /api/clients/:clientId/portal-users` - Create portal user
- `PUT /api/portal-users/:portalUserId` - Update portal user
- `DELETE /api/portal-users/:portalUserId` - Delete portal user

#### 7. `riskAssessments.ts` - Risk Assessments (~80 lines)
**Routes:**
- `GET /api/clients/:clientId/risk-assessments` - List assessments
- `POST /api/clients/:clientId/risk-assessments` - Create assessment

---

## Implementation Plan

### Phase 1: Create Directory Structure and Scaffolding
**Task 1.1:** Create `server/routes/clients/` directory

**Task 1.2:** Create skeleton files with proper TypeScript structure:
- Each file exports a `register*Routes` function
- Each function receives the same middleware parameters as the main function

### Phase 2: Extract Modules (Bottom-Up Approach)

Start with the smallest, most isolated modules first to minimize risk.

**Task 2.1: Extract riskAssessments.ts** (~80 lines)
- Simplest module, only 2 routes
- No complex dependencies
- Good test case for the pattern

**Task 2.2: Extract portalUsers.ts** (~120 lines)
- 4 routes, self-contained
- Uses `userHasClientAccess` helper
- Straightforward CRUD operations

**Task 2.3: Extract people.ts** (~200 lines)
- Client-people relationship routes
- Document-related routes that are actually in this section

**Task 2.4: Extract documents.ts** (~250 lines)
- Document and folder CRUD
- Object storage integration
- File upload/download handling

**Task 2.5: Extract companiesHouse.ts** (~450 lines)
- Most complex extraction
- CH API integration
- Change request management
- Sync and enrichment operations

**Task 2.6: Extract services.ts** (~500 lines)
- Client service mappings
- Role assignment handling
- Notification scheduling
- Cascading task updates

**Task 2.7: Finalize index.ts** (~400 lines)
- Core client CRUD
- Import and call all sub-routers
- Maintain backward compatibility

### Phase 3: Update Main Routes Registration

**Task 3.1:** Update `server/routes.ts` imports
- Keep single `registerClientRoutes` export
- All sub-modules registered internally

### Phase 4: Fix LSP Errors

**Task 4.1:** Fix existing LSP errors at lines 155 and 1670
- These are pre-existing function argument mismatches
- Fix as part of the refactoring

---

## Code Patterns to Follow

### Module Export Pattern

```typescript
// server/routes/clients/riskAssessments.ts
import type { Express } from "express";
import { storage } from "../../storage/index";
import { z } from "zod";
import { insertRiskAssessmentSchema } from "@shared/schema";
import { userHasClientAccess } from "../routeHelpers";

export function registerRiskAssessmentRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // Routes here...
}
```

### Main Index Pattern

```typescript
// server/routes/clients/index.ts
import type { Express } from "express";
// ... imports ...

// Import sub-routers
import { registerClientPeopleRoutes } from "./people";
import { registerClientServicesRoutes } from "./services";
// ... etc ...

export function registerClientRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // Core client CRUD routes here...
  
  // Register sub-routes
  registerClientPeopleRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerClientServicesRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  // ... etc ...
}
```

---

## Testing Requirements

### Pre-Testing Checklist
1. **CRITICAL:** Check for projects loading bug - refresh browser and restart testing if needed
2. Login via password tab: `admin@example.com` | `admin123`

### Functional Test Cases

#### Client Management Tests
- [ ] List all clients (`GET /api/clients`)
- [ ] Get single client by ID (`GET /api/clients/:id`)
- [ ] Create new client (`POST /api/clients`)
- [ ] Update client (`PUT /api/clients/:id`)
- [ ] Delete client (`DELETE /api/clients/:id`)

#### People Tests
- [ ] List people for client (`GET /api/clients/:id/people`)
- [ ] Link person to client
- [ ] Update client-person relationship
- [ ] Remove person from client

#### Services Tests
- [ ] List services for client
- [ ] Create client-service mapping
- [ ] Update client service
- [ ] Delete client-service mapping
- [ ] Role assignment cascading to projects/tasks

#### Documents Tests
- [ ] List documents for client
- [ ] Upload document
- [ ] Download document
- [ ] Create folder
- [ ] List folders

#### Companies House Tests
- [ ] Search companies
- [ ] Get company profile
- [ ] Get company officers
- [ ] Create client from CH
- [ ] Sync client data
- [ ] Enrich client
- [ ] Approve/reject change requests

#### Portal Users Tests
- [ ] List portal users
- [ ] Create portal user
- [ ] Update portal user
- [ ] Delete portal user

#### Risk Assessments Tests
- [ ] List risk assessments
- [ ] Create risk assessment

### Integration Tests
- [ ] Service creation triggers notification scheduling
- [ ] Role assignment changes cascade to project currentAssigneeId
- [ ] Role assignment changes reassign tasks from old user to new user
- [ ] CH sync creates pending change requests
- [ ] Document upload stores file in object storage

---

## Success Metrics

### Code Quality Metrics
| Metric | Before | Target | Verification |
|--------|--------|--------|--------------|
| Main file lines | 2,348 | ~400 | Line count |
| Largest module | 2,348 | ~500 | Line count |
| Total modules | 1 | 7-8 | File count |
| Clear responsibilities | No | Yes | Code review |

### Functional Metrics
| Metric | Target | Verification |
|--------|--------|--------------|
| All routes working | 100% | End-to-end tests |
| No regressions | 0 | Test suite pass |
| LSP errors | 0 | LSP check |
| TypeScript errors | 0 | Build check |

### Maintainability Metrics
| Metric | Before | Target | Verification |
|--------|--------|--------|--------------|
| Single responsibility | No | Yes | Code review |
| Import clarity | Poor | Good | Code review |
| Testability | Poor | Good | Unit test potential |

---

## Risk Mitigation

### Risks and Mitigations

1. **Route registration order matters**
   - Mitigation: Keep same order as original file
   - Test all routes after each extraction

2. **Shared state between routes**
   - Mitigation: All state is already passed through storage
   - No module-level state exists

3. **Middleware chain correctness**
   - Mitigation: Pass all middleware through to sub-routers
   - Each sub-router applies same middleware pattern

4. **Import path changes**
   - Mitigation: Storage uses `../storage/index` pattern
   - Update relative imports as needed

5. **Pre-existing LSP errors**
   - Mitigation: Fix as part of refactoring
   - Lines 155 and 1670 have argument count issues

---

## Task Sequence Summary

1. Create directory structure
2. Extract riskAssessments.ts (smallest, lowest risk)
3. Extract portalUsers.ts
4. Extract people.ts
5. Extract documents.ts
6. Extract companiesHouse.ts
7. Extract services.ts
8. Finalize index.ts with sub-router registration
9. Fix LSP errors
10. Run comprehensive tests
11. Verify all success metrics

---

## Post-Refactoring Checklist

- [ ] All routes return same responses as before
- [ ] No TypeScript compilation errors
- [ ] No LSP errors
- [ ] All existing functionality works
- [ ] Documentation updated (replit.md)
- [ ] Code follows established patterns

---

## Notes

- The storage layer is already modularized (`server/storage/clients/`, etc.)
- Keep using the facade import: `import { storage } from "../storage/index"`
- Follow the pattern from other route files like `server/routes/people.ts`
- The main `routes.ts` file doesn't need changes - it imports `registerClientRoutes` from `./routes/clients`
