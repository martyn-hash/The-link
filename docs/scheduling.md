# Scheduling System Documentation and Feature Planning

## Current System Overview

### Existing Infrastructure
Your scheduling system is already quite sophisticated with these key components:

#### 1. **Automated Project Scheduler** 
- **Status**: ✅ Production Ready (Phase 3 Complete)
- **Function**: Runs nightly at 1:00 AM UTC to create projects from due services
- **Key Features**:
  - Processes all client services and people services
  - Creates projects for services with `nextStartDate = today`
  - Updates `nextStartDate` and `nextDueDate` based on frequency
  - Full audit trail via `projectSchedulingHistory` table
  - Run logs in `schedulingRunLogs` table
  - Admin monitoring dashboard at `/admin`
  - Manual trigger capabilities with dry-run testing
  - Idempotency protection against duplicates

#### 2. **Data Model** (Existing)
- **Services**: Core service definitions with UDF support and Companies House integration
- **Client Services**: Links clients to services with scheduling data (`nextStartDate`, `nextDueDate`, `frequency`, `isActive`)
- **People Services**: Links individuals to personal services with scheduling data
- **Project Scheduling History**: Complete audit trail of all scheduling actions
- **Scheduling Run Logs**: Tracks each nightly run with metrics and error details
join
#### 3. **Current Admin Interface**
- **Services Management**: Available at `/services` (Admin dropdown)
- **Project Scheduling Dashboard**: Available at `/admin` 
- **Project Types Configuration**: Available at `/project-types`
- **Manual Scheduling Controls**: Trigger, analyze, and dry-run capabilities

#### 4. **Frequency Calculation Engine**
- Supports: daily, weekly, fortnightly, monthly, quarterly, annually
- Handles edge cases: end-of-month, leap years, business days
- UTC date normalization for consistency
- Overdue service detection and analysis

### Current Navigation Structure
- **Top Bar**: Logo, User Profile, Client Search, All Tasks (admin), Admin Dropdown, Sign Out
- **Admin Dropdown**: Project Scheduling, Project Types, Services, CH Changes, Tags, User Management

---

## NEW FEATURE: Scheduled Services View

### 1. **Navigation Enhancement**
**Objective**: Add a new top-level "Services" menu item in the top navigation bar

**Implementation Plan**:
- **Location**: Add between "All Tasks" and "Admin Dropdown" in `top-navigation.tsx`
- **Access Control**: Available to admins and users with `canSeeAdminMenu` permission
- **Visual Design**: Match existing button styling with appropriate icon (Calendar, Settings2, or similar)
- **Route**: `/scheduled-services` (new route, separate from existing `/services`)

### 2. **Scheduled Services Page**
**Route**: `/scheduled-services`  
**Component**: New `ScheduledServices.tsx` page component

#### **Page Structure**:
```
┌─────────────────────────────────────────────┐
│ Top Navigation (with new Services button)   │
├─────────────────────────────────────────────┤
│ Page Header: "Scheduled Services"           │
├─────────────────────────────────────────────┤
│ Filters & Controls Section                  │
│ [Today's Date Toggle] [Service Filter]      │
│ [Create Projects Button]                    │
├─────────────────────────────────────────────┤
│ Services Table/List                         │
│ [Service Name | Client/Person | Next Start │
│  | Next Due | Project Type | Active Project]│
└─────────────────────────────────────────────┘
```

#### **Data Requirements**:
The page will need to fetch and display:

**Primary Data Source**: Combined query fetching:
- All `clientServices` with related `clients`, `services`, and `projectTypes`
- All `peopleServices` with related `people`, `services`, and `projectTypes`
- Current active projects for each service (to populate "Active Project" boolean)

**Suggested API Endpoint**: `GET /api/scheduled-services`
**Response Format**:
```typescript
interface ScheduledServiceView {
  id: string;
  serviceId: string;
  serviceName: string;
  clientOrPersonName: string;
  clientOrPersonType: 'client' | 'person';
  nextStartDate: Date | null;
  nextDueDate: Date | null;
  projectTypeName: string;
  hasActiveProject: boolean;
  frequency: string;
  isActive: boolean;
  serviceOwnerId?: string;
  serviceOwnerName?: string;
}
```

#### **Table Columns**:
1. **Service Name** - The name of the service
2. **Client / Person Name** - Who the service is for
3. **Next Start Date** - When the service is next scheduled to start
4. **Next Due Date** - When the service is due
5. **Project Type** - The type of project that gets created
6. **Active Project** - Boolean indicator showing if there's currently an ongoing project for this service

#### **Filtering & Controls**:

**1. Date Filter Toggle**:
- **Default**: Show only services with `nextStartDate = today`
- **Option**: "Show All Services" toggle to display all scheduled services
- **Implementation**: Client-side filtering or API parameter

**2. Service Filter Dropdown**:
- **Options**: "All Services" + individual service names
- **Function**: Filter the view to show only specific service types
- **Data Source**: Unique service names from the combined dataset

**3. Create Projects Button**:
- **Label**: "Create Projects"
- **Function**: Trigger project creation for all services with `nextStartDate = today`
- **Confirmation**: Show confirmation dialog with count of services to be processed
- **API Call**: `POST /api/project-scheduling/run` (existing endpoint)
- **Feedback**: Show toast notification with results summary
- **Refresh**: Refresh the table data after successful project creation

### 3. **Backend API Development**

#### **New Endpoint**: `GET /api/scheduled-services`
**Purpose**: Fetch all scheduled services with combined client/people data

**Implementation Considerations**:
- **Storage Method**: Add `getScheduledServicesView()` to storage interface
- **Query Logic**: 
  - Join `clientServices` → `clients` → `services` → `projectTypes`
  - Join `peopleServices` → `people` → `services` → `projectTypes`
  - Check for active projects for each service (via `projects` table)
  - Union the results with consistent field mapping

**Query Logic for Active Projects**:
```sql
-- Determine if service has active project
EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.clientId = clientServices.clientId 
  AND projects.projectTypeId = (SELECT projectTypeId FROM services WHERE services.id = clientServices.serviceId)
  AND projects.archived = false 
  AND projects.inactive = false
  AND projects.currentStatus != 'completed'
)
```

#### **Enhanced Project Creation Endpoint**
**Existing**: `POST /api/project-scheduling/run`  
**Enhancement**: Already supports manual triggering - no changes needed

The existing endpoint provides perfect functionality:
- Creates projects for services due today
- Updates `nextStartDate` and `nextDueDate`
- Records full audit trail in `projectSchedulingHistory`
- Returns comprehensive metrics and error details
- Supports dry-run testing

### 4. **Date & History Tracking** (Already Implemented ✅)

Your system already has excellent audit trail capabilities:

#### **Service Date Updates**:
- **Current**: When projects are created, service dates are automatically updated using the frequency calculation engine
- **Tracking**: Full history preserved in `projectSchedulingHistory` table with:
  - Previous start/due dates
  - New start/due dates  
  - Frequency used
  - Action taken ('created', 'rescheduled', 'skipped', 'failed')
  - Timestamp and notes

#### **Verification Capabilities**:
- **Admin Dashboard**: Already exists at `/admin` with comprehensive metrics
- **History Queries**: Can verify service date progressions via `projectSchedulingHistory`
- **Run Logs**: Track overall system performance via `schedulingRunLogs`

### 5. **Implementation Phases**

#### **Phase 1: Frontend Foundation**
1. **Navigation Enhancement**
   - Add "Services" button to top navigation
   - Update `top-navigation.tsx` and route handling
   - Add new route `/scheduled-services` to `App.tsx`

2. **Basic Page Structure**
   - Create `ScheduledServices.tsx` page component
   - Implement basic layout with header and table placeholder
   - Add filtering controls (date toggle, service dropdown)

#### **Phase 2: Backend API**
1. **Storage Interface**
   - Add `getScheduledServicesView()` method to `IStorage`
   - Implement database query with joins across all relevant tables
   - Include active project detection logic

2. **API Endpoint**
   - Create `GET /api/scheduled-services` route
   - Implement proper authentication/authorization
   - Return formatted data for frontend consumption

#### **Phase 3: Data Integration**
1. **Frontend Data Fetching**
   - Integrate with `@tanstack/react-query`
   - Implement proper loading and error states
   - Add data refreshing capabilities

2. **Table Implementation**
   - Build responsive table component with all required columns
   - Add sorting capabilities (by date, service name, client name)
   - Implement client-side filtering logic

#### **Phase 4: Project Creation Integration**
1. **Create Projects Button**
   - Connect to existing `POST /api/project-scheduling/run` endpoint
   - Add confirmation dialog with service count preview
   - Implement success/error feedback with toast notifications

2. **Real-time Updates**
   - Refresh table data after project creation
   - Update "Active Project" indicators
   - Show updated "Next Start Date" and "Next Due Date" values

#### **Phase 5: Polish & Testing**
1. **UI/UX Enhancements**
   - Add loading skeletons
   - Implement proper error handling and empty states
   - Responsive design testing

2. **Integration Testing**
   - Test project creation workflow end-to-end
   - Verify date updates and history tracking
   - Validate filtering and sorting functionality

### 6. **Technical Specifications**

#### **Data Flow**:
```
User clicks "Services" → Navigate to /scheduled-services
                      ↓
Frontend fetches data → GET /api/scheduled-services
                      ↓
Backend queries DB   → clientServices + peopleServices + joins
                      ↓
Frontend renders     → Table with filters and controls
                      ↓
User clicks "Create Projects" → POST /api/project-scheduling/run
                             ↓
Backend creates projects     → Updates service dates + audit trail
                             ↓
Frontend refreshes data      → Shows updated information
```

#### **Database Queries Needed**:

**Primary Query** (for scheduled services view):
```sql
-- Client Services
SELECT 
  cs.id,
  s.name as serviceName,
  c.name as clientOrPersonName,
  'client' as clientOrPersonType,
  cs.nextStartDate,
  cs.nextDueDate,
  pt.name as projectTypeName,
  cs.frequency,
  cs.isActive,
  -- Active project check
  EXISTS(SELECT 1 FROM projects p WHERE p.clientId = cs.clientId 
         AND p.projectTypeId = pt.id AND p.archived = false 
         AND p.inactive = false AND p.currentStatus != 'completed') as hasActiveProject
FROM clientServices cs
JOIN clients c ON cs.clientId = c.id
JOIN services s ON cs.serviceId = s.id
JOIN projectTypes pt ON s.id = pt.serviceId
WHERE cs.isActive = true

UNION ALL

-- People Services  
SELECT 
  ps.id,
  s.name as serviceName,
  p.fullName as clientOrPersonName,
  'person' as clientOrPersonType,
  ps.nextStartDate,
  ps.nextDueDate,
  pt.name as projectTypeName,
  ps.frequency,
  ps.isActive,
  false as hasActiveProject -- People services may not have same project model
FROM peopleServices ps
JOIN people p ON ps.personId = p.id
JOIN services s ON ps.serviceId = s.id
JOIN projectTypes pt ON s.id = pt.serviceId
WHERE ps.isActive = true
```

#### **Component Architecture**:
```
ScheduledServices.tsx
├── Header Section
├── FiltersSection.tsx
│   ├── DateToggle (today only vs all)
│   ├── ServiceFilter (dropdown)
│   └── CreateProjectsButton
├── ServicesTable.tsx
│   ├── TableHeader (sortable columns)
│   ├── TableBody (data rows)
│   └── TablePagination (if needed)
└── StatusFeedback (toasts, loading states)
```

### 7. **Success Metrics & Validation**

#### **Functional Requirements Checklist**:
- [ ] New "Services" menu item visible in top navigation
- [ ] "Scheduled Services" page displays all services for clients and people
- [ ] Table shows: Service Name, Client/Person Name, Next Start Date, Next Due Date, Project Type, Active Project status
- [ ] Service filter dropdown reduces view by service type
- [ ] Date filter shows today's services by default, with option to show all
- [ ] "Create Projects" button processes services due today
- [ ] Service dates update correctly after project creation
- [ ] History tracking preserves audit trail in `projectSchedulingHistory`

#### **Integration Points**:
- ✅ **Existing Scheduler**: New view reads from same data used by nightly scheduler
- ✅ **Audit Trail**: Leverages existing `projectSchedulingHistory` table
- ✅ **Project Creation**: Uses existing proven `POST /api/project-scheduling/run` endpoint
- ✅ **Date Calculation**: Uses existing frequency calculation engine
- ✅ **Admin Dashboard**: Existing monitoring dashboard provides system health verification

#### **User Experience Goals**:
1. **Visibility**: Users can see all scheduled services in one consolidated view
2. **Control**: Users can manually trigger project creation instead of waiting for nightly run
3. **Confidence**: Real-time feedback shows system is working correctly
4. **Efficiency**: Filtering reduces cognitive load when reviewing services
5. **Transparency**: Clear indication of which services have active projects

### 8. **Future Enhancement Opportunities**

#### **Phase 6+ (Future)**:
- **Service Detail Modals**: Click service row to see scheduling history and project details
- **Bulk Actions**: Select multiple services for batch operations
- **Advanced Filtering**: Filter by service owner, frequency, overdue status
- **Calendar View**: Alternative view showing services on a calendar timeline
- **Notifications**: Email alerts for overdue services or failed project creation
- **Service Performance**: Analytics on project completion times and service efficiency

#### **Integration Expansions**:
- **Client Portal**: Allow clients to see their own service schedules
- **Mobile App**: Responsive design for mobile project management
- **API Webhooks**: External system notifications when projects are created
- **Reporting**: Automated reports on service delivery and scheduling metrics

---

## Conclusion

This new "Scheduled Services" feature builds perfectly on your existing robust infrastructure. The automated scheduling system you've already built provides the foundation, and this new interface gives users the visibility and control they need to manage services confidently.

The implementation leverages existing proven components:
- ✅ **Project creation logic** (already tested and production-ready)
- ✅ **Date calculation engine** (handles all frequency types and edge cases)  
- ✅ **Audit trail system** (comprehensive history tracking)
- ✅ **Admin monitoring** (existing dashboard for system health)

The new feature essentially provides a "manual control panel" for the automated system you've already built, giving users confidence that projects are being created correctly and allowing them to trigger creation outside the nightly schedule when needed.