import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type ProjectWithRelations, type User } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import { useIsMobile } from "@/hooks/use-mobile";
import KanbanBoard from "@/components/kanban-board";
import TaskList from "@/components/task-list";
import DashboardBuilder from "@/components/dashboard-builder";
import FilterPanel from "@/components/filter-panel";
import ViewMegaMenu from "@/components/ViewMegaMenu";
import PullToRefresh from "react-simple-pull-to-refresh";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Columns3, List, Filter, BarChart3, Plus, Trash2, X, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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
  description?: string | null;
  filters: any;
  widgets: Widget[];
  visibility: "private" | "shared";
  isHomescreenDashboard?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

// Note: Using shared month normalization utility for consistent filtering

const ITEMS_PER_PAGE = 15;

export default function Projects() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");
  const [serviceOwnerFilter, setServiceOwnerFilter] = useState("all");
  const [behindScheduleOnly, setBehindScheduleOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);

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
  const [newDashboardDescription, setNewDashboardDescription] = useState("");
  const [newDashboardIsHomescreen, setNewDashboardIsHomescreen] = useState(false);
  const [newDashboardWidgets, setNewDashboardWidgets] = useState<Widget[]>([]);
  const [newWidgetDialogOpen, setNewWidgetDialogOpen] = useState(false);
  const [newWidgetType, setNewWidgetType] = useState<"bar" | "pie" | "number" | "line">("bar");
  const [newWidgetTitle, setNewWidgetTitle] = useState("");
  const [newWidgetGroupBy, setNewWidgetGroupBy] = useState<"projectType" | "status" | "assignee" | "serviceOwner" | "daysOverdue">("projectType");

  // Edit dashboard state
  const [dashboardDescription, setDashboardDescription] = useState("");
  const [dashboardIsHomescreen, setDashboardIsHomescreen] = useState(false);
  const [newDashboardVisibility, setNewDashboardVisibility] = useState<"private" | "shared">("private");
  const [dashboardVisibility, setDashboardVisibility] = useState<"private" | "shared">("private");

  // Dashboard-specific filter state (independent from list view filters)
  const [dashboardServiceFilter, setDashboardServiceFilter] = useState("all");
  const [dashboardTaskAssigneeFilter, setDashboardTaskAssigneeFilter] = useState("all");
  const [dashboardServiceOwnerFilter, setDashboardServiceOwnerFilter] = useState("all");
  const [dashboardUserFilter, setDashboardUserFilter] = useState("all");
  const [dashboardShowArchived, setDashboardShowArchived] = useState<boolean>(false);
  const [dashboardDynamicDateFilter, setDashboardDynamicDateFilter] = useState<"all" | "overdue" | "today" | "next7days" | "next14days" | "next30days" | "custom">("all");
  const [dashboardCustomDateRange, setDashboardCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Save view modal state
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  // Delete confirmation state
  const [deleteViewDialogOpen, setDeleteViewDialogOpen] = useState(false);
  const [viewToDelete, setViewToDelete] = useState<any | null>(null);
  const [deleteDashboardDialogOpen, setDeleteDashboardDialogOpen] = useState(false);
  const [dashboardToDelete, setDashboardToDelete] = useState<Dashboard | null>(null);

  // Read URL query parameters and set filters on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    
    const taskAssignee = searchParams.get('taskAssigneeFilter');
    if (taskAssignee && taskAssignee !== taskAssigneeFilter) {
      setTaskAssigneeFilter(taskAssignee);
    }
    
    const serviceOwner = searchParams.get('serviceOwnerFilter');
    if (serviceOwner && serviceOwner !== serviceOwnerFilter) {
      setServiceOwnerFilter(serviceOwner);
    }
    
    const dateFilter = searchParams.get('dynamicDateFilter');
    if (dateFilter && (dateFilter === 'overdue' || dateFilter === 'today' || dateFilter === 'next7days' || dateFilter === 'next14days' || dateFilter === 'next30days')) {
      setDynamicDateFilter(dateFilter as any);
    }
    
    const behindSchedule = searchParams.get('behindSchedule');
    if (behindSchedule === 'true') {
      setBehindScheduleOnly(true);
    }
  }, [location]); // Only run when location changes

  // Sync behindSchedule filter state to URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const currentBehindSchedule = searchParams.get('behindSchedule');
    
    if (behindScheduleOnly && currentBehindSchedule !== 'true') {
      searchParams.set('behindSchedule', 'true');
      window.history.replaceState({}, '', `${window.location.pathname}?${searchParams.toString()}`);
    } else if (!behindScheduleOnly && currentBehindSchedule === 'true') {
      searchParams.delete('behindSchedule');
      const newUrl = searchParams.toString() 
        ? `${window.location.pathname}?${searchParams.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [behindScheduleOnly]);

  const { data: projects, isLoading: projectsLoading, error } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/projects", { showArchived }],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && Boolean(user?.isAdmin || user?.canSeeAdminMenu),
    retry: false,
  });

  // Fetch all services (for dropdown population)
  const { data: allServices = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/services/active"],
    enabled: isAuthenticated && !!user,
    retry: false,
    select: (data: any[]) => data.map((s: any) => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name))
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

  // Pull-to-refresh handler - invalidates all project-related queries
  const handleRefresh = async () => {
    if (!isAuthenticated || !user) return;
    
    await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/services/with-active-clients"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/project-views"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
  };

  // Normalize dashboard service filter when allServices loads
  // This handles race condition where dashboard is loaded before services are available
  useEffect(() => {
    if (allServices.length > 0 && dashboardServiceFilter && dashboardServiceFilter !== "all") {
      // Check if current filter is a name (legacy) instead of UUID
      if (!dashboardServiceFilter.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const matchingService = allServices.find(s => s.name === dashboardServiceFilter);
        if (matchingService) {
          // Convert legacy name to ID
          setDashboardServiceFilter(matchingService.id);
        } else {
          // Service name not found - set to "all" to avoid passing invalid names to queries
          console.warn(`Service "${dashboardServiceFilter}" not found in available services, resetting to "all"`);
          setDashboardServiceFilter("all");
        }
      }
    }
  }, [allServices, dashboardServiceFilter]);

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
      
      // Switch to the appropriate view mode based on the saved view
      if (view.viewMode === "kanban") {
        setViewMode("kanban");
      } else if (view.viewMode === "list") {
        setViewMode("list");
      }
      
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
      
      // Switch to dashboard view mode
      setViewMode("dashboard");
      
      // Set description and homescreen dashboard states
      setDashboardDescription(dashboard.description || "");
      setDashboardIsHomescreen(dashboard.isHomescreenDashboard || false);
      setDashboardVisibility(dashboard.visibility || "private");
      
      // Parse and apply filters to dashboard-specific state (not list view)
      if (dashboard.filters) {
        const parsedFilters = typeof dashboard.filters === 'string' 
          ? JSON.parse(dashboard.filters) 
          : dashboard.filters;
        
        // Set service filter - normalize legacy names to IDs immediately
        let serviceFilterValue = parsedFilters.serviceFilter || "all";
        
        // If service filter is a legacy name (not a UUID), convert it to ID
        // Only proceed if services are loaded to avoid race condition
        if (allServices.length > 0 && serviceFilterValue !== "all" && !serviceFilterValue.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          const matchingService = allServices.find(s => s.name === serviceFilterValue);
          if (matchingService) {
            serviceFilterValue = matchingService.id;
          } else {
            console.warn(`Service "${serviceFilterValue}" not found in available services, resetting to "all"`);
            serviceFilterValue = "all";
          }
        }
        
        setDashboardServiceFilter(serviceFilterValue);
        setDashboardTaskAssigneeFilter(parsedFilters.taskAssigneeFilter || "all");
        setDashboardServiceOwnerFilter(parsedFilters.serviceOwnerFilter || "all");
        setDashboardUserFilter(parsedFilters.userFilter || "all");
        setDashboardShowArchived(parsedFilters.showArchived || false);
        setDashboardDynamicDateFilter(parsedFilters.dynamicDateFilter || "all");
        setDashboardCustomDateRange({
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

  // Handler to reset all filters and show all projects
  const handleViewAllProjects = () => {
    // Reset list/kanban filters to defaults
    setServiceFilter("all");
    setTaskAssigneeFilter("all");
    setServiceOwnerFilter("all");
    setUserFilter("all");
    setShowArchived(false);
    setDynamicDateFilter("all");
    setCustomDateRange({ from: undefined, to: undefined });
    setBehindScheduleOnly(false);
    
    // Switch to list view (default view mode)
    setViewMode("list");
    
    toast({
      title: "Filters Reset",
      description: "Showing all projects",
    });
  };

  // Save view mutation
  const saveViewMutation = useMutation({
    mutationFn: async (data: { name: string; filters: any; viewMode: "list" | "kanban" }) => {
      return apiRequest("POST", "/api/project-views", data);
    },
    onSuccess: (savedView: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-views"] });
      setSaveViewDialogOpen(false);
      setNewViewName("");
      toast({
        title: "View saved successfully",
        description: `"${savedView.name}" has been saved`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save view",
        variant: "destructive",
      });
    },
  });

  // Handler to save current view
  const handleSaveCurrentView = () => {
    if (!newViewName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a view name",
        variant: "destructive",
      });
      return;
    }

    const filters = {
      serviceFilter,
      taskAssigneeFilter,
      serviceOwnerFilter,
      userFilter,
      showArchived,
      dynamicDateFilter,
      customDateRange,
      behindScheduleOnly,
    };

    saveViewMutation.mutate({
      name: newViewName.trim(),
      filters: JSON.stringify(filters),
      viewMode,
    });
  };

  // Save dashboard mutation
  const saveDashboardMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; filters: any; widgets: Widget[]; visibility: "private" | "shared"; isHomescreenDashboard?: boolean; isCreating?: boolean }) => {
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
      
      // Load the saved dashboard filters so widgets can fetch data correctly
      if (savedDashboard.filters) {
        const parsedFilters = typeof savedDashboard.filters === 'string' 
          ? JSON.parse(savedDashboard.filters) 
          : savedDashboard.filters;
        
        // Set service filter - preserve legacy names for normalization effect to handle
        const serviceFilterValue = parsedFilters.serviceFilter || "all";
        setDashboardServiceFilter(serviceFilterValue);
        setDashboardTaskAssigneeFilter(parsedFilters.taskAssigneeFilter || "all");
        setDashboardServiceOwnerFilter(parsedFilters.serviceOwnerFilter || "all");
        setDashboardUserFilter(parsedFilters.userFilter || "all");
        setDashboardShowArchived(parsedFilters.showArchived || false);
        setDashboardDynamicDateFilter(parsedFilters.dynamicDateFilter || "all");
        setDashboardCustomDateRange({
          from: parsedFilters.customDateRange?.from ? new Date(parsedFilters.customDateRange.from) : undefined,
          to: parsedFilters.customDateRange?.to ? new Date(parsedFilters.customDateRange.to) : undefined,
        });
      }
      
      toast({
        title: "Success",
        description: "Dashboard saved successfully",
      });
      setCreateDashboardModalOpen(false);
      setIsCreatingDashboard(false);
      setNewDashboardName("");
      setNewDashboardDescription("");
      setNewDashboardIsHomescreen(false);
      setNewDashboardVisibility("private");
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

  // Delete view mutation
  const deleteViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      return apiRequest("DELETE", `/api/project-views/${viewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-views"] });
      toast({
        title: "Success",
        description: "View deleted successfully",
      });
      setDeleteViewDialogOpen(false);
      setViewToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete view",
        variant: "destructive",
      });
    },
  });

  // Delete dashboard mutation
  const deleteDashboardMutation = useMutation({
    mutationFn: async (dashboardId: string) => {
      return apiRequest("DELETE", `/api/dashboards/${dashboardId}`);
    },
    onSuccess: (_, dashboardId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      
      // Clear current dashboard if it's the one being deleted
      if (currentDashboard?.id === dashboardId) {
        setCurrentDashboard(null);
        setDashboardWidgets([]);
      }
      
      toast({
        title: "Success",
        description: "Dashboard deleted successfully",
      });
      setDeleteDashboardDialogOpen(false);
      setDashboardToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete dashboard",
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

    // Save dashboard-specific filters with the dashboard
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
    };

    saveDashboardMutation.mutate({
      name: newDashboardName,
      description: newDashboardDescription.trim() || undefined,
      filters: JSON.stringify(filtersToSave),
      widgets: newDashboardWidgets,
      visibility: newDashboardVisibility,
      isHomescreenDashboard: newDashboardIsHomescreen,
      isCreating: isCreatingDashboard,
    });
  };

  // Handler to save current dashboard as new (update existing)
  const handleSaveDashboardAsNew = () => {
    if (!currentDashboard) return;

    // Save current dashboard state
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
    };

    saveDashboardMutation.mutate({
      name: currentDashboard.name,
      description: dashboardDescription.trim() || undefined,
      filters: JSON.stringify(filtersToSave),
      widgets: dashboardWidgets,
      visibility: dashboardVisibility,
      isHomescreenDashboard: dashboardIsHomescreen,
      isCreating: false,
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

  // Use allServices from backend query instead of extracting from projects
  // This ensures services are always available for dropdowns, even when filtered
  const services = allServices;

  const taskAssignees = Array.from(
    new Map(
      (projects || [])
        .map((p: ProjectWithRelations) => p.currentAssignee)
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
    // Service filter using projectType and service data (compare by ID)
    let serviceMatch = true;
    if (serviceFilter !== "all") {
      serviceMatch = project.projectType?.service?.id === serviceFilter;
    }

    // Task Assignee filter (using currentAssigneeId)
    let taskAssigneeMatch = true;
    if (taskAssigneeFilter !== "all") {
      taskAssigneeMatch = project.currentAssigneeId === taskAssigneeFilter;
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

    // Behind schedule filter - check if project exceeds stage max time
    let behindScheduleMatch = true;
    if (behindScheduleOnly) {
      behindScheduleMatch = false; // Default to false, only match if truly behind
      
      if (!project.completionStatus && project.projectType?.kanbanStages) {
        const currentStageConfig = project.projectType.kanbanStages.find(
          (s: any) => s.name === project.currentStatus
        );
        
        if (currentStageConfig?.maxInstanceTime && currentStageConfig.maxInstanceTime > 0) {
          // Get time in current stage from chronology
          const chronology = project.chronology || [];
          const sortedChronology = [...chronology].sort((a, b) => 
            new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          );
          
          const lastEntry = sortedChronology.find((entry: any) => entry.toStatus === project.currentStatus);
          const startTime = lastEntry?.timestamp || project.createdAt;
          
          if (startTime) {
            // Simple hour calculation (not business hours, but close enough for filtering)
            const now = new Date();
            const start = new Date(startTime);
            const hoursDiff = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
            
            behindScheduleMatch = hoursDiff > currentStageConfig.maxInstanceTime;
          }
        }
      }
    }

    return serviceMatch && taskAssigneeMatch && serviceOwnerMatch && userMatch && dateMatch && behindScheduleMatch;
  });

  // Pagination for list view
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProjects = useMemo(() => {
    // Only paginate in list view
    if (viewMode === "list") {
      return filteredProjects.slice(startIndex, endIndex);
    }
    return filteredProjects;
  }, [filteredProjects, startIndex, endIndex, viewMode]);

  // Reset to page 1 when filters change or view mode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [serviceFilter, taskAssigneeFilter, serviceOwnerFilter, userFilter, showArchived, dynamicDateFilter, customDateRange, viewMode]);

  // Clamp current page if it exceeds total pages (e.g., after deletions or data refresh)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
        <header className="bg-card border-b border-border px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-semibold text-foreground truncate" data-testid="text-page-title">
                {getPageTitle()}
              </h2>
            </div>
            
            {/* Desktop View - Full buttons */}
            <div className="hidden md:flex items-center space-x-4 flex-shrink-0">
              {/* Unified View Mega Menu */}
              <ViewMegaMenu
                currentViewMode={viewMode}
                onLoadListView={handleLoadSavedView}
                onLoadKanbanView={handleLoadSavedView}
                onLoadDashboard={handleLoadDashboard}
              />

              {/* Save Current View button - only show for list/kanban */}
              {(viewMode === "list" || viewMode === "kanban") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveViewDialogOpen(true)}
                  data-testid="button-save-view"
                >
                  Save Current View
                </Button>
              )}

              {/* View All Projects button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewAllProjects}
                data-testid="button-view-all-projects"
              >
                View All Projects
              </Button>

              {/* Dashboard-specific buttons */}
              {viewMode === "dashboard" && (
                <>
                  {/* Create Dashboard button always visible */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsCreatingDashboard(true);
                      setCurrentDashboard(null);
                      setNewDashboardName("");
                      setNewDashboardDescription("");
                      setNewDashboardIsHomescreen(false);
                      setNewDashboardVisibility("private");
                      setNewDashboardWidgets([]);
                      // Reset dashboard filters to default
                      setDashboardServiceFilter("all");
                      setDashboardTaskAssigneeFilter("all");
                      setDashboardServiceOwnerFilter("all");
                      setDashboardUserFilter("all");
                      setDashboardShowArchived(false);
                      setDashboardDynamicDateFilter("all");
                      setDashboardCustomDateRange({ from: undefined, to: undefined });
                      setCreateDashboardModalOpen(true);
                    }}
                    data-testid="button-create-dashboard"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Dashboard
                  </Button>
                  
                  {/* Show Save/Edit buttons when dashboard is loaded */}
                  {currentDashboard && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Edit current dashboard - populate all fields
                          setIsCreatingDashboard(false);
                          setNewDashboardName(currentDashboard.name);
                          setNewDashboardDescription(dashboardDescription);
                          setNewDashboardIsHomescreen(dashboardIsHomescreen);
                          setNewDashboardVisibility(dashboardVisibility);
                          setNewDashboardWidgets(dashboardWidgets);
                          setCreateDashboardModalOpen(true);
                        }}
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

              {/* View Mode Toggle */}
              {isManagerOrAdmin && (
                <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    data-testid="button-view-list"
                    className="h-11 md:h-8 px-2 md:px-3"
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden md:inline ml-2">List</span>
                  </Button>
                  <Button
                    variant={viewMode === "dashboard" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("dashboard")}
                    data-testid="button-view-dashboard"
                    className="h-11 md:h-8 px-2 md:px-3"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden md:inline ml-2">Dashboard</span>
                  </Button>
                </div>
              )}
              
              {/* Filters Button - Only visible in list view */}
              {viewMode === "list" && (
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
            </div>

            {/* Mobile View - Compact controls only */}
            <div className="flex md:hidden items-center gap-2 flex-shrink-0">
              {/* View Mode Toggle */}
              {isManagerOrAdmin && (
                <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    data-testid="button-view-list"
                    className="h-11 px-2"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "dashboard" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("dashboard")}
                    data-testid="button-view-dashboard"
                    className="h-11 px-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              {/* Filters Button - Only visible in list view */}
              {viewMode === "list" && (
                <Button
                  variant="outline"
                  onClick={() => setFilterPanelOpen(true)}
                  className="relative h-11 px-3"
                  data-testid="button-open-filters"
                >
                  <Filter className="w-4 h-4" />
                  {activeFilterCount() > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="ml-1.5 rounded-full px-1.5 text-xs"
                      data-testid="badge-active-filters-count"
                    >
                      {activeFilterCount()}
                    </Badge>
                  )}
                </Button>
              )}
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-hidden pb-0 md:pb-0" style={{ paddingBottom: isMobile ? '4rem' : '0' }}>
          {isMobile ? (
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
                {projectsLoading || (isManagerOrAdmin && usersLoading) ? (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading projects...</p>
                    </div>
                  </div>
                ) : viewMode === "dashboard" ? (
                  <DashboardBuilder
                    filters={{
                      serviceFilter: dashboardServiceFilter,
                      taskAssigneeFilter: dashboardTaskAssigneeFilter,
                      serviceOwnerFilter: dashboardServiceOwnerFilter,
                      userFilter: dashboardUserFilter,
                      showArchived: dashboardShowArchived,
                      dynamicDateFilter: dashboardDynamicDateFilter,
                      customDateRange: dashboardCustomDateRange,
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
                    projects={paginatedProjects} 
                    user={user}
                    onSwitchToList={() => setViewMode("list")}
                  />
                ) : (
                  <>
                    <TaskList 
                      projects={paginatedProjects} 
                      user={user} 
                      serviceFilter={serviceFilter}
                      onSwitchToKanban={() => setViewMode("kanban")}
                    />
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-4 px-4 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                            Showing {startIndex + 1}-{Math.min(endIndex, filteredProjects.length)} of {filteredProjects.length} projects
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
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            data-testid="button-next-page"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </PullToRefresh>
          ) : (
            // Desktop view - no pull-to-refresh
            <>
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
                    serviceFilter: dashboardServiceFilter,
                    taskAssigneeFilter: dashboardTaskAssigneeFilter,
                    serviceOwnerFilter: dashboardServiceOwnerFilter,
                    userFilter: dashboardUserFilter,
                    showArchived: dashboardShowArchived,
                    dynamicDateFilter: dashboardDynamicDateFilter,
                    customDateRange: dashboardCustomDateRange,
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
                  projects={paginatedProjects} 
                  user={user}
                  onSwitchToList={() => setViewMode("list")}
                />
              ) : (
                <>
                  <TaskList 
                    projects={paginatedProjects} 
                    user={user} 
                    serviceFilter={serviceFilter}
                    onSwitchToKanban={() => setViewMode("kanban")}
                  />
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-4 px-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                          Showing {startIndex + 1}-{Math.min(endIndex, filteredProjects.length)} of {filteredProjects.length} projects
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
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          data-testid="button-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />

      {/* Mobile Search Modal */}
      <SuperSearch
        isOpen={mobileSearchOpen}
        onOpenChange={setMobileSearchOpen}
      />

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
        behindScheduleOnly={behindScheduleOnly}
        setBehindScheduleOnly={setBehindScheduleOnly}
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
          setNewDashboardDescription("");
          setNewDashboardIsHomescreen(false);
          setNewDashboardVisibility("private");
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

            {/* Dashboard Description Section */}
            <div className="space-y-2">
              <Label htmlFor="dashboard-description">Description (optional)</Label>
              <Textarea
                id="dashboard-description"
                placeholder="Briefly describe what this dashboard shows..."
                value={newDashboardDescription}
                onChange={(e) => setNewDashboardDescription(e.target.value)}
                data-testid="textarea-dashboard-description"
                rows={3}
              />
            </div>

            {/* Dashboard Filters Section */}
            <div className="space-y-4">
              <div>
                <Label className="text-base">Dashboard Filters</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure filters that will be applied to this dashboard
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Service Filter */}
                <div className="space-y-2">
                  <Label htmlFor="dashboard-service-filter">Service</Label>
                  <Select value={dashboardServiceFilter} onValueChange={setDashboardServiceFilter}>
                    <SelectTrigger id="dashboard-service-filter" data-testid="select-dashboard-service">
                      <SelectValue placeholder="All Services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Task Assignee Filter */}
                <div className="space-y-2">
                  <Label htmlFor="dashboard-assignee-filter">Task Assignee</Label>
                  <Select value={dashboardTaskAssigneeFilter} onValueChange={setDashboardTaskAssigneeFilter}>
                    <SelectTrigger id="dashboard-assignee-filter" data-testid="select-dashboard-assignee">
                      <SelectValue placeholder="All Assignees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assignees</SelectItem>
                      {taskAssignees.map((assignee) => (
                        <SelectItem key={assignee.id} value={assignee.id}>
                          {`${assignee.firstName || ''} ${assignee.lastName || ''}`.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service Owner Filter */}
                <div className="space-y-2">
                  <Label htmlFor="dashboard-owner-filter">Service Owner</Label>
                  <Select value={dashboardServiceOwnerFilter} onValueChange={setDashboardServiceOwnerFilter}>
                    <SelectTrigger id="dashboard-owner-filter" data-testid="select-dashboard-owner">
                      <SelectValue placeholder="All Owners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Owners</SelectItem>
                      {serviceOwners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {`${owner.firstName || ''} ${owner.lastName || ''}`.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* User Filter (Admin/Manager only) */}
                {isManagerOrAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="dashboard-user-filter">User Assignment</Label>
                    <Select value={dashboardUserFilter} onValueChange={setDashboardUserFilter}>
                      <SelectTrigger id="dashboard-user-filter" data-testid="select-dashboard-user">
                        <SelectValue placeholder="All Users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {(users || []).map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {`${user.firstName || ''} ${user.lastName || ''}`.trim()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Date Filter */}
                <div className="space-y-2">
                  <Label htmlFor="dashboard-date-filter">Due Date</Label>
                  <Select value={dashboardDynamicDateFilter} onValueChange={(v: any) => setDashboardDynamicDateFilter(v)}>
                    <SelectTrigger id="dashboard-date-filter" data-testid="select-dashboard-date">
                      <SelectValue placeholder="All Dates" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="next7days">Next 7 Days</SelectItem>
                      <SelectItem value="next14days">Next 14 Days</SelectItem>
                      <SelectItem value="next30days">Next 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Archived Projects */}
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="dashboard-archived"
                    checked={dashboardShowArchived}
                    onChange={(e) => setDashboardShowArchived(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                    data-testid="checkbox-dashboard-archived"
                  />
                  <Label htmlFor="dashboard-archived" className="cursor-pointer">
                    Show Archived Projects
                  </Label>
                </div>
              </div>
            </div>

            {/* Homescreen Dashboard Toggle */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="dashboard-homescreen"
                  checked={newDashboardIsHomescreen}
                  onCheckedChange={(checked) => setNewDashboardIsHomescreen(checked === true)}
                  data-testid="checkbox-homescreen-dashboard"
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="dashboard-homescreen" className="cursor-pointer font-medium">
                    Set as homescreen dashboard
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    This dashboard will appear on your home screen when you log in
                  </p>
                </div>
              </div>
              {newDashboardIsHomescreen && dashboards.some(d => d.isHomescreenDashboard) && (
                <p className="text-xs text-amber-600 dark:text-amber-500 pl-7">
                  Note: This will replace your current homescreen dashboard
                </p>
              )}
            </div>

            {/* Share Dashboard Toggle */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="dashboard-share"
                  checked={newDashboardVisibility === "shared"}
                  onCheckedChange={(checked) => setNewDashboardVisibility(checked === true ? "shared" : "private")}
                  data-testid="checkbox-share-dashboard"
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="dashboard-share" className="cursor-pointer font-medium">
                    Share with all users
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Other users will be able to view this dashboard
                  </p>
                </div>
              </div>
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
              setNewDashboardDescription("");
              setNewDashboardIsHomescreen(false);
              setNewDashboardVisibility("private");
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

      {/* Save View Dialog */}
      <Dialog open={saveViewDialogOpen} onOpenChange={setSaveViewDialogOpen}>
        <DialogContent data-testid="dialog-save-view">
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
            <DialogDescription>
              Save your current filters and view mode for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., My Active Projects"
                data-testid="input-view-name"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Current view mode: <strong>{viewMode === "list" ? "List" : "Kanban"}</strong></p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSaveViewDialogOpen(false);
                setNewViewName("");
              }}
              data-testid="button-cancel-save-view"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCurrentView}
              disabled={saveViewMutation.isPending}
              data-testid="button-confirm-save-view"
            >
              {saveViewMutation.isPending ? "Saving..." : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete View Confirmation Dialog */}
      <AlertDialog open={deleteViewDialogOpen} onOpenChange={setDeleteViewDialogOpen}>
        <AlertDialogContent data-testid="alert-delete-view">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this view? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-view">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (viewToDelete) {
                  deleteViewMutation.mutate(viewToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-view"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dashboard Confirmation Dialog */}
      <AlertDialog open={deleteDashboardDialogOpen} onOpenChange={setDeleteDashboardDialogOpen}>
        <AlertDialogContent data-testid="alert-delete-dashboard">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this dashboard? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-dashboard">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (dashboardToDelete) {
                  deleteDashboardMutation.mutate(dashboardToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-dashboard"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}