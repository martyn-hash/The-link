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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Columns3, List, Filter, BarChart3, Plus } from "lucide-react";
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
                    onClick={() => setCreateDashboardModalOpen(true)}
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
              onApplyFilters={(newFilters) => {
                setServiceFilter(newFilters.serviceFilter);
                setTaskAssigneeFilter(newFilters.taskAssigneeFilter);
                setServiceOwnerFilter(newFilters.serviceOwnerFilter);
                setUserFilter(newFilters.userFilter);
                setShowArchived(newFilters.showArchived);
                setDynamicDateFilter(newFilters.dynamicDateFilter);
                setCustomDateRange(newFilters.customDateRange);
              }}
              onSwitchToList={() => setViewMode("list")}
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
    </div>
  );
}