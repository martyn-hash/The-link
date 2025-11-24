# Storage.ts Refactoring Plan - Stage by Stage

## Testing Notes
**IMPORTANT**: When running browser tests:
1. Login via root page (/) → password tab → use credentials: `admin@example.com` | `admin123`
2. **Known Bug**: Projects page sometimes doesn't load properly. If this happens:
   - Refresh the browser
   - Restart the test from the beginning
3. Always check these notes before starting any browser testing session

**Magic Link Testing Approach:**
- Since we cannot access emails during testing, verify magic links by:
  1. Checking database for magic link token creation
  2. Extracting the token/code directly from the database
  3. Verifying token expiry and usage tracking
- For normal authentication testing, always use password-based login with the credentials above

## Progress Tracking

### Stage 0: Foundation (✅ COMPLETED)
- Created infrastructure with 15 domain subdirectories
- Created base types file
- Implemented facade pattern with wildcard re-export
- Migrated all 28 imports to use facade pattern

### Stage 1: Users Domain (✅ COMPLETED - November 24, 2025)
- **Extracted:** 31 methods into UserStorage (28) and UserActivityStorage (3)
- **Pattern:** Delegation pattern with composite DatabaseStorage
- **Testing:** Login/logout, sessions, activity tracking all verified working
- **Architect Approval:** Received - all user operations work seamlessly through delegation
- **Completed Actions:** 
  1. ✅ Added comprehensive unit tests for magic-link and login-attempt flows (userStorage.test.ts)
  2. ✅ Documented cross-domain helper injection pattern (CROSS_DOMAIN_PATTERN.md)
  3. ✅ Updated testing notes with magic link database verification approach
- **Ready for:** Stage 2 (Clients domain) can now proceed

## Executive Summary

This document provides a detailed, stage-by-stage plan for refactoring `server/storage.ts` (13,648 lines) into a modular, domain-driven architecture. The refactoring will break down this monolithic file into ~15 focused domain modules, each handling 500-1,000 lines of related functionality.

**Key Principles:**
- **Incremental & Safe**: Each stage maintains full backward compatibility
- **Independently Testable**: Every stage includes specific test requirements
- **Focused Scope**: Each stage handles one domain completely
- **Review Points**: Mandatory architect review before proceeding
- **Zero Downtime**: Application remains functional throughout

---

## Current State Analysis

**File:** `server/storage.ts` (13,648 lines)

**Structure:**
- `IStorage` interface (line 341): Defines ~300+ methods
- `DatabaseStorage` class (line 1162): Implements all methods
- Clear domain sections marked with comments
- Shared types and imports at the top

**Major Domains Identified:**
1. Users (sessions, auth, activity tracking)
2. Clients (CRUD, Companies House, search)
3. People (CRUD, client-people relationships)
4. Projects (CRUD, types, stages, chronology, approvals)
5. Services (CRUD, work roles, assignments)
6. Tags (client tags, people tags)
7. Communications
8. Integrations (OAuth, push notifications, email)
9. Documents (folders, documents, risk assessments)
10. Portal (client portal users, sessions)
11. Messages (threads, project messages, staff messages)
12. Requests (templates, custom requests)
13. Tasks (instances, internal tasks, connections)
14. Notifications (templates, scheduling, history)
15. Settings (company settings, preferences)

---

## Target Architecture

```
server/storage/
├── index.ts                          # Main aggregator & IStorage interface
├── base/
│   └── types.ts                      # Shared types and utilities
├── users/
│   ├── userStorage.ts                # User CRUD, sessions, login attempts
│   └── userActivityStorage.ts        # Activity tracking & analytics
├── clients/
│   ├── clientStorage.ts              # Client CRUD operations
│   ├── companiesHouseStorage.ts      # Companies House integration
│   └── searchStorage.ts              # Super search functionality
├── people/
│   ├── peopleStorage.ts              # People CRUD operations
│   └── clientPeopleStorage.ts        # Client-people relationships
├── projects/
│   ├── projectStorage.ts             # Project CRUD operations
│   ├── projectTypesStorage.ts        # Project types configuration
│   ├── projectStagesStorage.ts       # Kanban stages & change reasons
│   ├── projectApprovalsStorage.ts    # Stage approvals & fields
│   └── projectChronologyStorage.ts   # Project & client chronology
├── services/
│   ├── serviceStorage.ts             # Service CRUD operations
│   ├── workRoleStorage.ts            # Work roles management
│   └── serviceAssignmentStorage.ts   # Client & people service assignments
├── tags/
│   └── tagStorage.ts                 # Client & people tags
├── communications/
│   └── communicationStorage.ts       # Communications operations
├── integrations/
│   ├── integrationStorage.ts         # User integrations & OAuth
│   ├── pushNotificationStorage.ts    # Push subscriptions & templates
│   └── emailStorage.ts               # Email messages, threads, attachments
├── documents/
│   ├── documentStorage.ts            # Document folders & documents
│   ├── riskAssessmentStorage.ts      # Risk assessments
│   └── portalDocumentStorage.ts      # Portal document operations
├── portal/
│   └── portalStorage.ts              # Client portal users & sessions
├── messages/
│   ├── messageThreadStorage.ts       # Message threads & messages
│   ├── projectMessageStorage.ts      # Project-specific messages
│   └── staffMessageStorage.ts        # Staff messages
├── requests/
│   ├── requestTemplateStorage.ts     # Client request templates
│   └── customRequestStorage.ts       # Client custom requests
├── tasks/
│   ├── taskInstanceStorage.ts        # Task instances & responses
│   ├── internalTaskStorage.ts        # Internal tasks & operations
│   └── taskConnectionStorage.ts      # Task connections & relationships
├── notifications/
│   ├── notificationTemplateStorage.ts    # Notification templates
│   ├── scheduledNotificationStorage.ts   # Scheduled notifications
│   └── notificationHistoryStorage.ts     # Notification history
└── settings/
    ├── settingsStorage.ts            # Company settings & views
    └── preferencesStorage.ts         # User preferences & dashboards
```

---

## Critical Continuity Points

**IMPORTANT:** These architectural elements must remain stable and accessible throughout ALL stages (0-14) to ensure zero breaking changes.

### 1. IStorage Interface Management

**The Challenge:**  
The `IStorage` interface defines ~300+ methods. It must remain complete and accessible at all times, even as we extract methods into separate modules.

**The Solution:**

**Stages 0-14 (During Migration):**
```typescript
// OLD: server/storage.ts
export interface IStorage {
  // ALL ~300+ methods remain defined here
  getUser(id: string): Promise<User | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  // ... all other methods
}

export class DatabaseStorage implements IStorage {
  // Implementation (will remain here until Stage 15)
}
```

```typescript
// NEW: server/storage/index.ts (facade pattern)
import { IStorage, DatabaseStorage as OldDatabaseStorage } from '../storage';
import { UserStorage } from './users/userStorage';

// Re-export the interface (critical!)
export { IStorage };

// Create composite storage that delegates to both old and new
export class DatabaseStorage implements IStorage {
  private oldStorage: OldDatabaseStorage;
  private userStorage: UserStorage;
  // ... other module storage instances
  
  constructor() {
    this.oldStorage = new OldDatabaseStorage();
    this.userStorage = new UserStorage();
  }
  
  // Delegate user methods to new UserStorage
  async getUser(id: string) {
    return this.userStorage.getUser(id);
  }
  
  // Delegate all non-migrated methods to old storage
  async createClient(client: InsertClient) {
    return this.oldStorage.createClient(client);
  }
  
  // ... gradually replace old delegation with new modules
}
```

**Stage 15 (Final Cleanup):**
```typescript
// NEW: server/storage/base/IStorage.ts
export interface IStorage {
  // Full interface moved here
}

// NEW: server/storage/index.ts (final state)
export { IStorage } from './base/IStorage';

export class DatabaseStorage implements IStorage {
  // No more oldStorage - all methods delegated to domain modules
  private userStorage: UserStorage;
  private clientStorage: ClientStorage;
  // ... all domain modules
}
```

**Result:**  
External code using `import { IStorage, DatabaseStorage } from './storage'` works identically throughout all stages.

### 2. Database Connection Consistency

**The Guarantee:**  
All storage modules (old and new) use the same database connection.

```typescript
// Every storage module imports the same db instance
import { db } from "../../db";  // or appropriate relative path

export class UserStorage {
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
}
```

**No changes to:**
- `server/db.ts` - Database connection setup
- `drizzle.config.ts` - Drizzle configuration
- Connection pooling or transaction logic

### 3. Schema Imports

**The Guarantee:**  
All modules import types directly from `@shared/schema` - no intermediate layers.

```typescript
// Each storage module imports only what it needs
import {
  users,
  userSessions,
  loginAttempts,
  type User,
  type InsertUser,
  type UserSession,
} from "@shared/schema";
```

**Benefits:**
- Changes to schema automatically propagate to all modules
- No duplicate type definitions
- TypeScript catches type mismatches immediately
- Each module is self-contained

### 4. Type Safety Throughout Migration

**The Guarantee:**  
TypeScript compilation succeeds after every stage.

**Enforcement:**
- [ ] After each stage, run `npm run build` or `tsc --noEmit`
- [ ] Fix any TypeScript errors before proceeding
- [ ] Verify all method signatures match the IStorage interface exactly
- [ ] Ensure no `any` types introduced during extraction

### 5. Route/Consumer Code Stability

**The Guarantee:**  
All routes and services continue to work without modification.

**Before refactoring (current state):**
```typescript
// server/routes/auth.ts
import { IStorage, DatabaseStorage } from '../storage';

const storage: IStorage = new DatabaseStorage();

app.post('/login', async (req, res) => {
  const user = await storage.getUserByEmail(req.body.email);
  // ... rest of login logic
});
```

**After Stage 0:**
```typescript
// server/routes/auth.ts
import { IStorage, DatabaseStorage } from '../storage/index';  // Updated import path

const storage: IStorage = new DatabaseStorage();  // Same usage!

app.post('/login', async (req, res) => {
  const user = await storage.getUserByEmail(req.body.email);  // Same method call!
  // ... rest of login logic
});
```

**After Stage 1 (Users extracted):**
```typescript
// Still identical! The delegation pattern makes it transparent
const storage: IStorage = new DatabaseStorage();
const user = await storage.getUserByEmail(req.body.email);  // Now calls UserStorage internally
```

**After Stage 15 (Complete):**
```typescript
// STILL identical! Zero changes to route code
const storage: IStorage = new DatabaseStorage();
const user = await storage.getUserByEmail(req.body.email);
```

**Result:**  
Routes never need to know about the internal refactoring. The `IStorage` interface contract remains stable.

---

## Refactoring Stages

### **STAGE 0: Foundation Setup** ✅ **COMPLETED**
**Estimated Time:** 2-3 hours  
**Risk Level:** LOW  
**Status:** ✅ **COMPLETED** (November 23, 2025)

> **📌 Critical:** Review the "Critical Continuity Points" section above before starting. This stage establishes the foundation for maintaining backward compatibility throughout the entire refactoring.

**Completion Notes:**
- ✅ Created complete directory structure under `server/storage/` with 15 domain subdirectories
- ✅ Created `server/storage/base/types.ts` with shared type exports
- ✅ Implemented facade pattern at `server/storage/index.ts` using wildcard re-export (`export * from '../storage.js'`)
- ✅ Updated ALL 28 import statements across codebase (16 route files + 12 server files)
- ✅ Full smoke tests passed: login, clients, projects, API endpoints all working
- ✅ Application fully functional with facade pattern actively in use

#### Objectives:
1. Create the `server/storage/` directory structure
2. Create `server/storage/base/types.ts` with shared types and utilities
3. Create `server/storage/index.ts` as the main aggregator (facade pattern)
4. Update all imports throughout the codebase to use `./storage/index` instead of `./storage`
5. **CRITICAL:** Establish the IStorage interface re-export pattern that will maintain compatibility through all stages

#### Detailed Steps:
1. **Create Directory Structure:**
   ```bash
   mkdir -p server/storage/{base,users,clients,people,projects,services,tags,communications,integrations,documents,portal,messages,requests,tasks,notifications,settings}
   ```

2. **Create `server/storage/base/types.ts`:**
   - Extract common types from storage.ts:
     - `ScheduledServiceView`
     - `SearchResult`
     - `SuperSearchResults`
     - `ProjectWithRelations`
     - `UpdateProjectStatus`
     - `UpdateProjectType`
     - `StageChangeNotificationPreview`
   - Export all shared utility types

3. **Create `server/storage/index.ts`:**
   
   **CRITICAL:** This file establishes the facade pattern that enables safe incremental migration.
   
   ```typescript
   // ============================================================================
   // STAGE 0: Foundation - Simple re-export (temporary)
   // ============================================================================
   // This is a temporary facade that maintains compatibility while we build
   // the new modular structure. It will evolve through stages 1-14 and be
   // finalized in stage 15.
   
   // IMPORTANT: The IStorage interface MUST be re-exported at all times
   // This ensures routes/services can continue using the same import:
   // import { IStorage, DatabaseStorage } from './storage'
   export { IStorage, DatabaseStorage } from '../storage';
   
   // Export shared types (new modular architecture)
   export * from './base/types';
   
   // ============================================================================
   // EVOLUTION ACROSS STAGES:
   // ============================================================================
   // Stage 1+: Import new domain storage classes and create composite DatabaseStorage
   // Stage 15: Move IStorage to ./base/IStorage.ts and fully remove old storage.ts
   // ============================================================================
   ```
   
   **Why this works:**
   - All existing code imports from `./storage` → we update to `./storage/index`
   - The IStorage interface remains accessible with the same import path
   - DatabaseStorage continues to work (initially as a pass-through)
   - As we extract domains, we'll modify this file to delegate to new modules
   - External code never needs to change after Stage 0

4. **Update All Import Statements:**
   - Find all files importing from `./storage` or `../storage`:
     ```bash
     # Search for imports
     grep -r "from ['\"].*\/storage['\"]" server/routes/
     grep -r "from ['\"].*\/storage['\"]" server/*.ts
     ```
   - Update each to import from `./storage/index` or `../storage/index`:
     ```typescript
     // BEFORE:
     import { IStorage, DatabaseStorage } from '../storage';
     
     // AFTER:
     import { IStorage, DatabaseStorage } from '../storage/index';
     ```
   - Compile and test after each batch of updates
   - **CRITICAL:** Verify no imports still point directly to the old `../storage` path

#### Testing Requirements:
- [ ] Application compiles without TypeScript errors
- [ ] Application starts successfully
- [ ] All routes respond correctly
- [ ] No broken imports
- [ ] **CRITICAL:** Verify IStorage interface is accessible:
  ```typescript
  // This should compile without errors in any route file
  import { IStorage, DatabaseStorage } from './storage/index';
  const storage: IStorage = new DatabaseStorage();
  ```
- [ ] All existing storage method calls still work (e.g., `storage.getUser()`, `storage.createClient()`)
- [ ] Run a quick smoke test of key features (login, view clients, create project)

#### Review Point:
✅ **Architect Review Required**
- Verify all imports are updated correctly to use `./storage/index`
- Confirm IStorage interface is re-exported and accessible
- Confirm no functionality is broken
- Check that directory structure matches plan
- Verify old `server/storage.ts` still exists and is untouched (we need it for stages 1-14)

#### Success Criteria:
- All imports updated to use new storage/index.ts
- IStorage interface accessible via the new path
- Application runs without errors
- Foundation ready for domain extraction
- Old storage.ts remains as source of truth (for now)

#### What Happens in Later Stages:
After Stage 0, the migration pattern for each domain (Stages 1-14) will be:
1. Create new domain storage class (e.g., `UserStorage`)
2. Update `server/storage/index.ts` to import the new class
3. Modify `DatabaseStorage` in index.ts to delegate methods to the new class
4. Methods gradually shift from old storage.ts to new modules
5. Old storage.ts continues to handle non-migrated methods
6. In Stage 15, we'll remove old storage.ts entirely

---

### **STAGE 1: Extract Users Domain**
**Estimated Time:** 4-6 hours  
**Risk Level:** MEDIUM (touches authentication)

#### Objectives:
Extract all user-related operations into dedicated modules while maintaining backward compatibility.

#### Files to Create:
1. `server/storage/users/userStorage.ts`
2. `server/storage/users/userActivityStorage.ts`
3. `server/storage/users/index.ts`

#### Detailed Steps:

**1. Create `server/storage/users/userStorage.ts`:**

Extract these methods from `DatabaseStorage`:
- User operations:
  - `getUser(id)`
  - `upsertUser(user)`
  - `getUserByEmail(email)`
  - `createUser(user)`
  - `updateUser(id, userData)`
  - `deleteUser(id)`
  - `getAllUsers()`
  - `getUsersByRole(role)`
  
- Admin operations:
  - `createAdminIfNone(user)`
  
- Impersonation operations:
  - `startImpersonation(adminUserId, targetUserId)`
  - `stopImpersonation(adminUserId)`
  - `getImpersonationState(adminUserId)`
  - `getEffectiveUser(adminUserId)`
  
- Session operations:
  - `createUserSession(session)`
  - `updateUserSessionActivity(userId)`
  - `getUserSessions(userId, options)`
  - `markSessionAsLoggedOut(sessionId)`
  - `cleanupOldSessions(daysToKeep)`
  - `markInactiveSessions()`
  
- Login attempt operations:
  - `createLoginAttempt(attempt)`
  - `getLoginAttempts(options)`
  - `cleanupOldLoginAttempts(daysToKeep)`
  
- Magic link operations:
  - `createMagicLinkToken(token)`
  - `getMagicLinkTokenByToken(token)`
  - `getMagicLinkTokenByCodeAndEmail(code, email)`
  - `markMagicLinkTokenAsUsed(id)`
  - `cleanupExpiredMagicLinkTokens()`
  - `getValidMagicLinkTokensForUser(userId)`

**Structure:**
```typescript
import { db } from "../../db";
import { eq, desc, and, or, lt, gte } from "drizzle-orm";
import bcrypt from "bcrypt";
import {
  users,
  userSessions,
  loginAttempts,
  magicLinkTokens,
  type User,
  type UpsertUser,
  // ... other imports
} from "@shared/schema";

export class UserStorage {
  // User CRUD methods
  async getUser(id: string): Promise<User | undefined> {
    // Implementation from DatabaseStorage
  }
  
  // ... all other user methods
}
```

**2. Create `server/storage/users/userActivityStorage.ts`:**

Extract these methods:
- `trackUserActivity(userId, entityType, entityId)`
- `getRecentlyViewedByUser(userId, limit)`
- `getUserActivityTracking(options)`

**Structure:**
```typescript
import { db } from "../../db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import {
  userActivityTracking,
  users,
  clients,
  people,
  projects,
  type UserActivityTracking,
  type User,
} from "@shared/schema";

export class UserActivityStorage {
  async trackUserActivity(userId: string, entityType: string, entityId: string): Promise<void> {
    // Implementation
  }
  
  // ... other activity methods
}
```

**3. Create `server/storage/users/index.ts`:**
```typescript
export { UserStorage } from './userStorage';
export { UserActivityStorage } from './userActivityStorage';
```

**4. Update `server/storage/index.ts`:**
```typescript
import { DatabaseStorage as OldDatabaseStorage } from '../storage';
import { UserStorage } from './users/userStorage';
import { UserActivityStorage } from './users/userActivityStorage';

// Create a composite storage class that uses both old and new implementations
export class DatabaseStorage implements IStorage {
  private oldStorage: OldDatabaseStorage;
  private userStorage: UserStorage;
  private userActivityStorage: UserActivityStorage;
  
  constructor() {
    this.oldStorage = new OldDatabaseStorage();
    this.userStorage = new UserStorage();
    this.userActivityStorage = new UserActivityStorage();
  }
  
  // User methods - delegate to new UserStorage
  async getUser(id: string) {
    return this.userStorage.getUser(id);
  }
  
  // Activity methods - delegate to new UserActivityStorage
  async trackUserActivity(userId: string, entityType: string, entityId: string) {
    return this.userActivityStorage.trackUserActivity(userId, entityType, entityId);
  }
  
  // All other methods - delegate to old storage (temporary)
  async createClient(client: InsertClient) {
    return this.oldStorage.createClient(client);
  }
  
  // ... etc
}

export { IStorage } from '../storage';
export * from './base/types';
```

#### Testing Requirements:
- [ ] **Unit Tests:** Create tests for `UserStorage` and `UserActivityStorage`
  - Test user CRUD operations
  - Test session management
  - Test login attempts
  - Test magic links
  - Test impersonation
  - Test activity tracking

- [ ] **Integration Tests:**
  - Test authentication flow end-to-end
  - Test user login/logout
  - Test session expiry
  - Test activity tracking on various actions

- [ ] **Playwright E2E Tests:**
  ```
  Test Plan:
  1. [New Context] Create a new browser context
  2. [Browser] Navigate to login page
  3. [Browser] Enter test user credentials
  4. [Browser] Click login button
  5. [Verify] Assert successful login and redirect to dashboard
  6. [API] Verify user session was created via /api/users/sessions endpoint
  7. [Browser] Navigate to clients page
  8. [API] Verify activity tracking recorded the page view
  9. [Browser] Click logout
  10. [Verify] Assert redirect to login page
  11. [API] Verify session was marked as logged out
  ```

#### Review Point:
✅ **Architect Review Required**
- Verify all user methods are correctly extracted
- Check that no user-related code remains in old storage.ts
- Confirm all tests pass
- Review code quality and patterns

#### Success Criteria:
- All user operations work through new UserStorage classes
- All tests pass
- No regression in authentication or session management
- Code is cleaner and more focused

---

### **STAGE 2: Extract Clients Domain** ✅ [COMPLETED]
**Estimated Time:** 4-6 hours  
**Actual Time:** ~8 hours (including transaction fixes)
**Risk Level:** MEDIUM

#### Objectives: [COMPLETED]
Extract all client-related operations including CRUD, Companies House integration, and search.

#### Files Created: [COMPLETED]
1. `server/storage/clients/clientStorage.ts` ✓
2. `server/storage/clients/companiesHouseStorage.ts` ✓
3. `server/storage/clients/searchStorage.ts` ✓
4. `server/storage/clients/index.ts` ✓

#### Implementation Summary: [COMPLETED]

**Extracted 31 methods into 3 domain classes:**
- **ClientStorage** (27 methods) - All client CRUD, relationships, chronology, tags, email aliases
- **CompaniesHouseStorage** (2 methods) - Companies House integration
- **SearchStorage** (1 method) - Super search functionality

**Known Limitation (Technical Debt):**
- Helper injection pattern doesn't support transaction propagation
- `convertIndividualToCompanyClient` maintains atomicity but bypasses some helper side effects
- To be addressed in Stage 15 with comprehensive transaction support

**Test Results:**
- ✅ All E2E tests pass
- ✅ Full backward compatibility maintained
- ✅ Application functions correctly

#### Detailed Steps: [COMPLETED]

**1. Created `server/storage/clients/clientStorage.ts`:**

Extracted these methods:
- `createClient(client)`
- `getClientById(id)`
- `getClientByName(name)`
- `getAllClients(search)`
- `updateClient(id, client)`
- `deleteClient(id)`

**2. Create `server/storage/clients/companiesHouseStorage.ts`:**

Extract these methods:
- `getClientByCompanyNumber(companyNumber)`
- `upsertClientFromCH(clientData)`
- `getAllChChangeRequests()`
- `getChChangeRequestById(id)`
- `createChChangeRequest(request)`
- `updateChChangeRequest(id, request)`
- `deleteChChangeRequest(id)`
- `applyChChangeRequest(id)`

**3. Create `server/storage/clients/searchStorage.ts`:**

Extract these methods:
- `superSearch(query, limit)`

**4. Update `server/storage/index.ts`:**
- Import new client storage classes
- Delegate all client methods to new classes
- Keep delegating other methods to old storage

#### Testing Requirements:
- [ ] **Unit Tests:** Test all client CRUD operations
- [ ] **Unit Tests:** Test Companies House sync operations
- [ ] **Unit Tests:** Test super search functionality

- [ ] **Playwright E2E Tests:**
  ```
  Test Plan:
  1. [New Context] Create a new browser context
  2. [OIDC] Configure login with admin user
  3. [Browser] Login and navigate to clients page
  4. [Browser] Click "Add Client" button
  5. [Browser] Fill in client form with random company name ${nanoid(8)}
  6. [Browser] Click save
  7. [Verify] Assert client appears in the list
  8. [Browser] Use search bar to search for the created client
  9. [Verify] Assert client is found in search results
  10. [Browser] Click on the client to view details
  11. [Verify] Assert client details are correct
  12. [Browser] Edit client name
  13. [Verify] Assert client name was updated
  ```

#### Review Point:
✅ **Architect Review Required**
- Verify client operations are correctly extracted
- Check Companies House integration still works
- Confirm search functionality is not degraded

#### Success Criteria:
- All client operations work through new classes
- Tests pass
- No regression in client management

---

### **STAGE 3: Extract People Domain**
**Estimated Time:** 4-5 hours  
**Risk Level:** MEDIUM

#### Implementation Summary: [COMPLETED]

**Extracted 15 methods into 2 domain classes:**
- **PeopleStorage** (10 methods) - People CRUD, portal status, CH sync, duplicate detection
- **ClientPeopleStorage** (5 methods) - Client-people relationship CRUD

**Important Notes:**
- `linkPersonToClient`, `unlinkPersonFromClient`, `convertIndividualToCompanyClient`, and `getClientWithPeople` were already extracted to ClientStorage in Stage 2
- These methods remain in ClientStorage for backward compatibility and semantic cohesion

**Test Results:**
- ✅ All E2E tests pass
- ✅ Person creation via UI works correctly
- ✅ All API endpoints functional (GET /api/people, GET /api/people/:id, GET /api/client-people)
- ✅ Full backward compatibility maintained
- ✅ Application functions correctly

#### Objectives:
Extract all people-related operations and client-people relationships.

#### Files to Create:
1. `server/storage/people/peopleStorage.ts`
2. `server/storage/people/clientPeopleStorage.ts`
3. `server/storage/people/index.ts`

#### Detailed Steps:

**1. Create `server/storage/people/peopleStorage.ts`:**

Extract these methods:
- `createPerson(person)`
- `getPersonById(id)`
- `getPersonByPersonNumber(personNumber)`
- `getAllPeople()`
- `getAllPeopleWithPortalStatus()`
- `getPersonWithDetails(id)`
- `updatePerson(id, person)`
- `deletePerson(id)`
- `upsertPersonFromCH(personData)`
- `findPeopleByNameAndBirthDate(firstName, lastName, year, month)`

**2. Create `server/storage/people/clientPeopleStorage.ts`:**

Extract these methods:
- `createClientPerson(relationship)`
- `getClientPeopleByClientId(clientId)`
- `getClientPeopleByPersonId(personId)`
- `updateClientPerson(id, relationship)`
- `deleteClientPerson(id)`
- `linkPersonToClient(clientId, personId, officerRole, isPrimaryContact)`
- `unlinkPersonFromClient(clientId, personId)`
- `convertIndividualToCompanyClient(personId, companyData, oldIndividualClientId)`

**3. Update `server/storage/index.ts`:**
- Import people storage classes
- Delegate people methods to new classes

#### Testing Requirements:
- [ ] **Unit Tests:** Test people CRUD
- [ ] **Unit Tests:** Test client-people relationships
- [ ] **Playwright E2E Tests:**
  ```
  Test Plan:
  1. [New Context] Create a new browser context
  2. [OIDC] Configure login
  3. [Browser] Navigate to people page
  4. [Browser] Create a new person with random name
  5. [Verify] Person is created
  6. [Browser] Link person to a client
  7. [Verify] Relationship is created
  8. [Browser] View person details
  9. [Verify] Client relationship is shown
  ```

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- People operations work correctly
- Client-people relationships maintained
- All tests pass

---

### **STAGE 4: Extract Projects Domain (Part 1 - Core)**
**Estimated Time:** 6-8 hours  
**Risk Level:** HIGH (core business logic)

#### Objectives:
Extract core project operations and chronology tracking.

#### Files to Create:
1. `server/storage/projects/projectStorage.ts`
2. `server/storage/projects/projectChronologyStorage.ts`
3. `server/storage/projects/index.ts`

#### Detailed Steps:

**1. Create `server/storage/projects/projectStorage.ts`:**

Extract these methods:
- `createProject(project)`
- `getAllProjects(filters)`
- `getProjectsByUser(userId, role, filters)`
- `getProjectsByClient(clientId, filters)`
- `getProjectsByClientServiceId(clientServiceId)`
- `getProject(id)`
- `updateProject(id, project)`
- `updateProjectStatus(update, userId)`
- `getActiveProjectsByClientAndType(clientId, projectTypeId)`
- `getUniqueDueDatesForService(serviceId)`
- `getProjectAnalytics(filters, groupBy, metric)`
- `createProjectsFromCSV(projectsData)`
- `sendBulkProjectAssignmentNotifications(createdProjects)`

**2. Create `server/storage/projects/projectChronologyStorage.ts`:**

Extract these methods:
- `createChronologyEntry(entry)`
- `getProjectChronology(projectId)`
- `createClientChronologyEntry(entry)`
- `getClientChronology(clientId)`
- `getMostRecentStageChange(projectId)`
- `getProjectProgressMetrics(projectId)`

**3. Update `server/storage/index.ts`:**
- Import project storage classes
- Delegate project methods

#### Testing Requirements:
- [ ] **Unit Tests:** Test project CRUD
- [ ] **Unit Tests:** Test chronology tracking
- [ ] **Unit Tests:** Test filters and analytics
- [ ] **Playwright E2E Tests:**
  ```
  Test Plan:
  1. [New Context] Create browser context
  2. [OIDC] Login as admin
  3. [Browser] Navigate to projects page
  4. [Browser] Create new project
  5. [Verify] Project appears in list
  6. [Browser] Change project status
  7. [Verify] Chronology entry created
  8. [Browser] View project details
  9. [Verify] Chronology shows status change
  10. [API] Test project analytics endpoint
  ```

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Project operations work correctly
- Chronology tracking maintained
- Analytics still functional

---

### **STAGE 5: Extract Projects Domain (Part 2 - Configuration)**
**Estimated Time:** 6-8 hours  
**Risk Level:** HIGH

#### Objectives:
Extract project types, stages, change reasons, and approvals.

#### Files to Create:
1. `server/storage/projects/projectTypesStorage.ts`
2. `server/storage/projects/projectStagesStorage.ts`
3. `server/storage/projects/projectApprovalsStorage.ts`

#### Detailed Steps:

**1. Create `server/storage/projects/projectTypesStorage.ts`:**

Extract project type methods:
- `getAllProjectTypes()`
- `getProjectTypeById(id)`
- `createProjectType(projectType)`
- `updateProjectType(id, projectType)`
- `deleteProjectType(id)`
- `getProjectTypeByName(name)`
- `countActiveProjectsUsingProjectType(projectTypeId)`
- `getProjectTypeDependencySummary(projectTypeId)`
- `forceDeleteProjectType(projectTypeId, confirmName)`

**2. Create `server/storage/projects/projectStagesStorage.ts`:**

Extract stage and reason methods:
- Kanban stages:
  - `getAllKanbanStages()`
  - `getKanbanStagesByProjectTypeId(projectTypeId)`
  - `getKanbanStagesByServiceId(serviceId)`
  - `createKanbanStage(stage)`
  - `updateKanbanStage(id, stage)`
  - `deleteKanbanStage(id)`
  
- Stage validation:
  - `isStageNameInUse(stageName)`
  - `getStageById(id)`
  - `validateStageCanBeDeleted(id)`
  - `validateStageCanBeRenamed(id, newName)`
  - `validateProjectStatus(status)`
  - `getDefaultStage()`
  
- Change reasons:
  - `getAllChangeReasons()`
  - `getChangeReasonsByProjectTypeId(projectTypeId)`
  - `createChangeReason(reason)`
  - `updateChangeReason(id, reason)`
  - `deleteChangeReason(id)`
  
- Stage-reason mappings:
  - `getAllStageReasonMaps()`
  - `createStageReasonMap(mapping)`
  - `getStageReasonMapsByStageId(stageId)`
  - `deleteStageReasonMap(id)`
  - `validateStageReasonMapping(stageId, reasonId)`
  - `getValidChangeReasonsForStage(stageId)`
  
- Custom fields:
  - `getAllReasonCustomFields()`
  - `getReasonCustomFieldsByReasonId(reasonId)`
  - `createReasonCustomField(field)`
  - `updateReasonCustomField(id, field)`
  - `deleteReasonCustomField(id)`
  - `validateRequiredFields(reasonId, fieldResponses)`
  
- Field responses:
  - `createReasonFieldResponse(response)`
  - `getReasonFieldResponsesByChronologyId(chronologyId)`

**3. Create `server/storage/projects/projectApprovalsStorage.ts`:**

Extract approval methods:
- `getAllStageApprovals()`
- `getStageApprovalsByProjectTypeId(projectTypeId)`
- `createStageApproval(approval)`
- `updateStageApproval(id, approval)`
- `deleteStageApproval(id)`
- `getStageApprovalById(id)`
- `getAllStageApprovalFields()`
- `getStageApprovalFieldsByApprovalId(approvalId)`
- `createStageApprovalField(field)`
- `updateStageApprovalField(id, field)`
- `deleteStageApprovalField(id)`
- `createStageApprovalResponse(response)`
- `upsertStageApprovalResponse(response)`
- `getStageApprovalResponsesByProjectId(projectId)`
- `validateStageApprovalResponses(approvalId, responses)`

#### Testing Requirements:
- [ ] **Unit Tests:** Test project type CRUD
- [ ] **Unit Tests:** Test stage management
- [ ] **Unit Tests:** Test approvals
- [ ] **Playwright E2E Tests:**
  ```
  Test Plan:
  1. [New Context] Browser context
  2. [OIDC] Login as admin
  3. [Browser] Navigate to project types
  4. [Browser] Create new project type
  5. [Browser] Add kanban stages
  6. [Browser] Configure change reasons
  7. [Verify] Configuration saved correctly
  8. [Browser] Create project using new type
  9. [Verify] Project has correct stages
  ```

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Project configuration works
- Stage management functional
- Approvals working correctly

---

### **STAGE 6: Extract Services Domain**
**Estimated Time:** 5-6 hours  
**Risk Level:** MEDIUM

#### Objectives:
Extract services, work roles, and service assignments.

#### Files to Create:
1. `server/storage/services/serviceStorage.ts`
2. `server/storage/services/workRoleStorage.ts`
3. `server/storage/services/serviceAssignmentStorage.ts`
4. `server/storage/services/index.ts`

#### Detailed Steps:

**1. Create `server/storage/services/serviceStorage.ts`:**

Extract service methods:
- `getAllServices()`
- `getActiveServices()`
- `getServicesWithActiveClients()`
- `getClientAssignableServices()`
- `getProjectTypeAssignableServices()`
- `getServiceById(id)`
- `getServiceByName(name)`
- `getScheduledServices()`
- `createService(service)`
- `updateService(id, service)`
- `deleteService(id)`
- `getServiceByProjectTypeId(projectTypeId)`

**2. Create `server/storage/services/workRoleStorage.ts`:**

Extract work role methods:
- `getAllWorkRoles()`
- `getWorkRoleById(id)`
- `getWorkRoleByName(name)`
- `createWorkRole(role)`
- `updateWorkRole(id, role)`
- `deleteWorkRole(id)`
- `getServiceRolesByServiceId(serviceId)`
- `getWorkRolesByServiceId(serviceId)`
- `addRoleToService(serviceId, roleId)`
- `removeRoleFromService(serviceId, roleId)`

**3. Create `server/storage/services/serviceAssignmentStorage.ts`:**

Extract assignment methods:
- Client service assignments:
  - `getAllClientServices()`
  - `getClientServiceById(id)`
  - `getClientServicesByClientId(clientId)`
  - `getClientServicesByServiceId(serviceId)`
  - `createClientService(clientService)`
  - `updateClientService(id, clientService)`
  - `deleteClientService(id)`
  
- Client service role assignments:
  - `getAllClientServiceRoleAssignments()`
  - `getClientServiceRoleAssignmentsByClientServiceId(clientServiceId)`
  - `createClientServiceRoleAssignment(assignment)`
  - `updateClientServiceRoleAssignment(id, assignment)`
  - `deleteClientServiceRoleAssignment(id)`
  - `resolveRoleAssignmentsForProject(clientServiceId, roleId)`
  
- People service assignments:
  - `getAllPeopleServices()`
  - `getPeopleServicesByPersonId(personId)`
  - `getPeopleServicesByServiceId(serviceId)`
  - `createPeopleService(peopleService)`
  - `updatePeopleService(id, peopleService)`
  - `deletePeopleService(id)`
  - `resolveServiceOwnerForPerson(serviceId, personId)`

#### Testing Requirements:
- [ ] **Unit Tests:** Test service CRUD
- [ ] **Unit Tests:** Test work role management
- [ ] **Unit Tests:** Test assignments
- [ ] **Playwright E2E Tests:**
  ```
  Test Plan:
  1. [New Context] Browser context
  2. [OIDC] Login
  3. [Browser] Navigate to services page
  4. [Browser] Create new service
  5. [Browser] Assign work roles
  6. [Browser] Assign service to client
  7. [Verify] Assignment saved
  8. [Browser] View client services
  9. [Verify] Service appears correctly
  ```

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Service management works
- Role assignments functional
- Client/people service links maintained

---

### **STAGE 7: Extract Tags, Communications, & Scheduling**
**Estimated Time:** 3-4 hours  
**Risk Level:** LOW

#### Objectives:
Extract supporting domains: tags, communications, and project scheduling.

#### Files to Create:
1. `server/storage/tags/tagStorage.ts`
2. `server/storage/communications/communicationStorage.ts`
3. `server/storage/projects/projectSchedulingStorage.ts`

#### Detailed Steps:

**1. Create `server/storage/tags/tagStorage.ts`:**
- Client tags & people tags CRUD
- Tag assignment operations

**2. Create `server/storage/communications/communicationStorage.ts`:**
- Communications CRUD operations

**3. Create `server/storage/projects/projectSchedulingStorage.ts`:**
- `getAllProjectSchedulingHistory()`
- `getProjectSchedulingHistoryByProjectId(projectId)`
- `createProjectSchedulingHistory(history)`
- `getAllSchedulingRunLogs()`
- `createSchedulingRunLog(log)`

#### Testing Requirements:
- [ ] **Unit Tests:** Test tag operations
- [ ] **Unit Tests:** Test communications
- [ ] **Unit Tests:** Test scheduling history
- [ ] **Manual Testing:** Verify tags work on clients/people

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Tags work correctly
- Communications tracked
- Scheduling history maintained

---

### **STAGE 8: Extract Integrations Domain**
**Estimated Time:** 5-6 hours  
**Risk Level:** MEDIUM (external integrations)

#### Objectives:
Extract integration-related storage: OAuth, push notifications, email.

#### Files to Create:
1. `server/storage/integrations/integrationStorage.ts`
2. `server/storage/integrations/pushNotificationStorage.ts`
3. `server/storage/integrations/emailStorage.ts`
4. `server/storage/integrations/index.ts`

#### Detailed Steps:

**1. Create `server/storage/integrations/integrationStorage.ts`:**
- User integrations CRUD
- OAuth account operations

**2. Create `server/storage/integrations/pushNotificationStorage.ts`:**
- Push subscription operations
- Push notification template operations
- Notification icon operations

**3. Create `server/storage/integrations/emailStorage.ts`:**
- Graph webhook subscription operations
- Graph sync state operations
- Email message operations
- Mailbox message mapping operations
- Email thread operations
- Client email alias operations
- Unmatched email operations
- Client domain allowlist operations
- Email attachment operations

#### Testing Requirements:
- [ ] **Unit Tests:** Test integration storage
- [ ] **Unit Tests:** Test push notifications
- [ ] **Unit Tests:** Test email operations
- [ ] **Manual Testing:** Verify integrations still work

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Integrations functional
- Email sync works
- Push notifications operational

---

### **STAGE 9: Extract Documents & Portal Domain**
**Estimated Time:** 4-5 hours  
**Risk Level:** MEDIUM

#### Objectives:
Extract document management and portal operations.

#### Files to Create:
1. `server/storage/documents/documentStorage.ts`
2. `server/storage/documents/riskAssessmentStorage.ts`
3. `server/storage/documents/portalDocumentStorage.ts`
4. `server/storage/portal/portalStorage.ts`

#### Detailed Steps:

**1. Create `server/storage/documents/documentStorage.ts`:**
- Document folder operations
- Document CRUD operations

**2. Create `server/storage/documents/riskAssessmentStorage.ts`:**
- Risk assessment CRUD
- Risk assessment response operations

**3. Create `server/storage/documents/portalDocumentStorage.ts`:**
- Portal document operations

**4. Create `server/storage/portal/portalStorage.ts`:**
- Client portal user operations
- Client portal session operations

#### Testing Requirements:
- [ ] **Unit Tests:** Test document operations
- [ ] **Unit Tests:** Test portal operations
- [ ] **Playwright E2E Tests:**
  ```
  Test Plan:
  1. [New Context] Browser context
  2. [OIDC] Login
  3. [Browser] Navigate to client documents
  4. [Browser] Create folder
  5. [Browser] Upload document
  6. [Verify] Document appears in folder
  7. [Browser] Create risk assessment
  8. [Verify] Risk assessment saved
  ```

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Document management works
- Portal operations functional
- Risk assessments working

---

### **STAGE 10: Extract Messages Domain**
**Estimated Time:** 5-6 hours  
**Risk Level:** MEDIUM

#### Objectives:
Extract all messaging operations: threads, project messages, staff messages.

#### Files to Create:
1. `server/storage/messages/messageThreadStorage.ts`
2. `server/storage/messages/projectMessageStorage.ts`
3. `server/storage/messages/staffMessageStorage.ts`
4. `server/storage/messages/index.ts`

#### Detailed Steps:

**1. Create `server/storage/messages/messageThreadStorage.ts`:**
- Message thread operations
- Message operations

**2. Create `server/storage/messages/projectMessageStorage.ts`:**
- Project message thread operations
- Project message operations
- Project message participant operations

**3. Create `server/storage/messages/staffMessageStorage.ts`:**
- Staff message thread operations
- Staff message operations
- Staff message participant operations

#### Testing Requirements:
- [ ] **Unit Tests:** Test message operations
- [ ] **Playwright E2E Tests:**
  ```
  Test Plan:
  1. [New Context] Browser context
  2. [OIDC] Login as user 1
  3. [Browser] Navigate to messages
  4. [Browser] Create new message thread
  5. [Browser] Send message
  6. [New Context] Create second browser context
  7. [OIDC] Login as user 2
  8. [Browser] Navigate to messages
  9. [Verify] Message thread appears
  10. [Browser] Reply to message
  11. [Verify] Reply appears in thread
  ```

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Messaging fully functional
- All message types work
- Participants tracked correctly

---

### **STAGE 11: Extract Requests Domain**
**Estimated Time:** 4-5 hours  
**Risk Level:** LOW

#### Objectives:
Extract client request templates and custom requests.

#### Files to Create:
1. `server/storage/requests/requestTemplateStorage.ts`
2. `server/storage/requests/customRequestStorage.ts`
3. `server/storage/requests/index.ts`

#### Detailed Steps:

**1. Create `server/storage/requests/requestTemplateStorage.ts`:**
- Template category operations
- Template operations
- Template section operations
- Template question operations

**2. Create `server/storage/requests/customRequestStorage.ts`:**
- Custom request operations
- Custom request section operations
- Custom request question operations

#### Testing Requirements:
- [ ] **Unit Tests:** Test template operations
- [ ] **Unit Tests:** Test custom request operations
- [ ] **Playwright E2E Tests:** Test creating and using request templates

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Request templates work
- Custom requests functional

---

### **STAGE 12: Extract Tasks Domain**
**Estimated Time:** 6-7 hours  
**Risk Level:** MEDIUM

#### Objectives:
Extract task instances, internal tasks, and task connections.

#### Files to Create:
1. `server/storage/tasks/taskInstanceStorage.ts`
2. `server/storage/tasks/internalTaskStorage.ts`
3. `server/storage/tasks/taskConnectionStorage.ts`
4. `server/storage/tasks/index.ts`

#### Detailed Steps:

**1. Create `server/storage/tasks/taskInstanceStorage.ts`:**
- Task instance operations
- Task instance response operations
- Task type operations

**2. Create `server/storage/tasks/internalTaskStorage.ts`:**
- Internal task operations
- Task progress notes operations
- Task time entry operations
- Task document operations

**3. Create `server/storage/tasks/taskConnectionStorage.ts`:**
- Task connection operations

#### Testing Requirements:
- [ ] **Unit Tests:** Test task operations
- [ ] **Playwright E2E Tests:**
  ```
  Test Plan:
  1. [New Context] Browser context
  2. [OIDC] Login
  3. [Browser] Navigate to internal tasks
  4. [Browser] Create new task
  5. [Browser] Add progress note
  6. [Browser] Log time entry
  7. [Verify] All task data saved
  8. [Browser] Create task connection
  9. [Verify] Connection created
  ```

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Task system fully functional
- Time tracking works
- Task connections maintained

---

### **STAGE 13: Extract Notifications Domain**
**Estimated Time:** 5-6 hours  
**Risk Level:** MEDIUM (notification delivery)

#### Objectives:
Extract notification templates, scheduling, and history.

#### Files to Create:
1. `server/storage/notifications/notificationTemplateStorage.ts`
2. `server/storage/notifications/scheduledNotificationStorage.ts`
3. `server/storage/notifications/notificationHistoryStorage.ts`
4. `server/storage/notifications/index.ts`

#### Detailed Steps:

**1. Create `server/storage/notifications/notificationTemplateStorage.ts`:**
- Project type notification operations
- Push notification template operations (if not already in integrations)

**2. Create `server/storage/notifications/scheduledNotificationStorage.ts`:**
- Client request reminder operations
- Scheduled notification operations

**3. Create `server/storage/notifications/notificationHistoryStorage.ts`:**
- Notification history operations

#### Testing Requirements:
- [ ] **Unit Tests:** Test notification operations
- [ ] **Manual Testing:** Verify notifications still send
- [ ] **Check:** Scheduled notifications still trigger

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Notification system works
- Scheduling functional
- History tracked correctly

---

### **STAGE 14: Extract Settings & Preferences Domain**
**Estimated Time:** 4-5 hours  
**Risk Level:** LOW

#### Objectives:
Extract user preferences, views, and company settings.

#### Files to Create:
1. `server/storage/settings/settingsStorage.ts`
2. `server/storage/settings/preferencesStorage.ts`
3. `server/storage/settings/index.ts`

#### Detailed Steps:

**1. Create `server/storage/settings/settingsStorage.ts`:**
- Company settings operations
- Company views operations

**2. Create `server/storage/settings/preferencesStorage.ts`:**
- User notification preferences operations
- Project views operations
- User column preferences operations
- Dashboard operations
- User project preferences operations

#### Testing Requirements:
- [ ] **Unit Tests:** Test settings operations
- [ ] **Unit Tests:** Test preferences operations
- [ ] **Manual Testing:** Verify user preferences persist

#### Review Point:
✅ **Architect Review Required**

#### Success Criteria:
- Settings management works
- User preferences saved correctly
- Views and dashboards functional

---

### **STAGE 15: Final Cleanup & Removal of Old Storage**
**Estimated Time:** 4-6 hours  
**Risk Level:** MEDIUM

#### Objectives:
Remove the old monolithic `storage.ts` file and finalize the new architecture.

#### CRITICAL TECHNICAL DEBT TO ADDRESS:
⚠️ **Transaction Support for Helper Injection Pattern**

**Issue Discovered in Stage 2:**
The helper injection pattern (BaseStorage) doesn't support transaction propagation. This means cross-domain operations like `convertIndividualToCompanyClient` cannot maintain full atomicity while preserving helper side effects.

**Required Actions:**
1. **Review all cross-domain operations** that use helpers within transactions
2. **Implement transaction-aware helper signatures** - all helpers should accept optional `tx` parameter
3. **Update helper registrations** to support transaction propagation
4. **Specifically fix:**
   - `convertIndividualToCompanyClient` - ensure it uses helpers with transaction support
   - Companies House upsert operations - must participate in transactions
   - Any other cross-domain operations identified during stages 3-14
5. **Test thoroughly:**
   - Transaction rollback scenarios
   - Cross-domain side effects (chronology, notifications, etc.)
   - Companies House sync flows

#### Detailed Steps:

**1. Verify Complete Migration:**
- [ ] Check that ALL methods from old storage.ts are now delegated to new modules
- [ ] Verify no direct usage of old `DatabaseStorage` class remains
- [ ] Confirm all routes import from `./storage/index`

**2. Update `server/storage/index.ts` to Aggregate All Modules:**
```typescript
import { UserStorage } from './users/userStorage';
import { UserActivityStorage } from './users/userActivityStorage';
import { ClientStorage } from './clients/clientStorage';
import { CompaniesHouseStorage } from './clients/companiesHouseStorage';
// ... import all other storage modules

export interface IStorage {
  // Re-export the full IStorage interface
}

export class DatabaseStorage implements IStorage {
  private userStorage: UserStorage;
  private userActivityStorage: UserActivityStorage;
  private clientStorage: ClientStorage;
  // ... initialize all storage modules
  
  constructor() {
    this.userStorage = new UserStorage();
    this.userActivityStorage = new UserActivityStorage();
    this.clientStorage = new ClientStorage();
    // ... initialize all modules
  }
  
  // Delegate all methods to appropriate modules
  async getUser(id: string) {
    return this.userStorage.getUser(id);
  }
  
  // ... delegate all other methods
}

// Re-export all types
export * from './base/types';
```

**3. Move IStorage Interface:**
- Move `IStorage` interface definition from old `storage.ts` to `server/storage/base/IStorage.ts`
- Update `server/storage/index.ts` to re-export it

**4. Delete Old Storage File:**
```bash
# Backup first
cp server/storage.ts server/storage.ts.backup

# Delete old file
rm server/storage.ts
```

**5. Final Testing:**
- [ ] Run full test suite
- [ ] Verify application compiles
- [ ] Test all major features
- [ ] Run Playwright E2E tests for critical flows

#### Testing Requirements:
- [ ] **Full Regression Testing:** Test all major application features
- [ ] **Performance Testing:** Ensure no performance degradation
- [ ] **Playwright E2E Tests:** Run comprehensive test suite covering:
  - User authentication
  - Client management
  - Project creation and management
  - Service assignments
  - Messaging
  - Document management
  - Task management
  - Notifications

#### Review Point:
✅ **Final Architect Review Required**
- Review entire new architecture
- Verify all functionality works
- Check for any remaining issues
- Sign off on migration completion

#### Success Criteria:
- Old storage.ts successfully removed
- All tests pass
- Application fully functional
- No regressions detected
- Code is cleaner and more maintainable

---

## Post-Refactoring Validation Checklist

After completing all stages, verify the following:

### Functionality Checks:
- [ ] User authentication and sessions work
- [ ] Client management fully functional
- [ ] People management works
- [ ] Project creation, editing, status changes work
- [ ] Service assignments functional
- [ ] Tags can be created and assigned
- [ ] Messaging system works
- [ ] Document management functional
- [ ] Portal access works
- [ ] Notifications send correctly
- [ ] Task system fully operational
- [ ] All integrations (email, OAuth, etc.) work
- [ ] Settings and preferences persist

### Code Quality Checks:
- [ ] No TypeScript errors
- [ ] All imports resolved correctly
- [ ] No circular dependencies
- [ ] All tests pass
- [ ] Code coverage maintained or improved
- [ ] No console errors in browser
- [ ] No backend errors in logs

### Performance Checks:
- [ ] Application startup time unchanged or improved
- [ ] Page load times unchanged or improved
- [ ] API response times unchanged or improved
- [ ] Database query performance maintained

### Documentation:
- [ ] Update `replit.md` with new architecture
- [ ] Document new storage module organization
- [ ] Create README in `server/storage/` explaining structure
- [ ] Update any relevant developer documentation

---

## Risk Mitigation Strategies

### During Refactoring:
1. **Always maintain backward compatibility** - Old code should continue to work during migration
2. **Test after each stage** - Don't proceed until current stage is verified working
3. **Commit frequently** - Commit after each successful stage completion
4. **Keep old storage.ts** until final stage - Acts as safety net
5. **Run tests frequently** - Catch issues early

### Rollback Plan:
If any stage fails and cannot be fixed quickly:
1. Revert to last good commit
2. Review what went wrong
3. Adjust approach
4. Try again with fixes

### Common Pitfalls to Avoid:
- **Don't** try to refactor multiple domains at once
- **Don't** skip testing between stages
- **Don't** delete old code until completely migrated
- **Don't** modify method signatures during extraction (keep them identical)
- **Don't** forget to update imports in all consuming files

---

## Estimated Total Timeline

| Stage | Duration | Risk Level | Can be Parallelized |
|-------|----------|------------|---------------------|
| Stage 0: Foundation | 2-3 hours | LOW | No |
| Stage 1: Users | 4-6 hours | MEDIUM | No (foundation required) |
| Stage 2: Clients | 4-6 hours | MEDIUM | After Stage 1 |
| Stage 3: People | 4-5 hours | MEDIUM | After Stage 1 |
| Stage 4: Projects Part 1 | 6-8 hours | HIGH | After Stages 1-3 |
| Stage 5: Projects Part 2 | 6-8 hours | HIGH | After Stage 4 |
| Stage 6: Services | 5-6 hours | MEDIUM | After Stage 1 |
| Stage 7: Tags/Comms | 3-4 hours | LOW | After Stages 2-3 |
| Stage 8: Integrations | 5-6 hours | MEDIUM | After Stage 1 |
| Stage 9: Documents/Portal | 4-5 hours | MEDIUM | After Stages 2-3 |
| Stage 10: Messages | 5-6 hours | MEDIUM | After Stage 1 |
| Stage 11: Requests | 4-5 hours | LOW | After Stages 2-4 |
| Stage 12: Tasks | 6-7 hours | MEDIUM | After Stage 4 |
| Stage 13: Notifications | 5-6 hours | MEDIUM | After Stages 1, 4 |
| Stage 14: Settings | 4-5 hours | LOW | After Stage 1 |
| Stage 15: Final Cleanup | 4-6 hours | MEDIUM | After all stages |

**Total Estimated Time:** 70-90 hours of focused work

**Recommended Approach:**
- **Sequential Execution:** Work through stages 0-5 sequentially (these are dependencies for others)
- **Parallel Opportunity:** Stages 6-14 can potentially be worked on in parallel by different developers after stages 0-5 are complete
- **Single Developer:** ~2-3 weeks of focused work
- **Team of 3:** ~1 week with good coordination

---

## Benefits After Refactoring

### Developer Experience:
- **Faster onboarding:** New developers can understand one domain at a time
- **Easier navigation:** Find code quickly by domain
- **Better IDE performance:** Smaller files = faster IntelliSense
- **Reduced merge conflicts:** Multiple developers can work on different domains

### Code Quality:
- **Clear separation of concerns:** Each module has single responsibility
- **Better testability:** Test domains in isolation
- **Easier maintenance:** Changes isolated to relevant modules
- **Reduced coupling:** Clear boundaries between domains

### Business Value:
- **Faster feature development:** Less time understanding code
- **Lower bug risk:** Isolated changes reduce unintended side effects
- **Better scalability:** Can optimize individual domains independently
- **Easier refactoring:** Can improve one domain without touching others

---

## Conclusion

This stage-by-stage plan breaks down the monolithic `storage.ts` refactoring into manageable, testable chunks. Each stage:
- Has clear objectives and success criteria
- Includes specific testing requirements
- Maintains backward compatibility
- Includes review points
- Can be completed independently

By following this plan methodically, the agent can safely refactor the 13,648-line file into a clean, maintainable, domain-driven architecture without breaking existing functionality.
