# Reminders & Notifications Module - Technical Audit & Implementation Roadmap

**Last Updated:** November 30, 2025

---

## Executive Summary

This document provides a comprehensive audit of the reminders and notifications module for the client management system. It covers the current implementation status, identifies gaps, and outlines a staged approach to complete the remaining work.

---

## Email Sending Configuration

| Notification Type | Email Sender | Sender Name Source |
|-------------------|-------------|-------------------|
| **Scheduled Reminders** (due-date, start-date) | SendGrid | `companySettings.emailSenderName` (fallback: "The Link Team") |
| **Stage Change Client Value Notifications** | Outlook (with SendGrid fallback) | Staff's connected Outlook account |
| **Signature Requests** | SendGrid | `companySettings.emailSenderName` |

**Key Implementation Details:**
- Reminders: `notification-sender.ts` line 718 uses `firmSettings?.emailSenderName`
- Stage Notifications: `server/routes/projects.ts` lines 1079-1117 check `preview.senderHasOutlook` and fall back to SendGrid

---

## Stage-Aware Reminder Suppression ✅ COMPLETE (Nov 30, 2025)

Due-date reminders can be configured to only send when a project is in specific stages. This prevents irrelevant reminders from being sent (e.g., "Your accounts are due soon" when the work is already complete).

**How It Works:**
1. **Template Configuration**: Admins select eligible stages when creating notification templates
2. **Initial Scheduling**: Notifications only created if project is currently in an eligible stage
3. **Stage Change Handling**: When project stage changes:
   - If new stage is NOT eligible → Notification is suppressed (status = "suppressed")
   - If new stage IS eligible → Suppressed notification is reactivated (status = "scheduled")
4. **Send-Time Verification**: Double-check at send time to catch edge cases

**Database Fields:**
- `eligibleStageIds` on template (`projectTypeNotifications`) - which stages this notification applies to
- `eligibleStageIdsSnapshot` on scheduled notification - snapshot at creation time
- `suppressedAt` - when notification was suppressed
- `reactivatedAt` - when notification was reactivated

**Key Files:**
- `server/notification-scheduler.ts` - `handleProjectStageChangeForNotifications()`
- `server/notification-sender.ts` - `verifyStageEligibility()`
- `server/routes/projects.ts` - Stage change triggers notification suppression/reactivation

---

## Current Implementation Status

### 1. Calendar View for Scheduled Notifications ✅ COMPLETE

**Location:** `client/src/pages/scheduled-notifications.tsx`

A fully functional calendar view has been built with:
- **Dual view modes:** List view and Calendar grid view with toggle tabs
- **Monthly calendar grid** showing notifications grouped by day
- **Day selection interaction** - clicking a day filters to notifications for that date
- **Comprehensive filtering:**
  - Status (scheduled, sent, failed, cancelled)
  - Client name search
  - Project selection
  - Source type (service-based vs project-based)
  - Date range (from/to)
- **Bulk operations** - multi-select notifications for batch cancel
- **Individual cancel** with confirmation dialog

**Known Limitations:**
- No project type filter (only filters by project instance)
- No week view option
- No export/print functionality
- No color-coding by notification type on calendar cells

---

### 2. Email Notification System ✅ COMPLETE

**Key Files:**
- `server/notification-sender.ts` - Core sending logic
- `server/notification-scheduler.ts` - Scheduling logic
- `server/notification-cron.ts` - Hourly job (07:00-19:00 UK time)

**Features:**
- SendGrid integration for email delivery
- Dynamic variable replacement (client, project, service, staff, firm data)
- Configurable sender name from company settings
- Notification history tracking with status updates
- Pre-validation to avoid wasting API calls on invalid data

---

### 3. Push Notification System ✅ COMPLETE

**Features:**
- Web push subscriptions stored per user
- Push templates configurable per project type
- Push notification service integrated with VAPID keys
- Global toggle in company settings (`pushNotificationsEnabled`)

---

### 4. SMS Notification System ✅ COMPLETE

**Location:** `server/notification-sender.ts` (lines 245-332)

**Features:**
- SMS content field in database schema (160 char limit enforced)
- SMS template creation works in UI
- **VoodooSMS integration fully implemented** (Nov 29, 2025)
- UK phone number formatting (+44 format)
- Proper error handling and success/failure tracking
- Supports merge field processing for personalized SMS content
- SMS sending in both scheduled reminders and stage change client value notifications

**Requirements:**
- `VOODOO_SMS_API_KEY` environment variable must be configured

---

### 5. Stage Change Notifications ✅ FULLY COMPLETE (All Stages Done)

**Key Files:**
- `client/src/components/ChangeStatusModal.tsx` - Main status modal with single-dialog UX
- `client/src/components/ClientValueNotificationContent.tsx` - Client-facing notification UI
- `client/src/components/StageNotificationAudioRecorder.tsx` - AI voice recording component
- `server/storage/notifications/stageChangeNotificationStorage.ts`
- `server/notification-variables.ts` - Merge field processing (25+ variables)
- `server/routes/projects.ts` - Send notification endpoint with Outlook/SendGrid

**Current Behavior (Completed Nov 29, 2025):**
When a stage change occurs, staff are shown a Client Value Notification modal to send CLIENT-FACING notifications to client contacts (directors, shareholders, etc.).

**Single-Modal UX:**
The ChangeStatusModal uses a single Dialog that transitions between two views:
1. **Stage Change Form** - User selects new stage, reason, notes, etc.
2. **Client Value Notification** - After stage change succeeds, shows notification approval

Key flow:
- User submits stage change → API call commits immediately
- Success toast appears confirming stage change
- Same modal transitions to show client notification content
- User can: Skip (close), Don't Send (suppress & log), or Select Channels to Send
- All actions close the entire modal

**What Works:**
- ✅ Single-modal UX (no stacked dialogs)
- ✅ Stage change commits immediately with success toast before notification decision
- ✅ **Multi-recipient selection** - Select multiple client contacts with role badges
- ✅ **AI-assisted message drafting** - Voice recording with OpenAI Whisper + GPT-4o-mini
- ✅ **AI text refinement** - Quick text prompts to refine email content (added Nov 29, 2025)
- ✅ **Client-facing notifications** - Sends to directors, shareholders, contacts (not staff)
- ✅ **Outlook integration** - Sends from staff's connected Outlook account
- ✅ **SendGrid fallback** - Falls back to SendGrid if no Outlook
- ✅ TiptapEditor for rich text editing of email body
- ✅ Editable subject line with merge field support
- ✅ **Comprehensive merge fields** - 25+ variables ({client_company_name}, {project_name}, etc.)
- ✅ **Stage approval variables** - `{stage_approval:ApprovalName}` syntax for referencing approval data (added Nov 29, 2025)
- ✅ Per-channel controls (Email enabled, SMS enabled via VoodooSMS)
- ✅ Template lookup from project_type_notifications table
- ✅ Stage lookup scoped by projectTypeId (avoids cross-type conflicts)
- ✅ Recipients show role badges, primary contact indicators, opt-out status
- ✅ Sender status indicator showing Outlook connection
- ✅ Skip, Don't Send (Log as Suppressed), and Select a Channel options
- ✅ **2-column layout** - Recipients/AI on left (35%), email content on right (65%) (added Nov 29, 2025)

**AI Text Refinement (Added Nov 29, 2025):**
Alongside voice recording, users can enter quick text prompts like "Make it more formal" or "Add a thank you at the end" to refine the email content. The `/api/ai/refine-email` endpoint processes these requests with stage approval context.

**Stage Approval Variables (Added Nov 29, 2025):**
Notification templates can now reference stage approval data from any stage using the `{stage_approval:ApprovalName}` syntax. The system:
- Fetches all approval responses for the project
- Groups them by approval name
- Formats the data as a readable list showing field names and values
- Supports boolean, number, long_text, and multi_select field types

Example usage in template:
```
{stage_approval:Quality Control Review}
```
This renders all fields from the "Quality Control Review" approval as formatted text.

**SMS Status:** ✅ Fully implemented via VoodooSMS (Nov 29, 2025)

---

### 6. Opt-In/Opt-Out System ✅ COMPLETE

**Client Contacts (People):**
- `receiveNotifications` boolean on `people` table
- Toggle on person detail page
- Filtered in `notification-scheduler.ts`

**Staff Users:**
- `userNotificationPreferences` table with toggles for:
  - `notifyStageChanges`
  - `notifyNewProjects`
  - `notifySchedulingSummary`
- Profile page preferences UI

**Project Type Level:**
- `notificationsActive` toggle to disable all notifications for a project type

**Company Level:**
- `pushNotificationsEnabled` global push notification toggle

---

### 7. TiptapEditor Integration ✅ COMPLETE

**Where TiptapEditor IS Used:**
- `StageNotificationForm.tsx` - creating stage notification templates
- `ProjectNotificationForm.tsx` - creating project notification templates
- `ReminderForm.tsx` - creating reminder templates
- `stage-change-notification-modal.tsx` - editing email body before sending (added Nov 29, 2025)
- Communications, project notes, various other forms

---

### 8. Notification Variable System ✅ COMPLETE

**Location:** `server/notification-variables.ts`, `client/src/components/NotificationVariableGuide.tsx`

**Available Variables:**
- Client: `{{client.name}}`, `{{client.email}}`, `{{client.phone}}`, `{{client.address}}`
- Project: `{{project.name}}`, `{{project.due_date}}`, `{{project.start_date}}`
- Service: `{{service.name}}`, `{{service.frequency}}`, `{{service.period_start}}`
- Staff: `{{project_owner.name}}`, `{{assigned_staff.name}}`, `{{assigned_staff.email}}`
- Firm: `{{firm.name}}`, `{{firm.phone}}`, `{{firm.email}}`

---

### 9. Client Detail UI - Notifications Tab ✅ COMPLETE

**Location:** `client/src/pages/client-detail/components/tabs/RiskTab.tsx`

The client detail page includes a comprehensive notifications view accessible via the Risk/Notifications tab toggle:

**Component:** `ClientNotificationsView` (`client/src/components/ClientNotificationsView.tsx`)

**Features:**
- **Tab-based view** with Active, Suppressed, Cancelled, Sent, and Failed sections (Nov 30, 2025)
- **Filtering capabilities:**
  - Category filter (project, stage, service)
  - Type filter (email, SMS, push)
  - Recipient filter (specific contact)
  - Status filter
  - Date range (from/to)
- **Bulk selection** for batch cancel and reactivate operations
- **Per-row action buttons** (Nov 30, 2025):
  - Active tab: Preview, Cancel
  - Suppressed tab: Preview, Reactivate (with stage-aware tooltip explanation)
  - Cancelled tab: Preview, Reactivate (only for future-dated notifications)
  - Failed tab: Preview, Retry
- **Stage-aware tooltips** - Suppressed status badges include tooltips explaining why the notification was suppressed (e.g., "This notification was suppressed because the project moved to a stage where this reminder isn't active.")
- **Preview dialog** to view notification content before sending
- **Table view** showing:
  - Notification type and category
  - Recipient name and contact info
  - Scheduled date/time
  - Status with color-coded badges (including amber for suppressed)
  - Project type association
- **Client-specific API endpoint:** `/api/scheduled-notifications/client/{clientId}`

**UI Location:** Client Detail Page → Risk Tab → Toggle to "Notifications" view

---

### 10. Calendar View UI Access ✅ NOW LINKED (Super Admin Only)

**Status:** The calendar page is fully built and now accessible via the Super Admin dropdown menu.

**Routes:**
- `/scheduled-notifications` (primary)
- `/admin/scheduled-notifications` (alternate)

**UI Access:** Super Admin dropdown → "Scheduled Notifications" (with Calendar icon)

**Future:** Move to main logo menu for all staff access once testing is complete.

---

## Stage Change Notifications - Detailed Completion Checklist

This section provides a comprehensive breakdown of the stage change notification feature. **ALL ITEMS NOW COMPLETE.**

### All Features Complete ✅
- [x] Template creation in project type settings (via StageNotificationForm with TiptapEditor)
- [x] Template variable replacement ({client_company_name}, {project_name}, etc.) - uses single braces
- [x] Stage trigger configuration (on_entry, on_exit)
- [x] Notification preview generation on stage change
- [x] Backend endpoint to send stage change notifications
- [x] Database schema for tracking sent notifications
- [x] Show modal to staff before sending ✅ FIXED Nov 29, 2025
- [x] TiptapEditor in edit modal ✅ FIXED Nov 29, 2025
- [x] LSP errors in storage file ✅ FIXED Nov 29, 2025
- [x] **Multi-recipient selection** ✅ IMPLEMENTED Nov 29, 2025
- [x] **AI voice recording** ✅ IMPLEMENTED Nov 29, 2025 (OpenAI Whisper + GPT-4o-mini)
- [x] **Client-facing stage notifications** ✅ IMPLEMENTED Nov 29, 2025
- [x] **Notification suppression** ✅ "Don't Send (Log as Suppressed)" option

### Backend Components
| Component | Status | File |
|-----------|--------|------|
| Stage notification storage | ✅ Working | `stageChangeNotificationStorage.ts` |
| Notification preview generation | ✅ Working | `prepareClientValueNotification()` |
| Send notification endpoint | ✅ Working | `server/routes/projects.ts` |
| Variable replacement | ✅ Working | `notification-variables.ts` (25+ merge fields) |
| Outlook integration | ✅ Working | Microsoft Graph API in projects.ts |
| SendGrid fallback | ✅ Working | Falls back if no Outlook |
| AI transcription/drafting | ✅ Working | `server/routes/ai.ts` |

### Frontend Components
| Component | Status | File |
|-----------|--------|------|
| ClientValueNotificationContent | ✅ Main client notification UI | `ClientValueNotificationContent.tsx` |
| StageNotificationAudioRecorder | ✅ AI voice recording | `StageNotificationAudioRecorder.tsx` |
| ChangeStatusModal | ✅ Single-modal UX | `ChangeStatusModal.tsx` |
| StageNotificationForm (template) | ✅ Working | `StageNotificationForm.tsx` |

---

## Implementation Roadmap

### Stage 1: Critical Fixes ✅ COMPLETED (Nov 29, 2025)

All Stage 1 items have been completed and verified with e2e testing.

#### 1.1 Fix Stage Change Notification Flow ✅ DONE
**Status:** Complete
**What was done:** 
- Modified `status-change-form.tsx` to show `StageChangeNotificationModal` before sending
- ChangeStatusModal already had correct implementation
- Staff can now review, edit, or suppress notifications before they go out

#### 1.2 Integrate TiptapEditor in Stage Change Modal ✅ DONE
**Status:** Complete
**What was done:** Replaced `<Textarea>` with `<TiptapEditor>` in stage-change-notification-modal.tsx
- Full rich text toolbar (bold, italic, underline, lists, tables, headings, etc.)
- Consistent editing experience with template creation forms

#### 1.3 Fix LSP Errors in stageChangeNotificationStorage ✅ DONE
**Status:** Complete
**What was done:** Added type annotations for Drizzle query results in stageChangeNotificationStorage.ts

---

### Stage 2: Feature Completion ✅ COMPLETED (Nov 29, 2025)

#### 2.1 Implement Multi-Recipient Selection ✅ DONE
**Status:** Complete
**What was done:**
- ClientValueNotificationContent shows all client contacts (directors, shareholders, etc.)
- Recipients displayed with role badges, primary contact indicators, opt-out status
- Multi-select via emailRecipientIds and smsRecipientIds arrays
- Backend handles sending to multiple recipients

#### 2.2 Implement VoodooSMS Integration ✅ DONE
**Status:** Complete (Nov 29, 2025)
**What was done:**
- Updated `sendSMSNotification` in `notification-sender.ts` to use VoodooSMS API
- Added phone number formatting for UK numbers (+44 format)
- Enabled SMS channel in `ClientValueNotificationContent.tsx` (removed "Coming Soon" badge)
- Added SMS sending logic to stage change notification endpoint in `server/routes/projects.ts`
- Supports merge field processing for personalized SMS content
- Proper error handling and success/failure tracking

**Files Modified:**
- `server/notification-sender.ts`
- `client/src/components/ClientValueNotificationContent.tsx`
- `server/routes/projects.ts`

**Requirements:**
- VOODOO_SMS_API_KEY environment variable must be configured

#### 2.3 Add Client-Facing Stage Change Notifications ✅ DONE
**Status:** Complete
**What was done:**
- Full "Client Value ,a nd Notification" system implemented
- Notifications target client contacts (directors, shareholders), not staff
- Respects receiveNotifications opt-out preference
- Templates loaded from project_type_notifications table

---

### Stage 3: Enhanced Features ✅ MOSTLY COMPLETE (Nov 29, 2025)

#### 3.1 AI Voice Recording for Message Drafting ✅ DONE
**Status:** Complete
**What was done:**
- StageNotificationAudioRecorder component with Web Audio API
- OpenAI Whisper transcription via /api/ai/transcribe-for-notification
- GPT-4o-mini rewrites transcription into professional notification
- Two modes: Notes (bullet points) and Email (formal with subject/body)
- Passes existing subject/body to AI for merge field context awareness
- System prompts configurable in Company Settings

**Files Created:**
- `client/src/components/StageNotificationAudioRecorder.tsx`
- `server/routes/ai.ts` (transcribe-for-notification endpoint)

#### 3.2 Add Project Type Filter to Calendar View ⏳ OUTSTANDING
**Complexity:** Low | **Impact:** Low | **Effort:** 1-2 hours

**Current Issue:** Can filter by project but not by project type
**Solution:** Add project type dropdown filter

**Files to Modify:**
- `client/src/pages/scheduled-notifications.tsx`
- Possibly `server/routes.ts` for API support

---

### Stage 4: Polish & Enhancements (Low Impact, Variable Complexity)

These are nice-to-have improvements.

#### 4.1 Add Week View to Calendar ⏳ OUTSTANDING
**Complexity:** Medium | **Impact:** Low | **Effort:** 2-3 hours

#### 4.2 Export/Print Scheduled Notifications ⏳ OUTSTANDING
**Complexity:** Medium | **Impact:** Low | **Effort:** 2-3 hours

#### 4.3 Color-Code Calendar by Notification Type ⏳ OUTSTANDING
**Complexity:** Low | **Impact:** Low | **Effort:** 1 hour

#### 4.4 Add Notification Analytics Dashboard ⏳ OUTSTANDING
**Complexity:** High | **Impact:** Medium | **Effort:** 8-12 hours

---

## Important Files Reference

| File | Purpose |
|------|---------|
| `scheduled-notifications.tsx` | Calendar view UI (global scheduled notifications) |
| `ClientNotificationsView.tsx` | Client-specific notifications view (in client detail) |
| `ClientValueNotificationContent.tsx` | **NEW** - Client value notification UI with recipients |
| `StageNotificationAudioRecorder.tsx` | **NEW** - AI voice recording for message drafting |
| `ChangeStatusModal.tsx` | Modal for changing project stage (triggers notifications) |
| `status-change-form.tsx` | Form for status changes (also triggers notifications) |
| `notification-scheduler.ts` | Schedules notifications for services/projects |
| `notification-sender.ts` | Sends notifications via email/SMS/push |
| `notification-cron.ts` | Hourly cron job for processing due notifications |
| `StageNotificationForm.tsx` | Form for creating stage notification templates |
| `ProjectNotificationForm.tsx` | Form for creating project notification templates |
| `TiptapEditor.tsx` | Rich text editor component |
| `stageChangeNotificationStorage.ts` | Database operations + prepareClientValueNotification |
| `shared/schema/notifications/tables.ts` | Notification database schema |
| `notification-variables.ts` | Variable replacement logic (25+ merge fields) |
| `NotificationVariableGuide.tsx` | UI guide showing available template variables |
| `userNotificationPreferencesStorage.ts` | User opt-in/out preferences |
| `super-admin-dropdown.tsx` | Super admin menu (now includes calendar link) |
| `server/routes/ai.ts` | AI endpoints including transcribe-for-notification |
| `server/routes/projects.ts` | Send client notification endpoint with Outlook/SendGrid |

---

## Recommended Implementation Order

### Completed ✅
1. ~~**Stage 1.3** - Fix LSP errors~~ ✅ Done Nov 29, 2025
2. ~~**Stage 1.1** - Fix stage change notification flow~~ ✅ Done Nov 29, 2025
3. ~~**Stage 1.2** - Add TiptapEditor to modal~~ ✅ Done Nov 29, 2025
4. ~~**Stage 2.1** - Multi-recipient selection~~ ✅ Done Nov 29, 2025
5. ~~**Stage 2.3** - Client-facing stage notifications~~ ✅ Done Nov 29, 2025
6. ~~**Stage 3.1** - AI voice recording~~ ✅ Done Nov 29, 2025

7. ~~**Stage 2.2** - Implement VoodooSMS integration~~ ✅ Done Nov 29, 2025

### Outstanding
8. **Stage 3.2** - Project type filter for calendar view
9. **Stage 4.x** - Polish items (week view, export, color-coding, analytics)

---

## Notes

- All scheduled notifications run between 07:00-19:00 UK time (Europe/London timezone)
- SendGrid is the email provider; credentials should be in environment variables
- VoodooSMS is the SMS provider; VOODOO_SMS_API_KEY must be configured as environment variable
- Push notifications require VAPID keys (already configured)
