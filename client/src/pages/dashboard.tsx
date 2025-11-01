import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
// Navigation handled via window.location.href for reliability
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type ProjectWithRelations, type Client, type Person, type ProjectType, type Service, type KanbanStage } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import DashboardBuilder from "@/components/dashboard-builder";
import TaskList from "@/components/task-list";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  Users, 
  FolderOpen, 
  Plus,
  ArrowRight,
  Calendar,
  TrendingUp,
  AlertCircle,
  Bell,
  Filter,
  BarChart3,
  Home
} from "lucide-react";

// Dashboard data interfaces
interface DashboardStats {
  myActiveTasks: ProjectWithRelations[];
  myProjects: ProjectWithRelations[];
  overdueProjects: ProjectWithRelations[];
  behindScheduleProjects: ProjectWithRelations[];
  recentClients: (Client & { activeProjects: number; lastViewed: Date })[];
  recentPeople: (Person & { lastViewed: Date })[];
  recentProjects: (ProjectWithRelations & { lastViewed: Date })[];
  projectsByType: { [key: string]: ProjectWithRelations[] };
  deadlineAlerts: { message: string; projectId: string; dueDate: Date | null }[];
  stuckProjects: ProjectWithRelations[];
  upcomingRenewals: any[];
}

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

export default function Dashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedProjectType, setSelectedProjectType] = useState<string>("all");
  const isMobile = useIsMobile();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Fetch dashboard data (only for recently viewed)
  const { data: dashboardData, isLoading: dashboardLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    enabled: isAuthenticated && !!user,
    retry: false,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
  });

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

  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main Dashboard Content */}
        <main className="flex-1 overflow-auto p-3 md:p-6 pb-20 md:pb-6">
          <div className="space-y-6">
            {/* Recently Viewed */}
            <RecentlyViewedPanel data={dashboardData} />
          </div>
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />}

      {/* Mobile Search Modal */}
      {isMobile && (
        <SuperSearch
          isOpen={mobileSearchOpen}
          onOpenChange={setMobileSearchOpen}
        />
      )}
    </div>
  );
}

// Panel Components

function MyTasksPanel({ data, user }: { data?: DashboardStats; user: any }) {
  const myTasks = data?.myActiveTasks || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-500" />
          My Tasks
        </CardTitle>
        <CardDescription>Tasks assigned to you</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {myTasks.slice(0, 5).map((task) => (
            <div 
              key={task.id} 
              className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
              onClick={() => window.location.href = `/projects/${task.id}`}
              data-testid={`task-item-${task.id}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{task.client?.name}</span>
                <Badge variant="outline" className="text-xs">
                  {task.currentStatus?.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{(task as any).projectType?.name || "Unknown Project Type"}</p>
              {task.dueDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Due: {new Date(task.dueDate).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
          {myTasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No active tasks</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OverdueProjectsPanel({ data }: { data?: DashboardStats }) {
  const overdueProjects = data?.overdueProjects || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Overdue Projects
        </CardTitle>
        <CardDescription>Projects past their due date</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {overdueProjects.slice(0, 5).map((project) => (
            <div 
              key={project.id} 
              className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/30 cursor-pointer transition-colors"
              onClick={() => window.location.href = `/projects/${project.id}`}
              data-testid={`overdue-project-${project.id}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{project.client?.name}</span>
                <Badge variant="destructive" className="text-xs">
                  Overdue
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{(project as any).projectType?.name || "Unknown Project Type"}</p>
              {project.dueDate && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  Was due: {new Date(project.dueDate).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
          {overdueProjects.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No overdue projects</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentlyViewedPanel({ data }: { data?: DashboardStats }) {
  const [filter, setFilter] = useState<"all" | "clients" | "people" | "projects">("all");
  
  const recentClients = data?.recentClients || [];
  const recentPeople = data?.recentPeople || [];
  const recentProjects = data?.recentProjects || [];

  // Filter and combine items based on selected filter
  const getFilteredItems = () => {
    const clientItems = recentClients.map((client) => ({ 
      type: 'client' as const, 
      data: client,
      lastViewed: new Date(client.lastViewed)
    }));
    const peopleItems = recentPeople.map((person) => ({ 
      type: 'person' as const, 
      data: person,
      lastViewed: new Date(person.lastViewed)
    }));
    const projectItems = recentProjects.map((project) => ({ 
      type: 'project' as const, 
      data: project,
      lastViewed: new Date(project.lastViewed)
    }));

    switch (filter) {
      case 'clients':
        return clientItems;
      case 'people':
        return peopleItems;
      case 'projects':
        return projectItems;
      case 'all':
      default:
        // Combine all items and sort by lastViewed timestamp (most recent first)
        const allItems = [...clientItems, ...peopleItems, ...projectItems];
        return allItems.sort((a, b) => b.lastViewed.getTime() - a.lastViewed.getTime());
    }
  };

  const filteredItems = getFilteredItems();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-500" />
            Recently Viewed
          </CardTitle>
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-[130px] h-8" data-testid="filter-recently-viewed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="clients">Clients</SelectItem>
              <SelectItem value="people">People</SelectItem>
              <SelectItem value="projects">Projects</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Horizontal Scroll for all screen sizes */}
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="flex gap-3 min-w-max pb-2">
            {filteredItems.map((item) => {
              if (item.type === 'client') {
                const client = item.data as Client & { activeProjects: number; lastViewed: Date };
                return (
                  <div 
                    key={`client-${client.id}`} 
                    className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors w-[160px] flex-shrink-0"
                    onClick={() => window.location.href = `/clients/${client.id}`}
                    data-testid={`recent-client-${client.id}`}
                  >
                    <div className="flex flex-col gap-2">
                      <Building2 className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium line-clamp-2">{client.name}</span>
                      <span className="text-xs text-muted-foreground">{client.activeProjects} projects</span>
                    </div>
                  </div>
                );
              } else if (item.type === 'person') {
                const person = item.data as Person & { lastViewed: Date };
                return (
                  <div 
                    key={`person-${person.id}`} 
                    className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors w-[160px] flex-shrink-0"
                    onClick={() => window.location.href = `/person/${person.id}`}
                    data-testid={`recent-person-${person.id}`}
                  >
                    <div className="flex flex-col gap-2">
                      <Users className="w-5 h-5 text-purple-500" />
                      <span className="text-sm font-medium line-clamp-2">{person.firstName} {person.lastName}</span>
                      <span className="text-xs text-muted-foreground">{person.email || 'No email'}</span>
                    </div>
                  </div>
                );
              } else {
                const project = item.data as ProjectWithRelations;
                return (
                  <div 
                    key={`project-${project.id}`} 
                    className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors w-[160px] flex-shrink-0"
                    onClick={() => window.location.href = `/projects/${project.id}`}
                    data-testid={`recent-project-${project.id}`}
                  >
                    <div className="flex flex-col gap-2">
                      <FolderOpen className="w-5 h-5 text-violet-500" />
                      <span className="text-sm font-medium line-clamp-2">{project.client?.name}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">{(project as any).projectType?.name || "Unknown"}</span>
                    </div>
                  </div>
                );
              }
            })}
            {filteredItems.length === 0 && (
              <div className="w-full">
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MyProjectsPanel({ data }: { data?: DashboardStats }) {
  const myProjects = data?.myProjects || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-violet-500" />
          My Projects
        </CardTitle>
        <CardDescription>All projects you're involved in</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {myProjects.slice(0, 10).map((project) => (
            <div 
              key={project.id} 
              className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
              onClick={() => window.location.href = `/projects/${project.id}`}
              data-testid={`project-item-${project.id}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{project.client?.name}</span>
                <Badge variant="outline" className="text-xs">
                  {project.currentStatus?.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{(project as any).projectType?.name || "Unknown Project Type"}</p>
            </div>
          ))}
          {myProjects.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No projects assigned</p>
          )}
        </div>
        {myProjects.length > 10 && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-3"
            onClick={() => window.location.href = '/all-projects'}
            data-testid="button-view-all-projects"
          >
            View All {myProjects.length} Projects
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function BehindSchedulePanel({ data }: { data?: DashboardStats }) {
  const behindScheduleProjects = data?.behindScheduleProjects || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          Behind Schedule
        </CardTitle>
        <CardDescription>Projects stuck in current stage</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {behindScheduleProjects.slice(0, 5).map((project) => (
            <div 
              key={project.id} 
              className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30 cursor-pointer transition-colors"
              onClick={() => window.location.href = `/projects/${project.id}`}
              data-testid={`behind-schedule-project-${project.id}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{project.client?.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {project.currentStatus?.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{(project as any).projectType?.name || "Unknown Project Type"}</p>
              {project.chronology?.[0]?.timestamp && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  In stage for {Math.floor((Date.now() - new Date(project.chronology[0].timestamp).getTime()) / (1000 * 60 * 60 * 24))} days
                </p>
              )}
            </div>
          ))}
          {behindScheduleProjects.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">All projects on schedule</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


function MyDashboardPanel({ user }: { user: any }) {
  // State for selected dashboard
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>("default");

  // Fetch all saved dashboards
  const { data: dashboards = [], isLoading: dashboardsLoading } = useQuery<Dashboard[]>({
    queryKey: ["/api/dashboards"],
    enabled: !!user,
    retry: false,
  });

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<{
    myProjectsCount: number;
    myTasksCount: number;
    behindScheduleCount: number;
    lateCount: number;
  }>({
    queryKey: ["/api/dashboard/metrics"],
    enabled: !!user,
    retry: false,
  });

  // Fetch my projects (where user is service owner)
  const { data: myProjects = [], isLoading: myProjectsLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/dashboard/my-projects"],
    enabled: !!user,
    retry: false,
  });

  // Fetch my tasks (where user is current assignee)
  const { data: myTasks = [], isLoading: myTasksLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/dashboard/my-tasks"],
    enabled: !!user,
    retry: false,
  });

  // Get selected dashboard filters
  const selectedDashboard = dashboards.find(d => d.id === selectedDashboardId);
  const appliedFilters = useMemo(() => {
    if (!selectedDashboard || selectedDashboardId === "default") return null;
    
    const parsedFilters = typeof selectedDashboard.filters === 'string'
      ? JSON.parse(selectedDashboard.filters)
      : selectedDashboard.filters;
    
    // Parse date range strings to Date objects
    if (parsedFilters.customDateRange) {
      return {
        ...parsedFilters,
        customDateRange: {
          from: parsedFilters.customDateRange.from ? new Date(parsedFilters.customDateRange.from) : undefined,
          to: parsedFilters.customDateRange.to ? new Date(parsedFilters.customDateRange.to) : undefined,
        }
      };
    }
    
    return parsedFilters;
  }, [selectedDashboard, selectedDashboardId]);

  // Filter projects based on selected dashboard (comprehensive filtering)
  const applyDashboardFilters = (projects: ProjectWithRelations[]) => {
    if (!appliedFilters) return projects;

    return projects.filter((project) => {
      // Service filter (by service/project type)
      if (appliedFilters.serviceFilter && appliedFilters.serviceFilter !== "all") {
        if (project.projectTypeId !== appliedFilters.serviceFilter) return false;
      }

      // Service owner filter
      if (appliedFilters.serviceOwnerFilter && appliedFilters.serviceOwnerFilter !== "all") {
        if (project.projectOwnerId !== appliedFilters.serviceOwnerFilter) return false;
      }
      
      // Task assignee filter
      if (appliedFilters.taskAssigneeFilter && appliedFilters.taskAssigneeFilter !== "all") {
        if (project.currentAssigneeId !== appliedFilters.taskAssigneeFilter) return false;
      }

      // User filter (either owner or assignee)
      if (appliedFilters.userFilter && appliedFilters.userFilter !== "all") {
        const matchesOwner = project.projectOwnerId === appliedFilters.userFilter;
        const matchesAssignee = project.currentAssigneeId === appliedFilters.userFilter;
        if (!matchesOwner && !matchesAssignee) return false;
      }

      // Archive filter - check the archived flag, not deletedAt
      if (!appliedFilters.showArchived && project.archived) return false;

      // Dynamic date filter
      if (appliedFilters.dynamicDateFilter && appliedFilters.dynamicDateFilter !== "all") {
        const now = new Date();
        const projectDate = project.startDate ? new Date(project.startDate) : null;
        
        if (!projectDate) return false;

        switch (appliedFilters.dynamicDateFilter) {
          case "today":
            if (projectDate.toDateString() !== now.toDateString()) return false;
            break;
          case "yesterday":
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            if (projectDate.toDateString() !== yesterday.toDateString()) return false;
            break;
          case "this_week":
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            if (projectDate < weekStart) return false;
            break;
          case "last_week":
            const lastWeekStart = new Date(now);
            lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
            const lastWeekEnd = new Date(lastWeekStart);
            lastWeekEnd.setDate(lastWeekEnd.getDate() + 7);
            if (projectDate < lastWeekStart || projectDate >= lastWeekEnd) return false;
            break;
          case "this_month":
            if (projectDate.getMonth() !== now.getMonth() || projectDate.getFullYear() !== now.getFullYear()) return false;
            break;
          case "last_month":
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
            if (projectDate.getMonth() !== lastMonth.getMonth() || projectDate.getFullYear() !== lastMonth.getFullYear()) return false;
            break;
          case "this_year":
            if (projectDate.getFullYear() !== now.getFullYear()) return false;
            break;
          case "custom":
            if (appliedFilters.customDateRange) {
              const from = appliedFilters.customDateRange.from;
              const to = appliedFilters.customDateRange.to;
              if (from && projectDate < from) return false;
              if (to && projectDate > to) return false;
            }
            break;
        }
      }
      
      return true;
    });
  };

  const filteredMyProjects = useMemo(
    () => applyDashboardFilters(myProjects),
    [myProjects, appliedFilters]
  );

  const filteredMyTasks = useMemo(
    () => applyDashboardFilters(myTasks),
    [myTasks, appliedFilters]
  );

  // Recalculate metrics based on filtered data when dashboard is selected
  const displayMetrics = useMemo(() => {
    if (!appliedFilters || !metrics) return metrics;
    
    // When a dashboard filter is active, recalculate metrics from filtered data
    const allFilteredProjects = [...filteredMyProjects, ...filteredMyTasks];
    const uniqueFilteredProjects = Array.from(
      new Map(allFilteredProjects.map(p => [p.id, p])).values()
    );

    // Calculate behind schedule from filtered projects
    // Use a similar heuristic as backend: projects in current stage > 7 days
    const behindScheduleCount = uniqueFilteredProjects.filter(project => {
      // Skip archived, inactive, or completed projects
      if (project.archived || project.inactive || project.currentStatus === "completed") {
        return false;
      }

      const chronology = project.chronology || [];
      if (chronology.length === 0) return false;

      // Sort chronology by timestamp descending (most recent first) and find entry for current status
      const sortedChronology = [...chronology].sort((a, b) => 
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
      
      const lastEntry = sortedChronology.find(entry => entry.toStatus === project.currentStatus);
      if (!lastEntry || !lastEntry.timestamp) return false;

      // Consider projects stuck in a stage for more than 7 days as "behind schedule"
      const timeInCurrentStageMs = Date.now() - new Date(lastEntry.timestamp).getTime();
      const timeInCurrentStageDays = timeInCurrentStageMs / (1000 * 60 * 60 * 24);

      return timeInCurrentStageDays > 7;
    }).length;

    // Calculate late count from filtered projects (current date > due date)
    const now = new Date();
    const lateCount = uniqueFilteredProjects.filter(p => {
      // Skip archived, inactive, or completed projects
      if (p.archived || p.inactive || p.currentStatus === "completed") {
        return false;
      }
      if (!p.dueDate) return false;
      const dueDate = new Date(p.dueDate);
      return now > dueDate;
    }).length;

    return {
      myProjectsCount: filteredMyProjects.length,
      myTasksCount: filteredMyTasks.length,
      behindScheduleCount,
      lateCount,
    };
  }, [appliedFilters, metrics, filteredMyProjects, filteredMyTasks]);

  if (metricsLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Selector */}
      <div className="flex items-center gap-3">
        <Select 
          value={selectedDashboardId} 
          onValueChange={setSelectedDashboardId}
          data-testid="dashboard-selector"
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a dashboard view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default View</SelectItem>
            {dashboards.map((dashboard) => (
              <SelectItem key={dashboard.id} value={dashboard.id}>
                {dashboard.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset to Default Button - Only show when non-default dashboard is selected */}
        {selectedDashboardId !== "default" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDashboardId("default")}
            data-testid="button-reset-dashboard"
          >
            <Home className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* My Projects Count - Green */}
        <Card className="border-l-4 border-l-green-500" data-testid="card-my-projects">
          <CardHeader className="pb-2">
            <CardDescription>My Projects</CardDescription>
            <CardTitle className="text-3xl text-green-600 dark:text-green-500">
              {displayMetrics?.myProjectsCount || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Projects you own</p>
          </CardContent>
        </Card>

        {/* My Tasks Count - Blue */}
        <Card className="border-l-4 border-l-blue-500" data-testid="card-my-tasks">
          <CardHeader className="pb-2">
            <CardDescription>My Tasks</CardDescription>
            <CardTitle className="text-3xl text-blue-600 dark:text-blue-500">
              {displayMetrics?.myTasksCount || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Tasks assigned to you</p>
          </CardContent>
        </Card>

        {/* Behind Schedule Count - Orange */}
        <Card className="border-l-4 border-l-orange-500" data-testid="card-behind-schedule">
          <CardHeader className="pb-2">
            <CardDescription>Behind Schedule</CardDescription>
            <CardTitle className="text-3xl text-orange-600 dark:text-orange-500">
              {displayMetrics?.behindScheduleCount || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Projects over stage time limit</p>
          </CardContent>
        </Card>

        {/* Late Projects Count - Red */}
        <Card className="border-l-4 border-l-red-500" data-testid="card-late-projects">
          <CardHeader className="pb-2">
            <CardDescription>Late Projects</CardDescription>
            <CardTitle className="text-3xl text-red-600 dark:text-red-500">
              {displayMetrics?.lateCount || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Projects past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* My Projects Table */}
      <div data-testid="section-my-projects">
        <h2 className="text-2xl font-semibold mb-4">My Projects</h2>
        {myProjectsLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <TaskList projects={filteredMyProjects} user={user} viewType="my-projects" />
        )}
      </div>

      {/* My Tasks Table */}
      <div data-testid="section-my-tasks">
        <h2 className="text-2xl font-semibold mb-4">My Tasks</h2>
        {myTasksLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <TaskList projects={filteredMyTasks} user={user} viewType="my-tasks" />
        )}
      </div>
    </div>
  );
}
