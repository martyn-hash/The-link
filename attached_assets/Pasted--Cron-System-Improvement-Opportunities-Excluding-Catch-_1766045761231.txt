# Cron System Improvement Opportunities (Excluding Catch-Up Logic)

## Context

The Link currently runs a large number of cron jobs inside the **main application process**.  
Logs show frequent `[NODE-CRON] missed execution` warnings, even with a low active user count (~12 users).

This strongly suggests **event loop blocking, DB contention, and cron contention**, not scale-related load.

This document outlines **concrete improvement opportunities** to stabilise cron execution, reduce load, and improve perceived app performance.

---

## 1. Separate Cron Execution from the Web App

**Problem**
- Cron jobs run in the same Node.js process as HTTP requests.
- Heavy jobs (cache rebuilds, inbox scans, reminder scans) block the event loop.
- Results in:
  - Missed cron executions
  - Slow UI loads
  - DB pool starvation

**Improvement**
- Move cron execution into a **dedicated worker process**:
  - Same codebase
  - Separate entrypoint (`cron-worker.ts`)
  - Same database
- Web app should *never* execute cron handlers.

**Outcome**
- UI responsiveness becomes independent of cron load
- Missed executions should drop to near-zero
- Clear separation of concerns

---

## 2. Reduce Cron Frequency via Event-Driven Triggers

### 2.1 Project Message Reminders (Every 10 min)

**Current**
- Polls every 10 minutes for unread messages

**Better Approach**
- Event-driven model:
  - On message creation → mark conversation as “unread”
  - On read → clear unread flag
- Optional fallback cron once per hour as safety net

**Outcome**
- Eliminates constant polling
- Reduces DB reads dramatically
- Faster notifications

---

### 2.2 SentItemsDetection (Every 10 min)

**Current**
- Scans Outlook Sent Items repeatedly

**Improvement Options**
- Track `last_checked_at` per mailbox
- Process only *delta since last scan*
- Back off frequency when mailbox inactive

**Outcome**
- Smaller scans
- Lower API + DB pressure

---

## 3. Throttle & Batch High-Volume Jobs

**Problem**
- Some jobs attempt to process *everything* in one execution
- Causes:
  - Long DB locks
  - Pool exhaustion
  - Event loop stalls

**Improvements**
- Introduce **batch sizes**:
  - Example: 50–100 rows per loop
- Yield back to event loop between batches (`await setImmediate`)
- Record progress checkpoints

**Affected Jobs**
- ReminderNotificationCron
- QueryReminderCron
- DashboardCache jobs

**Outcome**
- Predictable execution times
- Lower lock contention
- Fewer missed schedules

---

## 4. De-Duplicate Overlapping Cron Responsibilities

**Observation**
Several crons overlap in purpose and timing:

| Area | Jobs |
|-----|-----|
| Reminders | NotificationCron, ReminderNotificationCron, QueryReminderCron |
| Caching | DashboardCacheOvernight + Hourly + ViewCache* |
| Messaging | ProjectMessageReminders + inbox scans |

**Improvement**
- Consolidate where possible:
  - One “Notification Engine” cron
  - One “Cache Coordinator” cron
- Internal routing instead of separate schedules

**Outcome**
- Fewer concurrent cron executions
- Easier reasoning & debugging
- Reduced DB contention

---

## 5. Tighten Advisory Lock Strategy

**Problem**
- Locks are currently **fail-open**
- If lock acquisition fails, job may still run
- Under load, this can cause:
  - Duplicate work
  - Extra DB load

**Improvements**
- Make lock behaviour configurable per job:
  - Critical jobs → fail-closed
  - Non-critical → fail-open
- Log lock contention explicitly as WARN

**Outcome**
- Prevents pile-ups
- Better observability of contention

---

## 6. Add Hard Execution Budgets Per Job

**Problem**
- Some jobs can run indefinitely under bad data conditions

**Improvement**
- Add max execution time (e.g. 30–60 seconds)
- Abort gracefully if exceeded
- Record partial completion

**Outcome**
- Prevents runaway jobs
- Protects event loop

---

## 7. Improve Observability for Root Cause Analysis

**Add Metrics**
- Per-job DB connection usage
- Rows processed per run
- Time spent waiting on locks
- Event loop delay *inside* each job

**Add Correlation**
- Attach `run_id` to:
  - SQL logs
  - External API calls
  - Notification sends

**Outcome**
- Faster diagnosis
- Data-driven optimisation decisions

---

## 8. Perceived Performance Improvements for Users

**Problem**
Users report the app feeling “laggy” despite low usage.

**Likely Cause**
- Heavy cron jobs blocking:
  - Initial dashboard load
  - Project views
  - Inbox rendering

**Immediate Wins**
- Defer non-critical cache rebuilds during business hours
- Serve stale-while-revalidate cache where possible
- Move all heavy crons off the web process

**Outcome**
- Faster initial loads
- Better UX without scaling infra

---

## Summary

This is **not a scale problem** — it’s an **architecture problem**.

Key themes:
- Separate execution contexts
- Reduce polling
- Batch aggressively
- Consolidate overlapping crons
- Protect the event loop

Fixing these will:
- Eliminate missed cron executions
- Improve UI responsiveness
- Reduce DB pressure
- Make future scale predictable

---

