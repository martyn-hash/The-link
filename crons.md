# Cron Jobs Documentation

This document outlines all scheduled background jobs in The Link application, including their timings, purposes, and the safety strategies implemented to ensure reliable execution.

---

## Architecture Overview (December 2024)

### Dual-Process Design
The application runs as **two separate processes**:

1. **Web Server** (`server/index.ts`) - Handles HTTP requests only, no cron scheduling
2. **Cron Worker** (`server/cron-worker.ts`) - Handles all scheduled background jobs

This separation prevents heavy cron jobs from blocking web requests and vice versa.

### Process Configuration
- **Development:** Configured via Replit Workflows (parallel mode running both processes)
- **Production:** Reserved VM deployment with custom run command (see Production Deployment in replit.md)
- **Database pools:** Isolated - Web (15 connections), Cron (8 connections)

### Emergency Kill Switch
Set `CRONS_ENABLED=false` in environment to disable all cron jobs without redeployment.

---

## Safety Strategies

All cron jobs are wrapped with `wrapCronHandler()` which provides comprehensive protection:

### 1. Distributed Locking (PostgreSQL Advisory Locks)
- Prevents duplicate execution when multiple instances are running
- Uses 31-bit hash of job name for stable lock IDs
- Fail-open design: if lock acquisition fails, job proceeds (graceful degradation)
- Automatic lock release on completion or error
- Lock contention logged at WARN level for visibility

### 2. Timeout Protection
Heavy jobs are wrapped with execution timeouts to prevent runaway execution:
- **Cache rebuilds:** 60 second timeout
- **Detection jobs:** 45 second timeout
- **Notification jobs:** 30 second timeout
- **Sync jobs:** 60 second timeout

Jobs log warnings when using >80% of their time budget.

### 3. Event Loop Yields
Batch processors yield control between items to prevent blocking:
```typescript
await yieldIfNeeded(startTime, 50); // Yield every 50ms
```

### 4. Automatic Retries with Exponential Backoff
- Default: 2 retries (3 total attempts)
- Backoff delays: 1s → 2s → 4s
- Errors are caught and logged, never crash the process

### 5. Delta Scanning (SentItemsDetection)
- Only scans emails since `lastSentItemsCheckedAt` per mailbox
- 2-minute overlap buffer prevents missed items
- Timestamp only updated on successful runs

### 6. Structured JSON Telemetry
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
  "rows_processed": 0,
  "batches_completed": 0,
  "budget_used_pct": 0,
  "event_loop": { "p50_ms": 0, "p95_ms": 0, "max_ms": 0 },
  "memory": { "heap_used_mb": 0, "heap_total_mb": 0, "rss_mb": 0 },
  "process_uptime_sec": 0,
  "process_role": "cron-worker",
  "concurrent_jobs": ["JobA", "JobB"]
}
```

### 7. Event Loop Monitoring
- 20ms resolution delay histogram
- Reports p50, p95, max delays every 5 minutes
- Detects event loop blocking that could affect job execution

### 8. Database Operation Timing
- `trackDbOperation()` wrapper times database queries
- Logs warnings for queries exceeding 5 seconds
- Helps identify slow database operations

### 9. Schedule Staggering
All jobs are offset from :00 to avoid collisions. Heavy jobs (Dashboard Cache, View Cache) are spaced 43+ minutes apart.

### 10. Error Containment
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
| **SentItemsDetection** | `8,23,38,53 8-19 * * *` | Europe/London | Scans Outlook Sent Items folders to detect replies sent directly from Outlook. Runs every 15 minutes 08:00-19:00. Uses delta scanning. |
| **SLABreachDetection** | `14,29,44,59 8-18 * * *` | Europe/London | Detects emails that have exceeded their SLA deadline and marks them as breached. Runs every 15 minutes 08:00-18:00. |
| **ProjectMessageReminders** | `2,32 * * * *` | Europe/London | Checks for unread project messages and sends reminder notifications. Runs every 30 minutes. |

---

## Schedule Visual Timeline (UK Time)

```
Hour   :02  :04  :08  :10  :14  :19  :23  :25  :29  :32  :34  :38  :45  :49  :53  :59
       ──────────────────────────────────────────────────────────────────────────────
01:00  │SchedulingOrchestrator (UTC)
02:00  │ CHSync (UTC)
03:00  │ EmailResolver (UTC)
03:05  │ DashboardCacheOvernight
04:15  │                           ActivityCleanup (UTC)
04:20  │                              ViewCacheMorning
06:15  │                           SequenceCron
06:25  │                                    AIWeeklyAnalysis (Mon)
07:00+ │    Reminder         Query         Reminder                Reminder
       │    Notification     Reminder      Notification            Notification
       │    (:04)            (:10)         (:34)                   (:49)
07:20  │                              EngagementCron (Sun)
08:00+ │           │  Notif Query  SLA  Reminder Sent │    SLA  PMR  Reminder Sent  │    SLA  Reminder Sent  SLA
       │           │  Cron  Reminder Breach      Items│    Breach    Notification Items│    Breach Notification Items Breach
       │           │  (:08) (:10)   (:14) (:19) (:23) │    (:29) (:32) (:34)  (:38)│    (:44)  (:49)  (:53) (:59)
08:45  │                                                                    ViewCacheMidMorning
12:25  │                                    ViewCacheMidday
15:25  │                                    ViewCacheAfternoon
```

---

## Job Categories

### Cache & Performance
| Job | Frequency | Lock | Timeout | Purpose |
|-----|-----------|------|---------|---------|
| DashboardCacheOvernight | Daily 03:05 | ✓ | 60s | Full dashboard rebuild (primes cache for morning logins) |
| *Dashboard On-Demand* | Request-time | - | - | See "On-Demand Dashboard Caching" section below |
| ViewCacheMorning | Daily 04:20 | ✓ | 60s | Project view pre-computation |
| ViewCacheMidMorning | Daily 08:45 | ✓ | 60s | Mid-morning cache refresh |
| ViewCacheMidday | Daily 12:25 | ✓ | 60s | Midday cache refresh |
| ViewCacheAfternoon | Daily 15:25 | ✓ | 60s | Afternoon cache refresh |

### Client Communications
| Job | Frequency | Lock | Timeout | Purpose |
|-----|-----------|------|---------|---------|
| NotificationCron | Hourly 07:08-19:08 | ✓ | 30s | Scheduled notifications |
| ReminderNotificationCron | Every 15 min 07:00-22:00 | ✓ | 30s | Client reminders |
| QueryReminderCron | Hourly 07:10-22:10 | ✓ | 30s | Bookkeeping query reminders (email/SMS/voice) |
| SignatureReminderCron | Daily 09:12 | ✓ | 30s | Document signature reminders |
| ProjectMessageReminders | Every 30 min | ✓ | 30s | Unread message reminders |

### Email & Inbox Management
| Job | Frequency | Lock | Timeout | Purpose |
|-----|-----------|------|---------|---------|
| SentItemsDetection | Every 15 min 08:00-19:00 | ✓ | 45s | Detect Outlook-sent replies (delta scanning) |
| SLABreachDetection | Every 15 min 08:00-18:00 | ✓ | 45s | Mark breached SLA emails |
| EmailResolver | Daily 03:00 | ✓ | 60s | Clean up orphaned emails |

### Business Logic
| Job | Frequency | Lock | Timeout | Purpose |
|-----|-----------|------|---------|---------|
| SchedulingOrchestrator | Daily 01:00 | ✓ | 60s | Generate recurring projects |
| CHSync | Daily 02:00 | ✓ | 60s | Companies House sync |
| SequenceCron | Daily 06:15 | ✓ | 60s | Campaign sequence progression |
| EngagementCron | Weekly Sun 07:20 | ✓ | 60s | Process ignored campaigns |
| AIWeeklyAnalysis | Weekly Mon 06:25 | ✓ | 60s | AI analysis reports |

### Maintenance
| Job | Frequency | Lock | Timeout | Purpose |
|-----|-----------|------|---------|---------|
| ActivityCleanup | Daily 04:15 | ✓ | 60s | Session & login cleanup (90-day retention) |

---

## On-Demand Dashboard Caching

**December 2024 Update:** Dashboard cache updates during business hours were moved from scheduled cron jobs to an on-demand caching strategy. This change improves responsiveness and reduces cron worker load.

### How It Works

1. **On-Demand Refresh:** When `/api/dashboard/cache` is called, if the cache is missing or stale (>15 minutes old), it is automatically recomputed.

2. **Invalidation on Mutations:** When projects are created, updated, or change status, the dashboard cache for affected users is invalidated:
   - Project owner
   - Current assignee
   - Previous assignee (on status change)

3. **Overnight Pre-warming:** `DashboardCacheOvernight` (03:05 UK) still runs to prime caches for morning logins.

### Benefits

- **Faster response:** No waiting for next scheduled cache update
- **Reduced cron load:** Removed hourly DashboardCacheHourly job (was running at HH:02 during 08:00-18:00)
- **User-specific updates:** Only invalidates affected users, not all users
- **Self-healing:** Stale cache auto-refreshes on next request

### Implementation Details

- **TTL:** 15 minutes (900 seconds)
- **Invalidation service:** `server/dashboard-cache-invalidation.ts`
- **Hooks:** Integrated into project routes (`core.ts`, `status.ts`)
- **Endpoint:** `GET /api/dashboard/cache` - returns cached data or triggers refresh

---

## Monitoring & Observability

### Log Patterns
Search for these patterns in logs:
- `[CronTelemetry:JSON]` - Structured telemetry events (machine-parseable)
- `[CronTelemetry]` - Human-readable status updates
- `process_role: "cron-worker"` - Cron worker process logs
- `process_role: "web"` - Web server process logs
- `Advisory lock ... acquired/released` - Lock lifecycle
- `Retry X/Y after error` - Retry attempts
- `WARN` + `lock contention` - Lock contention alerts
- `Slow DB operation` - Database queries exceeding 5s threshold

### Key Metrics to Monitor
1. **Drift** (`drift_ms`) - Time between scheduled and actual execution. High drift indicates system overload.
2. **Duration** (`duration_ms`) - Job execution time. Track for performance regression.
3. **Lock wait** (`lock_wait_ms`) - Time spent acquiring lock. High values indicate contention.
4. **Budget used** (`budget_used_pct`) - Percentage of timeout budget consumed. Values >80% trigger warnings.
5. **Rows processed** (`rows_processed`) - Items handled per run. Track for volume trends.
6. **Batches completed** (`batches_completed`) - Batch iterations completed.
7. **Event loop** (`p95_ms`) - Event loop delays. Values >100ms indicate blocking.
8. **Retry count** - Non-zero indicates job instability.

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

-- Find jobs using >80% of timeout budget
SELECT job_name, budget_used_pct, duration_ms
FROM cron_telemetry
WHERE budget_used_pct > 80
ORDER BY budget_used_pct DESC;
```

---

## Troubleshooting

### Job Not Running
1. Check if `CRONS_ENABLED=false` is set (emergency kill switch)
2. Verify cron worker process is running (look for `process_role: "cron-worker"` in logs)
3. Check if another instance holds the lock (look for "Lock held by another instance" in logs)
4. Verify the server is running during the scheduled time
5. Check for errors in previous runs

### High Drift
1. Check event loop metrics - high p95 indicates blocking operations
2. Review memory usage - garbage collection can cause delays
3. Consider staggering jobs further apart
4. Check if web server load is affecting cron worker (they should be separate processes)

### Lock Contention
1. If jobs frequently skip due to locks, they may be running too long
2. Review `budget_used_pct` - jobs near 100% need optimization
3. Consider breaking long-running jobs into smaller chunks
4. Review database query performance within the job

### Timeout Exceeded
1. Check `rows_processed` to understand workload volume
2. Review database query performance with `trackDbOperation()` logs
3. Consider increasing batch size or reducing processing frequency
4. Optimize slow queries identified in logs

### Retries Exhausted
1. Check error messages in telemetry for root cause
2. Verify external service availability (SendGrid, VoodooSMS, Dialora, Microsoft Graph)
3. Check database connection pool health
4. Review recent code changes that might have introduced bugs

---

## Recent Changes (December 2024)

### Frequency Reductions
- **ProjectMessageReminders:** 10min → 30min (66% fewer executions)
- **SentItemsDetection:** 10min → 15min (33% fewer executions)

### New Protections Added
- Timeout wrappers on all heavy jobs
- Event loop yields between batch items
- Delta scanning for SentItemsDetection
- Database operation timing with >5s warnings
- Budget usage tracking and warnings

### Process Separation
- Web server and cron worker now run as separate processes
- Prevents mutual blocking between HTTP requests and cron jobs
- Isolated database connection pools
