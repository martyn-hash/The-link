# Campaigns & Pages Module - Wave 2 Implementation Plan

**Document Version:** 1.0  
**Created:** December 2025  
**Status:** Ready for Implementation  
**Prerequisites:** Phase 1 Foundation Complete (see campaigns-pages-module-architecture.md)

---

## Critical Testing Requirements

### MANDATORY: Pre-Browser Test Protocol

**Before executing ANY browser-based test (`run_test` tool), the agent MUST:**

1. **Read and internalise `Core-Development-Principles/how-to-test.md`** - This document contains critical information about:
   - Readiness checks (`/healthz`, `/readyz`)
   - Boot ID stability verification
   - Dev login endpoint usage
   - Proxy error retry protocol
   
2. **Failure to follow how-to-test.md will result in false test failures** due to infrastructure timing issues being conflated with application bugs.

3. **Reference `Core-Development-Principles/Testing-Principles.md`** for atomic test structure requirements.

---

## Wave 2 Overview

Wave 2 completes the Campaigns & Pages module to production-ready status. All work follows the atomic testing principle: each unit of functionality must be tested in isolation before integration.

### Phases at a Glance

| Phase | Name | Focus | Dependencies |
|-------|------|-------|--------------|
| 2A | Atomic Filter Validation | All 17 targeting filters tested individually | None |
| 2B | Scheduling & Delivery Wiring | Cron jobs, queue processing, retries | 2A |
| 2C | Pages Operational | Layout rendering, all components, actions | None |
| 2D | Multi-Step Campaigns | Sequences, progression, conditions | 2A, 2B |
| 2E | Webhook & Tracking Verification | Opens, clicks, bounces, engagement | 2B |
| 2F | Production Readiness | Integration tests, polish, documentation | All |

---

## Phase 2A: Atomic Filter Validation

### Objective
Ensure every targeting filter correctly identifies matching clients. Each filter must be tested at the SQL/logic level before any UI integration.

### Filter Registry (17 Filters)

All filters are defined in `server/services/campaigns/campaignTargetingService.ts`.

#### Category 1: Client Profile
| # | Filter Type | Value Type | Operators | Test Cases Required |
|---|-------------|------------|-----------|---------------------|
| 1 | `client_manager` | user | in, not_in | Manager match, manager exclude, multiple managers |
| 2 | `has_tag` | tag | in, not_in | Tag exists, tag missing, multiple tags |

#### Category 2: Services
| # | Filter Type | Value Type | Operators | Test Cases Required |
|---|-------------|------------|-----------|---------------------|
| 3 | `has_service` | service | in | Single service, multiple services, inactive service excluded |
| 4 | `missing_service` | service | in | Service absent, service present (should fail) |
| 5 | `has_service_not_other` | service_pair | equals | Has A not B, has both (exclude), has neither (exclude) |

#### Category 3: Projects & Deadlines
| # | Filter Type | Value Type | Operators | Test Cases Required |
|---|-------------|------------|-----------|---------------------|
| 6 | `has_project_type` | project_type | in, not_in | Active project match, archived excluded, multiple types |
| 7 | `project_at_stage` | stage | equals | Stage match, wrong stage, project type + stage combo |
| 8 | `accounts_due_range` | date_range | within | Within 30 days, outside range, null dates |
| 9 | `confirmation_statement_due_range` | date_range | within | Within range, outside range |
| 10 | `vat_quarter_due_range` | date_range | within | VAT project due, no VAT project |
| 11 | `has_overdue_project` | boolean | equals | Overdue exists, no overdue |

#### Category 4: Data Completeness
| # | Filter Type | Value Type | Operators | Test Cases Required |
|---|-------------|------------|-----------|---------------------|
| 12 | `missing_utr` | boolean | equals | UTR null, UTR empty string, UTR present |
| 13 | `missing_auth_code` | boolean | equals | Auth code null, present |
| 14 | `missing_company_number` | boolean | equals | Company number null, present |
| 15 | `docs_outstanding_days` | number | equals | Docs outstanding > X days, no outstanding docs |

#### Category 5: Engagement
| # | Filter Type | Value Type | Operators | Test Cases Required |
|---|-------------|------------|-----------|---------------------|
| 16 | `opened_last_campaign` | boolean | equals | Opened true, opened false, no previous campaign |
| 17 | `clicked_last_campaign` | boolean | equals | Clicked true, clicked false |
| 18 | `portal_login_days` | days | within, not_within | Logged in within X days, not logged in |
| 19 | `engagement_score` | range | between | Score in range, score outside range |
| 20 | `consecutive_ignored` | number | gte | Ignored >= X, ignored < X |

### Automated Test Structure

Create: `server/tests/campaigns/targeting-filters.test.ts`

```typescript
// Test file structure
describe('Campaign Targeting Filters', () => {
  describe('Filter: has_service', () => {
    it('should match clients with active service', async () => {
      // Setup: Create client with active service
      // Action: Execute filter query
      // Assert: Client appears in results
    });
    
    it('should NOT match clients with inactive service', async () => {
      // Setup: Create client with inactive service
      // Action: Execute filter query
      // Assert: Client does NOT appear in results
    });
    
    it('should match clients with ANY of multiple services', async () => {
      // Setup: Create clients with different services
      // Action: Execute filter with array of service IDs
      // Assert: All matching clients appear
    });
  });
  
  // Repeat for each filter type...
});
```

### Test Data Requirements

Each filter test must:
1. Create isolated test data (clients, services, projects, etc.)
2. Execute the filter in isolation
3. Verify correct client IDs returned
4. Clean up test data (or use transaction rollback)

### Acceptance Criteria

- [ ] All 17+ filter types have automated tests
- [ ] Each filter has minimum 3 test cases (happy path, negative, edge case)
- [ ] Tests can run independently and in any order
- [ ] All tests pass with clean database state
- [ ] Filter combination (AND/OR groups) tested

---

## Phase 2B: Scheduling & Delivery Wiring

### Objective
Wire campaign delivery and scheduling into the cron-worker so campaigns actually send.

### Current Gap
The `server/cron-worker.ts` has **no campaign-related jobs**. The delivery service exists but is never invoked.

### Tasks

#### 2B.1: Delivery Queue Processor Cron Job
**File:** `server/cron-worker.ts`

Add scheduled job to process delivery queue:
```typescript
// Run every minute
schedule('* * * * *', async () => {
  const result = await processDeliveryQueue(100);
  if (result.processed > 0) {
    log(`[Campaign Delivery] Processed ${result.processed}, succeeded: ${result.succeeded}, failed: ${result.failed}`);
  }
});
```

**Test Cases:**
- Queue item processed successfully
- Failed item retried after delay
- Permanent failure after max attempts
- Campaign status transitions to 'sent' when queue empty

#### 2B.2: Scheduled Campaign Trigger
**File:** `server/cron-worker.ts` or new `server/campaign-scheduler.ts`

Add job to check for campaigns due to send:
```typescript
// Run every minute
schedule('* * * * *', async () => {
  const dueCampaigns = await campaignStorage.getDueForSending();
  for (const campaign of dueCampaigns) {
    await transitionCampaignStatus(campaign.id, 'sending', 'system');
    await queueCampaignForDelivery(campaign.id);
  }
});
```

**Test Cases:**
- Campaign with `scheduledFor` in past transitions to 'sending'
- Campaign with future `scheduledFor` is not triggered
- Already-sent campaign is not re-triggered

#### 2B.3: Sequence Progression Cron Job
**File:** `server/cron-worker.ts`

Add job to progress multi-step campaigns:
```typescript
// Run every 15 minutes
schedule('*/15 * * * *', async () => {
  const result = await processSequenceProgression();
  if (result.recipientsProgressed > 0) {
    log(`[Sequences] Progressed ${result.recipientsProgressed} recipients`);
  }
});
```

**Test Cases:**
- Recipients progress to step 2 after meeting condition
- Recipients who don't meet condition are not progressed
- Wait period enforced before progression

#### 2B.4: Retry Logic Verification

**Test Cases:**
- First failure: Retry scheduled in 60 seconds
- Second failure: Retry scheduled in 300 seconds
- Third failure: Marked as permanent failure
- Successful retry clears failure state

### Acceptance Criteria

- [ ] Delivery queue processes pending items automatically
- [ ] Scheduled campaigns trigger at scheduled time
- [ ] Sequence progression runs periodically
- [ ] Retry delays are correctly applied
- [ ] All cron jobs have error handling and logging

---

## Phase 2C: Pages Operational

### Objective
Ensure the Pages module is fully functional with row/column layouts and all 14 component types rendering correctly.

### Layout Implementation

#### Current State
- Schema supports `sectionIndex`, `rowIndex`, `columnIndex`, `columnSpan`
- `PageBuilder.tsx` exists with drag-and-drop
- `PageCanvas.tsx` exists but row/column rendering needs verification

#### 2C.1: Single Column Layout (Baseline)
First, verify single-column layout works end-to-end:

**Test Cases:**
- Add component to page
- Reorder components via drag-and-drop
- Delete component
- Save and reload - order preserved
- Preview mode shows components correctly

#### 2C.2: Row/Column Grid Layout
Implement full row/column support:

**Files to modify:**
- `client/src/pages/page-builder/PageCanvas.tsx` - Render grid structure
- `client/src/pages/page-builder/PageBuilder.tsx` - UI for adding rows/columns

**Implementation:**
```typescript
// PageCanvas should render:
// Section 1
//   Row 1: [Col1 span=2] [Col2 span=1] [Col3 span=1]
//   Row 2: [Col1 span=4]
// Section 2
//   Row 1: [Col1 span=2] [Col2 span=2]
```

**Test Cases:**
- Create row with multiple columns
- Set column span (1-4)
- Drag component into specific column
- Resize column span
- Delete row/column with components

### Component Rendering (14 Types)

Each component must render in both edit mode (PageBuilder) and view mode (public page).

**File:** `client/src/pages/page-builder/ComponentEditor.tsx` - Edit mode
**File:** `server/routes/pages/publicRoutes.ts` or new component - View mode

| # | Component | Edit Mode | View Mode | Test Cases |
|---|-----------|-----------|-----------|------------|
| 1 | `heading` | Text + level selector | Renders h1-h6 | Level 1-6, long text |
| 2 | `text_block` | Rich text editor | Renders HTML | Bold, italic, links |
| 3 | `image` | URL + alt + caption | Renders img | With/without caption |
| 4 | `button` | Label + action link | Clickable button | Link works, action fires |
| 5 | `spacer` | Height slider | Empty div with height | Various heights |
| 6 | `callout` | Type + title + message | Styled alert box | Info, warning, error types |
| 7 | `status_widget` | Toggle options | Dynamic client data | With/without data |
| 8 | `table` | Header + row editor | Renders table | Multiple rows, empty |
| 9 | `timeline` | Item list editor | Vertical timeline | Multiple items |
| 10 | `faq_accordion` | Q&A editor | Expandable sections | Click to expand |
| 11 | `comparison_table` | Multi-column editor | Comparison grid | 2-4 columns |
| 12 | `video_embed` | URL input | iframe embed | YouTube, Vimeo |
| 13 | `document_list` | Document picker | Download links | With/without docs |
| 14 | `form` | Field configuration | Input form | Submission works |

### Page Actions

**File:** `server/storage/pages/pageActionStorage.ts`, `client/src/pages/page-builder/ActionEditor.tsx`

| Action Type | Functionality | Test Cases |
|-------------|---------------|------------|
| `interested` | Mark interest, log to client | Click → logged |
| `book_call` | Calendar booking link | Opens booking |
| `request_extension` | Request deadline extension | Creates task |
| `confirm_details` | Confirm displayed data | Logs confirmation |
| `documents_uploaded` | Trigger when docs uploaded | Detection works |
| `custom_webhook` | Call external URL | Webhook fires |
| `change_project_stage` | Move project to stage | Stage changes |
| `create_task` | Create task for client | Task created |

### OTP Verification (If Required)

**File:** `server/services/pages/pageOtpService.ts`

For actions requiring identity verification:
- Generate 6-digit OTP
- Send via email/SMS
- Verify before action execution
- Expire after 10 minutes

### Acceptance Criteria

- [ ] Single column layout fully functional
- [ ] Row/column grid layout renders correctly
- [ ] All 14 component types render in edit and view mode
- [ ] Drag-and-drop reordering works
- [ ] Page actions trigger correctly
- [ ] Public page view renders with merge data

---

## Phase 2D: Multi-Step Campaigns

### Objective
Complete multi-step (sequence) campaign functionality for automated follow-ups.

### Current State
- `campaignSequenceService.ts` exists with progression logic
- Condition types defined: `no_open`, `no_click`, `no_action`, `action_completed`, `time_elapsed`
- NOT wired to cron-worker

### Tasks

#### 2D.1: Sequence Creation UI
**File:** `client/src/pages/campaign-wizard/CampaignWizard.tsx` or new sequence builder

- Toggle to make campaign a sequence
- Add steps with conditions
- Configure wait periods between steps
- Each step has its own message content

#### 2D.2: Step Progression Logic

**Test Cases (Automated):**
| Scenario | Condition | Wait | Expected |
|----------|-----------|------|----------|
| Recipient didn't open step 1 | `no_open` | 3 days | Progress to step 2 after 3 days |
| Recipient opened step 1 | `no_open` | 3 days | Do NOT progress |
| Recipient didn't click | `no_click` | 2 days | Progress to step 2 |
| Recipient took page action | `action_completed` | 0 days | Progress immediately |
| Time elapsed only | `time_elapsed` | 7 days | Progress after 7 days regardless |

#### 2D.3: Sequence UI Display
- Show all steps in campaign detail view
- Display per-step stats (sent, opened, clicked)
- Allow pausing/resuming entire sequence

### Acceptance Criteria

- [ ] Can create multi-step campaign with 2+ steps
- [ ] Each step has independent message content
- [ ] Progression conditions work correctly
- [ ] Wait periods enforced
- [ ] Sequence can be paused/resumed/cancelled
- [ ] Stats show per-step performance

---

## Phase 2E: Webhook & Tracking Verification

### Objective
Verify that email/SMS/voice engagement events are correctly captured via webhooks.

### Webhook Endpoints

**File:** `server/routes/campaigns/webhooks.ts`

| Endpoint | Provider | Events | Status |
|----------|----------|--------|--------|
| `/api/public/webhooks/campaigns/sendgrid` | SendGrid | delivered, open, click, bounce, unsubscribe | Coded |
| `/api/public/webhooks/campaigns/voodoosms` | VoodooSMS | delivered, failed | Coded |
| `/api/public/webhooks/campaigns/dialora` | Dialora.ai | completed, no_answer, failed | Coded |

### Testing Approach

Create test payloads simulating each provider's webhook format.

**SendGrid Test Cases:**
```bash
# Simulate email open
curl -X POST /api/public/webhooks/campaigns/sendgrid \
  -H "Content-Type: application/json" \
  -d '[{"event":"open","recipientId":"xxx","timestamp":123456}]'
```

| Event | Expected Database Update |
|-------|--------------------------|
| `delivered` | recipient.status = 'delivered', deliveredAt set |
| `open` | recipient.openedAt set, openCount incremented |
| `click` | recipient.clickedAt set, clickCount incremented |
| `bounce` | recipient.status = 'bounced', failureReason set |
| `unsubscribe` | recipient.status = 'opted_out' |

**VoodooSMS Test Cases:**
| Status | Expected |
|--------|----------|
| `delivered` | status = 'delivered' |
| `failed` | status = 'failed', reason logged |

**Dialora Test Cases:**
| Status | Expected |
|--------|----------|
| `completed` | status = 'delivered' |
| `no_answer` | status = 'failed' |

### Engagement Score Updates

After tracking events, verify engagement scores are updated:
- Opens increase score
- Clicks increase score more
- Bounces/failures decrease score

### Acceptance Criteria

- [ ] SendGrid webhook correctly updates all event types
- [ ] VoodooSMS webhook correctly updates delivery status
- [ ] Dialora webhook correctly updates call status
- [ ] Engagement events logged to `campaign_engagement` table
- [ ] Engagement scores recalculated after events
- [ ] Signature verification works for all providers

---

## Phase 2F: Production Readiness

### Objective
Final integration testing, polish, and documentation to prepare for production deployment.

### Integration Tests (End-to-End)

These require browser testing via `run_test` tool.

**CRITICAL: Before each test, read `Core-Development-Principles/how-to-test.md`**

#### Test Scenario 1: Simple Email Campaign
1. Create new campaign
2. Set targeting: clients with service "Annual Accounts"
3. Configure email message
4. Preview and confirm
5. Send immediately
6. Verify recipient receives email (check delivery status)

#### Test Scenario 2: Scheduled Campaign
1. Create campaign
2. Schedule for future time
3. Verify status = 'scheduled'
4. Simulate time passage (or advance scheduled time)
5. Verify campaign sends at scheduled time

#### Test Scenario 3: Multi-Step Chase
1. Create sequence with 2 steps
2. Step 1: Initial message
3. Step 2: Follow-up if no open after 3 days
4. Send step 1
5. Simulate 3 days passing
6. Verify step 2 sends to non-openers

#### Test Scenario 4: Page with Action
1. Create page with button action
2. Link to campaign
3. Send campaign
4. Click page link in email
5. Click action button
6. Verify action logged to client record

### Error Handling & Edge Cases

| Scenario | Expected Behaviour |
|----------|-------------------|
| SendGrid API key missing | Delivery fails with clear error |
| Invalid email address | Marked as bounced, not retried |
| Campaign with 0 recipients | Cannot proceed past targeting step |
| Page expired | Show expiry message |
| Recipient opted out mid-campaign | Excluded from remaining sends |

### Performance Considerations

- Large recipient lists (1000+): Batch processing
- Delivery queue: Rate limiting to avoid provider limits
- Preview generation: Cached for repeated views

### Logging & Monitoring

Ensure all campaign operations are logged:
- Campaign status transitions
- Delivery attempts and results
- Webhook events received
- Error conditions

### Documentation Updates

- [ ] Update `replit.md` with campaign module architecture
- [ ] Document all API endpoints in code comments
- [ ] Add troubleshooting guide for common issues

### Final Checklist

Before declaring production-ready:

- [ ] All Phase 2A filter tests pass
- [ ] All Phase 2B delivery tests pass
- [ ] All Phase 2C component tests pass
- [ ] All Phase 2D sequence tests pass
- [ ] All Phase 2E webhook tests pass
- [ ] Integration tests pass
- [ ] Error handling verified
- [ ] Logging complete
- [ ] No console errors in browser
- [ ] Performance acceptable for 1000+ recipients

---

## Implementation Order Recommendation

```
Week 1: Phase 2A (Filters)
├── Days 1-2: Write automated test framework
├── Days 3-4: Implement tests for filters 1-10
└── Day 5: Implement tests for filters 11-17, fix any failures

Week 2: Phase 2B (Scheduling) + Phase 2C (Pages)
├── Days 1-2: Wire cron jobs, test delivery
├── Days 3-4: Complete row/column layout
└── Day 5: Test all 14 page components

Week 3: Phase 2D (Sequences) + Phase 2E (Webhooks)
├── Days 1-2: Complete sequence UI and progression
├── Days 3-4: Webhook testing and verification
└── Day 5: Integration testing

Week 4: Phase 2F (Production Readiness)
├── Days 1-3: End-to-end testing, bug fixes
├── Day 4: Documentation and polish
└── Day 5: Final review and sign-off
```

---

## Appendix A: Test Data Fixtures

For consistent testing, create these fixtures:

```typescript
// server/tests/fixtures/campaigns.ts
export const testClientWithServices = async () => {
  // Create client with specific services for filter testing
};

export const testClientWithProjects = async () => {
  // Create client with projects at specific stages
};

export const testCampaignRecipients = async () => {
  // Create campaign with known recipient states
};
```

---

## Appendix B: Environment Variables Required

| Variable | Purpose | Required For |
|----------|---------|--------------|
| `SENDGRID_API_KEY` | Email delivery | Phase 2B |
| `SENDGRID_FROM_EMAIL` | Sender address | Phase 2B |
| `SENDGRID_WEBHOOK_KEY` | Webhook verification | Phase 2E |
| `VOODOOSMS_API_KEY` | SMS delivery | Phase 2B |
| `VOODOOSMS_PASSWORD` | SMS delivery | Phase 2B |
| `VOODOOSMS_SENDER_ID` | SMS sender name | Phase 2B |
| `VOODOOSMS_WEBHOOK_SECRET` | Webhook verification | Phase 2E |
| `DIALORA_API_KEY` | Voice calls | Phase 2B |
| `DIALORA_AGENT_ID` | Voice agent | Phase 2B |
| `DIALORA_WEBHOOK_SECRET` | Webhook verification | Phase 2E |

---

## Appendix C: Key File Locations

| Purpose | File Path |
|---------|-----------|
| Targeting service | `server/services/campaigns/campaignTargetingService.ts` |
| Delivery service | `server/services/campaigns/campaignDeliveryService.ts` |
| Sequence service | `server/services/campaigns/campaignSequenceService.ts` |
| Workflow service | `server/services/campaigns/campaignWorkflowService.ts` |
| Merge field service | `server/services/campaigns/mergeFieldService.ts` |
| Campaign routes | `server/routes/campaigns.ts` |
| Webhook routes | `server/routes/campaigns/webhooks.ts` |
| Page routes | `server/routes/pages.ts` |
| Page builder UI | `client/src/pages/page-builder/PageBuilder.tsx` |
| Campaign wizard UI | `client/src/pages/campaign-wizard/CampaignWizard.tsx` |
| Cron worker | `server/cron-worker.ts` |
| Testing principles | `Core-Development-Principles/Testing-Principles.md` |
| How to test | `Core-Development-Principles/how-to-test.md` |
