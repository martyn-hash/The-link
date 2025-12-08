import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { 
  ViewMode, 
  Dashboard, 
  ProjectView, 
  UserProjectPreferences,
  CalendarSettings,
  ProjectFilters,
  DynamicDateFilter,
  ScheduleStatusFilter,
  ServiceOption
} from "@/types/projects-page";

interface UseViewManagementParams {
  userProjectPreferences: UserProjectPreferences | undefined;
  savedViews: ProjectView[];
  dashboards: Dashboard[];
  preferencesLoading: boolean;
  savedViewsLoading: boolean;
  dashboardsLoading: boolean;
  isAuthenticated: boolean;
  user: any;
  allServices: ServiceOption[];
  saveLastViewedMutation: any;
}

interface ViewManagementState {
  setViewMode: (mode: ViewMode) => void;
  setServiceFilter: (value: string) => void;
  setTaskAssigneeFilter: (value: string) => void;
  setServiceOwnerFilter: (value: string) => void;
  setUserFilter: (value: string) => void;
  setShowArchived: (value: boolean) => void;
  setScheduleStatusFilter: (value: ScheduleStatusFilter) => void;
  setShowCompletedRegardless: (value: boolean) => void;
  setDynamicDateFilter: (value: DynamicDateFilter) => void;
  setCustomDateRange: (value: { from: Date | undefined; to: Date | undefined }) => void;
  setServiceDueDateFilter: (value: string) => void;
  setClientHasProjectTypeIds: (value: string[]) => void;
  setCalendarSettings: (settings: CalendarSettings | undefined) => void;
  setCurrentSavedViewId: (id: string | null) => void;
  setCurrentDashboard: (dashboard: Dashboard | null) => void;
  setDashboardWidgets: (widgets: any[]) => void;
  setDashboardEditMode: (mode: boolean) => void;
  setDashboardDescription: (value: string) => void;
  setDashboardIsHomescreen: (value: boolean) => void;
  setDashboardVisibility: (value: "private" | "shared") => void;
  setDashboardServiceFilter: (value: string) => void;
  setDashboardTaskAssigneeFilter: (value: string) => void;
  setDashboardServiceOwnerFilter: (value: string) => void;
  setDashboardUserFilter: (value: string) => void;
  setDashboardShowArchived: (value: boolean) => void;
  setDashboardDynamicDateFilter: (value: DynamicDateFilter) => void;
  setDashboardCustomDateRange: (value: { from: Date | undefined; to: Date | undefined }) => void;
  setDashboardServiceDueDateFilter: (value: string) => void;
  setDashboardClientFilter: (value: string) => void;
  setDashboardProjectTypeFilter: (value: string) => void;
  // List view settings
  setListSortBy: (value: string) => void;
  setListSortOrder: (value: "asc" | "desc") => void;
  setItemsPerPage: (value: number) => void;
  setCurrentPage: (value: number | ((prev: number) => number)) => void;
}

export function useViewManagement(
  params: UseViewManagementParams,
  stateSetters: ViewManagementState
) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [defaultViewApplied, setDefaultViewApplied] = useState(false);

  const {
    userProjectPreferences,
    savedViews,
    dashboards,
    preferencesLoading,
    savedViewsLoading,
    dashboardsLoading,
    isAuthenticated,
    user,
    allServices,
    saveLastViewedMutation,
  } = params;

  const handleLoadSavedView = useCallback(async (view: ProjectView) => {
    try {
      const filters = typeof view.filters === 'string' ? JSON.parse(view.filters) : view.filters;
      
      let targetScheduleFilter = filters.scheduleStatusFilter || (filters.behindScheduleOnly ? "behind" : "all");
      const needsStageData = targetScheduleFilter === "behind" || targetScheduleFilter === "both";
      
      if (needsStageData) {
        try {
          await queryClient.ensureQueryData({
            queryKey: ["/api/config/stages"],
            staleTime: 5 * 60 * 1000,
          });
        } catch (error) {
          console.warn("Failed to prefetch stages for schedule filter, falling back to 'all'");
          targetScheduleFilter = "all";
          toast({
            title: "Filter Unavailable",
            description: "Could not load stage data for behind schedule filtering. Showing all projects instead.",
            variant: "destructive",
          });
        }
      }
      
      stateSetters.setCurrentSavedViewId(view.id);
      stateSetters.setServiceFilter(filters.serviceFilter || "all");
      stateSetters.setTaskAssigneeFilter(filters.taskAssigneeFilter || "all");
      stateSetters.setServiceOwnerFilter(filters.serviceOwnerFilter || "all");
      stateSetters.setUserFilter(filters.userFilter || "all");
      stateSetters.setShowArchived(filters.showArchived || false);
      stateSetters.setScheduleStatusFilter(targetScheduleFilter);
      stateSetters.setShowCompletedRegardless(filters.showCompletedRegardless ?? true);
      stateSetters.setDynamicDateFilter(filters.dynamicDateFilter || "all");
      stateSetters.setCustomDateRange({
        from: filters.customDateRange?.from ? new Date(filters.customDateRange.from) : undefined,
        to: filters.customDateRange?.to ? new Date(filters.customDateRange.to) : undefined,
      });
      stateSetters.setServiceDueDateFilter(filters.serviceDueDateFilter || "all");
      stateSetters.setClientHasProjectTypeIds(filters.clientHasProjectTypeIds || []);
      
      if (view.viewMode === "kanban") {
        stateSetters.setViewMode("kanban");
        stateSetters.setCalendarSettings(undefined);
      } else if (view.viewMode === "list") {
        stateSetters.setViewMode("list");
        stateSetters.setCalendarSettings(undefined);
        // Always reset to first page when loading a list view to avoid stale pagination
        stateSetters.setCurrentPage(1);
        // Restore list view settings (sorting and pagination)
        if (filters.listViewSettings) {
          if (filters.listViewSettings.sortBy) {
            stateSetters.setListSortBy(filters.listViewSettings.sortBy);
          }
          if (filters.listViewSettings.sortOrder) {
            stateSetters.setListSortOrder(filters.listViewSettings.sortOrder);
          }
          if (filters.listViewSettings.itemsPerPage) {
            stateSetters.setItemsPerPage(filters.listViewSettings.itemsPerPage);
          }
          // Restore column preferences if saved with the view
          if (filters.listViewSettings.columnPreferences) {
            const { columnOrder, visibleColumns, columnWidths } = filters.listViewSettings.columnPreferences;
            if (visibleColumns && visibleColumns.length > 0) {
              try {
                await apiRequest("POST", "/api/column-preferences", {
                  viewType: "projects-list",
                  columnOrder: columnOrder || [],
                  visibleColumns: visibleColumns,
                  columnWidths: columnWidths || {},
                });
                // Invalidate the query to force TaskList to refetch
                queryClient.invalidateQueries({ queryKey: ["/api/column-preferences", { viewType: "projects-list" }] });
              } catch (error) {
                console.warn("Failed to restore column preferences from saved view:", error);
              }
            }
          }
        }
      } else if (view.viewMode === "calendar") {
        stateSetters.setViewMode("calendar");
        if (filters.calendarSettings) {
          stateSetters.setCalendarSettings({
            calendarViewType: filters.calendarSettings.calendarViewType || "month",
            showProjectDueDates: filters.calendarSettings.showProjectDueDates ?? true,
            showProjectTargetDates: filters.calendarSettings.showProjectTargetDates ?? true,
            showStageDeadlines: filters.calendarSettings.showStageDeadlines ?? false,
            showTaskDueDates: filters.calendarSettings.showTaskDueDates ?? true,
          });
        } else {
          stateSetters.setCalendarSettings(undefined);
        }
      }
      
      saveLastViewedMutation.mutate({
        defaultViewType: view.viewMode,
        defaultViewId: view.id,
      });
      
      toast({
        title: "View Loaded",
        description: `Applied filters from "${view.name}"`,
      });
    } catch (error) {
      showFriendlyError({ error });
    }
  }, [toast, saveLastViewedMutation, stateSetters]);

  const handleLoadDashboard = useCallback((dashboard: Dashboard) => {
    try {
      stateSetters.setCurrentDashboard(dashboard);
      stateSetters.setDashboardWidgets(dashboard.widgets || []);
      stateSetters.setDashboardEditMode(false);
      stateSetters.setCurrentSavedViewId(null);
      stateSetters.setViewMode("dashboard");
      stateSetters.setDashboardDescription(dashboard.description || "");
      stateSetters.setDashboardIsHomescreen(dashboard.isHomescreenDashboard || false);
      stateSetters.setDashboardVisibility(dashboard.visibility || "private");
      
      if (dashboard.filters) {
        const parsedFilters = typeof dashboard.filters === 'string' 
          ? JSON.parse(dashboard.filters) 
          : dashboard.filters;
        
        let serviceFilterValue = parsedFilters.serviceFilter || "all";
        
        if (allServices.length > 0 && serviceFilterValue !== "all" && !serviceFilterValue.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          const matchingService = allServices.find(s => s.name === serviceFilterValue);
          if (matchingService) {
            serviceFilterValue = matchingService.id;
          } else {
            console.warn(`Service "${serviceFilterValue}" not found in available services, resetting to "all"`);
            serviceFilterValue = "all";
          }
        }
        
        stateSetters.setDashboardServiceFilter(serviceFilterValue);
        stateSetters.setDashboardTaskAssigneeFilter(parsedFilters.taskAssigneeFilter || "all");
        stateSetters.setDashboardServiceOwnerFilter(parsedFilters.serviceOwnerFilter || "all");
        stateSetters.setDashboardUserFilter(parsedFilters.userFilter || "all");
        stateSetters.setDashboardShowArchived(parsedFilters.showArchived || false);
        stateSetters.setDashboardDynamicDateFilter(parsedFilters.dynamicDateFilter || "all");
        stateSetters.setDashboardCustomDateRange({
          from: parsedFilters.customDateRange?.from ? new Date(parsedFilters.customDateRange.from) : undefined,
          to: parsedFilters.customDateRange?.to ? new Date(parsedFilters.customDateRange.to) : undefined,
        });
        stateSetters.setDashboardServiceDueDateFilter(parsedFilters.serviceDueDateFilter || "all");
        stateSetters.setDashboardClientFilter(parsedFilters.clientFilter || "all");
        stateSetters.setDashboardProjectTypeFilter(parsedFilters.projectTypeFilter || "all");
      }
      
      saveLastViewedMutation.mutate({
        defaultViewType: 'dashboard',
        defaultViewId: dashboard.id,
      });
      
      toast({
        title: "Dashboard Loaded",
        description: `Loaded dashboard "${dashboard.name}"`,
      });
    } catch (error) {
      showFriendlyError({ error });
    }
  }, [toast, saveLastViewedMutation, allServices, stateSetters]);

  const handleCalendarEventClick = useCallback((event: any) => {
    if (event.entityType === "project") {
      setLocation(`/projects/${event.entityId}`);
    } else if (event.entityType === "task") {
      setLocation(`/tasks/${event.entityId}`);
    }
  }, [setLocation]);

  const handleViewAllProjects = useCallback(() => {
    stateSetters.setServiceFilter("all");
    stateSetters.setTaskAssigneeFilter("all");
    stateSetters.setServiceOwnerFilter("all");
    stateSetters.setUserFilter("all");
    stateSetters.setShowArchived(true);
    stateSetters.setDynamicDateFilter("all");
    stateSetters.setCustomDateRange({ from: undefined, to: undefined });
    stateSetters.setScheduleStatusFilter("all");
    stateSetters.setServiceDueDateFilter("all");
    stateSetters.setClientHasProjectTypeIds([]);
    stateSetters.setCurrentSavedViewId(null);
    stateSetters.setViewMode("list");
    
    setLocation('/?view=all');
    
    toast({
      title: "Filters Reset",
      description: "Showing all projects (including archived)",
    });
  }, [toast, setLocation, stateSetters]);

  const handleManualViewModeChange = useCallback((mode: ViewMode) => {
    stateSetters.setCurrentSavedViewId(null);
    stateSetters.setViewMode(mode);
  }, [stateSetters]);

  useEffect(() => {
    if (defaultViewApplied) return;
    if (!isAuthenticated || !user) return;
    if (preferencesLoading || savedViewsLoading || dashboardsLoading) return;
    
    if (!userProjectPreferences) {
      setDefaultViewApplied(true);
      return;
    }
    
    const searchParams = new URLSearchParams(window.location.search);
    const hasUrlFilters = searchParams.toString().length > 0;
    if (hasUrlFilters) {
      setDefaultViewApplied(true);
      return;
    }

    const { defaultViewType, defaultViewId } = userProjectPreferences;
    
    if (!defaultViewType) {
      setDefaultViewApplied(true);
      return;
    }

    if (defaultViewType === 'list' && !defaultViewId) {
      stateSetters.setViewMode('list');
      setDefaultViewApplied(true);
      return;
    }
    
    if (defaultViewType === 'kanban' && !defaultViewId) {
      stateSetters.setViewMode('list');
      setDefaultViewApplied(true);
      return;
    }
    
    if (defaultViewType === 'calendar' && !defaultViewId) {
      stateSetters.setViewMode('calendar');
      setDefaultViewApplied(true);
      return;
    }

    if (defaultViewId) {
      if (defaultViewType === 'dashboard') {
        if (dashboardsLoading) return;
        
        const dashboard = dashboards.find(d => d.id === defaultViewId);
        if (dashboard) {
          handleLoadDashboard(dashboard);
        }
      } else {
        if (savedViewsLoading) return;
        
        const savedView = savedViews.find(v => v.id === defaultViewId);
        if (savedView) {
          handleLoadSavedView(savedView);
        }
      }
    }
    
    setDefaultViewApplied(true);
  }, [
    userProjectPreferences, 
    savedViews, 
    dashboards, 
    preferencesLoading, 
    savedViewsLoading, 
    dashboardsLoading, 
    isAuthenticated, 
    user, 
    defaultViewApplied,
    handleLoadDashboard,
    handleLoadSavedView,
    stateSetters
  ]);

  return {
    handleLoadSavedView,
    handleLoadDashboard,
    handleCalendarEventClick,
    handleViewAllProjects,
    handleManualViewModeChange,
    defaultViewApplied,
  };
}
