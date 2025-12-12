# Accounts Workflow Smoothing - Implementation Document

## Quick Reference Summary

**Purpose:** Intelligently distribute annual accounts work across months to eliminate peaks and troughs.

**Key Data Points:**
- Complexity weight: Stored on `client_services` mapping (0.5-2.0 scale, default 1.0)
- Service owner: Defined per client-service in `client_services.serviceOwnerId`
- Capacity target: `staff_service_capacity.annualCapacity / 12` OR `SUM(client_services.complexityWeight) / 12`

**Two-Phase Scheduling:**
1. **Provisional** (project created) → Best guess based on current capacity
2. **Confirmed** (docs received) → Recalculated based on real-time capacity

**Tolerance Zones:**
| Zone | Utilization | Behaviour |
|------|-------------|-----------|
| Green | 0-100% | Auto-assign |
| Amber | 100-120% | Auto-assign with warning |
| Red | 120-150% | Human approval required |
| Critical | 150%+ | Escalate to management |

**Auto-Rebalancing:** Before declaring capacity breached, system moves flexible work (60+ days slack) to make room.

**Stage Triggers (Project Type Settings):**
- `preWorkStageId` → Triggers provisional scheduling
- `readyQueueStageId` → Triggers confirmed scheduling  
- `mainWorkStageId` → Triggers "in progress" status

**Implementation MVP: ~15-20 days** (Phases 1-3, 5-6 basic)

---

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
For a service owner (the person responsible for delivering a service to clients):

```
Monthly Target = (Sum of complexity weights for owned services) / 12
```

**Example:**
- Jane owns annual accounts for 24 clients
- Total weight from client_services: 28.5 (mix of complexities)
- Monthly target: 28.5 / 12 = **2.4 weighted units per month**

This means months should aim for ~2.4 weighted units of work, not exactly 2.4 jobs.

**Note:** Only services with `enableComplexityWeighting = TRUE` count toward this target. VAT returns, payroll, etc. have fixed deadlines and are excluded from smoothing calculations.

---

## Data Model Changes

### New Fields on `services` Table

```typescript
// Add to services table
enableComplexityWeighting: boolean("enable_complexity_weighting").default(false),
// TRUE for services that should be smoothed (annual accounts)
// FALSE for fixed-deadline services (VAT returns, payroll)
```

### New Fields on `client_services` Table (Mapping)

```typescript
// Add to client_services table (the client-service mapping)
serviceOwnerId: varchar("service_owner_id").references(() => users.id),
// Who owns THIS service for THIS client (may differ from client manager)

complexityWeight: decimal("complexity_weight", { precision: 3, scale: 2 }).default("1.00"),
// Range: 0.50 to 2.00
// Weight for THIS specific client-service combination
// Only relevant when service.enableComplexityWeighting = TRUE
// DEFAULT: 1.00 - used for legacy data or if not explicitly set
```

### Default Complexity Weight Handling

**Critical rule:** If `complexityWeight` is null, undefined, or missing (legacy data, system glitch), **always default to 1.00**.

```
FUNCTION getComplexityWeight(clientServiceId):
    
    weight = clientService.complexityWeight
    
    IF weight IS NULL OR weight IS UNDEFINED:
        RETURN 1.00  // Safe default for legacy/missing data
    
    IF weight < 0.50:
        RETURN 0.50  // Minimum floor
    
    IF weight > 2.00:
        RETURN 2.00  // Maximum ceiling
    
    RETURN weight
```

This ensures:
- Legacy data without complexity scores still works (treated as "standard" complexity)
- System glitches don't break calculations
- All capacity calculations have valid weights

**Why at service level?**
- Same client might have simple accounts (0.5) but complex payroll (1.5)
- Different staff may own different services for the same client
- Only "smoothable" services (annual accounts) participate in capacity planning

### New Fields on `projects` Table

```typescript
// Add to projects table

// Schedule status: tracks where in the scheduling lifecycle
scheduleStatus: varchar("schedule_status"),
// Values: 'provisional' | 'confirmed' | 'in_progress' | 'completed' | 'delayed'

// Provisional scheduling (assigned at project creation)
provisionalScheduledMonth: varchar("provisional_scheduled_month"),
// Format: "YYYY-MM" - best guess based on capacity at creation time

// Confirmed scheduling (assigned when docs received)
confirmedScheduledMonth: varchar("confirmed_scheduled_month"),
// Format: "YYYY-MM" - actual month based on real-time capacity when docs arrive

suggestedStartDate: timestamp("suggested_start_date"),
// Calculated date when main work should begin (set on confirmation)

schedulingNotes: text("scheduling_notes"),
// Auto-generated notes explaining why this month was chosen

// Delay tracking
originalScheduledMonth: varchar("original_scheduled_month"),
// If rescheduled, stores the original month for reporting

delayReason: varchar("delay_reason"),
// If delayed: 'documents_late' | 'capacity_full' | 'client_request' | 'other'
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

## The Two-Stage Pre-Work Flow

When an annual accounts project is created, it follows this lifecycle with **two distinct pre-work stages**:

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
│  │  STAGE 1: GATHER DOCUMENTS             │ ◄── Active chasing stage   │
│  │  - Request bank statements             │     No time pressure yet   │
│  │  - Request invoices/receipts           │     Client manager works   │
│  │  - Chase outstanding items             │     to collect everything  │
│  │  - Verify bookkeeping complete         │                             │
│  └────────────────────────────────────────┘                             │
│      │                                                                   │
│      │ (Client manager confirms all docs received)                       │
│      ▼                                                                   │
│  ┌────────────────────────────────────────┐                             │
│  │  STAGE 2: READY TO START               │ ◄── Holding bay / queue    │
│  │  - All documents received              │     Waiting for scheduled  │
│  │  - Work is queued                      │     slot to open           │
│  │  - Nightly job checks if slot ready    │                             │
│  └────────────────────────────────────────┘                             │
│      │                                                                   │
│      │ (Nightly scheduler: suggestedStartDate reached)                   │
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

### Key Distinction Between the Two Pre-Work Stages

| Stage | Purpose | Trigger to Exit | Time Pressure |
|-------|---------|-----------------|---------------|
| **Gather Documents** | Actively chase client for records | Client manager manually moves when complete | Low - depends on client responsiveness |
| **Ready to Start** | Queue waiting for scheduled slot | Nightly scheduler moves when date reached | None - system controlled |

### Stage Configuration for Smoothing

Annual accounts project types should have designated **pre-work stages** that the system recognises:

**New fields on `kanbanStages` table:**

```typescript
smoothingStageType: varchar("smoothing_stage_type"),
// Values: 'gather_documents' | 'ready_to_start' | 'main_work' | null
// Identifies the stage's role in the smoothing workflow

isSchedulerControlled: boolean("is_scheduler_controlled").default(false),
// If true, projects exit this stage via the nightly scheduler, not manually
```

---

## The Nightly Scheduling Process

A scheduled job runs each night (e.g., 2:00 AM) to manage work release:

```
NIGHTLY SCHEDULER JOB

1. FIND all projects WHERE:
   - Current stage has smoothingStageType = 'ready_to_start'
   - suggestedStartDate <= TODAY
   - NOT archived AND NOT inactive

2. FOR each project:
   a. GET the next stage (first 'main_work' stage)
   b. MOVE project to that stage
   c. NOTIFY the assigned user: "ABC Ltd accounts is ready to start"
   d. LOG the transition in project chronology

3. FIND projects at risk (still in 'gather_documents' but running late):
   - WHERE current stage has smoothingStageType = 'gather_documents'
   - AND suggestedStartDate is within 14 days
   - AND documents still outstanding
   
4. FOR each at-risk project:
   a. FLAG project with warning indicator
   b. NOTIFY client manager: "ABC Ltd docs still outstanding - scheduled start in 10 days"

5. FIND critical projects (approaching due date):
   - WHERE dueDate is within 30 days
   - AND project not yet in main work stages
   
6. FOR each critical project:
   a. ESCALATE to manager/partner
   b. SEND urgent notification
```

### Scheduler Configuration

**New table: `scheduler_config`**

```typescript
export const schedulerConfig = pgTable("scheduler_config", {
  id: varchar("id").primaryKey(),
  configKey: varchar("config_key").notNull().unique(),
  configValue: jsonb("config_value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Example config entries:
// { key: "scheduler_run_time", value: "02:00" }
// { key: "at_risk_warning_days", value: 14 }
// { key: "critical_escalation_days", value: 30 }
```

---

## The Capacity Heatmap / Calendar View

The capacity calendar displays **forward-looking scheduled work**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Work Pipeline - Jane Smith                                    2025      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  January          February          March            April              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│ │ ████████ 2.5 │ │ ██████ 2.0   │ │ ████████ 2.4 │ │ ██████████ 3.1│    │
│ │              │ │              │ │              │ │          ⚠  │    │
│ │ In Progress: │ │ In Progress: │ │ Scheduled:   │ │ Scheduled:   │    │
│ │ • ABC Ltd    │ │ • DEF Co     │ │ • GHI Ltd    │ │ • JKL Co     │    │
│ │ • MNO Ltd    │ │ • PQR Ltd    │ │ • STU Ltd    │ │ • VWX Ltd    │    │
│ │              │ │              │ │              │ │ • YZ Ltd     │    │
│ │ Ready:       │ │ Ready:       │ │ Ready:       │ │ • AAA Ltd    │    │
│ │ • STU Ltd    │ │ • GHI Ltd    │ │ • JKL Co     │ │              │    │
│ │              │ │              │ │ • VWX Ltd    │ │              │    │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                                          │
│ Legend: In Progress = main work stages | Ready = in 'Ready to Start'   │
│         Target: 2.4/month | ⚠ = over 120% capacity                      │
│                                                                          │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Gathering Documents (not yet scheduled):                            │ │
│ │ • BBB Ltd (Year End: Dec 24) - awaiting bank statements            │ │
│ │ • CCC Ltd (Year End: Nov 24) - awaiting purchase invoices ⚠ LATE   │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

This gives visibility into:
- **What's being worked on now** (in main stages)
- **What's queued and when it will arrive** (in Ready to Start)
- **What's still being chased** (in Gather Documents)
- **What's at risk** (late document collection)

---

## The Smoothing Algorithm

### Key Concept: Provisional vs Confirmed Scheduling

The scheduled month is not fixed at project creation. Instead:

- **Provisional Schedule**: Assigned at project creation (best guess based on current capacity)
- **Confirmed Schedule**: Recalculated when documents are received (based on real-time capacity)

This handles the reality that clients don't always send documents on time.

```
SCHEDULING LIFECYCLE:

Project Created ────► Provisional Schedule: April
                      (based on capacity at creation time)
                      
Waiting for docs...   April passes, docs still not received
                      
Docs finally arrive ─► RECALCULATE optimal month
(now June)            ─► Confirmed Schedule: July
                      (based on current capacity, July has most space)
```

### On Project Creation (Provisional Schedule)

When an annual accounts project is created:

```
FUNCTION assignProvisionalMonth(project, clientManager):
    
    1. GET yearEnd from client
    2. CALCULATE dueDate (yearEnd + statutory period, e.g., 9 months)
    3. CALCULATE earliestStart (yearEnd + minimum prep time, e.g., 2 months)
    4. CALCULATE latestTarget (dueDate - safety buffer, e.g., 2 weeks)
    
    5. GET clientWeight from client.complexityWeight
    
    6. FOR each month in range(earliestStart, latestTarget):
        a. GET currentLoad = sum of CONFIRMED weights for this month
        b. GET provisionalLoad = sum of PROVISIONAL weights for this month
        c. GET targetCapacity = clientManager's target for this month
        d. CALCULATE utilizationIfAdded = (currentLoad + provisionalLoad + clientWeight) / targetCapacity
        e. STORE month with its utilization score
    
    7. SELECT month with lowest utilizationIfAdded
       (prioritise months closer to yearEnd if scores are equal)
    
    8. SET project.provisionalScheduledMonth = selectedMonth
    9. SET project.scheduleStatus = 'provisional'
    
    RETURN project
```

### On Document Receipt (Confirmed Schedule)

When a project moves from "Gather Documents" to "Ready to Start":

```
FUNCTION confirmScheduledMonth(project, clientManager):
    
    1. GET today's date
    2. GET dueDate from project
    3. CALCULATE earliestStart = MAX(today, original earliestStart)
       // Can't schedule in the past!
    4. CALCULATE latestTarget (dueDate - safety buffer)
    
    5. GET clientWeight from client.complexityWeight
    
    6. FOR each month in range(earliestStart, latestTarget):
        a. GET confirmedLoad = sum of CONFIRMED weights only
        b. GET targetCapacity = clientManager's target for this month
        c. CALCULATE utilizationIfAdded = (confirmedLoad + clientWeight) / targetCapacity
        d. STORE month with its utilization score
    
    7. SELECT month with lowest utilizationIfAdded
       (prioritise earlier months if scores are equal - get it done sooner)
    
    8. SET project.confirmedScheduledMonth = selectedMonth
    9. SET project.scheduleStatus = 'confirmed'
    10. SET project.suggestedStartDate = start of selectedMonth
    
    RETURN project
```

### Why This Works for Late Documents

**Scenario:** 5 clients all send documents in the same month (June) when they were scheduled for different months.

```
Client A: Provisional April → Docs arrive June → Confirmed June (first in queue)
Client B: Provisional March → Docs arrive June → Confirmed June (still space)
Client C: Provisional May → Docs arrive June → Confirmed July (June now full)
Client D: Provisional April → Docs arrive June → Confirmed July (joins queue)
Client E: Provisional May → Docs arrive June → Confirmed August (July filling up)
```

Each client gets slotted into the **next available capacity** at the moment their documents arrive. The system automatically spreads the work.

### Capacity Calculation (Dual View)

```
FUNCTION calculateMonthlyCapacity(userId, yearMonth):
    
    1. GET all active projects WHERE:
       - clientManagerId = userId OR projectOwnerId = userId
       - NOT archived AND NOT inactive
    
    2. SEPARATE into:
       a. CONFIRMED: scheduleStatus = 'confirmed' AND confirmedScheduledMonth = yearMonth
       b. PROVISIONAL: scheduleStatus = 'provisional' AND provisionalScheduledMonth = yearMonth
    
    3. CALCULATE:
       - confirmedWeight = sum of weights for confirmed projects
       - provisionalWeight = sum of weights for provisional projects
       - totalWeight = confirmedWeight + provisionalWeight
    
    4. GET targetCapacity for this user/month (or use default)
    
    5. RETURN {
         confirmedCount: count of confirmed projects,
         confirmedWeight: sum of confirmed weights,
         provisionalCount: count of provisional projects,
         provisionalWeight: sum of provisional weights,
         totalWeight: confirmedWeight + provisionalWeight,
         targetCapacity: from capacityTargets or calculated default,
         confirmedUtilization: (confirmedWeight / targetCapacity) * 100,
         totalUtilization: (totalWeight / targetCapacity) * 100
       }
```

### Dashboard Display: Confirmed vs Provisional

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Capacity View - Jane Smith                                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ April 2025                                                              │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ████████████░░░░░░░░ │ 2.5 confirmed + 1.5 provisional = 4.0 total │ │
│ │ ▲ confirmed  ▲ provisional                                         │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ Target: 2.4 │ Confirmed: 104% ✓ │ If all provisional arrive: 167% ⚠   │
│                                                                          │
│ Confirmed work (docs received):                                         │
│ • ABC Ltd (1.5) - in Ready to Start queue                              │
│ • DEF Ltd (1.0) - in Ready to Start queue                              │
│                                                                          │
│ Provisional (awaiting docs - may slip):                                 │
│ • GHI Ltd (1.0) - docs requested 3 weeks ago                           │
│ • JKL Ltd (0.5) - docs requested 1 week ago                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

This tells the client manager:
- **Confirmed work**: This IS coming in April - plan for it
- **Provisional work**: This MIGHT come in April, or might slip to later months
- **Realistic planning**: Focus on confirmed utilization, treat provisional as "possible upside"

### Staff Capacity Settings

Each service owner can have their capacity explicitly set, overriding the default calculation.

```typescript
// New table: staff_service_capacity
export const staffServiceCapacity = pgTable("staff_service_capacity", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  
  // Capacity can be set as annual OR monthly (system converts as needed)
  annualCapacity: decimal("annual_capacity", { precision: 5, scale: 2 }),
  // Total weighted units this person can handle per year for this service
  
  monthlyCapacity: decimal("monthly_capacity", { precision: 4, scale: 2 }),
  // Alternative: set monthly directly (annualCapacity / 12 if not set)
  
  capacityNotes: text("capacity_notes"),
  // Optional explanation: "Part-time", "Also handles X", etc.
  
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});
```

**Example: Same clients, different capacity**

| Staff Member | Owned Weight | Capacity Setting | Monthly Target | Why |
|--------------|--------------|------------------|----------------|-----|
| Mrs Experienced | 28.5 | Annual: 36.0 | 3.0/month | Fast, efficient |
| Mr No Experience | 28.5 | Annual: 24.0 | 2.0/month | Still learning |
| Ms Average | 28.5 | (not set) | 2.375/month | Default: 28.5/12 |

### Capacity Calculation Logic

```
FUNCTION getMonthlyCapacity(userId, serviceId):
    
    1. CHECK staff_service_capacity for explicit setting
       IF monthlyCapacity set: RETURN monthlyCapacity
       IF annualCapacity set: RETURN annualCapacity / 12
    
    2. IF no explicit setting, calculate default:
       a. GET all client_services 
          WHERE serviceOwnerId = userId
          AND serviceId = serviceId
          AND client.status = 'active'
       b. SUM all client_services.complexityWeight
       c. RETURN sum / 12
```

**Example calculation:**
```
Jane's capacity for "Annual Accounts" service:

Option A - Explicit setting exists:
├── staff_service_capacity.annualCapacity = 36.0
└── Monthly target: 36.0 / 12 = 3.0 weighted units

Option B - No explicit setting (default):
├── Owned client_services total weight: 28.5
└── Monthly target: 28.5 / 12 = 2.375 weighted units
```

### Capacity Settings UI

```
┌─────────────────────────────────────────────────────────────────────┐
│ Staff Capacity Settings                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Staff Member: [Jane Smith ▼]                                        │
│ Service: [Annual Accounts ▼]                                        │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Current workload (owned clients):                               │ │
│ │ 24 clients, total weight: 28.5                                  │ │
│ │ Default monthly target: 2.375 units                             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Capacity override:                                                   │
│ ○ Use default (weight / 12)                                         │
│ ● Set explicitly:                                                    │
│                                                                      │
│   Annual capacity: [36.0] units/year                                │
│   OR                                                                 │
│   Monthly capacity: [3.0] units/month                               │
│                                                                      │
│ Notes: [Experienced, handles complex work efficiently_____]         │
│                                                                      │
│ [Save] [Cancel]                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Capacity Tolerance Zones

When capacity is exceeded, the system uses tolerance zones to determine whether to auto-assign or require human input.

### Tolerance Thresholds

| Zone | Utilization | System Behaviour |
|------|-------------|------------------|
| **Green** | 0-100% | Auto-assign, no warnings |
| **Amber** | 100-120% | Auto-assign with warning flag |
| **Red** | 120-150% | Requires human approval to proceed |
| **Critical** | 150%+ | System refuses - escalates to management |

### How Assignment Works With Auto-Rebalancing

Before declaring capacity breached, the system first tries to **automatically move flexible work** to make room.

```
FUNCTION assignWithAutoRebalance(newProject, clientManager, targetMonth):
    
    1. CALCULATE utilizationIfAssigned for targetMonth
    
    2. IF utilization <= amber_threshold (120%):
       → ASSIGN directly (Green/Amber zone)
       → RETURN success
    
    3. IF utilization > amber_threshold:
       → TRY to make room by moving flexible work
       
    4. FIND "moveable" projects in targetMonth:
       - scheduleStatus = 'confirmed'
       - daysUntilDueDate > 60 (plenty of slack)
       - NOT flagged as "priority" or "schedulingLocked"
       - hasNotBeenMovedRecently (no ping-pong)
       - SORT by most slack time first (move least urgent first)
    
    5. FOR each moveable project (max 3 moves per rebalance):
       a. FIND alternative months with capacity < 100%
       b. IF alternative found within their flexible window:
          → MOVE project to alternative month
          → SET project.lastAutoMovedAt = now
          → RECALCULATE targetMonth utilization
          → IF now <= amber_threshold: STOP moving
    
    6. AFTER rebalancing attempt:
       a. IF utilization <= amber_threshold:
          → ASSIGN new project
          → LOG all moves made
          → NOTIFY affected staff: "XYZ Ltd moved from June to August"
          → RETURN success
       b. IF still > amber_threshold:
          → No more moveable work available
          → FALL THROUGH to human approval (Red zone)
    
    7. IF no Green/Amber option available (even after rebalancing):
        a. FIND lowest Red zone option (120-150%)
        b. PAUSE assignment
        c. PRESENT options to client manager:
           ├── [Approve assignment to {month}] - will exceed by X%
           ├── [Request deadline extension from client]
           ├── [Reassign to different staff member]
           └── [Escalate to partner for resource review]
        d. AWAIT human decision
    
    8. IF all options exceed 150% (Critical):
        a. REFUSE automatic assignment
        b. ESCALATE to partner/management immediately
        c. FLAG as "Resource Crisis - requires intervention"
```

### Which Projects Can Be Auto-Moved?

| Criteria | Moveable? | Reason |
|----------|-----------|--------|
| Due date 90+ days away | Yes | Plenty of slack |
| Due date 60-90 days away | Yes, if needed | Some slack available |
| Due date <60 days away | No | Too close to deadline |
| Flagged as "priority" | No | Client expectation set |
| Flagged as "scheduling locked" | No | Explicitly fixed |
| Moved in last 30 days | No | Avoid ping-ponging |

### Auto-Rebalance Example

```
SCENARIO: ABC Ltd docs arrive, needs scheduling for June

Current June: 2.8 / 2.4 (117% - Amber)
If ABC Ltd (1.0) added: 3.8 / 2.4 (158% - Critical!)

Step 1: Find moveable projects in June
├── XYZ Ltd (1.0) - Due: July 30 - only 6 weeks slack - NOT MOVEABLE
├── DEF Ltd (1.0) - Due: October 31 - 4 months slack - MOVEABLE ✓
└── GHI Ltd (0.8) - Due: November 30 - 5 months slack - MOVEABLE ✓

Step 2: Move DEF Ltd (most slack) to August
├── August before: 1.7 / 2.4 (71%)
├── August after: 2.7 / 2.4 (113% - Amber, acceptable)
└── DEF Ltd successfully moved

Step 3: Recalculate June
├── June after move: 1.8 / 2.4 (75% - Green!)
└── Now under threshold - stop moving

Step 4: Assign ABC Ltd to June
├── June final: 2.8 / 2.4 (117% - Amber ✓)
└── AUTO-ASSIGNED successfully

Notifications:
├── To DEF Ltd assignee: "DEF Ltd rescheduled from June to August"
├── To ABC Ltd assignee: "ABC Ltd scheduled for June"
└── Both logged in project chronology
```

### Safeguards Against Chaos

1. **Maximum 3 moves per rebalance**: Prevents cascading disruption
2. **30-day cool-off**: Projects can only be auto-moved once per month
3. **Priority lock**: Important clients can be flagged as "unmoveable"
4. **Notification trail**: All moves logged and staff notified immediately
5. **Reject window**: Staff can reject an auto-move within 24 hours if problematic

### New Fields for Auto-Rebalancing

```typescript
// Add to projects table
schedulingLocked: boolean("scheduling_locked").default(false),
// If true, project cannot be auto-moved by rebalancing

lastAutoMovedAt: timestamp("last_auto_moved_at"),
// Prevents ping-ponging - can't be moved again within 30 days

autoMoveCount: integer("auto_move_count").default(0),
// Tracks how many times this project has been auto-rescheduled
```

### Approval Workflow for Red Zone

When human approval is required:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚠ Capacity Approval Required                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ABC Ltd documents have been received and need scheduling.               │
│                                                                          │
│ Due date: 30 September 2025                                             │
│ Weight: 1.5 (Moderate complexity)                                       │
│                                                                          │
│ Available options:                                                       │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ July 2025                                                           │ │
│ │ Current: 2.6 / 2.4 (108%)                                          │ │
│ │ After adding ABC Ltd: 4.1 / 2.4 (171%) ← CRITICAL                  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ August 2025                                                         │ │
│ │ Current: 2.2 / 2.4 (92%)                                           │ │
│ │ After adding ABC Ltd: 3.7 / 2.4 (154%) ← CRITICAL                  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ September 2025                                                      │ │
│ │ Current: 1.8 / 2.4 (75%)                                           │ │
│ │ After adding ABC Ltd: 3.3 / 2.4 (138%) ← RED (approval needed)     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ [Approve September] [Request Extension] [Reassign Staff] [Escalate]    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Dynamic Threshold Relaxation

As due date approaches, thresholds can automatically relax to prioritise deadline compliance:

| Days to Due Date | Amber Threshold | Red Threshold | Critical |
|------------------|-----------------|---------------|----------|
| 90+ days | 120% | 150% | 150%+ |
| 60-90 days | 130% | 160% | 160%+ |
| 30-60 days | 140% | 170% | 170%+ |
| <30 days | 150% | 180% | 180%+ |

**Rationale:** When a deadline is imminent, it's better to be overloaded than to miss a statutory deadline. The system relaxes constraints while still flagging the pressure.

### Cross-Staff Balancing Suggestions

When one staff member is overloaded but others have capacity:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 💡 Alternative Option Available                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ Jane Smith's August is at 145% capacity.                                │
│                                                                          │
│ Tom Brown has capacity in August (72%).                                 │
│                                                                          │
│ Consider reassigning one of these clients to Tom:                       │
│ • DEF Ltd (weight 1.0) - similar to Tom's existing portfolio           │
│ • GHI Ltd (weight 0.5) - straightforward accounts                      │
│                                                                          │
│ [View Tom's Portfolio] [Suggest Reassignment] [Dismiss]                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Configurable Tolerance Settings

Thresholds can be adjusted per firm:

```typescript
// Add to smoothing_settings table
export const smoothingSettings = pgTable("smoothing_settings", {
  id: varchar("id").primaryKey(),
  settingKey: varchar("setting_key").notNull().unique(),
  settingValue: jsonb("setting_value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Example configuration:
// { key: "green_max_percent", value: 100, description: "Auto-assign up to this %" }
// { key: "amber_max_percent", value: 120, description: "Auto-assign with warning up to this %" }
// { key: "red_max_percent", value: 150, description: "Requires approval up to this %" }
// { key: "enable_dynamic_relaxation", value: true, description: "Relax thresholds near due date" }
// { key: "enable_cross_staff_suggestions", value: true, description: "Suggest rebalancing across staff" }
```

### Early Warning System

The system should warn before problems occur:

```
NIGHTLY JOB: Capacity Forecast Warnings

1. FOR each client manager:
   a. LOOK at next 3 months of CONFIRMED + PROVISIONAL work
   b. IF any month exceeds amber threshold:
      → WARN: "July is forecast at 125% - consider chasing outstanding docs"
   c. IF multiple months exceed red threshold:
      → ESCALATE: "Q3 capacity crisis forecast - resource review needed"

2. FOR each project in "Gather Documents":
   a. IF provisionally scheduled month is already > 100% AND docs not received:
      → WARN: "ABC Ltd docs still outstanding - their month is filling up"
      → Prompt to chase client or consider alternative months
```

---

## Integration with Project Types

### Linking Services to Project Types

A project type used for smoothable work must be linked to a service that has complexity weighting enabled:

```typescript
// Add to projectTypes table
linkedServiceId: varchar("linked_service_id").references(() => services.id),
// Links this project type to a service (e.g., "Annual Accounts" service)
// Required when enableWorkloadSmoothing = TRUE

enableWorkloadSmoothing: boolean("enable_workload_smoothing").default(false),
// Only annual accounts and similar flexible work should be smoothed

smoothingLeadTimeDays: integer("smoothing_lead_time_days").default(60),
// Minimum days after year end before work can start

smoothingSafetyBufferDays: integer("smoothing_safety_buffer_days").default(14),
// Days before due date to use as the latest target

// Stage trigger references (required when smoothing enabled)
preWorkStageId: varchar("pre_work_stage_id").references(() => projectTypeStages.id),
// Stage where docs are gathered - triggers PROVISIONAL scheduling

readyQueueStageId: varchar("ready_queue_stage_id").references(() => projectTypeStages.id),
// Stage where work waits - triggers CONFIRMED scheduling

mainWorkStageId: varchar("main_work_stage_id").references(() => projectTypeStages.id),
// Stage when active work begins - triggers IN_PROGRESS status

// Activation status
smoothingConfigComplete: boolean("smoothing_config_complete").default(false),
// System-calculated: TRUE only when all required settings are configured
```

### Activation Validation

A smoothing-enabled project type cannot be used until configuration is complete:

```
FUNCTION validateSmoothingConfig(projectType):
    
    errors = []
    
    1. IF enableWorkloadSmoothing = FALSE:
       → RETURN valid (not a smoothing project type)
    
    2. CHECK linkedServiceId:
       a. IF null: errors.push("Must link to a service")
       b. IF service.enableComplexityWeighting = FALSE:
          errors.push("Linked service must have complexity weighting enabled")
    
    3. CHECK stage triggers:
       a. IF preWorkStageId null: errors.push("Pre-work stage required")
       b. IF readyQueueStageId null: errors.push("Ready queue stage required")
       c. IF mainWorkStageId null: errors.push("Main work stage required")
    
    4. CHECK stage order:
       a. preWorkStage.order < readyQueueStage.order < mainWorkStage.order
       b. IF not in order: errors.push("Stages must be in sequential order")
    
    5. UPDATE smoothingConfigComplete = (errors.length === 0)
    
    RETURN { valid: errors.length === 0, errors }
```

### Project Type Configuration UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Project Type: Annual Accounts                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ Workload Smoothing Settings                                              │
│ ═══════════════════════════                                              │
│                                                                          │
│ ☑ Enable workload smoothing for this project type                       │
│                                                                          │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ⚠ Configuration Incomplete - 2 issues to resolve                   │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ Linked Service: [Annual Accounts ▼] ✓                                   │
│   └── Service has complexity weighting enabled ✓                        │
│                                                                          │
│ Timing Settings:                                                         │
│   Minimum lead time: [60] days after year end                           │
│   Safety buffer: [14] days before due date                              │
│                                                                          │
│ Stage Triggers:                                                          │
│   Pre-work stage:    [Gather Documents ▼] ✓                             │
│     → Provisional schedule calculated when project enters               │
│                                                                          │
│   Ready queue stage: [Ready to Start ▼] ✓                               │
│     → Confirmed schedule calculated, work held until start date         │
│                                                                          │
│   Main work stage:   [-- Select --    ▼] ✗ Required                    │
│     → Work begins, schedule status set to "in progress"                 │
│                                                                          │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Status: ⚠ Cannot create projects until configuration complete       │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Project Creation Validation

When creating a project using a smoothing-enabled project type:

```
FUNCTION validateProjectCreation(projectTypeId, clientId):
    
    projectType = getProjectType(projectTypeId)
    
    1. IF projectType.enableWorkloadSmoothing = TRUE:
       a. IF projectType.smoothingConfigComplete = FALSE:
          → REJECT: "Project type configuration incomplete"
       
       b. GET client_service WHERE clientId AND serviceId = projectType.linkedServiceId
          IF not found:
          → REJECT: "Client doesn't have this service assigned"
          
       c. GET serviceOwner from client_service
          IF serviceOwner has no capacity setting AND no owned services:
          → WARN: "No capacity target set for service owner"
    
    2. IF all checks pass:
       → ALLOW creation
       → Calculate provisional schedule immediately
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

Within a project, show the scheduled timeline with the two-stage pre-work flow:

```
┌─────────────────────────────────────────────────────────────┐
│ ABC Ltd - Annual Accounts 2024                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Year End: 31 Dec 2024                                        │
│ Due Date: 30 Sep 2025                                        │
│ Scheduled Month: April 2025  ← Based on capacity analysis   │
│ Weight: 1.5 (Moderate complexity)                            │
│                                                              │
│ Current Stage: [Gather Documents] ──────────────────────────│
│                                                              │
│ Timeline:                                                    │
│ ─────────────────────────────────────────────────────────── │
│ Jan        Feb        Mar         Apr        May    Sep     │
│  │          │          │     ┌──────────┐    │       │      │
│  ●══════════●══════════●─────┤   WORK   ├────●───────│      │
│  │  Gather  │  Ready   │     └──────────┘    │       │      │
│  │  Docs    │  to      │                     │       │      │
│  │          │  Start   │                     │       │      │
│ Year      Move to    Nightly            Target     Due      │
│ End       queue      scheduler                               │
│           when       releases                                │
│           complete   to work                                 │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Flexible window: Feb 2025 - Sep 2025                    │ │
│ │ April selected: lowest capacity month for Jane Smith    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

The scheduled month is calculated at project creation based on capacity, but the actual timing is flexible within the window. Work could theoretically start anywhere from 2 months after year end up until the due date, but the system picks the optimal month to balance workload.

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

## Dedicated Capacity Scheduling View

This is a **standalone view separate from standard project views**, designed specifically for capacity planning and scheduling analysis.

### Purpose

Unlike the main project kanban/list views which focus on individual project status, this view provides:
- **Macro-level capacity visibility** across time periods
- **Heatmap visualisation** of workload distribution
- **Multi-dimensional filtering** by service, service owner, time period
- **Planning tools** for identifying capacity issues before they occur

### Access Point

Add to main navigation:
```
Reports → Capacity Planning
```
Or as a dedicated section:
```
Capacity → Scheduling View
```

### View Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ CAPACITY SCHEDULING VIEW                                                             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│ ┌──────────────────────────────── FILTERS ────────────────────────────────────────┐ │
│ │                                                                                  │ │
│ │ Service: [Annual Accounts ▼] [All Services]                                     │ │
│ │                                                                                  │ │
│ │ Service Owner(s): [☑ Jane Smith] [☑ Tom Brown] [☐ Sarah Lee] [Select All]      │ │
│ │                                                                                  │ │
│ │ Time Period: [Apr 2025 ▼] to [Mar 2026 ▼]  [This Year] [Next 6 Months] [Custom]│ │
│ │                                                                                  │ │
│ │ View Mode: ● Heatmap Timeline  ○ Table View  ○ Chart View                       │ │
│ │                                                                                  │ │
│ │ Show: [☑ Confirmed] [☑ Provisional] [☑ In Progress]                            │ │
│ │                                                                                  │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│ ┌───────────────────────── HEATMAP TIMELINE ──────────────────────────────────────┐ │
│ │                                                                                  │ │
│ │ Colour Key: ░ <50%  ▒ 50-80%  ▓ 80-100%  █ 100-120%  ▐ >120%                   │ │
│ │                                                                                  │ │
│ │              Apr    May    Jun    Jul    Aug    Sep    Oct    Nov    Dec        │ │
│ │ ┌──────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┐    │ │
│ │ │Jane Smith│  ▓   │  █   │  ▒   │  ▒   │  ▓   │  ▐   │  ▓   │  ░   │  ▒   │    │ │
│ │ │  (2.4/m) │ 2.2  │ 2.8  │ 1.6  │ 1.4  │ 2.1  │ 3.2  │ 2.3  │ 0.8  │ 1.5  │    │ │
│ │ │          │ 92%  │117%  │ 67%  │ 58%  │ 88%  │133%  │ 96%  │ 33%  │ 63%  │    │ │
│ │ ├──────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤    │ │
│ │ │Tom Brown │  ▒   │  ▓   │  ▓   │  █   │  ▒   │  ▓   │  ▒   │  ▓   │  ▓   │    │ │
│ │ │  (2.0/m) │ 1.4  │ 1.8  │ 1.9  │ 2.4  │ 1.2  │ 1.8  │ 1.5  │ 1.7  │ 1.9  │    │ │
│ │ │          │ 70%  │ 90%  │ 95%  │120%  │ 60%  │ 90%  │ 75%  │ 85%  │ 95%  │    │ │
│ │ ├──────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤    │ │
│ │ │FIRM TOTAL│  ▓   │  ▓   │  ▒   │  ▒   │  ▒   │  █   │  ▓   │  ▒   │  ▒   │    │ │
│ │ │  (4.4/m) │ 3.6  │ 4.6  │ 3.5  │ 3.8  │ 3.3  │ 5.0  │ 3.8  │ 2.5  │ 3.4  │    │ │
│ │ │          │ 82%  │105%  │ 80%  │ 86%  │ 75%  │114%  │ 86%  │ 57%  │ 77%  │    │ │
│ │ └──────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘    │ │
│ │                                                                                  │ │
│ │ Click any cell to see detailed breakdown →                                      │ │
│ │                                                                                  │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│ ┌───────────────────────── CELL DETAIL (September - Jane Smith) ──────────────────┐ │
│ │                                                                                  │ │
│ │ September 2025 - Jane Smith                            Capacity: 3.2 / 2.4 (133%)│ │
│ │                                                                                  │ │
│ │ ┌────────────────────── CONFIRMED (2.5 weight) ──────────────────────────────┐  │ │
│ │ │                                                                            │  │ │
│ │ │ Client          │ Weight │ Due Date   │ Status         │ Start Date       │  │ │
│ │ │ ─────────────────────────────────────────────────────────────────────────  │  │ │
│ │ │ ABC Ltd         │ 1.5    │ 30 Sep 25  │ Ready to Start │ 01 Sep 25        │  │ │
│ │ │ DEF Ltd         │ 1.0    │ 31 Oct 25  │ Ready to Start │ 15 Sep 25        │  │ │
│ │ └────────────────────────────────────────────────────────────────────────────┘  │ │
│ │                                                                                  │ │
│ │ ┌────────────────────── PROVISIONAL (0.7 weight) ────────────────────────────┐  │ │
│ │ │                                                                            │  │ │
│ │ │ Client          │ Weight │ Due Date   │ Docs Status    │ Days Waiting     │  │ │
│ │ │ ─────────────────────────────────────────────────────────────────────────  │  │ │
│ │ │ GHI Ltd         │ 0.7    │ 30 Nov 25  │ Chasing        │ 14 days          │  │ │
│ │ └────────────────────────────────────────────────────────────────────────────┘  │ │
│ │                                                                                  │ │
│ │ ⚠ September is OVER CAPACITY by 33%                                            │ │
│ │                                                                                  │ │
│ │ Suggested actions:                                                              │ │
│ │ • DEF Ltd could be moved to October (currently 96%) - has slack until Oct 31   │ │
│ │ • Consider reassigning ABC Ltd to Tom Brown (September at 90%)                  │ │
│ │                                                                                  │ │
│ │ [Move DEF Ltd to Oct] [Suggest Reassignment] [Override & Accept]                │ │
│ │                                                                                  │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Filter Options Detail

#### Service Filter
```typescript
// Options:
// - "All Services" - shows all smoothable services combined
// - Individual services where enableComplexityWeighting = TRUE
// 
// When filtered by service, only shows capacity for that service type
```

#### Service Owner Filter
```typescript
// Multi-select checkbox list of all staff who:
// - Have at least one client_service where they are serviceOwnerId
// - AND that service has enableComplexityWeighting = TRUE
//
// Quick buttons:
// - "Select All" / "Clear All"
// - "My Team" (if hierarchies exist)
// - "Just Me" (quick filter to current user)
```

#### Time Period Filter
```typescript
// Preset ranges:
// - "This Year" (current calendar/financial year)
// - "Next 6 Months" (rolling from today)
// - "Next 12 Months" (rolling from today)
// - "Custom" (date pickers for start/end month)
//
// Minimum: 3 months (below this, heatmap loses value)
// Maximum: 24 months (beyond this, data becomes speculative)
```

#### View Mode Options

**Heatmap Timeline** (Default)
- Visual grid with colour-coded capacity cells
- Best for quick identification of problem months
- Click cells for detailed drilldown

**Table View**
- Traditional tabular format
- Better for detailed analysis
- Sortable columns
- Export to Excel capability

**Chart View**
- Bar/line chart of capacity over time
- Overlay confirmed vs provisional
- Good for presentations/reporting

#### Show Filters
```typescript
// Checkboxes to include/exclude:
// - ☑ Confirmed (scheduleStatus = 'confirmed')
// - ☑ Provisional (scheduleStatus = 'provisional')  
// - ☑ In Progress (scheduleStatus = 'in_progress')
// - ☐ Completed (scheduleStatus = 'completed') - usually hidden
//
// When "Provisional" unchecked, shows only committed workload
// Useful for realistic near-term planning
```

### Data Model for View

```typescript
// API response structure for capacity grid
interface CapacityGridData {
  filters: {
    serviceId: string | null;
    serviceOwnerIds: string[];
    startMonth: string; // "YYYY-MM"
    endMonth: string;
    includeConfirmed: boolean;
    includeProvisional: boolean;
    includeInProgress: boolean;
  };
  
  serviceOwners: Array<{
    userId: string;
    userName: string;
    monthlyCapacity: number; // Their target capacity per month
  }>;
  
  months: Array<{
    yearMonth: string; // "YYYY-MM"
    
    // Per service owner
    byOwner: Record<string, {
      confirmedWeight: number;
      confirmedCount: number;
      provisionalWeight: number;
      provisionalCount: number;
      inProgressWeight: number;
      inProgressCount: number;
      totalWeight: number;
      utilizationPercent: number;
      capacityZone: 'green' | 'amber' | 'red' | 'critical';
    }>;
    
    // Firm totals
    firmTotal: {
      confirmedWeight: number;
      provisionalWeight: number;
      inProgressWeight: number;
      totalWeight: number;
      targetCapacity: number;
      utilizationPercent: number;
    };
  }>;
  
  // For drilldown
  projectsByMonth: Record<string, Record<string, Array<{
    projectId: string;
    clientName: string;
    weight: number;
    dueDate: string;
    scheduleStatus: string;
    suggestedStartDate: string | null;
    confirmedScheduledMonth: string | null;
    provisionalScheduledMonth: string | null;
    currentStage: string;
  }>>>;
}
```

### Interaction Behaviours

**Hover on Cell**
- Shows tooltip with quick stats
- "Jane Smith - September: 3.2/2.4 (133%) - 3 projects"

**Click on Cell**
- Opens detailed breakdown panel (as shown above)
- Lists all projects scheduled for that month/owner
- Shows suggested actions if over capacity

**Drag Project (Future Enhancement)**
- Drag a project from one month to another
- System validates: capacity impact, due date constraints
- If valid, updates schedule with confirmation

**Export Options**
- "Export to CSV" - raw data for analysis
- "Export to PDF" - formatted report for management
- "Print View" - optimised for printing

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

## Implementation Plan

### Prerequisites Checklist

Before starting implementation, ensure these exist:
- [ ] `services` table exists with service definitions
- [ ] `client_services` mapping table exists
- [ ] `project_types` table with stage references
- [ ] `project_type_stages` (or `kanban_stages`) table
- [ ] User management with staff roles

---

### Phase 1: Data Model Foundation

**Duration:** 2-3 days

**1.1 Add fields to `services` table**
```typescript
enableComplexityWeighting: boolean("enable_complexity_weighting").default(false)
```

**1.2 Add fields to `client_services` table**
```typescript
serviceOwnerId: varchar("service_owner_id").references(() => users.id)
complexityWeight: decimal("complexity_weight", { precision: 3, scale: 2 }).default("1.00")
```

**1.3 Add fields to `projects` table**
```typescript
scheduleStatus: varchar("schedule_status") // 'provisional' | 'confirmed' | 'in_progress' | 'completed' | 'delayed'
provisionalScheduledMonth: varchar("provisional_scheduled_month") // "YYYY-MM"
confirmedScheduledMonth: varchar("confirmed_scheduled_month") // "YYYY-MM"
suggestedStartDate: timestamp("suggested_start_date")
schedulingNotes: text("scheduling_notes")
originalScheduledMonth: varchar("original_scheduled_month")
delayReason: varchar("delay_reason")
schedulingLocked: boolean("scheduling_locked").default(false)
lastAutoMovedAt: timestamp("last_auto_moved_at")
autoMoveCount: integer("auto_move_count").default(0)
```

**1.4 Add fields to `project_types` table**
```typescript
linkedServiceId: varchar("linked_service_id").references(() => services.id)
enableWorkloadSmoothing: boolean("enable_workload_smoothing").default(false)
smoothingLeadTimeDays: integer("smoothing_lead_time_days").default(60)
smoothingSafetyBufferDays: integer("smoothing_safety_buffer_days").default(14)
preWorkStageId: varchar("pre_work_stage_id").references(() => projectTypeStages.id)
readyQueueStageId: varchar("ready_queue_stage_id").references(() => projectTypeStages.id)
mainWorkStageId: varchar("main_work_stage_id").references(() => projectTypeStages.id)
smoothingConfigComplete: boolean("smoothing_config_complete").default(false)
```

**1.5 Create new tables**
- `staff_service_capacity` - Staff capacity settings per service
- `capacity_targets` - Monthly override targets
- `smoothing_settings` - Firm-wide configuration
- `smoothing_snapshots` - Historical tracking
- `scheduler_config` - Scheduler settings

**1.6 Run database migrations**

**Deliverables:**
- [ ] All schema changes applied
- [ ] Migration scripts tested
- [ ] Rollback scripts prepared

---

### Phase 2: Core Capacity Logic

**Duration:** 3-4 days

**2.1 Complexity weight functions**
```typescript
// File: server/services/smoothing/complexity.ts
getComplexityWeight(clientServiceId): number  // With default 1.0 fallback
validateComplexityWeight(weight): number      // Clamp to 0.5-2.0 range
```

**2.2 Capacity calculation functions**
```typescript
// File: server/services/smoothing/capacity.ts
getMonthlyCapacity(userId, serviceId): number  // Get target (explicit or default)
calculateCurrentLoad(userId, yearMonth): { confirmed, provisional, total }
calculateUtilization(userId, yearMonth): { percent, zone }
getCapacityForDateRange(userId, startMonth, endMonth): CapacityGridData
```

**2.3 Staff capacity settings CRUD**
```typescript
// File: server/services/smoothing/staffCapacity.ts
getStaffCapacity(userId, serviceId): StaffServiceCapacity | null
setStaffCapacity(userId, serviceId, capacity): void
deleteStaffCapacity(userId, serviceId): void
getDefaultCapacity(userId, serviceId): number  // Sum of weights / 12
```

**Deliverables:**
- [ ] All capacity functions implemented with tests
- [ ] Default fallback logic for missing complexity weights
- [ ] Capacity calculation tested with sample data

---

### Phase 3: Scheduling Algorithm

**Duration:** 4-5 days

**3.1 Provisional scheduling (on project creation)**
```typescript
// File: server/services/smoothing/scheduling.ts
assignProvisionalMonth(project, serviceOwnerId): ProvisionalResult
// - Calculate flexible window
// - Find optimal month based on current capacity
// - Assign provisionalScheduledMonth
// - Set scheduleStatus = 'provisional'
```

**3.2 Confirmed scheduling (when docs received)**
```typescript
confirmScheduledMonth(project, serviceOwnerId): ConfirmResult
// - Recalculate based on current real-time capacity
// - Try auto-rebalancing if over capacity
// - Set confirmedScheduledMonth and suggestedStartDate
// - Set scheduleStatus = 'confirmed'
```

**3.3 Auto-rebalancing logic**
```typescript
attemptAutoRebalance(targetMonth, requiredCapacity): RebalanceResult
// - Find moveable projects in targetMonth
// - Move up to 3 projects to make room
// - Return success/failure with moves made
```

**3.4 Tolerance zone enforcement**
```typescript
evaluateCapacityZone(utilizationPercent, daysToDeadline): Zone
// - Apply dynamic threshold relaxation
// - Return zone: 'green' | 'amber' | 'red' | 'critical'

getApprovalRequirement(zone): ApprovalType
// - Return 'auto' | 'warning' | 'approval_required' | 'refused'
```

**3.5 Integration with project creation**
```typescript
// Modify project creation flow:
// 1. Validate project type smoothing config
// 2. Get service owner from client_services
// 3. Call assignProvisionalMonth()
// 4. Save project with provisional schedule
```

**3.6 Integration with stage transitions**
```typescript
// When project moves to readyQueueStage:
// 1. Call confirmScheduledMonth()
// 2. Update project with confirmed schedule
// 3. Trigger notifications if capacity warning
```

**Deliverables:**
- [ ] Provisional scheduling working on project creation
- [ ] Confirmed scheduling on stage transition
- [ ] Auto-rebalancing tested with various scenarios
- [ ] Tolerance zones correctly applied

---

### Phase 4: Nightly Scheduler

**Duration:** 2-3 days

**4.1 Scheduler job implementation**
```typescript
// File: server/jobs/schedulerJob.ts
// Runs nightly at configured time (default 02:00)

async function runSchedulerJob():
  // 1. Release ready work
  releaseReadyProjects()
  
  // 2. Generate warnings
  generateAtRiskWarnings()
  generateCriticalEscalations()
  
  // 3. Capacity forecast warnings
  generateCapacityForecastWarnings()
```

**4.2 Work release logic**
```typescript
releaseReadyProjects():
// - Find projects in ready_queue where suggestedStartDate <= today
// - Move to main_work stage
// - Notify assignees
// - Log transitions
```

**4.3 Warning generation**
```typescript
generateAtRiskWarnings():
// - Find projects in gather_docs with suggestedStartDate within X days
// - Create warning notifications

generateCriticalEscalations():
// - Find projects with dueDate within Y days not yet in main_work
// - Escalate to management
```

**4.4 Scheduler configuration**
- Add scheduler_config table entries
- Make warning thresholds configurable

**Deliverables:**
- [ ] Nightly job running reliably
- [ ] Work released automatically
- [ ] Warnings generated correctly
- [ ] Escalations working

---

### Phase 5: Configuration UI

**Duration:** 3-4 days

**5.1 Service settings**
```
Services → [Service Name] → Settings
└── ☑ Enable complexity weighting for this service
```

**5.2 Client service complexity setting**
```
Client → Services tab → [Service] → Edit
└── Complexity weight slider (0.5 - 2.0)
```

**5.3 Staff capacity settings**
```
Settings → Staff Capacity
└── Grid: Staff × Service with capacity values
    └── Click to edit annual/monthly capacity
```

**5.4 Project type smoothing configuration**
```
Settings → Project Types → [Type] → Smoothing
└── Full configuration panel as documented
    ├── Link to service
    ├── Timing settings
    └── Stage triggers
```

**5.5 Firm-wide smoothing settings**
```
Settings → Capacity Planning
└── Tolerance thresholds (green/amber/red/critical)
└── Enable/disable features (dynamic relaxation, cross-staff suggestions)
└── Scheduler timing
```

**Deliverables:**
- [ ] All configuration screens built
- [ ] Validation enforced (project type activation)
- [ ] Settings persisted correctly

---

### Phase 6: Capacity Scheduling View

**Duration:** 5-6 days

**6.1 Main view component**
```
Reports → Capacity Planning (or Capacity → Scheduling View)
```

**6.2 Filter panel**
- Service dropdown
- Service owner multi-select
- Time period selector
- View mode toggle
- Show checkboxes (confirmed/provisional/in progress)

**6.3 Heatmap timeline component**
- Grid with rows per service owner + firm total
- Columns per month
- Colour-coded cells by utilization zone
- Click handler for drilldown

**6.4 Cell detail panel**
- Shows when cell clicked
- Lists projects in confirmed/provisional sections
- Shows suggested actions for over-capacity
- Action buttons (move, reassign, override)

**6.5 Table view mode**
- Traditional table format
- Sortable columns
- Filterable

**6.6 Chart view mode**
- Bar chart of capacity over time
- Stacked: confirmed + provisional
- Line overlay for target capacity

**6.7 Export functionality**
- Export to CSV
- Export to PDF
- Print view

**6.8 API endpoints**
```
GET /api/capacity/grid
POST /api/capacity/move-project
POST /api/capacity/suggest-reassignment
```

**Deliverables:**
- [ ] Heatmap view working with real data
- [ ] All filter options functional
- [ ] Cell drilldown showing correct projects
- [ ] Actions (move, reassign) working
- [ ] Export working

---

### Phase 7: Project Integration

**Duration:** 2-3 days

**7.1 Project detail timeline view**
- Visual timeline showing flexible window
- Current scheduled month highlighted
- Stage progression markers

**7.2 New client onboarding capacity preview**
- When adding client + service
- Show impact on capacity
- Suggest optimal month

**7.3 Project list/kanban capacity indicators**
- Badge showing scheduled month
- Warning indicators for over-capacity months

**7.4 Stage transition hooks**
- Trigger scheduling logic on appropriate stage moves
- Show confirmation dialogs for capacity-impacting actions

**Deliverables:**
- [ ] Timeline visible on project detail
- [ ] Capacity preview on new client
- [ ] Indicators on project lists

---

### Phase 8: Notifications & Alerts

**Duration:** 2-3 days

**8.1 Notification types**
- Project scheduled (provisional)
- Project confirmed (docs received)
- Project moved (auto-rebalance)
- At-risk warning (docs outstanding)
- Critical escalation (deadline approaching)
- Capacity warning (month over threshold)

**8.2 Notification channels**
- In-app notifications
- Email (optional, configurable)

**8.3 Approval workflow UI**
- Modal for red-zone approvals
- Options: approve, request extension, reassign, escalate

**Deliverables:**
- [ ] All notification types implemented
- [ ] Email delivery working (if enabled)
- [ ] Approval workflow functional

---

### Phase 9: Reporting & Analytics

**Duration:** 2-3 days

**9.1 Smoothing snapshots**
- Nightly capture of capacity state
- Historical trend data

**9.2 Distribution quality report**
- Standard deviation of monthly load
- Peak month analysis
- Before/after comparison

**9.3 Scheduling effectiveness report**
- Projects completed by target date %
- Average delay duration
- Auto-rebalance success rate

**9.4 Dashboard widgets**
- Capacity summary card
- Upcoming capacity warnings
- At-risk projects count

**Deliverables:**
- [ ] Snapshot job running nightly
- [ ] Reports accessible
- [ ] Dashboard widgets working

---

### Phase 10: Testing & Refinement

**Duration:** 3-4 days

**10.1 Unit tests**
- All capacity calculation functions
- Scheduling algorithm edge cases
- Tolerance zone logic

**10.2 Integration tests**
- Full project creation → scheduling flow
- Stage transition → confirmation flow
- Auto-rebalancing scenarios

**10.3 End-to-end tests**
- Complete user journey
- Multi-user scenarios

**10.4 Performance testing**
- Capacity grid with large datasets
- Nightly job with many projects

**10.5 User acceptance testing**
- Test with real accounting firm scenarios
- Gather feedback

**Deliverables:**
- [ ] Test coverage > 80% for core logic
- [ ] E2E tests passing
- [ ] Performance acceptable
- [ ] UAT feedback incorporated

---

### Total Estimated Duration

| Phase | Duration |
|-------|----------|
| Phase 1: Data Model | 2-3 days |
| Phase 2: Core Capacity Logic | 3-4 days |
| Phase 3: Scheduling Algorithm | 4-5 days |
| Phase 4: Nightly Scheduler | 2-3 days |
| Phase 5: Configuration UI | 3-4 days |
| Phase 6: Capacity Scheduling View | 5-6 days |
| Phase 7: Project Integration | 2-3 days |
| Phase 8: Notifications & Alerts | 2-3 days |
| Phase 9: Reporting & Analytics | 2-3 days |
| Phase 10: Testing & Refinement | 3-4 days |
| **TOTAL** | **28-38 days** |

### Recommended MVP Scope

For initial release, prioritise:
1. Phase 1: Data Model (required)
2. Phase 2: Core Capacity Logic (required)
3. Phase 3: Scheduling Algorithm (required)
4. Phase 5: Configuration UI (basic)
5. Phase 6: Capacity Scheduling View (heatmap only)

**MVP Duration: ~15-20 days**

Defer to post-MVP:
- Nightly scheduler (can use manual triggers initially)
- Table/chart view modes
- Reporting & analytics
- Email notifications

---

## Edge Cases & Considerations

### Documents Not Ready by Suggested Start Date

When a project's `suggestedStartDate` approaches but it's still in "Gather Documents" stage:

```
ESCALATION TIMELINE

14 days before suggestedStartDate:
├── WARNING notification to client manager
├── "ABC Ltd accounts scheduled to start in 14 days - documents still outstanding"
└── Project flagged with amber indicator on dashboard

7 days before suggestedStartDate:
├── ESCALATION to manager/partner
├── More prominent warning on dashboard
└── Consider automated chase to client

On suggestedStartDate (docs still missing):
├── Project does NOT auto-release (no documents = can't work)
├── Status changes to "Delayed Start"
├── System logs the delay for reporting
└── Client manager presented with options:
    ├── REQUEST NEW MONTH: Push to next available slot (capacity permitting)
    ├── FORCE START: Begin with incomplete docs (not recommended, requires override)
    └── MARK BLOCKED: Explicitly flag as waiting on client with reason
```

**Key Principle:** No documents = no release. The scheduled date is a *target*, not an automatic trigger if prerequisites aren't met.

### Client Leaving - Impact on Capacity

When a client leaves (projects archived):

```
IMMEDIATE EFFECT:
├── Their scheduled projects are archived/cancelled
├── Capacity for their scheduled months is freed up
└── No automatic redistribution of other projects (Option A)

VISIBILITY:
├── Dashboard shows reduced load in affected months
├── Example: "April now at 1.8 / 2.4 (75%) - capacity available"
└── Monthly capacity report highlights the change

NATURAL REBALANCING:
├── New clients joining will be scheduled into freed capacity
├── Algorithm sees lower utilisation and suggests those months
└── Over time, gaps fill naturally without manual intervention
```

### New Client Joining - Scheduling Into Available Capacity

When a new client joins:

```
CALCULATION PROCESS:
1. Determine year end and due date
2. Calculate flexible window (earliest start to latest target)
3. Query CURRENT capacity for client manager across that window
   └── Includes all existing scheduled projects (including those from former clients)
4. Factor in weight of new client
5. Find month with lowest utilisation after adding this client
6. Assign that month as suggestedStartDate

NATURAL EFFECT:
├── If a client recently left, their months show lower utilisation
├── New clients are more likely to be scheduled into those gaps
└── System self-heals without explicit rebalancing
```

### Optional: Periodic Rebalancing Report

While we use "Lock once assigned" (Option A), a quarterly review report could identify optimisation opportunities:

```
QUARTERLY REBALANCING REPORT

Summary: Q2 2025 capacity distribution has shifted due to client churn

Months now OVER capacity:
├── September 2025: 3.2 / 2.4 (133%) - 2 clients joined with Sept year ends
└── Suggestion: Move DEF Ltd (weight 1.0) to August (currently 85%)

Months now UNDER capacity:
├── July 2025: 1.6 / 2.4 (67%) - XYZ Ltd left
└── Suggestion: Pull forward GHI Ltd from August if client agrees

[View Details] [Dismiss] [Apply Suggestions]
```

This would be a manual review process, not automatic redistribution.

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
