# Service Scheduler Implementation Documentation

## Overview
This document tracks the implementation of the automated project scheduling system that creates projects based on service schedules. The system runs nightly to check all services mapped to clients and people, creating projects for services that are due.

## Implementation Phases

### Phase 1: Core Infrastructure ⏳
**Status:** In Progress  
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
- [ ] Add missing storage methods for scheduling operations

### Phase 2: Project Creation Engine
**Status:** Pending  
**Goal:** Implement the logic to convert services into projects

### Phase 3: Reporting & Monitoring
**Status:** Pending  
**Goal:** Build dashboards and sanity checks for the scheduling system

### Phase 4: Testing & Development Tools
**Status:** Pending  
**Goal:** Create tools for testing and development of the scheduling system

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

## Architecture Integration Points
- Uses existing project creation workflow
- Integrates with SendGrid email service for notifications
- Extends Companies House sync service
- Leverages kanban stages and role assignments
- Maintains audit trail through project chronology