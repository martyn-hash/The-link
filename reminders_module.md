# Reminders & Notifications Module - Technical Audit & Implementation Roadmap

**Last Updated:** November 29, 2025

---

## Executive Summary

This document provides a comprehensive audit of the reminders and notifications module for the client management system. It covers the current implementation status, identifies gaps, and outlines a staged approach to complete the remaining work.

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

### 4. SMS Notification System ⚠️ PLACEHOLDER ONLY

**Location:** `server/notification-sender.ts` (line ~252)

**Current Status:**
- SMS content field exists in database schema (160 char limit enforced)
- SMS template creation works in UI
- **SMS is NOT actually being sent** - only logged to console
- VoodooSMS integration code is placeholder/stub

```typescript
// TODO: Implement VoodooSMS integration
// For now, this is a placeholder that logs the SMS
```

---

### 5. Stage Change Notifications ⚠️ PARTIALLY COMPLETE

**Key Files:**
- `client/src/components/stage-change-notification-modal.tsx`
- `client/src/components/status-change-form.tsx`
- `client/src/components/ChangeStatusModal.tsx`
- `server/storage/notifications/stageChangeNotificationStorage.ts`

**Current Behavior (Problem):**
When a stage change occurs, notifications are **automatically sent without staff review**. The `StageChangeNotificationModal` component exists but is bypassed:

```typescript
// status-change-form.tsx line 214
// If there's a notification preview, automatically send it without user approval
if (preview) {
  await apiRequest("POST", `/api/projects/${project.id}/send-stage-change-notification`, ...);
}
```

**What Exists:**
- Modal component with recipients list display
- Editable subject and body fields (plain textarea)
- Editable push notification title/body
- "Send" and "Don't Send" buttons

**What's Missing:**
- Modal not being shown to users for approval before sending
- Uses plain `<Textarea>` instead of TiptapEditor for rich text
- Multi-recipient selection not implemented
- AI voice recording feature not implemented

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

### 7. TiptapEditor Integration ⚠️ PARTIALLY COMPLETE

**Where TiptapEditor IS Used:**
- `StageNotificationForm.tsx` - creating stage notification templates
- `ProjectNotificationForm.tsx` - creating project notification templates
- `ReminderForm.tsx` - creating reminder templates
- Communications, project notes, various other forms

**Where TiptapEditor is MISSING:**
- `stage-change-notification-modal.tsx` - uses plain Textarea for email body editing

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

## Implementation Roadmap

### Stage 1: Critical Fixes (High Impact, Medium Complexity)

These items fix broken or incomplete core functionality.

#### 1.1 Fix Stage Change Notification Flow
**Complexity:** Medium | **Impact:** High | **Effort:** 2-4 hours

**Current Issue:** Notifications auto-send without staff review
**Solution:** 
- Modify `status-change-form.tsx` and `ChangeStatusModal.tsx` to show `StageChangeNotificationModal` before sending
- Allow staff to review, edit, or suppress notifications before they go out
- Add "Don't notify" checkbox option to bypass modal for quick changes

**Files to Modify:**
- `client/src/components/status-change-form.tsx`
- `client/src/components/ChangeStatusModal.tsx`
- `client/src/components/stage-change-notification-modal.tsx`

---

#### 1.2 Integrate TiptapEditor in Stage Change Modal
**Complexity:** Low | **Impact:** Medium | **Effort:** 1-2 hours

**Current Issue:** Plain textarea for editing rich email content
**Solution:** Replace `<Textarea>` with `<TiptapEditor>` in stage-change-notification-modal.tsx

**Files to Modify:**
- `client/src/components/stage-change-notification-modal.tsx`

---

#### 1.3 Fix LSP Errors in stageChangeNotificationStorage
**Complexity:** Low | **Impact:** Low | **Effort:** 30 minutes

**Current Issue:** 16 TypeScript/LSP errors in this file
**Solution:** Review and fix type errors

**Files to Modify:**
- `server/storage/notifications/stageChangeNotificationStorage.ts`

---

### Stage 2: Feature Completion (Medium Impact, Medium-High Complexity)

These items complete partially-implemented features.

#### 2.1 Implement Multi-Recipient Selection
**Complexity:** Medium-High | **Impact:** Medium | **Effort:** 3-5 hours

**Current Issue:** Stage notifications only go to single assigned user
**Solution:**
- Modify `ClientPersonSelectionModal` to support checkboxes (multi-select)
- Add multi-recipient selection to stage change notification modal
- Update send logic to handle multiple recipients

**Files to Modify:**
- `client/src/components/ClientPersonSelectionModal.tsx`
- `client/src/components/stage-change-notification-modal.tsx`
- `server/routes.ts` (notification sending endpoint)

---

#### 2.2 Implement VoodooSMS Integration
**Complexity:** Medium | **Impact:** Medium | **Effort:** 3-4 hours

**Current Issue:** SMS sending is placeholder only
**Solution:**
- Complete VoodooSMS API integration
- Add proper error handling and status tracking
- Test with real SMS delivery

**Files to Modify:**
- `server/notification-sender.ts`
- Possibly add `server/sms-service.ts`

**Requirements:**
- VoodooSMS API credentials (environment variable)
- API documentation review

---

#### 2.3 Add Client-Facing Stage Change Notifications
**Complexity:** Medium | **Impact:** Medium | **Effort:** 4-6 hours

**Current Issue:** Stage notifications only target staff, not clients
**Solution:**
- Add option in project type notification settings for client notifications on stage changes
- Create separate template configuration for client-facing messages
- Respect client opt-out preferences

**Files to Modify:**
- `shared/schema/notifications/tables.ts`
- `server/notification-sender.ts`
- `client/src/pages/project-type-detail/components/tabs/NotificationsTab.tsx`

---

### Stage 3: Enhanced Features (Medium Impact, High Complexity)

These are new features that add significant value.

#### 3.1 AI Voice Recording for Message Drafting
**Complexity:** High | **Impact:** Medium | **Effort:** 6-10 hours

**Feature:** Staff speaks into device, audio transcribed and rewritten into professional template

**Implementation:**
- Add voice recording button to notification modal
- Integrate Web Audio API for recording
- Send audio to OpenAI Whisper for transcription
- Use GPT to rewrite transcription into professional notification format
- Pre-populate email/SMS fields with AI-generated content

**Files to Create/Modify:**
- New: `client/src/components/VoiceRecorder.tsx`
- New: `server/ai-message-service.ts`
- Modify: `client/src/components/stage-change-notification-modal.tsx`

**Requirements:**
- OpenAI API key with Whisper and GPT access

---

#### 3.2 Add Project Type Filter to Calendar View
**Complexity:** Low | **Impact:** Low | **Effort:** 1-2 hours

**Current Issue:** Can filter by project but not by project type
**Solution:** Add project type dropdown filter

**Files to Modify:**
- `client/src/pages/scheduled-notifications.tsx`
- Possibly `server/routes.ts` for API support

---

### Stage 4: Polish & Enhancements (Low Impact, Variable Complexity)

These are nice-to-have improvements.

#### 4.1 Add Week View to Calendar
**Complexity:** Medium | **Impact:** Low | **Effort:** 2-3 hours

#### 4.2 Export/Print Scheduled Notifications
**Complexity:** Medium | **Impact:** Low | **Effort:** 2-3 hours

#### 4.3 Color-Code Calendar by Notification Type
**Complexity:** Low | **Impact:** Low | **Effort:** 1 hour

#### 4.4 Add Notification Analytics Dashboard
**Complexity:** High | **Impact:** Medium | **Effort:** 8-12 hours

---

## Important Files Reference

| File | Purpose |
|------|---------|
| `scheduled-notifications.tsx` | Calendar view UI |
| `stage-change-notification-modal.tsx` | Modal for stage change notification review |
| `notification-scheduler.ts` | Schedules notifications for services/projects |
| `notification-sender.ts` | Sends notifications via email/SMS/push |
| `notification-cron.ts` | Hourly cron job for processing due notifications |
| `StageNotificationForm.tsx` | Form for creating stage notification templates |
| `TiptapEditor.tsx` | Rich text editor component |
| `ClientPersonSelectionModal.tsx` | Person selection for notification preview |
| `stageChangeNotificationStorage.ts` | Database operations for stage change notifications |
| `shared/schema/notifications/tables.ts` | Notification database schema |
| `notification-variables.ts` | Variable replacement logic |
| `userNotificationPreferencesStorage.ts` | User opt-in/out preferences |

---

## Recommended Implementation Order

1. **Stage 1.3** - Fix LSP errors (quick win, clears errors)
2. **Stage 1.1** - Fix stage change notification flow (highest impact)
3. **Stage 1.2** - Add TiptapEditor to modal (quick enhancement)
4. **Stage 2.2** - Implement SMS sending (completes core channels)
5. **Stage 2.1** - Multi-recipient selection (enhances usability)
6. **Stage 2.3** - Client-facing stage notifications (expands functionality)
7. **Stage 3.2** - Project type filter (quick calendar improvement)
8. **Stage 3.1** - AI voice recording (advanced feature)
9. **Stage 4.x** - Polish items as time permits

---

## Notes

- All scheduled notifications run between 07:00-19:00 UK time (Europe/London timezone)
- SendGrid is the email provider; credentials should be in environment variables
- VoodooSMS credentials will need to be added when implementing SMS
- Push notifications require VAPID keys (already configured)
