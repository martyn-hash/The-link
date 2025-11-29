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

### 5. Stage Change Notifications ✅ CORE COMPLETE (Stage 1 Done)

**Key Files:**
- `client/src/components/stage-change-notification-modal.tsx`
- `client/src/components/status-change-form.tsx`
- `client/src/components/ChangeStatusModal.tsx`
- `server/storage/notifications/stageChangeNotificationStorage.ts`

**Current Behavior (Fixed Nov 29, 2025):**
When a stage change occurs, staff are now shown the `StageChangeNotificationModal` for review before sending. Notifications are no longer auto-sent.

**What Works:**
- ✅ Modal shown to staff for approval before sending
- ✅ TiptapEditor for rich text editing of email body
- ✅ Editable subject line and push notification fields
- ✅ "Send Notification" and "Don't Send" (suppress) options
- ✅ Recipients list display
- ✅ LSP errors fixed in stageChangeNotificationStorage.ts

**What's Still Missing (Stage 2+):**
- Multi-recipient selection not implemented
- AI voice recording feature not implemented
- Client-facing stage notifications (currently staff only)

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
- **Tab-based view** with Active, Cancelled, Sent, and Failed sections
- **Filtering capabilities:**
  - Category filter (project, stage, service)
  - Type filter (email, SMS, push)
  - Recipient filter (specific contact)
  - Status filter
  - Date range (from/to)
- **Bulk selection** for batch cancel operations
- **Preview dialog** to view notification content before sending
- **Table view** showing:
  - Notification type and category
  - Recipient name and contact info
  - Scheduled date/time
  - Status with color-coded badges
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

This section provides a comprehensive breakdown of what's needed to fully complete the stage change notification feature.

### Currently Working ✅
- [x] Template creation in project type settings (via StageNotificationForm with TiptapEditor)
- [x] Template variable replacement ({{client.name}}, {{project.name}}, etc.)
- [x] Stage trigger configuration (on_entry, on_exit)
- [x] Notification preview generation on stage change
- [x] Backend endpoint to send stage change notifications
- [x] Database schema for tracking sent notifications
- [x] **Show modal to staff before sending** ✅ FIXED Nov 29, 2025
- [x] **TiptapEditor in edit modal** ✅ FIXED Nov 29, 2025
- [x] **LSP errors in storage file** ✅ FIXED Nov 29, 2025

### Not Implemented ❌
- [ ] **Multi-recipient selection** - Can only send to single assigned user
- [ ] **AI voice recording** - Speak to draft, OpenAI rewrites to template
- [ ] **Client-facing stage notifications** - Currently only notifies staff
- [ ] **Notification suppression toggle** - Quick bypass for routine changes

### Backend Components
| Component | Status | File |
|-----------|--------|------|
| Stage notification storage | ✅ Working | `stageChangeNotificationStorage.ts` |
| Notification preview generation | ✅ Working | `notification-sender.ts` |
| Send notification endpoint | ✅ Working | `server/routes.ts` |
| Variable replacement | ✅ Working | `notification-variables.ts` |

### Frontend Components
| Component | Status | File |
|-----------|--------|------|
| StageChangeNotificationModal | ✅ Shows with TiptapEditor | `stage-change-notification-modal.tsx` |
| ChangeStatusModal | ✅ Shows modal before sending | `ChangeStatusModal.tsx` |
| StatusChangeForm | ✅ Shows modal before sending | `status-change-form.tsx` |
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
| `scheduled-notifications.tsx` | Calendar view UI (global scheduled notifications) |
| `ClientNotificationsView.tsx` | Client-specific notifications view (in client detail) |
| `stage-change-notification-modal.tsx` | Modal for stage change notification review |
| `ChangeStatusModal.tsx` | Modal for changing project stage (triggers notifications) |
| `status-change-form.tsx` | Form for status changes (also triggers notifications) |
| `notification-scheduler.ts` | Schedules notifications for services/projects |
| `notification-sender.ts` | Sends notifications via email/SMS/push |
| `notification-cron.ts` | Hourly cron job for processing due notifications |
| `StageNotificationForm.tsx` | Form for creating stage notification templates |
| `ProjectNotificationForm.tsx` | Form for creating project notification templates |
| `TiptapEditor.tsx` | Rich text editor component |
| `ClientPersonSelectionModal.tsx` | Person selection for notification preview |
| `stageChangeNotificationStorage.ts` | Database operations for stage change notifications |
| `shared/schema/notifications/tables.ts` | Notification database schema |
| `notification-variables.ts` | Variable replacement logic |
| `NotificationVariableGuide.tsx` | UI guide showing available template variables |
| `userNotificationPreferencesStorage.ts` | User opt-in/out preferences |
| `super-admin-dropdown.tsx` | Super admin menu (now includes calendar link) |

---

## Recommended Implementation Order

### Completed ✅
1. ~~**Stage 1.3** - Fix LSP errors~~ ✅ Done Nov 29, 2025
2. ~~**Stage 1.1** - Fix stage change notification flow~~ ✅ Done Nov 29, 2025
3. ~~**Stage 1.2** - Add TiptapEditor to modal~~ ✅ Done Nov 29, 2025

### Next Up
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
