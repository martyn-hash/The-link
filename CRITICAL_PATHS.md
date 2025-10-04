# CRITICAL PATHS AND PROTECTED FUNCTIONS

## Overview
This document identifies critical paths, protected functions, and core modules that should NOT be modified without thorough review and testing. These components are essential for service creation, project scheduling, and the overall system stability.

## Protected Core Modules

### 1. server/core/service-mapper.ts
**Status**: PROTECTED - DO NOT MODIFY
**Purpose**: Central authority for service mapping logic
**Critical Functions**:
- `convertServiceDates()` - Handles critical date conversion from strings to Date objects
- `prepareCompaniesHouseServiceData()` - Manages CH service date field mapping
- `validateServiceMapping()` - Enforces business rules for service assignments
- `createClientServiceMapping()` - Core function for client-service creation
- `createPeopleServiceMapping()` - Core function for people-service creation
- `updateClientServiceMapping()` - Updates with full validation
- `updatePeopleServiceMapping()` - Updates with full validation

**Dependencies**: Used by all service-related API endpoints

### 2. server/core/project-creator.ts
**Status**: PROTECTED - DO NOT MODIFY
**Purpose**: Central authority for project creation from services
**Critical Functions**:
- `checkForDuplicateProject()` - Prevents duplicate projects (idempotency)
- `checkSchedulingHistory()` - Secondary duplicate prevention
- `handleSingleProjectConstraint()` - Manages project type constraints
- `resolveProjectAssignee()` - Assignment hierarchy logic
- `buildProjectData()` - Constructs project from service
- `createProjectFromDueService()` - Main project creation function

**Dependencies**: Used by project scheduler

### 3. server/core/schedule-calculator.ts
**Status**: PROTECTED - DO NOT MODIFY
**Purpose**: Central authority for date/frequency calculations
**Critical Functions**:
- `calculateNextServiceDates()` - Core scheduling algorithm
- `isServiceDueToday()` - Date comparison logic
- `findServicesDue()` - Identifies services needing projects
- `rescheduleService()` - Updates service dates (not for CH services)
- `getOverdueServices()` - Analysis for overdue services

**Dependencies**: Used by scheduler and analysis endpoints

## Critical Storage Functions

### server/storage.ts
**Modified Functions** (Date conversion fixes applied):
- `createClientService()` - Now converts ISO strings to Date objects
- `updateClientService()` - Now converts ISO strings to Date objects  
- `createPeopleService()` - Now converts ISO strings to Date objects
- `updatePeopleService()` - Now converts ISO strings to Date objects

**Warning**: These functions MUST maintain date conversion logic to prevent 500 errors

## Critical API Routes

### server/routes.ts
**Refactored Endpoints** (Now using protected modules):
- `POST /api/client-services` - Uses serviceMapper.createClientServiceMapping()
- `PUT /api/client-services/:id` - Uses serviceMapper.updateClientServiceMapping()
- `POST /api/people-services` - Uses serviceMapper.createPeopleServiceMapping()
- `PUT /api/people-services/:peopleServiceId` - Uses serviceMapper.updatePeopleServiceMapping()

## Scheduler Components

### server/project-scheduler.ts
**Status**: CRITICAL - Modifications require extreme caution
**Purpose**: Automated project creation from services
**Schedule**: Runs daily at 1:00 AM UTC
**Key Functions**:
- `runProjectSchedulingEnhanced()` - Main scheduler entry point
- Uses all three protected core modules

### server/frequency-calculator.ts
**Status**: IMPORTANT
**Purpose**: Frequency calculations
**Note**: Being gradually replaced by schedule-calculator.ts

## Companies House Integration

### Special Rules:
1. CH services NEVER get automatically rescheduled
2. Dates come from CH API fields only
3. Always force frequency to 'annually'
4. Whitelist of allowed date fields enforced

### CH Date Fields (Whitelist):
- `nextAccountsPeriodEnd`
- `nextAccountsDue`
- `confirmationStatementNextDue`
- `confirmationStatementNextMadeUpTo`

## Modification Guidelines

### Before Modifying Any Protected Module:

1. **Review Impact**:
   - Check all dependencies
   - Review Service_and_Project_Logic.md
   - Understand the full data flow

2. **Test Thoroughly**:
   - Test all service types (Regular, CH, Static, Personal)
   - Test all frequencies
   - Test edge cases (end-of-month, leap years)
   - Test idempotency (run scheduler multiple times)

3. **Validate Date Handling**:
   - Always convert string dates to Date objects before database operations
   - Maintain UTC consistency
   - Handle timezone issues properly

4. **Document Changes**:
   - Update this document
   - Update Service_and_Project_Logic.md
   - Add detailed comments in code

## Common Pitfalls to Avoid

1. **Date Conversion**: Never pass string dates to database timestamp columns
2. **CH Services**: Never reschedule CH services automatically
3. **Duplicate Projects**: Always check for existing projects before creation
4. **Service Types**: Respect service type constraints (personal vs client)
5. **Validation Order**: Validate existence before operations

## Testing Checklist

Before deploying changes to protected components:

- [ ] Test regular service creation
- [ ] Test CH service creation with valid CH fields
- [ ] Test static service creation
- [ ] Test personal service creation
- [ ] Test service updates
- [ ] Test project creation from scheduler
- [ ] Test manual scheduler trigger
- [ ] Test dry-run scheduler
- [ ] Test all frequency calculations
- [ ] Test duplicate prevention
- [ ] Test role assignments
- [ ] Test error handling

## Emergency Procedures

If critical functionality breaks:

1. **Immediate**:
   - Check server logs for errors
   - Verify date conversion is working
   - Check database for data integrity

2. **Rollback**:
   - Revert to last known good commit
   - Use rollback feature if available
   - Document what broke and why

3. **Fix Forward**:
   - Apply minimal fix to restore service
   - Test thoroughly before broader changes
   - Update documentation

## Contact for Questions

If you need to modify protected components:
1. Review this document thoroughly
2. Review Service_and_Project_Logic.md
3. Test all scenarios listed above
4. Document your changes

---

*Last Updated: October 2025*
*Critical System Components - Handle with Extreme Care*