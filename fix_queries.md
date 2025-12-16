# Query Response Tokens & Scheduled Reminders - Bug Analysis and Fix Plan

## Executive Summary

There are **three critical bugs** affecting the bookkeeping query system:

1. **Token recipient emails are stored as placeholder** - Emails store `pending@placeholder.com` instead of real recipient email
2. **Scheduled reminders are not being created** - The reminder schedule configured in the UI is not being saved to database
3. **Email links failing** - The links in emails don't work (requires investigation of token validation)

---

## Issue 1: Placeholder Emails in Token Table

### Evidence
SQL query shows all recent tokens have `recipient_email = 'pending@placeholder.com'`:
```
id,token,recipient_email
ba7a84e1-81a9-47be-b9e0-0f73eba70ddc,cb5e6da1...,pending@placeholder.com
ab06b9d5-0643-41e7-ac62-43033003a1b1,e26ec617...,pending@placeholder.com
```

### Root Cause Analysis

**Step 1:** Token created in `server/routes/queries.ts` line 927 with placeholder:
```typescript
token = await storage.createQueryResponseToken({
  // ...
  recipientEmail: 'pending@placeholder.com', // PLACEHOLDER!
  // ...
});
```

**Step 2:** Token SHOULD be updated in `mark-sent` route (lines 1159-1163):
```typescript
if (tokenId && recipientEmail) {  // Only updates if recipientEmail is provided!
  await storage.updateQueryResponseToken(tokenId, {
    recipientEmail,
    recipientName: recipientName || null,
  });
}
```

**Step 3:** BUT Frontend in `QueriesTab.tsx` (lines 1061-1064) DOES NOT pass recipientEmail:
```typescript
await apiRequest('POST', `/api/projects/${projectId}/queries/mark-sent`, {
  queryIds: pendingEmailQueryIds,
  tokenId: pendingEmailTokenId,
  // ❌ MISSING: recipientEmail and recipientName are NOT passed!
});
```

### Fix Required

**File: `client/src/components/queries/QueriesTab.tsx`**

Update the `handleEmailSuccess` function to pass recipient data to mark-sent:

```typescript
// Mark queries as sent and log to chronology
await apiRequest('POST', `/api/projects/${projectId}/queries/mark-sent`, {
  queryIds: pendingEmailQueryIds,
  tokenId: pendingEmailTokenId,
  recipientEmail: recipientData?.email,        // ADD THIS
  recipientName: recipientData?.name,          // ADD THIS
});
```

---

## Issue 2: Scheduled Reminders Not Created

### Evidence
SQL query shows zero scheduled reminders for the project:
```sql
SELECT * FROM scheduled_query_reminders WHERE project_id = 'c529a695-afb5-4f9e-a24c-76e373520f17';
-- Result: Empty table
```

### Root Cause Analysis

The reminders API call in `handleEmailSuccess` (lines 1067-1091) checks `configuredReminders.length > 0`, but when `handleEmailSuccess` is called, `configuredReminders` is already empty because:

1. User configures reminders in EmailDialog -> `onRemindersConfigured` is called -> `setConfiguredReminders(newSchedule)` updates state
2. EmailDialog sends email successfully -> calls `onSuccess(recipientData)`
3. `handleEmailSuccess(recipientData)` is invoked **after** the state update cycle
4. But React state updates are asynchronous - when `handleEmailSuccess` runs, `configuredReminders` may be stale

**The actual bug:** Looking at line 1027, `setConfiguredReminders([])` is called BEFORE `setIsEmailDialogOpen(true)`, which means the configured reminders are being reset!

```typescript
// In handleConfirmSendOptions (lines 1022-1028):
setPendingEmailTokenId(includeOnlineLink ? response.tokenId : null);
setPendingEmailQueryIds(sendOptionsQueryIds);
setPendingEmailExpiryDays(includeOnlineLink ? linkExpiryDays : null);
setPendingEmailVoiceAiAvailable(response.voiceAiAvailable ?? false);
setConfiguredReminders([]);  // ❌ THIS RESETS REMINDERS TO EMPTY!
setConfiguredOnCompletionAction(null);
```

Wait, that's correct - reminders should start empty and then be configured in the dialog. The issue is that when `onRemindersConfigured` is called from EmailDialog, the state IS being updated, but then we need to verify the callback chain.

Let me trace through more carefully:

1. `handleConfirmSendOptions` resets `configuredReminders` to `[]` (correct - starting fresh)
2. Email dialog opens
3. User configures reminders in ScheduleReminders component
4. `onScheduleChange(newSchedule)` is called
5. This calls `onRemindersConfigured?.(newSchedule)` which is `setConfiguredReminders`
6. User clicks "Send" in EmailDialog
7. `sendEmailMutation` succeeds, calls `onSuccess?.(recipientData)` 
8. `handleEmailSuccess(recipientData)` is called
9. At this point, `configuredReminders` should have the values

**Actual Issue Found:** The problem is a **race condition/closure issue**. When `handleEmailSuccess` is called, it captures the `configuredReminders` value at the time the callback was created, not the current state value.

### Fix Required

**Option A: Pass reminders through the callback chain (RECOMMENDED)**

Update the EmailDialog's `onSuccess` callback to include the reminder schedule:

**File: `client/src/pages/client-detail/components/communications/dialogs/EmailDialog.tsx`**

In the mutation's onSuccess handler, include the reminderSchedule:

```typescript
onSuccess: () => {
  // ... existing code ...
  const recipientData = primaryRecipient ? {
    email: primaryRecipient.email,
    name: primaryRecipient.fullName || 'Client',
    phone: primaryRecipient.phone || null,
    reminders: reminderSchedule,  // ADD: Include reminder schedule
  } : undefined;
  // ...
  onSuccess?.(recipientData);
},
```

**File: `client/src/components/queries/QueriesTab.tsx`**

Update `handleEmailSuccess` to use reminders from the callback data instead of state:

```typescript
const handleEmailSuccess = async (recipientData?: EmailRecipientData) => {
  if (pendingEmailQueryIds.length > 0) {
    try {
      await apiRequest('POST', `/api/projects/${projectId}/queries/mark-sent`, {
        queryIds: pendingEmailQueryIds,
        tokenId: pendingEmailTokenId,
        recipientEmail: recipientData?.email,
        recipientName: recipientData?.name,
      });
      
      // Use reminders from recipientData (passed from EmailDialog)
      const remindersToSave = recipientData?.reminders || [];
      const enabledReminders = remindersToSave.filter(r => r.enabled);
      
      if (pendingEmailTokenId && enabledReminders.length > 0) {
        try {
          await apiRequest('POST', `/api/projects/${projectId}/queries/reminders`, {
            tokenId: pendingEmailTokenId,
            reminders: enabledReminders.map(r => ({
              scheduledAt: r.scheduledAt,
              channel: r.channel,
            })),
            recipientEmail: recipientData?.email,
            recipientName: recipientData?.name,
            recipientPhone: recipientData?.phone,
            onCompletionAction: configuredOnCompletionAction,
          });
        } catch (reminderError) {
          console.error('Error saving reminders:', reminderError);
        }
      }
      // ... rest of function
    }
  }
};
```

---

## Issue 3: Email Links Failing

### Evidence
User reports clicking link from email: `https://flow.growth.accountants/queries/respond/cb5e6da1ba41022d3441d2a2e1b162550dfffb0840d74cf3fb63a682171d67d2`

### Analysis
The token exists in database:
```
token: cb5e6da1ba41022d3441d2a2e1b162550dfffb0840d74cf3fb63a682171d67d2
expires_at: 2025-12-23 15:54:35.494  (not expired)
completed_at: null (not completed)
```

The route exists: `GET /api/query-response/:token` (line 1314 of queries.ts)
The frontend route exists: `/queries/respond/:token` (App.tsx line 170)

**Possible causes to investigate:**
1. The API route may be returning an error - need to check server logs
2. CORS or authentication issues with the public endpoint
3. Frontend routing issue

### Testing Required
1. Access the URL directly in browser and check network tab for API response
2. Check server logs for any errors when accessing `/api/query-response/cb5e6da1...`
3. Verify the token is being correctly parsed and validated

---

## Files to Modify

1. **`client/src/components/queries/QueriesTab.tsx`**
   - Pass `recipientEmail` and `recipientName` to mark-sent API
   - Update to receive reminders from EmailDialog callback

2. **`client/src/pages/client-detail/components/communications/dialogs/EmailDialog.tsx`**
   - Include `reminderSchedule` in the onSuccess callback data

3. **Update the EmailRecipientData type** (if defined separately)
   - Add `reminders` property to the type

---

## Testing Plan

### Pre-requisites
1. Login as admin@example.com | admin123 via root page -> Passwords tab
2. Navigate to a project with the Queries tab

### Test Case 1: Token Email Storage
1. Upload queries to a project
2. Select queries and click "Send to Client"
3. Configure email with a recipient
4. Send the email
5. **Verify:** Check database - token should have real email, not placeholder

### Test Case 2: Scheduled Reminders Creation
1. Upload queries to a project
2. Select queries and click "Send to Client"
3. Configure 7 days of reminders
4. Send the email
5. **Verify:** Check database - scheduled_query_reminders table should have 7 entries

### Test Case 3: Email Link Works
1. Copy the response link from the token
2. Open in incognito browser
3. **Verify:** Page loads showing the queries to respond to

### Automated E2E Test Requirements
- Navigate to login, use admin@example.com / admin123
- Navigate to a project with queries
- Upload test queries or select existing ones
- Send to client with reminders configured
- Verify token has correct email (via API or database check)
- Verify reminders were created (via API)
- Verify the response link works

---

## Priority

**HIGH** - These bugs completely break the query workflow:
- Clients cannot respond to queries (broken links)
- Staff cannot track who received queries (placeholder emails)
- Reminder system is non-functional (no reminders created)

---

## Approval Requested

Please approve this plan before I begin implementation.
