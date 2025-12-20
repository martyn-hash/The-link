# Client Project Tasks - Testing Plan

## Prerequisites

**Before executing ANY test in this document, you MUST:**

1. Read and follow `Core-Development-Principles/how-to-test.md`
2. Complete BOTH internal AND external readiness checks as specified
3. Authenticate using the dev-login endpoint or standard login flow

**Failure to follow these prerequisites will result in invalid test results.**

---

## Overview

This testing plan covers the Client Project Tasks feature which enables:
- **Template-level task definitions** at the project type level
- **Client-level overrides** that inherit + extend templates
- **Pre-project stage handling** for tasks completed before project creation
- **Automatic stage changes** upon task submission
- **Integration with reminder/notification system**

---

## Test Scope & Layers

| Layer | Components Tested |
|-------|-------------------|
| **Backend Logic** | Stage change priority (override > template > stageChangeRules), question merging, pre-project handling |
| **API Contracts** | All CRUD endpoints, token-based access, validation, error responses |
| **Persistence** | Template storage, override storage, instance creation, response storage, stage change completion |
| **UI Behaviour** | Client Tasks tab, form builder, client-facing form, conditional logic |
| **System Behaviour** | Pre-project task linking, chronology creation, cache invalidation |

---

## 1. Template Management (Project Type Level)

### 1.1 Template CRUD Operations

#### T1.1.1 Create template - Happy path
- **Setup**: Authenticated user, valid project type ID
- **Action**: POST `/api/task-templates` with valid payload
- **Assertion**: Returns 201 with template ID; template retrievable via GET

#### T1.1.2 Create template - Missing required fields
- **Setup**: Authenticated user
- **Action**: POST `/api/task-templates` with missing `name` or `projectTypeId`
- **Assertion**: Returns 400 with validation errors

#### T1.1.3 Create template - Invalid project type ID
- **Setup**: Authenticated user
- **Action**: POST `/api/task-templates` with non-existent project type ID
- **Assertion**: Returns 400 or 500 with appropriate error

#### T1.1.4 Update template - Change stage configuration
- **Setup**: Existing template
- **Action**: PATCH `/api/task-templates/:id` with new `onCompletionStageId`
- **Assertion**: Returns 200; subsequent GET shows updated stage ID

#### T1.1.5 Delete template - With no instances
- **Setup**: Template with no task instances
- **Action**: DELETE `/api/task-templates/:id`
- **Assertion**: Returns 204; template no longer retrievable

#### T1.1.6 Delete template - With active instances
- **Setup**: Template with active task instances
- **Action**: DELETE `/api/task-templates/:id`
- **Assertion**: Returns 400 or deletes cascade (verify business rule)

---

### 1.2 Template Questions

#### T1.2.1 Add question to template
- **Setup**: Existing template
- **Action**: POST `/api/task-template-questions` with `templateId`, `questionType: "yes_no"`, `label`, `order`
- **Assertion**: Returns 201; question appears in template's questions list

#### T1.2.2 Add question - Verify all question types
- **Setup**: Existing template
- **Action**: Create questions for each type: `short_text`, `long_text`, `email`, `number`, `date`, `single_choice`, `multi_choice`, `dropdown`, `yes_no`
- **Assertion**: Each type creates successfully; `options` field respected for choice types

#### T1.2.3 Reorder questions
- **Setup**: Template with 3+ questions
- **Action**: Update question order values
- **Assertion**: Questions returned in correct order

#### T1.2.4 Add question with conditional logic
- **Setup**: Template with at least one existing question
- **Action**: POST question with `conditionalLogic: { showIf: { questionId: "...", operator: "equals", value: "yes" } }`
- **Assertion**: Returns 201; conditional logic persisted

---

### 1.3 Stage Change Configuration

#### T1.3.1 Configure onCompletionStageId
- **Setup**: Template, valid stage ID for project type
- **Action**: PATCH template with `onCompletionStageId`
- **Assertion**: Field saved correctly; retrievable

#### T1.3.2 Configure stageChangeRules array
- **Setup**: Template with project type having multiple stages
- **Action**: PATCH template with `stageChangeRules: [{ ifStageId: "...", thenStageId: "..." }]`
- **Assertion**: Rules saved as JSONB; retrievable

#### T1.3.3 Configure invalid stage ID
- **Setup**: Template
- **Action**: PATCH with `onCompletionStageId` pointing to non-existent stage
- **Assertion**: Validation error or graceful handling

---

## 2. Client Override System

### 2.1 Override CRUD Operations

#### T2.1.1 Create override for client
- **Setup**: Client ID, active template
- **Action**: POST `/api/clients/:clientId/task-overrides` with `baseTemplateId`
- **Assertion**: Returns 201; override linked to client

#### T2.1.2 Create duplicate override - Same client + template
- **Setup**: Existing override for client + template
- **Action**: POST another override with same client + template
- **Assertion**: Returns 400 (unique constraint violation)

#### T2.1.3 Override stage configuration
- **Setup**: Existing override
- **Action**: PATCH override with `onCompletionStageId` different from template
- **Assertion**: Override stage saved; takes priority over template

#### T2.1.4 Mark questions as removed
- **Setup**: Override, template with questions
- **Action**: PATCH override with `removedQuestionIds: ["question-id-1"]`
- **Assertion**: Question excluded from merged questions

---

### 2.2 Override Questions

#### T2.2.1 Add override-specific question
- **Setup**: Existing override
- **Action**: POST `/api/task-override-questions` with override ID
- **Assertion**: Question created with `source: override`

#### T2.2.2 Verify question merging
- **Setup**: Template with 2 questions, override removing 1 and adding 1
- **Action**: GET merged questions for instance using this override
- **Assertion**: Returns 2 questions (1 template, 1 override); removed question absent

---

## 3. Task Instance Management

### 3.1 Instance Creation

#### T3.1.1 Create instance for project
- **Setup**: Project ID, template ID, client ID
- **Action**: POST `/api/projects/:projectId/task-instances` with `templateId`, `clientId`
- **Assertion**: Returns 201; instance linked to project; status = "pending"

#### T3.1.2 Create instance - One active per project rule
- **Setup**: Project with existing active (non-submitted) task instance
- **Action**: POST another instance for same project
- **Assertion**: Returns 500 with "only one active task per project" error

#### T3.1.3 Create instance with override detection
- **Setup**: Client with override for template
- **Action**: POST instance for project of that client
- **Assertion**: Instance has `overrideId` populated correctly

#### T3.1.4 Create pre-project instance (no projectId)
- **Setup**: Client ID, template ID
- **Action**: POST with only `clientId` and `templateId` (no `projectId`)
- **Assertion**: Instance created with null projectId

---

### 3.2 Token Generation & Sending

#### T3.2.1 Send task - Generate token
- **Setup**: Pending instance
- **Action**: POST `/api/task-instances/:instanceId/send` with `recipientEmail`, `recipientName`
- **Assertion**: Returns token; instance status → "sent"; sentAt populated

#### T3.2.2 Token uniqueness
- **Setup**: Multiple send operations
- **Action**: Generate tokens for different instances
- **Assertion**: Each token is unique (32+ characters)

#### T3.2.3 Token expiry calculation
- **Setup**: Template with `expiryDaysAfterStart: 7`
- **Action**: Send task
- **Assertion**: Token expiresAt = 7 days from now

---

## 4. Client-Facing Form (Token Access)

### 4.1 Token Validation

#### T4.1.1 Access form with valid token
- **Setup**: Sent instance with valid token
- **Action**: GET `/api/client-task/:token`
- **Assertion**: Returns 200 with template info, questions, existing responses

#### T4.1.2 Access form with invalid token
- **Setup**: None
- **Action**: GET `/api/client-task/invalid-token-12345`
- **Assertion**: Returns 404 "Invalid or expired token"

#### T4.1.3 Access form with expired token
- **Setup**: Token with expiresAt in past
- **Action**: GET `/api/client-task/:token`
- **Assertion**: Returns 403 "Token has expired"

#### T4.1.4 Access already-submitted task
- **Setup**: Submitted instance
- **Action**: GET `/api/client-task/:token`
- **Assertion**: Returns 403 "This task has already been submitted"

#### T4.1.5 Token accessed_at tracking
- **Setup**: Fresh token
- **Action**: GET `/api/client-task/:token` twice
- **Assertion**: Token's accessedAt is populated after first access

---

### 4.2 Response Saving (Auto-save)

#### T4.2.1 Save single response
- **Setup**: Valid token, question ID
- **Action**: POST `/api/client-task/:token/responses` with response data
- **Assertion**: Returns 200; response persisted

#### T4.2.2 Save response - Update existing
- **Setup**: Existing response for question
- **Action**: POST new value for same question
- **Assertion**: Response updated (upsert behaviour)

#### T4.2.3 Instance status → in_progress
- **Setup**: Instance in "sent" status
- **Action**: Save first response
- **Assertion**: Instance status changes to "in_progress"; startedAt populated

#### T4.2.4 Save all response types
- **Setup**: Questions of each type
- **Action**: Save: valueText, valueNumber, valueDate, valueBoolean, valueMultiSelect
- **Assertion**: Each type persists correctly; retrievable

---

### 4.3 Task Submission

#### T4.3.1 Submit task - Happy path
- **Setup**: All required questions answered
- **Action**: POST `/api/client-task/:token/submit` with responses, completedByName, completedByEmail
- **Assertion**: Returns 200 `{ success: true }`; status → "submitted"; submittedAt populated

#### T4.3.2 Submit task - Duplicate submission
- **Setup**: Already submitted instance
- **Action**: POST submit again
- **Assertion**: Returns 403 "already been submitted"

#### T4.3.3 Submit task - Capture completion details
- **Setup**: Valid token
- **Action**: Submit with `completedByName: "John Doe"`, `completedByEmail: "john@example.com"`
- **Assertion**: Instance has completedByName/completedByEmail populated

---

## 5. Stage Change on Submission (Critical)

### 5.1 Stage Change Priority

#### T5.1.1 Override stage takes priority
- **Setup**: Template with `onCompletionStageId: Stage-A`, Override with `onCompletionStageId: Stage-B`
- **Action**: Submit task instance using this override
- **Assertion**: Project moves to Stage-B (override), NOT Stage-A

#### T5.1.2 Template stage when no override
- **Setup**: Template with `onCompletionStageId: Stage-A`, no client override
- **Action**: Submit task instance
- **Assertion**: Project moves to Stage-A

#### T5.1.3 StageChangeRules conditional logic
- **Setup**: Template with no onCompletionStageId, but `stageChangeRules: [{ ifStageId: "Current", thenStageId: "Target" }]`
- **Action**: Submit task when project is at "Current" stage
- **Assertion**: Project moves to "Target" stage

#### T5.1.4 No stage change configured
- **Setup**: Template with no stage settings, no override, no rules
- **Action**: Submit task
- **Assertion**: Task submitted successfully; project stage unchanged

---

### 5.2 Stage Change Execution

#### T5.2.1 Chronology entry created
- **Setup**: Template with stage change configured
- **Action**: Submit task
- **Assertion**: Chronology entry created with: fromStatus, toStatus, changeReason = "Client task completed"

#### T5.2.2 stageChangeCompletedAt populated
- **Setup**: Stage change configured
- **Action**: Submit task
- **Assertion**: Instance has `stageChangeCompletedAt` set

#### T5.2.3 Project already at target stage
- **Setup**: Project already at target stage configured in template
- **Action**: Submit task
- **Assertion**: No stage change executed; stageChangeCompletedAt still set (idempotent)

#### T5.2.4 Invalid target stage
- **Setup**: Template with onCompletionStageId pointing to deleted/invalid stage
- **Action**: Submit task
- **Assertion**: Task submits successfully with warning; stage unchanged

#### T5.2.5 Stage assignee inheritance
- **Setup**: Target stage has `assignedUserId` configured
- **Action**: Submit task triggering stage change
- **Assertion**: Project's currentAssigneeId updated to stage's assigned user

---

## 6. Pre-Project Task Handling (Critical)

### 6.1 Pre-Project Instance Creation

#### T6.1.1 Create instance without projectId
- **Setup**: Client ID, template ID, no project exists
- **Action**: Create and send task instance with only clientId
- **Assertion**: Instance created with null projectId

#### T6.1.2 Submit pre-project task
- **Setup**: Pre-project instance (no projectId)
- **Action**: Submit task with stage change configured
- **Assertion**: Task submits; `preProjectTargetStageId` populated with target stage ID

---

### 6.2 Project Creation with Pre-Project Tasks

#### T6.2.1 Project starts at advanced stage
- **Setup**: Submitted pre-project task with preProjectTargetStageId set
- **Action**: Create project for same client + project type (via scheduler)
- **Assertion**: New project starts at target stage (not first stage)

#### T6.2.2 Task linked to new project
- **Setup**: Submitted pre-project task
- **Action**: Create project
- **Assertion**: Task instance's `projectId` updated to new project ID; `preProjectTargetStageId` cleared

#### T6.2.3 Chronology entry for pre-project stage
- **Setup**: Pre-project task triggering stage advancement
- **Action**: Create project
- **Assertion**: Chronology entry created showing: fromStatus = first stage, toStatus = target stage, changeReason includes "pre-project"

#### T6.2.4 Multiple templates - First match wins
- **Setup**: Client with multiple submitted pre-project tasks for same project type
- **Action**: Create project
- **Assertion**: First matching task with preProjectTargetStageId is used

---

## 7. Notification Integration

### 7.1 Notification Trigger

#### T7.1.1 Notification with taskTemplateId
- **Setup**: Project notification with `taskTemplateId` configured
- **Action**: Notification fires
- **Assertion**: Task instance created automatically; token generated; `{task_link}` variable available

#### T7.1.2 Override detection during notification
- **Setup**: Client has override for template; notification fires
- **Action**: Notification creates task instance
- **Assertion**: Instance uses override correctly

---

## 8. Staff-Facing Features

### 8.1 View & Manage Instances

#### T8.1.1 View all instances for project
- **Setup**: Project with multiple task instances
- **Action**: GET `/api/projects/:projectId/task-instances`
- **Assertion**: Returns array with all instances, statuses, dates

#### T8.1.2 View responses for instance
- **Setup**: Instance with saved responses
- **Action**: GET `/api/task-instances/:id/responses`
- **Assertion**: Returns all question-response pairs

---

### 8.2 Resend & Extend

#### T8.2.1 Resend link - New token
- **Setup**: Sent instance
- **Action**: POST `/api/task-instances/:id/resend`
- **Assertion**: New token created; old token marked as superseded

#### T8.2.2 Cannot resend submitted task
- **Setup**: Submitted instance
- **Action**: POST resend
- **Assertion**: Returns 400 "Cannot resend link for submitted task"

#### T8.2.3 Extend token expiry
- **Setup**: Token with near expiry
- **Action**: POST `/api/task-tokens/:tokenId/extend` with `additionalDays: 7`
- **Assertion**: Token expiresAt extended by 7 days

---

## 9. Conditional Logic in Forms

### 9.1 Visibility Evaluation

#### T9.1.1 Question hidden by condition
- **Setup**: Question with `showIf: { questionId: Q1, operator: "equals", value: "yes" }`, Q1 answered "no"
- **Action**: Fetch visible questions
- **Assertion**: Conditional question not included

#### T9.1.2 Question shown when condition met
- **Setup**: Same as above, Q1 answered "yes"
- **Action**: Fetch visible questions
- **Assertion**: Conditional question included

#### T9.1.3 Hidden question not required
- **Setup**: Conditional question marked as required, but hidden
- **Action**: Submit without answering hidden question
- **Assertion**: Submission succeeds (hidden = not required)

---

## 10. Negative & Edge Cases

### 10.1 Validation

#### T10.1.1 Invalid UUID in path
- **Setup**: None
- **Action**: GET `/api/task-templates/not-a-uuid`
- **Assertion**: Returns 400 "Invalid template ID format"

#### T10.1.2 Token too short
- **Setup**: None
- **Action**: GET `/api/client-task/short`
- **Assertion**: Returns 400 "Invalid token format" (min 32 chars)

---

### 10.2 Concurrent Access

#### T10.2.1 Simultaneous submissions
- **Setup**: Valid token accessed from two "browsers"
- **Action**: Both attempt to submit simultaneously
- **Assertion**: One succeeds, other gets 403 "already submitted"

---

### 10.3 Deleted References

#### T10.3.1 Template deleted after instance created
- **Setup**: Instance referencing a template
- **Action**: Delete template
- **Assertion**: Instance remains (FK cascade or restrict - verify behaviour)

---

## 11. Performance Checks

### 11.1 Batch Operations

#### T11.1.1 Task counts batch API
- **Setup**: 10+ projects with varying task counts
- **Action**: GET `/api/task-instances/counts`
- **Assertion**: Returns counts for all projects in single response; response time < 500ms

---

## 12. Regression Pack (Minimal)

Execute these tests after any change to the Client Project Tasks feature:

| ID | Test | Expected |
|----|------|----------|
| R1 | Create template → Add question → Create instance → Send → Submit | Status = submitted, stage changed |
| R2 | Create override with removed question | Merged questions excludes removed |
| R3 | Pre-project task → Create project | Project starts at target stage |
| R4 | Submit with invalid target stage | Task submits with warning |

---

## Execution Checklist

Before marking testing complete:

- [ ] All T*.*.* tests executed with Pass/Fail recorded
- [ ] Any failures documented with reproduction steps
- [ ] Regression pack (R1-R4) passed
- [ ] No silent failures (all errors logged appropriately)
- [ ] Persistence verified by reload/re-fetch after mutations

---

## Change Log

| Date | Change | Impact |
|------|--------|--------|
| 2025-12-20 | Initial testing plan created | Covers all Phase 1-7 features |
| 2025-12-20 | Added pre-project task tests | T6.*.* section |
| 2025-12-20 | Added stage change priority tests | T5.1.* section |
