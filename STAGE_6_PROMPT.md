# Stage 6: Services Domain Extraction - Implementation Prompt

## Context
You are continuing the incremental refactoring of `server/storage.ts` (13,648 lines) into a modular, domain-driven architecture. Stages 0-5 are complete (145 methods extracted across 11 storage classes). Now you're extracting **Stage 6: Services Domain** (~70 methods across 3 modules).

## Objectives
Extract all services-related operations into three focused storage modules:
1. **ServiceStorage** - Service CRUD and filtering operations
2. **WorkRoleStorage** - Work role management and service-role mappings
3. **ServiceAssignmentStorage** - Client/people service assignments and resolution helpers

## Critical Testing Notes
**⚠️ READ BEFORE EVERY BROWSER TEST:**

### Login Credentials
- Navigate to **root page (/)** → **Password tab**
- Use credentials: `admin@example.com` | `admin123`

### Known Bug
- **Projects Loading Issue**: Sometimes the projects page doesn't load properly
- **Solution**: If projects fail to load, refresh the browser and restart the test from the beginning
- Always be prepared to refresh and retry

## Implementation Plan

### Step 1: Inventory Methods (~30 min)
Extract from `server/storage.ts` starting around line 6678 (Services CRUD section):

**Service Methods (~12 methods):**
```typescript
getAllServices()
getActiveServices()
getServicesWithActiveClients()
getClientAssignableServices()
getProjectTypeAssignableServices()
getServiceById(id)
getServiceByName(name)
getScheduledServices()
createService(service)
updateService(id, service)
deleteService(id)
getServiceByProjectTypeId(projectTypeId)
```

**Work Role Methods (~10 methods):**
```typescript
getAllWorkRoles()
getWorkRoleById(id)
getWorkRoleByName(name)
createWorkRole(role)
updateWorkRole(id, role)
deleteWorkRole(id)
getServiceRolesByServiceId(serviceId)
getWorkRolesByServiceId(serviceId)
addRoleToService(serviceId, roleId)
removeRoleFromService(serviceId, roleId)
```

**Service Assignment Methods (~25+ methods):**
```typescript
// Client service assignments
getAllClientServices()
getClientServiceById(id)
getClientServicesByClientId(clientId)
getClientServicesByServiceId(serviceId)
createClientService(clientService)
updateClientService(id, clientService)
deleteClientService(id)

// Client service role assignments
getAllClientServiceRoleAssignments()
getClientServiceRoleAssignmentsByClientServiceId(clientServiceId)
createClientServiceRoleAssignment(assignment)
updateClientServiceRoleAssignment(id, assignment)
deleteClientServiceRoleAssignment(id)
resolveRoleAssignmentsForProject(clientServiceId, roleId)

// People service assignments
getAllPeopleServices()
getPeopleServicesByPersonId(personId)
getPeopleServicesByServiceId(serviceId)
createPeopleService(peopleService)
updatePeopleService(id, peopleService)
deletePeopleService(id)
resolveServiceOwnerForPerson(serviceId, personId)
```

### Step 2: Create Storage Modules (~2 hours)

#### 2.1 Create `server/storage/services/serviceStorage.ts`
```typescript
import { BaseStorage } from '../base/types';
import { db } from '@db';
import { services, /* other tables */ } from '@shared/schema';
import { eq, and, /* other ops */ } from 'drizzle-orm';
import type { Service, InsertService } from '@shared/schema';

export class ServiceStorage extends BaseStorage {
  // Implement all 12 service methods
  // Follow pattern from ProjectStorage/ClientStorage
  // Include proper error handling and transactions where needed
}
```

**Key considerations:**
- Follow existing BaseStorage pattern
- Include proper type safety
- Handle service deletion with dependency checks
- Export helper functions if needed for cross-domain access

#### 2.2 Create `server/storage/services/workRoleStorage.ts`
```typescript
export class WorkRoleStorage extends BaseStorage {
  // Implement all 10 work role methods
  // Include service-role mapping operations
}
```

#### 2.3 Create `server/storage/services/serviceAssignmentStorage.ts`
```typescript
export class ServiceAssignmentStorage extends BaseStorage {
  // Implement all ~25 assignment methods
  // CRITICAL: Preserve resolveRoleAssignmentsForProject signature
  // CRITICAL: Preserve resolveServiceOwnerForPerson signature
  // These are used by project helpers
}
```

#### 2.4 Create `server/storage/services/index.ts`
```typescript
export { ServiceStorage } from './serviceStorage';
export { WorkRoleStorage } from './workRoleStorage';
export { ServiceAssignmentStorage } from './serviceAssignmentStorage';

// Export any helper functions needed for cross-domain access
// Example:
// export const getServiceByName = (storage: ServiceStorage) => 
//   (name: string) => storage.getServiceByName(name);
```

### Step 3: Update Facade (~1 hour)

#### 3.1 Update `server/storage/index.ts`
```typescript
// 1. Import new storage classes
import { 
  ServiceStorage, 
  WorkRoleStorage, 
  ServiceAssignmentStorage 
} from './services';

// 2. Add to DatabaseStorage constructor
this.serviceStorage = new ServiceStorage();
this.workRoleStorage = new WorkRoleStorage();
this.serviceAssignmentStorage = new ServiceAssignmentStorage();

// 3. Delegate all methods (organize by storage class)
// Service methods (12 delegations)
async getAllServices() { return this.serviceStorage.getAllServices(); }
async getActiveServices() { return this.serviceStorage.getActiveServices(); }
// ... etc

// Work role methods (10 delegations)
async getAllWorkRoles() { return this.workRoleStorage.getAllWorkRoles(); }
// ... etc

// Assignment methods (25+ delegations)
async getAllClientServices() { return this.serviceAssignmentStorage.getAllClientServices(); }
// ... etc
```

#### 3.2 Update Helper Registration (if needed)
Check if any project helpers need service-related dependencies:
```typescript
private registerProjectHelpers() {
  // Check for any service-related helpers that need updating
  // Example: resolveServiceOwner, resolveRoleAssignments
}
```

### Step 4: Testing & Validation (~2 hours)

#### 4.1 TypeScript Verification
```bash
# Check for LSP errors
Use get_latest_lsp_diagnostics tool
# Should return 0 errors
```

#### 4.2 Server Boot Test
```bash
# Restart workflow and check logs
# Verify clean boot with no errors
```

#### 4.3 API Endpoint Tests
Test key endpoints:
- `GET /api/services` - List all services
- `GET /api/services/:id` - Get specific service
- `POST /api/services` - Create service (if route exists)
- `GET /api/client-services` - Client service assignments

#### 4.4 E2E Browser Test (if applicable)
**REMEMBER: Check testing notes above before starting!**

```
Test Plan:
1. [New Context] Create a new browser context
2. [Browser] Navigate to root page (/)
3. [Browser] Click on "Password" tab
4. [Browser] Enter email "admin@example.com"
5. [Browser] Enter password "admin123"
6. [Browser] Click login button
7. [Verify] Assert redirect to /projects or dashboard

8. [Browser] Navigate to services page (if it exists in UI)
9. [Verify] Services list loads successfully
10. [Browser] Click on a service to view details
11. [Verify] Service details display correctly

Note: If projects page fails to load, refresh browser and restart test
```

### Step 5: Architect Review (~30 min)

Call architect tool with:
```typescript
architect({
  task: "Review Stage 6 Services Domain extraction. Verify:
    1. All ~70 service methods correctly extracted
    2. Helper signatures preserved (resolveRoleAssignmentsForProject, resolveServiceOwnerForPerson)
    3. No breaking changes to project helpers
    4. Transaction boundaries handled correctly
    5. Cross-domain dependencies intact",
  relevant_files: [
    "server/storage/services/serviceStorage.ts",
    "server/storage/services/workRoleStorage.ts", 
    "server/storage/services/serviceAssignmentStorage.ts",
    "server/storage/index.ts"
  ],
  include_git_diff: true,
  responsibility: "evaluate_task"
})
```

### Step 6: Documentation (~15 min)

Update `refactor_storage.md`:
```markdown
### Stage 6: Services Domain (✅ COMPLETED - November 24, 2025)
- **Extracted:** ~70 methods into ServiceStorage (~12), WorkRoleStorage (~10), ServiceAssignmentStorage (~25+)
- **Pattern:** Three-module extraction with helper preservation
- **Testing:** Service CRUD, role assignments, API endpoints verified
- **Architect Approval:** Received - all service operations work correctly
- **Critical Helpers Preserved:**
  - resolveRoleAssignmentsForProject
  - resolveServiceOwnerForPerson
- **Ready for:** Stage 7 (Tags, Communications & Scheduling)
```

## Success Criteria
- [ ] All ~70 service methods extracted across 3 storage classes
- [ ] TypeScript compiles with 0 LSP errors
- [ ] Server boots cleanly with no errors
- [ ] Key API endpoints return data correctly
- [ ] Helper signatures preserved (resolveRoleAssignmentsForProject, resolveServiceOwnerForPerson)
- [ ] E2E tests pass (with browser refresh workaround if needed)
- [ ] Architect approval received
- [ ] Documentation updated
- [ ] No breaking changes to existing functionality

## Known Risks & Mitigations

**Risk 1: Transaction Boundaries**
- Service deletions may require atomic operations
- Mitigation: Use database transactions for complex deletions

**Risk 2: Helper Signature Changes**
- Project helpers depend on resolveRoleAssignmentsForProject
- Mitigation: Verify exact signatures are preserved

**Risk 3: Cross-Domain Dependencies**
- Services used by scheduling automation
- Mitigation: Test project creation/scheduling after extraction

**Risk 4: Projects Loading Bug**
- Projects page may fail to load during testing
- Mitigation: Refresh browser and restart test

## Estimated Timeline
- Step 1 (Inventory): 30 minutes
- Step 2 (Create modules): 2 hours
- Step 3 (Update facade): 1 hour
- Step 4 (Testing): 2 hours
- Step 5 (Architect review): 30 minutes
- Step 6 (Documentation): 15 minutes

**Total: 6-7 hours**

## Post-Completion Checklist
- [ ] All success criteria met
- [ ] Git diff reviewed by architect
- [ ] No debug logging left in code
- [ ] Testing notes updated if new issues discovered
- [ ] Ready to proceed to Stage 7

---

## Quick Reference: Testing Login
**Before every browser test, remember:**
- Root page (/) → Password tab → `admin@example.com` | `admin123`
- If projects don't load: Refresh browser and restart test
