# Schema.ts Refactoring Plan

## Pre-Testing Reminder (CRITICAL - Read Before Each Browser Test)

**BEFORE EVERY BROWSER TESTING SESSION:**
1. Login via the root page using the **Password tab**
2. Credentials: `admin@example.com` | `admin123`
3. **Known Bug**: Projects may sometimes fail to load. If this happens:
   - Refresh the browser
   - Restart the testing workflow
   - Resume testing from the last successful step

---

## Executive Summary

**Current State:** 3,920 lines  
**Severity:** HIGH  
**Target State:** ~15-20 focused modules, each 100-400 lines

This refactoring will split the monolithic `shared/schema.ts` into a domain-organized module structure while maintaining full backward compatibility through a central re-export file.

---

## Current File Analysis

### Structure Overview

The current `shared/schema.ts` contains:

| Category | Count | Lines (approx) |
|----------|-------|----------------|
| pgEnum definitions | 15 | 100 |
| Table definitions | 60+ | 2,000 |
| Relations definitions | 20+ | 300 |
| Zod insert/update schemas | 80+ | 800 |
| Type exports | 100+ | 400 |
| Helper functions | 5 | 100 |
| Extended types | 10+ | 200 |

### Key Dependencies

1. **Drizzle ORM imports** - `drizzle-orm` and `drizzle-orm/pg-core`
2. **Zod validation** - `zod` and `drizzle-zod`
3. **SQL helpers** - Custom `lower()` function

### Table Categories Identified

1. **Users Domain** (~400 lines)
   - `sessions` - Replit Auth sessions
   - `users` - User accounts
   - `userSessions` - Login session tracking
   - `loginAttempts` - Security monitoring
   - `userNotificationPreferences` - Notification settings
   - `magicLinkTokens` - Magic link auth
   - `userOauthAccounts` - OAuth tokens
   - `projectViews` - Saved project filters
   - `companyViews` - Saved company filters
   - `userColumnPreferences` - Column settings
   - `dashboards` - Dashboard configurations
   - `dashboardCache` - Cached dashboard stats
   - `userProjectPreferences` - Project page preferences

2. **Clients Domain** (~300 lines)
   - `clients` - Client companies
   - `people` - Individual people
   - `clientPeople` - Client-person relationships
   - `clientPortalUsers` - Portal access

3. **Projects Domain** (~500 lines)
   - `projects` - Project records
   - `projectTypes` - Project type configurations
   - `kanbanStages` - Kanban stage definitions
   - `projectChronology` - Project history
   - `clientChronology` - Client history
   - `changeReasons` - Stage change reasons
   - `stageReasonMaps` - Stage-reason mappings
   - `reasonCustomFields` - Custom field definitions
   - `reasonFieldResponses` - Custom field responses
   - `stageApprovals` - Approval definitions
   - `stageApprovalFields` - Approval field definitions
   - `stageApprovalResponses` - Approval field responses
   - `projectSchedulingHistory` - Scheduling records
   - `schedulingRunLogs` - Scheduler run logs

4. **Services Domain** (~300 lines)
   - `services` - Service definitions
   - `workRoles` - Work role definitions
   - `serviceRoles` - Service-role mappings
   - `clientServices` - Client service assignments
   - `peopleServices` - Person service assignments
   - `clientServiceRoleAssignments` - Role assignments
   - `chChangeRequests` - Companies House change requests

5. **Communications Domain** (~400 lines)
   - `communications` - Communication logs
   - `messageThreads` - Portal message threads
   - `messages` - Portal messages
   - `projectMessageThreads` - Project message threads
   - `projectMessages` - Project messages
   - `projectMessageParticipants` - Project message participants
   - `staffMessageThreads` - Staff message threads
   - `staffMessages` - Staff messages
   - `staffMessageParticipants` - Staff message participants
   - `userIntegrations` - Integration settings
   - `userActivityTracking` - Activity tracking

6. **Notifications Domain** (~300 lines)
   - `pushSubscriptions` - Push notification subscriptions
   - `pushNotificationTemplates` - Push templates
   - `notificationIcons` - Notification icons
   - `companySettings` - Company notification settings
   - `projectTypeNotifications` - Project type notification configs
   - `clientRequestReminders` - Request reminder configs
   - `scheduledNotifications` - Scheduled notification queue
   - `notificationHistory` - Notification send history

7. **Documents Domain** (~400 lines)
   - `documentFolders` - Document folder structure
   - `documents` - Document records
   - `signatureRequests` - E-signature requests
   - `signatureFields` - Signature field definitions
   - `signatureRequestRecipients` - Signature recipients
   - `signatures` - Captured signatures
   - `signatureAuditLogs` - Signature audit trail
   - `signedDocuments` - Completed signed documents

8. **Email Domain** (~350 lines)
   - `emailMessages` - Email records
   - `mailboxMessageMap` - Mailbox message mappings
   - `emailThreads` - Email thread summaries
   - `unmatchedEmails` - Unmatched email quarantine
   - `clientEmailAliases` - Client email aliases
   - `clientDomainAllowlist` - Domain allowlist
   - `emailAttachments` - Attachment storage
   - `emailMessageAttachments` - Message-attachment links
   - `graphWebhookSubscriptions` - Webhook subscriptions
   - `graphSyncState` - Sync state tracking

9. **Tasks Domain** (~400 lines)
   - `taskInstances` - Task instances
   - `taskInstanceResponses` - Task responses
   - `taskTypes` - Task type definitions
   - `internalTasks` - Internal tasks
   - `taskConnections` - Task relationships
   - `taskProgressNotes` - Progress notes
   - `taskTimeEntries` - Time entries
   - `taskDocuments` - Task documents

10. **Requests Domain** (~350 lines)
    - `clientRequestTemplateCategories` - Template categories
    - `clientRequestTemplates` - Request templates
    - `clientRequestTemplateSections` - Template sections
    - `clientRequestTemplateQuestions` - Template questions
    - `clientCustomRequests` - Custom request instances
    - `clientCustomRequestSections` - Custom request sections
    - `clientCustomRequestQuestions` - Custom request questions
    - `riskAssessments` - Risk assessments
    - `riskAssessmentResponses` - Risk responses

---

## Target Architecture

```
shared/schema/
├── index.ts                          # Central re-export (maintains backward compatibility)
├── enums.ts                          # All pgEnum definitions (~100 lines)
├── common/
│   ├── helpers.ts                    # lower() function, shared utilities (~20 lines)
│   └── imports.ts                    # Shared drizzle/zod imports (re-exported)
├── users/
│   ├── tables.ts                     # All user-related tables (~250 lines)
│   ├── relations.ts                  # User relations (~50 lines)
│   ├── schemas.ts                    # Insert/update schemas (~100 lines)
│   └── types.ts                      # Type exports (~50 lines)
├── clients/
│   ├── tables.ts                     # clients, people, clientPeople, portal (~200 lines)
│   ├── relations.ts                  # Client relations (~40 lines)
│   ├── schemas.ts                    # Insert/update schemas (~80 lines)
│   └── types.ts                      # Type exports (~40 lines)
├── projects/
│   ├── tables.ts                     # projects, projectTypes, kanbanStages, etc. (~400 lines)
│   ├── relations.ts                  # Project relations (~100 lines)
│   ├── schemas.ts                    # Insert/update schemas (~150 lines)
│   ├── helpers.ts                    # normalizeProjectMonth, etc. (~80 lines)
│   └── types.ts                      # Type exports (~80 lines)
├── services/
│   ├── tables.ts                     # services, workRoles, assignments (~200 lines)
│   ├── relations.ts                  # Service relations (~50 lines)
│   ├── schemas.ts                    # Insert/update schemas (~100 lines)
│   └── types.ts                      # Type exports (~40 lines)
├── communications/
│   ├── tables.ts                     # messages, threads, activity (~300 lines)
│   ├── relations.ts                  # Communication relations (~60 lines)
│   ├── schemas.ts                    # Insert/update schemas (~80 lines)
│   └── types.ts                      # Type exports (~60 lines)
├── notifications/
│   ├── tables.ts                     # push, scheduled, history (~200 lines)
│   ├── relations.ts                  # Notification relations (~30 lines)
│   ├── schemas.ts                    # Insert/update schemas (~60 lines)
│   └── types.ts                      # Type exports (~40 lines)
├── documents/
│   ├── tables.ts                     # documents, folders, signatures (~300 lines)
│   ├── relations.ts                  # Document relations (~50 lines)
│   ├── schemas.ts                    # Insert/update schemas (~80 lines)
│   └── types.ts                      # Type exports (~60 lines)
├── email/
│   ├── tables.ts                     # email messages, threads, attachments (~250 lines)
│   ├── relations.ts                  # Email relations (~40 lines)
│   ├── schemas.ts                    # Insert/update schemas (~60 lines)
│   └── types.ts                      # Type exports (~40 lines)
├── tasks/
│   ├── tables.ts                     # taskInstances, internalTasks, etc. (~300 lines)
│   ├── relations.ts                  # Task relations (~50 lines)
│   ├── schemas.ts                    # Insert/update schemas (~100 lines)
│   └── types.ts                      # Type exports (~60 lines)
└── requests/
    ├── tables.ts                     # templates, custom requests, risk (~250 lines)
    ├── relations.ts                  # Request relations (~40 lines)
    ├── schemas.ts                    # Insert/update schemas (~80 lines)
    └── types.ts                      # Type exports (~60 lines)
```

---

## Refactoring Stages

### Stage 1: Foundation Setup (Low Risk)
**Objective:** Create the module structure and shared imports without modifying existing code.

**Steps:**
1. Create `shared/schema/` directory structure
2. Create `shared/schema/common/imports.ts` with shared Drizzle/Zod imports
3. Create `shared/schema/common/helpers.ts` with the `lower()` function
4. Create `shared/schema/enums.ts` with all pgEnum definitions
5. Create placeholder `index.ts` that re-exports from the original `schema.ts`

**Success Criteria:**
- [ ] All new files compile without errors
- [ ] TypeScript finds no issues with the new module structure
- [ ] Original `schema.ts` still works unchanged
- [ ] Running `npm run check` passes

**Testing Approach:**
1. Run TypeScript compilation: `npx tsc --noEmit`
2. Verify the application starts normally
3. No browser testing needed for this stage

---

### Stage 2: Users Domain Extraction
**Objective:** Extract user-related tables, schemas, and types to the users module.

**Steps:**
1. Create `shared/schema/users/tables.ts`:
   - Move `sessions`, `users`, `userSessions`, `loginAttempts`
   - Move `userNotificationPreferences`, `magicLinkTokens`, `userOauthAccounts`
   - Move `projectViews`, `companyViews`, `userColumnPreferences`
   - Move `dashboards`, `dashboardCache`, `userProjectPreferences`

2. Create `shared/schema/users/relations.ts`:
   - Move all user-related relations

3. Create `shared/schema/users/schemas.ts`:
   - Move all insert/update schemas for user tables

4. Create `shared/schema/users/types.ts`:
   - Move all User-related type exports

5. Update `shared/schema/index.ts` to re-export from users module

**Success Criteria:**
- [ ] All user-related exports available from `@shared/schema`
- [ ] No duplicate exports (check for conflicts)
- [ ] All imports across codebase still resolve correctly
- [ ] TypeScript compilation passes

**Testing Approach:**
1. Run TypeScript compilation: `npx tsc --noEmit`
2. Run application and verify login works
3. **Browser Test (with Pre-Testing Reminder):**
   - Navigate to login page
   - Login with `admin@example.com` | `admin123`
   - Verify dashboard loads (refresh if projects don't load)
   - Navigate to profile page
   - Verify user preferences save correctly

---

### Stage 3: Clients Domain Extraction
**Objective:** Extract client and people tables to the clients module.

**Steps:**
1. Create `shared/schema/clients/tables.ts`:
   - Move `clients`, `people`, `clientPeople`, `clientPortalUsers`

2. Create `shared/schema/clients/relations.ts`:
   - Move client and people relations

3. Create `shared/schema/clients/schemas.ts`:
   - Move insert/update schemas for client tables

4. Create `shared/schema/clients/types.ts`:
   - Move client/people type exports

5. Update `shared/schema/index.ts`

**Success Criteria:**
- [ ] Client-related exports available from `@shared/schema`
- [ ] People management still works
- [ ] Client portal functionality intact

**Testing Approach:**
1. TypeScript compilation passes
2. **Browser Test:**
   - Login (remember Pre-Testing Reminder)
   - Navigate to clients list
   - Create a new client
   - Add a person to the client
   - Verify client detail page loads correctly

---

### Stage 4: Projects Domain Extraction
**Objective:** Extract project-related tables (largest domain).

**Steps:**
1. Create `shared/schema/projects/tables.ts`:
   - Move `projects`, `projectTypes`, `kanbanStages`
   - Move `projectChronology`, `clientChronology`
   - Move `changeReasons`, `stageReasonMaps`
   - Move `reasonCustomFields`, `reasonFieldResponses`
   - Move `stageApprovals`, `stageApprovalFields`, `stageApprovalResponses`
   - Move `projectSchedulingHistory`, `schedulingRunLogs`

2. Create `shared/schema/projects/relations.ts`

3. Create `shared/schema/projects/schemas.ts`

4. Create `shared/schema/projects/helpers.ts`:
   - Move `normalizeProjectMonth`
   - Move `normalizeMonthForFiltering`
   - Move `getCurrentMonthForFiltering`

5. Create `shared/schema/projects/types.ts`:
   - Move project-related type exports
   - Move `ProjectWithRelations` extended type

6. Update `shared/schema/index.ts`

**Success Criteria:**
- [ ] All project exports available
- [ ] Project filtering works correctly
- [ ] Kanban view functions properly
- [ ] Project chronology displays

**Testing Approach:**
1. TypeScript compilation passes
2. **Browser Test:**
   - Login (remember Pre-Testing Reminder)
   - Navigate to projects page
   - Verify both list and kanban views work
   - If projects don't load, refresh browser and restart test
   - Change a project's status
   - Verify chronology updates
   - Test project filtering

---

### Stage 5: Services Domain Extraction
**Objective:** Extract service-related tables.

**Steps:**
1. Create `shared/schema/services/tables.ts`:
   - Move `services`, `workRoles`, `serviceRoles`
   - Move `clientServices`, `peopleServices`, `clientServiceRoleAssignments`
   - Move `chChangeRequests`

2. Create `shared/schema/services/relations.ts`

3. Create `shared/schema/services/schemas.ts`:
   - Move `udfDefinitionSchema`
   - Move insert/update schemas

4. Create `shared/schema/services/types.ts`

5. Update `shared/schema/index.ts`

**Success Criteria:**
- [ ] Service management works
- [ ] Work role assignments function
- [ ] Client service assignments work

**Testing Approach:**
1. TypeScript compilation passes
2. **Browser Test:**
   - Login (remember Pre-Testing Reminder)
   - Navigate to services page
   - View service details
   - Navigate to a client and check assigned services

---

### Stage 6: Communications Domain Extraction
**Objective:** Extract messaging and communication tables.

**Steps:**
1. Create `shared/schema/communications/tables.ts`:
   - Move `communications`
   - Move `messageThreads`, `messages`
   - Move `projectMessageThreads`, `projectMessages`, `projectMessageParticipants`
   - Move `staffMessageThreads`, `staffMessages`, `staffMessageParticipants`
   - Move `userIntegrations`, `userActivityTracking`

2. Create `shared/schema/communications/relations.ts`

3. Create `shared/schema/communications/schemas.ts`

4. Create `shared/schema/communications/types.ts`

5. Update `shared/schema/index.ts`

**Success Criteria:**
- [ ] Messaging functionality works
- [ ] Communication logs display
- [ ] Activity tracking functions

**Testing Approach:**
1. TypeScript compilation passes
2. **Browser Test:**
   - Login (remember Pre-Testing Reminder)
   - Navigate to messages
   - Verify message threads load
   - Check communication history on a client

---

### Stage 7: Notifications Domain Extraction
**Objective:** Extract notification-related tables.

**Steps:**
1. Create `shared/schema/notifications/tables.ts`:
   - Move `pushSubscriptions`, `pushNotificationTemplates`, `notificationIcons`
   - Move `companySettings`
   - Move `projectTypeNotifications`, `clientRequestReminders`
   - Move `scheduledNotifications`, `notificationHistory`

2. Create `shared/schema/notifications/relations.ts`

3. Create `shared/schema/notifications/schemas.ts`:
   - Move notification preview schemas

4. Create `shared/schema/notifications/types.ts`

5. Update `shared/schema/index.ts`

**Success Criteria:**
- [ ] Push notifications work
- [ ] Notification scheduling functions
- [ ] Notification history displays

**Testing Approach:**
1. TypeScript compilation passes
2. **Browser Test:**
   - Login (remember Pre-Testing Reminder)
   - Check notification settings
   - View scheduled notifications

---

### Stage 8: Documents Domain Extraction
**Objective:** Extract document and signature tables.

**Steps:**
1. Create `shared/schema/documents/tables.ts`:
   - Move `documentFolders`, `documents`
   - Move `signatureRequests`, `signatureFields`, `signatureRequestRecipients`
   - Move `signatures`, `signatureAuditLogs`, `signedDocuments`

2. Create `shared/schema/documents/relations.ts`

3. Create `shared/schema/documents/schemas.ts`

4. Create `shared/schema/documents/types.ts`

5. Update `shared/schema/index.ts`

**Success Criteria:**
- [ ] Document folder navigation works
- [ ] Document upload/download works
- [ ] Signature requests function

**Testing Approach:**
1. TypeScript compilation passes
2. **Browser Test:**
   - Login (remember Pre-Testing Reminder)
   - Navigate to a client's documents
   - Verify folder structure loads

---

### Stage 9: Email Domain Extraction
**Objective:** Extract email threading tables.

**Steps:**
1. Create `shared/schema/email/tables.ts`:
   - Move `emailMessages`, `mailboxMessageMap`, `emailThreads`
   - Move `unmatchedEmails`, `clientEmailAliases`, `clientDomainAllowlist`
   - Move `emailAttachments`, `emailMessageAttachments`
   - Move `graphWebhookSubscriptions`, `graphSyncState`

2. Create `shared/schema/email/relations.ts`

3. Create `shared/schema/email/schemas.ts`

4. Create `shared/schema/email/types.ts`

5. Update `shared/schema/index.ts`

**Success Criteria:**
- [ ] Email threading works
- [ ] Email sync functions
- [ ] Client email matching works

**Testing Approach:**
1. TypeScript compilation passes
2. **Browser Test:**
   - Login (remember Pre-Testing Reminder)
   - Navigate to a client and check email threads

---

### Stage 10: Tasks Domain Extraction
**Objective:** Extract task-related tables.

**Steps:**
1. Create `shared/schema/tasks/tables.ts`:
   - Move `taskInstances`, `taskInstanceResponses`
   - Move `taskTypes`
   - Move `internalTasks`, `taskConnections`, `taskProgressNotes`
   - Move `taskTimeEntries`, `taskDocuments`

2. Create `shared/schema/tasks/relations.ts`

3. Create `shared/schema/tasks/schemas.ts`

4. Create `shared/schema/tasks/types.ts`

5. Update `shared/schema/index.ts`

**Success Criteria:**
- [ ] Internal tasks display
- [ ] Task time entries work
- [ ] Task connections function

**Testing Approach:**
1. TypeScript compilation passes
2. **Browser Test:**
   - Login (remember Pre-Testing Reminder)
   - Navigate to internal tasks
   - View task details

---

### Stage 11: Requests Domain Extraction
**Objective:** Extract client request template and risk assessment tables.

**Steps:**
1. Create `shared/schema/requests/tables.ts`:
   - Move `clientRequestTemplateCategories`, `clientRequestTemplates`
   - Move `clientRequestTemplateSections`, `clientRequestTemplateQuestions`
   - Move `clientCustomRequests`, `clientCustomRequestSections`, `clientCustomRequestQuestions`
   - Move `riskAssessments`, `riskAssessmentResponses`

2. Create `shared/schema/requests/relations.ts`

3. Create `shared/schema/requests/schemas.ts`:
   - Move CSV schemas
   - Move bulk operation schemas

4. Create `shared/schema/requests/types.ts`

5. Update `shared/schema/index.ts`

**Success Criteria:**
- [ ] Request templates work
- [ ] Custom requests function
- [ ] Risk assessments display

**Testing Approach:**
1. TypeScript compilation passes
2. **Browser Test:**
   - Login (remember Pre-Testing Reminder)
   - Check request templates
   - View risk assessment on a client

---

### Stage 12: Cleanup and Finalization
**Objective:** Remove the original schema.ts and finalize the structure.

**Steps:**
1. Verify all exports are available from `shared/schema/index.ts`
2. Update any remaining direct imports across codebase
3. Remove or archive original `shared/schema.ts`
4. Update documentation (replit.md)
5. Run full test suite

**Success Criteria:**
- [ ] No references to old `shared/schema.ts`
- [ ] All TypeScript compilation passes
- [ ] All tests pass
- [ ] Application fully functional

**Testing Approach:**
1. TypeScript compilation passes
2. **Full Browser Test Suite:**
   - Login (remember Pre-Testing Reminder)
   - Test all major features:
     - Dashboard loads
     - Projects page (list and kanban)
     - Client management
     - Service management
     - Internal tasks
     - Messaging
     - Documents
     - User settings

---

## Cross-Cutting Concerns

### Maintaining Backward Compatibility

The central `shared/schema/index.ts` must re-export everything from all modules:

```typescript
// shared/schema/index.ts
export * from './enums';
export * from './common/helpers';
export * from './users/tables';
export * from './users/relations';
export * from './users/schemas';
export * from './users/types';
// ... etc for all modules
```

This ensures existing imports like:
```typescript
import { users, insertUserSchema, User } from '@shared/schema';
```
continue to work without modification.

### Handling Circular Dependencies

**Strategy:** Tables that reference each other across domains will:
1. Be imported using `AnyPgColumn` for foreign key references
2. Use lazy evaluation where needed
3. Relations defined separately after all tables are loaded

**Example pattern:**
```typescript
// projects/tables.ts
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { clients } from '../clients/tables';

export const projects = pgTable("projects", {
  clientId: varchar("client_id").references(() => clients.id),
  // ...
});
```

### Drizzle Kit Compatibility

Drizzle Kit needs to find all schema definitions. The `drizzle.config.ts` may need updating:

```typescript
export default {
  schema: './shared/schema/**/*.ts', // Glob pattern for all schema files
  // or
  schema: './shared/schema/index.ts', // If index exports all tables
}
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking imports | Medium | High | Maintain full re-export in index.ts |
| Circular dependencies | Medium | Medium | Use AnyPgColumn pattern, separate relations |
| Drizzle migrations break | Low | High | Test migration generation after each stage |
| Type inference issues | Low | Medium | Explicit type annotations where needed |
| IDE performance during refactor | Low | Low | Stage-by-stage approach limits concurrent changes |

---

## Rollback Strategy

Each stage should be committed separately. If issues arise:
1. Git revert the problematic commit
2. Investigate the issue in isolation
3. Fix and re-apply

---

## Time Estimates

| Stage | Estimated Time |
|-------|---------------|
| Stage 1: Foundation | 30 min |
| Stage 2: Users | 45 min |
| Stage 3: Clients | 30 min |
| Stage 4: Projects | 60 min |
| Stage 5: Services | 30 min |
| Stage 6: Communications | 45 min |
| Stage 7: Notifications | 30 min |
| Stage 8: Documents | 45 min |
| Stage 9: Email | 30 min |
| Stage 10: Tasks | 30 min |
| Stage 11: Requests | 30 min |
| Stage 12: Cleanup | 45 min |
| **Total** | **~7-8 hours** |

---

## Definition of Done

The refactoring is complete when:

1. **No single schema file exceeds 400 lines**
2. **All 60+ tables are organized into domain modules**
3. **All existing imports work without modification**
4. **TypeScript compilation passes with no errors**
5. **Drizzle migrations generate correctly**
6. **All browser tests pass**
7. **Documentation updated in replit.md**
8. **Code committed with clear stage-by-stage history**

---

## Notes for Implementation

1. **Always run TypeScript check after each file move**: `npx tsc --noEmit`
2. **Test the application after each stage** before proceeding
3. **Commit after each successful stage** with descriptive message
4. **If browser tests fail due to projects not loading**: Refresh and restart the test
5. **Watch for these common issues:**
   - Missing exports in index.ts
   - Incorrect import paths
   - Circular dependency errors
   - Type inference failures

---

## Appendix: Table Distribution Reference

### Quick Reference by Domain

| Domain | Tables | Schemas | Relations |
|--------|--------|---------|-----------|
| Users | 13 | 15 | 5 |
| Clients | 4 | 4 | 3 |
| Projects | 14 | 18 | 10 |
| Services | 7 | 8 | 4 |
| Communications | 11 | 11 | 6 |
| Notifications | 8 | 10 | 3 |
| Documents | 8 | 8 | 4 |
| Email | 10 | 8 | 2 |
| Tasks | 8 | 10 | 4 |
| Requests | 9 | 14 | 3 |
| **Total** | **~92** | **~106** | **~44** |
