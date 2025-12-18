# Cron System Improvements - Implementation Plan

## Executive Summary

This plan addresses the frequent "missed execution" warnings caused by cron jobs blocking the Node.js event loop. The solution involves architectural changes to separate concerns, optimize heavy jobs, and add safety mechanisms.

**Current State**: ~36 missed executions per day during UK business hours  
**Target State**: Near-zero missed executions, improved UI responsiveness

---

## Phase 1: Separate Cron Worker Process

### Objective
Move all cron job execution out of the web server process into a dedicated worker.

### Changes Required

1. **Create `server/cron-worker.ts`**
   - New entrypoint that initializes database connection and cron scheduler
   - Imports all cron handlers from existing code
   - Runs independently of Express server

2. **Modify `server/index.ts`**
   - Remove all `cron.schedule()` calls
   - Keep only HTTP server logic
   - Optionally expose health endpoint for cron worker status

3. **Update `.replit` run command**
   - Change from single process to parallel execution
   - Format: `npm run dev:web & npm run dev:cron & wait`

4. **Add npm scripts**
   - `dev:web` - Starts Express server only
   - `dev:cron` - Starts cron worker only
   - `dev` - Starts both in parallel

### Success Criteria
- [ ] Web server starts without any cron scheduling
- [ ] Cron worker starts independently and acquires advisory locks
- [ ] Missed execution warnings drop by 80%+
- [ ] UI page loads are not affected by cron execution
- [ ] Both processes can be restarted independently

### Estimated Effort
Medium (4-6 hours)

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Database connection pool exhaustion | Configure separate pool sizes for each process |
| Lock contention between old/new | Ensure clean shutdown before deploying |
| Environment variable access | Both processes share the same env |

---

## Phase 2: SentItemsDetection Optimization

### Objective
Reduce Outlook API calls and processing time by implementing delta scanning.

### Changes Required

1. **Add `last_sent_items_checked_at` column to `inboxes` table**
   - Timestamp of last successful scan per inbox
   - Migration required

2. **Modify `SentItemsReplyDetectionService.runDetection()`**
   - Fetch `last_sent_items_checked_at` for each inbox
   - Change filter from 24-hour window to `sentDateTime > last_checked_at`
   - Update timestamp after successful scan
   - Keep 24-hour fallback for first-time scans

3. **Add batch processing with event loop yields**
   - Process inboxes in batches of 5
   - `await setImmediate()` between batches

### Current Code (Problem)
```typescript
const sinceDate = new Date();
sinceDate.setHours(sinceDate.getHours() - 24);
// Always scans 24 hours of data, every 10 minutes
```

### Target Code (Solution)
```typescript
const sinceDate = inbox.lastSentItemsCheckedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
// Only scans messages since last check
```

### Success Criteria
- [ ] Each scan only processes new messages since last run
- [ ] `last_sent_items_checked_at` updates correctly per inbox
- [ ] Execution time reduced by 70%+ for subsequent runs
- [ ] No duplicate message processing

### Estimated Effort
Low-Medium (2-3 hours)

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Missing messages if timestamp skips | Use 1-minute overlap buffer |
| Clock drift | Use server time consistently |
| Failed scan leaves stale timestamp | Only update on success |

---

## Phase 3: Batching & Event Loop Protection

### Objective
Prevent any single cron job from blocking the event loop for extended periods.

### Changes Required

1. **Create `server/utils/cronBatching.ts`**
   ```typescript
   export async function processBatched<T>(
     items: T[],
     processor: (batch: T[]) => Promise<void>,
     batchSize = 50
   ): Promise<void> {
     for (let i = 0; i < items.length; i += batchSize) {
       await processor(items.slice(i, i + batchSize));
       await new Promise(resolve => setImmediate(resolve));
     }
   }
   ```

2. **Apply to high-volume jobs**
   - `ReminderNotificationCron` - Batch reminder processing
   - `QueryReminderCron` - Batch query checks
   - `DashboardCacheHourly` - Batch per-user cache updates
   - `ProjectMessageReminders` - Batch message checks

3. **Add execution timeout wrapper**
   ```typescript
   export function withTimeout<T>(
     fn: () => Promise<T>,
     timeoutMs: number,
     jobName: string
   ): Promise<T> {
     return Promise.race([
       fn(),
       new Promise<never>((_, reject) =>
         setTimeout(() => reject(new Error(`${jobName} exceeded ${timeoutMs}ms`)), timeoutMs)
       )
     ]);
   }
   ```

### Success Criteria
- [ ] No single batch blocks event loop for >50ms
- [ ] Jobs gracefully abort if exceeding 60 seconds
- [ ] Partial progress is logged on timeout
- [ ] Event loop delay metrics (p95) stay under 100ms

### Estimated Effort
Low (2-3 hours)

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Timeout kills job mid-transaction | Use transaction-per-batch |
| Small batches = more DB round trips | Tune batch size per job |

---

## Phase 4: Quick Wins

### Objective
Low-effort changes that reduce overall cron load.

### Changes Required

1. **Reduce ProjectMessageReminders frequency**
   - Current: Every 10 minutes (`*/10 * * * *`)
   - Target: Every 30 minutes (`*/30 * * * *`)
   - Rationale: 10-minute checks are excessive for non-urgent reminders

2. **Reduce SentItemsDetection frequency**
   - Current: Every 10 minutes during business hours
   - Target: Every 15 minutes (`*/15 8-19 * * *`)
   - Rationale: With delta scanning, less frequent checks are sufficient

3. **Add explicit skip logging**
   - When a job skips due to lock contention, log at WARN level
   - Include which instance holds the lock (if detectable)

### Success Criteria
- [ ] Total cron executions per hour reduced by 30%+
- [ ] Lock contention events are visible in logs
- [ ] No business impact from reduced frequency

### Estimated Effort
Trivial (30 minutes)

---

## Phase 5: Observability Enhancements

### Objective
Improve ability to diagnose issues and track improvements.

### Changes Required

1. **Add rows-processed metric to telemetry**
   ```json
   {
     "job_name": "ReminderNotificationCron",
     "rows_processed": 47,
     "batches_completed": 1
   }
   ```

2. **Add per-job DB query timing**
   - Track time spent in storage operations
   - Log if any single query exceeds 5 seconds

3. **Add execution budget tracking**
   - Log percentage of timeout used
   - Warn if job uses >80% of budget

### Success Criteria
- [ ] Can identify slowest jobs from logs alone
- [ ] Can track improvement over time
- [ ] Early warning before jobs start timing out

### Estimated Effort
Low (1-2 hours)

---

## Implementation Order

```
Week 1
├── Phase 1: Cron Worker Separation (highest impact)
└── Phase 4: Quick Wins (low effort, immediate benefit)

Week 2
├── Phase 2: SentItemsDetection Optimization
└── Phase 3: Batching & Timeouts

Week 3 (if needed)
└── Phase 5: Observability
```

---

## Rollback Plan

Each phase is independently deployable and reversible:

| Phase | Rollback Method |
|-------|-----------------|
| 1 - Worker Separation | Revert `.replit` to single process |
| 2 - Delta Scanning | Column is additive; old code ignores it |
| 3 - Batching | Remove wrapper calls; original logic intact |
| 4 - Frequency Changes | Update cron expressions back |
| 5 - Observability | No functional changes to revert |

---

## Success Metrics

### Primary
- **Missed executions**: From ~36/day → <5/day
- **p95 event loop delay**: From >100ms → <50ms during cron runs

### Secondary
- **SentItemsDetection duration**: Reduce by 70%
- **UI page load time**: No degradation during peak cron activity
- **Total cron executions/hour**: Reduce by 30%

---

## Open Questions

1. **Production deployment coordination**: Will you deploy worker separation during low-traffic hours?

2. **Database migration timing**: Phase 2 requires a migration. Preference for when to run it?

3. **Monitoring access**: Do you have access to logs/metrics from production to validate improvements?

---

## Appendix: Current Cron Schedule Reference

See `crons.md` for complete job reference.

High-frequency jobs (most impact from optimization):
- `SentItemsDetection`: Every 10 min (72 runs/day)
- `SLABreachDetection`: Every 15 min (44 runs/day)
- `ProjectMessageReminders`: Every 10 min (144 runs/day)
- `ReminderNotificationCron`: Every 15 min (64 runs/day)
- `DashboardCacheHourly`: Hourly (11 runs/day)
