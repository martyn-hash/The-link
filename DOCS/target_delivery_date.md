# Target Delivery Date Implementation Plan

## Overview

This document outlines the plan to add a **Target Delivery Date** field to services and projects. This creates a three-date model:

| Date Field | Purpose | Example (VAT Service) |
|------------|---------|----------------------|
| **Next Start Date** | When work period begins | 1st of month |
| **Target Delivery Date** | Internal goal for delivery (metrics) | 30th of month |
| **Deadline Date** (existing `nextDueDate`) | Hard deadline (statutory/external) | 7th of following month |

## Design Decisions

1. **Keep existing `nextDueDate` field name** - This remains the deadline date for backwards compatibility with Companies House linked services
2. **Add new `targetDeliveryDate` field** - New column alongside existing date fields
3. **No service-level default offset** - Target delivery date will be defined during client/person service mapping, not at the service template level
4. **Companies House services** - Add a `chTargetDeliveryDaysOffset` field to the Service definition. When CH updates the deadline date (`nextDueDate`), automatically calculate target delivery date by subtracting this offset (e.g., if offset is 7, target = deadline - 7 days)
5. **Performance metrics unchanged (for now)** - Keep using deadline date (`nextDueDate`) for "On Track" / "Behind Schedule" calculations. Update metrics to use target delivery date in a future release

---

## Database Schema Changes

### Tables Requiring New Columns

#### 1. `client_services` table
```sql
ALTER TABLE client_services ADD COLUMN target_delivery_date TIMESTAMP;
ALTER TABLE client_services ADD COLUMN intended_target_delivery_day INTEGER;
```

#### 2. `people_services` table
```sql
ALTER TABLE people_services ADD COLUMN target_delivery_date TIMESTAMP;
ALTER TABLE people_services ADD COLUMN intended_target_delivery_day INTEGER;
```

#### 3. `projects` table
```sql
ALTER TABLE projects ADD COLUMN target_delivery_date TIMESTAMP;
```

#### 4. `project_scheduling_history` table
```sql
ALTER TABLE project_scheduling_history ADD COLUMN previous_target_delivery_date TIMESTAMP;
ALTER TABLE project_scheduling_history ADD COLUMN new_target_delivery_date TIMESTAMP;
```

#### 5. `scheduling_exceptions` table
```sql
ALTER TABLE scheduling_exceptions ADD COLUMN target_delivery_date TIMESTAMP;
```

#### 6. `services` table (for CH offset)
```sql
ALTER TABLE services ADD COLUMN ch_target_delivery_days_offset INTEGER;
```
This field defines how many days before the CH deadline to set the target delivery date for Companies House-linked services.

### Files to Update

| File | Changes Required |
|------|-----------------|
| `shared/schema/services/tables.ts` | Add `targetDeliveryDate` and `intendedTargetDeliveryDay` columns to `clientServices` and `peopleServices`. Add `chTargetDeliveryDaysOffset` to `services` table |
| `shared/schema/projects/tables.ts` | Add `targetDeliveryDate` column to `projects` and update history tables |

---

## Type Definitions

### Schema Files

| File | Changes Required |
|------|-----------------|
| `shared/schema/services/schemas.ts` | Update `insertClientServiceSchema`, `updateClientServiceSchema`, `insertPeopleServiceSchema`, `updatePeopleServiceSchema` to include `targetDeliveryDate` |
| `shared/importTypes.ts` | Add `targetDeliveryDate` to `ServiceImportRow`, `CLIENT_SERVICE_FIELD_DEFINITIONS`, `PEOPLE_SERVICE_FIELD_DEFINITIONS` |

### Frontend Type Definitions

| File | Changes Required |
|------|-----------------|
| `client/src/pages/client-detail/utils/types.ts` | Update `AddServiceData`, `EditServiceData` schemas to include `targetDeliveryDate` |
| `client/src/pages/service-assignments.tsx` | Update `ClientServiceWithDetails` and `PeopleServiceWithDetails` interfaces |

---

## Backend Changes

### Storage Layer

| File | Changes Required |
|------|-----------------|
| `server/storage/base/IStorage.ts` | Update interface types for client/people service CRUD operations |
| `server/storage/base/types.ts` | Update any shared types |
| `server/storage/services/serviceStorage.ts` | Handle `targetDeliveryDate` in create/update operations |
| `server/storage/services/serviceAssignmentStorage.ts` | Include `targetDeliveryDate` in queries and updates |

### API Routes

| File | Changes Required |
|------|-----------------|
| `server/routes/clients/services.ts` | Accept and validate `targetDeliveryDate` in create/update endpoints |
| `server/routes/serviceImport.ts` | Handle `targetDeliveryDate` in import processing |
| `server/routes/excelImport.ts` | Include `targetDeliveryDate` in Excel import field mappings |

### Core Scheduling (CRITICAL - Requires Careful Review)

| File | Changes Required | Risk Level |
|------|-----------------|------------|
| `server/frequency-calculator.ts` | Add `calculateNextTargetDeliveryDate()` function | **HIGH** |
| `server/core/schedule-calculator.ts` | Update `NextDateResult` interface, add target delivery calculation | **HIGH** |
| `server/core/project-creator.ts` | Pass `targetDeliveryDate` when creating projects | **HIGH** |
| `server/core/service-mapper.ts` | Include `targetDeliveryDate` in service mapping | **MEDIUM** |
| `server/project-scheduler.ts` | Update `DueService` interface, include target delivery in rescheduling | **HIGH** |

### Notifications

| File | Changes Required |
|------|-----------------|
| `server/notification-variables.ts` | Add `targetDeliveryDate` as available notification variable |
| `server/notification-sender.ts` | Include target delivery date in notification context |
| `server/notification-scheduler.ts` | Optionally schedule notifications based on target delivery date |

### Companies House Integration

| File | Changes Required |
|------|-----------------|
| `server/ch-update-logic.ts` | When CH updates the deadline date (`nextDueDate`), calculate and set `targetDeliveryDate` using the service's `chTargetDeliveryDaysOffset` (deadline - offset days) |

**CH Target Delivery Date Logic:**
1. Service definition includes `chTargetDeliveryDaysOffset` (e.g., 7 days)
2. When CH data updates the client service's `nextDueDate` (deadline)
3. Automatically calculate `targetDeliveryDate = nextDueDate - chTargetDeliveryDaysOffset`
4. Update the client service's `targetDeliveryDate` field

---

## Frontend Changes

### Services Configuration Page (For CH Offset)

| File | Changes Required |
|------|-----------------|
| `client/src/pages/services.tsx` | Add `chTargetDeliveryDaysOffset` field to service create/edit form (only shown when `isCompaniesHouseConnected` is true) |

### Service Assignments Page (Primary Edit Interface for Existing Mappings)

| File | Changes Required |
|------|-----------------|
| `client/src/pages/service-assignments.tsx` | Add Target Delivery Date column to table, enable editing in detail panel |

### Client Detail - Service Views & Forms

| File | Changes Required |
|------|-----------------|
| `client/src/pages/client-detail/components/services/AddServiceModal.tsx` | Add Target Delivery Date field |
| `client/src/pages/client-detail/components/services/EditServiceModal.tsx` | Add Target Delivery Date field |
| `client/src/pages/client-detail/components/services/EditableServiceDetails.tsx` | Display and edit target delivery date |
| `client/src/pages/client-detail/components/services/ClientServiceRow.tsx` | Display target delivery date |
| `client/src/pages/client-detail/components/tabs/services/ServiceCard.tsx` | Display target delivery date |
| `client/src/pages/client-detail/components/tabs/services/PersonalServiceRow.tsx` | Display target delivery date |

### Client Service Detail Page

| File | Changes Required |
|------|-----------------|
| `client/src/pages/client-service-detail.tsx` | Display and allow editing of target delivery date |

### Scheduled Services View

| File | Changes Required |
|------|-----------------|
| `client/src/pages/scheduled-services.tsx` | Add Target Delivery Date column |
| `client/src/components/scheduled-services-tab.tsx` | Add Target Delivery Date column |

### Project Views

| File | Changes Required |
|------|-----------------|
| `client/src/pages/project-detail.tsx` | Display target delivery date |
| `client/src/components/project-info.tsx` | Display target delivery date (do NOT change "Behind Schedule" calculation - that stays on deadline date for now) |
| `client/src/components/project-card.tsx` | Optionally display target delivery date |

### Excel Import

| File | Changes Required |
|------|-----------------|
| `client/src/pages/excel-import.tsx` | Add target delivery date to available import fields |

### Admin/Dashboard

| File | Changes Required |
|------|-----------------|
| `client/src/pages/admin.tsx` | Review if any service-related admin features need updating |

---

## Implementation Phases

### Phase 1: Database & Schema (Low Risk)
1. Add database columns via migration
2. Update Drizzle schema files
3. Update Zod validation schemas
4. Update TypeScript interfaces

### Phase 2: Backend API (Medium Risk)
1. Update storage layer to handle new field
2. Update API routes to accept/return new field
3. Add to import/export functionality

### Phase 3: Service Assignments Page (Your Requested Feature)
1. Add Target Delivery Date column to table
2. Enable inline editing or detail panel editing
3. Add bulk edit capability for existing services

### Phase 4: Other Frontend Pages (Medium Risk)
1. Add Service Modal - include target delivery date field
2. Edit Service Modal - include target delivery date field
3. Client service detail views
4. Scheduled services views

### Phase 5: Scheduling Integration (HIGH RISK - Requires Thorough Testing)
1. Update frequency calculator to include target delivery date
2. Update project creator to set target delivery date on new projects
3. Update rescheduling logic to calculate next target delivery date
4. Update notification system for target delivery date awareness

### Phase 6: Project Display
1. Update project detail to show target delivery date
2. Update project info component to display target delivery date
3. **DO NOT** change "On Track" / "Behind Schedule" calculation (keep using deadline date)

### Future Phase: Performance Metrics Update
*To be implemented in a future release*
1. Update "On Track" / "Behind Schedule" to use target delivery date instead of deadline
2. Add new reporting/dashboard views for target delivery performance

---

## Testing Requirements

### Unit Tests
- Frequency calculation with target delivery date
- Date offset calculations
- Edge cases (end of month, leap years)

### Integration Tests
- Service creation with all three dates
- Service update with target delivery date
- Project creation inherits target delivery date from service
- Rescheduling correctly updates target delivery date

### End-to-End Tests
- Add service via modal with target delivery date
- Edit service via service assignments page
- View target delivery date in various locations
- Import services with target delivery dates

---

## Migration Strategy

### For Existing Services
1. Initially set `targetDeliveryDate` to NULL for all existing services
2. Provide bulk update tool on Service Assignments page to set target delivery dates
3. Optionally: Calculate default target delivery date as X days before deadline

### For Existing Projects
1. Initially set `targetDeliveryDate` to NULL
2. Optionally backfill based on service settings or deadline offset

---

## Resolved Design Questions

| Question | Decision |
|----------|----------|
| **Default offset** | No service-level default. Target delivery is defined during client/person mapping |
| **CH services** | Service config includes `chTargetDeliveryDaysOffset`. Target = CH deadline - offset days |
| **Metrics** | Keep using deadline date for now. Update to target delivery date in future release |

## Open Questions

1. **Required field**: Should target delivery date be optional or required for non-static services?
2. **Notifications**: Should there be notification templates for approaching target delivery date?
3. **Bulk update**: What should be the default behaviour when bulk-updating existing services with missing target delivery dates?

---

## Affected Documentation

| File | Changes Required |
|------|-----------------|
| `DOCS/Service_and_Project_Logic.md` | Add target delivery date to documentation |
| `DOCS/scheduling.md` | Update scheduling documentation |
| `DOCS/duplicate_prevention.md` | Review if any changes needed |
| `replit.md` | Update project overview if relevant |

---

## Summary

This is a **medium-high complexity** change affecting:
- **6** database tables (including `services` for CH offset)
- **~35** code files
- **3** core scheduling modules (requires careful testing)

**Estimated effort**: 2-3 days for full implementation

**Recommended approach**: 
1. Start with Phase 1-3 (database, backend, service assignments page)
2. Validate with stakeholders before proceeding to scheduling changes
3. Phase 5 (scheduling) should be done separately with extensive testing

**Timeline note**: Implementation is planned for a few weeks out, allowing time for thorough planning and documentation of the core scheduling modules before any changes are made.
