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
import MiniProjectsTable from "@/components/mini-projects-table";
import DataViewSelector from "@/components/data-view-selector";
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

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    enabled: isAuthenticated && !!user,
    retry: false,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
  });

  // Fetch homescreen dashboard
  const { data: homescreenDashboard, isLoading: homescreenLoading, error: homescreenError } = useQuery<Dashboard>({
    queryKey: ["/api/dashboards/homescreen"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  // Memoize homescreen dashboard filters to prevent unnecessary re-renders
  const homescreenFilters = useMemo(() => {
    if (!homescreenDashboard) return null;
    
    const parsedFilters = typeof homescreenDashboard.filters === 'string'
      ? JSON.parse(homescreenDashboard.filters)
      : homescreenDashboard.filters;
    
    return {
      serviceFilter: parsedFilters.serviceFilter || "all",
      taskAssigneeFilter: parsedFilters.taskAssigneeFilter || "all",
      serviceOwnerFilter: parsedFilters.serviceOwnerFilter || "all",
      userFilter: parsedFilters.userFilter || "all",
      showArchived: parsedFilters.showArchived || false,
      dynamicDateFilter: parsedFilters.dynamicDateFilter || "all",
      customDateRange: {
        from: parsedFilters.customDateRange?.from ? new Date(parsedFilters.customDateRange.from) : undefined,
        to: parsedFilters.customDateRange?.to ? new Date(parsedFilters.customDateRange.to) : undefined,
      },
    };
  }, [homescreenDashboard]);

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

            {/* My Dashboard - Default View */}
            <MyDashboardPanel user={user} />
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
  const [loadedFilters, setLoadedFilters] = useState<any>(null);
  const { toast } = useToast();
  
  // Fetch all projects for the current user
  const { data: allProjects = [], isLoading: projectsLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
    retry: false,
  });

  // Filter to only projects where user is involved
  const userProjects = useMemo(() => {
    return allProjects.filter(project => {
      return (
        project.currentAssigneeId === user.id ||
        project.clientManagerId === user.id ||
        project.bookkeeperId === user.id ||
        project.projectOwnerId === user.id
      );
    });
  }, [allProjects, user.id]);

  const handleLoadView = (view: any) => {
    // Parse and apply the saved view filters to the mini table
    const filters = typeof view.filters === 'string' 
      ? JSON.parse(view.filters) 
      : view.filters as any;
    
    setLoadedFilters(filters);
    toast({
      title: "View Loaded",
      description: `Applied filters from "${view.name}"`,
    });
  };

  const handleLoadDashboard = (dashboard: any) => {
    // For dashboards, we can either navigate or just show a message
    // Since dashboards have widgets that can't be shown in the mini table,
    // we'll show a helpful message suggesting to visit the projects page
    toast({
      title: "Dashboard Selected",
      description: `"${dashboard.name}" contains custom widgets. Visit the Projects page to view the full dashboard.`,
      action: (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => window.location.href = '/projects'}
        >
          Go to Projects
        </Button>
      ),
    });
  };

  if (projectsLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mini Projects Table */}
      <MiniProjectsTable 
        projects={userProjects} 
        user={user}
        externalFilters={loadedFilters}
      />

      {/* Data View Selector */}
      <DataViewSelector 
        onLoadView={handleLoadView}
        onLoadDashboard={handleLoadDashboard}
      />
    </div>
  );
}
