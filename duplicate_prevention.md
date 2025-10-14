# Duplicate Prevention System Analysis

## Executive Summary

The project scheduling system employs a **multi-layered duplicate prevention strategy** to ensure that services never create duplicate projects for the same scheduled date. However, **critical flaws exist** in the current implementation, particularly when handling **retroactive/overdue services** (services with past start dates).

**Status**: ⚠️ **Duplicate prevention is BROKEN for overdue services**

---

## Current Architecture

### Layer 1: Project Table Check (Primary Prevention)
**Location**: `server/project-scheduler.ts` lines 1093-1116

```typescript
const duplicateProject = allProjects.find((project: any) => {
  if (project.clientId !== dueService.clientId || 
      project.projectTypeId !== dueService.service.projectType?.id) {
    return false;
  }
  const projectDate = project.createdAt ? project.createdAt.toISOString().split('T')[0] : null;
  return projectDate === scheduledDate;
});
```

**How it works**:
- Fetches ALL projects via `storage.getAllProjects()`
- Searches for existing project matching: client + project type + **createdAt date**
- Compares `project.createdAt` (actual creation timestamp) with `scheduledDate` (service's nextStartDate)

**❌ Critical Flaw**: 
- **Compares wrong dates!** 
- `project.createdAt` = when project was actually created (e.g., Oct 14)
- `scheduledDate` = service's original scheduled date (e.g., Oct 1)
- These never match for overdue services!

**Example Failure**:
```
Service: Monthly Bookkeeping, nextStartDate = Oct 1
Today: Oct 14 (service is overdue)

First Run (Oct 14):
- scheduledDate = "2025-10-01" (from nextStartDate)
- Creates project with createdAt = "2025-10-14" (today)
- Duplicate check: "2025-10-14" === "2025-10-01" → FALSE ✗
- Project created successfully

Second Run (Oct 14):
- Same service still due (Oct 1 <= Oct 14)
- scheduledDate = "2025-10-01"
- Duplicate check looks for project.createdAt = "2025-10-01"
- Existing project has createdAt = "2025-10-14"
- Duplicate check: "2025-10-14" === "2025-10-01" → FALSE ✗
- Creates DUPLICATE project! ✗✗✗
```

---

### Layer 2: Scheduling History Check (Secondary Prevention)
**Location**: `server/project-scheduler.ts` lines 1118-1144

```typescript
const schedulingHistory = await storage.getProjectSchedulingHistoryByServiceId(dueService.id, dueService.type);

const existingProjectOnDate = schedulingHistory.find(entry => {
  if (!entry.projectId) return false;
  const entryDate = entry.scheduledDate.toISOString().split('T')[0];
  const targetDate = dueService.nextStartDate.toISOString().split('T')[0];
  return entryDate === targetDate && (entry.action === 'created' || entry.action === 'created_no_reschedule');
});
```

**How it works**:
- Queries `project_scheduling_history` table for entries matching this service
- Looks for entries where `scheduledDate` matches the service's `nextStartDate`
- Checks for action types: 'created' or 'created_no_reschedule'

**✓ This logic is CORRECT!**
- Properly compares `entry.scheduledDate` with `dueService.nextStartDate`
- Should prevent duplicates by checking if project was already created for this date

**🔍 Why might it still fail?**:
1. **Timing Issue**: History is logged AFTER project creation, so concurrent runs could slip through
2. **Service Rescheduling**: If service is rescheduled BEFORE history is logged, nextStartDate changes
3. **Action Mismatch**: If logged with different action name, won't be found

---

### Layer 3: Core Module Duplicate Prevention
**Location**: `server/core/project-creator.ts` lines 44-79

```typescript
// Check 1: Project duplication
export async function checkForDuplicateProject(
  clientId: string,
  projectTypeId: string,
  scheduledDate: Date
): Promise<Project | null> {
  const dateString = scheduledDate.toISOString().split('T')[0];
  const allProjects = await storage.getAllProjects();
  
  const duplicateProject = allProjects.find((project: any) => {
    if (project.clientId !== clientId || project.projectTypeId !== projectTypeId) {
      return false;
    }
    const projectDate = project.createdAt ? project.createdAt.toISOString().split('T')[0] : null;
    return projectDate === dateString;
  });
  
  return duplicateProject || null;
}

// Check 2: Scheduling history
export async function checkSchedulingHistory(
  serviceId: string,
  serviceType: 'client' | 'people',
  scheduledDate: Date
): Promise<boolean> {
  const dateString = scheduledDate.toISOString().split('T')[0];
  const schedulingHistory = await storage.getProjectSchedulingHistoryByServiceId(serviceId, serviceType);
  
  return schedulingHistory.some((history: any) => {
    const historyDate = history.scheduledDate ? history.scheduledDate.toISOString().split('T')[0] : null;
    return historyDate === dateString && history.action === 'project_created';
  });
}
```

**❌ Critical Issues**:
1. **Same createdAt vs scheduledDate bug** as Layer 1
2. **Different action name!** Looks for 'project_created' but scheduler logs 'created' or 'created_no_reschedule'
3. **This module is NOT being used by the scheduler!** It has its own duplicate prevention logic

---

## Order of Operations (Current Flow)

```
1. Service detected as due via isServiceDueToday(nextStartDate <= targetDate)
   ↓
2. processService() called
   ↓
3. createProjectFromService() called
   ├── Check Layer 1: project.createdAt === scheduledDate ❌ FAILS FOR OVERDUE
   ├── Check Layer 2: scheduling history ✓ SHOULD WORK
   ├── Create project if no duplicate found
   └── Return project
   ↓
4. rescheduleService() updates service.nextStartDate to next occurrence
   ↓
5. logSchedulingAction() creates scheduling history entry
   ↓
6. Process complete
```

**🚨 Critical Bug**: Scheduling history is logged AFTER project creation, but duplicate check happens BEFORE. Race conditions possible!

---

## Root Cause Analysis

### Why Overdue Services Break Duplicate Prevention

**The Core Problem**: When `isServiceDueToday()` was changed from exact match (`===`) to on-or-before (`<=`):

1. **Services become "perpetually due"** until rescheduled
   - Service with nextStartDate = Oct 1 is "due" on Oct 14, Oct 15, Oct 16...
   
2. **Duplicate prevention compares wrong dates**:
   - Looks for `project.createdAt` matching `scheduledDate` (service's nextStartDate)
   - But overdue projects have `createdAt` = today, not the original scheduled date
   
3. **History check SHOULD work, but timing matters**:
   - If service is rescheduled before second run, won't be caught again
   - If rescheduling fails, will be caught again but history should prevent duplicate
   - Unless history isn't logged yet (race condition)

### Test Results Evidence

```
First Run (Oct 14):
- 11 projects exist
- Scheduler creates 2 projects (overdue services caught)
- Total: 13 projects ✓

Second Run (Oct 14):  
- 13 projects exist
- Scheduler creates 7 MORE projects ❌
- Total: 20 projects (7 duplicates created!)
```

**Why 7 duplicates instead of just 2?**
- Multiple services were overdue
- Each service failing duplicate prevention
- Possibly catching same services multiple times OR different services with similar issues

---

## Database Schema: project_scheduling_history

```typescript
{
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientServiceId: varchar("client_service_id").references(() => clientServices.id),
  peopleServiceId: varchar("people_service_id").references(() => peopleServices.id),
  projectId: varchar("project_id").references(() => projects.id),
  action: varchar("action").notNull(), // 'created', 'rescheduled', 'skipped', 'failed'
  scheduledDate: timestamp("scheduled_date").notNull(), // ← The date service was scheduled for
  previousNextStartDate: timestamp("previous_next_start_date"),
  previousNextDueDate: timestamp("previous_next_due_date"),
  newNextStartDate: timestamp("new_next_start_date"),
  newNextDueDate: timestamp("new_next_due_date"),
  frequency: varchar("frequency"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}
```

**Indexes**:
- `idx_project_scheduling_history_client_service_id` (for quick service lookups)
- `idx_project_scheduling_history_people_service_id`
- `idx_project_scheduling_history_project_id`
- `idx_project_scheduling_history_action`
- `idx_project_scheduling_history_scheduled_date`

**Purpose**: Audit trail + duplicate prevention via scheduledDate comparison

---

## Proposed Solution: Bulletproof Duplicate Prevention

### Strategy 1: Fix the Date Comparison Logic ⭐ RECOMMENDED

**Change**: Compare scheduledDate to scheduledDate, not to createdAt

**Implementation**:
```typescript
// Option A: Store scheduledDate on projects table
const duplicateProject = allProjects.find((project: any) => {
  if (project.clientId !== dueService.clientId || 
      project.projectTypeId !== dueService.service.projectType?.id) {
    return false;
  }
  // Compare scheduled dates, not creation dates
  const projectScheduledDate = project.scheduledDate ? 
    project.scheduledDate.toISOString().split('T')[0] : null;
  return projectScheduledDate === scheduledDate;
});

// Option B: Use projectMonth field (already exists)
// Extract date from projectMonth format "DD/MM/YYYY"
const duplicateProject = allProjects.find((project: any) => {
  if (project.clientId !== dueService.clientId || 
      project.projectTypeId !== dueService.service.projectType?.id) {
    return false;
  }
  // projectMonth is normalized "DD/MM/YYYY" format
  const projectDateParts = project.projectMonth?.split('/');
  if (!projectDateParts || projectDateParts.length !== 3) return false;
  const projectScheduledDate = `${projectDateParts[2]}-${projectDateParts[1]}-${projectDateParts[0]}`;
  return projectScheduledDate === scheduledDate;
});
```

**Pros**:
- Fixes root cause
- No schema changes needed (use existing projectMonth)
- Backward compatible

**Cons**:
- projectMonth parsing is fragile
- Better to add explicit scheduledDate field

---

### Strategy 2: Rely on Scheduling History ONLY ⭐ RECOMMENDED

**Change**: Remove Layer 1 (project table check), make Layer 2 the primary check

**Implementation**:
```typescript
async function createProjectFromService(dueService: DueService): Promise<any> {
  const scheduledDate = dueService.nextStartDate.toISOString().split('T')[0];
  
  // ONLY CHECK: Scheduling history (remove project table check)
  if (dueService.type === 'client') {
    const schedulingHistory = await storage.getProjectSchedulingHistoryByServiceId(
      dueService.id, 
      dueService.type
    );
    
    const existingProjectOnDate = schedulingHistory.find(entry => {
      if (!entry.projectId) return false;
      const entryDate = entry.scheduledDate.toISOString().split('T')[0];
      const targetDate = dueService.nextStartDate.toISOString().split('T')[0];
      return entryDate === targetDate && 
             (entry.action === 'created' || entry.action === 'created_no_reschedule');
    });

    if (existingProjectOnDate) {
      console.log(`Duplicate prevented: Service ${dueService.id} already has project for ${scheduledDate}`);
      const existingProject = await storage.getProjectById(existingProjectOnDate.projectId);
      return existingProject;
    }
  }
  
  // Proceed with project creation...
}
```

**Pros**:
- Scheduling history is the source of truth
- Already has correct date comparison logic
- Indexed for performance

**Cons**:
- Must ensure history is ALWAYS logged (even on errors)
- Requires logging history BEFORE project creation (order change)

---

### Strategy 3: Transaction-Based Atomic Prevention ⭐ MOST ROBUST

**Change**: Use database transactions to ensure atomic duplicate checking + creation

**Implementation**:
```typescript
async function createProjectFromService(dueService: DueService): Promise<any> {
  return await db.transaction(async (tx) => {
    const scheduledDate = dueService.nextStartDate;
    
    // 1. Check scheduling history within transaction
    const history = await tx.select()
      .from(projectSchedulingHistory)
      .where(
        and(
          eq(projectSchedulingHistory.clientServiceId, dueService.id),
          eq(projectSchedulingHistory.scheduledDate, scheduledDate),
          or(
            eq(projectSchedulingHistory.action, 'created'),
            eq(projectSchedulingHistory.action, 'created_no_reschedule')
          )
        )
      )
      .limit(1);
    
    if (history.length > 0) {
      // Duplicate found, return existing project
      const project = await tx.select()
        .from(projects)
        .where(eq(projects.id, history[0].projectId))
        .limit(1);
      return project[0];
    }
    
    // 2. Create project
    const project = await tx.insert(projects).values(projectData).returning();
    
    // 3. Log scheduling history immediately
    await tx.insert(projectSchedulingHistory).values({
      clientServiceId: dueService.id,
      projectId: project[0].id,
      action: 'created',
      scheduledDate: scheduledDate,
      // ... other fields
    });
    
    // 4. Reschedule service
    await tx.update(clientServices)
      .set({ nextStartDate: newNextStartDate, nextDueDate: newNextDueDate })
      .where(eq(clientServices.id, dueService.id));
    
    return project[0];
  });
}
```

**Pros**:
- **Atomic**: All-or-nothing guarantee
- **Concurrent-safe**: Prevents race conditions
- **Single source of truth**: History check + creation in one transaction

**Cons**:
- Requires refactoring to use Drizzle transactions
- More complex implementation

---

### Strategy 4: Add Unique Database Constraint 🛡️ ULTIMATE SAFETY NET

**Change**: Add unique constraint on projects table to make duplicates impossible at DB level

**Schema Addition**:
```typescript
export const projects = pgTable("projects", {
  // ... existing fields ...
  clientId: varchar("client_id").notNull(),
  projectTypeId: varchar("project_type_id").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(), // NEW FIELD
}, (table) => [
  // NEW CONSTRAINT: One project per client+type+date
  unique("unique_client_project_type_date")
    .on(table.clientId, table.projectTypeId, table.scheduledDate),
]);
```

**Migration**:
```sql
-- Add scheduledDate column
ALTER TABLE projects ADD COLUMN scheduled_date TIMESTAMP;

-- Backfill from projectMonth or use createdAt as fallback
UPDATE projects SET scheduled_date = created_at WHERE scheduled_date IS NULL;

-- Add unique constraint
ALTER TABLE projects 
  ADD CONSTRAINT unique_client_project_type_date 
  UNIQUE (client_id, project_type_id, scheduled_date);
```

**Pros**:
- **Impossible to create duplicates** - database enforces it
- **Catches bugs at any layer**
- **Self-documenting** business rule

**Cons**:
- Requires schema migration
- Must handle unique constraint errors gracefully

---

## Recommended Implementation Plan

### Phase 1: Immediate Fix (Quick Win)
1. ✅ **Fix Layer 2 check**: Already correct, just ensure it's always used
2. ✅ **Remove broken Layer 1**: Stop using createdAt comparison
3. ✅ **Reorder operations**: Log history BEFORE rescheduling

**Changes**:
```typescript
// In createProjectFromService():
// 1. Check scheduling history (KEEP - already correct)
// 2. Create project
// 3. Log scheduling history IMMEDIATELY
// 4. Reschedule service (move to after logging)
```

### Phase 2: Structural Improvement (Medium-term)
1. 📊 **Add scheduledDate field** to projects table
2. 🔄 **Update duplicate check** to use scheduledDate instead of createdAt
3. 📝 **Backfill existing projects** with scheduledDate from projectMonth

### Phase 3: Bulletproof System (Long-term)
1. 🔒 **Implement transactions** for atomic duplicate prevention
2. 🛡️ **Add unique constraint** on (clientId, projectTypeId, scheduledDate)
3. 🧪 **Add comprehensive tests** for edge cases

---

## Testing Recommendations

### Critical Test Cases

1. **Retroactive Service Creation**:
   ```
   - Create service with nextStartDate = 30 days ago
   - Run scheduler today
   - Verify: 1 project created
   - Run scheduler again
   - Verify: 0 projects created (duplicate prevented)
   ```

2. **Multiple Overdue Services**:
   ```
   - Create 5 services with nextStartDate = 14 days ago
   - Run scheduler today
   - Verify: 5 projects created
   - Run scheduler again
   - Verify: 0 projects created
   ```

3. **Weekly Service Edge Case**:
   ```
   - Create weekly service with nextStartDate = 2 weeks ago
   - Run scheduler today
   - Verify: Only 1 project created (not 2)
   - Run scheduler 7 days later
   - Verify: 1 new project created (next occurrence)
   ```

4. **Concurrent Scheduler Runs**:
   ```
   - Start scheduler run #1
   - Start scheduler run #2 before #1 completes
   - Verify: No duplicate projects created
   ```

5. **Service Without Rescheduling (Companies House)**:
   ```
   - Create CH service marked as isCompaniesHouseService=true
   - Run scheduler
   - Verify: Project created, service NOT rescheduled
   - Run scheduler again
   - Verify: No duplicate project (history check works)
   ```

---

## Action Items

### Immediate (Today)
- [ ] Fix duplicate prevention to use scheduling history as primary check
- [ ] Remove broken createdAt comparison logic
- [ ] Reorder operations: log history before rescheduling
- [ ] Add comprehensive logging to track duplicate prevention decisions

### Short-term (This Week)
- [ ] Add scheduledDate field to projects table
- [ ] Update duplicate prevention to use scheduledDate
- [ ] Write comprehensive tests for overdue services
- [ ] Add alerting for duplicate project creation

### Medium-term (This Month)
- [ ] Implement transaction-based duplicate prevention
- [ ] Add unique database constraint
- [ ] Refactor to use core/project-creator.ts module (unify duplicate logic)
- [ ] Performance optimization: cache scheduling history

---

## Conclusion

The current duplicate prevention system has **three critical flaws**:

1. **Wrong date comparison**: Comparing `createdAt` vs `scheduledDate` fails for overdue services
2. **Non-atomic operations**: History logged after project creation allows race conditions
3. **Redundant logic**: Three different duplicate checks with inconsistent action names

**Recommended Fix**: Use scheduling history as the single source of truth, implement atomic transactions, and add database constraints as a safety net.

**Impact**: Without fixes, overdue services will create duplicate projects on every scheduler run, causing data corruption and user confusion.

**Urgency**: 🔴 **CRITICAL** - This breaks the core business logic and must be fixed before retroactive scheduling is used in production.
