# Project Type Configuration - UI Excellence Sidequest

## Overview

Transform the Project Type configuration experience into a world-class, wizard-style interface that matches or exceeds the Campaign Wizard quality. This includes bug fixes, feature enhancements, and a complete UI overhaul.

## Testing Credentials

**HOW TO LOGIN:**
1. Go to root page (/)
2. Click on "Passwords" tab
3. Enter: admin@example.com | admin123

---

## Phase 1: Critical Bug Fixes

### 1.1 Drag & Drop Not Working for Task Template Questions
**Issue:** Questions cannot be reordered via drag and drop in the Client Tasks tab.
**Root cause:** Likely missing @dnd-kit setup or improper sortable context.
**Fix:** Implement proper SortableContext with DragOverlay for visual feedback.

### 1.2 Stage Reasons Not Filtering by Selected Stage
**Issue:** When selecting "On Completion: Move to Stage", the "With Reason" dropdown shows ALL reasons instead of filtering to reasons configured for the selected stage.
**Fix:** Filter reasons by stage using the stage-reason mappings API.

### 1.3 IF/THEN Stage Change Logic
**Issue:** Current implementation has a single "move to stage" setting, but depending on the PROJECT'S current stage when the task is completed, it might need to move to different target stages.
**Fix:** Add conditional stage change rules:
```
IF current stage is [Stage A] THEN move to [Stage X]
IF current stage is [Stage B] THEN move to [Stage Y]
ELSE move to [Default Stage]
```

---

## Phase 2: Task Template Sections

### 2.1 Add Sections Concept
**Inspiration:** Client task templates have sections for grouping related questions.
**Implementation:**
- Add `client_project_task_sections` table:
  - id, template_id, name, description, order
- Questions belong to sections
- Sections displayed as collapsible groups in staff view
- Mobile: One section per page (card-based navigation)

### 2.2 Section-Aware Mobile Form
**Behavior:**
- Each section = one swipeable card/page
- Progress indicator shows sections completed
- Section title displayed prominently
- All questions within section shown on that page

---

## Phase 3: Project Type UI Overhaul

### Design Philosophy
Transform from a tab-based editing experience to a **guided, wizard-style flow** with:
- Visual hierarchy and breathing room
- Progressive disclosure
- Contextual help
- Polished micro-interactions
- Mobile-responsive design

### 3.1 Research Best-in-Class Examples
Study these for inspiration:
- Notion template setup
- Airtable base configuration  
- Linear project settings
- Stripe product/price configuration
- HubSpot workflow builder
- The Link's own Campaign Wizard (7-step process)

### 3.2 Proposed New Structure

#### A. Project Type Overview/Dashboard
Replace current header with a rich overview card:
- Active/Inactive toggle (prominent)
- Single Project Per Client toggle
- Key metrics (active projects count, avg completion time)
- Quick links to each configuration area
- Visual status indicators for each area (configured/needs attention)

#### B. Configuration Sections (Wizard-Style Cards)

**1. Workflow Stages**
- Visual stage pipeline builder (drag to reorder)
- Each stage shows: color, SLA, assignee role
- Inline editing with smooth animations
- Connection lines between stages showing flow

**2. Stage Change Reasons**
- Grouped by "from stage"
- Visual indicators for required vs optional
- Easy mapping interface

**3. Approval Gates**
- Visual representation of approval checkpoints
- Who approves, when required
- Clear on/off toggles

**4. Field Library**
- Card-based field display
- Drag to reorder
- Field type icons
- Quick preview of each field's purpose

**5. Notifications**
- Timeline-style view of triggers
- "When [trigger] send [channel] to [recipient]"
- Visual channel indicators (email/SMS/voice icons)

**6. Client Tasks**
- Template cards with question count
- Section indicators
- Preview mode for how client sees it
- Full-featured template builder (wizard within wizard)

**7. Settings**
- Clean toggle switches for remaining settings
- Service linkage visualization
- Voice AI configuration

### 3.3 UI Components to Build

#### Step Progress Indicator
Horizontal or vertical step indicator showing:
- Completed sections (checkmark)
- Current section (highlighted)
- Pending sections (subtle)

#### Rich Section Cards
Each configuration area as a card with:
- Icon + Title
- Short description
- Status badge (Configured / Needs Setup)
- Item count
- Click to expand/edit

#### Inline Editing Patterns
- Click field to edit inline
- Smooth expand/collapse animations
- Auto-save with visual feedback
- Undo capability

#### Drag & Drop Excellence
- Clear drag handles
- Ghost preview during drag
- Drop zone highlighting
- Smooth reorder animations

#### Form Builder UI (for Task Templates)
- Left sidebar: Question type palette
- Center: Canvas with sections and questions
- Right sidebar: Properties panel for selected item
- Top: Template settings

### 3.4 Mobile Considerations
- Stack sections vertically
- Collapsible cards
- Touch-friendly drag handles
- Bottom sheet for editing

---

## Phase 4: Settings Consolidation

### Current Problems (from screenshot)
- "Project Type Settings" section is verbose
- Service Linkage takes too much space
- Assignment System Guide is documentation, not settings

### Proposed Consolidation

**Header Bar:**
- Project type name (editable)
- Active toggle
- Single Project toggle
- Linked service badge

**Remove from main view:**
- Assignment System Guide (move to help tooltip/drawer)
- Verbose explanations (make them contextual tooltips)

**Keep accessible:**
- Change Assignment System (as a modal/dialog)
- Voice AI configuration (as expandable section)

---

## Implementation Order

### Sprint 1: Bug Fixes (Must do first)
1. Fix drag & drop for task questions
2. Fix stage reason filtering
3. Add IF/THEN stage change logic

### Sprint 2: Task Template Sections
1. Database schema for sections
2. Section management UI
3. Mobile section-per-page navigation

### Sprint 3: UI Foundation
1. New header component with toggles and status
2. Section card components
3. Step progress indicator
4. Sidebar/panel layout structure

### Sprint 4: Configuration Sections Rebuild
1. Workflow Stages visual builder
2. Reasons management
3. Approval gates
4. Field library cards

### Sprint 5: Notifications & Tasks
1. Notification timeline view
2. Task template builder (wizard-style)
3. Settings consolidation

### Sprint 6: Polish
1. Animations and transitions
2. Mobile optimization
3. Keyboard navigation
4. Accessibility audit
5. Performance optimization

---

## Success Metrics

- [ ] All drag & drop operations work fluidly
- [ ] Stage reasons filter correctly by stage
- [ ] IF/THEN stage logic prevents incorrect transitions
- [ ] Task templates support sections
- [ ] Mobile displays one section per page
- [ ] UI feels cohesive with Campaign Wizard quality
- [ ] All toggles and settings easily accessible
- [ ] Configuration status visible at a glance
- [ ] No configuration requires hunting through tabs

---

## Technical Notes

### Existing Patterns to Reuse
- Campaign Wizard step structure and state management
- @dnd-kit for drag and drop
- shadcn/ui components throughout
- TanStack Query for data management
- Existing hooks in `project-type-detail/hooks/`

### Files to Modify
- `client/src/pages/project-type-detail/ProjectTypeDetailPage.tsx` - Main restructure
- `client/src/pages/project-type-detail/components/tabs/ClientTasksTab.tsx` - Bug fixes + sections
- `client/src/pages/project-type-detail/components/tabs/KanbanStagesTab.tsx` - Visual builder
- All tab components - UI polish
- New components for wizard-style layout

### Database Changes
- `client_project_task_sections` - New table for sections
- `client_project_task_questions.section_id` - FK to sections
- `client_project_task_templates.stage_change_rules` - JSONB for IF/THEN logic

---

## Reference: Campaign Wizard Pattern

The Campaign Wizard uses:
1. **WizardState** - Central state object for all steps
2. **Step components** - Each step is a separate component
3. **Sidebar context** - Dynamic sidebar content per step
4. **Auto-save** - Changes saved as user progresses
5. **Visual step indicator** - Clear progress visualization
6. **Category-based theming** - Colors and icons per type

Apply similar patterns for Project Type configuration.
