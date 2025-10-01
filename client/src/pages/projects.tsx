import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type ProjectWithRelations, type User } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import KanbanBoard from "@/components/kanban-board";
import TaskList from "@/components/task-list";
import DashboardBuilder from "@/components/dashboard-builder";
import FilterPanel from "@/components/filter-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Columns3, List, Filter, BarChart3, Plus, Trash2, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ViewMode = "kanban" | "list" | "dashboard";

interface Widget {
  id: string;
  type: "bar" | "pie" | "number" | "line";
  title: string;
  groupBy: "projectType" | "status" | "assignee" | "serviceOwner" | "daysOverdue";
  metric?: string;
}

interface Dashboard {
  id: string;
  userId: string;
  name: string;
  filters: any;
  widgets: Widget[];
  visibility: "private" | "shared";
  createdAt: string;
  updatedAt: string;
}

// Note: Using shared month normalization utility for consistent filtering

export default function Projects() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");
  const [serviceOwnerFilter, setServiceOwnerFilter] = useState("all");

  // Reset to list view when no service is selected for kanban
  useEffect(() => {
    if (serviceFilter === "all" && viewMode === "kanban") {
      setViewMode("list");
    }
  }, [serviceFilter, viewMode]);
  const [userFilter, setUserFilter] = useState("all");
  const [showArchived, setShowArchived] = useState<boolean>(false);
  
  // Date filter state
  const [dynamicDateFilter, setDynamicDateFilter] = useState<"all" | "overdue" | "today" | "next7days" | "next14days" | "next30days" | "custom">("all");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  
  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Dashboard state
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [dashboardWidgets, setDashboardWidgets] = useState<Widget[]>([]);
  const [dashboardEditMode, setDashboardEditMode] = useState(false);
  const [createDashboardModalOpen, setCreateDashboardModalOpen] = useState(false);
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);

  // Create dashboard modal state
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardWidgets, setNewDashboardWidgets] = useState<Widget[]>([]);
  const [newWidgetDialogOpen, setNewWidgetDialogOpen] = useState(false);
  const [newWidgetType, setNewWidgetType] = useState<"bar" | "pie" | "number" | "line">("bar");
  const [newWidgetTitle, setNewWidgetTitle] = useState("");
  const [newWidgetGroupBy, setNewWidgetGroupBy] = useState<"projectType" | "status" | "assignee" | "serviceOwner" | "daysOverdue">("projectType");

  const { data: projects, isLoading: projectsLoading, error } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/projects", { archived: showArchived }],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && Boolean(user?.isAdmin || user?.canSeeAdminMenu),
    retry: false,
  });

  // Fetch saved project views
  const { data: savedViews = [] } = useQuery<any[]>({
    queryKey: ["/api/project-views"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  // Fetch saved dashboards
  const { data: dashboards = [] } = useQuery<Dashboard[]>({
    queryKey: ["/api/dashboards"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  // Handler to load a saved view
  const handleLoadSavedView = (view: any) => {
    try {
      const filters = typeof view.filters === 'string' ? JSON.parse(view.filters) : view.filters;
      
      setServiceFilter(filters.serviceFilter || "all");
      setTaskAssigneeFilter(filters.taskAssigneeFilter || "all");
      setServiceOwnerFilter(filters.serviceOwnerFilter || "all");
      setUserFilter(filters.userFilter || "all");
      setShowArchived(filters.showArchived || false);
      setDynamicDateFilter(filters.dynamicDateFilter || "all");
      setCustomDateRange({
        from: filters.customDateRange?.from ? new Date(filters.customDateRange.from) : undefined,
        to: filters.customDateRange?.to ? new Date(filters.customDateRange.to) : undefined,
      });
      
      toast({
        title: "View Loaded",
        description: `Applied filters from "${view.name}"`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load saved view",
        variant: "destructive",
      });
    }
  };

  // Handler to load a saved dashboard
  const handleLoadDashboard = (dashboard: Dashboard) => {
    try {
      setCurrentDashboard(dashboard);
      setDashboardWidgets(dashboard.widgets || []);
      setDashboardEditMode(false);
      
      // Parse and apply filters from dashboard
      if (dashboard.filters) {
        const parsedFilters = typeof dashboard.filters === 'string' 
          ? JSON.parse(dashboard.filters) 
          : dashboard.filters;
        
        setServiceFilter(parsedFilters.serviceFilter || "all");
        setTaskAssigneeFilter(parsedFilters.taskAssigneeFilter || "all");
        setServiceOwnerFilter(parsedFilters.serviceOwnerFilter || "all");
        setUserFilter(parsedFilters.userFilter || "all");
        setShowArchived(parsedFilters.showArchived || false);
        setDynamicDateFilter(parsedFilters.dynamicDateFilter || "all");
        setCustomDateRange({
          from: parsedFilters.customDateRange?.from ? new Date(parsedFilters.customDateRange.from) : undefined,
          to: parsedFilters.customDateRange?.to ? new Date(parsedFilters.customDateRange.to) : undefined,
        });
      }
      
      toast({
        title: "Dashboard Loaded",
        description: `Loaded dashboard "${dashboard.name}"`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load dashboard",
        variant: "destructive",
      });
    }
  };

  // Save dashboard mutation
  const saveDashboardMutation = useMutation({
    mutationFn: async (data: { name: string; filters: any; widgets: Widget[]; visibility: "private" | "shared"; isCreating?: boolean }) => {
      if (data.isCreating || !currentDashboard) {
        return apiRequest("POST", "/api/dashboards", data);
      } else {
        return apiRequest("PATCH", `/api/dashboards/${currentDashboard.id}`, data);
      }
    },
    onSuccess: (savedDashboard: Dashboard) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      setCurrentDashboard(savedDashboard);
      setDashboardWidgets(savedDashboard.widgets);
      toast({
        title: "Success",
        description: "Dashboard saved successfully",
      });
      setCreateDashboardModalOpen(false);
      setIsCreatingDashboard(false);
      setNewDashboardName("");
      setNewDashboardWidgets([]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save dashboard",
        variant: "destructive",
      });
    },
  });

  // Handler to add widget to new dashboard
  const handleAddWidgetToNewDashboard = () => {
    if (!newWidgetTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a widget title",
        variant: "destructive",
      });
      return;
    }

    const widget: Widget = {
      id: `widget-${Date.now()}`,
      type: newWidgetType,
      title: newWidgetTitle,
      groupBy: newWidgetGroupBy,
    };

    setNewDashboardWidgets([...newDashboardWidgets, widget]);
    setNewWidgetDialogOpen(false);
    setNewWidgetTitle("");
    setNewWidgetType("bar");
    setNewWidgetGroupBy("projectType");
    
    toast({
      title: "Widget Added",
      description: "Widget added to dashboard",
    });
  };

  // Handler to remove widget from new dashboard
  const handleRemoveWidgetFromNewDashboard = (widgetId: string) => {
    setNewDashboardWidgets(newDashboardWidgets.filter(w => w.id !== widgetId));
  };

  // Handler to save new dashboard
  const handleSaveNewDashboard = () => {
    if (!newDashboardName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a dashboard name",
        variant: "destructive",
      });
      return;
    }

    if (newDashboardWidgets.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one widget",
        variant: "destructive",
      });
      return;
    }

    // Save current filters with the dashboard
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
    };

    saveDashboardMutation.mutate({
      name: newDashboardName,
      filters: JSON.stringify(filtersToSave),
      widgets: newDashboardWidgets,
      visibility: "private",
      isCreating: isCreatingDashboard,
    });
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Handle query errors
  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [error, toast]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const isManagerOrAdmin = Boolean(user.isAdmin || user.canSeeAdminMenu);

  // Prepare data for FilterPanel
  const services = Array.from(
    new Set(
      (projects || [])
        .map((p: ProjectWithRelations) => p.projectType?.service?.name)
        .filter((s): s is string => Boolean(s))
    )
  );

  const taskAssignees = Array.from(
    new Map(
      (projects || [])
        .map((p: ProjectWithRelations) => p.stageRoleAssignee)
        .filter((assignee): assignee is NonNullable<typeof assignee> => Boolean(assignee))
        .map(assignee => [assignee.id, assignee])
    ).values()
  );

  const serviceOwners = Array.from(
    new Map(
      (projects || [])
        .map((p: ProjectWithRelations) => p.projectOwner)
        .filter((owner): owner is NonNullable<typeof owner> => Boolean(owner))
        .map(owner => [owner.id, owner])
    ).values()
  );

  // Calculate active filter count
  const activeFilterCount = () => {
    let count = 0;
    if (serviceFilter !== "all") count++;
    if (taskAssigneeFilter !== "all") count++;
    if (serviceOwnerFilter !== "all") count++;
    if (userFilter !== "all" && isManagerOrAdmin) count++;
    if (showArchived) count++;
    if (dynamicDateFilter !== "all") count++;
    return count;
  };

  const filteredProjects = (projects || []).filter((project: ProjectWithRelations) => {
    // Service filter using projectType and service data
    let serviceMatch = true;
    if (serviceFilter !== "all") {
      serviceMatch = project.projectType?.service?.name === serviceFilter;
    }

    // Task Assignee filter (using stageRoleAssignee)
    let taskAssigneeMatch = true;
    if (taskAssigneeFilter !== "all") {
      taskAssigneeMatch = project.stageRoleAssignee?.id === taskAssigneeFilter;
    }

    // Service Owner filter
    let serviceOwnerMatch = true;
    if (serviceOwnerFilter !== "all") {
      serviceOwnerMatch = project.projectOwnerId === serviceOwnerFilter;
    }

    // User filter (only available for managers/admins)
    let userMatch = true;
    if (userFilter !== "all" && isManagerOrAdmin) {
      userMatch = project.bookkeeperId === userFilter || 
                  project.clientManagerId === userFilter ||
                  project.currentAssigneeId === userFilter;
    }

    // Date filter (based on project dueDate)
    let dateMatch = true;
    if (dynamicDateFilter !== "all" && project.dueDate) {
      const dueDate = new Date(project.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (dynamicDateFilter) {
        case "overdue":
          dateMatch = dueDate < today;
          break;
        case "today":
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);
          dateMatch = dueDate >= today && dueDate <= todayEnd;
          break;
        case "next7days":
          const next7Days = new Date(today);
          next7Days.setDate(next7Days.getDate() + 7);
          dateMatch = dueDate >= today && dueDate <= next7Days;
          break;
        case "next14days":
          const next14Days = new Date(today);
          next14Days.setDate(next14Days.getDate() + 14);
          dateMatch = dueDate >= today && dueDate <= next14Days;
          break;
        case "next30days":
          const next30Days = new Date(today);
          next30Days.setDate(next30Days.getDate() + 30);
          dateMatch = dueDate >= today && dueDate <= next30Days;
          break;
        case "custom":
          if (customDateRange.from && customDateRange.to) {
            const fromDate = new Date(customDateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            const toDate = new Date(customDateRange.to);
            toDate.setHours(23, 59, 59, 999);
            dateMatch = dueDate >= fromDate && dueDate <= toDate;
          }
          break;
      }
    }

    return serviceMatch && taskAssigneeMatch && serviceOwnerMatch && userMatch && dateMatch;
  });


  const getPageTitle = () => {
    return isManagerOrAdmin ? "All Projects" : "Projects";
  };

  const getPageDescription = () => {
    return isManagerOrAdmin 
      ? "Complete overview of all projects across the organization"
      : "Project overview and task management";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
                {getPageTitle()}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Conditionally show dropdowns based on view mode */}
              {viewMode === "list" ? (
                // List View: Show saved views dropdown
                savedViews.length > 0 && (
                  <Select onValueChange={(value) => {
                    const view = savedViews.find(v => String(v.id) === value);
                    if (view) handleLoadSavedView(view);
                  }}>
                    <SelectTrigger className="w-[200px]" data-testid="select-load-view">
                      <SelectValue placeholder="Load saved view..." />
                    </SelectTrigger>
                    <SelectContent>
                      {savedViews.map(view => (
                        <SelectItem key={view.id} value={String(view.id)}>
                          {view.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              ) : viewMode === "dashboard" ? (
                // Dashboard View: Show dashboards dropdown and create button
                <>
                  {dashboards.length > 0 && (
                    <Select onValueChange={(value) => {
                      const dashboard = dashboards.find(d => d.id === value);
                      if (dashboard) handleLoadDashboard(dashboard);
                    }}>
                      <SelectTrigger className="w-[200px]" data-testid="select-load-dashboard">
                        <SelectValue placeholder="Load saved dashboard..." />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboards.map(dashboard => (
                          <SelectItem key={dashboard.id} value={dashboard.id}>
                            {dashboard.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setIsCreatingDashboard(true);
                      setCurrentDashboard(null);
                      setNewDashboardName("");
                      setNewDashboardWidgets([]);
                      setCreateDashboardModalOpen(true);
                    }}
                    data-testid="button-create-dashboard"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Dashboard
                  </Button>
                </>
              ) : null}

              {/* View Mode Toggle */}
              {isManagerOrAdmin && (
                <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    data-testid="button-view-list"
                  >
                    <List className="w-4 h-4 mr-2" />
                    List
                  </Button>
                  <Button
                    variant={viewMode === "dashboard" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("dashboard")}
                    data-testid="button-view-dashboard"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </div>
              )}
              
              {/* Filters Button */}
              <Button
                variant="outline"
                onClick={() => setFilterPanelOpen(true)}
                className="relative"
                data-testid="button-open-filters"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFilterCount() > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-2 rounded-full px-2"
                    data-testid="badge-active-filters-count"
                  >
                    {activeFilterCount()}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {projectsLoading || (isManagerOrAdmin && usersLoading) ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading projects...</p>
              </div>
            </div>
          ) : viewMode === "dashboard" ? (
            <DashboardBuilder
              filters={{
                serviceFilter,
                taskAssigneeFilter,
                serviceOwnerFilter,
                userFilter,
                showArchived,
                dynamicDateFilter,
                customDateRange,
              }}
              widgets={dashboardWidgets}
              editMode={dashboardEditMode}
              onAddWidget={() => {
                setIsCreatingDashboard(true);
                setCurrentDashboard(null);
                setNewDashboardName("");
                setNewDashboardWidgets([]);
                setCreateDashboardModalOpen(true);
              }}
              onRemoveWidget={(widgetId) => {
                setDashboardWidgets(dashboardWidgets.filter(w => w.id !== widgetId));
              }}
              currentDashboard={currentDashboard}
            />
          ) : viewMode === "kanban" ? (
            <KanbanBoard 
              projects={filteredProjects} 
              user={user}
              onSwitchToList={() => setViewMode("list")}
            />
          ) : (
            <TaskList 
              projects={filteredProjects} 
              user={user} 
              serviceFilter={serviceFilter}
              onSwitchToKanban={() => setViewMode("kanban")}
            />
          )}
        </main>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        open={filterPanelOpen}
        onOpenChange={setFilterPanelOpen}
        serviceFilter={serviceFilter}
        setServiceFilter={setServiceFilter}
        taskAssigneeFilter={taskAssigneeFilter}
        setTaskAssigneeFilter={setTaskAssigneeFilter}
        serviceOwnerFilter={serviceOwnerFilter}
        setServiceOwnerFilter={setServiceOwnerFilter}
        userFilter={userFilter}
        setUserFilter={setUserFilter}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        dynamicDateFilter={dynamicDateFilter}
        setDynamicDateFilter={setDynamicDateFilter}
        customDateRange={customDateRange}
        setCustomDateRange={setCustomDateRange}
        viewMode={viewMode}
        setViewMode={setViewMode}
        services={services}
        users={users || []}
        taskAssignees={taskAssignees}
        serviceOwners={serviceOwners}
        isManagerOrAdmin={isManagerOrAdmin}
      />

      {/* Create Dashboard Modal */}
      <Dialog open={createDashboardModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreatingDashboard(false);
          setNewDashboardName("");
          setNewDashboardWidgets([]);
          setNewWidgetTitle("");
          setNewWidgetType("bar");
          setNewWidgetGroupBy("projectType");
          setNewWidgetDialogOpen(false);
        }
        setCreateDashboardModalOpen(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-dashboard">
          <DialogHeader>
            <DialogTitle>Create New Dashboard</DialogTitle>
            <DialogDescription>
              Configure filters, add widgets, and save your custom dashboard
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Dashboard Name Section */}
            <div className="space-y-2">
              <Label htmlFor="dashboard-name">Dashboard Name</Label>
              <Input
                id="dashboard-name"
                placeholder="e.g., Project Overview"
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                data-testid="input-new-dashboard-name"
              />
            </div>

            {/* Current Filters Section */}
            <div className="space-y-2">
              <Label>Applied Filters</Label>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {serviceFilter !== "all" && (
                      <Badge variant="secondary">Service: {serviceFilter}</Badge>
                    )}
                    {taskAssigneeFilter !== "all" && (
                      <Badge variant="secondary">Assignee: {(() => {
                        const assignee = taskAssignees.find(a => a.id === taskAssigneeFilter);
                        return assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : taskAssigneeFilter;
                      })()}</Badge>
                    )}
                    {serviceOwnerFilter !== "all" && (
                      <Badge variant="secondary">Owner: {(() => {
                        const owner = serviceOwners.find(o => o.id === serviceOwnerFilter);
                        return owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() : serviceOwnerFilter;
                      })()}</Badge>
                    )}
                    {userFilter !== "all" && isManagerOrAdmin && (
                      <Badge variant="secondary">User: {(() => {
                        const selectedUser = (users || []).find(u => u.id === userFilter);
                        return selectedUser ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() : userFilter;
                      })()}</Badge>
                    )}
                    {showArchived && (
                      <Badge variant="secondary">Archived: Yes</Badge>
                    )}
                    {dynamicDateFilter === "custom" && customDateRange.from && customDateRange.to ? (
                      <Badge variant="secondary">Date: {customDateRange.from.toLocaleDateString()} - {customDateRange.to.toLocaleDateString()}</Badge>
                    ) : dynamicDateFilter !== "all" && (
                      <Badge variant="secondary">Date: {dynamicDateFilter}</Badge>
                    )}
                    {(serviceFilter === "all" && taskAssigneeFilter === "all" && serviceOwnerFilter === "all" && userFilter === "all" && !showArchived && dynamicDateFilter === "all") && (
                      <p className="text-sm text-muted-foreground">No filters applied - showing all data</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Current filters will be saved with this dashboard. Modify filters using the Filters button before creating the dashboard.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Widgets Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Dashboard Widgets</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewWidgetDialogOpen(true)}
                  data-testid="button-add-widget-to-dashboard"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Widget
                </Button>
              </div>

              {newDashboardWidgets.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No widgets added yet</p>
                      <p className="text-xs text-muted-foreground">Click "Add Widget" to get started</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {newDashboardWidgets.map((widget) => (
                    <Card key={widget.id} data-testid={`new-widget-card-${widget.id}`}>
                      <CardHeader className="relative pb-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => handleRemoveWidgetFromNewDashboard(widget.id)}
                          data-testid={`button-remove-new-widget-${widget.id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <CardTitle className="text-sm">{widget.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {widget.type === "bar" && "Bar Chart"}
                          {widget.type === "pie" && "Pie Chart"}
                          {widget.type === "line" && "Line Chart"}
                          {widget.type === "number" && "Number Card"}
                          {" • "}
                          {widget.groupBy === "projectType" && "By Project Type"}
                          {widget.groupBy === "status" && "By Status"}
                          {widget.groupBy === "assignee" && "By Assignee"}
                          {widget.groupBy === "serviceOwner" && "By Service Owner"}
                          {widget.groupBy === "daysOverdue" && "By Days Overdue"}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDashboardModalOpen(false);
              setNewDashboardName("");
              setNewDashboardWidgets([]);
            }} data-testid="button-cancel-create-dashboard">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveNewDashboard} 
              disabled={saveDashboardMutation.isPending}
              data-testid="button-save-new-dashboard"
            >
              {saveDashboardMutation.isPending ? "Saving..." : "Create Dashboard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Widget Dialog */}
      <Dialog open={newWidgetDialogOpen} onOpenChange={setNewWidgetDialogOpen}>
        <DialogContent data-testid="dialog-add-widget-to-dashboard">
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>
              Configure a chart or metric to visualize project data
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-widget-title">Widget Title</Label>
              <Input
                id="new-widget-title"
                placeholder="e.g., Projects by Type"
                value={newWidgetTitle}
                onChange={(e) => setNewWidgetTitle(e.target.value)}
                data-testid="input-new-widget-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-widget-type">Chart Type</Label>
              <Select value={newWidgetType} onValueChange={(v: any) => setNewWidgetType(v)}>
                <SelectTrigger id="new-widget-type" data-testid="select-new-widget-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="number">Number Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-widget-groupby">Group By</Label>
              <Select value={newWidgetGroupBy} onValueChange={(v: any) => setNewWidgetGroupBy(v)}>
                <SelectTrigger id="new-widget-groupby" data-testid="select-new-widget-groupby">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="projectType">Project Type</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="assignee">Assignee</SelectItem>
                  <SelectItem value="serviceOwner">Service Owner</SelectItem>
                  <SelectItem value="daysOverdue">Days Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewWidgetDialogOpen(false)} data-testid="button-cancel-new-widget">
              Cancel
            </Button>
            <Button onClick={handleAddWidgetToNewDashboard} data-testid="button-confirm-add-new-widget">
              Add Widget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}