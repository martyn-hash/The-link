import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, Plus, X, Calendar as CalendarIcon, Minimize2, Maximize2, ClipboardList, FolderKanban, Bookmark } from "lucide-react";
import LayoutsMenu from "@/components/LayoutsMenu";
import ViewMegaMenu from "@/components/ViewMegaMenu";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { CreateReminderDialog } from "@/components/create-reminder-dialog";
import type { ViewMode, WorkspaceMode, Dashboard, Widget } from "@/types/projects-page";
import type { ProjectView } from "@shared/schema";
import type { OwnershipFilter } from "@/components/tasks/TasksWorkspace";

export interface ProjectsHeaderProps {
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  viewMode: ViewMode;
  openTasksAndRemindersCount: number;
  isMobile: boolean;
  currentSavedViewId: string | null;
  currentSavedViewName: string | null;
  currentDashboard: Dashboard | null;
  kanbanCompactMode: boolean;
  dashboardWidgets: Widget[];
  dashboardDescription: string;
  dashboardIsHomescreen: boolean;
  dashboardVisibility: "private" | "shared";
  tasksOwnershipFilter: OwnershipFilter;
  tasksStatusFilter: string;
  tasksPriorityFilter: string;
  tasksFilterOpen: boolean;
  tasksActiveFilterCount: number;
  setTasksOwnershipFilter: (filter: OwnershipFilter) => void;
  setTasksStatusFilter: (status: string) => void;
  setTasksPriorityFilter: (priority: string) => void;
  setTasksFilterOpen: (open: boolean) => void;
  clearTasksFilters: () => void;
  handleManualViewModeChange: (mode: ViewMode) => void;
  handleLoadSavedView: (view: ProjectView) => void;
  handleLoadDashboard: (dashboard: Dashboard) => void;
  handleUpdateCurrentView: () => void;
  handleSaveDashboardAsNew: () => void;
  toggleKanbanCompactMode: () => void;
  activeFilterCount: () => number;
  setFilterPanelOpen: (open: boolean) => void;
  setSaveViewDialogOpen: (open: boolean) => void;
  onOpenCreateDashboard: () => void;
  onOpenEditDashboard: () => void;
}

export function ProjectsHeader({
  workspaceMode,
  setWorkspaceMode,
  viewMode,
  openTasksAndRemindersCount,
  isMobile,
  currentSavedViewId,
  currentSavedViewName,
  currentDashboard,
  kanbanCompactMode,
  tasksOwnershipFilter,
  tasksStatusFilter,
  tasksPriorityFilter,
  tasksFilterOpen,
  tasksActiveFilterCount,
  setTasksOwnershipFilter,
  setTasksStatusFilter,
  setTasksPriorityFilter,
  setTasksFilterOpen,
  clearTasksFilters,
  handleManualViewModeChange,
  handleLoadSavedView,
  handleLoadDashboard,
  handleUpdateCurrentView,
  handleSaveDashboardAsNew,
  toggleKanbanCompactMode,
  activeFilterCount,
  setFilterPanelOpen,
  setSaveViewDialogOpen,
  onOpenCreateDashboard,
  onOpenEditDashboard,
}: ProjectsHeaderProps) {
  return (
    <header className="bg-card border-b border-border page-container py-6">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <CurrentViewName viewName={currentSavedViewName} />
        
        <WorkspaceModeToggle
          workspaceMode={workspaceMode}
          setWorkspaceMode={setWorkspaceMode}
          openTasksAndRemindersCount={openTasksAndRemindersCount}
        />
        
        <DesktopToolbar
          workspaceMode={workspaceMode}
          viewMode={viewMode}
          currentSavedViewId={currentSavedViewId}
          currentDashboard={currentDashboard}
          kanbanCompactMode={kanbanCompactMode}
          isMobile={isMobile}
          tasksOwnershipFilter={tasksOwnershipFilter}
          tasksStatusFilter={tasksStatusFilter}
          tasksPriorityFilter={tasksPriorityFilter}
          tasksFilterOpen={tasksFilterOpen}
          tasksActiveFilterCount={tasksActiveFilterCount}
          setTasksOwnershipFilter={setTasksOwnershipFilter}
          setTasksStatusFilter={setTasksStatusFilter}
          setTasksPriorityFilter={setTasksPriorityFilter}
          setTasksFilterOpen={setTasksFilterOpen}
          clearTasksFilters={clearTasksFilters}
          handleManualViewModeChange={handleManualViewModeChange}
          handleLoadSavedView={handleLoadSavedView}
          handleLoadDashboard={handleLoadDashboard}
          handleUpdateCurrentView={handleUpdateCurrentView}
          handleSaveDashboardAsNew={handleSaveDashboardAsNew}
          toggleKanbanCompactMode={toggleKanbanCompactMode}
          activeFilterCount={activeFilterCount}
          setFilterPanelOpen={setFilterPanelOpen}
          setSaveViewDialogOpen={setSaveViewDialogOpen}
          onOpenCreateDashboard={onOpenCreateDashboard}
          onOpenEditDashboard={onOpenEditDashboard}
        />

        <MobileToolbar
          workspaceMode={workspaceMode}
          viewMode={viewMode}
          currentSavedViewId={currentSavedViewId}
          kanbanCompactMode={kanbanCompactMode}
          isMobile={isMobile}
          tasksOwnershipFilter={tasksOwnershipFilter}
          tasksStatusFilter={tasksStatusFilter}
          tasksPriorityFilter={tasksPriorityFilter}
          tasksFilterOpen={tasksFilterOpen}
          tasksActiveFilterCount={tasksActiveFilterCount}
          setTasksOwnershipFilter={setTasksOwnershipFilter}
          setTasksStatusFilter={setTasksStatusFilter}
          setTasksPriorityFilter={setTasksPriorityFilter}
          setTasksFilterOpen={setTasksFilterOpen}
          clearTasksFilters={clearTasksFilters}
          handleManualViewModeChange={handleManualViewModeChange}
          handleLoadSavedView={handleLoadSavedView}
          handleLoadDashboard={handleLoadDashboard}
          handleUpdateCurrentView={handleUpdateCurrentView}
          toggleKanbanCompactMode={toggleKanbanCompactMode}
          activeFilterCount={activeFilterCount}
          setFilterPanelOpen={setFilterPanelOpen}
          setSaveViewDialogOpen={setSaveViewDialogOpen}
        />
      </div>
    </header>
  );
}

interface CurrentViewNameProps {
  viewName: string | null;
}

function CurrentViewName({ viewName }: CurrentViewNameProps) {
  if (!viewName) {
    return <div className="hidden md:block w-[160px]" />;
  }

  return (
    <div 
      className="hidden md:flex items-center gap-2 w-[160px] flex-shrink-0"
      data-testid="current-view-name-container"
    >
      <Bookmark className="h-4 w-4 text-primary flex-shrink-0" />
      <span 
        className="text-sm font-medium text-foreground line-clamp-2 leading-tight"
        title={viewName}
        data-testid="text-current-view-name"
      >
        {viewName}
      </span>
    </div>
  );
}

interface WorkspaceModeToggleProps {
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  openTasksAndRemindersCount: number;
}

function WorkspaceModeToggle({
  workspaceMode,
  setWorkspaceMode,
  openTasksAndRemindersCount,
}: WorkspaceModeToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <Button
        variant={workspaceMode === "projects" ? "default" : "ghost"}
        size="sm"
        onClick={() => setWorkspaceMode("projects")}
        className="gap-2"
        data-testid="button-workspace-projects"
      >
        <FolderKanban className="h-4 w-4" />
        Projects
      </Button>
      <Button
        variant={workspaceMode === "tasks" ? "default" : "ghost"}
        size="sm"
        onClick={() => setWorkspaceMode("tasks")}
        className="gap-2 relative"
        data-testid="button-workspace-tasks"
      >
        <ClipboardList className="h-4 w-4" />
        Tasks
        {openTasksAndRemindersCount > 0 && (
          <Badge 
            variant="destructive" 
            className="ml-1 h-5 min-w-[20px] px-1.5 text-xs flex items-center justify-center"
            data-testid="badge-open-tasks-count"
          >
            {openTasksAndRemindersCount > 99 ? '99+' : openTasksAndRemindersCount}
          </Badge>
        )}
      </Button>
    </div>
  );
}

interface DesktopToolbarProps {
  workspaceMode: WorkspaceMode;
  viewMode: ViewMode;
  currentSavedViewId: string | null;
  currentDashboard: Dashboard | null;
  kanbanCompactMode: boolean;
  isMobile: boolean;
  tasksOwnershipFilter: OwnershipFilter;
  tasksStatusFilter: string;
  tasksPriorityFilter: string;
  tasksFilterOpen: boolean;
  tasksActiveFilterCount: number;
  setTasksOwnershipFilter: (filter: OwnershipFilter) => void;
  setTasksStatusFilter: (status: string) => void;
  setTasksPriorityFilter: (priority: string) => void;
  setTasksFilterOpen: (open: boolean) => void;
  clearTasksFilters: () => void;
  handleManualViewModeChange: (mode: ViewMode) => void;
  handleLoadSavedView: (view: ProjectView) => void;
  handleLoadDashboard: (dashboard: Dashboard) => void;
  handleUpdateCurrentView: () => void;
  handleSaveDashboardAsNew: () => void;
  toggleKanbanCompactMode: () => void;
  activeFilterCount: () => number;
  setFilterPanelOpen: (open: boolean) => void;
  setSaveViewDialogOpen: (open: boolean) => void;
  onOpenCreateDashboard: () => void;
  onOpenEditDashboard: () => void;
}

function DesktopToolbar({
  workspaceMode,
  viewMode,
  currentSavedViewId,
  currentDashboard,
  kanbanCompactMode,
  isMobile,
  tasksOwnershipFilter,
  tasksStatusFilter,
  tasksPriorityFilter,
  tasksFilterOpen,
  tasksActiveFilterCount,
  setTasksOwnershipFilter,
  setTasksStatusFilter,
  setTasksPriorityFilter,
  setTasksFilterOpen,
  clearTasksFilters,
  handleManualViewModeChange,
  handleLoadSavedView,
  handleLoadDashboard,
  handleUpdateCurrentView,
  handleSaveDashboardAsNew,
  toggleKanbanCompactMode,
  activeFilterCount,
  setFilterPanelOpen,
  setSaveViewDialogOpen,
  onOpenCreateDashboard,
  onOpenEditDashboard,
}: DesktopToolbarProps) {
  return (
    <div className="hidden md:flex items-center space-x-3 flex-shrink-0">
      {workspaceMode === "projects" ? (
        <>
          <LayoutsMenu
            currentViewMode={viewMode}
            onViewModeChange={handleManualViewModeChange}
          />

          <ViewMegaMenu
            currentViewMode={viewMode}
            currentSavedViewId={currentSavedViewId}
            onLoadListView={handleLoadSavedView}
            onLoadKanbanView={handleLoadSavedView}
            onLoadCalendarView={handleLoadSavedView}
            onLoadDashboard={handleLoadDashboard}
            onSaveNewView={() => setSaveViewDialogOpen(true)}
            onUpdateCurrentView={handleUpdateCurrentView}
          />

          {viewMode === "dashboard" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenCreateDashboard}
                data-testid="button-create-dashboard"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Dashboard
              </Button>
              
              {currentDashboard && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenEditDashboard}
                    data-testid="button-edit-dashboard"
                  >
                    Edit Dashboard
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSaveDashboardAsNew()}
                    data-testid="button-save-dashboard"
                  >
                    Save Dashboard
                  </Button>
                </>
              )}
            </>
          )}
          
          {(viewMode === "list" || viewMode === "kanban" || viewMode === "calendar") && (
            <Button
              variant="outline"
              onClick={() => setFilterPanelOpen(true)}
              className="relative h-11 md:h-8 px-2 md:px-4"
              data-testid="button-open-filters"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden md:inline ml-2">Filters</span>
              {activeFilterCount() > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-1 md:ml-2 rounded-full px-1.5 md:px-2 text-xs"
                  data-testid="badge-active-filters-count"
                >
                  {activeFilterCount()}
                </Badge>
              )}
            </Button>
          )}
          
          {viewMode === "kanban" && (
            <Button
              variant={kanbanCompactMode ? "default" : "outline"}
              size="sm"
              onClick={toggleKanbanCompactMode}
              className="h-11 md:h-8 px-2 md:px-4 gap-2"
              data-testid="button-toggle-compact-mode"
            >
              {kanbanCompactMode ? (
                <>
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden md:inline">Expand All</span>
                </>
              ) : (
                <>
                  <Minimize2 className="h-4 w-4" />
                  <span className="hidden md:inline">Compact View</span>
                </>
              )}
            </Button>
          )}
        </>
      ) : (
        <TasksToolbar
          isMobile={false}
          tasksOwnershipFilter={tasksOwnershipFilter}
          tasksStatusFilter={tasksStatusFilter}
          tasksPriorityFilter={tasksPriorityFilter}
          tasksFilterOpen={tasksFilterOpen}
          tasksActiveFilterCount={tasksActiveFilterCount}
          setTasksOwnershipFilter={setTasksOwnershipFilter}
          setTasksStatusFilter={setTasksStatusFilter}
          setTasksPriorityFilter={setTasksPriorityFilter}
          setTasksFilterOpen={setTasksFilterOpen}
          clearTasksFilters={clearTasksFilters}
        />
      )}
    </div>
  );
}

interface MobileToolbarProps {
  workspaceMode: WorkspaceMode;
  viewMode: ViewMode;
  currentSavedViewId: string | null;
  kanbanCompactMode: boolean;
  isMobile: boolean;
  tasksOwnershipFilter: OwnershipFilter;
  tasksStatusFilter: string;
  tasksPriorityFilter: string;
  tasksFilterOpen: boolean;
  tasksActiveFilterCount: number;
  setTasksOwnershipFilter: (filter: OwnershipFilter) => void;
  setTasksStatusFilter: (status: string) => void;
  setTasksPriorityFilter: (priority: string) => void;
  setTasksFilterOpen: (open: boolean) => void;
  clearTasksFilters: () => void;
  handleManualViewModeChange: (mode: ViewMode) => void;
  handleLoadSavedView: (view: ProjectView) => void;
  handleLoadDashboard: (dashboard: Dashboard) => void;
  handleUpdateCurrentView: () => void;
  toggleKanbanCompactMode: () => void;
  activeFilterCount: () => number;
  setFilterPanelOpen: (open: boolean) => void;
  setSaveViewDialogOpen: (open: boolean) => void;
}

function MobileToolbar({
  workspaceMode,
  viewMode,
  currentSavedViewId,
  kanbanCompactMode,
  isMobile,
  tasksOwnershipFilter,
  tasksStatusFilter,
  tasksPriorityFilter,
  tasksFilterOpen,
  tasksActiveFilterCount,
  setTasksOwnershipFilter,
  setTasksStatusFilter,
  setTasksPriorityFilter,
  setTasksFilterOpen,
  clearTasksFilters,
  handleManualViewModeChange,
  handleLoadSavedView,
  handleLoadDashboard,
  handleUpdateCurrentView,
  toggleKanbanCompactMode,
  activeFilterCount,
  setFilterPanelOpen,
  setSaveViewDialogOpen,
}: MobileToolbarProps) {
  return (
    <div className="flex md:hidden items-center gap-2 flex-shrink-0">
      {workspaceMode === "projects" ? (
        <>
          <LayoutsMenu
            currentViewMode={viewMode}
            onViewModeChange={handleManualViewModeChange}
            isMobileIconOnly={true}
          />

          <ViewMegaMenu
            currentViewMode={viewMode}
            currentSavedViewId={currentSavedViewId}
            onLoadListView={handleLoadSavedView}
            onLoadKanbanView={handleLoadSavedView}
            onLoadCalendarView={handleLoadSavedView}
            onLoadDashboard={handleLoadDashboard}
            onSaveNewView={() => setSaveViewDialogOpen(true)}
            onUpdateCurrentView={handleUpdateCurrentView}
            isMobileIconOnly={true}
          />
          
          {(viewMode === "list" || viewMode === "kanban" || viewMode === "calendar") && (
            <Button
              variant="outline"
              onClick={() => setFilterPanelOpen(true)}
              className="relative h-11 px-3"
              data-testid="button-open-filters-mobile"
            >
              <Filter className="w-4 h-4" />
              {activeFilterCount() > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-1.5 rounded-full px-1.5 text-xs"
                  data-testid="badge-active-filters-count-mobile"
                >
                  {activeFilterCount()}
                </Badge>
              )}
            </Button>
          )}
          
          {viewMode === "kanban" && (
            <Button
              variant={kanbanCompactMode ? "default" : "outline"}
              size="sm"
              onClick={toggleKanbanCompactMode}
              className="h-11 px-3"
              data-testid="button-toggle-compact-mode-mobile"
            >
              {kanbanCompactMode ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </>
      ) : (
        <TasksToolbar
          isMobile={true}
          tasksOwnershipFilter={tasksOwnershipFilter}
          tasksStatusFilter={tasksStatusFilter}
          tasksPriorityFilter={tasksPriorityFilter}
          tasksFilterOpen={tasksFilterOpen}
          tasksActiveFilterCount={tasksActiveFilterCount}
          setTasksOwnershipFilter={setTasksOwnershipFilter}
          setTasksStatusFilter={setTasksStatusFilter}
          setTasksPriorityFilter={setTasksPriorityFilter}
          setTasksFilterOpen={setTasksFilterOpen}
          clearTasksFilters={clearTasksFilters}
        />
      )}
    </div>
  );
}

interface TasksToolbarProps {
  isMobile: boolean;
  tasksOwnershipFilter: OwnershipFilter;
  tasksStatusFilter: string;
  tasksPriorityFilter: string;
  tasksFilterOpen: boolean;
  tasksActiveFilterCount: number;
  setTasksOwnershipFilter: (filter: OwnershipFilter) => void;
  setTasksStatusFilter: (status: string) => void;
  setTasksPriorityFilter: (priority: string) => void;
  setTasksFilterOpen: (open: boolean) => void;
  clearTasksFilters: () => void;
}

function TasksToolbar({
  isMobile,
  tasksOwnershipFilter,
  tasksStatusFilter,
  tasksPriorityFilter,
  tasksFilterOpen,
  tasksActiveFilterCount,
  setTasksOwnershipFilter,
  setTasksStatusFilter,
  setTasksPriorityFilter,
  setTasksFilterOpen,
  clearTasksFilters,
}: TasksToolbarProps) {
  if (isMobile) {
    return (
      <>
        <CreateTaskDialog 
          trigger={
            <Button size="sm" className="h-11 px-3" data-testid="button-create-task-mobile">
              <ClipboardList className="h-4 w-4" />
            </Button>
          }
        />
        <CreateReminderDialog 
          trigger={
            <Button variant="outline" size="sm" className="h-11 px-3" data-testid="button-create-reminder-mobile">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          }
        />
        <Popover open={tasksFilterOpen} onOpenChange={setTasksFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="relative h-11 px-3" data-testid="button-tasks-filters-mobile">
              <Filter className="h-4 w-4" />
              {tasksActiveFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {tasksActiveFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <TasksFilterContent
              tasksOwnershipFilter={tasksOwnershipFilter}
              tasksStatusFilter={tasksStatusFilter}
              tasksPriorityFilter={tasksPriorityFilter}
              tasksActiveFilterCount={tasksActiveFilterCount}
              setTasksOwnershipFilter={setTasksOwnershipFilter}
              setTasksStatusFilter={setTasksStatusFilter}
              setTasksPriorityFilter={setTasksPriorityFilter}
              clearTasksFilters={clearTasksFilters}
            />
          </PopoverContent>
        </Popover>
      </>
    );
  }

  return (
    <>
      <CreateTaskDialog 
        trigger={
          <Button size="sm" data-testid="button-create-task">
            <ClipboardList className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        }
      />
      <CreateReminderDialog 
        trigger={
          <Button variant="outline" size="sm" data-testid="button-create-reminder">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Set Reminder
          </Button>
        }
      />
      <Popover open={tasksFilterOpen} onOpenChange={setTasksFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="relative" data-testid="button-tasks-filters">
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {tasksActiveFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {tasksActiveFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <TasksFilterContent
            tasksOwnershipFilter={tasksOwnershipFilter}
            tasksStatusFilter={tasksStatusFilter}
            tasksPriorityFilter={tasksPriorityFilter}
            tasksActiveFilterCount={tasksActiveFilterCount}
            setTasksOwnershipFilter={setTasksOwnershipFilter}
            setTasksStatusFilter={setTasksStatusFilter}
            setTasksPriorityFilter={setTasksPriorityFilter}
            clearTasksFilters={clearTasksFilters}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

interface TasksFilterContentProps {
  tasksOwnershipFilter: OwnershipFilter;
  tasksStatusFilter: string;
  tasksPriorityFilter: string;
  tasksActiveFilterCount: number;
  setTasksOwnershipFilter: (filter: OwnershipFilter) => void;
  setTasksStatusFilter: (status: string) => void;
  setTasksPriorityFilter: (priority: string) => void;
  clearTasksFilters: () => void;
}

function TasksFilterContent({
  tasksOwnershipFilter,
  tasksStatusFilter,
  tasksPriorityFilter,
  tasksActiveFilterCount,
  setTasksOwnershipFilter,
  setTasksStatusFilter,
  setTasksPriorityFilter,
  clearTasksFilters,
}: TasksFilterContentProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Show</Label>
        <Select value={tasksOwnershipFilter} onValueChange={(v) => setTasksOwnershipFilter(v as OwnershipFilter)}>
          <SelectTrigger className="mt-1" data-testid="select-ownership-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="assigned">Assigned to Me</SelectItem>
            <SelectItem value="created">Created by Me</SelectItem>
            <SelectItem value="all">All Team Items</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium">Status</Label>
        <Select value={tasksStatusFilter} onValueChange={setTasksStatusFilter}>
          <SelectTrigger className="mt-1" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium">Priority</Label>
        <Select value={tasksPriorityFilter} onValueChange={setTasksPriorityFilter}>
          <SelectTrigger className="mt-1" data-testid="select-priority-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {tasksActiveFilterCount > 0 && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearTasksFilters}
          className="w-full"
          data-testid="button-clear-filters"
        >
          <X className="h-4 w-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  );
}
