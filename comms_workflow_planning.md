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

### 9️⃣ Manual Overrides & Auditability 🔄 TO DO
- Users can add/remove classifications manually
- Track overrides: who changed what and why
- Re-evaluate completion rules after changes

### 🔟 Retro Adding of Emails 🔄 TO DO
- Ability to bring emails into system that didn't pass Customer Gate
- Query full inbox through Graph API
- Use case: client changes email, new person joins team

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

## Next Up
**Stage 9: Manual Overrides & Auditability**
