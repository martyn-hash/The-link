# Service Scheduler Implementation Documentation

## Overview
This document tracks the implementation of the automated project scheduling system that creates projects based on service schedules. The system runs nightly to check all services mapped to clients and people, creating projects for services that are due.

## Implementation Phases

### Phase 1: Core Infrastructure ✅
**Status:** Complete  
**Goal:** Build the foundational components for the scheduling system

#### 1.1 Schema Enhancements
- [x] Add `projectSchedulingHistory` table for audit trail
- [x] Add `schedulingRunLogs` table for failure analysis
- [x] Add type definitions and relations for scheduling tables

#### 1.2 Frequency Calculation Service
- [x] Create date calculation logic (weekly, fortnightly, monthly, quarterly, annually)
- [x] Handle edge cases (end of month, leap years, business days)
- [x] Service due detection and overdue analysis functions

#### 1.3 Main Scheduling Service
- [x] Core service to find due services and create projects
- [x] Integration with existing project creation workflow
- [x] Comprehensive logging and audit trail
- [x] Error handling and configuration validation
- [x] UTC date normalization for consistency
- [x] Service hydration optimization to avoid refetch mismatches

#### 1.4 Storage Implementation
- [x] Add missing storage methods for scheduling operations
- [x] Proper database query implementation with joins
- [x] Remove fake ProjectType fabrication for better error detection
- [x] History and run log storage with proper indexing

**Architect Review:** ✅ Approved - "Pass with no blockers for basic scheduling functionality"

**Key Accomplishments:**
- End-to-end client service scheduling workflow operational
- Comprehensive audit trail and failure analysis capabilities
- Robust edge case handling (UTC normalization, end-of-month, leap years)
- Configuration error detection without hiding misconfigured services
- Complete metrics tracking for operational visibility

**Next Priority:** Real database transactions for atomic operations (future enhancement)

---

### Phase 2: Integration & Deployment ✅
**Status:** Complete  
**Goal:** Integrate scheduling system with production infrastructure

#### 2.1 Cron Integration
- [x] Integrated project scheduling into existing cron system
- [x] Scheduled to run at 1:00 AM UTC daily (before Companies House sync at 2:00 AM)
- [x] Comprehensive error handling and logging for scheduled runs
- [x] Proper UTC timezone configuration and startup logging

#### 2.2 API Endpoints
- [x] `POST /api/project-scheduling/run` - Manual scheduling trigger (admin-only)
- [x] `GET /api/project-scheduling/analysis` - Overdue services analysis (admin-only)
- [x] `POST /api/project-scheduling/test-dry-run` - Test scheduling without writes (admin-only)
- [x] Proper authentication and authorization for all endpoints
- [x] Detailed response metrics and timestamps

#### 2.3 Critical Bug Fixes
- [x] **Dry-run implementation**: Test endpoint skips project creation and service rescheduling (may still log scheduling run entry)
- [x] **Idempotency protection**: Prevents duplicate projects for same client/service/month
- [x] **Companies House service handling**: Create projects but skip rescheduling (dates managed by API)
- [x] **Proper error handling**: Comprehensive logging and failure recovery

**Architect Review:** ✅ Approved - "Pass — the scheduling integration is production-ready"

**Key Accomplishments:**
- Fully automated nightly scheduling at 1:00 AM UTC
- Manual trigger capabilities for administrators  
- Test-safe dry-run functionality for development
- Idempotency protection against duplicate runs
- Seamless integration with existing Companies House sync workflow

---

### Phase 3: Reporting & Monitoring
**Status:** Ready to Begin  
**Goal:** Build dashboards and sanity checks for the scheduling system

### Phase 4: Enhanced Testing & Development Tools
**Status:** Ready to Begin  
**Goal:** Extend testing capabilities and development workflows

### Phase 5: Data Population & Configuration
**Status:** Pending  
**Goal:** Set up base data and configuration interfaces

## Implementation Notes
- Building on existing cron job infrastructure (currently used for Companies House sync)
- Leveraging existing project management and notification systems
- Maintaining compatibility with current kanban workflow and time governance features

## Key Requirements
1. Nightly process cycles through all services mapped to clients and people
2. Creates projects for services with next start date = today
3. Reschedules services based on frequency after project creation
4. Special handling for Companies House services (API-driven dates)
5. Comprehensive failure analysis and reporting
6. Testing tools to avoid 24-hour wait cycles

## API Endpoints

### Project Scheduling Endpoints (Admin Only)

#### POST /api/project-scheduling/run
Manually trigger project scheduling outside of the nightly cron job.

**Authentication:** Admin required  
**Request:** No body required  
**Response:**
```json
{
  "message": "Project scheduling completed",
  "status": "success|partial_failure|failure",
  "projectsCreated": 5,
  "servicesRescheduled": 4,
  "errorsEncountered": 0,
  "errors": [],
  "summary": "Processed 10 services...",
  "executionTimeMs": 1250,
  "timestamp": "2024-09-24T20:30:00.000Z"
}
```

#### GET /api/project-scheduling/analysis
Get analysis of overdue services without making any changes.

**Authentication:** Admin required  
**Response:**
```json
{
  "message": "Overdue services analysis completed",
  "totalServices": 15,
  "overdueServices": 3,
  "servicesDetails": [...],
  "configurationErrors": []
}
```

#### POST /api/project-scheduling/test-dry-run  
Test scheduling logic without creating projects or rescheduling services.

**Authentication:** Admin required  
**Response:**
```json
{
  "message": "Test dry-run project scheduling completed",
  "status": "success",
  "projectsCreated": 0,
  "servicesRescheduled": 0,
  "dryRun": true,
  "summary": "DRY RUN: Would have processed 5 services..."
}
```

## Architecture Integration Points
- Uses existing project creation workflow
- Integrates with SendGrid email service for notifications
- Extends Companies House sync service
- Leverages kanban stages and role assignments
- Maintains audit trail through project chronology

## Production Deployment
The system is deployed and running in production with:
- **Automated Schedule:** Daily at 1:00 AM UTC
- **Manual Control:** Admin API endpoints for testing and manual runs  
- **Monitoring:** Comprehensive logging and audit trails
- **Safety:** Dry-run testing and idempotency protection

## Known Limitations and Next Steps

### Recommended Enhancements
- **Concurrent Run Protection:** Add locking mechanism to prevent overlapping scheduled/manual runs
- **Storage-Level Constraints:** Implement unique constraints for (client, projectType, projectMonth) for additional idempotency safety
- **Absolute Dry-Run Mode:** Option to skip all persistence including run logs for testing

### Current Limitations
- No built-in protection against concurrent runs (though unlikely with daily scheduling)
- Idempotency relies on application-level checks rather than database constraints
- Dry-run mode may still create scheduling run log entries