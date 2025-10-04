# Service and Project Logic Documentation

## Overview
This document provides comprehensive documentation of how services are created, mapped to clients or people, how projects are automatically created from services, and how the entire scheduling system operates. This is the authoritative reference for maintaining and understanding these critical systems.

## 1. Service Creation & Management

### 1.1 Service Types

Services in the system fall into three main categories:

1. **Regular Services** - Standard services that can be scheduled (e.g., Monthly Bookkeeping, VAT Return)
2. **Companies House Services** - Services with dates automatically synced from Companies House API
3. **Static Services** - Display-only services that cannot be scheduled or create projects
4. **Personal Services** - Services assigned to individuals rather than companies

### 1.2 Service Creation Flow

```
User creates service → Define properties → Map to work roles → Link to project type
```

#### Key Service Properties:
- `name`: Unique service identifier
- `description`: Service details
- `projectTypeId`: Links service to a project type (required for scheduling)
- `isCompaniesHouseConnected`: Boolean flag for CH services
- `chStartDateField` / `chDueDateField`: Fields to read dates from CH data
- `isPersonalService`: Boolean for person-specific services
- `isStaticService`: Boolean for display-only services
- `udfDefinitions`: User-defined fields configuration

### 1.3 Work Role Assignments

Services can have multiple work roles assigned:
- Stored in `serviceRoles` junction table
- Each role can be filled by different users for different clients
- Role assignments cascade to projects created from the service

## 2. Service-to-Client/Person Mapping

### 2.1 Client Service Mapping

When mapping a service to a client:

```
POST /api/client-services
├── Validate client exists
├── Validate service exists
├── Check for duplicate mapping
├── Handle service-specific logic:
│   ├── Companies House: Auto-populate dates from CH fields
│   ├── Static: No frequency/dates required
│   └── Regular: Default frequency = 'monthly'
├── Convert date strings to Date objects
└── Create mapping in database
```

#### Client Service Fields:
- `clientId`: Reference to client
- `serviceId`: Reference to service  
- `serviceOwnerId`: User responsible for this service
- `frequency`: Schedule frequency (daily, weekly, monthly, quarterly, annually)
- `nextStartDate`: When next project should start
- `nextDueDate`: When next project is due
- `isActive`: Whether service is actively scheduled

### 2.2 People Service Mapping

Similar to client services but for individuals:
- Only `isPersonalService = true` services allowed
- Stored in `peopleServices` table
- Cannot be mapped to companies

### 2.3 Role Assignment Resolution

For each client service, role assignments determine who does what:

```
Client Service
└── Service Roles (e.g., Bookkeeper, Client Manager)
    └── Role Assignments per client
        └── Specific users assigned to each role
```

## 3. Automated Project Creation

### 3.1 Project Scheduler

The system automatically creates projects from services using a nightly scheduler:

**Schedule**: Runs daily at 1:00 AM UTC
**Manual Trigger**: `POST /api/project-scheduling/run`
**Dry Run Test**: `POST /api/project-scheduling/test-dry-run`

### 3.2 Project Creation Logic

```
Nightly Scheduler Runs
├── Get all client services
├── Get all people services
├── For each service:
│   ├── Check if nextStartDate = today
│   ├── If due:
│   │   ├── Check for existing project (idempotency)
│   │   ├── Check single-project-per-client constraint
│   │   ├── Create project
│   │   ├── Set assignee (role-based or service owner)
│   │   ├── Send notifications
│   │   └── Log in scheduling history
│   └── Reschedule service (except CH services)
└── Log run results
```

### 3.3 Idempotency & Constraints

#### Duplicate Prevention:
- Check for existing project with same client + project type + date
- Check scheduling history for same service + date
- Prevents duplicate projects even if scheduler runs multiple times

#### Single Project Per Client:
- Optional constraint per project type
- If enabled, auto-archives existing active projects before creating new one
- Ensures only one active project of that type per client

### 3.4 Assignee Resolution

Projects are assigned based on this hierarchy:

1. **Service Owner** - If client service has a service owner
2. **Role Assignment** - User assigned to required role for this client service
3. **Stage Default** - Default user for first kanban stage
4. **Fallback** - System default user to prevent orphaned projects

## 4. Service Rescheduling

### 4.1 Frequency-Based Calculation

After creating a project, services are rescheduled based on frequency:

```javascript
calculateNextServiceDates(currentStartDate, currentDueDate, frequency)
├── Daily: Add 1 day
├── Weekly: Add 7 days
├── Fortnightly: Add 14 days
├── Monthly: Add 1 month (handle end-of-month)
├── Quarterly: Add 3 months (handle end-of-month)
└── Annually: Add 1 year (handle leap years)
```

### 4.2 Special Cases

#### Companies House Services:
- **Never automatically rescheduled**
- Dates come from CH API updates
- Projects still created when due
- Manual update via CH change request approval

#### End-of-Month Handling:
- If original date is last day of month, new date is last day of new month
- Example: Jan 31 → Feb 28/29 → Mar 31

#### Leap Year Handling:
- Feb 29 in leap year → Feb 28 in non-leap year

## 5. Companies House Integration

### 5.1 Service Configuration

CH services have special fields:
- `isCompaniesHouseConnected = true`
- `chStartDateField`: Which CH field provides start date
- `chDueDateField`: Which CH field provides due date

Allowed CH fields:
- `nextAccountsPeriodEnd`
- `nextAccountsDue`
- `confirmationStatementNextDue`
- `confirmationStatementNextMadeUpTo`

### 5.2 Date Population

When mapping CH service to client:
1. Read specified fields from client's CH data
2. Auto-populate `nextStartDate` and `nextDueDate`
3. Force frequency to 'annually'
4. Validate dates exist and are valid

### 5.3 CH Updates

When CH data changes:
1. Pending changes created in `chChangeRequests`
2. Admin approves changes
3. Client fields updated
4. All affected client services updated
5. Active projects optionally updated (extension scenario)

## 6. Error Handling & Validation

### 6.1 Date Handling

**Critical Issue Fixed**: Date conversion in service creation/update
- Frontend sends dates as ISO strings
- Backend must convert strings to Date objects before database insertion
- Applies to: `nextStartDate`, `nextDueDate`

### 6.2 Validation Checks

1. **Service Creation**:
   - Name uniqueness
   - Project type exists (if not static)
   - CH fields valid (if CH connected)

2. **Client Service Mapping**:
   - Client exists
   - Service exists
   - No duplicate mapping
   - Personal services cannot map to clients
   - CH services have valid date fields

3. **Project Creation**:
   - Service has project type
   - No duplicate project for same date
   - Valid assignee resolved

## 7. Database Schema

### Key Tables:
- `services` - Service definitions
- `clientServices` - Client-to-service mappings
- `peopleServices` - Person-to-service mappings  
- `serviceRoles` - Service-to-role mappings
- `clientServiceRoleAssignments` - User assignments per client service role
- `projects` - Created projects
- `projectSchedulingHistory` - Audit trail of scheduling actions
- `schedulingRunLogs` - Scheduler execution history

### Critical Relationships:
```
services → projectTypes (1:1)
services → serviceRoles → workRoles (M:N)
clients → clientServices → services (M:N)
clientServices → clientServiceRoleAssignments → users (M:N per role)
clientServices → projects (1:N over time)
```

## 8. API Endpoints

### Service Management:
- `POST /api/services` - Create service
- `PATCH /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service
- `POST /api/services/:id/roles` - Add role to service
- `DELETE /api/services/:id/roles/:roleId` - Remove role

### Client Service Management:
- `POST /api/client-services` - Map service to client
- `PUT /api/client-services/:id` - Update mapping
- `DELETE /api/client-services/:id` - Remove mapping
- `POST /api/client-services/:id/role-assignments` - Assign user to role
- `PUT /api/role-assignments/:id` - Update assignment
- `DELETE /api/role-assignments/:id` - Remove assignment

### Scheduling:
- `POST /api/project-scheduling/run` - Manual trigger
- `GET /api/project-scheduling/analysis` - Overdue analysis
- `POST /api/project-scheduling/test-dry-run` - Test without changes

## 9. Critical Functions

### Core Service Functions:
- `storage.createClientService()` - Creates client service mapping
- `storage.updateClientService()` - Updates mapping
- `storage.createPeopleService()` - Creates people service
- `storage.updatePeopleService()` - Updates people service

### Scheduling Functions:
- `runProjectSchedulingEnhanced()` - Main scheduler entry point
- `findServicesDueToday()` - Identifies due services
- `createProjectFromService()` - Creates project from service
- `rescheduleService()` - Calculates next dates
- `calculateNextServiceDates()` - Date calculation logic

### Role Resolution:
- `resolveRoleAssigneeForClient()` - Finds user for role
- `getClientServiceRoleAssignments()` - Gets all assignments

## 10. Common Issues & Solutions

### Issue: 500 Error on Service Creation
**Cause**: Date values not converted from strings to Date objects
**Solution**: Added date conversion in create/update methods

### Issue: Duplicate Projects
**Cause**: Multiple scheduler runs or manual triggers
**Solution**: Idempotency checks on client + project type + date

### Issue: CH Services Rescheduled Incorrectly
**Cause**: Treating CH services like regular services
**Solution**: Skip rescheduling for CH services

### Issue: Projects Without Assignees
**Cause**: No role assignments or service owner
**Solution**: Fallback assignee hierarchy

## 11. Best Practices

1. **Always validate** service type before operations
2. **Convert dates** from strings to Date objects in storage layer
3. **Use transactions** for multi-step operations
4. **Log all scheduling actions** for audit trail
5. **Test with dry-run** before manual scheduling
6. **Check for existing mappings** before creating new ones
7. **Handle CH services specially** - they have different rules
8. **Maintain idempotency** - operations should be safe to retry

## 12. Security Considerations

1. **Role-based access**: Only admins can create services
2. **Validated CH fields**: Whitelist of allowed fields
3. **SQL injection prevention**: Use parameterized queries
4. **Audit logging**: Track all changes
5. **Data validation**: Check all inputs before database operations

---

*This document is the authoritative reference for service and project logic. Any modifications to these systems should be reflected here.*