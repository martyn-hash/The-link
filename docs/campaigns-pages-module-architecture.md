# Campaigns & Pages Communications Module - Architecture Specification

**Document Version:** 1.1  
**Last Updated:** December 2025  
**Status:** Phase 1 Complete - Foundation Implemented

---

## Implementation Status

### Phase 1: Foundation ✅ COMPLETE (December 2025)

**Database Schema (14 tables created):**
- ✅ `contact_preferences` - Category-based opt-out per person
- ✅ `preference_tokens` - Secure database-persisted tokens for preference centre
- ✅ `campaign_templates` - Reusable campaign templates
- ✅ `campaigns` - Core campaign management
- ✅ `campaign_target_criteria` - Client-first targeting filters
- ✅ `campaign_messages` - Multi-channel message content
- ✅ `campaign_recipients` - Resolved recipient list with status tracking
- ✅ `campaign_engagement` - Engagement event tracking
- ✅ `client_engagement_scores` - Per-client scoring
- ✅ `campaign_delivery_queue` - Retry-aware delivery queue
- ✅ `pages` - Page definitions
- ✅ `page_components` - Component blocks with grid layout
- ✅ `page_actions` - Smart action handlers
- ✅ `page_visits` - Page engagement tracking

**Storage Layer (12 modules created):**
- ✅ Campaign storage: `campaignStorage`, `campaignTemplateStorage`, `campaignTargetStorage`, `campaignRecipientStorage`, `campaignMessageStorage`, `campaignDeliveryStorage`, `campaignAnalyticsStorage`
- ✅ Page storage: `pageStorage`, `pageComponentStorage`, `pageActionStorage`, `pageVisitStorage`
- ✅ Contact preferences storage with database-persisted tokens

**API Routes (registered with proper middleware):**
- ✅ `/api/campaigns/*` - Full campaign CRUD and workflow management
- ✅ `/api/pages/*` - Page builder and component management
- ✅ `/api/contact-preferences/*` - Token-based preference management

### Remaining Phases

**Phase 2: Campaign Engine** - Pending
- Targeting engine with all 16+ filter types
- Recipient resolution with duplicate history
- Message composition with merge field rendering
- Email/SMS delivery with retry logic
- Campaign workflow state machine with mandatory preview

**Phase 3: Pages Module** - Pending
- Page builder with 14 component types
- Grid layout system
- Smart actions with OTP verification
- Page personalisation and rendering

**Phase 4: Multi-Step Campaigns** - Pending
- Campaign sequences (steps)
- Behaviour-based progression
- Step scheduling and execution

**Phase 5: Analytics & Polish** - Pending
- Engagement scoring calculation
- Campaign analytics dashboard
- Voice channel integration (Dialora.ai)
- Performance optimisation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Model](#3-data-model)
4. [Targeting Engine Logic](#4-targeting-engine-logic)
5. [Recipient Resolution Logic](#5-recipient-resolution-logic)
6. [Campaign Lifecycle & State Machine](#6-campaign-lifecycle--state-machine)
7. [Pages Component System](#7-pages-component-system)
8. [Analytics Model](#8-analytics-model)
9. [Integration Points](#9-integration-points)
10. [UI/UX Flow Specifications](#10-uiux-flow-specifications)
11. [Assumptions & Constraints](#11-assumptions--constraints)
12. [Implementation Recommendations](#12-implementation-recommendations)

---

## 1. Executive Summary

### Purpose
The Campaigns & Pages module enables The Link to communicate at scale with clients through targeted, workflow-driven outbound campaigns. Unlike marketing automation, this is **client-centric operational communications** designed to:

- Nudge behaviour (missing data, deadlines, engagement)
- Upsell services ethically and relevantly
- Measure engagement and commercial impact
- Log every interaction back to the client record

### Key Principles
1. **Client-first targeting** - Filters operate on clients, contacts are resolved after
2. **Behaviour-aware** - Use engagement history and data completeness for targeting
3. **Workflow-triggered** - Not broadcast-driven spam
4. **Everything logged** - All interactions appear in client timeline
5. **Everything previewable** - Safe to build, hard to misuse

### Module Components
1. **Campaigns** - Targeted multi-channel outbound communications
2. **Pages** - Optional personalised action surfaces (not brochure sites)

---

## 2. Architecture Overview

### 2.1 High-Level Architecture Diagram (Textual)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CAMPAIGNS MODULE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐      │
│  │   Targeting  │───>│  Recipient   │───>│   Message Builder    │      │
│  │    Engine    │    │  Resolution  │    │   (Email/SMS/Voice)  │      │
│  └──────────────┘    └──────────────┘    └──────────────────────┘      │
│         │                   │                      │                    │
│         v                   v                      v                    │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                   Campaign Orchestrator                       │      │
│  │  (Preview → Validate → Schedule → Send → Track)               │      │
│  └──────────────────────────────────────────────────────────────┘      │
│         │                                          │                    │
│         v                                          v                    │
│  ┌──────────────┐                         ┌──────────────────┐         │
│  │    Pages     │<------------------------│   Delivery Hub   │         │
│  │   (Optional) │                         │ (SendGrid/Voodoo/│         │
│  └──────────────┘                         │  Dialora.ai)     │         │
│         │                                  └──────────────────┘         │
│         v                                          │                    │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                    Analytics & Logging                        │      │
│  │  (Client Timeline / Campaign Dashboard / Engagement Tracking) │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Summary

```
1. Campaign Created (Draft)
       │
       v
2. Define Target Criteria (Client-based filters)
       │
       v
3. Resolve Recipients (Contact-level, deduplicated)
       │
       v
4. Create Messages (Email/SMS/Voice with merge fields)
       │
       v
5. Attach Page (Optional - personalised action surface)
       │
       v
6. Preview & Validate (Check merge data, preview as recipient)
       │
       v
7. Approve & Schedule/Send
       │
       v
8. Delivery (Via SendGrid/VoodooSMS/Dialora.ai)
       │
       v
9. Track Engagement (Opens, clicks, page views, actions)
       │
       v
10. Log to Client Records (Communications timeline)
       │
       v
11. Analytics Dashboard (Performance metrics)
```

### 2.3 Storage Layer Organisation

Following The Link's existing facade pattern:

```
server/storage/
├── campaigns/
│   ├── campaignStorage.ts        # Core campaign CRUD
│   ├── campaignTargetStorage.ts  # Target criteria storage
│   ├── campaignRecipientStorage.ts
│   ├── campaignMessageStorage.ts
│   ├── campaignAnalyticsStorage.ts
│   └── index.ts
├── pages/
│   ├── pageStorage.ts            # Page definitions
│   ├── pageComponentStorage.ts   # Component blocks
│   ├── pageActionStorage.ts      # Smart action handlers
│   ├── pageAnalyticsStorage.ts   # Page engagement tracking
│   └── index.ts
└── facade/
    └── campaigns.facade.ts       # Unified facade
```

---

## 3. Data Model

### 3.1 Core Campaign Tables

#### `campaigns` Table
```
campaigns
├── id: varchar (PK, UUID)
├── name: varchar (required)
├── description: text
├── type: campaignTypeEnum ('chase' | 'informational' | 'upsell' | 'engagement')
├── status: campaignStatusEnum ('draft' | 'targeting' | 'composing' | 'review' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled')
├── createdByUserId: varchar (FK → users.id)
├── scheduledFor: timestamp (nullable - for scheduled sends)
├── sentAt: timestamp (nullable)
├── targetCriteriaSnapshot: jsonb (frozen at send time)
├── recipientCountSnapshot: integer (frozen at send time)
├── pageId: varchar (FK → pages.id, nullable)
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [status, createdByUserId, scheduledFor, type]
```

#### `campaignTargetCriteria` Table
```
campaignTargetCriteria
├── id: varchar (PK, UUID)
├── campaignId: varchar (FK → campaigns.id, CASCADE)
├── filterGroup: integer (for AND/OR grouping)
├── filterType: varchar (e.g., 'client_type', 'service_has', 'project_overdue')
├── operator: varchar ('equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'between' | 'is_null' | 'is_not_null')
├── value: jsonb (flexible for single values, arrays, ranges)
├── joinLogic: varchar ('AND' | 'OR')
├── sortOrder: integer
├── createdAt: timestamp
└── indexes: [campaignId, filterType]
```

#### `campaignRecipients` Table
```
campaignRecipients
├── id: varchar (PK, UUID)
├── campaignId: varchar (FK → campaigns.id, CASCADE)
├── clientId: varchar (FK → clients.id)
├── personId: varchar (FK → people.id)
├── channel: channelEnum ('email' | 'sms' | 'voice')
├── channelAddress: varchar (email address or phone number)
├── inclusionReason: text (why this recipient was included)
├── status: recipientStatusEnum ('pending' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'excluded')
├── manuallyAdded: boolean (default false)
├── manuallyRemoved: boolean (default false)
├── removedByUserId: varchar (FK → users.id, nullable)
├── sentAt: timestamp
├── deliveredAt: timestamp
├── openedAt: timestamp
├── clickedAt: timestamp
├── actionTakenAt: timestamp
├── actionType: varchar (nullable)
├── failureReason: text
├── createdAt: timestamp
└── indexes: [campaignId, clientId, personId, channel, status]
```

#### `campaignMessages` Table
```
campaignMessages
├── id: varchar (PK, UUID)
├── campaignId: varchar (FK → campaigns.id, CASCADE)
├── channel: channelEnum ('email' | 'sms' | 'voice')
├── subject: varchar (email only)
├── body: text (email/SMS content)
├── voiceScript: text (AI voice script, voice only)
├── attachments: jsonb (array of attachment references)
├── mergeFieldsUsed: text[] (list of merge fields in content)
├── isActive: boolean (default true)
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [campaignId, channel]
```

### 3.2 Pages Tables

#### `pages` Table
```
pages
├── id: varchar (PK, UUID)
├── name: varchar (internal name)
├── slug: varchar (URL slug, unique per campaign)
├── campaignId: varchar (FK → campaigns.id, nullable - can be standalone)
├── layoutType: varchar ('single_column' | 'two_column' | 'custom')
├── headerTitle: varchar
├── headerSubtitle: text
├── logoObjectPath: varchar (optional custom logo)
├── themeColor: varchar (hex color)
├── isPublished: boolean (default false)
├── expiresAt: timestamp (optional expiry)
├── createdByUserId: varchar (FK → users.id)
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [campaignId, slug, isPublished]
```

#### `pageComponents` Table
```
pageComponents
├── id: varchar (PK, UUID)
├── pageId: varchar (FK → pages.id, CASCADE)
├── componentType: pageComponentTypeEnum (see below)
├── sectionIndex: integer (section position)
├── rowIndex: integer (row within section)
├── columnIndex: integer (column within row, 1-4)
├── columnSpan: integer (1-4, how many columns to span)
├── content: jsonb (component-specific content structure)
├── conditionalLogic: jsonb (future: conditional display rules)
├── sortOrder: integer
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [pageId, sectionIndex, sortOrder]

pageComponentTypeEnum:
  'text_block' | 'heading' | 'image' | 'table' | 'button' | 'form' |
  'callout' | 'status_widget' | 'timeline' | 'faq_accordion' |
  'comparison_table' | 'video_embed' | 'document_list' | 'spacer'
```

#### `pageActions` Table
```
pageActions
├── id: varchar (PK, UUID)
├── pageId: varchar (FK → pages.id, CASCADE)
├── componentId: varchar (FK → pageComponents.id, CASCADE, nullable)
├── actionType: pageActionTypeEnum (see below)
├── label: varchar (button text)
├── description: text
├── config: jsonb (action-specific configuration)
├── requiresAuth: boolean (default false - recipient auto-identified via token)
├── isEnabled: boolean (default true)
├── sortOrder: integer
├── createdAt: timestamp
└── indexes: [pageId, actionType]

pageActionTypeEnum:
  'interested' | 'documents_uploaded' | 'book_call' | 'request_extension' |
  'confirm_details' | 'custom_webhook' | 'change_project_stage' | 'create_task'
```

### 3.3 Engagement Tracking Tables

#### `campaignEngagement` Table
```
campaignEngagement
├── id: varchar (PK, UUID)
├── campaignId: varchar (FK → campaigns.id, CASCADE)
├── recipientId: varchar (FK → campaignRecipients.id, CASCADE)
├── eventType: engagementEventEnum (see below)
├── channel: channelEnum
├── eventData: jsonb (additional event details)
├── ipAddress: varchar
├── userAgent: text
├── timestamp: timestamp
└── indexes: [campaignId, recipientId, eventType, timestamp]

engagementEventEnum:
  'sent' | 'delivered' | 'bounced' | 'opened' | 'clicked' |
  'page_viewed' | 'action_clicked' | 'action_completed' | 'unsubscribed'
```

#### `pageVisits` Table
```
pageVisits
├── id: varchar (PK, UUID)
├── pageId: varchar (FK → pages.id, CASCADE)
├── recipientId: varchar (FK → campaignRecipients.id, nullable)
├── clientId: varchar (FK → clients.id)
├── personId: varchar (FK → people.id)
├── visitToken: varchar (unique tracking token)
├── ipAddress: varchar
├── userAgent: text
├── referrer: varchar
├── firstViewedAt: timestamp
├── lastViewedAt: timestamp
├── viewCount: integer (default 1)
├── actionsCompleted: jsonb (array of action IDs completed)
└── indexes: [pageId, recipientId, clientId, visitToken]
```

### 3.4 Enums

```typescript
// Campaign Status Flow
campaignStatusEnum: 'draft' | 'targeting' | 'composing' | 'review' | 
                    'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'

// Campaign Types
campaignTypeEnum: 'chase' | 'informational' | 'upsell' | 'engagement'

// Channels
channelEnum: 'email' | 'sms' | 'voice'

// Recipient Status
recipientStatusEnum: 'pending' | 'sent' | 'delivered' | 'bounced' | 
                     'failed' | 'excluded' | 'unsubscribed'
```

---

## 4. Targeting Engine Logic

### 4.1 Philosophy
**Filtering is client-first, not contact-first.**
- All filters operate on the `clients` table and related entities
- Contacts (people) are resolved AFTER the client list is built
- This enables powerful queries like "clients with service X but not service Y"

### 4.2 Filter Categories & Implementation

#### Category 1: Client Type & Status
| Filter | Query Logic | Value Type |
|--------|-------------|------------|
| Client is Company | `clients.clientType = 'company'` | enum |
| Client is Individual | `clients.clientType = 'individual'` | enum |
| Client status | `clients.companyStatus IN (...)` | multi-select |
| Client manager | `clients.managerId = ?` | user select |
| Monthly fee range | `clients.monthlyChargeQuote BETWEEN ? AND ?` | range |

#### Category 2: Services & Revenue
| Filter | Query Logic | Value Type |
|--------|-------------|------------|
| Has service X | `EXISTS (SELECT 1 FROM clientServices WHERE clientServices.clientId = clients.id AND clientServices.serviceId = ? AND clientServices.isActive = true)` | service select |
| Does NOT have service X | `NOT EXISTS (SELECT 1 FROM clientServices WHERE clientServices.clientId = clients.id AND clientServices.serviceId = ? AND clientServices.isActive = true)` | service select |
| Has service X but not Y | Compound filter with AND logic | multi-service |

#### Category 3: Projects & Compliance
| Filter | Query Logic | Value Type |
|--------|-------------|------------|
| Has active project type X | `EXISTS (SELECT 1 FROM projects WHERE projects.clientId = clients.id AND projects.projectTypeId = ? AND projects.status = 'active')` | project type select |
| Project at stage X | `EXISTS (SELECT 1 FROM projects p JOIN kanbanStages k ON p.kanbanStageId = k.id WHERE p.clientId = clients.id AND k.id = ?)` | stage select |
| Accounts due within range | `clients.nextAccountsDue BETWEEN ? AND ?` | date range |
| Confirmation statement due | `clients.confirmationStatementNextDue BETWEEN ? AND ?` | date range |
| Has overdue projects | `EXISTS (SELECT 1 FROM projects WHERE projects.clientId = clients.id AND projects.dueDate < NOW() AND projects.status = 'active')` | boolean |

#### Category 4: Data Completeness (Behavioural Gold)
| Filter | Query Logic | Value Type |
|--------|-------------|------------|
| Missing UTR | `clients.companyUtr IS NULL OR clients.companyUtr = ''` | boolean |
| Missing Companies House auth code | `clients.companiesHouseAuthCode IS NULL` | boolean |
| Docs outstanding > X days | Custom query against outstanding document requests | days |

#### Category 5: Engagement & Behaviour
| Filter | Query Logic | Value Type |
|--------|-------------|------------|
| Opened last campaign | `EXISTS (SELECT 1 FROM campaignRecipients cr JOIN campaignEngagement ce ON cr.id = ce.recipientId WHERE cr.clientId = clients.id AND ce.eventType = 'opened' ORDER BY ce.timestamp DESC LIMIT 1)` | boolean |
| Clicked campaign link | Similar pattern for 'clicked' event | boolean |
| Took action on page | Check `pageVisits.actionsCompleted` | boolean |
| Ignored last X chases | Count campaigns with no engagement | number |
| Last contact date > X days | Query `communications` table for most recent | days |
| Portal login within X days | `EXISTS (SELECT 1 FROM clientPortalUsers WHERE clientId = clients.id AND lastLogin > NOW() - INTERVAL 'X days')` | days |

### 4.3 Filter Execution Engine

```typescript
interface FilterCriterion {
  filterType: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'between' | 'is_null' | 'is_not_null';
  value: any;
  joinLogic: 'AND' | 'OR';
  filterGroup: number;
}

// Execution pseudocode
function buildTargetQuery(criteria: FilterCriterion[]): SQL {
  // Group criteria by filterGroup
  const groups = groupBy(criteria, 'filterGroup');
  
  // Within each group, apply AND logic
  // Between groups, apply OR logic
  
  return sql`
    SELECT DISTINCT c.* FROM clients c
    WHERE (
      ${groups.map(group => 
        group.map(criterion => buildFilterClause(criterion)).join(' AND ')
      ).join(' OR ')}
    )
  `;
}
```

### 4.4 Live Count Updates
As filters are added/modified, show live recipient count:
- Debounced query execution (300ms after last change)
- Display: "~847 clients match your criteria"
- Warning if count is very high or zero

---

## 5. Recipient Resolution Logic

### 5.1 Resolution Flow

```
1. Execute targeting query → Get matched client IDs
       │
       v
2. Apply recipient rules (who to contact per client)
       │
       ├── Primary contact only
       ├── All contacts
       └── Role-based contacts (Director, Finance, Payroll)
       │
       v
3. For each contact, check channel availability
       │
       ├── Email: people.email IS NOT NULL AND people.email != ''
       ├── SMS: people.telephone IS NOT NULL (normalize to E.164)
       └── Voice: Same as SMS
       │
       v
4. Deduplicate per channel
       │
       ├── Same email across multiple clients → Single entry
       └── Same phone across multiple clients → Single entry
       │
       v
5. Apply opt-out filters
       │
       └── people.receiveNotifications = true
       │
       v
6. Generate recipient list with inclusion reasons
```

### 5.2 Recipient Rules Configuration

```typescript
interface RecipientRules {
  strategy: 'primary_only' | 'all_contacts' | 'role_based';
  roles?: string[];  // For role_based: ['Director', 'Finance Contact', etc.]
  channels: {
    email: boolean;
    sms: boolean;
    voice: boolean;
  };
  deduplication: 'per_client' | 'global';
}
```

### 5.3 Inclusion Reason Generation
For each recipient, store why they were included:

```
"Matched: Client has 'Annual Accounts' service, client manager is 'John Smith', 
 contact is primary contact with role 'Director'"
```

This enables:
- Staff understanding of why someone received a campaign
- Audit trail for compliance
- Debugging targeting issues

### 5.4 Manual Adjustments
Allow staff to:
1. **Remove individual recipients** - Sets `manuallyRemoved = true`, stores reason
2. **Add specific people** - Sets `manuallyAdded = true`, bypasses targeting rules
3. **See full recipient list** with pagination and search

---

## 6. Campaign Lifecycle & State Machine

### 6.1 State Diagram

```
                    ┌──────────────────────────────────────────────────┐
                    │                                                  │
                    v                                                  │
┌─────────┐   ┌───────────┐   ┌───────────┐   ┌────────┐   ┌─────────┐
│  DRAFT  │──>│ TARGETING │──>│ COMPOSING │──>│ REVIEW │──>│SCHEDULED│
└─────────┘   └───────────┘   └───────────┘   └────────┘   └─────────┘
     │              │               │              │              │
     │              │               │              │              v
     │              │               │              │        ┌─────────┐
     │              └───────────────┴──────────────┘        │ SENDING │
     │                                                      └─────────┘
     │                                                           │
     │   ┌───────────┐                                          v
     └──>│ CANCELLED │<─────────────────────────────────   ┌─────────┐
         └───────────┘                                     │  SENT   │
                ^                                          └─────────┘
                │
         ┌──────────┐
         │  PAUSED  │<── (From SCHEDULED only)
         └──────────┘
```

### 6.2 State Transitions

| From | To | Trigger | Validation |
|------|-----|---------|------------|
| DRAFT | TARGETING | User opens targeting step | None |
| TARGETING | COMPOSING | User completes targeting | ≥1 client matches |
| COMPOSING | REVIEW | User completes message(s) | ≥1 channel has content |
| REVIEW | SCHEDULED | User approves with schedule | Merge fields validated, schedule in future |
| REVIEW | SENDING | User approves for immediate send | Merge fields validated |
| SCHEDULED | SENDING | Scheduled time reached | Automatic by cron |
| SCHEDULED | PAUSED | User pauses campaign | Manual action |
| PAUSED | SCHEDULED | User resumes campaign | New schedule time set |
| SENDING | SENT | All recipients processed | Automatic |
| Any (except SENT) | CANCELLED | User cancels | Manual action with reason |

### 6.3 State Persistence
Each step auto-saves as user progresses:
- Targeting criteria saved on each filter change
- Messages saved on blur/debounce
- Progress tracked via `campaigns.status`

### 6.4 Concurrency Handling
- Lock campaign for editing when one user is working
- Show "User X is editing" warning to others
- Use optimistic locking with `updatedAt` timestamp

---

## 7. Pages Component System

### 7.1 Component Library

#### Core Components

| Component | Content Schema | Use Case |
|-----------|---------------|----------|
| `text_block` | `{ html: string }` | Rich text paragraphs |
| `heading` | `{ level: 1-6, text: string }` | Section titles |
| `image` | `{ src: string, alt: string, caption?: string }` | Illustrations |
| `table` | `{ headers: string[], rows: any[][] }` | Data display |
| `button` | `{ label: string, actionId: string, style: 'primary' \| 'secondary' }` | CTAs |
| `form` | `{ fields: FormField[], submitActionId: string }` | Data collection (rare) |

#### Advanced Components

| Component | Content Schema | Use Case |
|-----------|---------------|----------|
| `callout` | `{ type: 'info' \| 'warning' \| 'success', title?: string, body: string }` | Attention blocks |
| `status_widget` | `{ entityType: 'project' \| 'task', displayFields: string[] }` | Live status display |
| `timeline` | `{ steps: { title: string, description: string, status: 'complete' \| 'current' \| 'pending' }[] }` | Process visualization |
| `faq_accordion` | `{ items: { question: string, answer: string }[] }` | FAQ sections |
| `comparison_table` | `{ plans: { name: string, features: { name: string, value: string \| boolean }[] }[] }` | Service comparison |
| `video_embed` | `{ provider: 'youtube' \| 'vimeo' \| 'loom', videoId: string }` | Embedded videos |
| `document_list` | `{ documents: { name: string, url: string, type: string }[] }` | Download links |

### 7.2 Layout System

```
Page
├── Section 1 (full width container)
│   ├── Row 1
│   │   ├── Column 1 (span 2) - Heading
│   │   └── Column 3 (span 2) - Image
│   └── Row 2
│       └── Column 1 (span 4) - Text Block
├── Section 2
│   ├── Row 1
│   │   ├── Column 1 (span 2) - Button
│   │   └── Column 3 (span 2) - Button
│   ...
```

Layout rules:
- Max 4 columns per row
- Components can span 1-4 columns
- Responsive: 4-col → 2-col → 1-col on smaller screens
- No free-form drag (position is grid-based)

### 7.3 Smart Actions Specification

#### Action: "I'm Interested"
```typescript
{
  actionType: 'interested',
  label: 'Yes, I\'m interested',
  config: {
    createTask: {
      title: 'Follow up: {{client.name}} interested in {{campaign.name}}',
      assignToManager: true,
      dueInDays: 2
    },
    notifyStaff: ['manager'],
    logCommunication: true
  }
}
```

#### Action: "I've Uploaded Documents"
```typescript
{
  actionType: 'documents_uploaded',
  label: 'I\'ve uploaded my documents',
  config: {
    changeProjectStage: {
      projectTypeId: 'annual_accounts',
      newStageId: 'awaiting_review'
    },
    notifyStaff: ['assigned'],
    logCommunication: true
  }
}
```

#### Action: "Book a Call"
```typescript
{
  actionType: 'book_call',
  label: 'Book a call',
  config: {
    type: 'redirect' | 'embedded',
    calendarUrl: 'https://calendly.com/...', // or internal booking
    prefillFields: {
      name: '{{person.fullName}}',
      email: '{{person.email}}'
    }
  }
}
```

### 7.4 Personalisation

Pages support merge fields throughout:
- Heading: "Hello {{person.firstName}}"
- Status widget: Shows recipient's actual project status
- Buttons: "Confirm details for {{client.name}}"

Page rendering flow:
1. Recipient clicks unique tracking URL
2. System identifies recipient from token
3. Loads page definition + recipient context
4. Replaces all merge fields
5. Renders personalised page
6. Tracks view in `pageVisits`

### 7.5 Page Security

- Each recipient gets unique tracking token in URL
- Token maps to `campaignRecipients.id`
- Pages do not require login (token = auth)
- Tokens can be set to expire
- Sensitive actions can require additional verification (email OTP)

---

## 8. Analytics Model

### 8.1 What Gets Measured

#### Campaign-Level Metrics
| Metric | Source | Calculation |
|--------|--------|-------------|
| Sent | `campaignRecipients` | COUNT WHERE status = 'sent' |
| Delivered | `campaignRecipients` | COUNT WHERE status = 'delivered' |
| Bounced | `campaignRecipients` | COUNT WHERE status = 'bounced' |
| Open Rate | `campaignEngagement` | (COUNT eventType='opened' / Delivered) × 100 |
| Click Rate | `campaignEngagement` | (COUNT eventType='clicked' / Delivered) × 100 |
| Page View Rate | `pageVisits` | (DISTINCT recipients who viewed / Delivered) × 100 |
| Action Rate | `pageVisits` | (DISTINCT recipients with actionsCompleted / Delivered) × 100 |
| Ignored | Calculated | Delivered - (Opened OR Clicked OR Viewed) |

#### Page-Level Metrics
| Metric | Source | Calculation |
|--------|--------|-------------|
| Total Views | `pageVisits` | SUM(viewCount) |
| Unique Visitors | `pageVisits` | COUNT(DISTINCT recipientId) |
| Button Clicks | `campaignEngagement` WHERE eventType='action_clicked' | COUNT per button |
| Actions Completed | `pageVisits.actionsCompleted` | COUNT per action type |
| Avg Time on Page | Future enhancement | Calculated from view timestamps |

### 8.2 Where It's Stored

```
Analytics Data Storage:

1. Raw Events → campaignEngagement table
   - Every open, click, view, action is a row
   - Enables drill-down and replay

2. Aggregated Metrics → campaigns table (denormalized)
   - sentCount, deliveredCount, openedCount, clickedCount, actionCount
   - Updated via triggers or batch job
   - Used for dashboard performance

3. Client Timeline → communications table
   - Each campaign send creates a communication entry
   - Type: 'campaign_email' | 'campaign_sms' | 'campaign_voice'
   - Links to campaign and engagement data
```

### 8.3 Analytics Breakdowns

Staff can view campaign performance broken down by:

1. **By Client Manager**
   - Which manager's clients engage most?
   - Useful for coaching

2. **By Service**
   - Which service upsells work best?
   - Informs future campaigns

3. **By Campaign Type**
   - Chase vs Informational vs Upsell
   - Compare effectiveness

### 8.4 Revenue Attribution (Future)

For upsell campaigns, optional tracking of:
- Service signups within 30 days of campaign
- Monthly recurring revenue influenced
- Requires manual or automated attribution linking

### 8.5 Dashboard Views

1. **Campaign List View**
   - All campaigns with status, sent date, key metrics
   - Sortable by any metric
   - Quick filters: My Campaigns, By Type, By Status

2. **Campaign Detail View**
   - Full metrics breakdown
   - Recipient list with individual engagement
   - Page analytics (if attached)

3. **Aggregate Analytics View** (Super Admin)
   - Firm-wide campaign performance
   - Trending over time
   - Manager leaderboard

---

## 9. Integration Points

### 9.1 Email Delivery (SendGrid)
```typescript
// Use existing SendGrid integration
// Reference: server/notification-sender.ts

interface CampaignEmailPayload {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  trackingEnabled: true;
  customArgs: {
    campaignId: string;
    recipientId: string;
  };
  attachments?: Attachment[];
}

// Webhook endpoint for delivery events
POST /api/webhooks/sendgrid/campaign-events
// Events: delivered, opened, clicked, bounced, spam_report
```

### 9.2 SMS Delivery (VoodooSMS)
```typescript
// Use existing VoodooSMS integration
// Reference: server/notification-sender.ts

interface CampaignSMSPayload {
  to: string;  // E.164 format
  message: string;  // Max 160 chars or multi-part
  customReference: string;  // recipientId for tracking
}

// Webhook for delivery receipts
POST /api/webhooks/voodoo/campaign-events
```

### 9.3 AI Voice (Dialora.ai)
```typescript
// Webhook-driven integration
// Reference: External AI voice service

interface CampaignVoicePayload {
  phoneNumber: string;
  script: string;  // With merge fields already replaced
  callbackUrl: string;
  variables: {
    recipientName: string;
    clientName: string;
    // ... other context
  };
}

// Webhook for call outcomes
POST /api/webhooks/dialora/campaign-events
// Events: answered, voicemail, no_answer, failed
```

### 9.4 Client Timeline Integration
Every campaign interaction logs to `communications` table:

```typescript
// On campaign send to recipient
INSERT INTO communications {
  clientId: recipient.clientId,
  personId: recipient.personId,
  userId: campaign.createdByUserId,
  type: 'campaign_email' | 'campaign_sms' | 'campaign_voice',
  subject: message.subject,
  content: renderedContent,
  metadata: {
    campaignId: campaign.id,
    recipientId: recipient.id,
    channel: recipient.channel
  },
  actualContactTime: NOW()
}
```

### 9.5 Task Creation Integration
When page actions trigger tasks:

```typescript
// Uses existing task system
// Reference: server/storage/tasks/internalTaskStorage.ts

interface CampaignTaskCreation {
  title: string;  // With merge fields replaced
  description: string;
  assignedToUserId: string;  // Based on action config
  dueDate: Date;
  linkedClientId: string;
  linkedCampaignId: string;
  linkedPageActionId: string;
  source: 'campaign_action';
}
```

---

## 10. UI/UX Flow Specifications

### 10.0 Design Philosophy

**Design Inspiration:** The campaign creation experience draws from best-in-class tools:
- **Mailchimp:** Progressive disclosure, friendly empty states, clear progress tracking
- **HubSpot:** Dual-panel targeting, real-time previews, contextual help
- **Customer.io:** Trigger-based workflows, visual flow builders
- **Linear:** Keyboard shortcuts, minimal chrome, focus on content

**Core Principles:**
1. **Progressive Disclosure** - Show only what's needed at each step
2. **Real-Time Feedback** - Live counts, instant previews, validation as you type
3. **Undo Safety** - Autosave everything, allow reverting changes
4. **Contextual Help** - Inline guidance without blocking workflow
5. **Mobile-First** - Full functionality on tablet, read-only on phone
6. **Accessibility** - Full keyboard navigation, screen reader support

---

### 10.1 Campaign Creation Wizard - Master Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Campaigns          Create New Campaign          [Save Draft] [Exit]  │
├───────────────────────┬─────────────────────────────────────────────────────────┤
│                       │                                                         │
│  PROGRESS SIDEBAR     │                  MAIN CONTENT AREA                      │
│  ─────────────────    │                                                         │
│                       │  ┌───────────────────────────────────────────────────┐  │
│  ✓ 1. Overview        │  │                                                   │  │
│  ● 2. Targeting       │  │              Step-Specific Content                │  │
│    3. Recipients      │  │                                                   │  │
│    4. Messages        │  │              (Varies by step)                     │  │
│    5. Page            │  │                                                   │  │
│    6. Testing         │  │                                                   │  │
│    7. Launch          │  │                                                   │  │
│                       │  │                                                   │  │
│  ─────────────────    │  │                                                   │  │
│  Campaign Status:     │  │                                                   │  │
│  Draft                │  │                                                   │  │
│                       │  │                                                   │  │
│  Last saved:          │  └───────────────────────────────────────────────────┘  │
│  2 min ago            │                                                         │
│                       │               [← Back]        [Continue →]              │
│  ─────────────────    │                                                         │
│  💡 Quick Tips        │                                                         │
│  (Contextual help)    │                                                         │
│                       │                                                         │
└───────────────────────┴─────────────────────────────────────────────────────────┘
```

**Layout Specifications:**
- Sidebar: 280px fixed width, collapses to icons on tablet
- Main area: Fluid, max-width 900px, centered
- Consistent header across all steps with campaign name
- Persistent [Save Draft] visible at all times
- Step navigation via sidebar OR bottom buttons
- Steps can be revisited freely (non-linear after initial pass)

---

### 10.2 Step 1: Campaign Overview

**Purpose:** Set the foundation - name, type, and high-level intent.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  CAMPAIGN OVERVIEW                                                        │
│  ══════════════════                                                       │
│                                                                           │
│  Campaign Name *                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Year-End Tax Document Collection                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  A clear, descriptive name helps you find this campaign later.           │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  Campaign Type *                                                          │
│                                                                           │
│  ┌─────────────────────┐  ┌─────────────────────┐                       │
│  │ 🔔 CHASE           │  │ 📢 INFORMATIONAL    │                       │
│  │                     │  │                     │                       │
│  │ Follow up on        │  │ Share updates,      │                       │
│  │ missing items or    │  │ news, or changes    │                       │
│  │ overdue deadlines   │  │ with clients        │                       │
│  │                     │  │                     │                       │
│  │ [Selected ✓]        │  │                     │                       │
│  └─────────────────────┘  └─────────────────────┘                       │
│                                                                           │
│  ┌─────────────────────┐  ┌─────────────────────┐                       │
│  │ 💰 UPSELL          │  │ 🔄 ENGAGEMENT       │                       │
│  │                     │  │                     │                       │
│  │ Promote additional  │  │ Re-engage inactive  │                       │
│  │ services to clients │  │ clients             │                       │
│  │                     │  │                     │                       │
│  └─────────────────────┘  └─────────────────────┘                       │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  Description (Optional)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Remind clients with outstanding tax documents to submit them       │ │
│  │ before the year-end deadline. Focus on clients with...             │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  Internal notes for your team. Not visible to clients.                   │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  📄 Use Template (Optional)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Select a template...                                           ▼   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  Start from a proven template, or create from scratch.                   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Component Specifications:**

| Element | Component | Validation | Notes |
|---------|-----------|------------|-------|
| Campaign Name | `<Input>` | Required, 3-100 chars | Auto-focus on mount |
| Campaign Type | 4x `<RadioCard>` | Required | Visual cards with icons |
| Description | `<Textarea>` | Optional, max 500 chars | Collapsible on mobile |
| Template Picker | `<Select>` | Optional | Pre-fills all subsequent steps |

**Interactions:**
- Campaign name auto-saves on blur (debounced 300ms)
- Template selection shows confirmation modal before overwriting
- Type selection updates sidebar icon/color

---

### 10.3 Step 2: Targeting - Client Selection

**Purpose:** Define which clients should receive this campaign using powerful filters.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  WHO SHOULD RECEIVE THIS CAMPAIGN?                                        │
│  ═════════════════════════════════════                                    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  🎯 TARGET: 847 clients match your criteria                        │ │
│  │      ↑ Live count updates as you add filters                       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ╔═══════════════════════════════════════════════════════════════════════╗
│  ║  FILTER GROUP 1 (All conditions must match)                          ║
│  ╠═══════════════════════════════════════════════════════════════════════╣
│  ║                                                                       ║
│  ║  ┌─────────────────┐  ┌────────────┐  ┌─────────────────────────┐   ║
│  ║  │ Has Service   ▼ │  │ equals   ▼ │  │ Annual Accounts       ▼ │   ║
│  ║  └─────────────────┘  └────────────┘  └─────────────────────────┘   ║
│  ║                                                                  [×] ║
│  ║                                                                       ║
│  ║  AND                                                                  ║
│  ║                                                                       ║
│  ║  ┌─────────────────┐  ┌────────────┐  ┌─────────────────────────┐   ║
│  ║  │ Client Status ▼ │  │ equals   ▼ │  │ Active                ▼ │   ║
│  ║  └─────────────────┘  └────────────┘  └─────────────────────────┘   ║
│  ║                                                                  [×] ║
│  ║                                                                       ║
│  ║  AND                                                                  ║
│  ║                                                                       ║
│  ║  ┌─────────────────┐  ┌────────────┐  ┌─────────────────────────┐   ║
│  ║  │ Missing UTR   ▼ │  │ is       ▼ │  │ True                  ▼ │   ║
│  ║  └─────────────────┘  └────────────┘  └─────────────────────────┘   ║
│  ║                                                                  [×] ║
│  ║                                                                       ║
│  ║  [+ Add Filter to Group 1]                                           ║
│  ║                                                                       ║
│  ╚═══════════════════════════════════════════════════════════════════════╝
│                                                                           │
│                              OR (Any group matches)                       │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐
│  │  [+ Add Filter Group]                                                 │
│  │  Groups are combined with OR - clients matching ANY group included    │
│  └───────────────────────────────────────────────────────────────────────┘
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  📋 PREVIEW MATCHED CLIENTS                              [Refresh List]  │
│                                                                           │
│  ┌─────────┬────────────────────────────┬──────────────┬───────────────┐ │
│  │ Client  │ Client Name                │ Manager      │ Services      │ │
│  ├─────────┼────────────────────────────┼──────────────┼───────────────┤ │
│  │ C00142  │ ABC Trading Ltd            │ Sarah Jones  │ Accounts, VAT │ │
│  │ C00156  │ Smith & Co                 │ John Smith   │ Accounts      │ │
│  │ C00189  │ Tech Startup Inc           │ Sarah Jones  │ Accounts, Pay │ │
│  │ ...     │                            │              │               │ │
│  └─────────┴────────────────────────────┴──────────────┴───────────────┘ │
│                                                                           │
│  Showing 1-10 of 847 clients                    [← Prev] [1] [2] [Next →]│
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Filter Categories & Types:**

```
FILTER PICKER (Categorized Dropdown)
────────────────────────────────────

📋 CLIENT BASICS
├── Client Type (Company / Individual)
├── Client Status (Active / Prospect / Former / Dormant)
├── Client Manager
├── Monthly Fee Range
└── Client Onboarded Date

📦 SERVICES
├── Has Service
├── Does NOT Have Service
└── Service Start Date

📁 PROJECTS & COMPLIANCE
├── Has Active Project Type
├── Project at Stage
├── Has Overdue Projects
├── Accounts Due Within
├── Confirmation Statement Due Within
└── VAT Return Due Within

⚠️ DATA COMPLETENESS
├── Missing UTR
├── Missing Companies House Auth Code
├── Missing Company Telephone
├── Outstanding Document Requests
└── AML Not Complete

📊 ENGAGEMENT HISTORY
├── Opened Last Campaign
├── Clicked Campaign Link
├── Took Action on Page
├── Ignored Last X Campaigns
├── No Contact in X Days
└── Portal Login Within X Days
```

**Component Specifications:**

| Element | Component | Notes |
|---------|-----------|-------|
| Live Count | `<Badge variant="info">` | Debounced update (300ms), shows spinner during query |
| Filter Group | `<Card>` with header | Collapsible, deletable |
| Filter Row | `<FilterBuilder>` | 3-part: Type → Operator → Value |
| Filter Type | `<Select>` with categories | Grouped options with icons |
| Operator | `<Select>` | Dynamic based on filter type |
| Value Input | Type-specific | Select, Multi-select, Date range, Number range |
| Preview Table | `<DataTable>` | Paginated, sortable, row click → client detail |

**Interactions:**
- Filters saved on each change (optimistic)
- Live count updates with 300ms debounce
- Undo available for filter deletions
- Filter groups can be collapsed
- Empty state shows suggested filter combinations

---

### 10.4 Step 3: Recipients - Contact Resolution

**Purpose:** Determine which people at each client should be contacted, on which channels.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  WHO SHOULD WE CONTACT AT EACH CLIENT?                                    │
│  ═════════════════════════════════════                                     │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  👥 RECIPIENTS: 1,024 people from 847 clients                      │ │
│  │      (after applying contact rules and deduplication)              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  CONTACT SELECTION                                                        │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ○ Primary Contact Only                                              │ │
│  │   Send to the main contact at each client                          │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ ● All Contacts                                                      │ │
│  │   Send to every person linked to matching clients                   │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ ○ Role-Based Selection                                              │ │
│  │   Select contacts by their role:                                    │ │
│  │   ☐ Directors  ☐ Finance Contacts  ☐ Payroll Contacts              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  COMMUNICATION CHANNELS                                                   │
│                                                                           │
│  ☑ 📧 Email                   ☑ 💬 SMS                ☐ 📞 Voice       │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Channel Availability:                                               │ │
│  │ • 1,018 have valid email addresses                                  │ │
│  │ • 892 have mobile numbers (SMS)                                     │ │
│  │ • 6 contacts have opted out of email                                │ │
│  │ • 12 contacts have opted out of SMS                                 │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  ⚠️ DUPLICATE & RECENT CAMPAIGN WARNINGS                                 │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ⚠ 23 recipients received a chase campaign in the last 7 days       │ │
│  │   [View Details] [Exclude These]                                    │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ ⚠ 5 recipients appear in multiple matched clients                   │ │
│  │   (Will only receive one message - deduplicated)                    │ │
│  │   [View Details]                                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  📋 RECIPIENT LIST                        [Resolve Recipients] [Export]  │
│                                                                           │
│  ┌──────────┬────────────────┬──────────────┬────────┬────────┬────────┐ │
│  │ Status   │ Name           │ Client       │ Email  │ SMS    │ Reason │ │
│  ├──────────┼────────────────┼──────────────┼────────┼────────┼────────┤ │
│  │ ✓ Ready  │ John Smith     │ ABC Trading  │ ✓      │ ✓      │ Primary│ │
│  │ ✓ Ready  │ Jane Doe       │ Smith & Co   │ ✓      │ —      │ Primary│ │
│  │ ⚠ Recent │ Bob Wilson     │ Tech Inc     │ ✓      │ ✓      │ Director│
│  │ ✕ OptOut │ Sarah Brown    │ XYZ Ltd      │ —      │ —      │ OptOut │ │
│  └──────────┴────────────────┴──────────────┴────────┴────────┴────────┘ │
│                                                                           │
│  [+ Manually Add Recipient]               Showing 1-20 of 1,024          │
│                                                                           │
│  Selected: 3 recipients   [Remove Selected]   [Restore Removed]          │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Component Specifications:**

| Element | Component | Notes |
|---------|-----------|-------|
| Recipient Count | `<Badge>` with breakdown | Shows by channel |
| Contact Strategy | `<RadioGroup>` | With role checkboxes for role-based |
| Channel Selection | `<CheckboxGroup>` | Shows availability counts |
| Warning Cards | `<Alert>` | Collapsible with action buttons |
| Recipient Table | `<DataTable>` | Sortable, filterable, selectable rows |
| Manual Add | `<Dialog>` | Search existing people or add new |

**Status Indicators:**
- ✓ Ready (green) - Will receive campaign
- ⚠ Recent (amber) - Received similar campaign recently
- ⚠ Duplicate (amber) - Appears multiple times, deduplicated
- ✕ OptOut (red) - Has opted out of this channel/category
- — Missing (gray) - Missing contact info for channel

---

### 10.5 Step 4: Message Composer (Multi-Channel)

**Purpose:** Create compelling, personalized messages for each channel.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  COMPOSE YOUR MESSAGE                                                     │
│  ════════════════════                                                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  📧 Email    │    💬 SMS    │    📞 Voice Script                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ═══════════════════════════════════════════════════════════════════════ │
│  │                         EMAIL COMPOSER                               │ │
│  ═══════════════════════════════════════════════════════════════════════ │
│                                                                           │
│  Subject Line *                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ {{client.name}} - Your tax documents are needed          [Merge ▼] │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  52 characters • Aim for under 60 for best visibility                   │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  Message Body *                                           [Merge Fields ▼]│
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │ │ B  I  U  │ H1 H2 │ • • │ 🔗 │ {{}} │ ✨ AI                    │ │ │
│  │ └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                     │ │
│  │  Dear {{person.firstName}},                                        │ │
│  │                                                                     │ │
│  │  As your accounts deadline ({{client.nextAccountsDue | date}})     │ │
│  │  approaches, we wanted to remind you that we still need the        │ │
│  │  following documents:                                              │ │
│  │                                                                     │ │
│  │  • Bank statements for the year                                    │ │
│  │  • Sales invoices                                                  │ │
│  │  • Purchase receipts                                               │ │
│  │                                                                     │ │
│  │  Please upload these to your portal or send them to us directly.   │ │
│  │                                                                     │ │
│  │  Kind regards,                                                     │ │
│  │  {{staff.manager.firstName}}                                       │ │
│  │  {{firm.name}}                                                     │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  ATTACHMENTS                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  📎 Tax_Checklist_2024.pdf (245 KB)                           [×]  │ │
│  │  [+ Add Attachment]                                                 │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  ┌──────────────────────────────────────┐  ┌────────────────────────────┐│
│  │ ✨ AI ASSISTANT                      │  │ 📱 LIVE PREVIEW            ││
│  │                                      │  │                            ││
│  │ [Make it Shorter]                    │  │ Preview as:                ││
│  │ [Make it Friendlier]                 │  │ ┌────────────────────────┐ ││
│  │ [Add Urgency]                        │  │ │ John Smith - ABC Ltd ▼ │ ││
│  │ [Translate to Plain English]         │  │ └────────────────────────┘ ││
│  │ [Check for Errors]                   │  │                            ││
│  │                                      │  │ ┌────────────────────────┐ ││
│  │ [Custom prompt...]                   │  │ │ ABC Trading Ltd - Your │ ││
│  │                                      │  │ │ tax documents are need │ ││
│  │                                      │  │ │ ed                     │ ││
│  │                                      │  │ │                        │ ││
│  │                                      │  │ │ Dear John,             │ ││
│  │                                      │  │ │                        │ ││
│  │                                      │  │ │ As your accounts dead  │ ││
│  │                                      │  │ │ line (31 March 2025)   │ ││
│  │                                      │  │ │ approaches...          │ ││
│  │                                      │  │ └────────────────────────┘ ││
│  └──────────────────────────────────────┘  │                            ││
│                                            │ [Send Test Email to Me]    ││
│                                            └────────────────────────────┘│
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Merge Field Picker (Dropdown):**

```
MERGE FIELD PICKER
──────────────────

🔍 Search merge fields...

👤 PERSON
├── {{person.firstName}}         First name
├── {{person.lastName}}          Last name
├── {{person.fullName}}          Full name
├── {{person.email}}             Email address
└── {{person.title}}             Title (Mr/Mrs/etc)

🏢 CLIENT
├── {{client.name}}              Company/client name
├── {{client.tradingAs}}         Trading as name
├── {{client.companyNumber}}     Companies House number
├── {{client.nextAccountsDue}}   Next accounts due date
├── {{client.monthlyFee}}        Monthly fee amount
└── {{client.manager.firstName}} Account manager name

📁 PROJECT (if project filter used)
├── {{project.name}}             Project name
├── {{project.dueDate}}          Due date
└── {{project.stage}}            Current stage

🏛️ FIRM
├── {{firm.name}}                Firm name
├── {{firm.phone}}               Phone number
├── {{firm.email}}               Email address
└── {{firm.address}}             Address

🔗 LINKS
├── {{links.portal}}             Client portal link
├── {{links.page}}               Campaign page link
├── {{links.unsubscribe}}        Preference centre link
└── {{links.viewOnline}}         View in browser link
```

**SMS Tab (Different Layout):**

```
┌───────────────────────────────────────────────────────────────────────────┐
│  💬 SMS MESSAGE                                                           │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Hi {{person.firstName}}, your accounts deadline is approaching.    │ │
│  │ Please upload your documents via the portal: {{links.portal}}      │ │
│  │ Reply STOP to opt out.                                              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ 142 / 160 characters                                    [1 SMS]  │   │
│  │ ████████████████████████████████████████████████░░░░░░░░░░░░░░░  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ⚠️ Messages over 160 characters will be sent as multiple SMS parts.    │
│                                                                           │
│  [✨ Make Shorter]  [Add Merge Field]  [Send Test SMS to Me]              │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

### 10.6 Step 5: Attach Page (Optional)

**Purpose:** Create or attach a personalized landing page for recipients to take action.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  CAMPAIGN PAGE (OPTIONAL)                                                 │
│  ════════════════════════                                                  │
│                                                                           │
│  A campaign page gives recipients a personalised place to take action,   │
│  like confirming details, uploading documents, or booking a call.        │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │  ○ Skip - No page for this campaign                                │ │
│  │    Recipients will just receive the message                        │ │
│  │                                                                     │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │                                                                     │ │
│  │  ● Create New Page                                                  │ │
│  │    Build a custom page for this campaign                           │ │
│  │                                                                     │ │
│  │    ┌───────────────────────────────────────────────────────────┐   │ │
│  │    │ Quick Start Templates:                                    │   │ │
│  │    │                                                           │   │ │
│  │    │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │   │ │
│  │    │ │ 📄 Document │  │ 📅 Book a   │  │ ✅ Confirm  │        │   │ │
│  │    │ │  Collection │  │    Call     │  │   Details   │        │   │ │
│  │    │ └─────────────┘  └─────────────┘  └─────────────┘        │   │ │
│  │    │                                                           │   │ │
│  │    │ ┌─────────────┐  ┌─────────────┐                         │   │ │
│  │    │ │ 🔔 Interested│  │ 📝 Blank   │                         │   │ │
│  │    │ │  / Not Int. │  │   Canvas    │                         │   │ │
│  │    │ └─────────────┘  └─────────────┘                         │   │ │
│  │    └───────────────────────────────────────────────────────────┘   │ │
│  │                                                                     │ │
│  │    [Open Page Builder →]                                            │ │
│  │                                                                     │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │                                                                     │ │
│  │  ○ Use Existing Page                                                │ │
│  │    Select from your existing pages                                  │ │
│  │                                                                     │ │
│  │    ┌───────────────────────────────────────────────────────────┐   │ │
│  │    │ Select a page...                                       ▼  │   │ │
│  │    └───────────────────────────────────────────────────────────┘   │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

### 10.7 Step 6: Testing & Quality Assurance

**Purpose:** Validate everything works before going live.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  TEST YOUR CAMPAIGN                                                       │
│  ══════════════════                                                        │
│                                                                           │
│  Before sending, make sure everything looks right.                        │
│                                                                           │
│  ═══════════════════════════════════════════════════════════════════════ │
│  DELIVERABILITY CHECKLIST                                                 │
│  ═══════════════════════════════════════════════════════════════════════ │
│                                                                           │
│  ✓ Email subject line is under 60 characters                             │
│  ✓ Email body contains required unsubscribe link                         │
│  ✓ All merge fields have values for all recipients                       │
│  ⚠ 12 recipients are missing {{client.nextAccountsDue}}                  │
│    [View Affected] [Use Fallback: "soon"]                                 │
│  ✓ SMS is under 160 characters                                           │
│  ✓ No broken links detected                                              │
│  ✓ Attachments are under 10MB total                                      │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  SEND TEST MESSAGES                                                       │
│                                                                           │
│  Preview as recipient:                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ John Smith - ABC Trading Ltd                                    ▼  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 📧 Send Test Email    │ 💬 Send Test SMS    │ 🌐 Preview Page      │ │
│  │ to: me@company.com    │ to: +447xxxxxxxxx  │ Open in new tab      │ │
│  │ [Send Test]           │ [Send Test]         │ [Preview Page]       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  PREVIEW ALL CHANNELS                                                     │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  📧 Email      │     💬 SMS        │     🌐 Page                    │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │                                                                     │ │
│  │  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  │  From: Growth Accountants <hello@growth.accountants>          │ │ │
│  │  │  To: john@abctrading.com                                      │ │ │
│  │  │  Subject: ABC Trading Ltd - Your tax documents are needed     │ │ │
│  │  │  ─────────────────────────────────────────────────────────────│ │ │
│  │  │                                                               │ │ │
│  │  │  Dear John,                                                   │ │ │
│  │  │                                                               │ │ │
│  │  │  As your accounts deadline (31 March 2025) approaches...     │ │ │
│  │  │                                                               │ │ │
│  │  └───────────────────────────────────────────────────────────────┘ │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  ☐ I have reviewed the content and am ready to proceed                   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

### 10.8 Step 7: Schedule & Launch

**Purpose:** Final confirmation and scheduling.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  SCHEDULE & LAUNCH                                                        │
│  ═════════════════                                                         │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         CAMPAIGN SUMMARY                            │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │                                                                     │ │
│  │  📌 Year-End Tax Document Collection                                │ │
│  │  Type: Chase Campaign                                               │ │
│  │                                                                     │ │
│  │  👥 Recipients: 1,024 people from 847 clients                      │ │
│  │                                                                     │ │
│  │  📧 Email: 1,018 recipients                                         │ │
│  │  💬 SMS: 892 recipients                                             │ │
│  │                                                                     │ │
│  │  📄 Attached Page: Tax Document Collection                         │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  WHEN SHOULD WE SEND?                                                     │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ● Send Now                                                          │ │
│  │   Campaign will begin sending immediately                           │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ ○ Schedule for Later                                                │ │
│  │                                                                     │ │
│  │   Date: ┌──────────────────┐  Time: ┌──────────────┐               │ │
│  │         │ 15 January 2025  │        │  09:00       │               │ │
│  │         └──────────────────┘        └──────────────┘               │ │
│  │                                                                     │ │
│  │   ℹ️ Times are in UK timezone (GMT/BST)                             │ │
│  │   Best send times: 9-10am or 2-3pm on weekdays                     │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  ⚠️ IMPORTANT                                                            │
│                                                                           │
│  Once launched, recipients will receive your campaign immediately        │
│  (or at the scheduled time). Make sure you've:                           │
│                                                                           │
│  ☑ Reviewed all message content                                          │
│  ☑ Tested with at least one preview                                      │
│  ☑ Verified recipient list is correct                                    │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │   [Cancel]        [Save as Draft]        [🚀 Launch Campaign]      │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Launch Confirmation Modal:**

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  🚀 CONFIRM CAMPAIGN LAUNCH                                              │
│                                                                           │
│  You are about to send:                                                   │
│                                                                           │
│  📧 1,018 emails                                                          │
│  💬 892 SMS messages                                                      │
│                                                                           │
│  To 1,024 recipients at 847 clients                                      │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  This action cannot be undone once sending begins.                        │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                                                                   │   │
│  │  Type "SEND" to confirm: ┌─────────────────────────────────────┐ │   │
│  │                          │                                     │ │   │
│  │                          └─────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│              [Cancel]                    [Launch Campaign]                │
│                                         (disabled until "SEND" typed)    │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

### 10.9 Mobile & Responsive Design

**Breakpoints:**
- Desktop: ≥1200px - Full sidebar + main content
- Tablet: 768px-1199px - Collapsed sidebar (icons), full main content
- Mobile: <768px - Bottom stepper, full-width content, stacked layouts

**Mobile Adaptations:**

```
MOBILE LAYOUT (< 768px)
───────────────────────

┌─────────────────────────┐
│  ← Create Campaign      │
│  Step 2 of 7            │
├─────────────────────────┤
│                         │
│  Targeting              │
│  ════════               │
│                         │
│  🎯 847 clients match   │
│                         │
│  ┌─────────────────────┐│
│  │ Filter Group 1      ││
│  │ ─────────────────── ││
│  │ Has Service:        ││
│  │ Annual Accounts     ││
│  │                     ││
│  │ Client Status:      ││
│  │ Active              ││
│  │                [−]  ││
│  └─────────────────────┘│
│                         │
│  [+ Add Filter]         │
│                         │
│  ─────────────────────  │
│                         │
│  Preview (10 of 847)    │
│  ┌─────────────────────┐│
│  │ ABC Trading Ltd     ││
│  │ Smith & Co          ││
│  │ Tech Startup Inc    ││
│  │ ...                 ││
│  └─────────────────────┘│
│                         │
├─────────────────────────┤
│ [← Back]    [Continue →]│
├─────────────────────────┤
│  ○ ○ ● ○ ○ ○ ○          │
│  (Step indicator dots)  │
└─────────────────────────┘
```

---

### 10.10 Error Handling & Edge Cases

**Empty States:**

| Scenario | Message | Action |
|----------|---------|--------|
| No filters added | "Add your first filter to start building your audience" | [+ Add Filter] button |
| No clients match | "No clients match your current filters" | Suggest adjusting filters |
| No recipients resolved | "No contacts found with valid email/phone" | Check client data |
| No message content | "Add a subject and body to continue" | Focus on field |

**Validation Errors:**

| Error | Display | Prevention |
|-------|---------|------------|
| Campaign name empty | Inline error below field | Disable Continue until filled |
| No filters (targeting) | Warning banner | Allow continue with confirmation |
| No recipients | Blocking error | Cannot proceed |
| Missing merge fields | Warning with list | Offer fallback values |
| SMS too long | Character counter turns red | Real-time feedback |

**Warning Modals:**

| Scenario | Modal Content | Actions |
|----------|---------------|---------|
| Template will overwrite | "Using this template will replace your current content" | [Cancel] [Use Template] |
| Large recipient count | "You're about to send to over 1,000 recipients" | [Review List] [Continue] |
| Recent campaign overlap | "23 recipients received a similar campaign recently" | [View Details] [Exclude] [Continue Anyway] |

---

### 10.11 Accessibility Requirements

**Keyboard Navigation:**
- Tab through all interactive elements
- Enter/Space to activate buttons
- Arrow keys to navigate filter groups
- Escape to close modals
- Keyboard shortcut hints (Ctrl+S to save, Ctrl+Enter to continue)

**Screen Reader Support:**
- All form fields have associated labels
- Error messages announced on validation
- Progress through wizard announced ("Step 2 of 7: Targeting")
- Live regions for dynamic counts ("847 clients match your criteria")

**Visual Accessibility:**
- Minimum contrast ratio 4.5:1 for text
- Focus indicators visible on all interactive elements
- Color not sole indicator of status (icons + color)
- Animations respect prefers-reduced-motion

---

### 10.12 Performance Considerations

**Optimistic Updates:**
- Filter changes update locally immediately
- Save indicator shows "Saving..." then "Saved"
- Recipient count queries debounced 300ms

**Data Loading:**
- Lazy load recipient list (paginated)
- Preview table virtualized for large lists
- Message preview renders on-demand

**Caching:**
- Merge field definitions cached
- Filter options cached
- Template list cached

### 10.2 Page Builder Interface

```
┌─────────────────────────────────────────────────────────────┐
│  Page: Xmas Office Hours                          [Preview] │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Components  │            Page Canvas                       │
│  ───────────│                                              │
│  [+ Text]    │  ┌────────────────────────────────────────┐ │
│  [+ Heading] │  │   Section 1                            │ │
│  [+ Image]   │  │   ┌──────────────────────────────────┐ │ │
│  [+ Button]  │  │   │  Heading: Our Christmas Hours   │ │ │
│  [+ Callout] │  │   └──────────────────────────────────┘ │ │
│  [+ Table]   │  │   ┌──────────────────────────────────┐ │ │
│  [+ FAQ]     │  │   │  Text: We'll be closed from...  │ │ │
│  [+ Status]  │  │   └──────────────────────────────────┘ │ │
│  [+ Timeline]│  └────────────────────────────────────────┘ │
│              │                                              │
│              │  ┌────────────────────────────────────────┐ │
│              │  │   Section 2                            │ │
│              │  │   ┌─────────┐ ┌─────────────────────┐ │ │
│              │  │   │ Button  │ │ Button: I've seen  │ │ │
│              │  │   │Contact Us│ │ this - mark read   │ │ │
│              │  │   └─────────┘ └─────────────────────┘ │ │
│              │  └────────────────────────────────────────┘ │
│              │                                              │
│              │                          [+ Add Section]     │
└──────────────┴──────────────────────────────────────────────┘
```

### 10.3 Merge Field Picker

Inline picker when cursor is in text field:
- Trigger: Type `{{` or click merge field button
- Categories: Client, Person, Project, Service, Staff, Firm
- Search/filter merge fields
- Click to insert
- Preview shows actual value for sample recipient

### 10.4 Preview System

```
Preview Modal
├── Recipient selector dropdown
├── Channel tabs (Email / SMS / Voice / Page)
├── Rendered preview with actual data
├── Warning badges for missing data
└── [Send Test to Me] [Close]
```

---

## 11. Assumptions & Constraints

### 11.1 Assumptions

1. **SendGrid Webhooks Available**
   - Delivery, open, click events can be received
   - Custom args are passed through

2. **VoodooSMS Delivery Reports**
   - Webhook support for delivery confirmation
   - Message reference tracking

3. **Merge Field Library Exists**
   - Use existing `notification-variables.ts` patterns
   - Extend for campaign-specific variables

4. **Client Data Quality**
   - Targeting depends on accurate data
   - Missing data filters help identify gaps

5. **Staff Training**
   - Users understand client-first targeting
   - Preview before send is expected behaviour

### 11.2 Constraints

1. **No External Marketing Automation**
   - This is NOT Mailchimp/HubSpot replacement
   - Purpose is operational comms, not mass marketing

2. **Single Tenant**
   - No multi-firm support required
   - Company settings apply globally

3. **Existing Auth System**
   - Use Replit Auth for staff
   - Page access via tokens, not login

4. **Rate Limits**
   - SendGrid: 100 emails/second (standard)
   - VoodooSMS: Check limits
   - Dialora: Concurrent call limits

5. **No Real-Time Sync**
   - Analytics update on webhook receipt
   - Dashboard shows near-real-time, not live

### 11.3 Future Considerations

1. **Conditional Page Sections**
   - Show/hide components based on recipient data
   - Phase 2 enhancement

2. **A/B Testing**
   - Test different message variants
   - Requires significant additional work

3. **Recurring Campaigns**
   - Schedule campaign to run weekly/monthly
   - With dynamic recipient resolution

4. **WhatsApp Channel**
   - If business API access available
   - New integration required

---

## 12. Implementation Recommendations

### 12.1 Phase 1: Core Campaign Engine (Weeks 1-3)

1. **Data Model Implementation**
   - Create all tables in `shared/schema/campaigns/`
   - Add storage layer in `server/storage/campaigns/`
   - Create facade

2. **Targeting Engine**
   - Build filter query builder
   - Implement 10 most common filters
   - Live count preview

3. **Recipient Resolution**
   - Primary contact strategy first
   - Email channel only initially
   - Deduplication logic

4. **Basic Message Composition**
   - Email with TiptapEditor
   - Merge field insertion
   - Subject line

5. **SendGrid Integration**
   - Send emails via existing integration
   - Webhook handler for events
   - Basic delivery tracking

### 12.2 Phase 2: Complete Campaign Features (Weeks 4-5)

6. **Additional Targeting Filters**
   - Data completeness filters
   - Engagement history filters
   - All role-based recipient rules

7. **SMS Channel**
   - VoodooSMS integration for campaigns
   - Character count validation
   - Delivery tracking

8. **AI Assistance**
   - Rewrite/shorten helpers
   - Tone adjustment
   - Email → SMS conversion

9. **Preview System**
   - Preview as specific recipient
   - Multi-channel preview
   - Merge field warnings

### 12.3 Phase 3: Pages Module (Weeks 6-7)

10. **Page Builder**
    - Core components (text, heading, button, callout)
    - Grid layout system
    - Component editor modals

11. **Smart Actions**
    - Basic actions (interested, confirm)
    - Task creation integration
    - Staff notifications

12. **Page Personalisation**
    - Merge field rendering
    - Tracking token system
    - Visit logging

### 12.4 Phase 4: Analytics & Polish (Week 8)

13. **Analytics Dashboard**
    - Campaign list with metrics
    - Detail view with breakdowns
    - Client timeline integration

14. **Voice Channel**
    - Dialora.ai integration
    - Script composition
    - Outcome tracking

15. **Testing & Refinement**
    - End-to-end testing
    - Performance optimization
    - Staff training materials

### 12.5 Key Files to Create

```
shared/schema/campaigns/
├── tables.ts          # All campaign-related tables
├── types.ts           # TypeScript types
├── schemas.ts         # Zod schemas for validation
├── relations.ts       # Drizzle relations
└── index.ts           # Barrel export

server/storage/campaigns/
├── campaignStorage.ts
├── targetingStorage.ts
├── recipientStorage.ts
├── messageStorage.ts
├── analyticsStorage.ts
└── index.ts

server/storage/pages/
├── pageStorage.ts
├── componentStorage.ts
├── actionStorage.ts
└── index.ts

server/routes/
├── campaigns.ts       # Campaign API routes
└── pages.ts           # Page API routes

server/services/
├── campaignTargetingService.ts
├── campaignSendService.ts
├── pageRenderService.ts
└── campaignAnalyticsService.ts

client/src/pages/
├── campaigns/
│   ├── CampaignList.tsx
│   ├── CampaignWizard.tsx
│   └── CampaignDetail.tsx
└── pages/
    ├── PageBuilder.tsx
    └── PagePreview.tsx

client/src/components/campaigns/
├── TargetingBuilder.tsx
├── RecipientList.tsx
├── MessageComposer.tsx
├── MergeFieldPicker.tsx
├── CampaignPreview.tsx
└── CampaignAnalytics.tsx

client/src/components/pages/
├── ComponentPalette.tsx
├── PageCanvas.tsx
├── ComponentEditor.tsx
└── ActionConfig.tsx
```

---

## Appendix A: Merge Field Library

### Client Fields
| Field | Syntax | Example Output |
|-------|--------|----------------|
| Company/Client Name | `{{client.name}}` | Acme Ltd |
| Trading As | `{{client.tradingAs}}` | Acme Consulting |
| Company Number | `{{client.companyNumber}}` | 12345678 |
| Next Accounts Due | `{{client.nextAccountsDue \| date}}` | 31 January 2026 |
| Confirmation Statement Due | `{{client.confirmationStatementNextDue \| date}}` | 15 March 2026 |
| Client Manager | `{{client.manager.name}}` | John Smith |

### Person (Recipient) Fields
| Field | Syntax | Example Output |
|-------|--------|----------------|
| Full Name | `{{person.fullName}}` | Jane Doe |
| First Name | `{{person.firstName}}` | Jane |
| Title | `{{person.title}}` | Mrs |
| Role | `{{person.officerRole}}` | Director |
| Email | `{{person.email}}` | jane@acme.com |

### Campaign Fields
| Field | Syntax | Example Output |
|-------|--------|----------------|
| Campaign Name | `{{campaign.name}}` | Q4 Accounts Chase |
| Page Link | `{{campaign.pageUrl}}` | https://... |
| Unsubscribe Link | `{{campaign.unsubscribeUrl}}` | https://... |

### Firm Fields
| Field | Syntax | Example Output |
|-------|--------|----------------|
| Firm Name | `{{firm.name}}` | Growth Accountants |
| Firm Phone | `{{firm.phone}}` | 020 1234 5678 |
| Firm Email | `{{firm.email}}` | hello@growth.accountants |

### Fallback Syntax
```
{{client.tradingAs | fallback: client.name}}
{{person.firstName | fallback: "there"}}
{{client.nextAccountsDue | date | fallback: "your upcoming deadline"}}
```

---

## Appendix B: Filter Type Registry

```typescript
const FILTER_REGISTRY: FilterDefinition[] = [
  // Client Type & Status
  { type: 'client_type', label: 'Client Type', operators: ['equals'], valueType: 'select', options: ['company', 'individual'] },
  { type: 'client_status', label: 'Client Status', operators: ['equals', 'not_equals'], valueType: 'select', options: ['Active', 'Dormant', 'Ceased', 'Prospect'] },
  { type: 'client_manager', label: 'Client Manager', operators: ['equals', 'not_equals'], valueType: 'user_select' },
  { type: 'monthly_fee_range', label: 'Monthly Fee', operators: ['between', 'gt', 'lt'], valueType: 'number_range' },
  
  // Services
  { type: 'has_service', label: 'Has Service', operators: ['equals'], valueType: 'service_select' },
  { type: 'missing_service', label: 'Does Not Have Service', operators: ['equals'], valueType: 'service_select' },
  
  // Projects
  { type: 'has_project_type', label: 'Has Active Project Type', operators: ['equals'], valueType: 'project_type_select' },
  { type: 'project_at_stage', label: 'Project at Stage', operators: ['equals'], valueType: 'stage_select' },
  { type: 'accounts_due_range', label: 'Accounts Due Within', operators: ['between'], valueType: 'date_range' },
  { type: 'has_overdue_project', label: 'Has Overdue Project', operators: ['equals'], valueType: 'boolean' },
  
  // Data Completeness
  { type: 'missing_utr', label: 'Missing UTR', operators: ['equals'], valueType: 'boolean' },
  { type: 'missing_auth_code', label: 'Missing CH Auth Code', operators: ['equals'], valueType: 'boolean' },
  { type: 'docs_outstanding_days', label: 'Docs Outstanding', operators: ['gt'], valueType: 'number' },
  
  // Engagement
  { type: 'opened_last_campaign', label: 'Opened Last Campaign', operators: ['equals'], valueType: 'boolean' },
  { type: 'clicked_campaign', label: 'Clicked Campaign Link', operators: ['equals'], valueType: 'boolean' },
  { type: 'last_contact_days', label: 'Last Contact', operators: ['gt', 'lt'], valueType: 'number' },
  { type: 'portal_login_days', label: 'Portal Login Within', operators: ['lt', 'gt'], valueType: 'number' },
];
```

---

*End of Architecture Specification*
