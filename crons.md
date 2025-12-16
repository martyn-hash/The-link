# Cron Jobs Documentation

This document outlines all scheduled background jobs in The Link application, including their timings, purposes, and the safety strategies implemented to ensure reliable execution in autoscaled deployments.

---

## Safety Strategies

All cron jobs in the system are wrapped with `wrapCronHandler()` which provides comprehensive protection:

### 1. Distributed Locking (PostgreSQL Advisory Locks)
- Prevents duplicate execution when multiple instances are running (autoscale deployments)
- Uses 31-bit hash of job name for stable lock IDs
- Fail-open design: if lock acquisition fails, job proceeds (graceful degradation for single instance)
- Automatic lock release on completion or error

### 2. Automatic Retries with Exponential Backoff
- Default: 2 retries (3 total attempts)
- Backoff delays: 1s → 2s → 4s
- Errors are caught and logged, never crash the process

### 3. Structured JSON Telemetry
Every job emits machine-parseable telemetry:
```json
{
  "job_name": "string",
  "run_id": "unique-id",
  "timestamp": "ISO8601",
  "status": "started|success|error|skipped|retrying",
  "drift_ms": 0,
  "duration_ms": 0,
  "lock_acquired": true,
  "lock_wait_ms": 0,
  "retry_count": 0,
  "error_message": "string",
  "event_loop": { "p50_ms": 0, "p95_ms": 0, "max_ms": 0 },
  "memory": { "heap_used_mb": 0, "heap_total_mb": 0, "rss_mb": 0 },
  "process_uptime_sec": 0,
  "concurrent_jobs": ["JobA", "JobB"]
}
```

### 4. Event Loop Monitoring
- 20ms resolution delay histogram
- Reports p50, p95, max delays every 5 minutes
- Detects event loop blocking that could affect job execution

### 5. Schedule Staggering
All jobs are offset from :00 to avoid collisions. Heavy jobs (Dashboard Cache, View Cache) are spaced 5+ minutes apart.

### 6. Error Containment
- Jobs never throw errors to the cron scheduler
- All errors are logged with full context
- Process continues running even after job failures

---

## Cron Job Reference

### Nightly Operations (UTC)

| Job Name | Schedule | Timezone | Description |
|----------|----------|----------|-------------|
| **SchedulingOrchestrator** | `0 1 * * *` (01:00) | UTC | Generates recurring projects based on service mappings and schedules. Core business logic for automated project creation. |
| **CHSync** | `0 2 * * *` (02:00) | UTC | Synchronizes company data with Companies House API. Updates registered office, director changes, filing deadlines. |
| **EmailResolver** | `0 3 * * *` (03:00) | UTC | Resolves pending email associations and cleans up orphaned email records. |
| **DashboardCacheOvernight** | `5 3 * * *` (03:05) | Europe/London | Pre-computes dashboard statistics for all users. Heavy database operation. |
| **ActivityCleanup** | `15 4 * * *` (04:15) | UTC | Marks stale sessions as inactive, deletes sessions and login attempts older than 90 days. |
| **ViewCacheMorning** | `20 4 * * *` (04:20) | Europe/London | Warms project view cache for fast page loads. Heavy database operation. |

### Business Hours - UK Time

| Job Name | Schedule | Timezone | Description |
|----------|----------|----------|-------------|
| **SequenceCron** | `15 6 * * *` (06:15) | Europe/London | Progresses multi-step campaign sequences. Moves clients through campaign steps based on timing rules. |
| **AIWeeklyAnalysis** | `25 6 * * 1` (06:25 Mondays) | Europe/London | Generates AI-powered weekly analysis reports using GPT-4o-mini. |
| **EngagementCron** | `20 7 * * 0` (07:20 Sundays) | Europe/London | Processes ignored campaigns, updates client engagement scores. |
| **NotificationCron** | `8 7-19 * * *` (HH:08) | Europe/London | Processes due scheduled notifications (emails, in-app alerts). Runs hourly 07:00-19:00. |
| **ReminderNotificationCron** | `4,19,34,49 7-22 * * *` | Europe/London | Sends reminder notifications to clients. Runs every 15 minutes 07:00-22:00. |
| **ViewCacheMidMorning** | `45 8 * * *` (08:45) | Europe/London | View cache refresh - spaced 43 minutes after dashboard cache. |
| **SignatureReminderCron** | `12 9 * * *` (09:12) | Europe/London | Sends reminder emails for pending document signatures. |
| **QueryReminderCron** | `10 * * * *` (HH:10) | Europe/London | Processes scheduled bookkeeping query reminders (email, SMS, voice). Only executes 07:00-22:00. |
| **ViewCacheMidday** | `25 12 * * *` (12:25) | Europe/London | Midday view cache refresh. |
| **ViewCacheAfternoon** | `25 15 * * *` (15:25) | Europe/London | Afternoon view cache refresh. |
| **DashboardCacheHourly** | `2 8-18 * * *` (HH:02) | Europe/London | Hourly dashboard cache updates during business hours. |
| **SentItemsDetection** | `8,18,28,38,48,58 8-19 * * *` | Europe/London | Scans Outlook Sent Items folders to detect replies sent directly from Outlook. Runs every 10 minutes 08:00-19:00. |
| **SLABreachDetection** | `14,29,44,59 8-18 * * *` | Europe/London | Detects emails that have exceeded their SLA deadline and marks them as breached. Runs every 15 minutes 08:00-18:00. |
| **ProjectMessageReminders** | `2,12,22,32,42,52 * * * *` | Europe/London | Checks for unread project messages and sends reminder notifications. Runs every 10 minutes. |

---

## Schedule Visual Timeline (UK Time)

```
Hour   :00  :02  :04  :08  :10  :12  :14  :15  :18  :19  :20  :25  :28  :29  :34  :38  :44  :45  :48  :49  :52  :58  :59
       ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
01:00  │SchedulingOrchestrator (UTC)
02:00  │ CHSync (UTC)
03:00  │ EmailResolver (UTC)
03:05  │    DashboardCacheOvernight
04:15  │                           ActivityCleanup (UTC)
04:20  │                                              ViewCacheMorning
06:15  │                           SequenceCron
06:25  │                                                   AIWeeklyAnalysis (Mon)
07:00+ │    │    Reminder          Query    │         │         │         │                   │         │
       │    │    Notification      Reminder │         │         │         │                   │         │
       │    │    (:04,:19,:34,:49) (:10)    │         │         │         │                   │         │
07:20  │                                              EngagementCron (Sun)
08:00+ │    Dashboard  │    Notif  Query    Signature SLA      Sent      │    SLA   Reminder Sent SLA   │    Reminder Sent      SLA
       │    Hourly     │    Cron   Reminder Reminder  Breach   Items     │    Breach         Items Breach│             Items     Breach
       │    (:02)      │    (:08)  (:10)    (:12)     (:14)    (:18)     │    (:29) (:34)    (:38) (:44) │    (:49)    (:58)     (:59)
08:45  │                                                                                     ViewCacheMidMorning
12:25  │                                                   ViewCacheMidday
15:25  │                                                   ViewCacheAfternoon
```

---

## Job Categories

### Cache & Performance
| Job | Frequency | Lock | Purpose |
|-----|-----------|------|---------|
| DashboardCacheOvernight | Daily 03:05 | ✓ | Full dashboard rebuild |
| DashboardCacheHourly | Hourly 08:02-18:02 | ✓ | Incremental dashboard updates |
| ViewCacheMorning | Daily 04:20 | ✓ | Project view pre-computation |
| ViewCacheMidMorning | Daily 08:45 | ✓ | Mid-morning cache refresh |
| ViewCacheMidday | Daily 12:25 | ✓ | Midday cache refresh |
| ViewCacheAfternoon | Daily 15:25 | ✓ | Afternoon cache refresh |

### Client Communications
| Job | Frequency | Lock | Purpose |
|-----|-----------|------|---------|
| NotificationCron | Hourly 07:08-19:08 | ✓ | Scheduled notifications |
| ReminderNotificationCron | Every 15 min 07:00-22:00 | ✓ | Client reminders |
| QueryReminderCron | Hourly 07:10-22:10 | ✓ | Bookkeeping query reminders (email/SMS/voice) |
| SignatureReminderCron | Daily 09:12 | ✓ | Document signature reminders |
| ProjectMessageReminders | Every 10 min | ✓ | Unread message reminders |

### Email & Inbox Management
| Job | Frequency | Lock | Purpose |
|-----|-----------|------|---------|
| SentItemsDetection | Every 10 min 08:00-19:00 | ✓ | Detect Outlook-sent replies |
| SLABreachDetection | Every 15 min 08:00-18:00 | ✓ | Mark breached SLA emails |
| EmailResolver | Daily 03:00 | ✓ | Clean up orphaned emails |

### Business Logic
| Job | Frequency | Lock | Purpose |
|-----|-----------|------|---------|
| SchedulingOrchestrator | Daily 01:00 | ✓ | Generate recurring projects |
| CHSync | Daily 02:00 | ✓ | Companies House sync |
| SequenceCron | Daily 06:15 | ✓ | Campaign sequence progression |
| EngagementCron | Weekly Sun 07:20 | ✓ | Process ignored campaigns |
| AIWeeklyAnalysis | Weekly Mon 06:25 | ✓ | AI analysis reports |

### Maintenance
| Job | Frequency | Lock | Purpose |
|-----|-----------|------|---------|
| ActivityCleanup | Daily 04:15 | ✓ | Session & login cleanup (90-day retention) |

---

## Monitoring & Observability

### Log Patterns
Search for these patterns in logs:
- `[CronTelemetry:JSON]` - Structured telemetry events
- `[CronTelemetry]` - Human-readable status updates
- `Advisory lock ... acquired/released` - Lock lifecycle
- `Retry X/Y after error` - Retry attempts

### Key Metrics to Monitor
1. **Drift** (`drift_ms`) - Time between scheduled and actual execution. High drift indicates system overload.
2. **Duration** (`duration_ms`) - Job execution time. Track for performance regression.
3. **Lock wait** (`lock_wait_ms`) - Time spent acquiring lock. High values indicate contention.
4. **Event loop** (`p95_ms`) - Event loop delays. Values >100ms indicate blocking.
5. **Retry count** - Non-zero indicates job instability.

### Health Check Queries
```sql
-- Find jobs with high drift (>10 seconds)
SELECT * FROM cron_telemetry WHERE drift_ms > 10000;

-- Find failed jobs in last 24 hours
SELECT * FROM cron_telemetry 
WHERE status = 'error' 
AND timestamp > NOW() - INTERVAL '24 hours';

-- Find lock contention
SELECT job_name, AVG(lock_wait_ms) as avg_wait
FROM cron_telemetry
WHERE lock_wait_ms > 0
GROUP BY job_name
ORDER BY avg_wait DESC;
```

---

## Troubleshooting

### Job Not Running
1. Check if another instance holds the lock (look for "Lock held by another instance" in logs)
2. Verify the server is running during the scheduled time
3. Check for errors in previous runs that might have left locks orphaned

### High Drift
1. Check event loop metrics - high p95 indicates blocking operations
2. Review memory usage - garbage collection can cause delays
3. Consider staggering jobs further apart

### Lock Contention
1. If jobs frequently skip due to locks, they may be running too long
2. Consider breaking long-running jobs into smaller chunks
3. Review database query performance within the job

### Retries Exhausted
1. Check error messages in telemetry for root cause
2. Verify external service availability (SendGrid, VoodooSMS, Dialora)
3. Check database connection pool health
