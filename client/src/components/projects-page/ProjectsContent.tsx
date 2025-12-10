import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PullToRefresh from "react-simple-pull-to-refresh";
import DashboardBuilder from "@/components/dashboard-builder";
import KanbanBoard from "@/components/kanban-board";
import TaskList from "@/components/task-list";
import { CalendarView } from "@/components/calendar";
const PivotBuilder = lazy(() => import("@/components/PivotBuilder"));
import { TasksWorkspace, type OwnershipFilter } from "@/components/tasks/TasksWorkspace";
import { CommsWorkspace } from "@/components/comms/CommsWorkspace";
import type { ViewMode, WorkspaceMode, Dashboard, Widget, CalendarSettings, CustomDateRange, DynamicDateFilter, PivotConfig } from "@/types/projects-page";
import type { ProjectWithRelations, User } from "@shared/schema";

export interface ProjectsContentProps {
  workspaceMode: WorkspaceMode;
  viewMode: ViewMode;
  isMobile: boolean;
  projectsLoading: boolean;
  usersLoading: boolean;
  isManagerOrAdmin: boolean;
  user: User;
  paginatedProjects: ProjectWithRelations[];
  filteredProjects: ProjectWithRelations[];
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  itemsPerPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  setItemsPerPage: (count: number) => void;
  tasksOwnershipFilter: OwnershipFilter;
  tasksStatusFilter: string;
  tasksPriorityFilter: string;
  tasksAssigneeFilter: string;
  tasksDateFromFilter?: Date;
  tasksDateToFilter?: Date;
  tasksSearchQuery: string;
  tasksReassignMode: boolean;
  setTasksOwnershipFilter: (filter: OwnershipFilter) => void;
  setTasksStatusFilter: (status: string) => void;
  setTasksPriorityFilter: (priority: string) => void;
  setTasksAssigneeFilter: (assignee: string) => void;
  setTasksDateFromFilter: (date: Date | undefined) => void;
  setTasksDateToFilter: (date: Date | undefined) => void;
  setTasksSearchQuery: (query: string) => void;
  setTasksReassignMode: (mode: boolean) => void;
  handleRefresh: () => Promise<void>;
  handleManualViewModeChange: (mode: ViewMode) => void;
  handleCalendarEventClick: (event: any) => void;
  dashboardServiceFilter: string;
  dashboardTaskAssigneeFilter: string;
  dashboardServiceOwnerFilter: string;
  dashboardUserFilter: string;
  dashboardShowArchived: boolean;
  dashboardDynamicDateFilter: DynamicDateFilter;
  dashboardCustomDateRange: CustomDateRange;
  dashboardClientFilter: string;
  dashboardProjectTypeFilter: string;
  dashboardWidgets: Widget[];
  dashboardEditMode: boolean;
  currentDashboard: Dashboard | null;
  kanbanCompactMode: boolean;
  kanbanExpandedStages: Set<string>;
  toggleKanbanCompactMode: () => void;
  setKanbanExpandedStages: (stages: Set<string>) => void;
  setDashboardWidgets: (widgets: Widget[]) => void;
  serviceFilter: string;
  taskAssigneeFilter: string;
  serviceOwnerFilter: string;
  userFilter: string;
  showArchived: boolean;
  calendarSettings: CalendarSettings | undefined;
  setCalendarSettings: (settings: CalendarSettings | undefined) => void;
  onAddDashboardWidget: () => void;
  // List view sort settings
  listSortBy: string;
  listSortOrder: "asc" | "desc";
  onListSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void;
  // Pivot table settings
  pivotConfig?: PivotConfig | null;
  onPivotConfigChange?: (config: PivotConfig) => void;
  currentSavedViewId?: string | null;
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    </div>
  );
}

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  itemsPerPage: number;
  filteredProjectsCount: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  setItemsPerPage: (count: number) => void;
}

function PaginationControls({
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  itemsPerPage,
  filteredProjectsCount,
  setCurrentPage,
  setItemsPerPage,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-4 px-4 pb-4">
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground" data-testid="text-pagination-info">
          Showing {startIndex + 1}-{Math.min(endIndex, filteredProjectsCount)} of {filteredProjectsCount} projects
        </div>
        <Select
          value={itemsPerPage.toString()}
          onValueChange={(value) => {
            setItemsPerPage(Number(value));
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-[100px]" data-testid="select-items-per-page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          data-testid="button-prev-page"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm" data-testid="text-current-page">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          data-testid="button-next-page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface ViewContentProps {
  viewMode: ViewMode;
  projectsLoading: boolean;
  usersLoading: boolean;
  isManagerOrAdmin: boolean;
  user: User;
  paginatedProjects: ProjectWithRelations[];
  filteredProjects: ProjectWithRelations[];
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  itemsPerPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  setItemsPerPage: (count: number) => void;
  handleManualViewModeChange: (mode: ViewMode) => void;
  handleCalendarEventClick: (event: any) => void;
  dashboardServiceFilter: string;
  dashboardTaskAssigneeFilter: string;
  dashboardServiceOwnerFilter: string;
  dashboardUserFilter: string;
  dashboardShowArchived: boolean;
  dashboardDynamicDateFilter: DynamicDateFilter;
  dashboardCustomDateRange: CustomDateRange;
  dashboardClientFilter: string;
  dashboardProjectTypeFilter: string;
  dashboardWidgets: Widget[];
  dashboardEditMode: boolean;
  currentDashboard: Dashboard | null;
  kanbanCompactMode: boolean;
  kanbanExpandedStages: Set<string>;
  toggleKanbanCompactMode: () => void;
  setKanbanExpandedStages: (stages: Set<string>) => void;
  setDashboardWidgets: (widgets: Widget[]) => void;
  serviceFilter: string;
  taskAssigneeFilter: string;
  serviceOwnerFilter: string;
  userFilter: string;
  showArchived: boolean;
  calendarSettings: CalendarSettings | undefined;
  setCalendarSettings: (settings: CalendarSettings | undefined) => void;
  onAddDashboardWidget: () => void;
  // List view sort settings
  listSortBy: string;
  listSortOrder: "asc" | "desc";
  onListSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void;
  // Pivot table settings
  pivotConfig?: PivotConfig | null;
  onPivotConfigChange?: (config: PivotConfig) => void;
  currentSavedViewId?: string | null;
}

function ViewContent({
  viewMode,
  projectsLoading,
  usersLoading,
  isManagerOrAdmin,
  user,
  paginatedProjects,
  filteredProjects,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  itemsPerPage,
  setCurrentPage,
  setItemsPerPage,
  handleManualViewModeChange,
  handleCalendarEventClick,
  dashboardServiceFilter,
  dashboardTaskAssigneeFilter,
  dashboardServiceOwnerFilter,
  dashboardUserFilter,
  dashboardShowArchived,
  dashboardDynamicDateFilter,
  dashboardCustomDateRange,
  dashboardClientFilter,
  dashboardProjectTypeFilter,
  dashboardWidgets,
  dashboardEditMode,
  currentDashboard,
  kanbanCompactMode,
  kanbanExpandedStages,
  toggleKanbanCompactMode,
  setKanbanExpandedStages,
  setDashboardWidgets,
  serviceFilter,
  taskAssigneeFilter,
  serviceOwnerFilter,
  userFilter,
  showArchived,
  calendarSettings,
  setCalendarSettings,
  onAddDashboardWidget,
  listSortBy,
  listSortOrder,
  onListSortChange,
  pivotConfig,
  onPivotConfigChange,
  currentSavedViewId,
}: ViewContentProps) {
  if (projectsLoading || (isManagerOrAdmin && usersLoading)) {
    return <LoadingState />;
  }

  if (viewMode === "pivot") {
    // Use key to force remount when switching between saved views or returning to unsaved
    // This ensures internal layout state resets properly
    const pivotKey = `pivot-${currentSavedViewId || 'unsaved'}`;
    return (
      <Suspense fallback={<LoadingState />}>
        <PivotBuilder
          key={pivotKey}
          projects={filteredProjects}
          pivotConfig={pivotConfig}
          onPivotConfigChange={onPivotConfigChange}
        />
      </Suspense>
    );
  }

  if (viewMode === "dashboard") {
    return (
      <DashboardBuilder
        filters={{
          serviceFilter: dashboardServiceFilter,
          taskAssigneeFilter: dashboardTaskAssigneeFilter,
          serviceOwnerFilter: dashboardServiceOwnerFilter,
          userFilter: dashboardUserFilter,
          showArchived: dashboardShowArchived,
          dynamicDateFilter: dashboardDynamicDateFilter,
          customDateRange: dashboardCustomDateRange,
          clientFilter: dashboardClientFilter,
          projectTypeFilter: dashboardProjectTypeFilter,
        }}
        widgets={dashboardWidgets}
        editMode={dashboardEditMode}
        onAddWidget={onAddDashboardWidget}
        onRemoveWidget={(widgetId) => {
          setDashboardWidgets(dashboardWidgets.filter(w => w.id !== widgetId));
        }}
        currentDashboard={currentDashboard}
      />
    );
  }

  if (viewMode === "kanban") {
    return (
      <KanbanBoard 
        projects={paginatedProjects} 
        user={user}
        isCompactMode={kanbanCompactMode}
        onToggleCompactMode={toggleKanbanCompactMode}
        expandedStages={kanbanExpandedStages}
        onExpandedStagesChange={setKanbanExpandedStages}
      />
    );
  }

  if (viewMode === "calendar") {
    return (
      <CalendarView
        serviceFilter={serviceFilter}
        taskAssigneeFilter={taskAssigneeFilter}
        serviceOwnerFilter={serviceOwnerFilter}
        userFilter={userFilter}
        showArchived={showArchived}
        onEventClick={handleCalendarEventClick}
        initialSettings={calendarSettings}
        onSettingsChange={setCalendarSettings}
      />
    );
  }

  return (
    <>
      <TaskList 
        projects={paginatedProjects} 
        user={user} 
        serviceFilter={serviceFilter}
        onSwitchToKanban={() => handleManualViewModeChange("kanban")}
        viewType="projects-list"
        initialSortBy={listSortBy}
        initialSortOrder={listSortOrder}
        onSortChange={onListSortChange}
      />
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        itemsPerPage={itemsPerPage}
        filteredProjectsCount={filteredProjects.length}
        setCurrentPage={setCurrentPage}
        setItemsPerPage={setItemsPerPage}
      />
    </>
  );
}

export function ProjectsContent({
  workspaceMode,
  viewMode,
  isMobile,
  projectsLoading,
  usersLoading,
  isManagerOrAdmin,
  user,
  paginatedProjects,
  filteredProjects,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  itemsPerPage,
  setCurrentPage,
  setItemsPerPage,
  tasksOwnershipFilter,
  tasksStatusFilter,
  tasksPriorityFilter,
  tasksAssigneeFilter,
  tasksDateFromFilter,
  tasksDateToFilter,
  tasksSearchQuery,
  tasksReassignMode,
  setTasksOwnershipFilter,
  setTasksStatusFilter,
  setTasksPriorityFilter,
  setTasksAssigneeFilter,
  setTasksSearchQuery,
  setTasksReassignMode,
  handleRefresh,
  handleManualViewModeChange,
  handleCalendarEventClick,
  dashboardServiceFilter,
  dashboardTaskAssigneeFilter,
  dashboardServiceOwnerFilter,
  dashboardUserFilter,
  dashboardShowArchived,
  dashboardDynamicDateFilter,
  dashboardCustomDateRange,
  dashboardClientFilter,
  dashboardProjectTypeFilter,
  dashboardWidgets,
  dashboardEditMode,
  currentDashboard,
  kanbanCompactMode,
  kanbanExpandedStages,
  toggleKanbanCompactMode,
  setKanbanExpandedStages,
  setDashboardWidgets,
  serviceFilter,
  taskAssigneeFilter,
  serviceOwnerFilter,
  userFilter,
  showArchived,
  calendarSettings,
  setCalendarSettings,
  onAddDashboardWidget,
  listSortBy,
  listSortOrder,
  onListSortChange,
  pivotConfig,
  onPivotConfigChange,
  currentSavedViewId,
}: ProjectsContentProps) {
  const viewContentProps = {
    viewMode,
    projectsLoading,
    usersLoading,
    isManagerOrAdmin,
    user,
    paginatedProjects,
    filteredProjects,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    handleManualViewModeChange,
    handleCalendarEventClick,
    dashboardServiceFilter,
    dashboardTaskAssigneeFilter,
    dashboardServiceOwnerFilter,
    dashboardUserFilter,
    dashboardShowArchived,
    dashboardDynamicDateFilter,
    dashboardCustomDateRange,
    dashboardClientFilter,
    dashboardProjectTypeFilter,
    dashboardWidgets,
    dashboardEditMode,
    currentDashboard,
    kanbanCompactMode,
    kanbanExpandedStages,
    toggleKanbanCompactMode,
    setKanbanExpandedStages,
    setDashboardWidgets,
    serviceFilter,
    taskAssigneeFilter,
    serviceOwnerFilter,
    userFilter,
    showArchived,
    calendarSettings,
    setCalendarSettings,
    onAddDashboardWidget,
    listSortBy,
    listSortOrder,
    onListSortChange,
    pivotConfig,
    onPivotConfigChange,
    currentSavedViewId,
  };

  if (workspaceMode === "tasks") {
    return (
      <main className="flex-1 overflow-auto w-full px-4 md:px-6 lg:px-8 py-6 md:py-8" style={{ paddingBottom: isMobile ? '4rem' : '0' }}>
        <TasksWorkspace 
          ownershipFilter={tasksOwnershipFilter}
          statusFilter={tasksStatusFilter}
          priorityFilter={tasksPriorityFilter}
          assigneeFilter={tasksAssigneeFilter}
          dateFromFilter={tasksDateFromFilter}
          dateToFilter={tasksDateToFilter}
          searchQuery={tasksSearchQuery}
          reassignMode={tasksReassignMode}
          onOwnershipFilterChange={setTasksOwnershipFilter}
          onStatusFilterChange={setTasksStatusFilter}
          onPriorityFilterChange={setTasksPriorityFilter}
          onAssigneeFilterChange={setTasksAssigneeFilter}
          onSearchQueryChange={setTasksSearchQuery}
          onReassignModeChange={setTasksReassignMode}
        />
      </main>
    );
  }

  if (workspaceMode === "comms") {
    return (
      <main className="flex-1 overflow-auto w-full px-4 md:px-6 lg:px-8 py-6 md:py-8" style={{ paddingBottom: isMobile ? '4rem' : '0' }}>
        <CommsWorkspace />
      </main>
    );
  }

  if (isMobile) {
    return (
      <main className="flex-1 overflow-auto w-full px-4 md:px-6 lg:px-8 py-6 md:py-8" style={{ paddingBottom: '4rem' }}>
        <PullToRefresh
          onRefresh={handleRefresh}
          pullingContent=""
          refreshingContent={
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }
        >
          <div>
            <ViewContent {...viewContentProps} />
          </div>
        </PullToRefresh>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <ViewContent {...viewContentProps} />
    </main>
  );
}
