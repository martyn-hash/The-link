# Bookkeeping Queries Feature - Technical Specification

**Created:** December 5, 2025  
**Status:** Planning  

---

## Executive Summary

This document outlines the implementation plan for a **Bookkeeping Queries** feature that eliminates the need for spreadsheet-based query management between bookkeepers, client managers, and clients.

### Current Problem
1. Bookkeeper encounters unclear transactions during bookkeeping work
2. Bookkeeper emails client manager an Excel file with queries
3. Client manager answers what they can, sends remaining to client
4. Client responds (often slowly, via email)
5. Client manager forwards responses back to bookkeeper
6. Multiple spreadsheet versions, email chains, and delays

### Solution
A unified query management system integrated into the project workflow that:
- Lives as a persistent tab on each project
- Allows queries to be added from any stage
- Supports manual entry and bulk CSV/Excel upload
- Provides a client-facing response portal (standalone, no login required)
- Integrates with existing notification system for automated chase reminders

---

## Data Model

### Core Tables

#### `bookkeeping_queries`

| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar (UUID) | Primary key |
| `projectId` | varchar | FK to projects table |
| `date` | timestamp | Transaction date |
| `description` | text | Transaction description |
| `moneyIn` | decimal(12,2) | Amount in (nullable) |
| `moneyOut` | decimal(12,2) | Amount out (nullable) |
| `hasVat` | boolean | Whether transaction includes VAT (nullable, typically set by CM or client) |
| `ourQuery` | text | The question being asked |
| `clientResponse` | text | Response from client manager or client (nullable) |
| `status` | enum | `open`, `answered_by_staff`, `sent_to_client`, `answered_by_client`, `resolved` |
| `createdById` | varchar | FK to users - who created the query |
| `answeredById` | varchar | FK to users - who answered (nullable) |
| `resolvedById` | varchar | FK to users - who marked resolved (nullable) |
| `sentToClientAt` | timestamp | When queries were sent to client (nullable) |
| `createdAt` | timestamp | Creation timestamp |
| `answeredAt` | timestamp | When answered (nullable) |
| `resolvedAt` | timestamp | When resolved (nullable) |

**Indexes:**
- `projectId` (most common lookup)
- `status` (for filtering)
- `createdById` (for "my queries" views)
- `sentToClientAt` (for chasing)

#### `query_response_tokens`

| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar (UUID) | Primary key |
| `projectId` | varchar | FK to projects - which project's queries |
| `token` | varchar(64) | Secure random token |
| `expiresAt` | timestamp | Token expiry (default: 14 days) |
| `accessedAt` | timestamp | First access time (nullable) |
| `completedAt` | timestamp | When client submitted responses (nullable) |
| `createdById` | varchar | FK to users - who sent the email |
| `recipientEmail` | varchar | Email address sent to |
| `recipientName` | varchar | Name of recipient |
| `queryCount` | integer | Number of queries sent |
| `createdAt` | timestamp | Creation timestamp |

**Indexes:**
- `token` (unique, for lookup)
- `projectId` (for audit trail)
- `expiresAt` (for cleanup)

#### `query_chase_reminders`

| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar (UUID) | Primary key |
| `tokenId` | varchar | FK to query_response_tokens |
| `scheduledFor` | timestamp | When to send the reminder |
| `channel` | enum | `email`, `sms` |
| `status` | enum | `scheduled`, `sent`, `cancelled` |
| `sentAt` | timestamp | Actual send time (nullable) |
| `cancelledAt` | timestamp | If cancelled (nullable) |
| `cancelledReason` | varchar | Why cancelled (e.g., "queries_answered") |
| `createdAt` | timestamp | Creation timestamp |

**Key Behavior:**
- Auto-cancelled when queries are answered
- Cron job checks for due reminders (same as existing notification cron)
- Links to existing VoodooSMS and SendGrid services

---

## Status Flow

```
┌─────────┐     Staff answers    ┌──────────────────┐     Staff resolves    ┌──────────┐
│  OPEN   │ ──────────────────►  │ ANSWERED_BY_STAFF │ ─────────────────────► │ RESOLVED │
└─────────┘                      └──────────────────┘                        └──────────┘
     │                                    │
     │ Send to client                     │ Send to client (still needs confirmation)
     ▼                                    ▼
┌─────────────────┐                ┌──────────────────┐
│ SENT_TO_CLIENT  │                │ (same status,    │
│                 │                │  forwarded)      │
└─────────────────┘                └──────────────────┘
     │
     │ Client responds
     ▼
┌──────────────────┐     Staff resolves    ┌──────────┐
│ANSWERED_BY_CLIENT│ ─────────────────────► │ RESOLVED │
└──────────────────┘                        └──────────┘
```

**Notes:**
- `OPEN` - Initial state, awaiting internal or external response
- `ANSWERED_BY_STAFF` - Client manager provided answer, bookkeeper can use it
- `SENT_TO_CLIENT` - Waiting for client response
- `ANSWERED_BY_CLIENT` - Client responded, may need verification before resolving
- `RESOLVED` - Query has been applied to bookkeeping, closed

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

**Database & API:**
- [ ] Create `bookkeeping_queries` table with migration
- [ ] Create storage interface (`queryStorage.ts`)
- [ ] API endpoints:
  - `GET /api/projects/:projectId/queries` - List queries
  - `POST /api/projects/:projectId/queries` - Create single query
  - `PATCH /api/queries/:id` - Update query (answer, resolve)
  - `DELETE /api/queries/:id` - Delete query
  - `POST /api/projects/:projectId/queries/bulk` - Bulk create from upload

**Frontend - Queries Tab:**
- [ ] Add "Queries" tab to project detail page
- [ ] Query list table with sorting/filtering
- [ ] Query creation form (single entry)
- [ ] Inline editing for answers and Has VAT toggle
- [ ] Status badge display with color coding
- [ ] Quick actions: Answer, Resolve, Delete

**UI Components:**
- [ ] `QueriesTab.tsx` - Main tab component
- [ ] `QueryRow.tsx` - Individual query display/edit
- [ ] `AddQueryForm.tsx` - Form for adding single query
- [ ] `QueryStatusBadge.tsx` - Status indicator

---

### Phase 2: Stage Integration & Bulk Operations (Week 2-3)

**Stage Change Integration:**
- [ ] Add "Add Queries" section to stage change form
- [ ] Quick-add query modal from stage change
- [ ] Show query count badge on project cards

**Bulk Import:**
- [ ] Excel/CSV upload component
- [ ] Column mapping interface
- [ ] Preview before import
- [ ] Error handling for invalid data
- [ ] Save column mapping preferences per user

**Column Mapping Logic:**
```typescript
const KNOWN_COLUMN_MAPPINGS = {
  date: ['date', 'transaction date', 'txn date', 'trans date'],
  description: ['description', 'narrative', 'details', 'transaction description'],
  moneyIn: ['money in', 'credit', 'income', 'received', 'cr'],
  moneyOut: ['money out', 'debit', 'expense', 'paid', 'dr'],
  ourQuery: ['our query', 'query', 'question', 'comments', 'notes'],
  hasVat: ['vat', 'has vat', 'vat?', 'includes vat'],
};
```

**Bulk Actions:**
- [ ] Select multiple queries
- [ ] Bulk resolve
- [ ] Bulk mark as sent to client
- [ ] Export to Excel/CSV

---

### Phase 3: Client Manager Workflow (Week 3-4)

**Answer Queries UI:**
- [ ] Inline response editing with rich text
- [ ] Has VAT toggle easily accessible
- [ ] "Mark as Answered" button
- [ ] Bulk answer similar queries

**Send to Client Flow:**
- [ ] "Send to Client" button (single or bulk)
- [ ] Generate secure token
- [ ] Open email composer with:
  - Pre-populated recipient (from client contacts)
  - Email template with query table
  - Personalized greeting
  - Link to response page
- [ ] Option: "Offer online completion" checkbox
- [ ] Track which queries were sent

**Email Template Variables:**
```
{client_name} - Client/company name
{query_count} - Number of outstanding queries
{project_name} - Project name
{response_link} - Secure link to respond
{sender_name} - Staff member's name
{firm_name} - Firm name
```

**Sample Email Template:**
```html
Dear {client_name},

We have {query_count} queries regarding transactions in your {project_name}.

[If online completion enabled:]
You can view and respond to these queries online:
<button>View & Respond to Queries</button>

[If not:]
Please see the queries below and respond to this email with your answers.

[Query Table]

Best regards,
{sender_name}
{firm_name}
```

---

### Phase 4: Client Response Page (Week 4-5)

**Secure Token System:**
- [ ] Generate cryptographically secure 64-char token
- [ ] Token lookup endpoint (no auth required)
- [ ] Validate expiry, track access
- [ ] Rate limiting to prevent abuse

**Standalone Response Page (`/queries/respond/:token`):**
- [ ] Token validation on load
- [ ] Expired token handling with friendly message
- [ ] No authentication required (token IS the auth)

**Desktop View:**
- [ ] Clean, professional layout matching firm branding
- [ ] Query table with:
  - Transaction date
  - Description
  - Amount (Money In/Out)
  - Our Query
  - Response input (textarea)
  - Has VAT toggle
- [ ] "Submit All Responses" button
- [ ] Thank you confirmation on submit

**Mobile View:**
- [ ] Swipeable card interface
- [ ] One query per screen
- [ ] Clear question display
- [ ] Easy text input
- [ ] VAT toggle
- [ ] Swipe right = answer & next
- [ ] Progress indicator (3 of 7)
- [ ] Submit when all answered

**Page Structure:**
```
┌─────────────────────────────────────────┐
│  [Firm Logo]                            │
│  Queries for [Client Name]              │
│  [Project Name]                         │
├─────────────────────────────────────────┤
│                                         │
│  Query 1 of 7                           │
│  ─────────────────                      │
│  Date: 15 Nov 2024                      │
│  Description: AMAZON PRIME *MS1234      │
│  Amount: £9.99 out                      │
│                                         │
│  Our Question:                          │
│  "What is this charge for? Is it       │
│   a business expense?"                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Your Response:                   │   │
│  │ [Text input area]                │   │
│  │                                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ☐ Includes VAT                        │
│                                         │
│  [← Previous]    [Next →]              │
│                                         │
├─────────────────────────────────────────┤
│  [Submit All Responses]                 │
└─────────────────────────────────────────┘
```

---

### Phase 5: Chase Reminders (Week 5-6)

**Integration with Existing Notification System:**

The existing system (`notification-sender.ts`, `notification-cron.ts`) already handles:
- Email via SendGrid
- SMS via VoodooSMS
- Scheduled notifications with hourly cron (07:00-19:00 UK time)

We'll extend this for query chasing.

**Configuration Options (per send-to-client action):**
- [ ] "Schedule SMS reminder" checkbox
- [ ] Time picker (default: 20:00 - catches business owners after hours)
- [ ] Delay dropdown: Same day, +1 day, +3 days, +7 days
- [ ] "Send email reminder" checkbox (similar options)

**Chase Reminder Schedule Example:**
1. Initial email sent: Monday 10:00
2. SMS reminder: Monday 20:00 (same evening)
3. Email follow-up: Thursday 09:00 (+3 days)
4. Final SMS: Next Monday 20:00 (+7 days)

**SMS Content (160 char limit):**
```
Hi {first_name}, we have {count} queries about your bookkeeping. 
Please respond here: {short_url}
- {firm_name}
```

**Short URL Approach:**
- Store full URL in database
- Generate short code (e.g., `/q/abc123`)
- Redirect endpoint that maps to full response URL
- Track click-through analytics

**Auto-Cancellation:**
- When client submits responses via portal, auto-cancel pending reminders
- Store cancellation reason: `queries_answered`
- Log for audit trail

**Reminder Cron Job Extension:**
Add to existing `notification-cron.ts`:
```typescript
// Process query chase reminders
const dueReminders = await storage.getDueQueryChaseReminders();
for (const reminder of dueReminders) {
  if (reminder.channel === 'sms') {
    await sendQueryChaseSMS(reminder);
  } else {
    await sendQueryChaseEmail(reminder);
  }
  await storage.markReminderSent(reminder.id);
}
```

---

### Phase 6: Notifications & Analytics (Week 6-7)

**Real-time Notifications:**
- [ ] When client submits responses:
  - Notify client manager (in-app + email)
  - Notify bookkeeper who created queries
- [ ] When all queries resolved:
  - Summary notification to project owner

**Project Card Indicators:**
- [ ] Badge showing query count: "5 queries"
- [ ] Color coding:
  - Green: All resolved
  - Amber: Awaiting client response
  - Red: Overdue (sent > 7 days, no response)

**Analytics (Future Enhancement):**
- Average response time per client
- Queries per project type
- Most common query categories
- Staff resolution rates

---

## Security Considerations

### Token Security
- 64-character cryptographically random tokens
- 14-day default expiry (configurable)
- Single-use option available
- Rate limiting: max 10 requests/minute per token
- IP logging for audit trail

### Data Exposure
- Response page shows ONLY queries for that project
- No other client data exposed
- No login credentials stored/transmitted
- HTTPS enforced

### Token Lifecycle
1. Generated when "Send to Client" clicked
2. Sent via email (not exposed in URL query params)
3. Valid for 14 days
4. Marked as accessed on first use
5. Marked as completed when responses submitted
6. Expired tokens show friendly "link expired" message with contact info

---

## API Endpoints Summary

### Project Queries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:projectId/queries` | List all queries for project |
| POST | `/api/projects/:projectId/queries` | Create single query |
| POST | `/api/projects/:projectId/queries/bulk` | Bulk create from upload |
| PATCH | `/api/queries/:id` | Update query |
| DELETE | `/api/queries/:id` | Delete query |
| POST | `/api/projects/:projectId/queries/send-to-client` | Generate token + prepare email |

### Token/Response Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/query-response/:token` | Validate token, get queries |
| POST | `/api/query-response/:token` | Submit client responses |
| GET | `/q/:shortCode` | Short URL redirect (for SMS) |

### Reminder Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/query-tokens/:tokenId/reminders` | List scheduled reminders |
| POST | `/api/query-tokens/:tokenId/reminders` | Schedule new reminder |
| DELETE | `/api/query-reminders/:id` | Cancel reminder |

---

## File Structure

```
server/
├── storage/
│   └── queries/
│       ├── queryStorage.ts           # Core query CRUD
│       ├── queryTokenStorage.ts       # Token management
│       └── queryReminderStorage.ts    # Chase reminder storage
├── routes/
│   └── queries.ts                     # API routes
├── query-reminder-service.ts          # Chase reminder logic
└── utils/
    └── queryColumnMapper.ts           # CSV/Excel column mapping

client/src/
├── pages/
│   ├── query-response.tsx             # Client response page
│   └── query-response-mobile.tsx      # Mobile swipeable view
├── components/
│   └── queries/
│       ├── QueriesTab.tsx             # Main project tab
│       ├── QueryRow.tsx               # Single query display
│       ├── AddQueryForm.tsx           # Manual entry form
│       ├── QueryBulkUpload.tsx        # CSV/Excel import
│       ├── QueryStatusBadge.tsx       # Status indicator
│       ├── SendToClientModal.tsx      # Email composer
│       └── QueryChaseScheduler.tsx    # Reminder scheduling UI

shared/schema/
└── queries/
    ├── tables.ts                      # Drizzle table definitions
    ├── schemas.ts                     # Zod validation schemas
    ├── types.ts                       # TypeScript types
    └── relations.ts                   # Table relations
```

---

## UI Mockups (Text-Based)

### Queries Tab on Project Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project: ABC Company - March 2024 Bookkeeping                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Overview] [History] [Messages] [Progress Notes] [★ Queries (7)]            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [+ Add Query]  [📤 Upload CSV/Excel]  [Filter ▼]   □ Select All           │
│                                                                             │
│  Selected: 3   [✓ Resolve]  [📧 Send to Client]                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ □ │ 15 Nov │ AMAZON PRIME *MS1234    │ £9.99 out │ ○ Open      │ ⋮ │   │
│  │   │        │ What is this for?       │           │             │   │   │
│  ├───┼────────┼─────────────────────────┼───────────┼─────────────┼───┤   │
│  │ ☑ │ 18 Nov │ TFL TRAVEL              │ £42.00 out│ ● Sent      │ ⋮ │   │
│  │   │        │ Business or personal?   │           │             │   │   │
│  ├───┼────────┼─────────────────────────┼───────────┼─────────────┼───┤   │
│  │ ☑ │ 22 Nov │ DEPOSIT - UNKNOWN       │ £500 in   │ ● Answered  │ ⋮ │   │
│  │   │        │ What is this income?    │           │ by client   │   │   │
│  │   │        │ → "Refund from supplier"│ □ VAT     │             │   │   │
│  ├───┼────────┼─────────────────────────┼───────────┼─────────────┼───┤   │
│  │ □ │ 25 Nov │ UBER *TRIP              │ £15.00 out│ ✓ Resolved  │ ⋮ │   │
│  │   │        │ Business meeting travel │ ☑ VAT     │             │   │   │
│  └───┴────────┴─────────────────────────┴───────────┴─────────────┴───┘   │
│                                                                             │
│  Showing 4 of 7 queries                              [← Previous] [Next →]  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Send to Client Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✉️ Send Queries to Client                                            [✕]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Sending 5 outstanding queries to client                                    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Recipient:                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ☑ John Smith (Director) - john@abccompany.com                       │   │
│  │ ☐ Sarah Jones (Accountant) - sarah@abccompany.com                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Subject:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Bookkeeping queries - ABC Company - March 2024                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Message:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [Rich Text Editor - TiptapEditor]                                   │   │
│  │                                                                     │   │
│  │ Dear John,                                                          │   │
│  │                                                                     │   │
│  │ We have 5 queries regarding transactions in your March 2024        │   │
│  │ bookkeeping that we need your input on.                            │   │
│  │                                                                     │   │
│  │ Please click the button below to view and respond:                 │   │
│  │                                                                     │   │
│  │ [View & Respond to Queries]                                        │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ☑ Allow online completion (include response link)                         │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  📱 Chase Reminders (Optional)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ☑ SMS reminder      After: [Same evening ▼]  Time: [20:00 ▼]        │   │
│  │ ☐ Email reminder    After: [+3 days ▼]       Time: [09:00 ▼]        │   │
│  │ ☐ Final SMS         After: [+7 days ▼]       Time: [20:00 ▼]        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                           [Cancel]  [Send to Client]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Timeline Summary

| Phase | Focus | Duration | Dependencies |
|-------|-------|----------|--------------|
| 1 | Core Infrastructure | 1-2 weeks | None |
| 2 | Stage Integration & Bulk Ops | 1 week | Phase 1 |
| 3 | Client Manager Workflow | 1 week | Phase 1, 2 |
| 4 | Client Response Page | 1-2 weeks | Phase 3 |
| 5 | Chase Reminders | 1 week | Phase 4, existing notification system |
| 6 | Notifications & Analytics | 1 week | Phase 5 |

**Total Estimated Time:** 6-8 weeks

---

## Success Metrics

- **Reduction in email volume** - Track emails tagged as "query" before/after
- **Query resolution time** - Average time from creation to resolved
- **Client response rate** - % of queries answered within 7 days
- **Mobile usage** - % of responses submitted via mobile
- **Chase reminder effectiveness** - Response rate with/without reminders

---

## Future Enhancements (Post-MVP)

1. **AI Query Suggestions** - Suggest common query types based on transaction patterns
2. **Template Queries** - Save and reuse common questions
3. **Query Categories** - Tag queries by type (VAT, expense classification, etc.)
4. **Client Portal Integration** - When portal migration complete (12-18 months)
5. **WhatsApp Integration** - Alternative to SMS for reminders
6. **Query Chat** - Real-time back-and-forth on individual queries

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Dec 5, 2025 | Queries at project level, not stage | Queries may span multiple stages; simpler mental model |
| Dec 5, 2025 | Standalone client response page | Clients on separate portal for 12-18 months |
| Dec 5, 2025 | Token-based auth for responses | No login friction; link IS the authentication |
| Dec 5, 2025 | Add Has VAT column | Business requirement - typically unknown at creation |
| Dec 5, 2025 | Integrate with existing notification system | Leverage proven SMS/email infrastructure |
| Dec 5, 2025 | Chase reminders as Phase 5 | Core functionality first, then enhancements |

---

## Open Questions

1. **Token Expiry Duration** - 14 days default, but should this be configurable per send?
2. **Multiple Response Submissions** - Allow clients to submit partial answers and come back?
3. **Query Editing After Send** - Can staff modify queries after sent to client?
4. **Audit Trail Depth** - How much history to retain? (All changes vs. just final state)
5. **White-labeling** - Should response page use firm's branding/colors?

---

## Appendix A: Database Migration SQL (Draft)

```sql
-- Enum for query status
CREATE TYPE query_status AS ENUM (
  'open',
  'answered_by_staff',
  'sent_to_client',
  'answered_by_client',
  'resolved'
);

-- Main queries table
CREATE TABLE bookkeeping_queries (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date TIMESTAMP,
  description TEXT,
  money_in DECIMAL(12,2),
  money_out DECIMAL(12,2),
  has_vat BOOLEAN,
  our_query TEXT NOT NULL,
  client_response TEXT,
  status query_status NOT NULL DEFAULT 'open',
  created_by_id VARCHAR NOT NULL REFERENCES users(id),
  answered_by_id VARCHAR REFERENCES users(id),
  resolved_by_id VARCHAR REFERENCES users(id),
  sent_to_client_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  answered_at TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX idx_queries_project_id ON bookkeeping_queries(project_id);
CREATE INDEX idx_queries_status ON bookkeeping_queries(status);
CREATE INDEX idx_queries_created_by_id ON bookkeeping_queries(created_by_id);

-- Response tokens
CREATE TABLE query_response_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  accessed_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_by_id VARCHAR NOT NULL REFERENCES users(id),
  recipient_email VARCHAR NOT NULL,
  recipient_name VARCHAR,
  query_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tokens_token ON query_response_tokens(token);
CREATE INDEX idx_tokens_project_id ON query_response_tokens(project_id);
CREATE INDEX idx_tokens_expires_at ON query_response_tokens(expires_at);

-- Chase reminders
CREATE TYPE reminder_channel AS ENUM ('email', 'sms');
CREATE TYPE reminder_status AS ENUM ('scheduled', 'sent', 'cancelled');

CREATE TABLE query_chase_reminders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id VARCHAR NOT NULL REFERENCES query_response_tokens(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMP NOT NULL,
  channel reminder_channel NOT NULL,
  status reminder_status NOT NULL DEFAULT 'scheduled',
  sent_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancelled_reason VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reminders_token_id ON query_chase_reminders(token_id);
CREATE INDEX idx_reminders_scheduled_for ON query_chase_reminders(scheduled_for);
CREATE INDEX idx_reminders_status ON query_chase_reminders(status);
```

---

## Appendix B: Short URL Implementation

For SMS messages where character count matters, we need short URLs.

**Approach:**
```
Full URL: https://flow.growth.accountants/queries/respond/abc123xyz789...
Short URL: https://flow.growth.accountants/q/Xk9m2P
```

**Database Addition:**
```sql
ALTER TABLE query_response_tokens ADD COLUMN short_code VARCHAR(8) UNIQUE;
```

**Generation:**
```typescript
function generateShortCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

**Route:**
```typescript
app.get('/q/:shortCode', async (req, res) => {
  const token = await storage.getTokenByShortCode(req.params.shortCode);
  if (!token || new Date() > token.expiresAt) {
    return res.redirect('/query-expired');
  }
  return res.redirect(`/queries/respond/${token.token}`);
});
```
