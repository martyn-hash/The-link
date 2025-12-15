# Campaigns & Pages Communications Module - Implementation Specification

**Document Version:** 2.1  
**Last Updated:** December 2025  
**Status:** Phase 1 Complete - Foundation Implemented  
**Implementer:** Replit Agent

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Implementation Phases](#2-implementation-phases)
3. [Data Model - Complete Schema](#3-data-model---complete-schema)
4. [Phase 1: Foundation](#4-phase-1-foundation)
5. [Phase 2: Campaign Engine](#5-phase-2-campaign-engine)
6. [Phase 3: Pages Module](#6-phase-3-pages-module)
7. [Phase 4: Multi-Step Campaigns](#7-phase-4-multi-step-campaigns)
8. [Phase 5: Analytics & Polish](#8-phase-5-analytics--polish)
9. [Testing Strategy](#9-testing-strategy)
10. [Success Criteria](#10-success-criteria)
11. [File Structure Reference](#11-file-structure-reference)

---

## 1. Executive Summary

### Purpose
Build a complete Campaigns & Pages communications module enabling targeted, multi-channel outbound campaigns with optional personalised action pages.

### Key Features (Prioritised)
1. Client-first targeting engine with 16+ filter types
2. Multi-channel delivery: Email (SendGrid), SMS (VoodooSMS), Voice (Dialora.ai)
3. Campaign workflow: Draft → Review → Approved → Scheduled → Sending → Sent
4. Optional Campaign Pages with 14 component types and smart actions
5. Multi-step campaigns (sequences) with behaviour-based progression
6. Contact preferences for opt-out by category
7. Duplicate campaign protection with recipient history
8. Engagement scoring per client
9. Reusable campaign templates
10. Comprehensive analytics

### Design Principles
- Client-first targeting (filter clients, then resolve contacts)
- Everything logged to client timeline
- Mandatory preview before send
- Category-based opt-out (not just global)
- Retry logic for failed deliveries
- Permission-controlled access

---

## 2. Implementation Phases

### Phase 1: Foundation (Week 1) ✅ COMPLETE
- ✅ Database schema creation (14 tables)
- ✅ Storage layer scaffolding (12 modules)
- ✅ Contact preferences system with database-persisted tokens
- ✅ Campaign templates structure
- ✅ Basic API routes (campaigns, pages, contact-preferences)

### Phase 2: Campaign Engine (Weeks 2-3)
- Targeting engine with all filter types
- Recipient resolution with history display
- Message composition with merge fields
- Email delivery via SendGrid with retry logic
- SMS delivery via VoodooSMS with retry logic
- Campaign workflow state machine
- Mandatory preview system
- Duplicate protection warnings

### Phase 3: Pages Module (Weeks 4-5)
- Page builder with all 14 components
- Grid layout system
- Smart actions with OTP option
- Page personalisation and rendering
- Tracking token system
- Page analytics

### Phase 4: Multi-Step Campaigns (Week 6)
- Campaign sequences (steps)
- Behaviour-based progression (no open → next step)
- Step scheduling and execution
- Sequence analytics

### Phase 5: Analytics & Polish (Week 7) ✅ COMPLETE
- ✅ Engagement scoring calculation (engagementScoreService.ts)
- ✅ Campaign analytics service (campaignAnalyticsService.ts)
- ✅ Voice channel integration (Dialora.ai in campaignDeliveryService.ts)
- ✅ Analytics API endpoints (4 new routes)
- ✅ Weekly engagement cron job (engagement-cron.ts)

### Phase 6: Frontend - Campaign List & Dashboard (Week 8)
- Campaign list page with filtering and search
- Status-based tabs (Draft, Review, Approved, Scheduled, Sending, Sent)
- Campaign cards with quick stats (recipients, open rate, click rate)
- Campaign status badges and workflow indicators
- Bulk actions (pause, resume, delete)
- Dashboard overview with aggregate metrics
- Top performing campaigns widget
- Recent activity feed

### Phase 7: Frontend - Campaign Detail & Analytics (Week 9)
- Campaign detail view with full information
- Analytics dashboard with charts (opens, clicks, timeline)
- Recipient list with status and engagement data
- Manager breakdown visualisation
- Sequence step tracking for multi-step campaigns
- Export analytics to CSV
- Client engagement score display

### Phase 8: Frontend - Campaign Creation Wizard (Week 10)
- Multi-step campaign creation flow
- Targeting builder with filter picker
- Filter configuration UI for all 16+ filter types
- Real-time recipient count preview
- Message composer with merge field picker
- Channel selection (Email/SMS/Voice)
- Page attachment and page builder integration
- Sequence builder for multi-step campaigns
- Preview confirmation step
- Workflow submission

### Phase 9: Comprehensive Browser Testing (Week 11)
Detailed end-to-end testing of all implemented features using Playwright.

#### 9.1 Campaign Management Testing
- **List View Tests**
  - Verify campaign list loads with correct data
  - Test status filtering (draft, review, approved, etc.)
  - Test category filtering (chase, informational, upsell, engagement)
  - Verify pagination works correctly
  - Test search functionality
  - Verify campaign cards display correct metrics

- **Detail View Tests**
  - Verify campaign details load correctly
  - Test analytics charts render with data
  - Verify recipient list displays with correct statuses
  - Test manager breakdown data accuracy
  - Verify sequence steps display for multi-step campaigns

#### 9.2 Campaign Creation Testing
- **Targeting Tests**
  - Test each of 16+ filter types individually
  - Verify filter combinations (AND/OR groups)
  - Test real-time recipient count updates
  - Verify duplicate warnings display correctly
  - Test filter removal and modification

- **Message Composition Tests**
  - Test merge field insertion
  - Verify merge field preview renders correctly
  - Test character count for SMS (160 limit)
  - Verify HTML email content saves correctly
  - Test voice script entry

- **Workflow Tests**
  - Test draft → review transition
  - Test review → approved transition
  - Verify preview confirmation is mandatory
  - Test scheduled campaign scheduling
  - Test pause and resume functionality

#### 9.3 Page Builder Testing
- **Component Tests**
  - Test drag-and-drop for all 14 component types
  - Verify component reordering works
  - Test component deletion
  - Test each component editor saves content correctly
  - Verify component preview matches saved content

- **Action Tests**
  - Test each of 9 action types
  - Verify OTP requirement toggle works
  - Test success message configuration
  - Verify task creation options

- **Page Settings Tests**
  - Test slug generation and customisation
  - Verify header title and subtitle save correctly
  - Test theme color picker
  - Verify publish/unpublish functionality

#### 9.4 Public Page Viewing Testing
- **Page Rendering Tests**
  - Verify page loads with visit token
  - Test each component type renders correctly
  - Verify merge field substitution works
  - Test page theme colors apply correctly
  - Verify expired pages show appropriate message

- **OTP Verification Tests**
  - Test OTP request sends email
  - Verify OTP code validation (correct/incorrect)
  - Test OTP expiry (10-minute limit)
  - Verify OTP bypass for actions not requiring it

- **Action Execution Tests**
  - Test each action type executes correctly
  - Verify success message displays
  - Test form submission actions
  - Verify action logging to client timeline

#### 9.5 Webhook & Delivery Testing
- **SendGrid Integration Tests**
  - Verify email delivery status updates via webhook
  - Test open tracking pixel works
  - Verify click tracking updates recipient records
  - Test bounce handling

- **VoodooSMS Integration Tests**
  - Verify SMS delivery status updates
  - Test click tracking for SMS links

- **Dialora Voice Integration Tests**
  - Verify voice call initiation
  - Test call status webhook handling
  - Verify call outcome recording

#### 9.6 Analytics & Engagement Testing
- **Analytics API Tests**
  - Verify campaign analytics endpoint returns correct metrics
  - Test sequence analytics for multi-step campaigns
  - Verify overview stats aggregate correctly
  - Test client engagement score retrieval

- **Engagement Score Tests**
  - Verify scores update on email open
  - Test score updates on click
  - Verify page view updates scores
  - Test action completion score bonus
  - Verify ignored campaign penalty

#### 9.7 Contact Preferences Testing
- **Opt-Out Tests**
  - Verify preference centre loads via token
  - Test category-based opt-out
  - Verify opt-out persists across channels
  - Test opt-out respected in targeting

- **Preference Centre UI Tests**
  - Verify preference form displays correctly
  - Test preference toggle saves correctly
  - Verify confirmation message displays

---

## 3. Data Model - Complete Schema

### 3.1 Contact Preferences Table

```sql
-- Category-based opt-out per person
contactPreferences
├── id: varchar (PK, UUID)
├── personId: varchar (FK → people.id, CASCADE)
├── channel: channelEnum ('email' | 'sms' | 'voice')
├── category: campaignCategoryEnum ('chase' | 'informational' | 'upsell' | 'engagement' | 'all')
├── optedOut: boolean (default false)
├── optedOutAt: timestamp
├── optedOutReason: text
├── optedOutVia: varchar ('campaign_link' | 'preference_centre' | 'manual')
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [personId, channel, category]
└── unique: [personId, channel, category]
```

### 3.2 Campaign Templates Table

```sql
campaignTemplates
├── id: varchar (PK, UUID)
├── name: varchar (required)
├── description: text
├── category: campaignCategoryEnum
├── targetCriteriaTemplate: jsonb (saved filter configuration)
├── recipientRules: jsonb (contact selection config)
├── channels: jsonb (which channels enabled)
├── emailSubject: varchar
├── emailBody: text
├── smsContent: varchar(160)
├── voiceScript: text
├── pageTemplateId: varchar (FK → pageTemplates.id, nullable)
├── isActive: boolean (default true)
├── createdByUserId: varchar (FK → users.id)
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [category, isActive, createdByUserId]
```

### 3.3 Core Campaign Tables

```sql
campaigns
├── id: varchar (PK, UUID)
├── name: varchar (required)
├── description: text
├── category: campaignCategoryEnum ('chase' | 'informational' | 'upsell' | 'engagement')
├── status: campaignStatusEnum ('draft' | 'review' | 'approved' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled')
├── templateId: varchar (FK → campaignTemplates.id, nullable)
├── createdByUserId: varchar (FK → users.id)
├── reviewedByUserId: varchar (FK → users.id, nullable)
├── reviewedAt: timestamp
├── approvedByUserId: varchar (FK → users.id, nullable)
├── approvedAt: timestamp
├── scheduledFor: timestamp (nullable)
├── sendingStartedAt: timestamp
├── sentAt: timestamp
├── targetCriteria: jsonb (full filter configuration)
├── recipientRules: jsonb (contact selection config)
├── targetCriteriaSnapshot: jsonb (frozen at approval)
├── recipientCountSnapshot: integer (frozen at approval)
├── pageId: varchar (FK → pages.id, nullable)
├── isSequence: boolean (default false)
├── parentCampaignId: varchar (FK → campaigns.id, nullable, for sequence steps)
├── sequenceOrder: integer (nullable, step number in sequence)
├── sequenceCondition: jsonb (nullable, behaviour trigger for this step)
├── previewConfirmedAt: timestamp (required before approval)
├── previewConfirmedByUserId: varchar (FK → users.id)
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [status, category, createdByUserId, scheduledFor, parentCampaignId]
```

```sql
campaignTargetCriteria
├── id: varchar (PK, UUID)
├── campaignId: varchar (FK → campaigns.id, CASCADE)
├── filterGroup: integer (for AND/OR grouping, groups joined by OR)
├── filterType: varchar (see filter registry)
├── operator: varchar ('equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'between' | 'is_null' | 'is_not_null' | 'in' | 'not_in')
├── value: jsonb (flexible for any value type)
├── sortOrder: integer (within group)
├── createdAt: timestamp
└── indexes: [campaignId]
```

```sql
campaignMessages
├── id: varchar (PK, UUID)
├── campaignId: varchar (FK → campaigns.id, CASCADE)
├── channel: channelEnum ('email' | 'sms' | 'voice')
├── subject: varchar (email only)
├── body: text (email/SMS content, HTML for email)
├── plainTextBody: text (plain text version for email)
├── voiceScript: text (voice only)
├── attachments: jsonb (array of {name, objectPath, mimeType, size})
├── mergeFieldsUsed: text[] (extracted list)
├── isActive: boolean (default true)
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [campaignId, channel]
```

```sql
campaignRecipients
├── id: varchar (PK, UUID)
├── campaignId: varchar (FK → campaigns.id, CASCADE)
├── clientId: varchar (FK → clients.id)
├── personId: varchar (FK → people.id)
├── channel: channelEnum
├── channelAddress: varchar (email or phone in E.164)
├── inclusionReason: text (why included)
├── lastCampaignReceivedAt: timestamp (for duplicate warning display)
├── lastCampaignCategory: varchar (what type they last received)
├── status: recipientStatusEnum ('pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'excluded' | 'opted_out')
├── manuallyAdded: boolean (default false)
├── manuallyRemoved: boolean (default false)
├── removedByUserId: varchar (FK → users.id, nullable)
├── removedReason: text
├── resolvedMergeData: jsonb (pre-resolved merge field values)
├── renderedContent: jsonb ({subject, body, smsContent, voiceScript} - rendered at queue time)
├── queuedAt: timestamp
├── sentAt: timestamp
├── deliveredAt: timestamp
├── openedAt: timestamp (first open)
├── openCount: integer (default 0)
├── clickedAt: timestamp (first click)
├── clickCount: integer (default 0)
├── failureReason: text
├── retryCount: integer (default 0)
├── lastRetryAt: timestamp
├── externalMessageId: varchar (SendGrid/Voodoo message ID)
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [campaignId, clientId, personId, channel, status, lastCampaignReceivedAt]
```

### 3.4 Engagement & Analytics Tables

```sql
campaignEngagement
├── id: varchar (PK, UUID)
├── campaignId: varchar (FK → campaigns.id, CASCADE)
├── recipientId: varchar (FK → campaignRecipients.id, CASCADE)
├── eventType: engagementEventEnum ('queued' | 'sent' | 'delivered' | 'bounced' | 'opened' | 'clicked' | 'page_viewed' | 'action_clicked' | 'action_completed' | 'unsubscribed' | 'spam_report' | 'failed')
├── channel: channelEnum
├── eventData: jsonb ({url, buttonId, actionId, error, etc.})
├── ipAddress: varchar
├── userAgent: text
├── timestamp: timestamp
└── indexes: [campaignId, recipientId, eventType, timestamp]
```

```sql
clientEngagementScores
├── id: varchar (PK, UUID)
├── clientId: varchar (FK → clients.id, CASCADE, UNIQUE)
├── totalScore: integer (default 0)
├── emailsReceived: integer (default 0)
├── emailsOpened: integer (default 0)
├── emailsClicked: integer (default 0)
├── smsReceived: integer (default 0)
├── smsClicked: integer (default 0)
├── pagesViewed: integer (default 0)
├── actionsCompleted: integer (default 0)
├── lastEngagementAt: timestamp
├── lastCampaignSentAt: timestamp
├── consecutiveIgnored: integer (default 0, reset on any engagement)
├── updatedAt: timestamp
└── indexes: [clientId, totalScore, lastEngagementAt]

-- Scoring rules (implemented in code):
-- Email opened: +1
-- Email clicked: +2
-- SMS clicked: +2
-- Page viewed: +2
-- Action completed: +5
-- Campaign ignored (sent but no engagement within 7 days): -1
```

### 3.5 Pages Tables

```sql
pages
├── id: varchar (PK, UUID)
├── name: varchar (internal name)
├── slug: varchar (URL slug)
├── campaignId: varchar (FK → campaigns.id, nullable)
├── templateId: varchar (FK → pageTemplates.id, nullable)
├── layoutType: varchar ('single_column' | 'two_column')
├── headerTitle: varchar
├── headerSubtitle: text
├── headerImagePath: varchar (object storage path)
├── themeColor: varchar (hex, default firm brand)
├── backgroundColor: varchar (hex)
├── isPublished: boolean (default false)
├── expiresAt: timestamp (optional)
├── requiresOtp: boolean (default false, for all actions)
├── createdByUserId: varchar (FK → users.id)
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [campaignId, slug, isPublished]
└── unique: [slug] (within active/published pages)
```

```sql
pageComponents
├── id: varchar (PK, UUID)
├── pageId: varchar (FK → pages.id, CASCADE)
├── componentType: pageComponentTypeEnum (14 types - see below)
├── sectionIndex: integer (which section, 0-based)
├── rowIndex: integer (row within section, 0-based)
├── columnIndex: integer (column 0-3)
├── columnSpan: integer (1-4, how many columns)
├── content: jsonb (component-specific, schemas below)
├── sortOrder: integer (for ordering within same position)
├── isVisible: boolean (default true)
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [pageId, sectionIndex, sortOrder]

-- Component Types:
-- 'text_block' | 'heading' | 'image' | 'table' | 'button' | 'form' |
-- 'callout' | 'status_widget' | 'timeline' | 'faq_accordion' |
-- 'comparison_table' | 'video_embed' | 'document_list' | 'spacer'
```

```sql
pageActions
├── id: varchar (PK, UUID)
├── pageId: varchar (FK → pages.id, CASCADE)
├── componentId: varchar (FK → pageComponents.id, nullable, for button actions)
├── actionType: pageActionTypeEnum (see below)
├── label: varchar (button text)
├── description: text (internal description)
├── config: jsonb (action-specific config)
├── requiresOtp: boolean (default false, overrides page setting)
├── successMessage: varchar (shown after action)
├── successRedirectUrl: varchar (optional redirect)
├── isEnabled: boolean (default true)
├── sortOrder: integer
├── createdAt: timestamp
└── indexes: [pageId, actionType]

-- Action Types:
-- 'interested' | 'not_interested' | 'documents_uploaded' | 'book_call' |
-- 'request_callback' | 'confirm_details' | 'request_extension' | 
-- 'custom_form' | 'custom_webhook'
```

```sql
pageVisits
├── id: varchar (PK, UUID)
├── pageId: varchar (FK → pages.id, CASCADE)
├── recipientId: varchar (FK → campaignRecipients.id, nullable)
├── clientId: varchar (FK → clients.id)
├── personId: varchar (FK → people.id)
├── visitToken: varchar (unique tracking token from URL)
├── otpVerifiedAt: timestamp (if OTP was required and passed)
├── ipAddress: varchar
├── userAgent: text
├── referrer: varchar
├── firstViewedAt: timestamp
├── lastViewedAt: timestamp
├── viewCount: integer (default 1)
├── createdAt: timestamp
└── indexes: [pageId, recipientId, visitToken, clientId]
```

```sql
pageActionLogs
├── id: varchar (PK, UUID)
├── pageId: varchar (FK → pages.id, CASCADE)
├── actionId: varchar (FK → pageActions.id, CASCADE)
├── visitId: varchar (FK → pageVisits.id, CASCADE)
├── recipientId: varchar (FK → campaignRecipients.id, nullable)
├── clientId: varchar (FK → clients.id)
├── personId: varchar (FK → people.id)
├── actionData: jsonb (form data if any)
├── resultData: jsonb (what was created/changed)
├── ipAddress: varchar
├── userAgent: text
├── timestamp: timestamp
└── indexes: [pageId, actionId, clientId, timestamp]
```

### 3.6 Page Templates

```sql
pageTemplates
├── id: varchar (PK, UUID)
├── name: varchar
├── description: text
├── category: varchar (matches campaign categories)
├── layoutType: varchar
├── headerTitle: varchar (template, can have merge fields)
├── headerSubtitle: text
├── themeColor: varchar
├── componentsTemplate: jsonb (array of component definitions)
├── actionsTemplate: jsonb (array of action definitions)
├── isActive: boolean (default true)
├── createdByUserId: varchar (FK → users.id)
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [category, isActive]
```

### 3.7 Delivery Retry Queue

```sql
campaignDeliveryQueue
├── id: varchar (PK, UUID)
├── recipientId: varchar (FK → campaignRecipients.id, CASCADE)
├── channel: channelEnum
├── priority: integer (default 5, 1=highest)
├── status: queueStatusEnum ('pending' | 'processing' | 'completed' | 'failed_permanent')
├── attemptCount: integer (default 0)
├── maxAttempts: integer (default 3)
├── nextAttemptAt: timestamp
├── lastAttemptAt: timestamp
├── lastError: text
├── createdAt: timestamp
├── updatedAt: timestamp
└── indexes: [status, nextAttemptAt, priority]
```

### 3.8 Enums Summary

```typescript
// shared/schema/campaigns/enums.ts

campaignCategoryEnum: 'chase' | 'informational' | 'upsell' | 'engagement'

campaignStatusEnum: 'draft' | 'review' | 'approved' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'

channelEnum: 'email' | 'sms' | 'voice'

recipientStatusEnum: 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'excluded' | 'opted_out'

engagementEventEnum: 'queued' | 'sent' | 'delivered' | 'bounced' | 'opened' | 'clicked' | 'page_viewed' | 'action_clicked' | 'action_completed' | 'unsubscribed' | 'spam_report' | 'failed'

pageComponentTypeEnum: 'text_block' | 'heading' | 'image' | 'table' | 'button' | 'form' | 'callout' | 'status_widget' | 'timeline' | 'faq_accordion' | 'comparison_table' | 'video_embed' | 'document_list' | 'spacer'

pageActionTypeEnum: 'interested' | 'not_interested' | 'documents_uploaded' | 'book_call' | 'request_callback' | 'confirm_details' | 'request_extension' | 'custom_form' | 'custom_webhook'

queueStatusEnum: 'pending' | 'processing' | 'completed' | 'failed_permanent'
```

---

## 4. Phase 1: Foundation

### 4.1 Tasks

1. **Create all database tables**
   - Add all tables from Section 3 to `shared/schema/campaigns/tables.ts`
   - Create relations in `shared/schema/campaigns/relations.ts`
   - Create Zod schemas in `shared/schema/campaigns/schemas.ts`
   - Export types in `shared/schema/campaigns/types.ts`
   - Run migration

2. **Create storage layer**
   ```
   server/storage/campaigns/
   ├── campaignStorage.ts          # Campaign CRUD
   ├── campaignTemplateStorage.ts  # Templates CRUD
   ├── campaignTargetStorage.ts    # Target criteria
   ├── campaignRecipientStorage.ts # Recipients
   ├── campaignMessageStorage.ts   # Messages per channel
   ├── campaignDeliveryStorage.ts  # Delivery queue
   ├── campaignAnalyticsStorage.ts # Engagement data
   └── index.ts
   
   server/storage/pages/
   ├── pageStorage.ts
   ├── pageComponentStorage.ts
   ├── pageActionStorage.ts
   ├── pageVisitStorage.ts
   └── index.ts
   
   server/storage/contacts/
   ├── contactPreferencesStorage.ts # Opt-out preferences
   └── index.ts
   ```

3. **Create contact preferences system**
   - Add `contactPreferences` table
   - API routes for viewing/updating preferences
   - Preference centre page (simple, accessible without login via token)
   - Integrate with recipient resolution (exclude opted-out)

4. **Create campaign templates structure**
   - CRUD for templates
   - Clone template to new campaign
   - Admin UI for managing templates

5. **Create basic API routes**
   ```
   server/routes/campaigns.ts
   server/routes/pages.ts
   server/routes/contactPreferences.ts
   ```

### 4.2 Testing Access - Phase 1

To test Phase 1 features:
1. Navigate to the root page
2. Click the "Passwords" tab
3. Login with: **admin@example.com** / **admin123**
4. Access campaign templates via Super Admin menu

### 4.3 Success Criteria - Phase 1
- [ ] All tables created and migrated successfully
- [ ] Storage layer compiles without errors
- [ ] Can create/read/update/delete campaign templates via API
- [ ] Can view and update contact preferences via token link
- [ ] Contact preferences correctly filter recipients in test queries

### 4.3 Test Cases - Phase 1
```
1. Create contact preference opt-out
   - POST /api/contact-preferences/{token}/opt-out
   - Body: { channel: 'email', category: 'upsell' }
   - Verify: Preference saved, 200 response

2. Verify opt-out filtering
   - Create person with email
   - Opt them out of 'upsell' emails
   - Run targeting query for upsell campaign
   - Verify: Person not in recipient list

3. Template CRUD
   - Create template with full configuration
   - Read template
   - Update template
   - Delete template
   - Verify: All operations succeed
```

---

## 5. Phase 2: Campaign Engine

### 5.1 Targeting Engine Implementation

#### Filter Registry (Complete)

```typescript
// server/services/campaigns/campaignTargetingService.ts

interface FilterDefinition {
  type: string;
  label: string;
  category: 'client_status' | 'services' | 'projects' | 'data_completeness' | 'engagement';
  operators: string[];
  valueType: 'boolean' | 'select' | 'multi_select' | 'number' | 'number_range' | 'date_range' | 'user_select' | 'service_select' | 'project_type_select' | 'stage_select';
  options?: any[];
  buildQuery: (operator: string, value: any) => SQL;
}

const FILTER_REGISTRY: FilterDefinition[] = [
  // CLIENT STATUS (5 filters)
  {
    type: 'client_type',
    label: 'Client Type',
    category: 'client_status',
    operators: ['equals'],
    valueType: 'select',
    options: [
      { value: 'company', label: 'Company' },
      { value: 'individual', label: 'Individual' }
    ],
    buildQuery: (op, val) => sql`clients.client_type = ${val}`
  },
  {
    type: 'client_status',
    label: 'Company Status',
    category: 'client_status',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    valueType: 'multi_select',
    options: ['Active', 'Dormant', 'Dissolved', 'Liquidation', 'Prospect'],
    buildQuery: (op, val) => {
      if (op === 'in') return sql`clients.company_status IN ${val}`;
      if (op === 'not_in') return sql`clients.company_status NOT IN ${val}`;
      if (op === 'equals') return sql`clients.company_status = ${val}`;
      return sql`clients.company_status != ${val}`;
    }
  },
  {
    type: 'client_manager',
    label: 'Client Manager',
    category: 'client_status',
    operators: ['equals', 'not_equals', 'in'],
    valueType: 'user_select',
    buildQuery: (op, val) => {
      if (op === 'in') return sql`clients.manager_id IN ${val}`;
      if (op === 'equals') return sql`clients.manager_id = ${val}`;
      return sql`clients.manager_id != ${val}`;
    }
  },
  {
    type: 'monthly_fee_range',
    label: 'Monthly Fee',
    category: 'client_status',
    operators: ['between', 'gt', 'lt', 'gte', 'lte'],
    valueType: 'number_range',
    buildQuery: (op, val) => {
      if (op === 'between') return sql`clients.monthly_charge_quote BETWEEN ${val.min} AND ${val.max}`;
      if (op === 'gt') return sql`clients.monthly_charge_quote > ${val}`;
      if (op === 'lt') return sql`clients.monthly_charge_quote < ${val}`;
      if (op === 'gte') return sql`clients.monthly_charge_quote >= ${val}`;
      return sql`clients.monthly_charge_quote <= ${val}`;
    }
  },
  {
    type: 'has_tag',
    label: 'Has Tag',
    category: 'client_status',
    operators: ['equals', 'not_equals'],
    valueType: 'select', // populated from clientTags
    buildQuery: (op, val) => {
      if (op === 'equals') {
        return sql`EXISTS (SELECT 1 FROM client_tag_assignments WHERE client_tag_assignments.client_id = clients.id AND client_tag_assignments.tag_id = ${val})`;
      }
      return sql`NOT EXISTS (SELECT 1 FROM client_tag_assignments WHERE client_tag_assignments.client_id = clients.id AND client_tag_assignments.tag_id = ${val})`;
    }
  },

  // SERVICES (3 filters)
  {
    type: 'has_service',
    label: 'Has Service',
    category: 'services',
    operators: ['equals'],
    valueType: 'service_select',
    buildQuery: (op, val) => sql`EXISTS (SELECT 1 FROM client_services WHERE client_services.client_id = clients.id AND client_services.service_id = ${val} AND client_services.is_active = true)`
  },
  {
    type: 'missing_service',
    label: 'Does NOT Have Service',
    category: 'services',
    operators: ['equals'],
    valueType: 'service_select',
    buildQuery: (op, val) => sql`NOT EXISTS (SELECT 1 FROM client_services WHERE client_services.client_id = clients.id AND client_services.service_id = ${val} AND client_services.is_active = true)`
  },
  {
    type: 'has_service_not_other',
    label: 'Has Service A but not B',
    category: 'services',
    operators: ['equals'],
    valueType: 'multi_select', // [serviceA, serviceB]
    buildQuery: (op, val) => sql`
      EXISTS (SELECT 1 FROM client_services WHERE client_services.client_id = clients.id AND client_services.service_id = ${val[0]} AND client_services.is_active = true)
      AND NOT EXISTS (SELECT 1 FROM client_services WHERE client_services.client_id = clients.id AND client_services.service_id = ${val[1]} AND client_services.is_active = true)
    `
  },

  // PROJECTS & COMPLIANCE (6 filters)
  {
    type: 'has_project_type',
    label: 'Has Active Project Type',
    category: 'projects',
    operators: ['equals', 'not_equals'],
    valueType: 'project_type_select',
    buildQuery: (op, val) => {
      if (op === 'equals') {
        return sql`EXISTS (SELECT 1 FROM projects WHERE projects.client_id = clients.id AND projects.project_type_id = ${val} AND projects.status = 'active')`;
      }
      return sql`NOT EXISTS (SELECT 1 FROM projects WHERE projects.client_id = clients.id AND projects.project_type_id = ${val} AND projects.status = 'active')`;
    }
  },
  {
    type: 'project_at_stage',
    label: 'Has Project at Stage',
    category: 'projects',
    operators: ['equals'],
    valueType: 'stage_select', // {projectTypeId, stageId}
    buildQuery: (op, val) => sql`EXISTS (SELECT 1 FROM projects WHERE projects.client_id = clients.id AND projects.project_type_id = ${val.projectTypeId} AND projects.kanban_stage_id = ${val.stageId} AND projects.status = 'active')`
  },
  {
    type: 'accounts_due_range',
    label: 'Accounts Due Within',
    category: 'projects',
    operators: ['between'],
    valueType: 'date_range',
    buildQuery: (op, val) => sql`clients.next_accounts_due BETWEEN ${val.from} AND ${val.to}`
  },
  {
    type: 'confirmation_statement_due_range',
    label: 'Confirmation Statement Due Within',
    category: 'projects',
    operators: ['between'],
    valueType: 'date_range',
    buildQuery: (op, val) => sql`clients.confirmation_statement_next_due BETWEEN ${val.from} AND ${val.to}`
  },
  {
    type: 'has_overdue_project',
    label: 'Has Overdue Project',
    category: 'projects',
    operators: ['equals'],
    valueType: 'boolean',
    buildQuery: (op, val) => {
      if (val) {
        return sql`EXISTS (SELECT 1 FROM projects WHERE projects.client_id = clients.id AND projects.due_date < NOW() AND projects.status = 'active')`;
      }
      return sql`NOT EXISTS (SELECT 1 FROM projects WHERE projects.client_id = clients.id AND projects.due_date < NOW() AND projects.status = 'active')`;
    }
  },
  {
    type: 'vat_quarter_due_range',
    label: 'VAT Quarter Due Within',
    category: 'projects',
    operators: ['between'],
    valueType: 'date_range',
    buildQuery: (op, val) => sql`EXISTS (SELECT 1 FROM projects p JOIN project_types pt ON p.project_type_id = pt.id WHERE p.client_id = clients.id AND pt.name ILIKE '%VAT%' AND p.due_date BETWEEN ${val.from} AND ${val.to} AND p.status = 'active')`
  },

  // DATA COMPLETENESS (4 filters)
  {
    type: 'missing_utr',
    label: 'Missing Company UTR',
    category: 'data_completeness',
    operators: ['equals'],
    valueType: 'boolean',
    buildQuery: (op, val) => {
      if (val) return sql`(clients.company_utr IS NULL OR clients.company_utr = '')`;
      return sql`(clients.company_utr IS NOT NULL AND clients.company_utr != '')`;
    }
  },
  {
    type: 'missing_auth_code',
    label: 'Missing Companies House Auth Code',
    category: 'data_completeness',
    operators: ['equals'],
    valueType: 'boolean',
    buildQuery: (op, val) => {
      if (val) return sql`(clients.companies_house_auth_code IS NULL OR clients.companies_house_auth_code = '')`;
      return sql`(clients.companies_house_auth_code IS NOT NULL AND clients.companies_house_auth_code != '')`;
    }
  },
  {
    type: 'missing_company_number',
    label: 'Missing Company Number',
    category: 'data_completeness',
    operators: ['equals'],
    valueType: 'boolean',
    buildQuery: (op, val) => {
      if (val) return sql`(clients.company_number IS NULL OR clients.company_number = '')`;
      return sql`(clients.company_number IS NOT NULL AND clients.company_number != '')`;
    }
  },
  {
    type: 'docs_outstanding_days',
    label: 'Docs Outstanding More Than X Days',
    category: 'data_completeness',
    operators: ['gt'],
    valueType: 'number',
    buildQuery: (op, val) => sql`EXISTS (SELECT 1 FROM task_instances ti JOIN tasks t ON ti.task_id = t.id WHERE ti.client_id = clients.id AND t.is_doc_request = true AND ti.status = 'pending' AND ti.created_at < NOW() - INTERVAL '${val} days')`
  },

  // ENGAGEMENT (6 filters)
  {
    type: 'opened_last_campaign',
    label: 'Opened Last Campaign',
    category: 'engagement',
    operators: ['equals'],
    valueType: 'boolean',
    buildQuery: (op, val) => {
      const subquery = sql`(
        SELECT cr.id FROM campaign_recipients cr
        JOIN campaigns c ON cr.campaign_id = c.id
        WHERE cr.client_id = clients.id AND c.status = 'sent'
        ORDER BY cr.sent_at DESC LIMIT 1
      )`;
      if (val) {
        return sql`EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.id = ${subquery} AND cr.opened_at IS NOT NULL)`;
      }
      return sql`EXISTS (SELECT 1 FROM campaign_recipients cr WHERE cr.id = ${subquery} AND cr.opened_at IS NULL)`;
    }
  },
  {
    type: 'clicked_last_campaign',
    label: 'Clicked Last Campaign',
    category: 'engagement',
    operators: ['equals'],
    valueType: 'boolean',
    buildQuery: (op, val) => {
      // Similar pattern to opened_last_campaign
    }
  },
  {
    type: 'last_contact_days',
    label: 'Last Contact More Than X Days Ago',
    category: 'engagement',
    operators: ['gt', 'lt'],
    valueType: 'number',
    buildQuery: (op, val) => {
      if (op === 'gt') {
        return sql`(SELECT MAX(logged_at) FROM communications WHERE communications.client_id = clients.id) < NOW() - INTERVAL '${val} days'`;
      }
      return sql`(SELECT MAX(logged_at) FROM communications WHERE communications.client_id = clients.id) > NOW() - INTERVAL '${val} days'`;
    }
  },
  {
    type: 'portal_login_days',
    label: 'Portal Login Within X Days',
    category: 'engagement',
    operators: ['equals', 'not_equals'],
    valueType: 'number',
    buildQuery: (op, val) => {
      if (op === 'equals') {
        return sql`EXISTS (SELECT 1 FROM client_portal_users WHERE client_portal_users.client_id = clients.id AND client_portal_users.last_login > NOW() - INTERVAL '${val} days')`;
      }
      return sql`NOT EXISTS (SELECT 1 FROM client_portal_users WHERE client_portal_users.client_id = clients.id AND client_portal_users.last_login > NOW() - INTERVAL '${val} days')`;
    }
  },
  {
    type: 'engagement_score',
    label: 'Engagement Score',
    category: 'engagement',
    operators: ['gt', 'lt', 'between'],
    valueType: 'number_range',
    buildQuery: (op, val) => {
      if (op === 'gt') return sql`(SELECT total_score FROM client_engagement_scores WHERE client_id = clients.id) > ${val}`;
      if (op === 'lt') return sql`(SELECT total_score FROM client_engagement_scores WHERE client_id = clients.id) < ${val}`;
      return sql`(SELECT total_score FROM client_engagement_scores WHERE client_id = clients.id) BETWEEN ${val.min} AND ${val.max}`;
    }
  },
  {
    type: 'consecutive_ignored',
    label: 'Ignored X Consecutive Campaigns',
    category: 'engagement',
    operators: ['gte'],
    valueType: 'number',
    buildQuery: (op, val) => sql`(SELECT consecutive_ignored FROM client_engagement_scores WHERE client_id = clients.id) >= ${val}`
  }
];
```

#### Query Builder Implementation

```typescript
// server/services/campaigns/campaignTargetingService.ts

export async function buildTargetQuery(criteria: FilterCriterion[]): Promise<SQL> {
  // Group criteria by filterGroup (within group = AND, between groups = OR)
  const groups = groupBy(criteria, 'filterGroup');
  
  const groupClauses = Object.values(groups).map(groupCriteria => {
    const andClauses = groupCriteria
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(criterion => {
        const filter = FILTER_REGISTRY.find(f => f.type === criterion.filterType);
        if (!filter) throw new Error(`Unknown filter type: ${criterion.filterType}`);
        return filter.buildQuery(criterion.operator, criterion.value);
      });
    
    return sql`(${sql.join(andClauses, sql` AND `)})`;
  });
  
  return sql`
    SELECT DISTINCT c.* FROM clients c
    WHERE (${sql.join(groupClauses, sql` OR `)})
  `;
}

export async function getMatchingClientCount(campaignId: string): Promise<number> {
  const criteria = await storage.campaignTarget.getByCampaignId(campaignId);
  const query = await buildTargetQuery(criteria);
  const countQuery = sql`SELECT COUNT(*) as count FROM (${query}) as matched`;
  const result = await db.execute(countQuery);
  return result[0].count;
}

export async function getMatchingClients(campaignId: string, limit = 100, offset = 0): Promise<Client[]> {
  const criteria = await storage.campaignTarget.getByCampaignId(campaignId);
  const query = await buildTargetQuery(criteria);
  const pagedQuery = sql`${query} ORDER BY c.name LIMIT ${limit} OFFSET ${offset}`;
  return db.execute(pagedQuery);
}
```

### 5.2 Recipient Resolution with History

```typescript
// server/services/campaigns/campaignRecipientService.ts

interface RecipientRules {
  strategy: 'primary_only' | 'all_contacts' | 'role_based';
  roles?: string[];  // Officer roles for role_based strategy
  channels: {
    email: boolean;
    sms: boolean;
    voice: boolean;
  };
}

interface ResolvedRecipient {
  clientId: string;
  personId: string;
  channel: 'email' | 'sms' | 'voice';
  channelAddress: string;
  inclusionReason: string;
  lastCampaignReceivedAt: Date | null;
  lastCampaignCategory: string | null;
  isOptedOut: boolean;
  optedOutCategory: string | null;
}

export async function resolveRecipients(
  campaignId: string,
  rules: RecipientRules,
  category: string
): Promise<ResolvedRecipient[]> {
  const clients = await getMatchingClients(campaignId, 10000, 0); // Get all matched
  const recipients: ResolvedRecipient[] = [];
  const seenAddresses = new Set<string>(); // For deduplication
  
  for (const client of clients) {
    // Get contacts based on strategy
    let contacts: ClientPerson[];
    
    switch (rules.strategy) {
      case 'primary_only':
        contacts = await storage.clientPeople.getPrimaryContacts(client.id);
        break;
      case 'all_contacts':
        contacts = await storage.clientPeople.getAllContacts(client.id);
        break;
      case 'role_based':
        contacts = await storage.clientPeople.getContactsByRoles(client.id, rules.roles);
        break;
    }
    
    for (const contact of contacts) {
      const person = await storage.people.getById(contact.personId);
      if (!person) continue;
      
      // Check global opt-out
      if (!person.receiveNotifications) continue;
      
      // Process each enabled channel
      for (const channel of ['email', 'sms', 'voice'] as const) {
        if (!rules.channels[channel]) continue;
        
        const address = channel === 'email' ? person.email : person.telephone;
        if (!address) continue;
        
        // Normalise address
        const normalisedAddress = channel === 'email' 
          ? address.toLowerCase().trim()
          : normalisePhoneToE164(address);
        
        // Deduplicate
        const dedupKey = `${channel}:${normalisedAddress}`;
        if (seenAddresses.has(dedupKey)) continue;
        seenAddresses.add(dedupKey);
        
        // Check category-specific opt-out
        const preference = await storage.contactPreferences.get(person.id, channel, category);
        const isOptedOut = preference?.optedOut || false;
        
        // Get last campaign info for this recipient
        const lastCampaign = await storage.campaignRecipients.getLastCampaignForPerson(
          person.id, 
          channel
        );
        
        // Build inclusion reason
        const reasons: string[] = [];
        reasons.push(`Client matched targeting criteria`);
        if (rules.strategy === 'primary_only') reasons.push(`Primary contact`);
        if (rules.strategy === 'role_based') reasons.push(`Role: ${contact.officerRole}`);
        reasons.push(`Channel: ${channel}`);
        
        recipients.push({
          clientId: client.id,
          personId: person.id,
          channel,
          channelAddress: normalisedAddress,
          inclusionReason: reasons.join('; '),
          lastCampaignReceivedAt: lastCampaign?.sentAt || null,
          lastCampaignCategory: lastCampaign?.category || null,
          isOptedOut,
          optedOutCategory: isOptedOut ? category : null
        });
      }
    }
  }
  
  return recipients;
}
```

### 5.3 Campaign Workflow State Machine

```typescript
// server/services/campaigns/campaignWorkflowService.ts

const STATE_TRANSITIONS: Record<string, string[]> = {
  'draft': ['review', 'cancelled'],
  'review': ['draft', 'approved', 'cancelled'],
  'approved': ['scheduled', 'sending', 'cancelled'],  // sending = immediate
  'scheduled': ['paused', 'sending', 'cancelled'],
  'paused': ['scheduled', 'cancelled'],
  'sending': ['sent'],  // Only system can transition
  'sent': [],  // Terminal
  'cancelled': []  // Terminal
};

const TRANSITION_VALIDATIONS: Record<string, (campaign: Campaign) => Promise<ValidationResult>> = {
  'review': async (campaign) => {
    // Must have targeting criteria
    const criteria = await storage.campaignTarget.getByCampaignId(campaign.id);
    if (criteria.length === 0) {
      return { valid: false, error: 'Campaign must have at least one targeting filter' };
    }
    
    // Must have at least one message
    const messages = await storage.campaignMessages.getByCampaignId(campaign.id);
    if (messages.length === 0) {
      return { valid: false, error: 'Campaign must have at least one message' };
    }
    
    // Must have recipients
    const count = await getMatchingClientCount(campaign.id);
    if (count === 0) {
      return { valid: false, error: 'Campaign targeting matches no clients' };
    }
    
    return { valid: true };
  },
  
  'approved': async (campaign) => {
    // Must have preview confirmed
    if (!campaign.previewConfirmedAt) {
      return { valid: false, error: 'Campaign must have preview confirmed before approval' };
    }
    
    // Validate merge fields
    const validation = await validateMergeFields(campaign.id);
    if (!validation.valid) {
      return { valid: false, error: `Merge field issues: ${validation.issues.join(', ')}` };
    }
    
    return { valid: true };
  },
  
  'scheduled': async (campaign) => {
    if (!campaign.scheduledFor) {
      return { valid: false, error: 'Scheduled time is required' };
    }
    if (campaign.scheduledFor < new Date()) {
      return { valid: false, error: 'Scheduled time must be in the future' };
    }
    return { valid: true };
  }
};

export async function transitionCampaignStatus(
  campaignId: string,
  newStatus: string,
  userId: string,
  options?: { scheduledFor?: Date }
): Promise<Campaign> {
  const campaign = await storage.campaigns.getById(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  
  // Check valid transition
  const allowed = STATE_TRANSITIONS[campaign.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${campaign.status} to ${newStatus}`);
  }
  
  // Run validation
  const validator = TRANSITION_VALIDATIONS[newStatus];
  if (validator) {
    const result = await validator(campaign);
    if (!result.valid) throw new Error(result.error);
  }
  
  // Perform transition
  const updates: Partial<Campaign> = { status: newStatus };
  
  switch (newStatus) {
    case 'review':
      updates.reviewedByUserId = userId;
      updates.reviewedAt = new Date();
      break;
    case 'approved':
      updates.approvedByUserId = userId;
      updates.approvedAt = new Date;
      // Snapshot targeting at approval
      updates.targetCriteriaSnapshot = campaign.targetCriteria;
      const recipients = await resolveRecipients(campaignId, campaign.recipientRules, campaign.category);
      updates.recipientCountSnapshot = recipients.length;
      // Save recipients to table
      await storage.campaignRecipients.bulkCreate(campaignId, recipients);
      break;
    case 'scheduled':
      updates.scheduledFor = options?.scheduledFor;
      break;
    case 'sending':
      updates.sendingStartedAt = new Date();
      // Queue all recipients for delivery
      await queueCampaignForDelivery(campaignId);
      break;
    case 'sent':
      updates.sentAt = new Date();
      break;
  }
  
  return storage.campaigns.update(campaignId, updates);
}
```

### 5.4 Delivery with Retry Logic

```typescript
// server/services/campaigns/campaignDeliveryService.ts

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [60, 300, 900]; // seconds: 1min, 5min, 15min

export async function queueCampaignForDelivery(campaignId: string): Promise<void> {
  const recipients = await storage.campaignRecipients.getByCampaignId(campaignId);
  
  // Filter out opted-out and already processed
  const toQueue = recipients.filter(r => 
    r.status === 'pending' && 
    !r.manuallyRemoved
  );
  
  // Pre-resolve merge data and render content
  for (const recipient of toQueue) {
    const mergeData = await resolveMergeData(recipient.clientId, recipient.personId, campaignId);
    const message = await storage.campaignMessages.getForChannel(campaignId, recipient.channel);
    const rendered = await renderMessage(message, mergeData);
    
    await storage.campaignRecipients.update(recipient.id, {
      resolvedMergeData: mergeData,
      renderedContent: rendered,
      status: 'queued',
      queuedAt: new Date()
    });
    
    await storage.campaignDeliveryQueue.create({
      recipientId: recipient.id,
      channel: recipient.channel,
      priority: 5,
      status: 'pending',
      attemptCount: 0,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      nextAttemptAt: new Date()
    });
  }
}

export async function processDeliveryQueue(): Promise<void> {
  // Called by cron every minute
  const pending = await storage.campaignDeliveryQueue.getPendingItems(100);
  
  for (const item of pending) {
    try {
      await storage.campaignDeliveryQueue.update(item.id, { status: 'processing' });
      
      const recipient = await storage.campaignRecipients.getById(item.recipientId);
      const result = await sendToChannel(recipient);
      
      if (result.success) {
        await storage.campaignRecipients.update(recipient.id, {
          status: 'sent',
          sentAt: new Date(),
          externalMessageId: result.messageId
        });
        await storage.campaignDeliveryQueue.update(item.id, { status: 'completed' });
        await logEngagementEvent(recipient.campaignId, recipient.id, 'sent', recipient.channel);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      await handleDeliveryFailure(item, error);
    }
  }
  
  // Check if campaign is complete
  await checkCampaignCompletion();
}

async function handleDeliveryFailure(item: DeliveryQueueItem, error: Error): Promise<void> {
  const newAttemptCount = item.attemptCount + 1;
  
  if (newAttemptCount >= item.maxAttempts) {
    // Permanent failure
    await storage.campaignDeliveryQueue.update(item.id, {
      status: 'failed_permanent',
      attemptCount: newAttemptCount,
      lastAttemptAt: new Date(),
      lastError: error.message
    });
    await storage.campaignRecipients.update(item.recipientId, {
      status: 'failed',
      failureReason: `Failed after ${newAttemptCount} attempts: ${error.message}`
    });
    await logEngagementEvent(item.recipientId, 'failed', { error: error.message });
  } else {
    // Schedule retry
    const delaySeconds = RETRY_DELAYS[newAttemptCount - 1] || 900;
    const nextAttempt = new Date(Date.now() + delaySeconds * 1000);
    
    await storage.campaignDeliveryQueue.update(item.id, {
      status: 'pending',
      attemptCount: newAttemptCount,
      lastAttemptAt: new Date(),
      lastError: error.message,
      nextAttemptAt: nextAttempt
    });
    await storage.campaignRecipients.update(item.recipientId, {
      retryCount: newAttemptCount,
      lastRetryAt: new Date()
    });
  }
}

async function sendToChannel(recipient: CampaignRecipient): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const rendered = recipient.renderedContent;
  
  switch (recipient.channel) {
    case 'email':
      return sendEmailViaSendGrid({
        to: recipient.channelAddress,
        subject: rendered.subject,
        html: rendered.body,
        text: rendered.plainTextBody,
        customArgs: {
          campaignId: recipient.campaignId,
          recipientId: recipient.id
        }
      });
    
    case 'sms':
      return sendSmsViaVoodoo({
        to: recipient.channelAddress,
        message: rendered.smsContent,
        reference: recipient.id
      });
    
    case 'voice':
      return triggerVoiceCall({
        to: recipient.channelAddress,
        script: rendered.voiceScript,
        callbackUrl: `${process.env.BASE_URL}/api/webhooks/dialora/campaign-events`,
        reference: recipient.id
      });
  }
}
```

### 5.5 Webhook Handlers for Delivery Events

```typescript
// server/routes/webhooks/campaignWebhooks.ts

// SendGrid webhook
router.post('/sendgrid/campaign-events', async (req, res) => {
  const events = req.body; // Array of events
  
  for (const event of events) {
    const recipientId = event.campaignId && event.recipientId 
      ? event.recipientId 
      : await findRecipientByMessageId(event.sg_message_id);
    
    if (!recipientId) continue;
    
    const recipient = await storage.campaignRecipients.getById(recipientId);
    if (!recipient) continue;
    
    switch (event.event) {
      case 'delivered':
        await storage.campaignRecipients.update(recipientId, { 
          status: 'delivered',
          deliveredAt: new Date(event.timestamp * 1000)
        });
        await logEngagementEvent(recipient.campaignId, recipientId, 'delivered', 'email');
        break;
      
      case 'open':
        const isFirstOpen = !recipient.openedAt;
        await storage.campaignRecipients.update(recipientId, {
          openedAt: recipient.openedAt || new Date(event.timestamp * 1000),
          openCount: (recipient.openCount || 0) + 1
        });
        if (isFirstOpen) {
          await logEngagementEvent(recipient.campaignId, recipientId, 'opened', 'email');
          await updateEngagementScore(recipient.clientId, 'email_opened');
        }
        break;
      
      case 'click':
        const isFirstClick = !recipient.clickedAt;
        await storage.campaignRecipients.update(recipientId, {
          clickedAt: recipient.clickedAt || new Date(event.timestamp * 1000),
          clickCount: (recipient.clickCount || 0) + 1
        });
        if (isFirstClick) {
          await logEngagementEvent(recipient.campaignId, recipientId, 'clicked', 'email', { url: event.url });
          await updateEngagementScore(recipient.clientId, 'email_clicked');
        }
        break;
      
      case 'bounce':
        await storage.campaignRecipients.update(recipientId, {
          status: 'bounced',
          failureReason: event.reason
        });
        await logEngagementEvent(recipient.campaignId, recipientId, 'bounced', 'email', { reason: event.reason });
        break;
      
      case 'spamreport':
        await logEngagementEvent(recipient.campaignId, recipientId, 'spam_report', 'email');
        // Auto opt-out from all campaigns
        await storage.contactPreferences.optOut(recipient.personId, 'email', 'all', 'spam_report');
        break;
    }
  }
  
  res.sendStatus(200);
});

// VoodooSMS webhook
router.post('/voodoo/campaign-events', async (req, res) => {
  const { reference, status, timestamp } = req.body;
  
  const recipient = await storage.campaignRecipients.getById(reference);
  if (!recipient) return res.sendStatus(200);
  
  switch (status) {
    case 'DELIVERED':
      await storage.campaignRecipients.update(reference, {
        status: 'delivered',
        deliveredAt: new Date(timestamp)
      });
      await logEngagementEvent(recipient.campaignId, reference, 'delivered', 'sms');
      break;
    
    case 'FAILED':
      await storage.campaignRecipients.update(reference, {
        status: 'failed',
        failureReason: 'Delivery failed'
      });
      await logEngagementEvent(recipient.campaignId, reference, 'failed', 'sms');
      break;
  }
  
  res.sendStatus(200);
});
```

### 5.6 Mandatory Preview System

```typescript
// server/routes/campaigns.ts

router.post('/campaigns/:id/preview', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { recipientId } = req.body; // Optional specific recipient to preview
  
  const campaign = await storage.campaigns.getById(id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  
  // Get sample recipients if none specified
  let previewRecipients: CampaignRecipient[];
  if (recipientId) {
    const recipient = await storage.campaignRecipients.getById(recipientId);
    previewRecipients = recipient ? [recipient] : [];
  } else {
    previewRecipients = await storage.campaignRecipients.getSample(id, 3);
  }
  
  const previews = await Promise.all(previewRecipients.map(async recipient => {
    const mergeData = await resolveMergeData(recipient.clientId, recipient.personId, id);
    const messages = await storage.campaignMessages.getByCampaignId(id);
    
    const rendered = {};
    const issues: string[] = [];
    
    for (const message of messages) {
      const result = await renderMessageWithValidation(message, mergeData);
      rendered[message.channel] = result.content;
      issues.push(...result.issues);
    }
    
    // Get page preview if attached
    let pagePreview = null;
    if (campaign.pageId) {
      pagePreview = await renderPagePreview(campaign.pageId, mergeData);
    }
    
    return {
      recipientId: recipient.id,
      clientName: mergeData.client.name,
      personName: mergeData.person.fullName,
      channel: recipient.channel,
      channelAddress: recipient.channelAddress,
      rendered,
      pagePreview,
      issues,
      lastCampaignReceivedAt: recipient.lastCampaignReceivedAt,
      lastCampaignCategory: recipient.lastCampaignCategory
    };
  }));
  
  // Check for global issues
  const globalIssues: string[] = [];
  
  // Check for duplicate warnings (recipients who received similar campaign recently)
  const recentRecipients = await storage.campaignRecipients.getRecentByCategory(
    id, 
    campaign.category, 
    7 // days
  );
  if (recentRecipients.length > 0) {
    globalIssues.push(`${recentRecipients.length} recipients received a ${campaign.category} campaign in the last 7 days`);
  }
  
  res.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      category: campaign.category,
      status: campaign.status
    },
    previews,
    globalIssues,
    recipientCount: await storage.campaignRecipients.countByCampaignId(id),
    optedOutCount: await storage.campaignRecipients.countOptedOut(id)
  });
});

router.post('/campaigns/:id/confirm-preview', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  await storage.campaigns.update(id, {
    previewConfirmedAt: new Date(),
    previewConfirmedByUserId: userId
  });
  
  res.json({ success: true });
});
```

### 5.7 Testing Access - Phase 2

To test Phase 2 features:
1. Navigate to the root page
2. Click the "Passwords" tab
3. Login with: **admin@example.com** / **admin123**
4. Access Campaigns from the main navigation or Super Admin menu

### 5.8 Success Criteria - Phase 2

- [ ] All 16+ filters work correctly and can be combined
- [ ] Live count updates as filters change (debounced)
- [ ] Recipients resolved correctly per strategy (primary/all/role-based)
- [ ] Duplicate campaign warnings show for recent recipients
- [ ] Category opt-outs correctly exclude recipients
- [ ] Campaign workflow: draft → review → approved → scheduled/sending → sent
- [ ] Preview is mandatory before approval
- [ ] Email sends via SendGrid with tracking
- [ ] SMS sends via VoodooSMS with delivery receipts
- [ ] Failed deliveries retry up to 3 times with backoff
- [ ] All engagement events logged correctly
- [ ] Communications table receives campaign send entries

### 5.8 Test Cases - Phase 2

```
1. Targeting Engine Tests
   - Create campaign with single filter → verify client count
   - Add second filter in same group (AND) → verify reduced count
   - Add filter in new group (OR) → verify increased count
   - Test each filter type with sample data
   - Performance: 5000 clients with complex query < 2 seconds

2. Recipient Resolution Tests
   - Primary only: verify only isPrimaryContact returned
   - Role-based: verify correct officer roles matched
   - Deduplication: same email/phone across clients = single recipient
   - Opt-out filtering: opted-out person excluded
   - History: lastCampaignReceivedAt populated correctly

3. Workflow Tests
   - Cannot move to review without criteria
   - Cannot move to review without message
   - Cannot approve without preview confirmation
   - Scheduled campaign sends at correct time
   - Paused campaign doesn't send
   - Cancelled campaign terminal state

4. Delivery Tests
   - Email sends and receives delivered webhook
   - Open tracking works and updates recipient
   - Click tracking works and updates recipient
   - Failed delivery retries 3 times then marks failed
   - Bounce updates recipient status
   - SMS delivery receipt updates status

5. Integration Tests (E2E)
   - Create campaign → add filters → add message → preview → approve → send immediately
   - Verify email received by test inbox
   - Verify engagement events logged
   - Verify client communication timeline updated
```

---

## 6. Phase 3: Pages Module

### 6.1 Component Schemas

```typescript
// shared/types/pageComponents.ts

interface TextBlockContent {
  html: string;  // TiptapEditor content
}

interface HeadingContent {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  alignment: 'left' | 'center' | 'right';
}

interface ImageContent {
  src: string;  // Object storage path or URL
  alt: string;
  caption?: string;
  width?: string;  // e.g., '100%', '50%', '300px'
  alignment: 'left' | 'center' | 'right';
}

interface TableContent {
  headers: string[];
  rows: string[][];
  striped: boolean;
  bordered: boolean;
}

interface ButtonContent {
  label: string;
  actionId: string;  // FK to pageActions
  style: 'primary' | 'secondary' | 'outline' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  fullWidth: boolean;
  icon?: string;  // Lucide icon name
}

interface FormContent {
  fields: FormField[];
  submitActionId: string;
  submitLabel: string;
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];  // For select
}

interface CalloutContent {
  type: 'info' | 'warning' | 'success' | 'error';
  title?: string;
  body: string;  // Can contain merge fields
  icon?: string;
}

interface StatusWidgetContent {
  title: string;
  entityType: 'project' | 'task' | 'document';
  displayMode: 'single' | 'list';
  fields: string[];  // Which fields to show
  // Data resolved at render time from recipient context
}

interface TimelineContent {
  title?: string;
  steps: TimelineStep[];
}

interface TimelineStep {
  title: string;
  description?: string;
  status: 'complete' | 'current' | 'pending';
  date?: string;
}

interface FaqAccordionContent {
  title?: string;
  items: FaqItem[];
  allowMultiple: boolean;
}

interface FaqItem {
  question: string;
  answer: string;  // HTML
}

interface ComparisonTableContent {
  title?: string;
  description?: string;
  plans: ComparisonPlan[];
  highlightedPlan?: number;  // Index
}

interface ComparisonPlan {
  name: string;
  price?: string;
  description?: string;
  features: ComparisonFeature[];
  buttonLabel?: string;
  buttonActionId?: string;
}

interface ComparisonFeature {
  name: string;
  value: string | boolean;
  tooltip?: string;
}

interface VideoEmbedContent {
  provider: 'youtube' | 'vimeo' | 'loom';
  videoId: string;
  title?: string;
  aspectRatio: '16:9' | '4:3' | '1:1';
}

interface DocumentListContent {
  title?: string;
  documents: DocumentItem[];
}

interface DocumentItem {
  name: string;
  url: string;
  type: string;  // 'pdf', 'doc', 'xls', etc.
  size?: string;
  description?: string;
}

interface SpacerContent {
  height: 'sm' | 'md' | 'lg' | 'xl';  // 1rem, 2rem, 3rem, 4rem
}
```

### 6.2 Page Rendering Service

```typescript
// server/services/pages/pageRenderService.ts

export async function renderPage(
  pageId: string,
  visitToken: string
): Promise<RenderedPage | { requiresOtp: true; email: string }> {
  const page = await storage.pages.getById(pageId);
  if (!page || !page.isPublished) throw new Error('Page not found');
  
  if (page.expiresAt && page.expiresAt < new Date()) {
    throw new Error('This page has expired');
  }
  
  // Find recipient from token
  const recipient = await storage.campaignRecipients.getByVisitToken(visitToken);
  if (!recipient) throw new Error('Invalid access token');
  
  // Check/create visit record
  let visit = await storage.pageVisits.getByToken(visitToken);
  if (visit) {
    await storage.pageVisits.update(visit.id, {
      lastViewedAt: new Date(),
      viewCount: visit.viewCount + 1
    });
  } else {
    // Check if OTP required
    if (page.requiresOtp) {
      const person = await storage.people.getById(recipient.personId);
      // Return OTP requirement - frontend will handle
      return { requiresOtp: true, email: person.email };
    }
    
    visit = await storage.pageVisits.create({
      pageId,
      recipientId: recipient.id,
      clientId: recipient.clientId,
      personId: recipient.personId,
      visitToken,
      firstViewedAt: new Date(),
      lastViewedAt: new Date(),
      viewCount: 1
    });
  }
  
  // Log page view engagement
  await logEngagementEvent(recipient.campaignId, recipient.id, 'page_viewed', 'email', { pageId });
  await updateEngagementScore(recipient.clientId, 'page_viewed');
  
  // Resolve merge data
  const mergeData = await resolveMergeData(recipient.clientId, recipient.personId, recipient.campaignId);
  
  // Get components
  const components = await storage.pageComponents.getByPageId(pageId);
  const actions = await storage.pageActions.getByPageId(pageId);
  
  // Render components
  const renderedComponents = await Promise.all(
    components.map(comp => renderComponent(comp, mergeData, actions))
  );
  
  // Group by section for layout
  const sections = groupComponentsBySectionAndRow(renderedComponents);
  
  return {
    page: {
      id: page.id,
      title: replaceMergeFields(page.headerTitle, mergeData),
      subtitle: page.headerSubtitle ? replaceMergeFields(page.headerSubtitle, mergeData) : null,
      headerImage: page.headerImagePath,
      themeColor: page.themeColor,
      backgroundColor: page.backgroundColor
    },
    sections,
    visitId: visit.id,
    recipientId: recipient.id
  };
}

async function renderComponent(
  component: PageComponent,
  mergeData: MergeData,
  actions: PageAction[]
): Promise<RenderedComponent> {
  const content = component.content;
  
  switch (component.componentType) {
    case 'text_block':
      return {
        ...component,
        renderedContent: {
          html: replaceMergeFields(content.html, mergeData)
        }
      };
    
    case 'button':
      const action = actions.find(a => a.id === content.actionId);
      return {
        ...component,
        renderedContent: {
          label: replaceMergeFields(content.label, mergeData),
          actionId: content.actionId,
          actionType: action?.actionType,
          style: content.style,
          size: content.size,
          fullWidth: content.fullWidth,
          requiresOtp: action?.requiresOtp
        }
      };
    
    case 'status_widget':
      // Resolve actual status data
      const statusData = await resolveStatusWidget(content, mergeData);
      return {
        ...component,
        renderedContent: {
          title: replaceMergeFields(content.title, mergeData),
          ...statusData
        }
      };
    
    // ... handle all other component types
  }
}
```

### 6.3 Page Action Handlers

```typescript
// server/services/pages/pageActionService.ts

export async function executePageAction(
  actionId: string,
  visitId: string,
  actionData?: any,
  otpVerified = false
): Promise<ActionResult> {
  const action = await storage.pageActions.getById(actionId);
  if (!action || !action.isEnabled) throw new Error('Action not available');
  
  const visit = await storage.pageVisits.getById(visitId);
  if (!visit) throw new Error('Invalid visit');
  
  // Check OTP if required
  if (action.requiresOtp && !otpVerified && !visit.otpVerifiedAt) {
    return { requiresOtp: true };
  }
  
  const recipient = await storage.campaignRecipients.getById(visit.recipientId);
  const client = await storage.clients.getById(visit.clientId);
  const person = await storage.people.getById(visit.personId);
  
  let result: any;
  
  switch (action.actionType) {
    case 'interested':
      result = await handleInterestedAction(action, client, person, recipient);
      break;
    
    case 'not_interested':
      result = await handleNotInterestedAction(action, client, person, recipient);
      break;
    
    case 'documents_uploaded':
      result = await handleDocumentsUploadedAction(action, client, person);
      break;
    
    case 'book_call':
      result = await handleBookCallAction(action, client, person);
      break;
    
    case 'request_callback':
      result = await handleRequestCallbackAction(action, client, person, actionData);
      break;
    
    case 'confirm_details':
      result = await handleConfirmDetailsAction(action, client, person, actionData);
      break;
    
    case 'custom_form':
      result = await handleCustomFormAction(action, client, person, actionData);
      break;
    
    case 'custom_webhook':
      result = await handleCustomWebhookAction(action, client, person, actionData);
      break;
  }
  
  // Log the action
  await storage.pageActionLogs.create({
    pageId: action.pageId,
    actionId: action.id,
    visitId: visitId,
    recipientId: visit.recipientId,
    clientId: visit.clientId,
    personId: visit.personId,
    actionData,
    resultData: result
  });
  
  // Log engagement
  await logEngagementEvent(recipient.campaignId, recipient.id, 'action_completed', 'email', {
    actionId: action.id,
    actionType: action.actionType
  });
  await updateEngagementScore(visit.clientId, 'action_completed');
  
  return {
    success: true,
    message: action.successMessage || 'Action completed successfully',
    redirectUrl: action.successRedirectUrl
  };
}

async function handleInterestedAction(
  action: PageAction,
  client: Client,
  person: Person,
  recipient: CampaignRecipient
): Promise<any> {
  const config = action.config as InterestedActionConfig;
  
  // Create task for follow-up
  if (config.createTask) {
    const campaign = await storage.campaigns.getById(recipient.campaignId);
    await storage.internalTasks.create({
      title: replaceMergeFields(config.createTask.title, { client, person, campaign }),
      description: `${person.fullName} expressed interest via campaign page`,
      assignedToUserId: config.createTask.assignToManager 
        ? client.managerId 
        : config.createTask.assignToUserId,
      dueDate: addDays(new Date(), config.createTask.dueInDays || 2),
      clientId: client.id,
      source: 'campaign_page'
    });
  }
  
  // Log to communications
  await storage.communications.create({
    clientId: client.id,
    personId: person.id,
    type: 'note',
    subject: `Interest expressed: ${action.label}`,
    content: `${person.fullName} clicked "${action.label}" on campaign page`,
    actualContactTime: new Date()
  });
  
  // Notify staff
  if (config.notifyStaff) {
    await notifyStaff(config.notifyStaff, client, person, action);
  }
  
  return { taskCreated: !!config.createTask };
}
```

### 6.4 OTP Verification

```typescript
// server/services/pages/pageOtpService.ts

export async function sendPageOtp(visitToken: string): Promise<{ sent: boolean }> {
  const recipient = await storage.campaignRecipients.getByVisitToken(visitToken);
  if (!recipient) throw new Error('Invalid token');
  
  const person = await storage.people.getById(recipient.personId);
  if (!person.email) throw new Error('No email for OTP');
  
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  // Store code (could use Redis, but using DB for simplicity)
  await storage.pageOtpCodes.create({
    visitToken,
    code,
    expiresAt: expiry
  });
  
  // Send email
  await sendEmail({
    to: person.email,
    subject: 'Your verification code',
    html: `
      <p>Your verification code is: <strong>${code}</strong></p>
      <p>This code expires in 10 minutes.</p>
    `
  });
  
  return { sent: true };
}

export async function verifyPageOtp(visitToken: string, code: string): Promise<{ valid: boolean }> {
  const stored = await storage.pageOtpCodes.getLatest(visitToken);
  
  if (!stored || stored.expiresAt < new Date() || stored.code !== code) {
    return { valid: false };
  }
  
  // Mark visit as OTP verified
  await storage.pageVisits.updateByToken(visitToken, {
    otpVerifiedAt: new Date()
  });
  
  // Delete used code
  await storage.pageOtpCodes.delete(stored.id);
  
  return { valid: true };
}
```

### 6.5 Page Builder UI Components

```typescript
// Frontend component structure

// client/src/pages/page-builder/PageBuilder.tsx
// - Main page builder interface
// - Left sidebar: component palette
// - Main area: page canvas with sections/rows/columns
// - Right sidebar: selected component editor

// client/src/components/page-builder/ComponentPalette.tsx
// - Draggable list of 14 component types
// - Grouped by category (Basic, Advanced, Actions)

// client/src/components/page-builder/PageCanvas.tsx
// - Renders sections as containers
// - Each section has rows
// - Each row has up to 4 columns
// - Drop zones for component placement

// client/src/components/page-builder/ComponentEditor.tsx
// - Dynamic form based on component type
// - Content schema editing
// - Styling options
// - Action selection for buttons

// client/src/components/page-builder/ActionEditor.tsx
// - Configure action type and behaviour
// - Task creation settings
// - Notification settings
// - OTP requirement toggle
```

### 6.6 Testing Access - Phase 3

To test Phase 3 features:
1. Navigate to the root page
2. Click the "Passwords" tab
3. Login with: **admin@example.com** / **admin123**
4. Access Page Builder from campaign creation or standalone via menu

### 6.7 Success Criteria - Phase 3

- [ ] Page builder UI allows creating/editing all 14 component types
- [ ] Grid layout works (sections → rows → columns with responsive)
- [ ] All component content schemas validate correctly
- [ ] Merge fields work in page content
- [ ] Tracking tokens uniquely identify recipients
- [ ] Page visits logged with view counts
- [ ] All 8 action types execute correctly
- [ ] OTP flow works (send code, verify, allow action)
- [ ] Action logs created for all actions
- [ ] Staff notifications sent for interested/callback actions
- [ ] Tasks created when configured
- [ ] Communications logged for client timeline

### 6.7 Test Cases - Phase 3

```
1. Page Builder Tests
   - Create page with each component type
   - Arrange components in grid layout
   - Edit component content
   - Preview page with sample recipient

2. Page Rendering Tests
   - Valid token renders page
   - Invalid token returns error
   - Expired page returns error
   - Merge fields replaced correctly
   - Status widget shows real data

3. Action Tests
   - Interested action creates task + notification
   - OTP-required action prompts for verification
   - OTP verification allows action
   - Action log created
   - Engagement score updated

4. E2E Page Flow
   - Create campaign with page
   - Send campaign
   - Click link in email
   - View page
   - Complete action
   - Verify task created
   - Verify timeline updated
```

---

## 7. Phase 4: Multi-Step Campaigns (Sequences)

### 7.1 Sequence Data Model

Sequences use the existing `campaigns` table with:
- `isSequence = true` for parent campaign
- `parentCampaignId` links steps to parent
- `sequenceOrder` defines step order
- `sequenceCondition` defines trigger

```typescript
interface SequenceCondition {
  type: 'no_open' | 'no_click' | 'no_action' | 'action_completed' | 'time_elapsed';
  waitDays: number;
  actionType?: string;  // For action_completed/no_action
}
```

### 7.2 Sequence Execution Service

```typescript
// server/services/campaigns/campaignSequenceService.ts

export async function processSequenceProgression(): Promise<void> {
  // Called by cron daily
  
  // Find all active sequences
  const sequences = await storage.campaigns.getActiveSequences();
  
  for (const sequence of sequences) {
    await processSequence(sequence);
  }
}

async function processSequence(parentCampaign: Campaign): Promise<void> {
  const steps = await storage.campaigns.getSequenceSteps(parentCampaign.id);
  
  for (const step of steps) {
    if (step.status !== 'approved') continue;
    
    const condition = step.sequenceCondition as SequenceCondition;
    
    // Find recipients from previous step who meet condition
    const previousStep = steps.find(s => s.sequenceOrder === step.sequenceOrder - 1);
    if (!previousStep) continue;
    
    const eligibleRecipients = await findEligibleRecipientsForStep(
      previousStep,
      step,
      condition
    );
    
    if (eligibleRecipients.length > 0) {
      // Create recipient records for this step
      await storage.campaignRecipients.bulkCreateForStep(step.id, eligibleRecipients);
      
      // Queue for delivery
      await queueCampaignForDelivery(step.id);
    }
  }
}

async function findEligibleRecipientsForStep(
  previousStep: Campaign,
  currentStep: Campaign,
  condition: SequenceCondition
): Promise<CampaignRecipient[]> {
  const previousRecipients = await storage.campaignRecipients.getByCampaignId(previousStep.id);
  const eligible: CampaignRecipient[] = [];
  
  const waitThreshold = subDays(new Date(), condition.waitDays);
  
  for (const recipient of previousRecipients) {
    // Skip if already received this step
    const alreadyReceived = await storage.campaignRecipients.exists(currentStep.id, recipient.personId);
    if (alreadyReceived) continue;
    
    // Check if sent long enough ago
    if (recipient.sentAt && recipient.sentAt > waitThreshold) continue;
    
    // Check condition
    let meetsCondition = false;
    
    switch (condition.type) {
      case 'no_open':
        meetsCondition = !recipient.openedAt;
        break;
      
      case 'no_click':
        meetsCondition = !recipient.clickedAt;
        break;
      
      case 'no_action':
        const hasAction = await storage.pageActionLogs.existsForRecipient(recipient.id);
        meetsCondition = !hasAction;
        break;
      
      case 'action_completed':
        const actionCompleted = await storage.pageActionLogs.existsForRecipient(
          recipient.id, 
          condition.actionType
        );
        meetsCondition = actionCompleted;
        break;
      
      case 'time_elapsed':
        meetsCondition = true;  // Just wait for time
        break;
    }
    
    if (meetsCondition) {
      eligible.push(recipient);
    }
  }
  
  return eligible;
}
```

### 7.3 Sequence UI

```typescript
// Campaign creation extended for sequences

// Step 1: Choose campaign type
// - Single send
// - Sequence (multi-step)

// For sequences:
// - Add step button
// - Each step has:
//   - Condition (what triggers this step)
//   - Wait days
//   - Message content
// - Visual timeline of steps
// - Can edit/reorder steps
```

### 7.4 Testing Access - Phase 4

To test Phase 4 features:
1. Navigate to the root page
2. Click the "Passwords" tab
3. Login with: **admin@example.com** / **admin123**
4. Create a new campaign and select "Sequence" type

### 7.5 Success Criteria - Phase 4

- [ ] Sequence parent campaign created with steps
- [ ] Each step has condition and wait period
- [ ] Cron processes sequences daily
- [ ] Recipients who don't open move to step 2
- [ ] Recipients who click/act are excluded from further steps
- [ ] Sequence analytics show per-step performance
- [ ] Can pause/cancel entire sequence

### 7.5 Test Cases - Phase 4

```
1. Sequence Creation
   - Create 3-step sequence
   - Step 1: Initial email
   - Step 2: No open after 3 days
   - Step 3: No click after 5 days

2. Sequence Execution
   - Send step 1 to 100 recipients
   - Wait 3 days (mock time)
   - 60 didn't open → should receive step 2
   - 40 opened → should NOT receive step 2
   - Wait 5 more days
   - Of the 60, 30 didn't click → receive step 3

3. Sequence Termination
   - Recipient clicks on step 2 → excluded from step 3
   - Recipient completes action → excluded from all future steps
```

---

## 8. Phase 5: Analytics & Polish

### 8.1 Engagement Score Calculation

```typescript
// server/services/campaigns/engagementScoreService.ts

const SCORE_WEIGHTS = {
  email_opened: 1,
  email_clicked: 2,
  sms_clicked: 2,
  page_viewed: 2,
  action_completed: 5,
  campaign_ignored: -1
};

export async function updateEngagementScore(
  clientId: string,
  event: keyof typeof SCORE_WEIGHTS
): Promise<void> {
  const current = await storage.clientEngagementScores.getByClientId(clientId);
  
  const updates: Partial<ClientEngagementScore> = {
    totalScore: (current?.totalScore || 0) + SCORE_WEIGHTS[event],
    lastEngagementAt: new Date(),
    consecutiveIgnored: 0  // Reset on any engagement
  };
  
  // Update specific counters
  switch (event) {
    case 'email_opened':
      updates.emailsOpened = (current?.emailsOpened || 0) + 1;
      break;
    case 'email_clicked':
      updates.emailsClicked = (current?.emailsClicked || 0) + 1;
      break;
    // ... etc
  }
  
  if (current) {
    await storage.clientEngagementScores.update(current.id, updates);
  } else {
    await storage.clientEngagementScores.create({ clientId, ...updates });
  }
}

// Cron job to mark ignored campaigns (run weekly)
export async function processIgnoredCampaigns(): Promise<void> {
  // Find campaigns sent 7+ days ago
  const campaigns = await storage.campaigns.getSentBefore(subDays(new Date(), 7));
  
  for (const campaign of campaigns) {
    const recipients = await storage.campaignRecipients.getNoEngagement(campaign.id);
    
    for (const recipient of recipients) {
      await updateEngagementScore(recipient.clientId, 'campaign_ignored');
      
      // Increment consecutive ignored
      await storage.clientEngagementScores.incrementIgnored(recipient.clientId);
    }
  }
}
```

### 8.2 Analytics Dashboard Queries

```typescript
// server/services/campaigns/campaignAnalyticsService.ts

export async function getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  const campaign = await storage.campaigns.getById(campaignId);
  const recipients = await storage.campaignRecipients.getByCampaignId(campaignId);
  
  const metrics = {
    totalRecipients: recipients.length,
    sent: recipients.filter(r => r.status === 'sent' || r.status === 'delivered').length,
    delivered: recipients.filter(r => r.status === 'delivered').length,
    bounced: recipients.filter(r => r.status === 'bounced').length,
    failed: recipients.filter(r => r.status === 'failed').length,
    opened: recipients.filter(r => r.openedAt).length,
    clicked: recipients.filter(r => r.clickedAt).length,
    actioned: 0  // Calculated below
  };
  
  // Get page actions if page attached
  if (campaign.pageId) {
    const actionLogs = await storage.pageActionLogs.getByCampaignRecipients(
      recipients.map(r => r.id)
    );
    metrics.actioned = new Set(actionLogs.map(a => a.recipientId)).size;
  }
  
  // Calculate rates
  const rates = {
    deliveryRate: metrics.sent > 0 ? (metrics.delivered / metrics.sent) * 100 : 0,
    openRate: metrics.delivered > 0 ? (metrics.opened / metrics.delivered) * 100 : 0,
    clickRate: metrics.delivered > 0 ? (metrics.clicked / metrics.delivered) * 100 : 0,
    actionRate: metrics.delivered > 0 ? (metrics.actioned / metrics.delivered) * 100 : 0,
    bounceRate: metrics.sent > 0 ? (metrics.bounced / metrics.sent) * 100 : 0
  };
  
  // Get breakdowns
  const byManager = await getBreakdownByManager(recipients);
  const byService = await getBreakdownByService(recipients, campaign);
  
  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      category: campaign.category,
      status: campaign.status,
      sentAt: campaign.sentAt
    },
    metrics,
    rates,
    breakdowns: {
      byManager,
      byService
    }
  };
}

async function getBreakdownByManager(recipients: CampaignRecipient[]): Promise<ManagerBreakdown[]> {
  const clientIds = [...new Set(recipients.map(r => r.clientId))];
  const clients = await storage.clients.getByIds(clientIds);
  
  const managerGroups = groupBy(clients, 'managerId');
  
  return Promise.all(Object.entries(managerGroups).map(async ([managerId, managerClients]) => {
    const manager = await storage.users.getById(managerId);
    const managerRecipients = recipients.filter(r => 
      managerClients.some(c => c.id === r.clientId)
    );
    
    return {
      managerId,
      managerName: manager?.firstName + ' ' + manager?.lastName,
      sent: managerRecipients.length,
      opened: managerRecipients.filter(r => r.openedAt).length,
      clicked: managerRecipients.filter(r => r.clickedAt).length
    };
  }));
}
```

### 8.3 Voice Channel Integration

```typescript
// server/services/campaigns/voiceDeliveryService.ts

export async function sendVoiceCall(recipient: CampaignRecipient): Promise<DeliveryResult> {
  const rendered = recipient.renderedContent;
  
  const response = await fetch(process.env.DIALORA_API_URL + '/calls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DIALORA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: recipient.channelAddress,
      script: rendered.voiceScript,
      callbackUrl: `${process.env.BASE_URL}/api/webhooks/dialora/campaign-events`,
      metadata: {
        campaignId: recipient.campaignId,
        recipientId: recipient.id
      },
      options: {
        voiceId: 'professional_uk_female',  // Configurable
        maxAttempts: 2,
        retryDelay: 3600  // 1 hour between attempts
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    return { success: false, error };
  }
  
  const data = await response.json();
  return { success: true, messageId: data.callId };
}

// Webhook handler
router.post('/dialora/campaign-events', async (req, res) => {
  const { callId, status, duration, transcript, metadata } = req.body;
  
  const recipientId = metadata.recipientId;
  const recipient = await storage.campaignRecipients.getById(recipientId);
  if (!recipient) return res.sendStatus(200);
  
  switch (status) {
    case 'answered':
      await storage.campaignRecipients.update(recipientId, {
        status: 'delivered',
        deliveredAt: new Date()
      });
      await logEngagementEvent(recipient.campaignId, recipientId, 'delivered', 'voice', {
        duration,
        transcript
      });
      break;
    
    case 'voicemail':
      await storage.campaignRecipients.update(recipientId, {
        status: 'delivered',
        deliveredAt: new Date()
      });
      await logEngagementEvent(recipient.campaignId, recipientId, 'delivered', 'voice', {
        type: 'voicemail'
      });
      break;
    
    case 'no_answer':
    case 'busy':
      await storage.campaignRecipients.update(recipientId, {
        status: 'failed',
        failureReason: status
      });
      break;
  }
  
  res.sendStatus(200);
});
```

### 8.4 Testing Access - Phase 5

To test Phase 5 features:
1. Navigate to the root page
2. Click the "Passwords" tab
3. Login with: **admin@example.com** / **admin123**
4. Access Campaign Analytics from campaign detail page or dashboard

### 8.5 Success Criteria - Phase 5

- [ ] Engagement scores calculate correctly
- [ ] Consecutive ignored counter works
- [ ] Campaign analytics show all metrics
- [ ] Breakdowns by manager and service work
- [ ] Voice calls send via Dialora.ai
- [ ] Voice webhooks update recipient status
- [ ] Dashboard loads < 2 seconds with 50 campaigns
- [ ] All E2E tests pass

### 8.5 Test Cases - Phase 5

```
1. Engagement Score Tests
   - Open email → score +1
   - Click email → score +2
   - Complete action → score +5
   - Ignore campaign 7 days → score -1
   - Consecutive ignored increments

2. Analytics Tests
   - New campaign shows 0 metrics
   - After sends: metrics populate
   - Rates calculate correctly
   - Manager breakdown accurate
   - Service breakdown accurate

3. Voice Tests
   - Voice call initiated
   - Answered webhook → delivered
   - Voicemail webhook → delivered
   - No answer webhook → failed
   - Transcript stored

4. Performance Tests
   - Load campaign list with 100 campaigns < 1s
   - Campaign detail with 5000 recipients < 2s
   - Targeting query with 10 filters < 2s
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

Each service function should have unit tests:
- Targeting query builder
- Recipient resolution
- Merge field replacement
- Component rendering
- Action handlers
- Engagement score calculation

### 9.2 Integration Tests

API routes tested with database:
- Campaign CRUD
- Target criteria operations
- Recipient resolution and preview
- Delivery queue processing
- Webhook handling
- Page rendering

### 9.3 E2E Tests (Playwright)

Full user flows:

```
Test 1: Create and Send Simple Email Campaign
1. Login as staff
2. Navigate to Campaigns
3. Click Create Campaign
4. Fill name and category
5. Add targeting filter (client type = company)
6. Preview recipients → verify count
7. Compose email message
8. Preview campaign
9. Confirm preview
10. Approve and send immediately
11. Verify campaign status = sent
12. Verify engagement events logged

Test 2: Create Campaign with Page
1-6. Same as above
7. Compose email with page link
8. Create page with text + button
9. Configure button action (interested)
10. Preview page
11. Send campaign
12. Navigate to page via tracking URL
13. Click interested button
14. Verify task created
15. Verify action logged

Test 3: Multi-Step Sequence
1. Create sequence campaign
2. Add step 2: no open after 3 days
3. Add step 3: no click after 5 days
4. Send step 1
5. Verify recipients received
6. Mock time forward 3 days
7. Run sequence processor
8. Verify step 2 sent to non-openers
```

### 9.4 Performance Tests

```
Test: Targeting Performance
- Create 5000 clients with varied data
- Create campaign with 10 filters
- Measure query time < 2 seconds

Test: Delivery Throughput
- Queue 1000 recipients
- Process delivery queue
- Measure: 100 emails/minute minimum

Test: Page Render Performance
- Page with 20 components
- Render time < 500ms
```

---

## 10. Success Criteria

### 10.1 Phase Completion Criteria

| Phase | Criteria |
|-------|----------|
| Phase 1 | All tables created, migrations run, storage layer works, preference centre functional |
| Phase 2 | Full campaign workflow works, all filters work, email/SMS delivery with retry, preview mandatory |
| Phase 3 | Page builder creates all 14 components, rendering works, all actions execute, OTP flow works |
| Phase 4 | Sequences create and execute, behaviour triggers work, per-step analytics |
| Phase 5 | Analytics dashboard complete, voice integration works, engagement scores calculate |

### 10.2 Overall Success Criteria

1. **Functional Completeness**
   - [ ] Staff can create campaign with 16 filter types
   - [ ] Staff can compose messages for email/SMS/voice
   - [ ] Staff can build pages with 14 component types
   - [ ] Campaigns send and track engagement
   - [ ] Sequences progress based on behaviour
   - [ ] Analytics show actionable metrics

2. **Reliability**
   - [ ] Failed deliveries retry automatically
   - [ ] No duplicate sends to same recipient
   - [ ] Opt-outs respected
   - [ ] All actions logged to client timeline

3. **Performance**
   - [ ] Targeting queries < 2 seconds for 10 filters
   - [ ] Page render < 500ms
   - [ ] Dashboard loads < 2 seconds
   - [ ] Delivery rate > 100/minute

4. **Usability**
   - [ ] Preview is mandatory and shows real data
   - [ ] Duplicate warnings visible
   - [ ] Clear workflow states
   - [ ] Accessible preference centre

---

## 11. File Structure Reference

```
shared/schema/campaigns/
├── tables.ts           # All campaign tables
├── enums.ts            # All enums
├── types.ts            # TypeScript types
├── schemas.ts          # Zod validation schemas
├── relations.ts        # Drizzle relations
└── index.ts

server/storage/campaigns/
├── campaignStorage.ts
├── campaignTemplateStorage.ts
├── campaignTargetStorage.ts
├── campaignRecipientStorage.ts
├── campaignMessageStorage.ts
├── campaignDeliveryStorage.ts
├── campaignEngagementStorage.ts
├── clientEngagementScoreStorage.ts
└── index.ts

server/storage/pages/
├── pageStorage.ts
├── pageTemplateStorage.ts
├── pageComponentStorage.ts
├── pageActionStorage.ts
├── pageVisitStorage.ts
├── pageActionLogStorage.ts
├── pageOtpStorage.ts
└── index.ts

server/storage/contacts/
├── contactPreferencesStorage.ts
└── index.ts

server/services/campaigns/
├── campaignTargetingService.ts
├── campaignRecipientService.ts
├── campaignWorkflowService.ts
├── campaignDeliveryService.ts
├── campaignSequenceService.ts
├── campaignAnalyticsService.ts
├── engagementScoreService.ts
└── index.ts

server/services/pages/
├── pageRenderService.ts
├── pageActionService.ts
├── pageOtpService.ts
└── index.ts

server/routes/
├── campaigns.ts
├── campaignTemplates.ts
├── pages.ts
├── pageTemplates.ts
├── contactPreferences.ts
└── webhooks/
    └── campaignWebhooks.ts

client/src/pages/campaigns/
├── CampaignList.tsx
├── CampaignCreate.tsx
├── CampaignDetail.tsx
├── CampaignAnalytics.tsx
└── CampaignTemplates.tsx

client/src/pages/page-builder/
├── PageBuilder.tsx
├── PagePreview.tsx
└── PageTemplates.tsx

client/src/components/campaigns/
├── TargetingBuilder.tsx
├── FilterPicker.tsx
├── FilterEditor.tsx
├── RecipientList.tsx
├── RecipientPreview.tsx
├── MessageComposer.tsx
├── MergeFieldPicker.tsx
├── CampaignPreview.tsx
├── WorkflowStepper.tsx
├── SequenceBuilder.tsx
└── AnalyticsCharts.tsx

client/src/components/page-builder/
├── ComponentPalette.tsx
├── PageCanvas.tsx
├── SectionEditor.tsx
├── ComponentRenderer.tsx
├── ComponentEditor.tsx
├── ActionEditor.tsx
└── OtpVerification.tsx

client/src/components/pages/
├── PublicPageRenderer.tsx
├── ComponentDisplay.tsx
└── ActionButton.tsx
```

---

*End of Implementation Specification*
