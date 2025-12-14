# Communications Workflow System - Technical Planning Document

## Document Information
- **Project**: The Link - Communications Workflow System
- **Version**: 1.0
- **Status**: Planning Phase
- **Author**: Replit Agent
- **Date**: December 2024

---

## Testing Credentials (CRITICAL)
**All implementation steps MUST be tested using these credentials:**
- Navigate to: Root page → Passwords tab
- Email: `admin@example.com`
- Password: `admin123`

**Rule**: EVERY stage must be tested before marking complete.

---

## OpenAI Integration Notes
- The Link uses its own OpenAI API connection
- API keys are stored in **secrets** (not environment variables)
- Model to use: `gpt-4o-mini` for classification

---

# Executive Summary

Transform email from a passive inbox into an active, zero-backlog workflow system where emails behave like micro-tasks. The primary outcome is enabling users to allocate focused, productive time to communications with the explicit goal of reducing the Comms view to zero entries by consciously working and completing email-tasks.

**This is workflow management, not inbox management.**

---

# Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EMAIL INGESTION LAYER                            │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────────────────┐ │
│  │ Microsoft   │───▶│ Customer Gate   │───▶│ Quarantine (non-client)  │ │
│  │ Graph API   │    │ (Hard Filter)   │    └──────────────────────────┘ │
│  └─────────────┘    └────────┬────────┘                                  │
│                              │ ✓ Client Match                            │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    CLASSIFICATION PIPELINE                         │  │
│  │  ┌─────────────────────┐    ┌─────────────────────────────────┐  │  │
│  │  │ Deterministic Layer │───▶│ AI Classification (4o-mini)     │  │  │
│  │  │ (Rules Engine)      │    │ + Merge Logic                   │  │  │
│  │  └─────────────────────┘    └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW STATE MACHINE                           │
│  ┌─────────┐   ┌──────────┐   ┌────────────┐   ┌──────────────────────┐ │
│  │ Pending │──▶│ Working  │──▶│ Blocked    │──▶│ Complete             │ │
│  │         │   │          │   │ (Task/Reply│   │                      │ │
│  └─────────┘   └──────────┘   │ Required)  │   └──────────────────────┘ │
│                               └────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          COMMS WORKSPACE UI                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Toolbar: [Requires Task] [Requires Reply] [Urgent] [Opportunities]│   │
│  │          [Information Only] [All Outstanding]                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Email Micro-Task List                         │   │
│  │  □ Email from John - Requires Task ⚠️ Requires Reply             │   │
│  │  □ Email from Sarah - Information Only                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Data Flow (High Level)

```
1. EMAIL RECEIVED (via Graph API sync)
         │
         ▼
2. CUSTOMER GATE CHECK
   ├─ Match sender/CC against client contacts
   ├─ Dev Override: If enabled, bypass gate
   └─ No Match → Quarantine
         │
         ▼ (Match Found)
3. DETERMINISTIC PRE-CLASSIFICATION
   ├─ Apply rules engine
   ├─ Set floor values:
   │   - requires_task_floor
   │   - requires_reply_floor
   └─ Record triggered rules
         │
         ▼
4. AI CLASSIFICATION (OpenAI 4o-mini)
   ├─ Send minimal JSON payload
   ├─ Receive classifications
   └─ Merge with deterministic floor (most conservative wins)
         │
         ▼
5. STORE CLASSIFIED EMAIL
   ├─ Create email_workflow record
   ├─ Set initial state: PENDING
   └─ Calculate SLA deadline (if requires_reply)
         │
         ▼
6. DISPLAY IN COMMS WORKSPACE
   ├─ User works email as micro-task
   ├─ Completion rules enforced
   └─ State transitions tracked
         │
         ▼
7. COMPLETION & ARCHIVAL
   ├─ Mark as complete
   ├─ Update SLA metrics
   └─ Remove from active view
```

---

# Stage 1: Customer Gate (Hard Filter)

## Purpose
Ensure only relevant client-related emails enter the workflow system.

## Matching Logic

### Primary Match Rules
```
EMAIL PASSES IF:
  - sender.email matches ANY client.email
  - sender.email matches ANY contact.email WHERE contact.clientId IS NOT NULL
  - ANY cc.email matches ANY client.email
  - ANY cc.email matches ANY contact.email WHERE contact.clientId IS NOT NULL
```

### Match Priority
1. Exact email match (case-insensitive)
2. Domain match with verified client domains (from `client_domain_allowlist` table)

### Dev Override Mode
```typescript
interface DevOverrideSettings {
  enabled: boolean;           // Toggle in company_settings
  userIds: string[];          // Specific users allowed to use override
  bypassGate: boolean;        // If true, ALL emails pass through
  logOverrides: boolean;      // Track when override is used
}
```

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Forwarded emails | Check original sender in email headers if available |
| Shared inboxes | Match against inbox-specific contact lists |
| BCC recipients | Not visible - cannot match |
| Auto-replies | Detect via headers, mark as `information_only` |
| Distribution lists | Match individual addresses in expanded list |
| Email aliases | Store multiple email addresses per contact |

## Database Schema Additions
```sql
-- Quarantined emails (non-matching)
CREATE TABLE email_quarantine (
  id UUID PRIMARY KEY,
  inbox_id UUID REFERENCES inboxes(id),
  microsoft_id VARCHAR NOT NULL,
  from_address VARCHAR NOT NULL,
  to_recipients JSONB,
  cc_recipients JSONB,
  subject VARCHAR,
  received_at TIMESTAMP,
  quarantine_reason VARCHAR, -- 'no_client_match', 'no_contact_match'
  restored_at TIMESTAMP,     -- Set when retro-added
  restored_by UUID,          -- User who restored
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dev override settings
ALTER TABLE company_settings ADD COLUMN 
  email_dev_override JSONB DEFAULT '{"enabled": false}';
```

## Success Criteria
- [ ] Emails from known clients pass through gate
- [ ] Emails from unknown senders are quarantined
- [ ] Dev override allows all emails when enabled
- [ ] Override usage is logged for audit

## Testing Steps
1. Login: Root page → Passwords tab → admin@example.com | admin123
2. Navigate to Comms workspace
3. Sync emails from an inbox
4. Verify client-matched emails appear in list
5. Verify non-client emails are quarantined
6. Enable dev override in settings
7. Sync again - verify all emails now appear
8. Check quarantine log for non-client emails

---

# Stage 2: Deterministic Pre-Classification Layer

## Purpose
Apply explainable, deterministic rules before any AI processing to establish minimum handling requirements.

## Rules Engine

### Rule Definitions
```typescript
interface DeterministicRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | string[];
  field: 'subject' | 'body' | 'attachments' | 'sender';
  sets: {
    requires_task_floor?: boolean;
    requires_reply_floor?: boolean;
  };
  priority: number; // Higher = more important
}

const DETERMINISTIC_RULES: DeterministicRule[] = [
  // Question Detection
  {
    id: 'QUESTION_MARK',
    name: 'Contains Question',
    description: 'Email body or subject contains question marks',
    pattern: /\?/,
    field: 'body',
    sets: { requires_reply_floor: true },
    priority: 10
  },
  
  // Explicit Request Phrases
  {
    id: 'REQUEST_CAN_YOU',
    name: 'Request: Can you',
    description: 'Contains explicit request phrase',
    pattern: /\b(can you|could you|would you|will you)\b/i,
    field: 'body',
    sets: { requires_reply_floor: true, requires_task_floor: true },
    priority: 20
  },
  {
    id: 'REQUEST_PLEASE',
    name: 'Request: Please',
    description: 'Contains please + action verb',
    pattern: /\bplease\s+(advise|confirm|send|provide|let me know|update|review|check)\b/i,
    field: 'body',
    sets: { requires_reply_floor: true, requires_task_floor: true },
    priority: 20
  },
  
  // Attachment Detection
  {
    id: 'HAS_ATTACHMENTS',
    name: 'Has Attachments',
    description: 'Email includes file attachments',
    pattern: null, // Special handling
    field: 'attachments',
    sets: { requires_task_floor: true },
    priority: 15
  },
  
  // Deadline Detection
  {
    id: 'DEADLINE_ASAP',
    name: 'Deadline: ASAP',
    description: 'Contains urgent deadline language',
    pattern: /\b(asap|urgent|urgently|immediately|right away)\b/i,
    field: 'body',
    sets: { requires_reply_floor: true, requires_task_floor: true },
    priority: 30
  },
  {
    id: 'DEADLINE_DATE',
    name: 'Deadline: Specific Date',
    description: 'Contains date references',
    pattern: /\b(by|before|due|deadline)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|\d{1,2}\/\d{1,2}|\d{1,2}(st|nd|rd|th))\b/i,
    field: 'body',
    sets: { requires_reply_floor: true },
    priority: 25
  },
  
  // Acknowledgement Only (Negative Rule)
  {
    id: 'ACKNOWLEDGEMENT_ONLY',
    name: 'Acknowledgement Only',
    description: 'Email is a simple acknowledgement',
    pattern: /^(thanks|thank you|noted|all good|got it|received|perfect|great|ok|okay|cheers|ta|thx)[\.\!\s]*$/i,
    field: 'body',
    sets: { requires_reply_floor: false, requires_task_floor: false },
    priority: 5
  }
];
```

### Rule Evaluation Output
```typescript
interface DeterministicResult {
  requires_task_floor: boolean;
  requires_reply_floor: boolean;
  triggered_rules: {
    ruleId: string;
    ruleName: string;
    matchedText?: string;
    explanation: string;
  }[];
  evaluated_at: Date;
}
```

### Processing Logic
```
FOR EACH email:
  1. Initialize floors: requires_task_floor = false, requires_reply_floor = false
  2. FOR EACH rule (ordered by priority descending):
     - Evaluate pattern against appropriate field
     - IF match:
       - Set floor values (floors can only be raised, never lowered)
       - Record triggered rule with explanation
  3. Return DeterministicResult
```

## Success Criteria
- [ ] All rules are evaluated in priority order
- [ ] Floors are never downgraded once set
- [ ] Triggered rules are recorded with explanations
- [ ] Acknowledgement-only emails correctly identified
- [ ] Deadline phrases correctly detected

## Testing Steps
1. Login: Root page → Passwords tab → admin@example.com | admin123
2. Create test emails with various patterns:
   - Email with "?" → verify requires_reply_floor = true
   - Email with "please confirm" → verify both floors true
   - Email with attachment → verify requires_task_floor = true
   - Email with just "Thanks!" → verify both floors false
3. Check that triggered rules are logged
4. Verify no false positives on common phrases

---

# Stage 3: AI Classification (OpenAI 4o-mini)

## Purpose
Provide nuanced, context-aware classification beyond deterministic rules.

## API Integration

### Request Payload (Minimal JSON)
```typescript
interface AIClassificationRequest {
  email_id: string;
  subject: string;
  body_preview: string;      // First 500 chars, stripped of signatures
  from_name: string;
  has_attachments: boolean;
  attachment_names?: string[];
  thread_position: 'first' | 'reply' | 'forward';
  deterministic_result: {
    requires_task_floor: boolean;
    requires_reply_floor: boolean;
    triggered_rules: string[];
  };
}
```

### AI Classification Response
```typescript
interface AIClassificationResponse {
  requires_task: boolean;
  requires_reply: boolean;
  sentiment: {
    score: number;           // -1.0 to 1.0
    label: SentimentLabel;
  };
  opportunity: OpportunityType | null;
  urgency: UrgencyLevel;
  information_only: boolean;
  confidence: number;        // 0.0 to 1.0
  reasoning: string;         // Brief explanation
}

type SentimentLabel = 
  | 'very_negative'    // -1.0 to -0.6
  | 'negative'         // -0.6 to -0.2
  | 'neutral'          // -0.2 to 0.2
  | 'positive'         // 0.2 to 0.6
  | 'very_positive';   // 0.6 to 1.0

type OpportunityType =
  | 'upsell'           // Client might want additional services
  | 'cross_sell'       // Related service opportunity
  | 'referral'         // Client mentions someone who might need services
  | 'expansion'        // Business growth = more work
  | 'retention_risk'   // Dissatisfaction signals
  | 'testimonial'      // Happy client = potential case study
  | null;              // No opportunity detected

type UrgencyLevel =
  | 'critical'         // Immediate action required
  | 'high'             // Same-day response needed
  | 'normal'           // Standard SLA applies
  | 'low';             // No time pressure
```

### System Prompt for OpenAI
```
You are an email classification assistant for an accounting/bookkeeping firm.

Classify the email with the following rules:
1. requires_task: TRUE if the email requests work, documents, or deliverables
2. requires_reply: TRUE if the sender expects a response
3. sentiment: Score from -1.0 to 1.0, with label
4. opportunity: Identify any commercial opportunities (upsell, cross_sell, referral, expansion, retention_risk, testimonial) or null
5. urgency: critical/high/normal/low based on deadline signals
6. information_only: TRUE if email is purely informational with no action needed

CRITICAL RULE: If information_only = true, then requires_task and requires_reply MUST be false.

Consider the deterministic analysis already performed. You may RAISE classification levels but never LOWER them below the floor values provided.

Respond in JSON format only.
```

### Merge Logic
```typescript
function mergeClassifications(
  deterministic: DeterministicResult,
  ai: AIClassificationResponse
): FinalClassification {
  return {
    // Most conservative result wins (OR logic for floors)
    requires_task: deterministic.requires_task_floor || ai.requires_task,
    requires_reply: deterministic.requires_reply_floor || ai.requires_reply,
    
    // AI-only fields
    sentiment: ai.sentiment,
    opportunity: ai.opportunity,
    urgency: ai.urgency,
    
    // Special handling for information_only
    // Can only be true if BOTH deterministic AND AI agree no action needed
    information_only: ai.information_only && 
                      !deterministic.requires_task_floor && 
                      !deterministic.requires_reply_floor,
    
    // Audit trail
    deterministic_rules: deterministic.triggered_rules,
    ai_confidence: ai.confidence,
    ai_reasoning: ai.reasoning,
    merged_at: new Date()
  };
}
```

## Database Schema
```sql
CREATE TABLE email_classifications (
  id UUID PRIMARY KEY,
  email_id UUID REFERENCES inbox_emails(id),
  
  -- Final merged values
  requires_task BOOLEAN NOT NULL DEFAULT false,
  requires_reply BOOLEAN NOT NULL DEFAULT false,
  sentiment_score DECIMAL(3,2),
  sentiment_label VARCHAR(20),
  opportunity VARCHAR(50),
  urgency VARCHAR(20) DEFAULT 'normal',
  information_only BOOLEAN DEFAULT false,
  
  -- Deterministic layer
  deterministic_task_floor BOOLEAN,
  deterministic_reply_floor BOOLEAN,
  triggered_rules JSONB,
  
  -- AI layer
  ai_task BOOLEAN,
  ai_reply BOOLEAN,
  ai_confidence DECIMAL(3,2),
  ai_reasoning TEXT,
  ai_raw_response JSONB,
  
  -- Manual overrides
  override_by UUID REFERENCES users(id),
  override_at TIMESTAMP,
  override_reason TEXT,
  override_changes JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Success Criteria
- [ ] AI receives minimal, stripped-down payload
- [ ] AI response parsed correctly
- [ ] Merge logic applies most conservative result
- [ ] information_only exclusivity rule enforced
- [ ] Classifications stored with full audit trail

## Testing Steps
1. Login: Root page → Passwords tab → admin@example.com | admin123
2. Sync emails to trigger classification pipeline
3. Verify deterministic rules run first
4. Check AI API is called with correct payload
5. Verify merge logic:
   - If deterministic sets floor, AI cannot lower it
   - If AI raises classification, it's applied
6. Test information_only exclusivity:
   - Email with "Thanks!" only → information_only = true
   - Email with "Thanks! Can you also..." → information_only = false
7. Check all classifications are stored in database

---

# Stage 4: Comms Workspace - Toolbar & Slicing

## Purpose
Provide prominent, workflow-oriented view controls (not buried sidebar filters).

## Toolbar Design

### Button Specifications
```typescript
interface ToolbarButton {
  id: string;
  label: string;
  icon: LucideIcon;
  filter: EmailFilter;
  badge?: {
    count: number;
    variant: 'default' | 'destructive' | 'warning';
  };
  tooltip: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  {
    id: 'requires_task',
    label: 'Requires Task',
    icon: CheckSquare,
    filter: { requires_task: true, completed: false },
    badge: { count: 0, variant: 'destructive' },
    tooltip: 'Emails that need a task created'
  },
  {
    id: 'requires_reply',
    label: 'Requires Reply',
    icon: Reply,
    filter: { requires_reply: true, replied: false, completed: false },
    badge: { count: 0, variant: 'warning' },
    tooltip: 'Emails awaiting your response'
  },
  {
    id: 'urgent',
    label: 'Urgent',
    icon: AlertTriangle,
    filter: { urgency: ['critical', 'high'], completed: false },
    badge: { count: 0, variant: 'destructive' },
    tooltip: 'Time-sensitive emails'
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    icon: TrendingUp,
    filter: { opportunity: ['upsell', 'cross_sell', 'referral', 'expansion'] },
    badge: { count: 0, variant: 'default' },
    tooltip: 'Commercial opportunities detected'
  },
  {
    id: 'information_only',
    label: 'Info Only',
    icon: Info,
    filter: { information_only: true, completed: false },
    badge: { count: 0, variant: 'default' },
    tooltip: 'Read-only emails, no action needed'
  },
  {
    id: 'all_outstanding',
    label: 'All Outstanding',
    icon: Inbox,
    filter: { completed: false },
    badge: { count: 0, variant: 'default' },
    tooltip: 'All emails not yet completed'
  }
];
```

### UI Layout
```
┌─────────────────────────────────────────────────────────────────────────┐
│ COMMS WORKSPACE                                          [Inbox ▼] [⟳] │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────┐│
│ │ Requires │ │ Requires │ │  Urgent  │ │Opportun- │ │Info Only │ │All ││
│ │  Task 🔴 │ │ Reply 🟠 │ │    🔴    │ │ ities    │ │          │ │Out ││
│ │    (5)   │ │   (12)   │ │   (2)    │ │   (3)    │ │   (8)    │ │(30)││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────┘│
├─────────────────────────────────────────────────────────────────────────┤
│ [Search emails...]                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ EMAIL LIST                           │ EMAIL DETAIL                     │
│                                      │                                  │
```

### Badge Count Queries
```sql
-- Requires Task count
SELECT COUNT(*) FROM email_classifications ec
JOIN inbox_emails ie ON ec.email_id = ie.id
JOIN email_workflow_state ews ON ie.id = ews.email_id
WHERE ec.requires_task = true 
  AND ews.task_requirement_met = false
  AND ews.state != 'completed';

-- Requires Reply count
SELECT COUNT(*) FROM email_classifications ec
JOIN inbox_emails ie ON ec.email_id = ie.id
JOIN email_workflow_state ews ON ie.id = ews.email_id
WHERE ec.requires_reply = true 
  AND ews.reply_sent = false
  AND ews.state != 'completed';
```

## Success Criteria
- [ ] Toolbar buttons are prominently displayed above email list
- [ ] Each button shows accurate count badge
- [ ] Clicking button filters email list immediately
- [ ] Active button is visually highlighted
- [ ] Counts update in real-time after actions

## Testing Steps
1. Login: Root page → Passwords tab → admin@example.com | admin123
2. Navigate to Comms workspace
3. Verify all 6 toolbar buttons are visible
4. Verify badge counts match actual email counts
5. Click each button and verify correct filtering:
   - "Requires Task" shows only emails needing tasks
   - "Urgent" shows only critical/high urgency
6. Complete an email and verify counts decrease
7. Test that multiple filters can't be active simultaneously

---

# Stage 5: Email as Workflow (Micro-Tasks)

## Purpose
Present emails as actionable work items that must be explicitly completed, not passively read.

## Email Workflow State Machine

```
                    ┌─────────────────┐
                    │     PENDING     │
                    │  (Just arrived) │
                    └────────┬────────┘
                             │ User opens email
                             ▼
                    ┌─────────────────┐
                    │     WORKING     │
                    │  (In progress)  │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
   ┌─────────────┐  ┌─────────────────┐  ┌─────────────┐
   │   BLOCKED   │  │  BLOCKED_TASK   │  │ BLOCKED_BOTH│
   │  (Reply     │  │  (Task needed)  │  │ (Both need) │
   │   needed)   │  │                 │  │             │
   └──────┬──────┘  └────────┬────────┘  └──────┬──────┘
          │                  │                  │
          │ Reply sent       │ Task done        │ Both done
          ▼                  ▼                  ▼
                    ┌─────────────────┐
                    │    COMPLETED    │
                    │  (Disappears)   │
                    └─────────────────┘
```

## Database Schema
```sql
CREATE TABLE email_workflow_state (
  id UUID PRIMARY KEY,
  email_id UUID REFERENCES inbox_emails(id) UNIQUE,
  
  -- Current state
  state VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- 'pending', 'working', 'blocked_reply', 'blocked_task', 'blocked_both', 'completed'
  
  -- Requirement tracking
  requires_task BOOLEAN DEFAULT false,
  requires_reply BOOLEAN DEFAULT false,
  
  -- Completion tracking
  task_requirement_met BOOLEAN DEFAULT false,
  task_id UUID REFERENCES tasks(id),           -- If task created
  task_marked_not_needed BOOLEAN DEFAULT false, -- If user said no task needed
  task_marked_not_needed_by UUID,
  task_marked_not_needed_at TIMESTAMP,
  
  reply_sent BOOLEAN DEFAULT false,
  reply_message_id VARCHAR,                    -- Microsoft message ID of reply
  reply_sent_at TIMESTAMP,
  
  -- Timestamps
  first_opened_at TIMESTAMP,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Completion Rules Engine
```typescript
function canEmailBeCompleted(email: EmailWorkflowState): CompletionCheck {
  const blockers: string[] = [];
  
  // Check task requirement
  if (email.requires_task) {
    if (!email.task_requirement_met && !email.task_marked_not_needed) {
      if (!email.task_id) {
        blockers.push('Task required: Create a task or mark "No task needed"');
      } else {
        // Task exists but not completed
        const task = getTask(email.task_id);
        if (task.status !== 'completed') {
          blockers.push('Task required: Complete the linked task first');
        }
      }
    }
  }
  
  // Check reply requirement
  if (email.requires_reply && !email.reply_sent) {
    blockers.push('Reply required: Send a reply to complete this email');
  }
  
  return {
    canComplete: blockers.length === 0,
    blockers,
    state: calculateState(email)
  };
}
```

## UI Presentation

### Email List Item
```
┌─────────────────────────────────────────────────────────────────┐
│ □ John Smith - RE: Monthly accounts query                       │
│   "Can you please confirm the VAT treatment for..."            │
│   ⚠️ Requires Task  💬 Requires Reply  🔴 Urgent                │
│   Received: 2 hours ago                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Completion Attempt UI
```
┌─────────────────────────────────────────────────────────────────┐
│ Complete Email                                          [X]     │
├─────────────────────────────────────────────────────────────────┤
│ ⚠️ This email cannot be completed yet:                          │
│                                                                 │
│ □ Task required: Create a task or mark "No task needed"        │
│   [Create Task] [No Task Needed]                                │
│                                                                 │
│ □ Reply required: Send a reply to complete this email          │
│   [Compose Reply]                                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [Cancel] [Complete When Ready]     │
└─────────────────────────────────────────────────────────────────┘
```

## Success Criteria
- [ ] Emails display as checkbox items
- [ ] Completion blockers prevent premature completion
- [ ] Clear visual indicators of what's blocking
- [ ] One-click actions to resolve blockers
- [ ] Completed emails disappear from active list
- [ ] Goal: Zero entries in Comms view

## Testing Steps
1. Login: Root page → Passwords tab → admin@example.com | admin123
2. Find email with requires_task = true
3. Try to complete it → verify blocker message appears
4. Click "No Task Needed" → verify email can now complete
5. Find email with requires_reply = true
6. Try to complete it → verify reply blocker message
7. Send a reply → verify email automatically completes
8. Verify completed emails no longer appear in list

---

# Stage 6: Task Enforcement Rules

## Purpose
Ensure emails requiring tasks cannot be dismissed without explicit action.

## Task Creation Flow

### One-Click Task Creation
```typescript
interface TaskPrePopulation {
  // Auto-populated from email
  clientId: string;              // From matched client
  clientName: string;
  title: string;                 // AI-suggested from email subject/content
  description: string;           // AI-generated summary
  suggestedDueDate?: Date;       // Inferred from deadline phrases
  relatedEmailId: string;        // Link back to email
  
  // User can modify
  assigneeId?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  projectId?: string;            // Optional project link
}
```

### AI Task Suggestion Prompt
```
Given this email, suggest a task:
- Title: Brief, actionable (max 80 chars)
- Description: Key details and any deadlines mentioned
- Due date: If deadline mentioned, extract it. Otherwise null.

Email subject: {{subject}}
Email body: {{body_preview}}
Sender: {{from_name}}
Client: {{client_name}}
```

### Task Creation UI
```
┌─────────────────────────────────────────────────────────────────┐
│ Create Task from Email                                   [X]    │
├─────────────────────────────────────────────────────────────────┤
│ Client: [ACME Corporation                            ▼]         │
│                                                                 │
│ Title:  [Prepare VAT return breakdown                  ]        │
│                                                                 │
│ Description:                                                    │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ John requested a breakdown of VAT treatment for Q3.        ││
│ │ He needs this by Friday for their board meeting.           ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Due Date: [2024-12-20    ] ⚠️ Deadline detected in email        │
│                                                                 │
│ Assign to: [Current User                             ▼]         │
│                                                                 │
│ Priority:  ○ Low  ● Normal  ○ High  ○ Urgent                   │
│                                                                 │
│ 📧 Linked to: Email from John Smith (2 hours ago)              │
├─────────────────────────────────────────────────────────────────┤
│                                     [Cancel] [Create Task]      │
└─────────────────────────────────────────────────────────────────┘
```

### "No Task Needed" Flow
```typescript
interface NoTaskNeededAction {
  emailId: string;
  userId: string;
  reason?: string;              // Optional explanation
  timestamp: Date;
}

// Store for audit
async function markNoTaskNeeded(action: NoTaskNeededAction) {
  await db.update(emailWorkflowState)
    .set({
      task_marked_not_needed: true,
      task_marked_not_needed_by: action.userId,
      task_marked_not_needed_at: action.timestamp,
      task_requirement_met: true  // Requirement is now satisfied
    })
    .where(eq(emailWorkflowState.emailId, action.emailId));
    
  // Log for audit
  await createAuditLog({
    action: 'email_task_dismissed',
    entityType: 'email',
    entityId: action.emailId,
    userId: action.userId,
    details: { reason: action.reason }
  });
}
```

## Database Schema Additions
```sql
-- Link tasks to emails
ALTER TABLE tasks ADD COLUMN source_email_id UUID REFERENCES inbox_emails(id);
ALTER TABLE tasks ADD COLUMN source_type VARCHAR(50); -- 'email', 'project', 'manual'

-- Index for finding email-linked tasks
CREATE INDEX idx_tasks_source_email ON tasks(source_email_id) WHERE source_email_id IS NOT NULL;
```

## Success Criteria
- [ ] Task creation pre-populates from email data
- [ ] AI suggests appropriate title and description
- [ ] Deadline detection extracts dates from email
- [ ] Created task links back to source email
- [ ] "No Task Needed" satisfies requirement
- [ ] All dismissals are logged for audit
- [ ] Task completion triggers email completion check

## Testing Steps
1. Login: Root page → Passwords tab → admin@example.com | admin123
2. Find email classified as requires_task = true
3. Click "Create Task" button
4. Verify pre-populated fields:
   - Client matches email sender's client
   - Title is AI-suggested
   - Due date extracted if present
5. Create the task
6. Verify task appears in Tasks workspace with email link
7. Complete the task
8. Return to email → verify it can now be completed
9. Test "No Task Needed" flow:
   - Find another requires_task email
   - Click "No Task Needed"
   - Verify email can now be completed
   - Check audit log for dismissal record

---

# Stage 7: Reply Enforcement

## Purpose
Ensure emails requiring replies cannot be completed until a reply is actually sent.

## Reply Detection Logic

### Method 1: Microsoft Graph Tracking
```typescript
interface ReplyDetection {
  // When user sends reply via The Link
  method: 'direct';
  sentVia: 'the_link';
  messageId: string;
  conversationId: string;
  sentAt: Date;
}

// OR

interface ReplyDetection {
  // When reply detected via Graph sync
  method: 'graph_sync';
  sentVia: 'outlook' | 'mobile' | 'other';
  messageId: string;
  conversationId: string;
  detectedAt: Date;
}
```

### Reply Detection Algorithm
```typescript
async function detectReplyToEmail(originalEmail: InboxEmail): Promise<boolean> {
  // 1. Check if reply sent directly via The Link
  const directReply = await db.query.sentEmails.findFirst({
    where: eq(sentEmails.inReplyTo, originalEmail.microsoftId)
  });
  if (directReply) return true;
  
  // 2. Check conversation thread for newer outgoing messages
  const conversationMessages = await graphClient
    .getConversationMessages(originalEmail.conversationId);
  
  const ourMailboxEmails = conversationMessages.filter(msg => 
    msg.from.address === inboxEmail && 
    new Date(msg.sentDateTime) > new Date(originalEmail.receivedAt)
  );
  
  return ourMailboxEmails.length > 0;
}
```

### Auto-Complete on Reply
```typescript
// After sending a reply
async function onReplySent(originalEmailId: string, replyMessageId: string) {
  const workflowState = await getEmailWorkflowState(originalEmailId);
  
  await db.update(emailWorkflowState)
    .set({
      reply_sent: true,
      reply_message_id: replyMessageId,
      reply_sent_at: new Date()
    })
    .where(eq(emailWorkflowState.emailId, originalEmailId));
    
  // Check if email can now auto-complete
  const canComplete = await canEmailBeCompleted(originalEmailId);
  if (canComplete) {
    await markEmailCompleted(originalEmailId);
  }
}
```

## Reply Composition UI Integration
When composing a reply to a requires_reply email:
```
┌─────────────────────────────────────────────────────────────────┐
│ 💬 This email requires a reply. Sending will mark it complete. │
└─────────────────────────────────────────────────────────────────┘
```

## Success Criteria
- [ ] Reply requirement detected from classification
- [ ] Direct replies (via The Link) tracked
- [ ] External replies (via Outlook/mobile) detected via sync
- [ ] Reply automatically marks email as replied
- [ ] Email auto-completes when reply is the only blocker
- [ ] Conversation threading works correctly

## Testing Steps
1. Login: Root page → Passwords tab → admin@example.com | admin123
2. Find email with requires_reply = true
3. Try to complete → verify reply blocker shown
4. Click "Compose Reply"
5. Send the reply
6. Verify:
   - reply_sent = true in database
   - Email automatically completes (if no task blocker)
7. Test external reply detection:
   - Reply to an email from Outlook/mobile
   - Trigger sync in The Link
   - Verify reply is detected and email updates

---

# Stage 8: SLA & Performance Tracking

## Purpose
Track response times for accountability and performance improvement.

## SLA Definitions
```typescript
interface SLAConfiguration {
  // Default SLA times (in business hours)
  default_reply_sla_hours: number;           // e.g., 24
  
  // Priority-based SLA
  urgent_reply_sla_hours: number;            // e.g., 4
  high_reply_sla_hours: number;              // e.g., 8
  normal_reply_sla_hours: number;            // e.g., 24
  low_reply_sla_hours: number;               // e.g., 48
  
  // Business hours definition
  business_hours_start: string;              // "09:00"
  business_hours_end: string;                // "17:30"
  business_days: number[];                   // [1,2,3,4,5] Mon-Fri
  timezone: string;                          // "Europe/London"
}
```

## Database Schema
```sql
CREATE TABLE email_sla_tracking (
  id UUID PRIMARY KEY,
  email_id UUID REFERENCES inbox_emails(id) UNIQUE,
  
  -- SLA calculation
  received_at TIMESTAMP NOT NULL,
  sla_deadline TIMESTAMP NOT NULL,
  urgency_level VARCHAR(20),                 -- Used to determine SLA
  
  -- Response tracking
  first_response_at TIMESTAMP,
  response_time_minutes INTEGER,             -- Calculated
  
  -- Breach detection
  is_breached BOOLEAN DEFAULT false,
  breached_at TIMESTAMP,
  breach_minutes INTEGER,                    -- How far past deadline
  
  -- Aggregation helpers
  owner_user_id UUID REFERENCES users(id),   -- Who was responsible
  client_id UUID REFERENCES clients(id),
  team_id UUID,                              -- For team aggregation
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for reporting
CREATE INDEX idx_sla_owner ON email_sla_tracking(owner_user_id, is_breached);
CREATE INDEX idx_sla_client ON email_sla_tracking(client_id, is_breached);
CREATE INDEX idx_sla_date ON email_sla_tracking(received_at);
```

## SLA Calculation Logic
```typescript
function calculateSLADeadline(
  receivedAt: Date, 
  urgency: UrgencyLevel,
  config: SLAConfiguration
): Date {
  const slaHours = {
    critical: config.urgent_reply_sla_hours,
    high: config.high_reply_sla_hours,
    normal: config.normal_reply_sla_hours,
    low: config.low_reply_sla_hours
  }[urgency];
  
  return addBusinessHours(receivedAt, slaHours, config);
}

function addBusinessHours(
  startDate: Date, 
  hours: number, 
  config: SLAConfiguration
): Date {
  // Implementation considers:
  // - Business hours only
  // - Weekend exclusion
  // - UK bank holidays (optional)
  // Returns deadline timestamp
}
```

## Reporting Aggregations

### By User
```sql
SELECT 
  u.id,
  u.display_name,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE NOT s.is_breached) as within_sla,
  COUNT(*) FILTER (WHERE s.is_breached) as breached,
  ROUND(AVG(s.response_time_minutes)) as avg_response_mins,
  ROUND(100.0 * COUNT(*) FILTER (WHERE NOT s.is_breached) / COUNT(*), 1) as sla_percentage
FROM email_sla_tracking s
JOIN users u ON s.owner_user_id = u.id
WHERE s.received_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.display_name
ORDER BY sla_percentage DESC;
```

### By Client
```sql
SELECT 
  c.id,
  c.name,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE s.is_breached) as breached_count,
  ROUND(AVG(s.response_time_minutes)) as avg_response_mins
FROM email_sla_tracking s
JOIN clients c ON s.client_id = c.id
WHERE s.received_at >= NOW() - INTERVAL '30 days'
GROUP BY c.id, c.name
ORDER BY breached_count DESC;
```

## Breach Alerts
```typescript
// Run every 15 minutes via cron
async function checkForSLABreaches() {
  const aboutToBreach = await db.query.emailSlaTracking.findMany({
    where: and(
      isNull(emailSlaTracking.firstResponseAt),
      lt(emailSlaTracking.slaDeadline, addMinutes(new Date(), 30)),
      eq(emailSlaTracking.isBreached, false)
    )
  });
  
  for (const email of aboutToBreach) {
    await sendBreachWarningNotification(email);
  }
  
  // Mark actual breaches
  await db.update(emailSlaTracking)
    .set({ 
      isBreached: true, 
      breachedAt: new Date(),
      breachMinutes: sql`EXTRACT(EPOCH FROM (NOW() - sla_deadline)) / 60`
    })
    .where(and(
      isNull(emailSlaTracking.firstResponseAt),
      lt(emailSlaTracking.slaDeadline, new Date()),
      eq(emailSlaTracking.isBreached, false)
    ));
}
```

## Success Criteria
- [ ] SLA deadlines calculated correctly for each urgency level
- [ ] Business hours respected in calculations
- [ ] Response times tracked accurately
- [ ] Breaches detected and marked
- [ ] User aggregation reports available
- [ ] Client aggregation reports available
- [ ] Breach warnings sent before deadline

## Testing Steps
1. Login: Root page → Passwords tab → admin@example.com | admin123
2. Configure SLA settings (if not default)
3. Receive a new email classified as urgent
4. Verify SLA deadline is set correctly (4 hours from now in business time)
5. Let email sit past deadline
6. Verify breach is detected and recorded
7. Reply to the email
8. Verify response time is calculated
9. Check user performance report shows the breach
10. Check client report shows the response time

---

# Stage 9: Manual Overrides & Auditability

## Purpose
Allow users to correct classification errors while maintaining full accountability.

## Override Capabilities

### What Can Be Overridden
| Field | Add | Remove | Notes |
|-------|-----|--------|-------|
| requires_task | ✓ | ✓ | Re-evaluates completion rules |
| requires_reply | ✓ | ✓ | Re-evaluates completion rules |
| information_only | ✓ | ✓ | Exclusive: enabling clears task/reply |
| opportunity | ✓ | ✓ | Can change type or remove |
| urgency | ✓ | - | Can only increase, not decrease |
| sentiment | ✓ | - | Manual correction allowed |

### Override UI
```
┌─────────────────────────────────────────────────────────────────┐
│ Edit Classification                                      [X]    │
├─────────────────────────────────────────────────────────────────┤
│ Current classifications for this email:                         │
│                                                                 │
│ ☑ Requires Task    (AI: true, Deterministic: true)             │
│ ☑ Requires Reply   (AI: true, Deterministic: question mark)    │
│ ☐ Information Only (AI: false)                                 │
│ ☐ Urgent          (AI: normal)                                 │
│ ☐ Opportunity     (AI: upsell)                                 │
│                                                                 │
│ ────────────────────────────────────────────────────────────── │
│ Reason for change (required):                                   │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Client just called to say they don't need a response       ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ ⚠️ Changes are logged for audit                                 │
│                                     [Cancel] [Save Changes]     │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema
```sql
CREATE TABLE email_classification_overrides (
  id UUID PRIMARY KEY,
  email_id UUID REFERENCES inbox_emails(id),
  
  -- Who and when
  user_id UUID REFERENCES users(id) NOT NULL,
  override_at TIMESTAMP DEFAULT NOW(),
  
  -- What changed
  field_name VARCHAR(50) NOT NULL,            -- 'requires_task', 'requires_reply', etc.
  previous_value JSONB,
  new_value JSONB,
  
  -- Why
  reason TEXT NOT NULL,
  
  -- Context
  previous_classification_snapshot JSONB,     -- Full state before change
  new_classification_snapshot JSONB           -- Full state after change
);

-- Index for audit queries
CREATE INDEX idx_override_email ON email_classification_overrides(email_id);
CREATE INDEX idx_override_user ON email_classification_overrides(user_id);
CREATE INDEX idx_override_date ON email_classification_overrides(override_at);
```

## Override Processing Logic
```typescript
async function applyOverride(
  emailId: string,
  userId: string,
  changes: Record<string, any>,
  reason: string
) {
  const currentClassification = await getClassification(emailId);
  
  // Validate changes
  for (const [field, newValue] of Object.entries(changes)) {
    // Urgency can only be increased
    if (field === 'urgency') {
      const levels = ['low', 'normal', 'high', 'critical'];
      if (levels.indexOf(newValue) < levels.indexOf(currentClassification.urgency)) {
        throw new Error('Urgency can only be increased, not decreased');
      }
    }
    
    // information_only is exclusive
    if (field === 'information_only' && newValue === true) {
      changes.requires_task = false;
      changes.requires_reply = false;
    }
  }
  
  // Log each change
  for (const [field, newValue] of Object.entries(changes)) {
    await db.insert(emailClassificationOverrides).values({
      emailId,
      userId,
      fieldName: field,
      previousValue: currentClassification[field],
      newValue,
      reason,
      previousClassificationSnapshot: currentClassification,
      newClassificationSnapshot: { ...currentClassification, ...changes }
    });
  }
  
  // Apply changes
  await updateClassification(emailId, changes);
  
  // Re-evaluate workflow state
  await reevaluateWorkflowState(emailId);
}

async function reevaluateWorkflowState(emailId: string) {
  const classification = await getClassification(emailId);
  const workflowState = await getWorkflowState(emailId);
  
  // Update requirements based on new classification
  await db.update(emailWorkflowState)
    .set({
      requires_task: classification.requires_task,
      requires_reply: classification.requires_reply,
      // Reset completion flags if requirements changed
      task_requirement_met: !classification.requires_task || workflowState.task_requirement_met,
      // Re-calculate state
      state: calculateState(classification, workflowState)
    })
    .where(eq(emailWorkflowState.emailId, emailId));
}
```

## Audit Reports
```typescript
interface OverrideAuditReport {
  period: { start: Date; end: Date };
  totalOverrides: number;
  byUser: {
    userId: string;
    userName: string;
    overrideCount: number;
    mostOverriddenField: string;
  }[];
  byField: {
    field: string;
    addedCount: number;
    removedCount: number;
  }[];
  patterns: {
    // E.g., "User X frequently removes requires_task"
    description: string;
    frequency: number;
  }[];
}
```

## Success Criteria
- [ ] All classification fields can be overridden (within rules)
- [ ] Urgency can only be increased
- [ ] information_only exclusivity enforced
- [ ] Reason required for all overrides
- [ ] All overrides logged with full before/after state
- [ ] Workflow state re-evaluated after override
- [ ] Audit reports show override patterns

## Testing Steps
1. Login: Root page → Passwords tab → admin@example.com | admin123
2. Find an email with requires_reply = true
3. Open classification editor
4. Remove requires_reply classification
5. Enter reason for change
6. Save and verify:
   - Classification updated
   - Override logged in database
   - Workflow state re-evaluated
7. Try to decrease urgency → verify error
8. Enable information_only → verify task/reply cleared
9. Check audit log shows all changes with reasons
10. Generate audit report for last 7 days

---

# Stage 10: Retro Adding of Emails

## Purpose
Allow emails that didn't pass the Customer Gate to be manually brought into the system.

## Use Cases
- Client changed their email address
- New contact joined client's team
- Important email was forwarded from unknown sender
- Historical emails need to be processed

## Quarantine Browser UI
```
┌─────────────────────────────────────────────────────────────────┐
│ Email Quarantine                                    [Search]    │
├─────────────────────────────────────────────────────────────────┤
│ These emails didn't match any known clients or contacts.        │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ □ From: john.new@acmecorp.com                               ││
│ │   Subject: RE: Accounts update                               ││
│ │   Received: 2 hours ago                                      ││
│ │   [Add to Client ▼] [Ignore]                                ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │ □ From: unknown@randomdomain.com                            ││
│ │   Subject: Quick question                                    ││
│ │   Received: 5 hours ago                                      ││
│ │   [Add to Client ▼] [Ignore]                                ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ─────────────── OR SEARCH FULL INBOX ───────────────           │
│                                                                 │
│ [Search Graph API for older emails...]                          │
└─────────────────────────────────────────────────────────────────┘
```

## Graph API Search
```typescript
interface GraphSearchRequest {
  inboxId: string;
  query: {
    fromAddress?: string;
    subject?: string;
    dateRange?: { start: Date; end: Date };
    hasAttachments?: boolean;
  };
  maxResults: number;
}

async function searchGraphForEmails(request: GraphSearchRequest): Promise<GraphEmail[]> {
  const inbox = await getInbox(request.inboxId);
  
  // Build OData filter
  const filters: string[] = [];
  
  if (request.query.fromAddress) {
    filters.push(`from/emailAddress/address eq '${request.query.fromAddress}'`);
  }
  
  if (request.query.subject) {
    filters.push(`contains(subject, '${request.query.subject}')`);
  }
  
  if (request.query.dateRange) {
    filters.push(`receivedDateTime ge ${request.query.dateRange.start.toISOString()}`);
    filters.push(`receivedDateTime le ${request.query.dateRange.end.toISOString()}`);
  }
  
  const messages = await graphClient
    .api(`/users/${inbox.email}/messages`)
    .filter(filters.join(' and '))
    .top(request.maxResults)
    .get();
    
  return messages.value;
}
```

## Restore Flow
```typescript
interface RestoreEmailRequest {
  emailSource: 'quarantine' | 'graph_search';
  emailId?: string;           // For quarantine
  microsoftId?: string;       // For graph search
  matchToClientId: string;    // Which client to associate
  addContactEmail?: boolean;  // Add sender as client contact
}

async function restoreEmail(request: RestoreEmailRequest, userId: string) {
  let email: InboxEmail;
  
  if (request.emailSource === 'quarantine') {
    // Move from quarantine to inbox_emails
    const quarantined = await getQuarantinedEmail(request.emailId);
    email = await createInboxEmail(quarantined);
    await markQuarantineRestored(request.emailId, userId);
  } else {
    // Fetch from Graph and create
    const graphEmail = await fetchEmailFromGraph(request.microsoftId);
    email = await createInboxEmail(graphEmail);
  }
  
  // Associate with client
  await db.update(inboxEmails)
    .set({ matchedClientId: request.matchToClientId })
    .where(eq(inboxEmails.id, email.id));
  
  // Optionally add contact
  if (request.addContactEmail) {
    await createClientContact({
      clientId: request.matchToClientId,
      email: email.fromAddress,
      name: email.fromName
    });
  }
  
  // Run through classification pipeline
  await classifyEmail(email.id);
  
  // Create workflow state
  await createWorkflowState(email.id);
  
  // Audit log
  await createAuditLog({
    action: 'email_restored',
    entityType: 'email',
    entityId: email.id,
    userId,
    details: {
      source: request.emailSource,
      matchedClient: request.matchToClientId
    }
  });
}
```

## Success Criteria
- [ ] Quarantined emails browsable and searchable
- [ ] One-click restore to any client
- [ ] Option to add sender as client contact
- [ ] Graph API search for older emails works
- [ ] Restored emails go through full classification
- [ ] All restores logged for audit

## Testing Steps
1. Login: Root page → Passwords tab → admin@example.com | admin123
2. Navigate to Quarantine browser (admin area)
3. View list of quarantined emails
4. Search for specific sender
5. Select an email and click "Add to Client"
6. Choose a client from dropdown
7. Enable "Add sender as contact"
8. Click Restore
9. Verify:
   - Email appears in Comms workspace
   - Email is classified
   - Sender added to client contacts
   - Audit log shows restore action
10. Test Graph search:
    - Click "Search Graph for older emails"
    - Enter date range and criteria
    - Verify results from Microsoft are shown
    - Restore one email
    - Verify full processing

---

# State Transitions for an Email

## Complete State Diagram
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   ┌─────────┐     Gate Pass     ┌─────────────┐                         │
│   │ INGESTED│─────────────────▶│ CLASSIFYING │                          │
│   └────┬────┘                   └──────┬──────┘                          │
│        │                               │                                 │
│        │ Gate Fail                     │ Classification Complete         │
│        ▼                               ▼                                 │
│   ┌─────────────┐              ┌─────────────┐                          │
│   │ QUARANTINED │              │   PENDING   │                          │
│   └──────┬──────┘              └──────┬──────┘                          │
│          │                            │                                  │
│          │ Manual Restore             │ User Opens                       │
│          │                            ▼                                  │
│          │                     ┌─────────────┐                          │
│          └────────────────────▶│   WORKING   │                          │
│                                └──────┬──────┘                          │
│                                       │                                  │
│                    ┌──────────────────┼──────────────────┐              │
│                    │                  │                  │              │
│                    ▼                  ▼                  ▼              │
│           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│           │BLOCKED_REPLY │   │ BLOCKED_TASK │   │ BLOCKED_BOTH │       │
│           └──────┬───────┘   └──────┬───────┘   └──────┬───────┘       │
│                  │                  │                  │                │
│                  │ Reply Sent       │ Task Done        │ Both Done      │
│                  │                  │ or Dismissed     │                │
│                  └──────────────────┼──────────────────┘                │
│                                     │                                    │
│                                     ▼                                    │
│                              ┌─────────────┐                            │
│                              │  COMPLETED  │                            │
│                              └─────────────┘                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## State Definitions

| State | Description | Visible in Comms | Actions Available |
|-------|-------------|------------------|-------------------|
| INGESTED | Raw email received | No | - |
| QUARANTINED | Failed customer gate | No (Quarantine view) | Restore |
| CLASSIFYING | Being processed | No | - |
| PENDING | Ready for user | Yes | Open, Complete* |
| WORKING | User is viewing | Yes | Complete*, Create Task, Reply |
| BLOCKED_REPLY | Needs reply | Yes | Reply, Override |
| BLOCKED_TASK | Needs task | Yes | Create Task, No Task Needed |
| BLOCKED_BOTH | Needs both | Yes | All above |
| COMPLETED | Finished | No (Archive) | View |

*Complete subject to enforcement rules

---

# Edge Cases and Failure Modes

## Email Ingestion
| Scenario | Handling |
|----------|----------|
| Graph API timeout | Retry with exponential backoff, max 3 attempts |
| Duplicate email sync | Detect by microsoftId, skip if exists |
| Malformed email | Log error, quarantine with reason |
| Large attachment | Store metadata only, fetch on demand |

## Classification
| Scenario | Handling |
|----------|----------|
| OpenAI API failure | Use deterministic result only, flag for re-classification |
| Classification timeout | Apply deterministic floors, queue for retry |
| Conflicting AI response | Most conservative interpretation |
| Empty email body | Mark as information_only if no subject indicators |

## Workflow
| Scenario | Handling |
|----------|----------|
| Task deleted before email completed | Ask user to confirm or create new task |
| Reply sent but sync not detected | Manual "Mark as replied" option |
| User tries to complete blocked email | Show clear blocker message |
| Email deleted from Outlook | Mark as "externally deleted", archive |

## SLA
| Scenario | Handling |
|----------|----------|
| Email received outside business hours | SLA starts at next business hour start |
| Reply sent just before breach | Mark as "near miss" for reporting |
| Multiple people working same email | SLA attributed to first responder |

---

# Separation of Responsibilities

## Rules Engine (Deterministic Layer)
- **Owns**: Pattern matching, floor values, triggered rules list
- **Does Not**: Make nuanced judgment calls, understand context
- **Guarantees**: Explainable, reproducible results

## AI Layer (OpenAI 4o-mini)
- **Owns**: Semantic understanding, sentiment, opportunities, nuanced classification
- **Does Not**: Override deterministic floors, make exclusive decisions
- **Guarantees**: Confidence scores, reasoning

## Human (User)
- **Owns**: Final classification overrides, completion decisions, task creation
- **Does Not**: Need to classify every email manually
- **Guarantees**: Accountability through audit trail

## System (The Link)
- **Owns**: State management, enforcement rules, SLA tracking
- **Does Not**: Make classification decisions, auto-complete without meeting rules
- **Guarantees**: Data integrity, audit logging, workflow enforcement

---

# Implementation Phases

## Phase 1: Foundation (Week 1-2)
- [ ] Customer Gate implementation
- [ ] Quarantine table and basic UI
- [ ] Dev Override toggle
- **Test**: Verify emails are correctly gated

## Phase 2: Deterministic Classification (Week 2-3)
- [ ] Rules engine implementation
- [ ] All rule patterns
- [ ] Triggered rules logging
- **Test**: Each rule individually with test emails

## Phase 3: AI Classification (Week 3-4)
- [ ] OpenAI integration
- [ ] Prompt engineering
- [ ] Merge logic
- **Test**: End-to-end classification pipeline

## Phase 4: Workflow States (Week 4-5)
- [ ] State machine implementation
- [ ] Completion rules
- [ ] UI for micro-task presentation
- **Test**: All state transitions

## Phase 5: Task Enforcement (Week 5-6)
- [ ] Task creation from email
- [ ] AI task suggestions
- [ ] "No Task Needed" flow
- **Test**: Task creation and completion flow

## Phase 6: Reply Enforcement (Week 6-7)
- [ ] Reply detection
- [ ] Auto-complete on reply
- [ ] Reply composition integration
- **Test**: Reply workflows

## Phase 7: SLA Tracking (Week 7-8)
- [ ] SLA calculation
- [ ] Breach detection
- [ ] Reporting
- **Test**: SLA accuracy and reports

## Phase 8: Overrides & Audit (Week 8-9)
- [ ] Override UI
- [ ] Audit logging
- [ ] Audit reports
- **Test**: Full audit trail

## Phase 9: Retro Adding (Week 9-10)
- [ ] Quarantine browser
- [ ] Graph search
- [ ] Restore flow
- **Test**: Email restoration

## Phase 10: Toolbar & Polish (Week 10-11)
- [ ] Toolbar implementation
- [ ] Count badges
- [ ] Performance optimization
- **Test**: Full workflow end-to-end

---

# Appendix: API Reference

## Endpoints to Create

```
POST   /api/comms/emails/:id/classify          - Trigger classification
GET    /api/comms/emails/:id/classification    - Get classification result
PATCH  /api/comms/emails/:id/classification    - Override classification

GET    /api/comms/emails/:id/workflow-state    - Get workflow state
POST   /api/comms/emails/:id/complete          - Attempt completion
POST   /api/comms/emails/:id/create-task       - Create task from email
POST   /api/comms/emails/:id/mark-no-task      - Mark no task needed
POST   /api/comms/emails/:id/mark-replied      - Manual reply mark

GET    /api/comms/quarantine                   - List quarantined emails
POST   /api/comms/quarantine/:id/restore       - Restore quarantined email
POST   /api/comms/graph-search                 - Search Graph for emails

GET    /api/comms/sla/user/:userId             - User SLA report
GET    /api/comms/sla/client/:clientId         - Client SLA report
GET    /api/comms/sla/breaches                 - Current breaches

GET    /api/comms/audit/overrides              - Override audit log
```

---

*End of Planning Document*
