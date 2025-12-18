# Client Project Tasks - Development Plan

## Overview

**Purpose**: Enable service owners to send customizable pre-work checklists to clients, ensuring all required information/documents are received before work begins. This solves the problem of starting work, being unable to complete it, and then waiting on clients.

**Core Concept**: A form-based task system that:
- Is defined at the project type level (template)
- Supports client-level overrides (inherit + extend, with removal support)
- Creates instances per project
- Triggers automatic stage changes on completion
- Integrates with existing reminder/notification system

---

## Testing Credentials

**HOW TO LOGIN:**
1. Go to root page (/)
2. Click on "Passwords" tab
3. Enter: admin@example.com | admin123

| Environment | URL | Email | Password |
|-------------|-----|-------|----------|
| Development | Root page → Passwords tab | admin@example.com | admin123 |

**Note**: The login page has multiple tabs (Replit Auth, Passwords, etc.). Always use the "Passwords" tab for development testing.

---

## Phase 1: Database Schema & Core Infrastructure

### Success Criteria
- [ ] All new tables created with proper relationships
- [ ] Migrations run successfully
- [ ] Types exported and available in shared schema
- [ ] Storage layer CRUD operations functional

### Tasks

#### 1.1 Create Database Tables

**`client_project_task_templates`** - Project Type Level Definition
```sql
- id (varchar, PK)
- project_type_id (FK to project_types)
- name (varchar) - e.g., "Pre-Bookkeeping Checklist"
- description (text)
- instructions (text) - Displayed to client at top of form
- on_completion_stage_id (FK to kanban_stages) - Move to this stage when completed
- on_completion_stage_reason_id (FK to change_reasons) - Optional reason for stage change
- require_all_questions (boolean, default true) - All questions must be answered
- expiry_days_after_start (integer, default 7) - Token expires N days after project start date
- is_active (boolean, default true)
- created_at, updated_at
```

**`client_project_task_questions`** - Questions for Template
```sql
- id (varchar, PK)
- template_id (FK to client_project_task_templates)
- question_type (enum: short_text, long_text, email, number, date, single_choice, multi_choice, dropdown, yes_no, file_upload)
- label (varchar) - The question text
- help_text (text) - Optional help text
- is_required (boolean)
- order (integer)
- options (text[]) - For choice/dropdown types
- placeholder (varchar)
- conditional_logic (jsonb) - Phase 2: {"showIf": {"questionId": "xxx", "equals": "value"}}
- created_at
```

**`client_project_task_overrides`** - Client-Level Customization
```sql
- id (varchar, PK)
- client_id (FK to clients)
- base_template_id (FK to client_project_task_templates) - The template this overrides
- name (varchar) - Optional override name
- description (text)
- instructions (text)
- on_completion_stage_id (FK) - Can override stage logic
- on_completion_stage_reason_id (FK)
- removed_question_ids (text[]) - Questions from base template to exclude
- is_active (boolean)
- created_at, updated_at
```

**`client_project_task_override_questions`** - Additional Questions for Client Override
```sql
- id (varchar, PK)
- override_id (FK to client_project_task_overrides)
- question_type (enum)
- label (varchar)
- help_text (text)
- is_required (boolean)
- order (integer) - Order relative to inherited questions
- options (text[])
- placeholder (varchar)
- conditional_logic (jsonb)
- created_at
```

**`client_project_task_instances`** - Per-Project Task Instance
```sql
- id (varchar, PK)
- project_id (FK to projects) - Nullable for pre-project scenarios
- client_id (FK to clients) - For pre-project matching
- template_id (FK to client_project_task_templates)
- override_id (FK to client_project_task_overrides, nullable)
- scheduled_notification_id (FK to scheduled_notifications, nullable) - Link to trigger
- status (enum: pending, sent, in_progress, submitted, expired)
- sent_at (timestamp)
- started_at (timestamp) - When client first opened
- submitted_at (timestamp)
- completed_by_name (varchar) - Client contact name
- completed_by_email (varchar)
- stage_change_completed_at (timestamp) - When auto-stage-change was executed
- pre_project_target_stage_id (varchar) - For pre-project: start at this stage when project created
- created_at, updated_at
```

**`client_project_task_responses`** - Individual Question Responses
```sql
- id (varchar, PK)
- instance_id (FK to client_project_task_instances)
- question_id (varchar) - Could be template question or override question
- question_source (enum: template, override)
- value_text (text)
- value_number (numeric)
- value_date (timestamp)
- value_boolean (boolean)
- value_multi_select (text[])
- value_file (jsonb) - {objectPath, fileName, fileType, fileSize}
- answered_at (timestamp)
- created_at, updated_at
```

**`client_project_task_tokens`** - Access Tokens (follows query pattern)
```sql
- id (varchar, PK)
- instance_id (FK to client_project_task_instances)
- token (varchar, unique) - Random access token
- expires_at (timestamp) - Calculated as project start date + template.expiryDaysAfterStart
- accessed_at (timestamp)
- recipient_email (varchar)
- recipient_name (varchar)
- created_by_id (FK to users)
- is_reissued (boolean, default false) - True if this replaced an earlier token
- created_at
```

#### 1.2 Create Enums
```typescript
export const clientProjectTaskStatusEnum = pgEnum('client_project_task_status', [
  'pending',      // Created but not sent
  'sent',         // Email sent, awaiting client
  'in_progress',  // Client has opened/started
  'submitted',    // Client submitted all answers
  'expired'       // Token expired without completion
]);

export const taskQuestionSourceEnum = pgEnum('task_question_source', [
  'template',
  'override'
]);
```

#### 1.3 Storage Layer
Create storage files following existing patterns:
- `server/storage/tasks/clientProjectTaskStorage.ts`
- Update `server/storage/base/IStorage.ts` with new interfaces

---

## Phase 2: Project Type Configuration UI

> **Testing Login**: Root page (/) → Passwords tab → admin@example.com | admin123

### Success Criteria
- [ ] New "Client Tasks" tab visible in Project Type detail page
- [ ] Can create/edit/delete task templates
- [ ] Visual drag-and-drop question builder (like client request templates)
- [ ] Can configure stage change logic
- [ ] Can link template to notifications

### Tasks

#### 2.1 Add "Client Tasks" Tab to Project Type Detail

Location: `client/src/pages/project-type-detail/`

New tab after "Notifications" called "Client Tasks" with:
- List of configured task templates for this project type
- "Add Task Template" button
- Each template shows: Name, # of questions, linked stage, active status

#### 2.2 Task Template Builder UI

Create visual builder similar to `client/src/pages/request-template-edit.tsx`:

**Left Panel**: Question type palette
- Short Text, Long Text, Email, Number, Date
- Single Choice, Multi Choice, Dropdown, Yes/No
- File Upload

**Center Panel**: Form preview with drag-and-drop ordering
- Drag questions from palette to add
- Reorder via drag handles
- Click to edit question details

**Right Panel**: Template settings
- Name, Description, Instructions
- On Completion: Stage selector, Reason selector
- "Require all questions" toggle
- Active/Inactive status

#### 2.3 Question Editor Modal

When editing a question:
- Label (required)
- Help text (optional)
- Required toggle
- Placeholder text
- Options editor (for choice types)
- Conditional logic (Phase 3)

#### 2.4 Link to Notifications

In the Project Notification form, add option:
- "Attach Client Task": Dropdown of active task templates
- When notification fires, it creates a task instance and includes link in email

---

## Phase 3: Client Override System

> **Testing Login**: Root page (/) → Passwords tab → admin@example.com | admin123

### Success Criteria
- [ ] Client Approval Overrides tab shows "Client Project Tasks" section
- [ ] Can create override that inherits from project type template
- [ ] Can add additional questions
- [ ] Can remove questions from base template
- [ ] Override correctly merges with base template

### Tasks

#### 3.1 Extend Approval Overrides Tab

Location: `client/src/pages/client-detail/components/tabs/ApprovalOverridesTab.tsx`

Add new section "Client Project Task Overrides":
- List overrides by project type
- "Add Override" button → Select project type → Select template

#### 3.2 Override Editor UI

**Inherited Questions Section**:
- Shows all questions from base template
- Each has "Remove" action (adds to removed_question_ids)
- Removed questions shown with strikethrough + "Restore" action

**Additional Questions Section**:
- Same palette/builder UI as template
- Questions marked with "Client Override" badge
- Can be reordered relative to inherited questions

**Settings Section**:
- Override name (optional, defaults to base template name)
- Override instructions (optional, appends to base)
- Override stage logic (optional, replaces base)

---

## Phase 4: Task Instance & Client Form ✅ COMPLETED

> **Testing Login**: Root page (/) → Passwords tab → admin@example.com | admin123

### Success Criteria
- [x] Task instances created when notification fires
- [x] Client receives email with branded button to open form
- [x] Form UI matches bookkeeping queries style (auto-save, clean design)
- [x] Responses saved per question
- [x] Submit button validates all required questions answered
- [x] On submit: stage change triggers, notifications sent

### Implementation Notes
- **Route**: `/task/:token` - Token-based public access
- **Auto-save**: 500ms debounce with visual save status indicator
- **Question types**: text, long_text, email, number, date, single_choice, multi_choice, dropdown, yes_no
- **File uploads**: Deferred to Phase 5 (shows "coming soon" message in form)
- **Confirmation step**: Collects submitter name/email before final submission
- **Pre-filled data**: Token recipient name/email pre-populate confirmation fields

### Tasks

#### 4.1 Instance Creation Logic

When notification scheduler fires a notification with attached task template:
1. Check if client has override for this template
2. Create `client_project_task_instance` record
3. Create access token
4. Include tokenized link in notification email

#### 4.2 Client-Facing Form Page

Create: `client/src/pages/client-project-task-form.tsx`

Route: `/task/:token`

**UI Components**:
- Branded header with company logo
- Template name as title
- Instructions panel (collapsible after reading)
- Progress indicator (X of Y questions answered)
- Question list with appropriate inputs
- Auto-save indicator (saves on blur/change)
- Submit button (only active when all required answered)
- Confirmation screen on submit

**Technical**:
- Fetch template + override questions via token
- Merge and order questions correctly
- Save responses with debounce
- Handle file uploads via object storage

#### 4.3 Form Question Components

Create reusable components matching client request pattern:
- TextQuestion (short/long)
- EmailQuestion (with validation)
- NumberQuestion
- DateQuestion
- SingleChoiceQuestion
- MultiChoiceQuestion
- DropdownQuestion
- YesNoQuestion
- FileUploadQuestion

#### 4.4 Submission Logic

On submit:
1. Validate all required questions answered
2. Update instance status to 'submitted'
3. If project exists:
   - Execute stage change (if configured)
   - Add chronology entry for stage change
4. If project doesn't exist (pre-project):
   - Set `pre_project_target_stage_id` on instance
   - When project is created, check for pending instance → start at target stage
5. Send notification to service owner
6. Show confirmation to client

---

## Phase 5: Staff-Facing Views ✅ COMPLETE

> **Testing Login**: Root page (/) → Passwords tab → admin@example.com | admin123

### Success Criteria
- [x] Queries tab shows Client Tasks section (accordion if both exist)
- [x] Can see task status, responses, completion details
- [x] Scheduled reminders shown like bookkeeping queries
- [x] Can manually resend/extend task links
- [x] Project card shows task status indicator

### Implementation Notes

**Key Files:**
- `client/src/components/queries/ClientProjectTasksSection.tsx` - Main task management UI
- `client/src/components/project-card.tsx` - Task indicator on project cards
- `server/routes/clientProjectTasks.ts` - API endpoints including batch counts

**Project Card Integration:**
- Blue `ClipboardList` icon shows count of pending/sent tasks
- Uses batch API (`/api/task-instances/counts`) for efficient loading
- Only shown in kanban view when tasks exist

### Tasks

#### 5.1 Extend Queries Tab ✅

Location: `client/src/components/queries/QueriesTab.tsx`

**Implementation:** `ClientProjectTasksSection` component shows all task instances for a project with:
- Status badges (Pending/Sent/In Progress/Submitted/Expired)
- Create new task dialog
- Template selection dropdown

#### 5.2 Task Status Display ✅

**Task Card Features:**
- Status badge (Pending/Sent/In Progress/Submitted/Expired) with color coding
- Template name
- Sent date, opened date, submitted date
- Recipient info (email/name from token)
- "View Responses" button (expands to show answers)
- "Resend Link" / "Extend Expiry" actions

**Response Viewer:**
- Collapsible section showing all Q&A
- Question labels with response values
- Timestamps for each answer

#### 5.3 Project Card Integration ✅

Location: `client/src/components/project-card.tsx`

**Implementation:**
- Blue `ClipboardList` icon with count badge
- Shows count of pending + sent tasks
- Tooltip displays task status summary
- Batch API for efficient loading across multiple projects

---

## Phase 6: Reminder Integration ✅ COMPLETE

> **Testing Login**: Root page (/) → Passwords tab → admin@example.com | admin123

### Success Criteria
- [x] Scheduled reminders work for client tasks (email/SMS/voice)
- [x] Reminders shown in project scheduled reminders panel (via ClientProjectTasksSection)
- [x] Can configure follow-up reminders in notification setup
- [x] Reminder status updates correctly

### Implementation Notes

**Key Files Modified:**
- `client/src/pages/project-type-detail/components/notifications/ProjectNotificationForm.tsx` - Task template dropdown
- `server/notification-sender.ts` - Task instance creation on notification fire
- `server/notification-variables.ts` - Added `{task_link}` variable
- `shared/schema/notifications/tables.ts` - Added `taskTemplateId` to projectTypeNotifications

**Design Decisions:**
1. Task instances are created at **notification send time** (not schedule time) to ensure task links are available in notification content
2. `{task_link}` variable injects the client-facing task form URL into notifications
3. Token automatically generated with configurable expiry when task instance is created
4. Existing `ClientProjectTasksSection` shows task instances with full status tracking

### Tasks

#### 6.1 Extend Notification System ✅

Modify `ProjectNotificationForm.tsx`:
- [x] Add "Attach Client Task Template" dropdown
- [x] When selected, notification creates task instance
- [x] Follow-up reminder configuration (same as queries)

**Implementation:** Added `taskTemplateId` field to notification form and database schema. Dropdown fetches active task templates for the project type.

#### 6.2 Reminder Cron Integration ✅

**Implementation:** Rather than creating a separate cron, integrated task instance creation into `notification-sender.ts`:
- When a notification fires with `taskTemplateId`, creates a task instance
- Generates access token automatically
- Injects `{task_link}` variable into notification content
- Status tracked on task instance (pending, sent, in_progress, submitted, expired)

#### 6.3 Reminders Panel Integration ✅

**Implementation:** `ClientProjectTasksSection` (already exists) provides full task visibility:
- Shows all task instances for a project
- Displays status with color-coded badges
- "Resend Link" and "Extend Expiry" actions available
- Collapsible response viewer for submitted tasks
- Token expiry tracking and warnings

---

## Phase 7: Conditional Logic (Enhancement)

### Success Criteria
- [ ] Can configure "Show if" rules on questions
- [ ] Conditions: equals, not equals, contains, is empty, is not empty
- [ ] Multiple conditions with AND/OR logic
- [ ] Form dynamically shows/hides questions based on answers

### Tasks

#### 7.1 Conditional Logic Builder UI

Add to question editor:
- "Show this question only if..." toggle
- Condition builder:
  - Select source question (from previous questions)
  - Select operator (equals, not equals, contains, etc.)
  - Enter/select value
  - Add another condition (AND/OR)

#### 7.2 Dynamic Form Rendering

Client form evaluates conditions:
- Track all current answers in state
- On each change, recalculate visibility
- Hidden questions not required even if marked required
- Animate show/hide transitions

---

## Phase 8: OTP Security (Enhancement)

### Success Criteria
- [ ] Project type setting: "Require OTP for client tasks"
- [ ] When enabled, client must verify email before accessing form
- [ ] OTP sent to same email as task link
- [ ] 6-digit code, 10-minute expiry

### Tasks

#### 8.1 Project Type Setting

Add to template configuration:
- "Require email verification (OTP)" toggle

#### 8.2 OTP Flow

1. Client clicks link → Landing page
2. If OTP required: Show "Enter verification code" screen
3. Send 6-digit code to recipient email
4. Validate code before showing form
5. Store verification in session/token

Follow existing OTP pattern from `server/services/pages/pageOtpService.ts`

---

## Technical Architecture Notes

### Question Merging Logic (Template + Override)

When rendering form:
```typescript
function getMergedQuestions(template, override?) {
  // Start with template questions
  let questions = template.questions.filter(q => 
    !override?.removedQuestionIds?.includes(q.id)
  );
  
  // Add override questions
  if (override?.questions) {
    questions = [...questions, ...override.questions.map(q => ({
      ...q,
      source: 'override'
    }))];
  }
  
  // Sort by order
  return questions.sort((a, b) => a.order - b.order);
}
```

### Pre-Project Task Handling

When project is created via scheduler:
```typescript
async function createProject(clientId, projectTypeId) {
  // Check for pending pre-project tasks
  const pendingTask = await storage.clientProjectTask.findPendingForClient(
    clientId, 
    projectTypeId
  );
  
  let initialStage = getDefaultFirstStage(projectTypeId);
  
  if (pendingTask?.status === 'submitted' && pendingTask.preProjectTargetStageId) {
    // Client already completed task - start at target stage
    initialStage = pendingTask.preProjectTargetStageId;
    
    // Link task to new project
    await storage.clientProjectTask.linkToProject(pendingTask.id, project.id);
  }
  
  return createProjectAtStage(initialStage);
}
```

### Notification Email Template

```html
<h2>Action Required: {{taskName}}</h2>
<p>{{clientInstructions}}</p>
<p>Please complete the following checklist before we can begin work on your {{projectTypeName}}:</p>
<a href="{{taskUrl}}" class="button">Complete Checklist</a>
<p><small>This link expires on {{expiryDate}}</small></p>
```

---

## Development Order & Dependencies

```
Phase 1 (Schema) ──────┐
                       ├──→ Phase 2 (Project Type UI)
                       │
                       ├──→ Phase 3 (Client Overrides) ──→ depends on Phase 2
                       │
                       └──→ Phase 4 (Client Form) ──────→ depends on Phase 2
                                    │
                                    ├──→ Phase 5 (Staff Views)
                                    │
                                    └──→ Phase 6 (Reminders)
                                    
Phase 7 (Conditional) ──→ Enhancement, can be added after core
Phase 8 (OTP) ──────────→ Enhancement, can be added after core
```

---

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Schema & Infrastructure | 1-2 days | Critical |
| Phase 2: Project Type UI | 2-3 days | Critical |
| Phase 3: Client Overrides | 1-2 days | Critical |
| Phase 4: Client Form | 2-3 days | Critical |
| Phase 5: Staff Views | 1-2 days | Critical |
| Phase 6: Reminders | 1 day | Critical |
| Phase 7: Conditional Logic | 2 days | Enhancement |
| Phase 8: OTP Security | 1 day | Enhancement |

**Total Core (Phases 1-6)**: ~10-13 days
**With Enhancements**: ~13-16 days

---

## Confirmed Design Decisions

1. **File Storage**: Use same object storage pattern as existing file uploads (`@uppy` + object storage)

2. **Token Expiry**: Configurable as N days after project start date (set at template level)
   - Template setting: "Link expires X days after project start date"
   - For pre-project tasks: Calculate based on scheduled project start

3. **Re-submission**: Clients cannot edit after submitting
   - Staff can "reopen" task which re-issues a new token
   - Original responses preserved, client can update and re-submit

4. **Completion Notification Recipient**: Service Owner (not project assignees)

---

## Related Files to Modify

### Backend
- `shared/schema/` - New tables, enums, types
- `server/storage/` - New storage files
- `server/routes/` - New API routes
- `server/notification-scheduler.ts` - Task creation on notification
- `server/project-scheduler.ts` - Pre-project task handling

### Frontend
- `client/src/pages/project-type-detail/` - New tab
- `client/src/pages/client-detail/` - Override section
- `client/src/components/queries/` - Extended Queries tab
- `client/src/pages/` - New client form page
- `client/src/components/project-card.tsx` - Status indicator

---

## Known Technical Debt

### TypeScript Implicit 'any' Errors
The following files have implicit 'any' type errors that should be addressed in a future cleanup:

| File | Approximate Count | Notes |
|------|------------------|-------|
| `server/routes/messages.ts` | ~23 | Route handler parameters |
| `server/scheduling-orchestrator.ts` | ~3 | Callback parameters |
| `server/db.ts` | ~1 | Configuration object |

These don't block functionality but should be typed properly for better type safety.

---

*Document created: December 2024*
*Last updated: December 2024*
