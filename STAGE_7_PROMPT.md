# STAGE 7: Extract Tags, Communications, & Scheduling Domain

## Overview
Extract supporting domains from the monolithic `server/storage.ts` into focused modules: tags, communications, and project scheduling history. This is a relatively low-risk stage focusing on self-contained, supporting functionality.

**Estimated Time:** 3-4 hours  
**Risk Level:** LOW  
**Dependencies:** Stages 0-6 must be complete

---

## Testing Credentials
**IMPORTANT:** Read this before every browser testing session:

### Login Details
- **URL:** Root page (/)
- **Tab:** Password tab
- **Email:** `admin@example.com`
- **Password:** `admin123`

### Known Issues
- **Projects Loading Bug:** Sometimes the projects page doesn't load properly
  - **Solution:** Refresh the browser and restart your test from the beginning
  - Always be prepared to refresh and retry if projects fail to load

---

## Current State (After Stage 6)

### Progress Summary
- **Stage 0:** Foundation (infrastructure)
- **Stage 1:** Users Domain - 31 methods
- **Stage 2:** Clients Domain - 31 methods
- **Stage 3:** People Domain - 15 methods
- **Stage 4:** Projects Core - 17 methods
- **Stage 5:** Projects Configuration - 51 methods
- **Stage 6:** Services Domain - 55 methods

**Total Methods Extracted:** 200 methods  
**Original File:** 13,648 lines  
**Current File:** ~13,636 lines

### Modules Created (Stages 1-6)
1. `server/storage/users/` - UserStorage, UserActivityStorage
2. `server/storage/clients/` - ClientStorage, CompaniesHouseStorage, SearchStorage
3. `server/storage/people/` - PeopleStorage, ClientPeopleStorage
4. `server/storage/projects/` - ProjectStorage, ProjectChronologyStorage, ProjectTypesStorage, ProjectStagesStorage, ProjectApprovalsStorage
5. `server/storage/services/` - ServiceStorage, WorkRoleStorage, ServiceAssignmentStorage

---

## Stage 7 Objectives

Extract three supporting domains into focused storage modules:

1. **Tags Domain** - Client tags and people tags
2. **Communications Domain** - Communications tracking
3. **Project Scheduling Domain** - Scheduling history and run logs

**Expected Methods:** ~15-20 methods  
**Expected Lines:** ~400-600 lines extracted

---

## Files to Create

### 1. Tags Domain
**File:** `server/storage/tags/tagStorage.ts`

**Methods to Extract:**
- Client Tags:
  - `getAllClientTags()`
  - `getClientTagById(id)`
  - `getClientTagsByClientId(clientId)`
  - `createClientTag(tag)`
  - `updateClientTag(id, tag)`
  - `deleteClientTag(id)`

- People Tags:
  - `getAllPeopleTags()`
  - `getPeopleTagById(id)`
  - `getPeopleTagsByPersonId(personId)`
  - `createPeopleTag(tag)`
  - `updatePeopleTag(id, tag)`
  - `deletePeopleTag(id)`

**Estimated:** ~12 methods, ~250 lines

### 2. Communications Domain
**File:** `server/storage/communications/communicationStorage.ts`

**Methods to Extract:**
- `getAllCommunications()`
- `getCommunicationById(id)`
- `createCommunication(communication)`
- `updateCommunication(id, communication)`
- `deleteCommunication(id)`

**Estimated:** ~5 methods, ~100 lines

### 3. Project Scheduling Domain
**File:** `server/storage/projects/projectSchedulingStorage.ts`

**Methods to Extract:**
- Scheduling History:
  - `getAllProjectSchedulingHistory()`
  - `getProjectSchedulingHistoryByProjectId(projectId)`
  - `createProjectSchedulingHistory(history)`

- Scheduling Run Logs:
  - `getAllSchedulingRunLogs()`
  - `createSchedulingRunLog(log)`

**Estimated:** ~5 methods, ~150 lines

### 4. Index Files
- `server/storage/tags/index.ts` - Export TagStorage
- `server/storage/communications/index.ts` - Export CommunicationStorage
- Update `server/storage/projects/index.ts` - Add ProjectSchedulingStorage export

---

## Implementation Steps

### Step 1: Create TagStorage Module

1. **Create** `server/storage/tags/tagStorage.ts`:
   ```typescript
   import { BaseStorage } from '../base/BaseStorage.js';
   import { db } from '../../db.js';
   import { clientTags, peopleTags } from '@shared/schema';
   import { eq } from 'drizzle-orm';
   import type { ClientTag, InsertClientTag, PeopleTag, InsertPeopleTag } from '@shared/schema';

   export class TagStorage extends BaseStorage {
     // Client Tags CRUD
     async getAllClientTags() { ... }
     async getClientTagById(id: string) { ... }
     // ... etc
     
     // People Tags CRUD
     async getAllPeopleTags() { ... }
     async getPeopleTagById(id: string) { ... }
     // ... etc
   }
   ```

2. **Create** `server/storage/tags/index.ts`:
   ```typescript
   export { TagStorage } from './tagStorage.js';
   ```

3. **Copy method implementations** from `server/storage.ts` to TagStorage
4. **Verify** all methods are self-contained (no cross-domain dependencies)

### Step 2: Create CommunicationStorage Module

1. **Create** `server/storage/communications/communicationStorage.ts`:
   ```typescript
   import { BaseStorage } from '../base/BaseStorage.js';
   import { db } from '../../db.js';
   import { communications } from '@shared/schema';
   import { eq } from 'drizzle-orm';
   import type { Communication, InsertCommunication } from '@shared/schema';

   export class CommunicationStorage extends BaseStorage {
     async getAllCommunications() { ... }
     async getCommunicationById(id: string) { ... }
     async createCommunication(communication: InsertCommunication) { ... }
     async updateCommunication(id: string, communication: Partial<InsertCommunication>) { ... }
     async deleteCommunication(id: string) { ... }
   }
   ```

2. **Create** `server/storage/communications/index.ts`:
   ```typescript
   export { CommunicationStorage } from './communicationStorage.js';
   ```

3. **Copy method implementations** from `server/storage.ts`

### Step 3: Create ProjectSchedulingStorage Module

1. **Create** `server/storage/projects/projectSchedulingStorage.ts`:
   ```typescript
   import { BaseStorage } from '../base/BaseStorage.js';
   import { db } from '../../db.js';
   import { projectSchedulingHistory, schedulingRunLogs } from '@shared/schema';
   import { eq } from 'drizzle-orm';
   import type { ProjectSchedulingHistory, InsertProjectSchedulingHistory, SchedulingRunLog, InsertSchedulingRunLog } from '@shared/schema';

   export class ProjectSchedulingStorage extends BaseStorage {
     // Scheduling History
     async getAllProjectSchedulingHistory() { ... }
     async getProjectSchedulingHistoryByProjectId(projectId: string) { ... }
     async createProjectSchedulingHistory(history: InsertProjectSchedulingHistory) { ... }
     
     // Scheduling Run Logs
     async getAllSchedulingRunLogs() { ... }
     async createSchedulingRunLog(log: InsertSchedulingRunLog) { ... }
   }
   ```

2. **Update** `server/storage/projects/index.ts`:
   ```typescript
   export { ProjectStorage } from './projectStorage.js';
   export { ProjectChronologyStorage } from './projectChronologyStorage.js';
   export { ProjectTypesStorage } from './projectTypesStorage.js';
   export { ProjectStagesStorage } from './projectStagesStorage.js';
   export { ProjectApprovalsStorage } from './projectApprovalsStorage.js';
   export { ProjectSchedulingStorage } from './projectSchedulingStorage.js'; // NEW
   
   // Export existing helpers
   export { getProjectTypeByName, validateStageReasonMapping, ... };
   ```

### Step 4: Update Facade (server/storage/index.ts)

1. **Import new storage classes** at top of file:
   ```typescript
   import { TagStorage } from './tags/index.js';
   import { CommunicationStorage } from './communications/index.js';
   import { ProjectSchedulingStorage } from './projects/index.js';
   ```

2. **Add private properties** to DatabaseStorage class:
   ```typescript
   private tagStorage: TagStorage;
   private communicationStorage: CommunicationStorage;
   private projectSchedulingStorage: ProjectSchedulingStorage;
   ```

3. **Instantiate in constructor**:
   ```typescript
   constructor() {
     // ... existing instantiations ...
     this.tagStorage = new TagStorage();
     this.communicationStorage = new CommunicationStorage();
     this.projectSchedulingStorage = new ProjectSchedulingStorage();
     
     // Register helpers if needed (Stage 7 modules are self-contained)
   }
   ```

4. **Add delegation methods** for all ~20 methods:
   ```typescript
   // ============================================================================
   // TAGS DOMAIN - Delegated to TagStorage
   // ============================================================================
   
   // Client Tags
   async getAllClientTags() {
     return this.tagStorage.getAllClientTags();
   }
   
   async getClientTagById(id: string) {
     return this.tagStorage.getClientTagById(id);
   }
   // ... etc for all 12 tag methods
   
   // ============================================================================
   // COMMUNICATIONS DOMAIN - Delegated to CommunicationStorage
   // ============================================================================
   
   async getAllCommunications() {
     return this.communicationStorage.getAllCommunications();
   }
   // ... etc for all 5 communication methods
   
   // ============================================================================
   // PROJECT SCHEDULING DOMAIN - Delegated to ProjectSchedulingStorage
   // ============================================================================
   
   async getAllProjectSchedulingHistory() {
     return this.projectSchedulingStorage.getAllProjectSchedulingHistory();
   }
   // ... etc for all 5 scheduling methods
   ```

### Step 5: Verification

1. **Count delegation methods:**
   ```bash
   # Should see ~20 new delegation methods in facade
   grep -c "async get.*Tag\|async create.*Tag\|async update.*Tag\|async delete.*Tag" server/storage/index.ts
   grep -c "async get.*Communication\|async create.*Communication" server/storage/index.ts
   grep -c "async get.*Scheduling\|async create.*Scheduling" server/storage/index.ts
   ```

2. **Check TypeScript compilation:**
   ```bash
   # Should have 0 errors related to Stage 7 methods
   npm run typecheck
   ```

3. **Restart server and verify boot:**
   ```bash
   # Server should boot cleanly with no errors
   # All cron jobs should initialize
   # No missing method errors
   ```

---

## Testing Requirements

### Backend Verification
- [ ] Server boots successfully with no compilation errors
- [ ] All schema migrations pass
- [ ] All cron jobs initialize successfully
- [ ] No runtime errors in logs

### API Endpoint Testing (Manual)
Since Stage 7 methods are primarily supporting/admin functions, testing via browser is optional. Focus on backend verification:

- [ ] Test tag endpoints:
  - `GET /api/client-tags` - Should return tags (or 401 if unauthenticated)
  - `GET /api/people-tags` - Should return tags (or 401 if unauthenticated)

- [ ] Test communications endpoints:
  - `GET /api/communications` - Should return communications (or 401 if unauthenticated)

- [ ] Test scheduling history endpoints:
  - `GET /api/project-scheduling-history` - Should return history (or 401 if unauthenticated)

### Browser Testing (Optional for Stage 7)
Stage 7 methods are primarily backend/admin features that don't have direct UI workflows. Browser testing is optional but can verify that existing features still work:

**Optional Test Plan:**
1. Login as admin
2. Navigate to clients page
3. Verify client tags are displayed (if UI shows tags)
4. Navigate to people page
5. Verify people tags are displayed (if UI shows tags)
6. Verify no console errors related to tag/communication/scheduling methods

---

## Success Criteria

### Code Quality
- ✅ All ~20 methods extracted into 3 focused modules
- ✅ TagStorage: ~12 methods (~250 lines)
- ✅ CommunicationStorage: ~5 methods (~100 lines)
- ✅ ProjectSchedulingStorage: ~5 methods (~150 lines)
- ✅ All methods delegated in facade
- ✅ No cross-domain dependencies (Stage 7 modules are self-contained)
- ✅ Clean TypeScript compilation (0 LSP errors from Stage 7)
- ✅ Backward compatibility maintained

### Runtime Verification
- ✅ Server boots cleanly with no errors
- ✅ All migrations pass
- ✅ All cron jobs initialize
- ✅ API endpoints respond correctly (200 or 401)

### Documentation
- ✅ Update `refactor_storage.md` with Stage 7 completion
- ✅ Document any issues encountered
- ✅ Update method count (200 → ~220 methods)
- ✅ Mark Stage 7 as complete

### Architect Review
- ✅ Call architect tool with Stage 7 summary
- ✅ Include git diff showing extracted methods
- ✅ Verify PASS rating before marking complete

---

## Common Pitfalls to Avoid

1. **Don't add cross-domain helpers** - Stage 7 modules should be self-contained
2. **Don't skip verification** - Always count delegation methods and test server boot
3. **Don't forget index files** - Create `index.ts` for tags and communications domains
4. **Don't modify method signatures** - Keep exact same signatures as in storage.ts
5. **Don't delete from storage.ts yet** - Keep old methods until after architect review

---

## After Stage 7

### Progress Check
- **Stages Complete:** 0-7 (Foundation through Tags/Comms/Scheduling)
- **Methods Extracted:** ~220 methods
- **Remaining Stages:** 8-15 (Integrations, Documents, Messages, Requests, Tasks, Notifications, Settings, Final Cleanup)

### Next Stage
**Stage 8:** Integrations Domain (OAuth, push notifications, email)
- Estimated time: 5-6 hours
- Risk level: MEDIUM (external integrations)
- Dependencies: Stage 1 (Users) complete

---

## Quick Reference

### Method Count by Domain (Stage 7)
- Client Tags: 6 methods
- People Tags: 6 methods
- Communications: 5 methods
- Project Scheduling History: 3 methods
- Scheduling Run Logs: 2 methods
- **Total:** ~22 methods

### Files Created
1. `server/storage/tags/tagStorage.ts`
2. `server/storage/tags/index.ts`
3. `server/storage/communications/communicationStorage.ts`
4. `server/storage/communications/index.ts`
5. `server/storage/projects/projectSchedulingStorage.ts` (add to existing directory)

### Files Updated
1. `server/storage/projects/index.ts` (add ProjectSchedulingStorage export)
2. `server/storage/index.ts` (facade - add instantiation and ~22 delegations)
3. `refactor_storage.md` (mark Stage 7 complete)

---

## Helpful Commands

```bash
# Count tag methods in storage.ts
grep -n "async.*ClientTag\|async.*PeopleTag" server/storage.ts

# Count communication methods
grep -n "async.*Communication" server/storage.ts

# Count scheduling methods
grep -n "async.*SchedulingHistory\|async.*SchedulingRunLog" server/storage.ts

# Verify server boots
npm run dev

# Check LSP errors
# Use get_latest_lsp_diagnostics tool

# Test API endpoints (requires authentication)
curl http://localhost:5000/api/client-tags
curl http://localhost:5000/api/communications
curl http://localhost:5000/api/project-scheduling-history
```

---

## Remember

- **Login:** `admin@example.com` / `admin123` (Password tab on root page)
- **Testing:** Backend verification is sufficient for Stage 7 (browser testing optional)
- **Low Risk:** Stage 7 is LOW risk - these are self-contained supporting domains
- **No Helpers:** Stage 7 modules don't need cross-domain helper injection
- **Architect Review:** Required before marking Stage 7 complete
