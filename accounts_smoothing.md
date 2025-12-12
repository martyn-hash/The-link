# Accounts Workflow Smoothing - Implementation Document

## Overview

This feature provides intelligent workload distribution for annual accounts and similar periodic work. It addresses the common accounting practice problem of peaks and troughs in workload by analysing capacity and automatically suggesting optimal months for work completion.

### Key Objectives
- Smooth the distribution of annual accounts work across the year
- Prevent overloading of staff in peak months
- Automatically assign optimal target months when projects are created
- Provide visibility into forward capacity planning

---

## Core Concepts

### The Three Dates
Every annual accounts project has three key dates:

| Date | Description | Example |
|------|-------------|---------|
| **Year End** | The client's accounting period end | 31 December |
| **Due Date** | Statutory filing deadline | 30 September (9 months on) |
| **Target Date** | Internal target for completion | 31 May (5 months on) |

### The Flexible Window
The period between the earliest practical start and the due date represents the **flexible window** where work can be scheduled:

```
Year End ─────── Earliest Start ═══════════ Target ═══════════ Due Date
   │                   │                       │                   │
Dec 31              Feb 1                   May 31             Sep 30
                      └─────── Flexible Window ──────────┘
```

### Weighting System
Not all jobs are equal. A weight score (0.5 to 2.0) indicates relative complexity:

| Weight | Description | Examples |
|--------|-------------|----------|
| 0.5 | Minimal work | Dormant company, very simple records |
| 1.0 | Standard | Typical small company, clean bookkeeping |
| 1.5 | Moderate complexity | Multiple revenue streams, some adjustments |
| 2.0 | High complexity | Groups, consolidations, complex transactions |

### Capacity Formula
For a client manager with N clients:

```
Monthly Target = (Sum of all client weights) / 12
```

**Example:**
- Client manager has 24 clients
- Total weight: 28.5 (mix of complexities)
- Monthly target: 28.5 / 12 = **2.4 weighted units per month**

This means months should aim for ~2.4 weighted units of work, not exactly 2.4 jobs.

---

## Data Model Changes

### New Fields on `clients` Table

```typescript
// Add to clients table
complexityWeight: decimal("complexity_weight", { precision: 3, scale: 2 }).default("1.00"),
// Range: 0.50 to 2.00
// Determines how much capacity this client consumes relative to others
```

### New Fields on `projects` Table

```typescript
// Add to projects table
suggestedStartDate: timestamp("suggested_start_date"),
// Calculated date when main work should begin

scheduledMonth: varchar("scheduled_month"),
// Format: "YYYY-MM" - the month this work is allocated to

schedulingLocked: boolean("scheduling_locked").default(true),
// Once assigned, the month is locked (Option A approach)

schedulingNotes: text("scheduling_notes"),
// Auto-generated notes explaining why this month was chosen
```

### New Table: `capacity_targets`

```typescript
export const capacityTargets = pgTable("capacity_targets", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  yearMonth: varchar("year_month").notNull(), // Format: "YYYY-MM"
  targetCapacity: decimal("target_capacity", { precision: 5, scale: 2 }),
  // Override for specific months (holidays, part-time, etc.)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_user_month").on(table.userId, table.yearMonth),
]);
```

### New Table: `smoothing_snapshots`

For tracking and reporting on distribution over time:

```typescript
export const smoothingSnapshots = pgTable("smoothing_snapshots", {
  id: varchar("id").primaryKey(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  userId: varchar("user_id").references(() => users.id), // null = firm-wide
  yearMonth: varchar("year_month").notNull(),
  projectCount: integer("project_count").notNull(),
  totalWeight: decimal("total_weight", { precision: 6, scale: 2 }),
  targetCapacity: decimal("target_capacity", { precision: 5, scale: 2 }),
  utilizationPercent: decimal("utilization_percent", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## The Pre-Work Stage Flow

When an annual accounts project is created, it follows this lifecycle:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PROJECT LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Year End]                                                              │
│      │                                                                   │
│      ▼                                                                   │
│  PROJECT CREATED (day after year end)                                   │
│      │                                                                   │
│      ▼                                                                   │
│  ┌────────────────────────────────────────┐                             │
│  │  DOCUMENT COLLECTION STAGE             │ ◄── 30-day holding period  │
│  │  - Request bank statements             │                             │
│  │  - Request invoices/receipts           │                             │
│  │  - Verify bookkeeping complete         │                             │
│  └────────────────────────────────────────┘                             │
│      │                                                                   │
│      │ (30 days elapsed OR documents complete)                          │
│      ▼                                                                   │
│  ┌────────────────────────────────────────┐                             │
│  │  MAIN WORK STAGES BEGIN                │ ◄── Scheduled month starts │
│  │  - Records review                      │                             │
│  │  - Draft accounts                      │                             │
│  │  - Manager review                      │                             │
│  │  - Client queries                      │                             │
│  │  - Finalisation                        │                             │
│  └────────────────────────────────────────┘                             │
│      │                                                                   │
│      ▼                                                                   │
│  [TARGET DATE] ──────────────────────────── [DUE DATE]                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Stage Configuration for Smoothing

Annual accounts project types should have a designated **"pre-work" stage** that:
- Is the first stage in the workflow
- Has a configurable duration (default 30 days)
- Does not count towards "active work" capacity
- Acts as a queue/buffer before main work begins

**New field on `kanbanStages` table:**

```typescript
isPreWorkStage: boolean("is_pre_work_stage").default(false),
// Marks this stage as the document collection/holding stage

preWorkDurationDays: integer("pre_work_duration_days"),
// How long projects typically stay here before releasing
```

---

## The Smoothing Algorithm

### On Project Creation

When an annual accounts project is created:

```
FUNCTION assignOptimalMonth(project, clientManager):
    
    1. GET yearEnd from client
    2. CALCULATE dueDate (yearEnd + statutory period, e.g., 9 months)
    3. CALCULATE earliestStart (yearEnd + minimum prep time, e.g., 2 months)
    4. CALCULATE latestTarget (dueDate - safety buffer, e.g., 2 weeks)
    
    5. GET clientWeight from client.complexityWeight
    
    6. FOR each month in range(earliestStart, latestTarget):
        a. GET currentLoad = sum of weights for clientManager in this month
        b. GET targetCapacity = clientManager's target for this month
        c. CALCULATE utilizationIfAdded = (currentLoad + clientWeight) / targetCapacity
        d. STORE month with its utilization score
    
    7. SELECT month with lowest utilizationIfAdded
       (prioritise months closer to yearEnd if scores are equal)
    
    8. SET project.scheduledMonth = selectedMonth
    9. SET project.targetDeliveryDate = end of selectedMonth
    10. SET project.suggestedStartDate = start of selectedMonth - preWorkDays
    
    RETURN project
```

### Capacity Calculation

```
FUNCTION calculateMonthlyCapacity(userId, yearMonth):
    
    1. GET all active projects WHERE:
       - clientManagerId = userId OR projectOwnerId = userId
       - scheduledMonth = yearMonth
       - NOT archived AND NOT inactive
    
    2. FOR each project:
       a. GET client.complexityWeight
       b. ADD to totalWeight
    
    3. GET capacityTarget for this user/month (or use default)
    
    4. RETURN {
         projectCount: count of projects,
         totalWeight: sum of weights,
         targetCapacity: from capacityTargets or calculated default,
         utilizationPercent: (totalWeight / targetCapacity) * 100
       }
```

### Default Target Calculation

If no explicit capacity target is set:

```
FUNCTION calculateDefaultTarget(userId):
    
    1. GET all clients WHERE managerId = userId AND active
    2. SUM all client.complexityWeight
    3. DIVIDE by 12
    
    RETURN monthlyTarget
```

---

## Integration with Project Types

### Identifying Smoothable Project Types

Not all project types should be smoothed (VAT returns have fixed deadlines). Add a flag to `projectTypes`:

```typescript
// Add to projectTypes table
enableWorkloadSmoothing: boolean("enable_workload_smoothing").default(false),
// Only annual accounts and similar flexible work should be smoothed

smoothingLeadTimeDays: integer("smoothing_lead_time_days").default(60),
// Minimum days after year end before work can start

smoothingSafetyBufferDays: integer("smoothing_safety_buffer_days").default(14),
// Days before due date to use as the latest target
```

### Project Type Configuration UI

In the project type settings, add a section:

```
┌─────────────────────────────────────────────────────────────┐
│ Workload Smoothing Settings                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ☑ Enable workload smoothing for this project type           │
│                                                              │
│ Minimum lead time: [60] days after year end                 │
│                                                              │
│ Safety buffer: [14] days before due date                    │
│                                                              │
│ Pre-work stage: [Document Collection ▼]                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## User Interface Components

### 1. Client Complexity Setting

On the client profile, add a complexity weight selector:

```
┌─────────────────────────────────────────────────────────────┐
│ Job Complexity                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Weight: [●───────────────────] 1.0                          │
│         0.5                2.0                               │
│                                                              │
│ ○ Minimal (0.5) - Dormant/very simple                       │
│ ● Standard (1.0) - Typical small company                    │
│ ○ Moderate (1.5) - Some complexity                          │
│ ○ Complex (2.0) - Groups/consolidations                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Capacity Heatmap Dashboard

A calendar view showing workload distribution:

```
┌─────────────────────────────────────────────────────────────┐
│ Capacity Overview - Jane Smith (Client Manager)      2025   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct  │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐│
│ │2.5│ │2.3│ │2.8│ │2.4│ │2.0│ │2.1│ │1.8│ │2.6│ │3.2│ │2.4││
│ │███│ │███│ │███│ │███│ │██ │ │██ │ │█  │ │███│ │███│ │███││
│ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘│
│  ✓     ✓    ⚠     ✓     ✓     ✓     ↓     ✓    ⚠     ✓    │
│                                                              │
│ Legend: ✓ On target  ⚠ Over 110%  ↓ Under 80%  █ Utilization │
│                                                              │
│ Target: 2.4 weighted units/month                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. Project Timeline View

Within a project, show the scheduled timeline:

```
┌─────────────────────────────────────────────────────────────┐
│ ABC Ltd - Annual Accounts 2024                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Year End: 31 Dec 2024                                        │
│ Due Date: 30 Sep 2025                                        │
│ Scheduled Month: April 2025                                  │
│ Weight: 1.5 (Moderate complexity)                            │
│                                                              │
│ Timeline:                                                    │
│ ─────────────────────────────────────────────────────────── │
│ Jan     Feb      Mar       Apr       May    ...    Sep      │
│  │       │        │    ┌────────┐     │              │      │
│  ●───────●────────●────┤  WORK  ├─────●──────────────│      │
│  │    Doc Coll    │    └────────┘     │              │      │
│  │    Stage       │                   │              │      │
│ Year            Docs              Target           Due      │
│ End           Complete                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4. New Client Onboarding

When adding a new client, show capacity impact:

```
┌─────────────────────────────────────────────────────────────┐
│ Adding: New Client Ltd                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Year End: March                                              │
│ Complexity: 1.5 (Moderate)                                   │
│ Client Manager: Jane Smith                                   │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Suggested Schedule: August 2025                          │ │
│ │                                                          │ │
│ │ Jane's August capacity: 2.1 / 2.4 (88%)                 │ │
│ │ After adding this client: 3.6 / 2.4 (150%) ⚠           │ │
│ │                                                          │ │
│ │ Alternative months with better capacity:                 │ │
│ │  • July 2025: 1.8 / 2.4 (75%) → 3.3 / 2.4 (138%)       │ │
│ │  • June 2025: 2.1 / 2.4 (88%) → 3.6 / 2.4 (150%)       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Accept Suggested: August] [Choose Different Month]          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Capacity Endpoints

```
GET /api/capacity/:userId
Returns 12-month forward capacity view for a user

GET /api/capacity/firm-wide
Returns 12-month forward capacity view for entire firm

GET /api/capacity/:userId/:yearMonth
Returns detailed breakdown for specific month

POST /api/capacity/targets
Create/update capacity target override for a user/month
```

### Smoothing Endpoints

```
POST /api/smoothing/calculate-optimal-month
Input: { projectTypeId, clientId, clientManagerId }
Output: { suggestedMonth, alternativeMonths[], capacityImpact }

POST /api/smoothing/assign-month
Input: { projectId, scheduledMonth }
Manually assigns a month (with capacity warnings)

GET /api/smoothing/preview/:clientId
Preview what month would be assigned for a new project
```

---

## Implementation Phases

### Phase 1: Foundation
1. Add `complexityWeight` field to clients table
2. Add scheduling fields to projects table (`scheduledMonth`, `suggestedStartDate`, `schedulingLocked`)
3. Create `capacityTargets` table
4. Build basic capacity calculation functions

### Phase 2: Algorithm
1. Implement the optimal month calculation algorithm
2. Add smoothing settings to project types
3. Integrate automatic month assignment on project creation
4. Add pre-work stage configuration to kanban stages

### Phase 3: Visibility
1. Build capacity heatmap dashboard component
2. Add timeline view to project detail page
3. Create client complexity selector UI
4. Add capacity warnings on new client creation

### Phase 4: Refinement
1. Add capacity target overrides (for holidays, part-time, etc.)
2. Build smoothing snapshots for historical tracking
3. Add reporting on distribution quality over time
4. Consider future Option B: periodic rebalancing suggestions

---

## Edge Cases & Considerations

### Client Leaving
- Archive their projects
- Capacity automatically frees up (no action needed)
- Dashboard will show reduced load in future months

### Urgent/Priority Clients
- Some clients may need to be processed immediately regardless of capacity
- Consider a "priority override" flag that bypasses smoothing
- These still count towards capacity but ignore optimal month logic

### Year End Changes
- If a client changes their year end, projects need rescheduling
- Trigger recalculation of optimal month
- Warn if new year end creates capacity issues

### Multiple Project Types Per Client
- A client might have Annual Accounts AND Corporation Tax
- Each should be smoothed independently but could show combined impact
- Consider grouping related projects to same month vs. spreading

### Staff Changes
- When a client manager leaves, their clients transfer to someone else
- New manager's capacity recalculates automatically
- May create temporary peaks that need manual attention

---

## Success Metrics

Track the effectiveness of smoothing by measuring:

1. **Standard Deviation of Monthly Load**
   - Lower = more even distribution
   - Compare before/after implementation

2. **Peak Month Reduction**
   - What was the highest month's utilization before vs. after?

3. **Projects Completed by Target Date**
   - Should improve as workload becomes more predictable

4. **Staff Satisfaction**
   - Survey on workload predictability and stress levels
