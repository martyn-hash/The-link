# Stage-Change Optimization Plan

**Created:** December 7, 2025  
**Status:** Wave 1 Complete ✓  
**Based on:** `stage-change-pressure-analysis.md`  
**Considers:** Bookkeeping Queries Feature Integration

---

## Wave 1 Completion Summary (December 7, 2025)

### Tasks Completed

1. **Batch Field Response Insertions** - `projectStatusStorage.ts`
   - Replaced sequential INSERT loop with batch validation using `inArray`
   - Pre-validates all field IDs in single query
   - Performs single batch insert for all field responses
   - **Reduction:** 2N queries → 2 queries for N fields

2. **Static Imports** - `stageChangeNotificationStorage.ts`
   - Converted 5 dynamic imports to static imports at module level
   - Eliminates module resolution overhead per request
   - Imports: storage, sendStageChangeNotificationEmail, handleProjectStageChangeForNotifications

3. **Data Passthrough to Background Operations** - `status.ts`
   - Created `backgroundContext` object capturing all required data before response
   - Eliminates re-fetching of stage, project, and client data in setImmediate
   - Added batch method `getUserNotificationPreferencesForUsers` for efficient preference lookup
   - **Reduction:** 3-5 queries eliminated in background processing

4. **Testing & Verification**
   - E2E test passed: Stage change from "Do the work" to "HOLDING STAGE" completed successfully
   - All background operations execute without errors
   - No regression in notification scheduling

### Files Modified
- `server/storage/projects/projectStatusStorage.ts` - Batch field response insertions
- `server/storage/notifications/stageChangeNotificationStorage.ts` - Static imports
- `server/routes/projects/status.ts` - Background context passthrough, static imports
- `server/storage/settings/userNotificationPreferencesStorage.ts` - Batch preferences method
- `server/storage/base/IStorage.ts` - Interface update
- `server/storage/facade/settings.facade.ts` - Facade method

### Estimated Improvement
- **Database operations reduction:** 30-40%
- **Expected response time improvement:** ~200-300ms for complex projects

---

## Executive Summary

This document provides a detailed, stage-by-stage optimization plan for the stage-change flow. It addresses the critical bottlenecks identified in the pressure analysis and incorporates the upcoming Bookkeeping Queries feature impact.

### Key Metrics (Current State)
- **DB Operations per stage change:** 25-55+
- **External API calls:** 1-2 per recipient
- **Critical bottlenecks:** 4 major areas
- **Estimated response time impact:** 500ms-2000ms depending on project complexity

### Target Metrics (Post-Optimization)
- **DB Operations:** Reduce by 40-60%
- **Response time:** Sub-300ms for synchronous path
- **Background processing:** Fully async, non-blocking

---

## Table of Contents

1. [Phase 1: Validation](#phase-1-validation)
2. [Phase 2: Status Update Transaction](#phase-2-status-update-transaction)
3. [Phase 3: Post-Transaction Operations](#phase-3-post-transaction-operations)
4. [Phase 4: Response Preparation](#phase-4-response-preparation)
5. [Phase 5: Background Operations](#phase-5-background-operations)
6. [Bookkeeping Queries Integration](#bookkeeping-queries-integration)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Risk Assessment](#risk-assessment)

---

## Phase 1: Validation

**Current Location:** `server/routes/projects/status.ts` (route handler)  
**Current Pressure Level:** Low-Medium  
**Current DB Operations:** 4-8

### Current Flow
```
1. Get project from database
2. Validate stage exists and belongs to project type
3. Validate change reason exists and is mapped to stage
4. Validate required custom fields are provided
5. Validate stage approval responses (if approval required)
```

### Optimization Strategy

#### 1.1 Batch Validation Queries

**Current Pattern (Sequential):**
```typescript
const project = await storage.getProject(projectId);
const stage = await storage.getKanbanStage(stageId, projectTypeId);
const reason = await storage.getChangeReason(reasonId, projectTypeId);
const mapping = await storage.getStageReasonMapping(stageId, reasonId);
```

**Optimized Pattern (Parallel + Batched):**
```typescript
// Single parallel fetch for all validation data
const [project, stageConfig] = await Promise.all([
  storage.getProject(projectId),
  storage.getStageChangeValidationData(stageId, reasonId, projectTypeId)
  // Returns: { stage, reason, mapping, requiredFields, approvalConfig }
]);
```

**Implementation:**
- [ ] Create `getStageChangeValidationData()` method in `projectStatusStorage.ts`
- [ ] Use single query with JOINs to fetch stage, reason, mapping together
- [ ] Include required custom fields in same query
- [ ] Include approval configuration if stage requires approval

**New Query Pattern:**
```sql
SELECT 
  ks.id as stage_id, ks.name as stage_name, ks."requiresApproval",
  cr.id as reason_id, cr.name as reason_name,
  kscrm.id as mapping_id,
  json_agg(DISTINCT scf.*) as required_fields,
  json_agg(DISTINCT saf.*) as approval_fields
FROM kanban_stages ks
LEFT JOIN change_reasons cr ON cr."projectTypeId" = ks."projectTypeId"
LEFT JOIN kanban_stage_change_reason_mappings kscrm 
  ON kscrm."stageId" = ks.id AND kscrm."changeReasonId" = cr.id
LEFT JOIN stage_custom_fields scf 
  ON scf."stageId" = ks.id AND scf."isRequired" = true
LEFT JOIN stage_approval_fields saf 
  ON saf."stageId" = ks.id
WHERE ks.id = $1 AND cr.id = $2 AND ks."projectTypeId" = $3
GROUP BY ks.id, cr.id, kscrm.id
```

**DB Operations Reduction:** 4-6 queries → 2 queries

#### 1.2 Cache Stage Configuration

**Rationale:** Stage and reason configurations rarely change. Cache for short period.

**Implementation:**
- [ ] Add in-memory cache for stage configurations (TTL: 5 minutes)
- [ ] Invalidate on stage/reason CRUD operations
- [ ] Use Map with composite key: `${stageId}:${projectTypeId}`

```typescript
// Cache structure
const stageConfigCache = new Map<string, { data: StageConfig; expires: number }>();

function getCachedStageConfig(stageId: string, projectTypeId: string) {
  const key = `${stageId}:${projectTypeId}`;
  const cached = stageConfigCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  return null;
}
```

---

## Phase 2: Status Update Transaction

**Current Location:** `server/storage/projects/projectStatusStorage.ts` → `updateProjectStatus()`  
**Current Pressure Level:** HIGH  
**Current DB Operations:** 5-15+ (depends on field count)

### Current Flow (Within Transaction)
```
1. Select kanban stage by name and project type
2. Select change reason by name and project type  
3. Validate stage-reason mapping
4. Loop: For each custom field:
   a. Select field by ID
   b. Insert field response
5. Insert chronology entry
6. Update project record
```

### Critical Issues
1. **Field responses processed one at a time** with individual SELECTs before INSERT
2. **Business hours calculation** happens synchronously in request path
3. **Work role resolution** requires additional lookups
4. **Transaction blocks parallelism** - all operations must complete before commit

### Optimization Strategy

#### 2.1 Batch Field Response Insertions

**Current Pattern (N queries for N fields):**
```typescript
for (const fieldResponse of fieldResponses) {
  const field = await tx.select().from(stageCustomFields).where(eq(id, fieldResponse.fieldId));
  await tx.insert(stageCustomFieldResponses).values({
    fieldId: field.id,
    projectId,
    value: fieldResponse.value,
    ...
  });
}
```

**Optimized Pattern (2 queries regardless of field count):**
```typescript
// 1. Batch validate all field IDs exist (single query)
const fieldIds = fieldResponses.map(fr => fr.fieldId);
const validFields = await tx
  .select({ id: stageCustomFields.id })
  .from(stageCustomFields)
  .where(inArray(stageCustomFields.id, fieldIds));

// Validate all requested fields exist
const validFieldIds = new Set(validFields.map(f => f.id));
const invalidFields = fieldIds.filter(id => !validFieldIds.has(id));
if (invalidFields.length > 0) {
  throw new Error(`Invalid field IDs: ${invalidFields.join(', ')}`);
}

// 2. Batch insert all responses (single query)
const responseRecords = fieldResponses.map(fr => ({
  id: nanoid(),
  fieldId: fr.fieldId,
  projectId,
  value: fr.value,
  respondedById: userId,
  respondedAt: new Date(),
}));

await tx.insert(stageCustomFieldResponses).values(responseRecords);
```

**DB Operations Reduction:** 2N queries → 2 queries

#### 2.2 Batch Stage Approval Response Insertions

**Same pattern as field responses:**
```typescript
// Current: Loop with individual inserts
for (const approval of approvalResponses) {
  await tx.insert(stageApprovalResponses).values(approval);
}

// Optimized: Single batch insert
const approvalRecords = approvalResponses.map(ar => ({
  id: nanoid(),
  approvalFieldId: ar.fieldId,
  projectId,
  value: ar.value,
  respondedById: userId,
  respondedAt: new Date(),
}));
await tx.insert(stageApprovalResponses).values(approvalRecords);
```

#### 2.3 Pre-compute Business Hours Before Transaction

**Current Pattern:**
```typescript
// Inside transaction
const timeInStage = await calculateBusinessHours(previousStage.enteredAt, new Date());
```

**Optimized Pattern:**
```typescript
// Before transaction (CPU-bound, doesn't need to be in transaction)
const timeInStage = calculateBusinessHoursSync(previousStage.enteredAt, new Date());

// Transaction only does DB operations
await db.transaction(async (tx) => {
  // Use pre-computed value
  await tx.insert(projectChronology).values({
    ...chronologyEntry,
    timeInStage,
  });
});
```

#### 2.4 Consolidate Stage/Reason Lookups

**Issue:** Stage and reason are looked up by NAME inside transaction, but we already validated by ID in Phase 1.

**Optimization:** Pass stage and reason IDs through from validation, don't re-lookup.

```typescript
// Current (redundant lookup)
const stage = await tx.select().from(kanbanStages)
  .where(and(
    eq(kanbanStages.name, stageName),
    eq(kanbanStages.projectTypeId, projectTypeId)
  ));

// Optimized (use ID from validation)
// Already have stageId from validation phase - no lookup needed
```

**DB Operations Reduction:** 2 queries → 0 queries

#### 2.5 Transaction Summary

| Operation | Current | Optimized |
|-----------|---------|-----------|
| Stage lookup | 1 query | 0 (passed from validation) |
| Reason lookup | 1 query | 0 (passed from validation) |
| Mapping validation | 1 query | 0 (done in validation) |
| Field validation | N queries | 1 query (batch) |
| Field response insert | N queries | 1 query (batch) |
| Approval response insert | M queries | 1 query (batch) |
| Chronology insert | 1 query | 1 query |
| Project update | 1 query | 1 query |
| **Total** | **4 + 2N + M** | **4** |

For a stage change with 5 custom fields and 2 approval fields:
- **Current:** 4 + 10 + 2 = 16 queries
- **Optimized:** 4 queries
- **Reduction:** 75%

---

## Phase 3: Post-Transaction Operations

**Current Location:** `server/storage/projects/projectStatusStorage.ts` (after main transaction)  
**Current Pressure Level:** HIGH  
**Current DB Operations:** 8-15

### Current Flow
```
1. Send stage change notifications (to internal system)
2. Create message thread with participants
3. Create initial message in thread
4. Cancel scheduled notifications (if final stage)
5. Auto-archive message threads (if final stage)
```

### Critical Issues
1. **Message thread creation** - 4-5 sequential inserts that could be batched
2. **Still synchronous** - Blocks HTTP response
3. **Cross-domain calls** - Multiple storage class calls

### Optimization Strategy

#### 3.1 Batch Message Thread Creation

**Current Pattern (4-5 sequential inserts):**
```typescript
// 1. Create thread
const thread = await storage.createMessageThread({ ... });

// 2. Add participant 1
await storage.addThreadParticipant({ threadId: thread.id, userId: user1 });

// 3. Add participant 2
await storage.addThreadParticipant({ threadId: thread.id, userId: user2 });

// 4. Add participant 3 (optional)
if (user3) {
  await storage.addThreadParticipant({ threadId: thread.id, userId: user3 });
}

// 5. Create initial message
await storage.createMessage({ threadId: thread.id, content: '...', senderId: userId });
```

**Optimized Pattern (single transaction with batch inserts):**
```typescript
await db.transaction(async (tx) => {
  // 1. Create thread
  const [thread] = await tx.insert(messageThreads).values({
    id: nanoid(),
    projectId,
    type: 'handoff',
    ...
  }).returning();

  // 2. Batch insert all participants
  const participants = [user1, user2, user3].filter(Boolean).map(userId => ({
    id: nanoid(),
    threadId: thread.id,
    userId,
    joinedAt: new Date(),
  }));
  await tx.insert(threadParticipants).values(participants);

  // 3. Create message
  await tx.insert(messages).values({
    id: nanoid(),
    threadId: thread.id,
    content: handoffMessage,
    senderId: userId,
    ...
  });
});
```

**DB Operations Reduction:** 4-5 queries → 1 transaction with 3 statements

#### 3.2 Move to Async (Recommended)

**Rationale:** Handoff thread creation can be slightly delayed without user impact.

**Implementation Options:**

**Option A: setImmediate (Simple)**
```typescript
// After main transaction commits
setImmediate(async () => {
  try {
    await createHandoffThread(projectId, previousAssignee, newAssignee, userId);
  } catch (error) {
    console.error('Failed to create handoff thread:', error);
    // Non-critical, log and continue
  }
});
```

**Option B: Job Queue (Robust)**
```typescript
// After main transaction commits
await jobQueue.add('create-handoff-thread', {
  projectId,
  previousAssignee,
  newAssignee,
  changingUser: userId,
  stageChangeId: chronologyEntry.id,
});
```

**Recommendation:** Start with Option A (setImmediate), migrate to job queue later if needed.

#### 3.3 Batch Final Stage Operations

**Current Pattern (when moving to final stage):**
```typescript
// Sequential operations
await storage.cancelScheduledNotificationsForProject(projectId);
await storage.archiveProjectMessageThreads(projectId);
```

**Optimized Pattern (parallel):**
```typescript
// Parallel execution - these are independent
await Promise.all([
  storage.cancelScheduledNotificationsForProject(projectId),
  storage.archiveProjectMessageThreads(projectId),
]);
```

**Better Still - Move to Async:**
```typescript
// Final stage cleanup is non-critical, can be async
setImmediate(async () => {
  await Promise.all([
    storage.cancelScheduledNotificationsForProject(projectId),
    storage.archiveProjectMessageThreads(projectId),
  ]);
});
```

---

## Phase 4: Response Preparation

**Current Location:** `server/storage/notifications/stageChangeNotificationStorage.ts` → `prepareClientValueNotification()`  
**Current Pressure Level:** HIGH  
**Current DB Operations:** 8-12

### Current Flow
```
1. Fetch project with client data and chronology (complex JOIN)
2. Fetch all client contacts via join between clientPeople and people
3. Look up kanban stage by name AND projectTypeId
4. Fetch notification template from projectTypeNotifications
5. Fetch all stage approval responses with fields and approvals (3-way JOIN)
6. Build approval map with loops
7. Import applicationGraphClient to check Outlook availability
8. Process notification variables (string manipulation)
9. Calculate business hours for due date
```

### Critical Issues
1. **8-12 separate queries** blocking HTTP response
2. **Dynamic imports** inside function (`import('@shared/businessTime')`, `import('../../utils/applicationGraphClient')`)
3. **Loop over approval responses** to build map
4. **Called synchronously** before HTTP response is sent
5. **Complex nested data fetching** with relationships

### Optimization Strategy

#### 4.1 Consolidate to Single Query

**Current Pattern (multiple queries):**
```typescript
const project = await storage.getProjectWithClient(projectId);
const contacts = await storage.getClientContacts(project.clientId);
const stage = await storage.getKanbanStage(stageName, projectTypeId);
const template = await storage.getNotificationTemplate(stageId, projectTypeId);
const approvals = await storage.getStageApprovalResponses(projectId, stageId);
```

**Optimized Pattern (single comprehensive query):**
```typescript
const notificationData = await storage.getClientNotificationPreviewData(projectId, stageId);
// Returns: { project, client, contacts, stage, template, approvalResponses }
```

**New Query (using Drizzle with relations):**
```typescript
async getClientNotificationPreviewData(projectId: string, stageId: string) {
  return await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      client: {
        with: {
          clientPeople: {
            with: {
              person: true,
            },
          },
        },
      },
      projectType: {
        with: {
          notifications: {
            where: eq(projectTypeNotifications.stageId, stageId),
          },
        },
      },
    },
  });
}
```

**Separate approval query (complex, keep isolated):**
```typescript
const approvalData = await db
  .select({
    fieldId: stageApprovalFields.id,
    fieldName: stageApprovalFields.name,
    responseValue: stageApprovalResponses.value,
  })
  .from(stageApprovalResponses)
  .innerJoin(stageApprovalFields, eq(stageApprovalResponses.approvalFieldId, stageApprovalFields.id))
  .where(and(
    eq(stageApprovalResponses.projectId, projectId),
    eq(stageApprovalFields.stageId, stageId)
  ));
```

**DB Operations Reduction:** 8-12 queries → 2 queries

#### 4.2 Remove Dynamic Imports

**Current Pattern:**
```typescript
async function prepareClientValueNotification(...) {
  const { calculateBusinessHours } = await import('@shared/businessTime');
  const { applicationGraphClient } = await import('../../utils/applicationGraphClient');
  // ...
}
```

**Optimized Pattern:**
```typescript
// Top of file - static imports
import { calculateBusinessHours } from '@shared/businessTime';
import { applicationGraphClient } from '../../utils/applicationGraphClient';

async function prepareClientValueNotification(...) {
  // Direct use, no dynamic import overhead
}
```

**Impact:** Eliminates ~10-50ms overhead per call from dynamic import resolution.

#### 4.3 Memoize Outlook Availability Check

**Rationale:** Outlook availability rarely changes. Cache per session.

```typescript
// Cache Outlook availability for 5 minutes
let outlookAvailabilityCache: { available: boolean; expires: number } | null = null;

async function isOutlookAvailable(): Promise<boolean> {
  if (outlookAvailabilityCache && outlookAvailabilityCache.expires > Date.now()) {
    return outlookAvailabilityCache.available;
  }
  
  const available = await applicationGraphClient.isConfigured();
  outlookAvailabilityCache = {
    available,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  };
  return available;
}
```

#### 4.4 Pre-compute Due Date Formatting

**Current Pattern:**
```typescript
// Calculated in notification preview
const dueDate = calculateDueDate(project, stage);
const formattedDueDate = formatDueDate(dueDate, template.dueDateFormat);
```

**Optimization:** Calculate once and cache on project update:
```typescript
// When project is updated, pre-compute due date info
const dueDateInfo = {
  rawDate: dueDate,
  formatted: formatDueDate(dueDate, 'default'),
  businessDaysRemaining: calculateBusinessDays(new Date(), dueDate),
};
```

---

## Phase 5: Background Operations

**Current Location:** `server/routes/projects/status.ts` (via setImmediate after response)  
**Current Pressure Level:** HIGH  
**Current DB Operations:** 5-10+ per user + external API calls

### Current Flow
```
1. Fetch stage again by ID
2. Resolve assignee (direct user or work role → user lookup)
3. For each user to notify:
   a. Fetch user notification preferences
   b. Fetch full project details again
   c. Fetch project chronology
   d. Call SendGrid API (network call)
4. Call notification scheduler to suppress/reactivate notifications
```

### Critical Issues
1. **Re-fetches data** that was already available in the request
2. **Loop over users** with sequential API calls
3. **External API call** (SendGrid) can be slow or fail
4. **Notification scheduler** does another DB query + loop with individual updates

### Optimization Strategy

#### 5.1 Pass Data Through (Don't Re-fetch)

**Current Pattern:**
```typescript
setImmediate(async () => {
  const stage = await storage.getKanbanStage(stageId); // Re-fetch!
  const project = await storage.getProject(projectId); // Re-fetch!
  const chronology = await storage.getProjectChronology(projectId); // Re-fetch!
  // ... use data
});
```

**Optimized Pattern:**
```typescript
// Capture data before response
const emailContext = {
  project: { ...project, chronology: newChronologyEntry },
  stage: validatedStage,
  previousStage: previousStageInfo,
  assignee: newAssignee,
  changedBy: currentUser,
};

setImmediate(async () => {
  // Use passed data, no re-fetching
  await sendStageChangeEmails(emailContext);
});
```

**DB Operations Reduction:** 3-5 queries → 0 queries

#### 5.2 Batch User Preference Fetching

**Current Pattern:**
```typescript
for (const userId of usersToNotify) {
  const prefs = await storage.getUserNotificationPreferences(userId);
  // ... send email if enabled
}
```

**Optimized Pattern:**
```typescript
// Single query for all users
const userPrefs = await storage.getUserNotificationPreferencesForUsers(usersToNotify);
// Returns Map<userId, preferences>

for (const userId of usersToNotify) {
  const prefs = userPrefs.get(userId);
  if (prefs?.emailEnabled) {
    // ... send email
  }
}
```

**New Query:**
```typescript
async getUserNotificationPreferencesForUsers(userIds: string[]) {
  const prefs = await db
    .select()
    .from(userNotificationPreferences)
    .where(inArray(userNotificationPreferences.userId, userIds));
  
  return new Map(prefs.map(p => [p.userId, p]));
}
```

#### 5.3 Batch Notification Scheduler Updates

**Current Pattern:**
```typescript
const pendingNotifications = await storage.getPendingStageRestrictedNotifications(projectId);
for (const notification of pendingNotifications) {
  if (shouldSuppress(notification, newStage)) {
    await storage.updateNotificationStatus(notification.id, 'suppressed');
  } else if (shouldReactivate(notification, newStage)) {
    await storage.updateNotificationStatus(notification.id, 'pending');
  }
}
```

**Optimized Pattern:**
```typescript
const pendingNotifications = await storage.getPendingStageRestrictedNotifications(projectId);

// Categorize notifications
const toSuppress: string[] = [];
const toReactivate: string[] = [];

for (const notification of pendingNotifications) {
  if (shouldSuppress(notification, newStage)) {
    toSuppress.push(notification.id);
  } else if (shouldReactivate(notification, newStage)) {
    toReactivate.push(notification.id);
  }
}

// Batch updates
await Promise.all([
  toSuppress.length > 0 && storage.batchUpdateNotificationStatus(toSuppress, 'suppressed'),
  toReactivate.length > 0 && storage.batchUpdateNotificationStatus(toReactivate, 'pending'),
]);
```

**New Query:**
```typescript
async batchUpdateNotificationStatus(notificationIds: string[], status: string) {
  await db
    .update(scheduledNotifications)
    .set({ status, updatedAt: new Date() })
    .where(inArray(scheduledNotifications.id, notificationIds));
}
```

**DB Operations Reduction:** 1 + N updates → 1 + 2 updates (max)

#### 5.4 Queue External API Calls

**Rationale:** SendGrid calls can fail or be slow. Use proper job queue.

**Implementation:**
```typescript
// Instead of direct SendGrid call in setImmediate
await emailQueue.add('stage-change-notification', {
  recipientEmail: user.email,
  recipientName: user.name,
  projectName: project.name,
  stageName: stage.name,
  templateId: 'stage-change',
  variables: { ... },
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
});
```

**Benefits:**
- Retries on failure
- Doesn't block any request path
- Can be processed by worker in parallel
- Failure doesn't affect stage change success

---

## Bookkeeping Queries Integration

The upcoming Bookkeeping Queries feature will add additional load to the stage-change flow. This section identifies the impact and mitigation strategies.

### New Load Points

#### 6.1 Stage Change Form Expansion

**New Operations During Stage Change:**
```
When user adds queries during stage change:
1. Validate query data (client-side, minimal server impact)
2. Bulk insert queries (1 query regardless of count)
3. Update query count on project (included in project update)
```

**Mitigation:**
- Use batch insert pattern from start
- Include query count update in main transaction

```typescript
// Within existing stage change transaction
if (queriesToCreate.length > 0) {
  await tx.insert(bookkeepingQueries).values(
    queriesToCreate.map(q => ({
      id: nanoid(),
      projectId,
      ...q,
      status: 'open',
      createdById: userId,
      createdAt: new Date(),
    }))
  );
  
  // Update project query count (already updating project record)
  // Add to existing project update, not separate query
}
```

#### 6.2 Chase Reminder Scheduling

**New Operations After Stage Change:**
```
If queries sent to client:
1. Create query_response_token record
2. Schedule chase reminders (1-3 records)
3. Integrate with existing notification cron
```

**Mitigation:**
- Completely async - happens after response
- Batch insert reminders

```typescript
setImmediate(async () => {
  if (queriesSentToClient) {
    const token = await storage.createQueryResponseToken(projectId, queries);
    
    // Batch insert scheduled reminders
    const reminders = [
      { scheduledFor: addDays(now, 3), channel: 'email' },
      { scheduledFor: addDays(now, 7), channel: 'sms' },
    ];
    await storage.createQueryChaseReminders(token.id, reminders);
  }
});
```

#### 6.3 Client Response Processing

**New Operations (separate from stage change, but related):**
```
When client responds to queries:
1. Update multiple query records (batch)
2. Cancel pending chase reminders (batch)
3. Notify staff (async, queued)
4. Handle file attachments (object storage)
```

**Mitigation:**
- All operations designed for batch processing from start
- File uploads handled via presigned URLs (no server processing)

```typescript
// Batch update queries
await db
  .update(bookkeepingQueries)
  .set({ 
    status: 'answered_by_client',
    clientResponse: sql`CASE id ${queryResponses.map(qr => 
      sql`WHEN ${qr.id} THEN ${qr.response}`
    ).join(' ')} END`,
    answeredAt: new Date(),
  })
  .where(inArray(bookkeepingQueries.id, queryIds));

// Batch cancel reminders
await db
  .update(queryChaseReminders)
  .set({ status: 'cancelled', cancelledAt: new Date(), cancelledReason: 'queries_answered' })
  .where(eq(queryChaseReminders.tokenId, tokenId));
```

### Queries Feature - Summary of Optimizations

| Operation | Design Pattern | Expected Load |
|-----------|---------------|---------------|
| Create queries during stage change | Batch insert | +1 query |
| Create response token | Single insert | +1 query |
| Schedule chase reminders | Batch insert | +1 query |
| Client submits responses | Batch update | +2 queries |
| Cancel reminders | Batch update | +1 query |
| File attachments | Presigned URLs | 0 queries (direct to storage) |

**Total additional load per stage change with queries:** 2-3 queries (well within acceptable range)

---

## Testing Strategy

### Testing Environment

| Property | Value |
|----------|-------|
| **URL** | Root page (`/`) |
| **Credentials** | Obtain from secure password manager or environment variables |
| **Test Account Role** | Admin (full access to all project types and stages) |

### Pre-Testing Checklist

Before each wave:
- [ ] Backup database (checkpoint created)
- [ ] Document current response times (baseline)
- [ ] Count current DB queries for sample stage changes
- [ ] Verify all existing tests pass
- [ ] Identify 3-5 test projects across different project types

### Testing Scenarios

All waves must be tested against these core scenarios:

| Scenario | Description | Complexity |
|----------|-------------|------------|
| **Simple Stage Change** | Stage change with no custom fields, no approvals | Low |
| **Stage with Custom Fields** | Stage change with 3-5 custom field responses | Medium |
| **Stage with Approvals** | Stage change requiring approval fields | Medium |
| **Stage with Assignee Change** | Stage change that triggers handoff thread | Medium |
| **Final Stage** | Stage change to completed/archived stage | High |
| **Stage with Client Notification** | Stage that sends client notification preview | High |
| **Full Complexity** | All of the above combined | Critical |

---

## Implementation Roadmap

### Wave 1: Quick Wins (Week 1)
**Estimated Impact:** 30-40% reduction in DB operations

| Task | File(s) | Complexity | Impact |
|------|---------|------------|--------|
| Batch field response insertions | `projectStatusStorage.ts` | Low | High |
| Batch approval response insertions | `projectStatusStorage.ts` | Low | Medium |
| Remove dynamic imports | `stageChangeNotificationStorage.ts` | Low | Low |
| Pass data through to background ops | `status.ts` | Medium | High |

#### Wave 1: Testing Protocol

**Manual Testing Checklist:**
- [ ] **Simple Stage Change**: Change project from Stage A → Stage B with no fields
  - Verify: Stage updates correctly, chronology entry created
  - Verify: Response time < 500ms
- [ ] **Stage with 5 Custom Fields**: Change stage requiring 5 field responses
  - Verify: All field responses saved correctly
  - Verify: No duplicate entries in `stage_custom_field_responses`
  - Verify: Response time improvement vs. baseline (target: 30% faster)
- [ ] **Stage with 3 Approval Fields**: Change stage requiring approvals
  - Verify: All approval responses saved correctly
  - Verify: Approval validations still work (required fields enforced)
- [ ] **Assignee Handoff**: Change stage that changes project assignee
  - Verify: Handoff message thread created
  - Verify: All participants added correctly
  - Verify: Initial message content is correct
- [ ] **Background Email**: Change stage that triggers email notification
  - Verify: Email sent successfully (check SendGrid logs)
  - Verify: Email contains correct project/stage data
  - Verify: No duplicate emails sent

**Database Verification Queries:**
```sql
-- Verify field responses saved correctly
SELECT * FROM stage_custom_field_responses 
WHERE project_id = '[TEST_PROJECT_ID]' 
ORDER BY responded_at DESC LIMIT 10;

-- Verify chronology entry
SELECT * FROM project_chronology 
WHERE project_id = '[TEST_PROJECT_ID]' 
ORDER BY created_at DESC LIMIT 5;

-- Verify no orphaned records
SELECT COUNT(*) FROM stage_custom_field_responses 
WHERE field_id NOT IN (SELECT id FROM stage_custom_fields);
```

**Success Criteria:**
| Metric | Baseline | Target | Pass/Fail |
|--------|----------|--------|-----------|
| DB queries (5 field stage change) | ~16 | ≤8 | |
| Response time (simple change) | ~800ms | <500ms | |
| Response time (5 fields) | ~1200ms | <700ms | |
| All field responses saved | N/A | 100% | |
| Email delivery success | N/A | 100% | |
| Zero regression in existing functionality | N/A | Required | |

**Rollback Criteria:**
- Any data loss or corruption → Immediate rollback
- Response time degradation > 20% → Rollback and investigate
- Email delivery failure rate > 5% → Rollback and investigate
- Any validation bypass (fields not enforced) → Immediate rollback

---

### Wave 2: Query Consolidation (Week 2)
**Estimated Impact:** 20-30% additional reduction

| Task | File(s) | Complexity | Impact |
|------|---------|------------|--------|
| Create `getStageChangeValidationData()` | `projectStatusStorage.ts` | Medium | Medium |
| Create `getClientNotificationPreviewData()` | `stageChangeNotificationStorage.ts` | Medium | High |
| Batch user preference fetching | `status.ts`, `userStorage.ts` | Low | Medium |
| Batch notification status updates | `notification-scheduler.ts` | Low | Medium |

#### Wave 2: Testing Protocol

**Manual Testing Checklist:**
- [ ] **Validation Accuracy**: Test with invalid stage/reason combinations
  - Verify: Invalid combinations rejected with clear error message
  - Verify: Valid combinations pass validation
- [ ] **Client Notification Preview**: Change to stage with client notification
  - Verify: Preview data complete (client name, contacts, variables)
  - Verify: All template variables replaced correctly
  - Verify: Approval responses included in preview
- [ ] **Multiple Recipients**: Stage change notifying multiple users
  - Verify: All users receive notifications based on preferences
  - Verify: Users with notifications disabled don't receive
- [ ] **Notification Scheduler**: Change stage affecting stage-aware notifications
  - Verify: Eligible notifications reactivated
  - Verify: Ineligible notifications suppressed
  - Verify: Batch update working (check DB for single UPDATE statement)

**Database Verification Queries:**
```sql
-- Verify consolidated query returns correct data
-- (Run before and after, compare results)
SELECT ks.*, cr.*, kscrm.* 
FROM kanban_stages ks
JOIN change_reasons cr ON cr."projectTypeId" = ks."projectTypeId"
LEFT JOIN kanban_stage_change_reason_mappings kscrm 
  ON kscrm."stageId" = ks.id AND kscrm."changeReasonId" = cr.id
WHERE ks.id = '[STAGE_ID]';

-- Verify notification status updates are batched
-- Enable query logging, look for single UPDATE with IN clause
```

**Success Criteria:**
| Metric | Baseline (Post-Wave 1) | Target | Pass/Fail |
|--------|------------------------|--------|-----------|
| Validation DB queries | 4-6 | 2 | |
| Client notification preview queries | 8-12 | 2-3 | |
| Notification scheduler updates | N (1 per notification) | 2 (max) | |
| Response time (with client notification) | ~1000ms | <600ms | |
| Validation accuracy | 100% | 100% | |
| Client notification data completeness | 100% | 100% | |

**Rollback Criteria:**
- Validation allowing invalid stage/reason combinations → Immediate rollback
- Client notification missing data → Rollback
- Notification scheduler not updating correctly → Rollback

---

### Wave 3: Asyncification (Week 3)
**Estimated Impact:** Response time improvement

| Task | File(s) | Complexity | Impact |
|------|---------|------------|--------|
| Move message thread creation to async | `projectStatusStorage.ts` | Low | Medium |
| Move final stage cleanup to async | `projectStatusStorage.ts` | Low | Low |
| Queue email notifications properly | `status.ts`, new `emailQueue.ts` | Medium | High |
| Move notification scheduler to async | `status.ts` | Low | Medium |

#### Wave 3: Testing Protocol

**Manual Testing Checklist:**
- [ ] **Async Thread Creation**: Change stage with assignee handoff
  - Verify: HTTP response returns immediately (<300ms)
  - Verify: Thread created within 5 seconds
  - Verify: Thread visible in messages tab
- [ ] **Final Stage Cleanup**: Move project to completed stage
  - Verify: HTTP response returns immediately
  - Verify: Scheduled notifications cancelled within 10 seconds
  - Verify: Message threads archived within 10 seconds
- [ ] **Email Queue**: Stage change triggering email
  - Verify: HTTP response doesn't wait for email
  - Verify: Email delivered within 30 seconds
  - Verify: Failed emails retry automatically
- [ ] **Error Handling**: Simulate async operation failure
  - Verify: Main stage change not affected by async failures
  - Verify: Errors logged for debugging
  - Verify: Manual retry possible

**Async Verification:**
```typescript
// Add timing logs to verify async behavior
console.log(`[${Date.now()}] HTTP response sent`);
// ... in async handler
console.log(`[${Date.now()}] Async operation started`);
console.log(`[${Date.now()}] Async operation completed`);
```

**Success Criteria:**
| Metric | Baseline (Post-Wave 2) | Target | Pass/Fail |
|--------|------------------------|--------|-----------|
| Response time (all scenarios) | ~600ms | <300ms | |
| Handoff thread creation delay | In-request | <5 seconds | |
| Email delivery delay | In-request | <30 seconds | |
| Async error rate | N/A | <1% | |
| Core operation success rate | 100% | 100% (unaffected by async failures) | |

**Rollback Criteria:**
- Async operations never completing → Rollback
- Core operations failing due to async changes → Immediate rollback
- Response time not improving → Investigate before rollback

---

### Wave 4: Caching Layer (Week 4)
**Estimated Impact:** Consistent sub-300ms response times

| Task | File(s) | Complexity | Impact |
|------|---------|------------|--------|
| Stage config caching | `projectStatusStorage.ts` | Medium | Medium |
| Outlook availability caching | `stageChangeNotificationStorage.ts` | Low | Low |
| Pre-compute due date formatting | `projectStorage.ts` | Medium | Low |

#### Wave 4: Testing Protocol

**Manual Testing Checklist:**
- [ ] **Cache Hit**: Perform same stage change twice within 5 minutes
  - Verify: Second request faster than first
  - Verify: Data still correct (cache not stale)
- [ ] **Cache Invalidation**: Update stage configuration, then perform stage change
  - Verify: New configuration reflected immediately
  - Verify: Old cached data not used
- [ ] **Cache Miss**: Wait 6 minutes, perform stage change
  - Verify: Fresh data fetched from database
  - Verify: Cache repopulated
- [ ] **Outlook Cache**: Check client notification preview
  - Verify: Outlook availability not re-checked on every request
  - Verify: Availability status accurate

**Cache Verification:**
```typescript
// Add cache hit/miss logging
console.log(`Cache ${cached ? 'HIT' : 'MISS'} for stage ${stageId}`);

// Monitor cache size
console.log(`Stage config cache size: ${stageConfigCache.size}`);
```

**Success Criteria:**
| Metric | Baseline (Post-Wave 3) | Target | Pass/Fail |
|--------|------------------------|--------|-----------|
| Response time (p50) | ~300ms | <200ms | |
| Response time (p95) | ~500ms | <300ms | |
| Cache hit rate (after warmup) | N/A | >80% | |
| Stale data incidents | N/A | 0 | |

**Rollback Criteria:**
- Stale data served from cache → Immediate rollback
- Cache not invalidating on config changes → Rollback
- Memory usage growing unbounded → Rollback

---

### Wave 5: Queries Feature Integration (Week 5-6)
**Estimated Impact:** Minimal additional load with new feature

| Task | File(s) | Complexity | Impact |
|------|---------|------------|--------|
| Implement batch query creation | New `queryStorage.ts` | Medium | N/A |
| Implement batch reminder scheduling | New `queryReminderStorage.ts` | Medium | N/A |
| Integrate with stage change flow | `status.ts`, `projectStatusStorage.ts` | Medium | N/A |

#### Wave 5: Testing Protocol

**Manual Testing Checklist:**
- [ ] **Add Queries During Stage Change**: Expand "Add Queries", add 5 queries
  - Verify: All queries saved correctly
  - Verify: Stage change completes normally
  - Verify: Response time increase minimal (<100ms)
- [ ] **Bulk Query Import**: Upload CSV with 50 queries
  - Verify: All queries imported in single batch
  - Verify: Response time acceptable (<2 seconds)
- [ ] **Query with Stage Change**: Add queries AND change stage
  - Verify: Both operations complete in single transaction
  - Verify: Rollback works if either fails
- [ ] **Chase Reminder Scheduling**: Send queries to client
  - Verify: Reminders scheduled correctly
  - Verify: Async scheduling doesn't block response

**Database Verification Queries:**
```sql
-- Verify batch insert worked (not individual inserts)
-- Enable query logging, look for single INSERT with multiple VALUES

-- Verify query count
SELECT COUNT(*) FROM bookkeeping_queries 
WHERE project_id = '[TEST_PROJECT_ID]';

-- Verify reminders scheduled
SELECT * FROM query_chase_reminders 
WHERE token_id IN (
  SELECT id FROM query_response_tokens 
  WHERE project_id = '[TEST_PROJECT_ID]'
);
```

**Success Criteria:**
| Metric | Baseline (Post-Wave 4) | Target | Pass/Fail |
|--------|------------------------|--------|-----------|
| Response time (stage change + 5 queries) | N/A | <400ms | |
| Response time (bulk import 50 queries) | N/A | <2000ms | |
| Additional DB queries per stage change | N/A | ≤3 | |
| Query data integrity | N/A | 100% | |
| Reminder scheduling success | N/A | 100% | |

**Rollback Criteria:**
- Stage change failing when queries added → Rollback queries integration
- Performance degradation > 50% → Rollback and investigate
- Data integrity issues → Immediate rollback

---

## Post-Wave Verification

After completing all waves, run the full test suite:

### End-to-End Regression Test

1. **Create new project** through full lifecycle
2. **Change through all stages** with various configurations
3. **Verify all side effects**:
   - Chronology entries accurate
   - Notifications sent correctly
   - Handoff threads created
   - Time-in-stage calculations correct
   - Client notifications preview complete
4. **Load test** with 10 concurrent stage changes
5. **Verify monitoring** dashboards show expected metrics

### Performance Baseline Comparison

| Metric | Pre-Optimization | Post-Optimization | Improvement |
|--------|------------------|-------------------|-------------|
| DB Operations (simple) | | | |
| DB Operations (complex) | | | |
| Response time (p50) | | | |
| Response time (p95) | | | |
| Background job success rate | | | |

---

## Risk Assessment

### Low Risk Changes
- Batch insertions (same data, fewer queries)
- Removing dynamic imports (static imports are faster)
- Passing data through (eliminates redundant fetches)
- Caching stage configs (short TTL, invalidation on change)

### Medium Risk Changes
- Query consolidation (complex JOINs need testing)
- Moving operations to async (ensure error handling)
- Batch updates (ensure atomicity where needed)

### Higher Risk Changes
- Job queue for emails (new infrastructure)
- Pre-computing due dates (cache invalidation complexity)

### Mitigation Strategies
1. **Feature flags:** Roll out changes behind flags
2. **A/B testing:** Compare performance before/after
3. **Monitoring:** Add timing metrics to each phase
4. **Rollback plan:** Each wave can be reverted independently

---

## Metrics & Monitoring

### Key Metrics to Track

```typescript
// Add timing to stage change handler
const timings = {
  validation: 0,
  transaction: 0,
  postTransaction: 0,
  responsePrep: 0,
  total: 0,
};

const start = Date.now();
// ... validation
timings.validation = Date.now() - start;

// ... etc
```

### Success Criteria

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Total DB operations | 25-55 | 10-20 | Query logging |
| Response time (p50) | ~800ms | <300ms | APM |
| Response time (p95) | ~2000ms | <500ms | APM |
| Background job success | N/A | >99% | Job queue metrics |
| Email delivery latency | In-request | <30s async | SendGrid logs |

---

## Files to Modify

### Primary Files

| File | Changes |
|------|---------|
| `server/storage/projects/projectStatusStorage.ts` | Batch operations, query consolidation, async handlers |
| `server/routes/projects/status.ts` | Data passthrough, async dispatch, timing metrics |
| `server/storage/notifications/stageChangeNotificationStorage.ts` | Query consolidation, static imports, caching |
| `server/notification-scheduler.ts` | Batch updates, async processing |

### New Files

| File | Purpose |
|------|---------|
| `server/storage/queries/queryStorage.ts` | Queries CRUD with batch operations |
| `server/storage/queries/queryReminderStorage.ts` | Chase reminder management |
| `server/queues/emailQueue.ts` | Email job queue (optional, Wave 3) |
| `server/utils/stageChangeCache.ts` | Stage config caching utilities |

### Shared Files

| File | Changes |
|------|---------|
| `shared/businessTime.ts` | Ensure sync version available |
| `server/storage/users/userStorage.ts` | Batch preference fetching |

---

## Appendix: SQL Patterns

### Batch Insert Pattern
```sql
INSERT INTO stage_custom_field_responses (id, field_id, project_id, value, responded_by_id, responded_at)
VALUES 
  ($1, $2, $3, $4, $5, $6),
  ($7, $8, $9, $10, $11, $12),
  ($13, $14, $15, $16, $17, $18)
ON CONFLICT (field_id, project_id) DO UPDATE SET value = EXCLUDED.value;
```

### Batch Update Pattern
```sql
UPDATE scheduled_notifications
SET status = 'suppressed', updated_at = NOW()
WHERE id IN ($1, $2, $3, $4);
```

### Consolidated Validation Query
```sql
SELECT 
  ks.id as stage_id, 
  ks.name as stage_name,
  ks."requiresApproval",
  ks."assigneeType",
  ks."assigneeId",
  cr.id as reason_id,
  cr.name as reason_name,
  CASE WHEN kscrm.id IS NOT NULL THEN true ELSE false END as mapping_valid,
  COALESCE(
    json_agg(DISTINCT jsonb_build_object('id', scf.id, 'name', scf.name, 'type', scf.type)) 
    FILTER (WHERE scf.id IS NOT NULL AND scf."isRequired" = true),
    '[]'
  ) as required_fields
FROM kanban_stages ks
INNER JOIN change_reasons cr ON cr."projectTypeId" = ks."projectTypeId" AND cr.id = $2
LEFT JOIN kanban_stage_change_reason_mappings kscrm 
  ON kscrm."stageId" = ks.id AND kscrm."changeReasonId" = cr.id
LEFT JOIN stage_custom_fields scf ON scf."stageId" = ks.id
WHERE ks.id = $1 AND ks."projectTypeId" = $3
GROUP BY ks.id, cr.id, kscrm.id;
```

---

*Document prepared for review. Implementation pending approval.*
