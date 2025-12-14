# Comms Workflow Planning - The Link

## Overview
Transform email from a passive inbox into an active, zero-backlog workflow where emails behave like micro-tasks.

---

## Stage Progress

### 1️⃣ Customer Gate (Hard Filter) ✅ COMPLETE
- Only ingest emails where sender/CC matches a client or known contact
- Dev override available for testing with full inbox

### 2️⃣ Deterministic Pre-Classification Layer ✅ COMPLETE
- Rules engine sets minimum handling floor before AI
- Question marks, request phrases, attachments, deadline phrases, acknowledgements
- Outputs: requires_task_floor, requires_reply_floor

### 3️⃣ AI Classification (OpenAI 4o-mini) ✅ COMPLETE
- Classifies: requires_task, requires_reply, sentiment, opportunity, urgency, information_only
- Merge logic between deterministic floor and AI output
- Most conservative result wins in conflicts

### 4️⃣ Comms Workspace – Toolbar & Slicing ✅ COMPLETE
- Toolbar buttons slice emails by classification
- Requires Task, Requires Reply, Urgent, Opportunities, Information Only, All/Outstanding

### 5️⃣ Email as Workflow (Micro-Tasks) ✅ COMPLETE
- Emails as micro-tasks that must be worked, not passively read
- Emails must be checked off to disappear
- Inbox goal = zero entries

### 6️⃣ Task Enforcement Rules ✅ COMPLETE
- If requires_task = true, email cannot be completed until:
  - User marks "no task required" OR
  - A task has been created and completed
- One-click "Create Task" with pre-populated form

### 7️⃣ Reply Enforcement ✅ COMPLETE
- If requires_reply = true, micro-task completes only when reply is sent
- Reply detection logic in place

### 8️⃣ SLA & Performance Tracking ✅ COMPLETE
- SLA tracking for all requires_reply = true emails
- Business hours calculation (08:00-18:00 UK time, excludes weekends)
- Breach detection cron job (runs every 15 minutes)
- Urgency badges with countdown timers

### 9️⃣ Manual Overrides & Auditability ✅ COMPLETE
- PATCH /api/comms/emails/:emailId/classification - Override with Zod validation
- GET /api/comms/emails/:emailId/classification/history - Audit trail
- UI in CommsWorkspace: edit button, checkboxes for task/reply/info-only, urgency dropdown
- Required reason field for all overrides
- Workflow state automatically re-evaluated after changes
- Audit log records: who, when, what changed, previous/new values

### 🔟 Retro Adding of Emails ✅ COMPLETE
- Ability to bring emails into system that didn't pass Customer Gate
- Query full inbox through Graph API
- Use case: client changes email, new person joins team
- Backend: GET /api/comms/inbox/:inboxId/browse, POST /api/comms/inbox/:inboxId/import
- Frontend: Import Emails dialog with search, date range, client selection, multi-import

---

## 1️⃣1️⃣ Final Testing Stage - Live Validation 🔄 TO DO

**Test Inbox:** abdul@growth.accountants

Before final sign-off, conduct live testing using Abdul's inbox to validate the complete pipeline:

### Testing Checklist:
1. **Customer Gate** - Verify client/contact matching is filtering correctly
2. **Deterministic Rules** - Check question marks, request phrases, attachments are caught
3. **AI Classification** - Review accuracy of requires_reply, requires_task, sentiment, urgency
4. **Urgency Badges** - Confirm SLA timers display correctly with business hours
5. **Breach Detection** - Let non-critical emails approach deadline to verify cron
6. **Reply Tracking** - Confirm reply detection completes micro-tasks
7. **Task Creation** - Test one-click task creation flow
8. **Manual Overrides** - Test adding/removing classifications
9. **Aggregation** - Review SLA stats by user/client/team

### Success Criteria:
- All email classifications are accurate (or have easy override)
- SLA timers use business hours correctly
- Breach detection triggers at correct times
- Zero-inbox workflow feels natural and productive

---

## Final Review Findings (December 2025)

### ✅ Stages Working Correctly
- **Stages 1-7**: Customer Gate, Deterministic Classification, AI Classification, Toolbar Slicing, Workflow Enforcement, Task Linking, Reply Tracking - all functioning as specified
- **Stage 9**: Manual Overrides with full audit trail - working correctly
- **Stage 10**: Retro Email Import - fully implemented with browse/import endpoints and UI

### ⚠️ Issue Found: SLA Business Hours (Stage 8)
**Problem**: SLA calculations default to 09:00-17:00 instead of 08:00-18:00 UK time as specified. Additionally, timezone handling doesn't explicitly apply `slaTimezone` setting, which could cause drift on non-UK servers.

**Impact**: SLA deadlines and urgency badges may calculate slightly off from spec.

**Fix Required**: Update `server/services/slaService.ts` to:
1. Default to 08:00-18:00 when settings are absent
2. Explicitly apply timezone conversion using `slaTimezone` (Europe/London)

### Improvement Opportunities
1. **Batch SLA checks**: Consider batching deadline checks for efficiency with large email volumes
2. **Caching**: Add caching for company settings in SLA calculations
3. **Monitoring**: Add metrics/logging for classification pipeline performance

---

## Next Up
**Stage 11: Live Validation Testing**

---

## 📋 Step-by-Step Testing Session Notes (December 2025)

### Test Inbox Setup - COMPLETE
- **Inbox**: abdul@growth.accountants
- **Inbox ID**: `9eb2b1a1-b026-4a05-ae0b-5f9e5daa07a0`
- **Access**: Full access granted to admin123 user
- **Mode**: Dev mode - NO customer gate (ingest all emails regardless of client matching)

### SLA Settings (from Company Settings)
- Working Hours: 09:00 - 17:30
- Working Days: Mon-Fri
- Response Target: 2 business days
- These are pulled from company_settings table, not hardcoded

### Manual Step-by-Step Testing Plan

The user wants to manually control each step of the classification pipeline to observe and validate behavior:

#### Step 1: Sync Emails from Abdul's Inbox
```
POST /api/comms/inbox/9eb2b1a1-b026-4a05-ae0b-5f9e5daa07a0/sync
```
- Fetches emails from Microsoft Graph API
- Stores in `inbox_emails` table
- **Dev mode**: Skip customer gate, ingest ALL emails

#### Step 2: Run Deterministic Classification Rules
Service: `server/services/deterministicClassificationService.ts`

Rules evaluated (in priority order):
1. DEADLINE_ASAP - "asap", "urgent", "immediately" → task_floor + reply_floor
2. DEADLINE_DATE - "by Monday", "due Friday" → reply_floor
3. REQUEST_CAN_YOU - "can you", "could you" → task_floor + reply_floor
4. REQUEST_PLEASE - "please advise/confirm/send" → task_floor + reply_floor
5. HAS_ATTACHMENTS - email has files → task_floor
6. QUESTION_MARK - contains "?" → reply_floor
7. ACKNOWLEDGEMENT_ONLY - "thanks", "noted", "got it" → clears both floors

Output: `requires_task_floor`, `requires_reply_floor`, `triggered_rules[]`

#### Step 3: Send to OpenAI (GPT-4o-mini)
Service: `server/services/aiClassificationService.ts`

AI receives:
- Subject, body preview, sender name
- Attachment info
- Thread position (first/reply/forward)
- Deterministic floor values (AI can raise but not lower)

AI returns:
- requires_task, requires_reply (merged with floors)
- sentiment: score (-1 to 1), label (very_negative → very_positive)
- opportunity: upsell/cross_sell/referral/expansion/retention_risk/testimonial
- urgency: critical/high/normal/low
- information_only: true/false
- confidence: 0-1
- reasoning: explanation

#### Step 4: Store Classification & Create Workflow State
Pipeline: `server/services/emailClassificationPipeline.ts`

Creates records in:
- `email_classifications` - stores all classification data
- `email_workflow_states` - tracks pending/completed status

#### Step 5: Calculate SLA Deadline (if requires_reply)
Service: `server/services/slaService.ts`

- Uses company settings for working hours
- Calculates deadline in business hours only
- Skips weekends per working_days setting
- Stores deadline in `inbox_emails.sla_deadline`

#### Step 6: Display in UI
Component: `client/src/components/comms/CommsWorkspace.tsx`

- Toolbar filters by classification (Requires Task, Reply, Urgent, etc.)
- Urgency badges show countdown timers
- Complete button enforces task/reply requirements

### Key API Endpoints for Testing

```
# Sync inbox
POST /api/comms/inbox/:inboxId/sync

# Get stored emails with classifications
GET /api/comms/inbox/:inboxId/stored-emails

# Get workflow-filtered emails
GET /api/comms/inbox/:inboxId/workflow-emails?filter=requires_task|requires_reply|urgent|opportunities|information_only|completed

# Classify/re-classify a specific email
POST /api/comms/emails/:emailId/classify

# Get classification for email
GET /api/comms/emails/:emailId/classification

# Override classification (with audit)
PATCH /api/comms/emails/:emailId/classification
Body: { changes: {...}, reason: "..." }

# Get override history
GET /api/comms/emails/:emailId/classification/history

# Complete an email (mark as done)
POST /api/comms/inbox-emails/:emailId/complete

# Link task to email
PATCH /api/comms/inbox-emails/:emailId/link-task
Body: { taskId: "..." }
```

### Key Files Reference

| Component | File Path |
|-----------|-----------|
| Classification Pipeline | `server/services/emailClassificationPipeline.ts` |
| Deterministic Rules | `server/services/deterministicClassificationService.ts` |
| AI Classification | `server/services/aiClassificationService.ts` |
| SLA Service | `server/services/slaService.ts` |
| Email Routes | `server/routes/emails.ts` |
| Email Storage | `server/storage/integrations/emailStorage.ts` |
| CommsWorkspace UI | `client/src/components/comms/CommsWorkspace.tsx` |
| Import Dialog | `client/src/components/comms/ImportEmailsDialog.tsx` |

### Database Tables

| Table | Purpose |
|-------|---------|
| `inboxes` | Registered email inboxes |
| `user_inbox_access` | User permissions for inboxes |
| `inbox_emails` | Stored emails with SLA deadlines |
| `email_classifications` | AI + deterministic classification results |
| `email_workflow_states` | Workflow tracking (pending/completed) |
| `email_classification_overrides` | Audit trail of manual changes |
| `email_quarantine` | Emails that didn't pass customer gate |

### Notes for Resuming

1. Abdul's inbox is already created and accessible
2. User wants NO customer gate during dev testing - all emails should be ingested
3. User wants to control each step manually to observe behavior
4. After sync, can manually trigger classification via API or let pipeline run automatically
5. Company settings already configure SLA hours (09:00-17:30) - no code change needed
