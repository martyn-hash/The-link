import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { Widget, Dashboard, DynamicDateFilter } from "@/types/projects-page";

interface UseDashboardManagementParams {
  saveDashboardMutation: any;
  currentDashboard: Dashboard | null;
}

export function useDashboardManagement({
  saveDashboardMutation,
  currentDashboard,
}: UseDashboardManagementParams) {
  const { toast } = useToast();

  const [createDashboardModalOpen, setCreateDashboardModalOpen] = useState(false);
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);

  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardDescription, setNewDashboardDescription] = useState("");
  const [newDashboardIsHomescreen, setNewDashboardIsHomescreen] = useState(false);
  const [newDashboardVisibility, setNewDashboardVisibility] = useState<"private" | "shared">("private");
  const [newDashboardWidgets, setNewDashboardWidgets] = useState<Widget[]>([]);

  const [newWidgetDialogOpen, setNewWidgetDialogOpen] = useState(false);
  const [newWidgetType, setNewWidgetType] = useState<"bar" | "pie" | "number" | "line">("bar");
  const [newWidgetTitle, setNewWidgetTitle] = useState("");
  const [newWidgetGroupBy, setNewWidgetGroupBy] = useState<"projectType" | "status" | "assignee" | "serviceOwner" | "daysOverdue">("projectType");

  const [dashboardServiceFilter, setDashboardServiceFilter] = useState("all");
  const [dashboardTaskAssigneeFilter, setDashboardTaskAssigneeFilter] = useState("all");
  const [dashboardServiceOwnerFilter, setDashboardServiceOwnerFilter] = useState("all");
  const [dashboardUserFilter, setDashboardUserFilter] = useState("all");
  const [dashboardShowArchived, setDashboardShowArchived] = useState<boolean>(false);
  const [dashboardShowCompletedRegardless, setDashboardShowCompletedRegardless] = useState<boolean>(true);
  const [dashboardDynamicDateFilter, setDashboardDynamicDateFilter] = useState<DynamicDateFilter>("all");
  const [dashboardCustomDateRange, setDashboardCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [dashboardServiceDueDateFilter, setDashboardServiceDueDateFilter] = useState("all");
  const [dashboardClientFilter, setDashboardClientFilter] = useState("all");
  const [dashboardProjectTypeFilter, setDashboardProjectTypeFilter] = useState("all");

  const handleAddWidgetToNewDashboard = useCallback(() => {
    if (!newWidgetTitle.trim()) {
      showFriendlyError({ error: "Please enter a widget title" });
      return;
    }

    const widget: Widget = {
      id: `widget-${Date.now()}`,
      type: newWidgetType,
      title: newWidgetTitle,
      groupBy: newWidgetGroupBy,
    };

    setNewDashboardWidgets(prev => [...prev, widget]);
    setNewWidgetDialogOpen(false);
    setNewWidgetTitle("");
    setNewWidgetType("bar");
    setNewWidgetGroupBy("projectType");
    
    toast({
      title: "Widget Added",
      description: "Widget added to dashboard",
    });
  }, [newWidgetTitle, newWidgetType, newWidgetGroupBy, toast]);

  const handleRemoveWidgetFromNewDashboard = useCallback((widgetId: string) => {
    setNewDashboardWidgets(prev => prev.filter(w => w.id !== widgetId));
  }, []);

  const handleSaveNewDashboard = useCallback(() => {
    if (!newDashboardName.trim()) {
      showFriendlyError({ error: "Please enter a dashboard name" });
      return;
    }

    if (newDashboardWidgets.length === 0) {
      showFriendlyError({ error: "Please add at least one widget" });
      return;
    }

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

    saveDashboardMutation.mutate({
      name: newDashboardName,
      description: newDashboardDescription.trim() || undefined,
      filters: JSON.stringify(filtersToSave),
      widgets: newDashboardWidgets,
      visibility: newDashboardVisibility,
      isHomescreenDashboard: newDashboardIsHomescreen,
      isCreating: isCreatingDashboard,
      currentDashboardId: currentDashboard?.id,
    });
  }, [
    newDashboardName,
    newDashboardDescription,
    newDashboardWidgets,
    newDashboardVisibility,
    newDashboardIsHomescreen,
    isCreatingDashboard,
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
    saveDashboardMutation,
    currentDashboard,
  ]);

  const resetNewDashboardState = useCallback(() => {
    setNewDashboardName("");
    setNewDashboardDescription("");
    setNewDashboardIsHomescreen(false);
    setNewDashboardVisibility("private");
    setNewDashboardWidgets([]);
    setDashboardServiceFilter("all");
    setDashboardTaskAssigneeFilter("all");
    setDashboardServiceOwnerFilter("all");
    setDashboardUserFilter("all");
    setDashboardShowArchived(false);
    setDashboardDynamicDateFilter("all");
    setDashboardCustomDateRange({ from: undefined, to: undefined });
    setDashboardClientFilter("all");
    setDashboardProjectTypeFilter("all");
  }, []);

  const openCreateDashboardModal = useCallback((editingDashboard?: Dashboard | null) => {
    if (editingDashboard) {
      setIsCreatingDashboard(false);
      setNewDashboardName(editingDashboard.name);
      setNewDashboardDescription(editingDashboard.description || "");
      setNewDashboardIsHomescreen(editingDashboard.isHomescreenDashboard || false);
      setNewDashboardVisibility(editingDashboard.visibility || "private");
      setNewDashboardWidgets(editingDashboard.widgets || []);
    } else {
      setIsCreatingDashboard(true);
      resetNewDashboardState();
    }
    setCreateDashboardModalOpen(true);
  }, [resetNewDashboardState]);

  return {
    createDashboardModalOpen,
    setCreateDashboardModalOpen,
    isCreatingDashboard,
    setIsCreatingDashboard,
    newDashboardName,
    setNewDashboardName,
    newDashboardDescription,
    setNewDashboardDescription,
    newDashboardIsHomescreen,
    setNewDashboardIsHomescreen,
    newDashboardVisibility,
    setNewDashboardVisibility,
    newDashboardWidgets,
    setNewDashboardWidgets,
    newWidgetDialogOpen,
    setNewWidgetDialogOpen,
    newWidgetType,
    setNewWidgetType,
    newWidgetTitle,
    setNewWidgetTitle,
    newWidgetGroupBy,
    setNewWidgetGroupBy,
    dashboardServiceFilter,
    setDashboardServiceFilter,
    dashboardTaskAssigneeFilter,
    setDashboardTaskAssigneeFilter,
    dashboardServiceOwnerFilter,
    setDashboardServiceOwnerFilter,
    dashboardUserFilter,
    setDashboardUserFilter,
    dashboardShowArchived,
    setDashboardShowArchived,
    dashboardShowCompletedRegardless,
    setDashboardShowCompletedRegardless,
    dashboardDynamicDateFilter,
    setDashboardDynamicDateFilter,
    dashboardCustomDateRange,
    setDashboardCustomDateRange,
    dashboardServiceDueDateFilter,
    setDashboardServiceDueDateFilter,
    dashboardClientFilter,
    setDashboardClientFilter,
    dashboardProjectTypeFilter,
    setDashboardProjectTypeFilter,
    handleAddWidgetToNewDashboard,
    handleRemoveWidgetFromNewDashboard,
    handleSaveNewDashboard,
    resetNewDashboardState,
    openCreateDashboardModal,
  };
}
