import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { Widget, Dashboard, CalendarSettings } from "@/types/projects-page";

interface SaveViewData {
  name: string;
  filters: string;
  viewMode: "list" | "kanban" | "calendar" | "pivot";
  calendarSettings?: CalendarSettings;
  pivotConfig?: string;
}

interface UpdateViewData {
  id: string;
  filters: string;
  viewMode: "list" | "kanban" | "calendar" | "pivot";
  pivotConfig?: string;
}

interface SaveDashboardData {
  name: string;
  description?: string;
  filters: string;
  widgets: Widget[];
  visibility: "private" | "shared";
  isHomescreenDashboard?: boolean;
  isCreating?: boolean;
}

interface SaveLastViewedData {
  defaultViewType: string;
  defaultViewId?: string | null;
}

interface UseProjectsMutationsCallbacks {
  onSaveViewSuccess?: (savedView: any) => void;
  onUpdateViewSuccess?: (updatedView: any) => void;
  onSaveDashboardSuccess?: (savedDashboard: Dashboard) => void;
  onDeleteViewSuccess?: () => void;
  onDeleteDashboardSuccess?: (dashboardId: string) => void;
  currentDashboardId?: string | null;
}

export function useProjectsMutations(callbacks: UseProjectsMutationsCallbacks = {}) {
  const { toast } = useToast();

  const saveViewMutation = useMutation({
    mutationFn: async (data: SaveViewData) => {
      return apiRequest("POST", "/api/project-views", data);
    },
    onSuccess: (savedView: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-views"] });
      callbacks.onSaveViewSuccess?.(savedView);
      toast({
        title: "View saved successfully",
        description: `"${savedView.name}" has been saved`,
      });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const updateViewMutation = useMutation({
    mutationFn: async (data: UpdateViewData) => {
      return apiRequest("PATCH", `/api/project-views/${data.id}`, data);
    },
    onSuccess: (updatedView: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-views"] });
      callbacks.onUpdateViewSuccess?.(updatedView);
      toast({
        title: "View updated",
        description: `"${updatedView.name}" has been updated with current filters`,
      });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const saveDashboardMutation = useMutation({
    mutationFn: async (data: SaveDashboardData & { currentDashboardId?: string }) => {
      const { currentDashboardId, ...payload } = data;
      if (data.isCreating || !currentDashboardId) {
        return apiRequest("POST", "/api/dashboards", payload);
      } else {
        return apiRequest("PATCH", `/api/dashboards/${currentDashboardId}`, payload);
      }
    },
    onSuccess: (savedDashboard: Dashboard) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      callbacks.onSaveDashboardSuccess?.(savedDashboard);
      toast({
        title: "Success",
        description: "Dashboard saved successfully",
      });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      return apiRequest("DELETE", `/api/project-views/${viewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-views"] });
      callbacks.onDeleteViewSuccess?.();
      toast({
        title: "Success",
        description: "View deleted successfully",
      });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const deleteDashboardMutation = useMutation({
    mutationFn: async (dashboardId: string) => {
      return apiRequest("DELETE", `/api/dashboards/${dashboardId}`);
    },
    onSuccess: (_, dashboardId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      callbacks.onDeleteDashboardSuccess?.(dashboardId);
      toast({
        title: "Success",
        description: "Dashboard deleted successfully",
      });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const saveLastViewedMutation = useMutation({
    mutationFn: async (data: SaveLastViewedData) => {
      return apiRequest("POST", "/api/user-project-preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-project-preferences"] });
    },
    onError: (error) => {
      console.error("Failed to save last viewed preference:", error);
    },
  });

  return {
    saveViewMutation,
    updateViewMutation,
    saveDashboardMutation,
    deleteViewMutation,
    deleteDashboardMutation,
    saveLastViewedMutation,
    isSavingView: saveViewMutation.isPending,
    isUpdatingView: updateViewMutation.isPending,
    isSavingDashboard: saveDashboardMutation.isPending,
    isDeletingView: deleteViewMutation.isPending,
    isDeletingDashboard: deleteDashboardMutation.isPending,
  };
}
