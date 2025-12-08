# AI Email Dashboard - Technical Specification

**Version:** 1.0  
**Created:** December 2024  
**Status:** Implementation Phase 1

---

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Thread State Machine](#thread-state-machine)
4. [SLA Calculation](#sla-calculation)
5. [Data Model](#data-model)
6. [API Endpoints](#api-endpoints)
7. [Frontend Components](#frontend-components)
8. [AI Features (Future Phases)](#ai-features-future-phases)
9. [Implementation Phases](#implementation-phases)

---

## Overview

The AI Email Dashboard provides staff users with a sophisticated, action-oriented email management system that ensures no client emails are missed while tracking response SLAs and (in future phases) leveraging AI for task suggestions, sentiment analysis, and proposed replies.

### Key Goals

1. **Zero-inbox workflow** - Every client email is accounted for
2. **SLA compliance** - Track response times against company targets
3. **Safety guarantees** - No risk of missing client communications
4. **Cutting-edge UX** - Keyboard shortcuts, real-time updates, mobile-ready

### Foundation (Already Built)

- MS Graph integration for email sync (Inbox + Sent Items)
- Email threading and client association
- Attachment handling and storage
- OpenAI integration for future AI features

---

## Core Concepts

### Thread States

| State | Description | Trigger |
|-------|-------------|---------|
| `active` | Requires staff response | Latest message is inbound from client |
| `complete` | Staff has responded or marked done | Staff sends reply OR manually marks complete |
| `snoozed` | Temporarily hidden (future) | User snoozes until specific date |

### SLA Logic

- **Thread-level tracking** - One SLA per thread, not per message
- **Clock starts** when thread becomes active (inbound email received)
- **Clock stops** when thread becomes complete (reply sent or marked done)
- **Working days only** - Excludes weekends and optionally holidays
- **Working hours considered** for same-day calculations

### Safety Guarantees

1. **Default to active** - Any thread with `latestDirection: 'inbound'` defaults to active
2. **Auto re-activation** - Client reply instantly flips complete → active
3. **Visual accountability** - Dashboard shows pending count prominently
4. **Fallback view** - "All Threads" always accessible, nothing permanently hidden

---

## Thread State Machine

```
                         ┌──────────────────┐
                         │                  │
     New inbound    ───► │     ACTIVE       │ ◄─── Client replies
     email (client)      │  (needs response)│      (auto re-activate)
                         │                  │
                         └────────┬─────────┘
                                  │
              Staff sends reply   │   OR manually marks "Complete"
                                  │
                                  ▼
                         ┌──────────────────┐
                         │                  │
                         │    COMPLETE      │
                         │   (responded)    │
                         │                  │
                         └──────────────────┘
```

### State Transitions

| From | To | Trigger |
|------|----|---------|
| - | `active` | New thread created with inbound email from client |
| `active` | `complete` | Staff sends outbound reply |
| `active` | `complete` | Staff manually marks complete |
| `complete` | `active` | Client sends new inbound email |
| `active` | `snoozed` | User snoozes thread (future) |
| `snoozed` | `active` | Snooze period expires OR client replies |

---

## SLA Calculation

### Company Settings

```typescript
interface SlaSettings {
  slaResponseDays: number;         // e.g., 2 (working days)
  slaWorkingDaysOnly: boolean;     // true = exclude weekends
  workingHoursStart: string;       // "09:00"
  workingHoursEnd: string;         // "17:30"
  workingDays: string[];           // ["mon", "tue", "wed", "thu", "fri"]
}
```

### SLA Status Values

| Status | Description | Visual |
|--------|-------------|--------|
| `on_track` | < 75% of SLA elapsed | 🟢 Green |
| `at_risk` | 75-100% of SLA elapsed | 🟠 Amber |
| `breached` | > 100% of SLA elapsed | 🔴 Red |
| `n/a` | Thread is complete or no SLA applies | ⚪ Gray |

### Calculation Logic

```typescript
function calculateSlaStatus(thread: EmailThread, settings: SlaSettings): SlaStatus {
  // Only active threads have an SLA
  if (thread.slaStatus !== 'active') {
    return { status: 'n/a', hoursRemaining: null };
  }

  const now = new Date();
  const activeAt = thread.slaBecameActiveAt;
  
  // Calculate working hours elapsed
  const workingHoursElapsed = calculateWorkingHours(activeAt, now, settings);
  const slaHours = settings.slaResponseDays * 8; // 8 working hours per day
  const percentUsed = (workingHoursElapsed / slaHours) * 100;
  
  if (percentUsed >= 100) {
    return { status: 'breached', hoursRemaining: workingHoursElapsed - slaHours };
  } else if (percentUsed >= 75) {
    return { status: 'at_risk', hoursRemaining: slaHours - workingHoursElapsed };
  } else {
    return { status: 'on_track', hoursRemaining: slaHours - workingHoursElapsed };
  }
}
```

### Working Hours Calculation

The working hours calculation:
1. Iterates through each day from start to end
2. Skips non-working days (weekends)
3. Counts only hours within working hours range
4. Returns total working hours elapsed

---

## Data Model

### Schema Changes

#### email_threads Table (Additions)

```sql
ALTER TABLE email_threads ADD COLUMN sla_status VARCHAR DEFAULT 'active';
ALTER TABLE email_threads ADD COLUMN sla_became_active_at TIMESTAMP;
ALTER TABLE email_threads ADD COLUMN sla_completed_at TIMESTAMP;
ALTER TABLE email_threads ADD COLUMN sla_completed_by VARCHAR REFERENCES users(id);
ALTER TABLE email_threads ADD COLUMN sla_snooze_until TIMESTAMP;

CREATE INDEX idx_email_threads_sla_status ON email_threads(sla_status);
CREATE INDEX idx_email_threads_sla_became_active_at ON email_threads(sla_became_active_at);
```

#### company_settings Table (Additions)

```sql
ALTER TABLE company_settings ADD COLUMN sla_response_days INTEGER DEFAULT 2;
ALTER TABLE company_settings ADD COLUMN sla_working_days_only BOOLEAN DEFAULT true;
ALTER TABLE company_settings ADD COLUMN working_hours_start VARCHAR DEFAULT '09:00';
ALTER TABLE company_settings ADD COLUMN working_hours_end VARCHAR DEFAULT '17:30';
ALTER TABLE company_settings ADD COLUMN working_days JSONB DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb;
```

### Drizzle Schema

```typescript
// email_threads additions
export const emailSlaStatusEnum = pgEnum("email_sla_status", ["active", "complete", "snoozed"]);

// In emailThreads table:
slaStatus: emailSlaStatusEnum("sla_status").default("active"),
slaBecameActiveAt: timestamp("sla_became_active_at"),
slaCompletedAt: timestamp("sla_completed_at"),
slaCompletedBy: varchar("sla_completed_by").references(() => users.id),
slaSnoozeUntil: timestamp("sla_snooze_until"),

// company_settings additions:
slaResponseDays: integer("sla_response_days").default(2),
slaWorkingDaysOnly: boolean("sla_working_days_only").default(true),
workingHoursStart: varchar("working_hours_start").default("09:00"),
workingHoursEnd: varchar("working_hours_end").default("17:30"),
workingDays: jsonb("working_days").default(sql`'["mon","tue","wed","thu","fri"]'::jsonb`),
```

---

## API Endpoints

### GET /api/email-dashboard/threads

Get threads for dashboard with SLA status calculated.

**Query Parameters:**
- `status`: `active` | `complete` | `all` (default: `active`)
- `assignedTo`: User ID filter (for "My Threads")
- `sortBy`: `sla_urgency` | `last_message` | `client_name`
- `limit`: Number (default: 50)
- `offset`: Number (default: 0)

**Response:**
```json
{
  "threads": [
    {
      "canonicalConversationId": "...",
      "subject": "VAT Return Query",
      "client": {
        "id": "...",
        "name": "ABC Company Ltd"
      },
      "slaStatus": "active",
      "slaBecameActiveAt": "2024-12-08T09:30:00Z",
      "slaCalculated": {
        "status": "at_risk",
        "hoursRemaining": 4.5,
        "displayText": "4h 30m remaining"
      },
      "latestMessage": {
        "preview": "Can you confirm the deadline...",
        "from": "john@abccompany.com",
        "receivedAt": "2024-12-08T09:30:00Z"
      },
      "messageCount": 5,
      "assignedUsers": ["user-id-1"]
    }
  ],
  "stats": {
    "active": 12,
    "breached": 2,
    "atRisk": 3,
    "onTrack": 7,
    "complete": 145
  },
  "pagination": {
    "total": 12,
    "limit": 50,
    "offset": 0
  }
}
```

### PATCH /api/email-dashboard/threads/:threadId/complete

Mark a thread as complete.

**Request Body:**
```json
{
  "reason": "replied" | "no_response_needed" | "handled_offline"
}
```

**Response:**
```json
{
  "success": true,
  "thread": { ... }
}
```

### PATCH /api/email-dashboard/threads/:threadId/reactivate

Manually reactivate a complete thread.

**Response:**
```json
{
  "success": true,
  "thread": { ... }
}
```

### GET /api/email-dashboard/stats

Get SLA statistics overview.

**Response:**
```json
{
  "overall": {
    "active": 12,
    "breached": 2,
    "atRisk": 3,
    "onTrack": 7
  },
  "byUser": [
    {
      "userId": "...",
      "userName": "Sarah Jones",
      "active": 5,
      "breached": 1,
      "atRisk": 2,
      "onTrack": 2
    }
  ],
  "slaCompliance": {
    "last7Days": 94.5,
    "last30Days": 92.1
  }
}
```

---

## Frontend Components

### Page: /email-dashboard

Main dashboard view with smart inbox.

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  📧 Email Dashboard                              [Settings] [Help]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  SLA OVERVIEW                                                │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │   │
│  │  │ 🔴 2    │  │ 🟠 3    │  │ 🟢 7    │  │ ✓ 145   │        │   │
│  │  │Breached │  │ At Risk │  │On Track │  │Complete │        │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ACTIVE THREADS                    [Filter ▾] [Sort: Urgency] │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ 🔴 ABC Company Ltd                         ⏰ 2h overdue     │  │
│  │    "Can you confirm the VAT deadline for..."                 │  │
│  │    john@abccompany.com • 5 messages • Today 9:14am          │  │
│  │    [Reply] [✓ Complete] [⋯]                                  │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ 🟠 XYZ Corp                                ⏰ 4h remaining   │  │
│  │    "Please could you send the tax returns..."                │  │
│  │    mary@xyzcorp.com • 2 messages • Yesterday 4:30pm         │  │
│  │    [Reply] [✓ Complete] [⋯]                                  │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ 🟢 Smith & Associates                      ⏰ 1d 6h left     │  │
│  │    "Thanks for your email regarding..."                      │  │
│  │    tom@smith-associates.co.uk • 3 messages • Today 11:00am  │  │
│  │    [Reply] [✓ Complete] [⋯]                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Keyboard: j/k navigate • r reply • e complete • ? help            │
└─────────────────────────────────────────────────────────────────────┘
```

### Thread Row Component

```typescript
interface ThreadRowProps {
  thread: DashboardThread;
  isSelected: boolean;
  onSelect: () => void;
  onReply: () => void;
  onComplete: () => void;
}
```

Features:
- SLA indicator (colored dot + time remaining)
- Client name (bold)
- Subject/preview (truncated)
- Sender email
- Message count badge
- Last activity timestamp
- Action buttons (Reply, Complete, More)

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` | Move to next thread |
| `k` | Move to previous thread |
| `r` | Open reply composer |
| `e` | Mark complete |
| `o` or `Enter` | Open thread detail |
| `g i` | Go to inbox |
| `g c` | Go to completed |
| `?` | Show keyboard shortcuts help |

### Mobile Considerations

- Swipe right: Mark complete
- Swipe left: Snooze (future)
- Pull to refresh
- Responsive layout with collapsible panels

---

## AI Features (Future Phases)

### Phase 2: AI Email Analysis

Analyze incoming emails on sync:

```typescript
interface EmailAiAnalysis {
  sentiment: number;              // -1 to +1
  sentimentConfidence: number;    // 0 to 1
  containsQuestion: boolean;
  requiresAction: boolean;
  suggestedTaskType: string | null;
  keyTopics: string[];
  analyzedAt: Date;
}
```

### Phase 3: Suggested Tasks

Auto-generate task suggestions from emails:

```typescript
interface SuggestedTask {
  id: string;
  emailMessageId: string;
  threadId: string;
  clientId: string;
  taskType: 'reply' | 'follow_up' | 'schedule_call' | 'review_document';
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'dismissed' | 'completed';
  createdAt: Date;
}
```

### Phase 4: Proposed Replies

AI-generated draft responses with context:

```typescript
interface ProposedReply {
  id: string;
  threadId: string;
  generatedByUserId: string;
  draftContent: string;
  contextUsed: {
    threadHistory: boolean;
    previousThreads: number;
    clientProfile: boolean;
    chronologyNotes: number;
  };
  status: 'generated' | 'edited' | 'sent' | 'discarded';
  createdAt: Date;
}
```

Context gathering for reply generation:
1. Full email thread history
2. Previous threads with same client (last 5)
3. Client profile data
4. Recent chronology entries (last 30 days)
5. (Future) QuickBooks data, tax returns, accounts

### Phase 5: Sentiment Analysis Dashboard

Track client satisfaction trends:
- Per-thread sentiment trend
- Client-level overall sentiment
- Alerts for declining sentiment
- "At-risk clients" section

---

## Implementation Phases

### Phase 1: SLA Foundation (Current)

- [x] Specification document
- [ ] Schema changes (slaStatus, slaBecameActiveAt, etc.)
- [ ] SLA calculation service
- [ ] API endpoints for dashboard
- [ ] Dashboard UI with thread list
- [ ] Mark complete functionality
- [ ] Keyboard shortcuts

### Phase 2: AI Email Analysis

- [ ] Background job to analyze new emails
- [ ] Store analysis results
- [ ] Surface sentiment in dashboard
- [ ] Question detection indicators

### Phase 3: Suggested Tasks

- [ ] Task suggestion generation
- [ ] Accept/dismiss workflow
- [ ] Integration with internal tasks

### Phase 4: Proposed Replies

- [ ] Context gathering pipeline
- [ ] Reply generation with OpenAI
- [ ] Draft editing UI
- [ ] Send via Graph integration

### Phase 5: Advanced Features

- [ ] Snooze functionality
- [ ] Team assignment
- [ ] SLA reporting/analytics
- [ ] Holiday calendar
- [ ] Client-specific SLA overrides

---

## Appendix: Auto-Status Updates on Sync

When email ingestion runs, automatically update thread SLA status:

```typescript
async function updateThreadSlaOnSync(thread: EmailThread, latestMessage: EmailMessage) {
  const isInbound = latestMessage.direction === 'inbound';
  const isFromClient = thread.clientId !== null;
  
  if (isInbound && isFromClient) {
    // Client sent a message - thread becomes active
    if (thread.slaStatus !== 'active') {
      await updateThread(thread.id, {
        slaStatus: 'active',
        slaBecameActiveAt: latestMessage.receivedDateTime,
        slaCompletedAt: null,
        slaCompletedBy: null
      });
    }
  } else if (!isInbound && thread.slaStatus === 'active') {
    // Staff sent a reply - thread becomes complete
    await updateThread(thread.id, {
      slaStatus: 'complete',
      slaCompletedAt: latestMessage.sentDateTime
    });
  }
}
```

This ensures SLA status stays synchronized with the actual email state automatically.
