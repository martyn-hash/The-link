import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBackgroundPrefetch, getTasksPrefetchConfigs } from "@/hooks/useBackgroundPrefetch";
import { queryClient } from "@/lib/queryClient";
import { useProjectsData } from "./useProjectsData";
import { useProjectFiltering } from "./useProjectFiltering";
import { useProjectsUrlSync } from "./useProjectsUrlSync";
import { useProjectsMutations } from "./useProjectsMutations";
import { useViewManagement } from "./useViewManagement";
import { useDashboardManagement } from "./useDashboardManagement";
import type { 
  ViewMode, 
  WorkspaceMode, 
  Widget, 
  Dashboard, 
  CalendarSettings,
  DynamicDateFilter,
  ScheduleStatusFilter,
  CustomDateRange,
  ProjectFilters,
  ProjectView,
  PivotConfig,
} from "@/types/projects-page";
import type { OwnershipFilter } from "@/components/tasks/TasksWorkspace";

const DEFAULT_ITEMS_PER_PAGE = 15;
const COMPACT_MODE_STORAGE_KEY = "kanban-compact-mode";

export function useProjectsPageState() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("projects");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const [tasksOwnershipFilter, setTasksOwnershipFilter] = useState<OwnershipFilter>("assigned");
  const [tasksStatusFilter, setTasksStatusFilter] = useState("open");
  const [tasksPriorityFilter, setTasksPriorityFilter] = useState("all");
  const [tasksAssigneeFilter, setTasksAssigneeFilter] = useState("all");
  const [tasksDateFromFilter, setTasksDateFromFilter] = useState<Date | undefined>(undefined);
  const [tasksDateToFilter, setTasksDateToFilter] = useState<Date | undefined>(undefined);
  const [tasksSearchQuery, setTasksSearchQuery] = useState("");
  const [tasksReassignMode, setTasksReassignMode] = useState(false);

  const tasksActiveFilterCount = (tasksOwnershipFilter !== "assigned" ? 1 : 0) + 
    (tasksStatusFilter !== "open" ? 1 : 0) + 
    (tasksPriorityFilter !== "all" ? 1 : 0) +
    // Only count assignee filter when not in "assigned" mode (since it's hidden in that mode)
    (tasksOwnershipFilter !== "assigned" && tasksAssigneeFilter !== "all" ? 1 : 0) +
    (tasksDateFromFilter ? 1 : 0) +
    (tasksDateToFilter ? 1 : 0);

  const clearTasksFilters = useCallback(() => {
    setTasksOwnershipFilter("assigned");
    setTasksStatusFilter("open");
    setTasksPriorityFilter("all");
    setTasksAssigneeFilter("all");
    setTasksDateFromFilter(undefined);
    setTasksDateToFilter(undefined);
    setTasksSearchQuery("");
  }, []);

  // Reset assignee filter when switching to "assigned" mode (since it's not applicable)
  useEffect(() => {
    if (tasksOwnershipFilter === "assigned" && tasksAssigneeFilter !== "all") {
      setTasksAssigneeFilter("all");
    }
  }, [tasksOwnershipFilter, tasksAssigneeFilter]);

  const [serviceFilter, setServiceFilter] = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");
  const [serviceOwnerFilter, setServiceOwnerFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [showCompletedRegardless, setShowCompletedRegardless] = useState<boolean>(true);
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<ScheduleStatusFilter>("all");
  const [dynamicDateFilter, setDynamicDateFilter] = useState<DynamicDateFilter>("all");
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>({
    from: undefined,
    to: undefined,
  });
  const [serviceDueDateFilter, setServiceDueDateFilter] = useState("all");
  const [clientHasProjectTypeIds, setClientHasProjectTypeIds] = useState<string[]>([]);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  
  // List view sort settings
  const [listSortBy, setListSortBy] = useState<string>("timeInStage");
  const [listSortOrder, setListSortOrder] = useState<"asc" | "desc">("desc");
  
  // Callback for when TaskList sort changes
  const handleListSortChange = useCallback((sortBy: string, sortOrder: "asc" | "desc") => {
    setListSortBy(sortBy);
    setListSortOrder(sortOrder);
  }, []);

  // Pivot table configuration
  const [pivotConfig, setPivotConfig] = useState<PivotConfig | null>(null);
  
  const handlePivotConfigChange = useCallback((config: PivotConfig) => {
    setPivotConfig(config);
  }, []);

  const [kanbanCompactMode, setKanbanCompactMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COMPACT_MODE_STORAGE_KEY);
      return saved === 'true';
    }
    return false;
  });
  const [kanbanExpandedStages, setKanbanExpandedStages] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem(COMPACT_MODE_STORAGE_KEY, String(kanbanCompactMode));
  }, [kanbanCompactMode]);

  const toggleKanbanCompactMode = useCallback(() => {
    setKanbanCompactMode(prev => {
      const newValue = !prev;
      if (newValue) {
        setKanbanExpandedStages(new Set());
      }
      return newValue;
    });
  }, []);

  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [currentSavedViewId, setCurrentSavedViewId] = useState<string | null>(null);
  const [dashboardWidgets, setDashboardWidgets] = useState<Widget[]>([]);
  const [dashboardEditMode, setDashboardEditMode] = useState(false);
  const [dashboardDescription, setDashboardDescription] = useState("");
  const [dashboardIsHomescreen, setDashboardIsHomescreen] = useState(false);
  const [dashboardVisibility, setDashboardVisibility] = useState<"private" | "shared">("private");

  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings | undefined>(undefined);

  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [deleteViewDialogOpen, setDeleteViewDialogOpen] = useState(false);
  const [viewToDelete, setViewToDelete] = useState<ProjectView | null>(null);
  const [deleteDashboardDialogOpen, setDeleteDashboardDialogOpen] = useState(false);
  const [dashboardToDelete, setDashboardToDelete] = useState<Dashboard | null>(null);

  useEffect(() => {
    if (serviceFilter === "all" && viewMode === "kanban") {
      setCurrentSavedViewId(null);
      setViewMode("list");
    }
  }, [serviceFilter, viewMode]);

  const isAdmin = user?.isAdmin ?? false;
  const canSeeAdminMenu = user?.canSeeAdminMenu ?? false;
  const isManagerOrAdmin = Boolean(isAdmin || canSeeAdminMenu);

  const projectsData = useProjectsData({
    userId: user?.id,
    isAuthenticated,
    isAdmin,
    canSeeAdminMenu,
    viewMode,
    showArchived,
    showCompletedRegardless,
    serviceDueDateFilter,
  });

  const tasksPrefetchConfigs = useMemo(
    () => getTasksPrefetchConfigs(user?.id),
    [user?.id]
  );

  useBackgroundPrefetch({
    enabled: !projectsData.projectsLoading && isAuthenticated && !!user?.id,
    prefetches: tasksPrefetchConfigs,
    delay: 500,
  });

  const filters: ProjectFilters = useMemo(() => ({
    serviceFilter,
    taskAssigneeFilter,
    serviceOwnerFilter,
    userFilter,
    showArchived,
    showCompletedRegardless,
    dynamicDateFilter,
    customDateRange,
    serviceDueDateFilter,
    scheduleStatusFilter,
    clientHasProjectTypeIds,
  }), [
    serviceFilter,
    taskAssigneeFilter,
    serviceOwnerFilter,
    userFilter,
    showArchived,
    showCompletedRegardless,
    dynamicDateFilter,
    customDateRange,
    serviceDueDateFilter,
    scheduleStatusFilter,
    clientHasProjectTypeIds,
  ]);

  const filtering = useProjectFiltering({
    projects: projectsData.projects,
    filters,
    stagesMap: projectsData.allStagesMap,
    stagesLoading: projectsData.stagesLoading,
    stagesError: projectsData.stagesError,
    viewMode,
    isManagerOrAdmin,
    itemsPerPage,
  });

  useProjectsUrlSync({
    location,
    filters,
    setFilters: {
      setTaskAssigneeFilter,
      setServiceOwnerFilter,
      setDynamicDateFilter,
      setScheduleStatusFilter,
    },
  });

  const mutations = useProjectsMutations({
    onSaveViewSuccess: (savedView) => {
      setCurrentSavedViewId(savedView.id);
      setSaveViewDialogOpen(false);
      setNewViewName("");
    },
    onUpdateViewSuccess: () => {},
    onSaveDashboardSuccess: (savedDashboard) => {
      setCurrentDashboard(savedDashboard);
      setDashboardWidgets(savedDashboard.widgets || []);
    },
    onDeleteViewSuccess: () => {
      setDeleteViewDialogOpen(false);
      setViewToDelete(null);
      if (viewToDelete && currentSavedViewId === viewToDelete.id) {
        setCurrentSavedViewId(null);
      }
    },
    onDeleteDashboardSuccess: (dashboardId) => {
      setDeleteDashboardDialogOpen(false);
      setDashboardToDelete(null);
      if (currentDashboard && currentDashboard.id === dashboardId) {
        setCurrentDashboard(null);
        setDashboardWidgets([]);
        setViewMode("list");
      }
    },
    currentDashboardId: currentDashboard?.id,
  });

  const dashboardManagement = useDashboardManagement({
    saveDashboardMutation: mutations.saveDashboardMutation,
    currentDashboard,
  });

  const stateSetters = useMemo(() => ({
    setViewMode,
    setServiceFilter,
    setTaskAssigneeFilter,
    setServiceOwnerFilter,
    setUserFilter,
    setShowArchived,
    setScheduleStatusFilter,
    setShowCompletedRegardless,
    setDynamicDateFilter,
    setCustomDateRange,
    setServiceDueDateFilter,
    setClientHasProjectTypeIds,
    setCalendarSettings,
    setCurrentSavedViewId,
    setCurrentDashboard,
    setDashboardWidgets,
    setDashboardEditMode,
    setDashboardDescription,
    setDashboardIsHomescreen,
    setDashboardVisibility,
    setDashboardServiceFilter: dashboardManagement.setDashboardServiceFilter,
    setDashboardTaskAssigneeFilter: dashboardManagement.setDashboardTaskAssigneeFilter,
    setDashboardServiceOwnerFilter: dashboardManagement.setDashboardServiceOwnerFilter,
    setDashboardUserFilter: dashboardManagement.setDashboardUserFilter,
    setDashboardShowArchived: dashboardManagement.setDashboardShowArchived,
    setDashboardDynamicDateFilter: dashboardManagement.setDashboardDynamicDateFilter,
    setDashboardCustomDateRange: dashboardManagement.setDashboardCustomDateRange,
    setDashboardServiceDueDateFilter: dashboardManagement.setDashboardServiceDueDateFilter,
    setDashboardClientFilter: dashboardManagement.setDashboardClientFilter,
    setDashboardProjectTypeFilter: dashboardManagement.setDashboardProjectTypeFilter,
    // List view settings
    setListSortBy,
    setListSortOrder,
    setItemsPerPage,
    setCurrentPage: filtering.setCurrentPage,
    // Pivot settings
    setPivotConfig,
  }), [dashboardManagement, filtering.setCurrentPage, setPivotConfig]);

  const viewManagement = useViewManagement(
    {
      userProjectPreferences: projectsData.userProjectPreferences,
      savedViews: projectsData.savedViews,
      dashboards: projectsData.dashboards,
      preferencesLoading: projectsData.preferencesLoading,
      savedViewsLoading: projectsData.savedViewsLoading,
      dashboardsLoading: projectsData.dashboardsLoading,
      isAuthenticated,
      user,
      allServices: projectsData.allServices,
      saveLastViewedMutation: mutations.saveLastViewedMutation,
    },
    stateSetters
  );

  useEffect(() => {
    const { dashboardServiceFilter, setDashboardServiceFilter } = dashboardManagement;
    if (projectsData.allServices.length > 0 && dashboardServiceFilter && dashboardServiceFilter !== "all") {
      if (!dashboardServiceFilter.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const matchingService = projectsData.allServices.find(s => s.name === dashboardServiceFilter);
        if (matchingService) {
          setDashboardServiceFilter(matchingService.id);
        } else {
          console.warn(`Service "${dashboardServiceFilter}" not found in available services, resetting to "all"`);
          setDashboardServiceFilter("all");
        }
      }
    }
  }, [projectsData.allServices, dashboardManagement]);

  const handleSaveView = useCallback(() => {
    if (!newViewName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a view name",
        variant: "destructive",
      });
      return;
    }

    let columnPreferences = undefined;
    if (viewMode === "list") {
      const cachedPrefs = queryClient.getQueryData<{
        columnOrder?: string[];
        visibleColumns?: string[];
        columnWidths?: Record<string, number>;
      }>(["/api/column-preferences", { viewType: "projects-list" }]);
      if (cachedPrefs) {
        columnPreferences = {
          columnOrder: cachedPrefs.columnOrder,
          visibleColumns: cachedPrefs.visibleColumns,
          columnWidths: cachedPrefs.columnWidths,
        };
      }
    }

    const filtersToSave = {
      serviceFilter,
      taskAssigneeFilter,
      serviceOwnerFilter,
      userFilter,
      showArchived,
      dynamicDateFilter,
      customDateRange: {
        from: customDateRange.from ? customDateRange.from.toISOString() : undefined,
        to: customDateRange.to ? customDateRange.to.toISOString() : undefined,
      },
      serviceDueDateFilter,
      scheduleStatusFilter,
      clientHasProjectTypeIds,
      calendarSettings: viewMode === "calendar" ? calendarSettings : undefined,
      // List view settings
      listViewSettings: viewMode === "list" ? {
        sortBy: listSortBy,
        sortOrder: listSortOrder,
        itemsPerPage,
        columnPreferences,
      } : undefined,
    };

    mutations.saveViewMutation.mutate({
      name: newViewName,
      filters: JSON.stringify(filtersToSave),
      viewMode: viewMode === "dashboard" ? "list" : (viewMode === "pivot" ? "pivot" : viewMode),
      calendarSettings: viewMode === "calendar" ? calendarSettings : undefined,
      pivotConfig: viewMode === "pivot" && pivotConfig ? JSON.stringify(pivotConfig) : undefined,
    });
  }, [
    newViewName,
    serviceFilter,
    taskAssigneeFilter,
    serviceOwnerFilter,
    userFilter,
    showArchived,
    dynamicDateFilter,
    customDateRange,
    serviceDueDateFilter,
    scheduleStatusFilter,
    clientHasProjectTypeIds,
    viewMode,
    calendarSettings,
    listSortBy,
    listSortOrder,
    itemsPerPage,
    pivotConfig,
    mutations.saveViewMutation,
    toast,
  ]);

  const handleUpdateCurrentView = useCallback(() => {
    if (!currentSavedViewId) return;
    
    const currentView = projectsData.savedViews.find(v => v.id === currentSavedViewId);
    if (!currentView) return;

    let columnPreferences = undefined;
    if (viewMode === "list") {
      const cachedPrefs = queryClient.getQueryData<{
        columnOrder?: string[];
        visibleColumns?: string[];
        columnWidths?: Record<string, number>;
      }>(["/api/column-preferences", { viewType: "projects-list" }]);
      if (cachedPrefs) {
        columnPreferences = {
          columnOrder: cachedPrefs.columnOrder,
          visibleColumns: cachedPrefs.visibleColumns,
          columnWidths: cachedPrefs.columnWidths,
        };
      }
    }

    const filtersToSave = {
      serviceFilter,
      taskAssigneeFilter,
      serviceOwnerFilter,
      userFilter,
      showArchived,
      dynamicDateFilter,
      customDateRange: {
        from: customDateRange.from ? customDateRange.from.toISOString() : undefined,
        to: customDateRange.to ? customDateRange.to.toISOString() : undefined,
      },
      serviceDueDateFilter,
      scheduleStatusFilter,
      clientHasProjectTypeIds,
      calendarSettings: viewMode === "calendar" ? calendarSettings : undefined,
      // List view settings
      listViewSettings: viewMode === "list" ? {
        sortBy: listSortBy,
        sortOrder: listSortOrder,
        itemsPerPage,
        columnPreferences,
      } : undefined,
    };

    mutations.updateViewMutation.mutate({
      id: currentSavedViewId,
      filters: JSON.stringify(filtersToSave),
      viewMode: viewMode === "dashboard" ? "list" : (viewMode === "pivot" ? "pivot" : viewMode),
      pivotConfig: viewMode === "pivot" && pivotConfig ? JSON.stringify(pivotConfig) : undefined,
    });
  }, [
    currentSavedViewId,
    projectsData.savedViews,
    serviceFilter,
    taskAssigneeFilter,
    serviceOwnerFilter,
    userFilter,
    showArchived,
    dynamicDateFilter,
    customDateRange,
    serviceDueDateFilter,
    scheduleStatusFilter,
    clientHasProjectTypeIds,
    viewMode,
    calendarSettings,
    listSortBy,
    listSortOrder,
    itemsPerPage,
    pivotConfig,
    mutations.updateViewMutation,
  ]);

  const handleSaveDashboardAsNew = useCallback(() => {
    if (!currentDashboard) return;

    const {
      dashboardServiceFilter,
      dashboardTaskAssigneeFilter,
      dashboardServiceOwnerFilter,
      dashboardUserFilter,
      dashboardShowArchived,
      dashboardDynamicDateFilter,
      dashboardCustomDateRange,
      dashboardServiceDueDateFilter,
      dashboardClientFilter,
      dashboardProjectTypeFilter,
    } = dashboardManagement;

    const filtersToSave = {
      serviceFilter: dashboardServiceFilter,
      taskAssigneeFilter: dashboardTaskAssigneeFilter,
      serviceOwnerFilter: dashboardServiceOwnerFilter,
      userFilter: dashboardUserFilter,
      showArchived: dashboardShowArchived,
      dynamicDateFilter: dashboardDynamicDateFilter,
      customDateRange: {
        from: dashboardCustomDateRange.from ? dashboardCustomDateRange.from.toISOString() : undefined,
        to: dashboardCustomDateRange.to ? dashboardCustomDateRange.to.toISOString() : undefined,
      },
      serviceDueDateFilter: dashboardServiceDueDateFilter,
      clientFilter: dashboardClientFilter,
      projectTypeFilter: dashboardProjectTypeFilter,
    };

    mutations.saveDashboardMutation.mutate({
      name: currentDashboard.name,
      description: dashboardDescription.trim() || undefined,
      filters: JSON.stringify(filtersToSave),
      widgets: dashboardWidgets,
      visibility: dashboardVisibility,
      isHomescreenDashboard: dashboardIsHomescreen,
      currentDashboardId: currentDashboard.id,
    });
  }, [
    currentDashboard,
    dashboardManagement,
    dashboardDescription,
    dashboardWidgets,
    dashboardVisibility,
    dashboardIsHomescreen,
    mutations.saveDashboardMutation,
  ]);

  const handleDeleteView = useCallback((view: ProjectView) => {
    setViewToDelete(view);
    setDeleteViewDialogOpen(true);
  }, []);

  const handleConfirmDeleteView = useCallback(() => {
    if (!viewToDelete) return;
    mutations.deleteViewMutation.mutate(viewToDelete.id);
  }, [viewToDelete, mutations.deleteViewMutation]);

  const handleDeleteDashboard = useCallback((dashboard: Dashboard) => {
    setDashboardToDelete(dashboard);
    setDeleteDashboardDialogOpen(true);
  }, []);

  const handleConfirmDeleteDashboard = useCallback(() => {
    if (!dashboardToDelete) return;
    mutations.deleteDashboardMutation.mutate(dashboardToDelete.id);
  }, [dashboardToDelete, mutations.deleteDashboardMutation]);

  const activeFilterCount = useCallback(() => filtering.activeFilterCount, [filtering.activeFilterCount]);

  const currentSavedViewName = useMemo(() => {
    if (!currentSavedViewId) return null;
    const view = projectsData.savedViews?.find(v => v.id === currentSavedViewId);
    return view?.name || null;
  }, [currentSavedViewId, projectsData.savedViews]);

  return {
    user,
    authLoading,
    isAuthenticated,
    isMobile,
    location,
    setLocation,
    isManagerOrAdmin,

    workspaceMode,
    setWorkspaceMode,
    viewMode,
    setViewMode,
    mobileSearchOpen,
    setMobileSearchOpen,

    tasksOwnershipFilter,
    setTasksOwnershipFilter,
    tasksStatusFilter,
    setTasksStatusFilter,
    tasksPriorityFilter,
    setTasksPriorityFilter,
    tasksAssigneeFilter,
    setTasksAssigneeFilter,
    tasksDateFromFilter,
    setTasksDateFromFilter,
    tasksDateToFilter,
    setTasksDateToFilter,
    tasksSearchQuery,
    setTasksSearchQuery,
    tasksReassignMode,
    setTasksReassignMode,
    tasksActiveFilterCount,
    clearTasksFilters,

    serviceFilter,
    setServiceFilter,
    taskAssigneeFilter,
    setTaskAssigneeFilter,
    serviceOwnerFilter,
    setServiceOwnerFilter,
    userFilter,
    setUserFilter,
    showArchived,
    setShowArchived,
    showCompletedRegardless,
    setShowCompletedRegardless,
    scheduleStatusFilter,
    setScheduleStatusFilter,
    dynamicDateFilter,
    setDynamicDateFilter,
    customDateRange,
    setCustomDateRange,
    serviceDueDateFilter,
    setServiceDueDateFilter,
    clientHasProjectTypeIds,
    setClientHasProjectTypeIds,
    filters,

    filterPanelOpen,
    setFilterPanelOpen,
    itemsPerPage,
    setItemsPerPage,
    
    // List view sort settings
    listSortBy,
    setListSortBy,
    listSortOrder,
    setListSortOrder,
    handleListSortChange,

    // Pivot table settings
    pivotConfig,
    onPivotConfigChange: handlePivotConfigChange,

    kanbanCompactMode,
    kanbanExpandedStages,
    setKanbanExpandedStages,
    toggleKanbanCompactMode,

    currentDashboard,
    setCurrentDashboard,
    currentSavedViewId,
    setCurrentSavedViewId,
    currentSavedViewName,
    dashboardWidgets,
    setDashboardWidgets,
    dashboardEditMode,
    setDashboardEditMode,
    dashboardDescription,
    setDashboardDescription,
    dashboardIsHomescreen,
    setDashboardIsHomescreen,
    dashboardVisibility,
    setDashboardVisibility,

    calendarSettings,
    setCalendarSettings,

    saveViewDialogOpen,
    setSaveViewDialogOpen,
    newViewName,
    setNewViewName,
    deleteViewDialogOpen,
    setDeleteViewDialogOpen,
    viewToDelete,
    setViewToDelete,
    deleteDashboardDialogOpen,
    setDeleteDashboardDialogOpen,
    dashboardToDelete,
    setDashboardToDelete,

    ...projectsData,
    ...filtering,
    ...viewManagement,
    ...dashboardManagement,
    ...mutations,

    handleSaveView,
    handleUpdateCurrentView,
    handleSaveDashboardAsNew,
    handleDeleteView,
    handleConfirmDeleteView,
    handleDeleteDashboard,
    handleConfirmDeleteDashboard,
    activeFilterCount,
  };
}
