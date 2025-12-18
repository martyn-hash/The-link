# Cron System Improvements - Implementation Plan

## Executive Summary

This plan addresses the frequent "missed execution" warnings caused by cron jobs blocking the Node.js event loop. The solution involves architectural changes to separate concerns, optimize heavy jobs, and add safety mechanisms.

**Current State**: ~36 missed executions per day during UK business hours  
**Target State**: Near-zero missed executions, improved UI responsiveness

---

## Explicit Non-Goals

To prevent scope creep, the following are **explicitly out of scope** for this plan:

| Non-Goal | Rationale |
|----------|-----------|
| Job queue system (BullMQ, Redis queues) | Adds infrastructure complexity; not needed at current scale |
| Catch-up/replay execution logic | Missed jobs should skip, not pile up |
| Event-driven architecture rewrite | Future consideration after stability is achieved |
| Horizontal worker scaling | Single cron worker is sufficient for current load |

---

## Global Safety Controls

### Cron Kill-Switch

All cron scheduling will be gated behind an environment variable:

```typescript
const CRONS_ENABLED = process.env.CRONS_ENABLED !== 'false';

if (!CRONS_ENABLED) {
  console.log('[Cron] Cron execution disabled via CRONS_ENABLED=false');
  return;
}
```

- **Default**: Enabled (undefined or any value except `'false'`)
- **To disable**: Set `CRONS_ENABLED=false` in environment
- **No redeploy required**: Environment variable change takes effect on next job schedule

---

## Phase 1: Separate Cron Worker Process

### Objective
Move all cron job execution out of the web server process into a dedicated worker.

### Changes Required

1. **Create `server/cron-worker.ts`**
   - New entrypoint that initializes database connection and cron scheduler
   - Imports all cron handlers from existing code
   - Runs independently of Express server
   - Checks `CRONS_ENABLED` flag before scheduling

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

### Database Pool Isolation

Each process must use its own connection pool to prevent starvation:

| Process | Pool Size | Rationale |
|---------|-----------|-----------|
| Web server | 10-15 connections | Handles concurrent HTTP requests |
| Cron worker | 5-8 connections | Sequential job execution, lower concurrency |

Implementation:
```typescript
// Web server pool
const webPool = new Pool({ max: 15, connectionString: DATABASE_URL });

// Cron worker pool (in cron-worker.ts)
const cronPool = new Pool({ max: 8, connectionString: DATABASE_URL });
```

**Note**: Exact pool sizes should be tuned based on your Neon tier connection limits.

### Success Criteria
- [ ] Web server starts without any cron scheduling
- [ ] Cron worker starts independently and acquires advisory locks
- [ ] Database pools are isolated per process
- [ ] Missed execution warnings drop by 80%+
- [ ] UI page loads are not affected by cron execution
- [ ] Both processes can be restarted independently
- [ ] `CRONS_ENABLED=false` stops all cron execution

### Estimated Effort
Medium (4-6 hours)

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Database connection pool exhaustion | Isolated pools with capped sizes |
| Lock contention between old/new | Ensure clean shutdown before deploying |
| Environment variable access | Both processes share the same env |
| Web pool starved by cron | Pools are completely separate |

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
   - **Apply 2-minute overlap buffer** to handle out-of-order API responses
   - Update timestamp **only after successful scan completion**
   - Keep 24-hour fallback for first-time scans (when column is null)

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
// 2-minute overlap buffer for out-of-order responses
const OVERLAP_BUFFER_MS = 2 * 60 * 1000;

const lastChecked = inbox.lastSentItemsCheckedAt;
const sinceDate = lastChecked 
  ? new Date(lastChecked.getTime() - OVERLAP_BUFFER_MS)
  : new Date(Date.now() - 24 * 60 * 60 * 1000);

// ... process messages ...

// Only update timestamp on full success
if (stats.errors === 0) {
  await storage.updateInboxLastSentItemsCheckedAt(inbox.id, new Date());
}
```

### Success Criteria
- [ ] Each scan only processes new messages since last run (plus 2-min overlap)
- [ ] `last_sent_items_checked_at` updates only on successful completion
- [ ] First-time scans correctly fall back to 24-hour window
- [ ] Execution time reduced by 70%+ for subsequent runs
- [ ] No duplicate message processing (deduplication via conversationId)

### Estimated Effort
Low-Medium (2-3 hours)

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Missing messages if timestamp skips | 2-minute overlap buffer |
| Clock drift | Use server time consistently |
| Failed scan leaves stale timestamp | Only update on full success |
| Out-of-order Outlook API responses | Overlap buffer handles this |

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
   ): Promise<{ processed: number; batches: number }> {
     let processed = 0;
     let batches = 0;
     
     for (let i = 0; i < items.length; i += batchSize) {
       const batch = items.slice(i, i + batchSize);
       await processor(batch); // Each batch = its own transaction
       processed += batch.length;
       batches++;
       await new Promise(resolve => setImmediate(resolve)); // Yield to event loop
     }
     
     return { processed, batches };
   }
   ```

2. **Apply to high-volume jobs**
   - `ReminderNotificationCron` - Batch reminder processing
   - `QueryReminderCron` - Batch query checks
   - `DashboardCacheHourly` - Batch per-user cache updates
   - `ProjectMessageReminders` - Batch message checks

3. **Add execution timeout wrapper with standards**
   ```typescript
   export function withTimeout<T>(
     fn: () => Promise<T>,
     timeoutMs: number,
     jobName: string
   ): Promise<T> {
     const start = Date.now();
     
     return Promise.race([
       fn().then(result => {
         const elapsed = Date.now() - start;
         const budgetUsed = (elapsed / timeoutMs) * 100;
         if (budgetUsed > 80) {
           console.warn(`[${jobName}] Used ${budgetUsed.toFixed(0)}% of execution budget`);
         }
         return result;
       }),
       new Promise<never>((_, reject) =>
         setTimeout(() => reject(new Error(`${jobName} exceeded ${timeoutMs}ms timeout`)), timeoutMs)
       )
     ]);
   }
   ```

### Transaction Scope Rules

- **Each batch runs in its own database transaction**
- Partial completion is persisted between batches
- Timeout aborts cleanly without leaving locks or open transactions
- Job can resume from last checkpoint on next scheduled run

### Default Timeout Standards

| Job Category | Default Timeout | Notes |
|--------------|-----------------|-------|
| Cache rebuilds | 60 seconds | Heavy DB operations |
| Notification jobs | 30 seconds | External API calls |
| Sync jobs (CH, Email) | 60 seconds | External API dependencies |
| Cleanup jobs | 30 seconds | Simple DB operations |

No job is allowed to exceed its timeout. All jobs must be designed to complete within budget or checkpoint progress.

### Success Criteria
- [ ] No single batch blocks event loop for >50ms
- [ ] Jobs gracefully abort if exceeding timeout
- [ ] Partial progress is logged on timeout
- [ ] Event loop delay metrics (p95) stay under 100ms
- [ ] Warnings logged when >80% of budget used
- [ ] Each batch uses its own transaction

### Estimated Effort
Low (2-3 hours)

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Timeout kills job mid-transaction | Transaction-per-batch design |
| Small batches = more DB round trips | Tune batch size per job (50-100) |
| Partial state on timeout | Checkpoint design allows resume |

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

### Job Concurrency Behavior

Document the behavior when a job is still running at next schedule:

| Job | On Overlap | Behavior |
|-----|------------|----------|
| All jobs with advisory locks | Skip + WARN log | "Lock held by another instance, skipping" |
| Jobs without locks | N/A | All jobs use locks |

Default behavior: **Skip and log at WARN level**. No silent skips.

### Success Criteria
- [ ] Total cron executions per hour reduced by 30%+
- [ ] Lock contention events are visible in logs at WARN level
- [ ] No business impact from reduced frequency
- [ ] Overlapping job attempts are clearly logged

### Estimated Effort
Trivial (30 minutes)

---

## Phase 5: Observability Enhancements

### Objective
Improve ability to diagnose issues and track improvements.

### Changes Required

1. **Add `process_role` to all telemetry**
   ```json
   {
     "job_name": "ReminderNotificationCron",
     "process_role": "cron-worker",
     "rows_processed": 47,
     "batches_completed": 1
   }
   ```

2. **Add rows-processed metric to telemetry**
   - Track items processed per job run
   - Track batches completed

3. **Add per-job DB query timing**
   - Track time spent in storage operations
   - Log if any single query exceeds 5 seconds

4. **Add execution budget tracking**
   - Log percentage of timeout used
   - Warn if job uses >80% of budget

### Success Criteria
- [ ] Can identify slowest jobs from logs alone
- [ ] Can distinguish web vs cron-worker logs via `process_role`
- [ ] Can track improvement over time
- [ ] Early warning before jobs start timing out

### Estimated Effort
Low (1-2 hours)

---

## Implementation Order

```
Week 1
├── Phase 1: Cron Worker Separation (highest impact)
│   ├── Create cron-worker.ts entrypoint
│   ├── Configure isolated DB pools
│   ├── Add CRONS_ENABLED kill-switch
│   └── Update run configuration
└── Phase 4: Quick Wins (low effort, immediate benefit)
    ├── Reduce frequencies
    └── Add skip logging

Week 2
├── Phase 2: SentItemsDetection Optimization
│   ├── Add migration for last_sent_items_checked_at
│   ├── Implement delta scanning with overlap buffer
│   └── Add success-only timestamp updates
└── Phase 3: Batching & Timeouts
    ├── Create batching utility
    ├── Apply to high-volume jobs
    └── Add timeout wrappers with standards

Week 3 (if needed)
└── Phase 5: Observability
    ├── Add process_role tag
    ├── Add rows_processed metrics
    └── Add budget tracking
```

---

## Rollback Plan

Each phase is independently deployable and reversible:

| Phase | Rollback Method |
|-------|-----------------|
| 1 - Worker Separation | Revert `.replit` to single process; crons resume in web process |
| 2 - Delta Scanning | Column is additive; old code ignores it |
| 3 - Batching | Remove wrapper calls; original logic intact |
| 4 - Frequency Changes | Update cron expressions back |
| 5 - Observability | No functional changes to revert |

**Emergency**: Set `CRONS_ENABLED=false` to immediately stop all cron execution without code deployment.

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

4. **Neon connection limits**: What is your current tier's connection limit? This affects pool sizing.

---

## Appendix: Current Cron Schedule Reference

See `crons.md` for complete job reference.

High-frequency jobs (most impact from optimization):
- `SentItemsDetection`: Every 10 min (72 runs/day)
- `SLABreachDetection`: Every 15 min (44 runs/day)
- `ProjectMessageReminders`: Every 10 min (144 runs/day)
- `ReminderNotificationCron`: Every 15 min (64 runs/day)
- `DashboardCacheHourly`: Hourly (11 runs/day)
