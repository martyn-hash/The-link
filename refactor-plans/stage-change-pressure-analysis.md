# Stage-Change Pressure Analysis

## Overview

This document provides a comprehensive analysis of the stage-change flow in the system, identifying where operational pressure occurs, why it happens, and which components are at highest risk for slowdown.

---

## 1. Overview of Stage-Change Workflow

When a project changes stage, the following sequence of operations occurs:

```
1. API Request → PATCH /api/projects/:id/status
   ↓
2. Validation Phase (SYNCHRONOUS)
   - Get project from database
   - Validate stage exists and belongs to project type
   - Validate change reason exists and is mapped to stage
   - Validate required custom fields are provided
   - Validate stage approval responses (if approval required)
   ↓
3. Status Update Transaction (SYNCHRONOUS)
   - Calculate time in previous stage (business hours calculation)
   - Insert chronology entry
   - Insert field responses (loop per field)
   - Update project record
   ↓
4. Post-Transaction Operations (SYNCHRONOUS in storage)
   - Send stage change notifications (to internal system)
   - Create message thread with participants
   - Create initial message in thread
   - Cancel scheduled notifications (if final stage)
   - Auto-archive message threads (if final stage)
   ↓
5. Prepare Response
   - Prepare client notification preview (DB queries for client contacts)
   - Return response to client
   ↓
6. Background Operations (via setImmediate - ASYNC after response)
   - Fetch stage assignee (user or work role lookup)
   - Resolve work role to user for client
   - Get user notification preferences
   - Fetch full project details again
   - Get project chronology for email
   - Send stage change notification email (external API call)
   - Handle notification suppression/reactivation for stage-aware notifications
```

---

## 2. Pressure Map Table

| Component | File/Method | Pressure Level | Why | Notes |
|-----------|-------------|----------------|-----|-------|
| Stage validation | `status.ts` → route handler | **Low** | 2-3 parallel DB reads, simple validations | Uses Promise.all for efficiency |
| Stage approval validation | `status.ts` → route handler | **Medium** | Extra DB queries for approval fields and responses | Only when approval required |
| Status update transaction | `projectStatusStorage.ts` → `updateProjectStatus` | **High** | Multiple synchronous DB operations within transaction, loops over field responses | Transaction locks prevent parallelism |
| Field response insertion | `projectStatusStorage.ts` → within transaction | **Medium** | Loop with individual INSERT per field | N queries for N fields |
| Chronology creation | `projectStatusStorage.ts` → within transaction | **Low** | Single INSERT | Simple operation |
| Business hours calculation | `projectStatusStorage.ts` | **Low** | CPU-bound calculation | Imported from shared module |
| Stage notification dispatch | `projectStatusStorage.ts` → `sendStageChangeNotifications` | **Medium** | Calls external notification storage | Cross-domain call |
| Message thread creation | `projectStatusStorage.ts` → helpers | **High** | 3-4 sequential DB operations (thread, participants, message) | Creates handoff conversation |
| Client notification preview | `stageChangeNotificationStorage.ts` → `prepareClientValueNotification` | **High** | Complex query with joins, stage approval lookups, variable processing | ~10+ DB queries, external API check |
| Email notification (background) | `emailService.ts` → `sendStageChangeNotificationEmail` | **High** | External API call to SendGrid | Network latency, can fail |
| Notification scheduler update | `notification-scheduler.ts` → `handleProjectStageChangeForNotifications` | **Medium** | Query + loop with individual updates | Suppresses/reactivates notifications |
| Cancel scheduled notifications | `scheduledNotificationStorage.ts` → `cancelScheduledNotificationsForProject` | **Medium** | Batch update operation | Only on final stage |
| Auto-archive threads | `projectMessageThreadStorage.ts` | **Medium** | Updates multiple thread records | Only on final stage |
| Stage config endpoint | `status.ts` → GET `/stage-change-config` | **Medium** | 6 parallel DB queries, client-side data aggregation | Pre-flight for modal |

---

## 3. High-Pressure Components (Deep Dive)

### 3.1 Status Update Transaction (`projectStatusStorage.ts` → `updateProjectStatus`)

**Location:** `server/storage/projects/projectStatusStorage.ts`, lines 36-362

**Description:**
The core transaction that updates project status. Runs as a single database transaction containing multiple operations.

**Why it's heavy:**
- **Multiple sequential queries within transaction:**
  - Select kanban stage by name and project type
  - Select change reason by name and project type
  - Validate stage-reason mapping
  - Loop: Select each custom field, then insert field response
  - Insert chronology entry
  - Update project record
- **Transaction blocks parallelism** - All operations must complete before commit
- **Field response loop** - N queries for N custom fields (lines 82-121, 219-236)

**Red Flags:**
- Field responses are processed one at a time with individual SELECTs before INSERT
- Business hours calculation happens synchronously in request path
- Work role resolution requires additional lookups

**DB Operations:** 5-10+ depending on custom fields

---

### 3.2 Message Thread Creation (within `updateProjectStatus`)

**Location:** `server/storage/projects/projectStatusStorage.ts`, lines 255-330

**Description:**
Creates a conversation thread for project handoffs between assignees.

**Why it's heavy:**
- Creates thread record
- Adds 2-3 participants (previous assignee, new assignee, changing user)
- Creates initial message with content
- Each operation is a separate INSERT

**Red Flags:**
- Sequential DB operations that could be batched
- Runs after main transaction but still blocks response (sort of - it's in try-catch so won't fail the request)

**DB Operations:** 4-5 sequential inserts

---

### 3.3 Client Notification Preview (`stageChangeNotificationStorage.ts` → `prepareClientValueNotification`)

**Location:** `server/storage/notifications/stageChangeNotificationStorage.ts`, lines 283-585

**Description:**
Prepares notification preview for client contacts (people linked to the project's client).

**Why it's heavy:**
- Fetches project with client data and chronology (complex JOIN)
- Fetches all client contacts via join between `clientPeople` and `people`
- Looks up kanban stage by name AND projectTypeId
- Fetches notification template from `projectTypeNotifications`
- Fetches all stage approval responses with fields and approvals (3-way JOIN)
- Builds approval map with loops
- Imports `applicationGraphClient` to check Outlook availability
- Processes notification variables (string manipulation)
- Calculates business hours for due date

**Red Flags:**
- Dynamic imports inside the function (`import('@shared/businessTime')`, `import('../../utils/applicationGraphClient')`)
- Loop over approval responses to build map
- Called synchronously before HTTP response is sent
- Complex nested data fetching with relationships

**DB Operations:** 8-12 queries

---

### 3.4 Background Email Notifications (`status.ts` via `setImmediate`)

**Location:** `server/routes/projects/status.ts`, lines 230-342

**Description:**
Sends email notifications to newly assigned staff after response is sent.

**Why it's heavy:**
- Fetches stage again by ID
- Resolves assignee (direct user or work role → user lookup)
- For each user to notify:
  - Fetches user notification preferences
  - Fetches full project details again
  - Fetches project chronology
  - Calls SendGrid API (network call)
- Then calls notification scheduler to suppress/reactivate notifications

**Red Flags:**
- Re-fetches data that was already available in the request
- Loop over users with sequential API calls
- External API call (SendGrid) can be slow or fail
- Notification scheduler does another DB query + loop

**DB Operations:** 5-10 per user + external API call

---

### 3.5 Notification Scheduler Stage-Change Handler (`notification-scheduler.ts` → `handleProjectStageChangeForNotifications`)

**Location:** `server/notification-scheduler.ts`, lines 565-640

**Description:**
Handles suppression/reactivation of stage-aware due-date notifications when project stage changes.

**Why it's heavy:**
- Queries all pending notifications for project with stage restrictions
- Loops through each notification individually
- Updates each notification status one by one

**Red Flags:**
- Individual UPDATE per notification (no batch update)
- Could be many notifications per project

**DB Operations:** 1 query + N updates (where N = pending stage-restricted notifications)

---

## 4. Opportunities to Reduce Load

### 4.1 Batch Database Operations

| Current Pattern | Optimization |
|-----------------|--------------|
| Loop INSERT for field responses | Use single `INSERT ... VALUES (...), (...), (...)` |
| Individual message participant INSERTs | Batch insert participants |
| Individual notification status UPDATEs | Use `UPDATE ... WHERE id IN (...)` |

### 4.2 Cache Preloaded Data

| Data Currently Re-fetched | Optimization |
|---------------------------|--------------|
| Project details (fetched 2-3 times) | Pass through from initial fetch |
| Stage config (fetched multiple times) | Cache in request context |
| User preferences | Batch fetch for all potential recipients |
| Chronology (fetched in transaction, then again for email) | Reuse from transaction result |

### 4.3 Move Operations to Background Workers

| Operation | Recommendation |
|-----------|----------------|
| Email sending | Already in setImmediate, but could use proper job queue |
| Push notifications | Queue-based processing |
| Notification suppression/reactivation | Queue-based, non-blocking |
| Message thread creation | Could be deferred if not immediately needed |
| Dashboard cache update | Already scheduled, but ensure stage changes trigger targeted update |

### 4.4 Reduce Cross-Domain Calls

| Current Pattern | Optimization |
|-----------------|--------------|
| Dynamic imports in hot path | Move to module-level imports |
| Multiple storage class calls | Consolidate into single storage method |
| Repeated stage lookup by name | Use stage ID consistently |

### 4.5 Pre-compute Expensive Calculations

| Calculation | Optimization |
|-------------|--------------|
| Business hours in stage | Could be computed lazily or cached |
| Formatted due dates | Compute once and pass through |
| Notification variable processing | Could memoize common patterns |

---

## 5. Recommended Async Candidates

The following operations are candidates for moving off the synchronous stage-change request path:

### 5.1 Definitely Move to Background Queue

| Operation | Priority | Impact | Risk if Delayed |
|-----------|----------|--------|-----------------|
| SendGrid email notifications | **High** | Network latency, can fail | Low - notification delay acceptable |
| Notification suppression/reactivation | **High** | N individual DB updates | Low - brief window of incorrect state |
| Push notifications | **Medium** | External service call | Low - notification delay acceptable |

### 5.2 Consider Moving to Background Queue

| Operation | Priority | Impact | Risk if Delayed |
|-----------|----------|--------|-----------------|
| Message thread creation | **Medium** | 4-5 sequential inserts | Medium - handoff visibility delayed |
| Auto-archive threads (final stage) | **Medium** | Batch update | Low - archival can be slightly delayed |
| Cancel scheduled notifications | **Medium** | Batch update | Low - brief window of stale notifications |

### 5.3 Keep Synchronous (Required for Response)

| Operation | Reason |
|-----------|--------|
| Project status update | Core operation, must complete |
| Chronology entry creation | Required for audit trail |
| Validation operations | Must validate before updating |
| Client notification preview | UI displays this immediately |

---

## 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYNCHRONOUS PATH                                   │
│                                                                             │
│  ┌──────────┐   ┌─────────────┐   ┌─────────────┐   ┌──────────────────┐   │
│  │ Validate │──▶│ DB          │──▶│ Update      │──▶│ Message Thread   │   │
│  │ Request  │   │ Transaction │   │ Project     │   │ Creation         │   │
│  └──────────┘   │             │   └─────────────┘   │ (4-5 INSERTs)    │   │
│                 │ • Chronology│                      └──────────────────┘   │
│                 │ • Fields    │                                             │
│                 └─────────────┘                                             │
│                       │                                                     │
│                       ▼                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Client Notification Preview                        │  │
│  │  • Fetch client contacts (JOIN)                                      │  │
│  │  • Lookup stage template                                             │  │
│  │  • Fetch stage approval responses                                    │  │
│  │  • Process notification variables                                    │  │
│  │  • Check Outlook availability                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                       │                                                     │
│                       ▼                                                     │
│               ┌───────────────┐                                            │
│               │ HTTP Response │                                            │
│               └───────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                        │
                        ▼ setImmediate
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ASYNC PATH (after response)                        │
│                                                                             │
│  ┌───────────────┐   ┌────────────────────┐   ┌──────────────────────────┐ │
│  │ Resolve       │──▶│ For each user:     │──▶│ Notification Scheduler   │ │
│  │ Assignees     │   │ • Get preferences  │   │ • Suppress ineligible    │ │
│  │ (user/role)   │   │ • Get project      │   │ • Reactivate eligible    │ │
│  └───────────────┘   │ • Get chronology   │   │ • (N individual UPDATEs) │ │
│                       │ • Send email 📧    │   └──────────────────────────┘ │
│                       └────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Summary of Key Findings

### Total Estimated DB Operations per Stage Change

| Phase | Min Operations | Max Operations | Notes |
|-------|----------------|----------------|-------|
| Validation | 4 | 8 | Depends on approvals |
| Transaction | 3 | 10+ | Depends on field count |
| Message thread | 4 | 5 | Always if enabled |
| Client notification preview | 8 | 12 | Complex JOINs |
| Background email | 5 | 10+ | Per recipient |
| Notification scheduler | 1 | 10+ | Per restricted notification |
| **Total** | **25** | **55+** | Significant DB pressure |

### External API Calls

- SendGrid (email): 1 per recipient
- Outlook Graph check: 1 per stage change (for client notifications)

### Critical Bottlenecks (Priority Order)

1. **Transaction with loop** - Field responses processed individually
2. **Client notification preview** - Too many queries, blocks response
3. **Background email loop** - Re-fetches data, sequential API calls
4. **Notification scheduler updates** - Individual row updates

### Quick Wins

1. Batch field response insertions (immediate improvement)
2. Pass fetched data through instead of re-querying
3. Move notification scheduler updates to queue
4. Batch message participant insertions

---

## 8. Files Involved in Stage-Change Flow

| File | Role | Key Methods |
|------|------|-------------|
| `server/routes/projects/status.ts` | API endpoint | `PATCH /api/projects/:id/status` |
| `server/storage/projects/projectStatusStorage.ts` | Core status update logic | `updateProjectStatus()` |
| `server/storage/notifications/stageChangeNotificationStorage.ts` | Notification prep & sending | `prepareClientValueNotification()`, `sendStageChangeNotification()` |
| `server/notification-scheduler.ts` | Stage-aware notification handling | `handleProjectStageChangeForNotifications()` |
| `server/notification-sender.ts` | Notification delivery | `processSingleNotification()` |
| `server/emailService.ts` | Email composition & sending | `sendStageChangeNotificationEmail()` |
| `server/storage/projects/types.ts` | Helper interfaces | `ProjectStorageHelpers` |
| `server/storage/facade/projects.facade.ts` | Storage facade | Delegates to storage classes |

---

*Document generated for diagnostic purposes. No refactoring has been performed.*
