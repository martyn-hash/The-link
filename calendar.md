# Calendar View Implementation Document

## Overview

The calendar view is a new view mode for the `/projects` page that provides a unified timeline display of:
- **Projects**: Due dates, target delivery dates, and stage deadlines
- **Tasks**: Ad-hoc internal task due dates

This solves the challenge of visualizing both repetitive work (projects) and one-off requests (tasks) in a single timeline.

---

## Architecture

### View Mode Extension

**Current:** `type ViewMode = "kanban" | "list" | "dashboard"`

**Updated:** `type ViewMode = "kanban" | "list" | "dashboard" | "calendar"`

### Calendar Event Data Structure

```typescript
interface CalendarEvent {
  id: string;
  type: "project_due" | "project_target" | "stage_deadline" | "task_due";
  title: string;
  date: Date;
  entityId: string;
  entityType: "project" | "task";
  assigneeId: string | null;
  assigneeName: string | null;
  clientName: string | null;
  status: string;
  color: string;
  isOverdue: boolean;
  meta?: {
    stageName?: string;
    projectTypeName?: string;
    serviceName?: string;
  };
}
```

---

## Features

### Calendar Views

| View | Description |
|------|-------------|
| **Month** | Traditional calendar grid showing full month with event pills |
| **Week** | Detailed 7-day view with more vertical space per day |

### Navigation

- Previous/Next period buttons
- "Today" quick-jump button
- Month/Week toggle switch
- Optional: Date picker for jumping to specific dates

### Event Display

**Visual Differentiation:**
- **Projects**: Displayed as standard event pills
- **Tasks**: Displayed with a distinct icon badge (e.g., checkbox icon) to differentiate from projects
- **Overdue items**: Red/warning border or background tint
- **Event types**: Subtle visual indicator (icon or label) for due date vs target date vs stage deadline

**Colour Coding (by assignee):**
- Each user gets a consistent colour derived from their user data
- Unassigned items use a neutral/grey colour

### Interactions

**Hover (Tooltip):**
- Entity type label: "Project" or "Task"
- Title/name
- Client name (if applicable)
- Assignee
- Status
- Date type (Due Date / Target Delivery / Stage Deadline)
- Days until due or days overdue

**Click (Modal):**
- Opens existing project detail modal or task detail modal
- Includes "View Full Version" link to navigate to full page

---

## Calendar-Specific Controls

Located on the calendar toolbar (not in main filter panel since they only apply to calendar view):

| Control | Options | Default |
|---------|---------|---------|
| Show Project Due Dates | Toggle on/off | On |
| Show Target Delivery Dates | Toggle on/off | On |
| Show Stage Deadlines | Toggle on/off | Off |
| Show Tasks | Toggle on/off | On |

---

## Filter Integration

The existing filter panel will work with calendar view:

| Existing Filter | Behaviour in Calendar |
|-----------------|----------------------|
| Service Filter | Filters projects by service |
| Task Assignee Filter | Filters both project assignees AND task assignees |
| Service Owner Filter | Filters projects by service owner |
| User Filter | Filters by bookkeeper |
| Show Archived | Extends to include closed/archived tasks |
| Date Filter | Applies to event dates (though calendar naturally shows date range) |
| Behind Schedule | Highlights/filters behind schedule items |

---

## Saved Calendar Views

Calendar views can be saved and will appear in the ViewMegaMenu under a new "Calendars" category.

**Saved state includes:**
```typescript
{
  viewMode: "calendar",
  filters: {
    // Standard filters
    serviceFilter: string,
    taskAssigneeFilter: string,
    serviceOwnerFilter: string,
    userFilter: string,
    showArchived: boolean,
    // Calendar-specific settings
    calendarViewType: "month" | "week",
    showProjectDueDates: boolean,
    showProjectTargetDates: boolean,
    showStageDeadlines: boolean,
    showTaskDueDates: boolean
  }
}
```

---

## API Design

### Endpoint: `GET /api/calendar/events`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| start | ISO date string | Start of date range |
| end | ISO date string | End of date range |
| serviceFilter | string | Filter by service ID |
| taskAssigneeFilter | string | Filter by assignee user ID |
| serviceOwnerFilter | string | Filter by service owner ID |
| userFilter | string | Filter by bookkeeper ID |
| showArchived | boolean | Include archived/closed items |
| includeProjectDues | boolean | Include project due dates |
| includeTargetDates | boolean | Include target delivery dates |
| includeStageDeadlines | boolean | Include stage deadline events |
| includeTasks | boolean | Include internal task due dates |

**Response:**
```typescript
{
  events: CalendarEvent[];
  userColors: Record<string, string>; // userId -> hex color
}
```

---

## Component Structure

```
client/src/components/calendar/
├── CalendarView.tsx           # Main container, state management
├── CalendarHeader.tsx         # Navigation, view toggle, event type toggles
├── CalendarMonthView.tsx      # Month grid layout
├── CalendarWeekView.tsx       # Week column layout  
├── CalendarDay.tsx            # Single day cell with events
├── CalendarEvent.tsx          # Event pill/chip component
├── CalendarEventTooltip.tsx   # Hover preview content
├── CalendarLegend.tsx         # Collapsible legend/key
└── useCalendarEvents.ts       # React Query hook for fetching events
```

---

## Database Changes

**No schema changes required.** 

The existing `project_views` table already supports:
- `viewMode` - will now accept "calendar"
- `filters` - JSON field will store calendar-specific settings

---

## Implementation Phases

### Phase 1: Core Calendar (MVP)
1. Create CalendarView component with month view
2. Create calendar API endpoint
3. Extend ViewMode type to include "calendar"
4. Add calendar option to view mode switcher
5. Basic event rendering with colour coding
6. Hover tooltips
7. Click to open existing project/task modals
8. Calendar-specific toggle controls

### Phase 2: Full Integration
1. Week view implementation
2. Filter panel integration
3. Save calendar views functionality
4. Add "Calendars" section to ViewMegaMenu
5. Load saved calendar views

### Phase 3: Polish
1. Mobile-responsive layout
2. Performance optimization
3. Keyboard navigation
4. Empty state handling

---

## Technical Notes

### Dependencies (already installed)
- `date-fns` - Date manipulation and formatting
- `@radix-ui/react-tooltip` - Hover previews
- `@radix-ui/react-dialog` - Event modals
- `lucide-react` - Icons

### Performance Considerations
- Fetch events only for visible date range + 1 month buffer
- Use React Query with date-range-based cache keys
- Memoize event filtering/grouping by day
- Lazy load full event details on click

### Colour Generation
Generate consistent colours from user IDs using a hash function to HSL, ensuring:
- Good contrast with white/dark backgrounds
- Consistent colours across sessions
- Distinguishable between different users

---

## UI/UX Guidelines

### Visual Hierarchy
1. Current day highlighted
2. Overdue items visually prominent (warning colours)
3. Different event types subtly distinguishable
4. Tasks clearly marked as different from projects

### Accessibility
- Sufficient colour contrast
- Keyboard navigable
- Screen reader labels for events
- Focus indicators

### Responsive Behaviour
- Desktop: Full month/week grid
- Tablet: Condensed grid with fewer details
- Mobile: Consider day-by-day or agenda-style list view
