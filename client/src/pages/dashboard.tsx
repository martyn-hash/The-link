import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
// Navigation handled via window.location.href for reliability
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type ProjectWithRelations, type Client, type Person, type ProjectType, type Service, type KanbanStage } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import DashboardBuilder from "@/components/dashboard-builder";
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
  recentProjects: ProjectWithRelations[];
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

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  // Fetch homescreen dashboard
  const { data: homescreenDashboard, isLoading: homescreenLoading, error: homescreenError } = useQuery<Dashboard>({
    queryKey: ["/api/dashboards/homescreen"],
    enabled: isAuthenticated && !!user,
    retry: false,
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
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
                My Dashboard
              </h2>
              <p className="text-sm text-muted-foreground">
                Your personalized view of active work and important updates
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Quick Actions */}
              <Button 
                className="bg-primary hover:bg-primary/90" 
                data-testid="button-create-project"
                onClick={() => window.location.href = '/scheduled-services'}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
              
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                  {dashboardData?.deadlineAlerts?.length || 0}
                </span>
              </Button>
            </div>
          </div>
        </header>
        
        {/* Main Dashboard Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Recently Viewed */}
            <RecentlyViewedPanel data={dashboardData} />

            {/* Homescreen Dashboard Section */}
            <div data-testid="homescreen-dashboard-section">
              {homescreenLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                    <p className="text-muted-foreground">Loading homescreen dashboard...</p>
                  </div>
                </CardContent>
              </Card>
            ) : homescreenDashboard ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Home className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-semibold" data-testid="text-homescreen-dashboard-name">
                    {homescreenDashboard.name}
                  </h3>
                  {homescreenDashboard.description && (
                    <p className="text-sm text-muted-foreground">- {homescreenDashboard.description}</p>
                  )}
                </div>
                <DashboardBuilder
                  filters={(() => {
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
                  })()}
                  widgets={homescreenDashboard.widgets || []}
                  editMode={false}
                  currentDashboard={homescreenDashboard}
                />
              </div>
            ) : (
              <Card>
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <CardTitle data-testid="text-no-homescreen">No homescreen dashboard set</CardTitle>
                  <CardDescription>
                    Set a dashboard as your homescreen in the Projects page
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <Button
                    onClick={() => window.location.href = '/projects'}
                    data-testid="button-go-to-projects"
                  >
                    Go to Projects
                  </Button>
                </CardContent>
              </Card>
            )}
            </div>
          </div>
        </main>
      </div>
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
  const recentClients = data?.recentClients || [];
  const recentProjects = data?.recentProjects || [];

  // Combine and limit to 6 items total
  const combinedItems = [
    ...recentClients.map((client) => ({ type: 'client' as const, data: client })),
    ...recentProjects.map((project) => ({ type: 'project' as const, data: project }))
  ].slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-500" />
          Recently Viewed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          {combinedItems.map((item, index) => {
            if (item.type === 'client') {
              const client = item.data as Client & { activeProjects: number; lastViewed: Date };
              return (
                <div 
                  key={`client-${client.id}`} 
                  className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => window.location.href = `/clients/${client.id}`}
                  data-testid={`recent-client-${client.id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">{client.name}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{client.activeProjects} active projects</span>
                    <span>{new Date(client.lastViewed).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            } else {
              const project = item.data as ProjectWithRelations;
              return (
                <div 
                  key={`project-${project.id}`} 
                  className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => window.location.href = `/projects/${project.id}`}
                  data-testid={`recent-project-${project.id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FolderOpen className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-medium">{project.client?.name}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{(project as any).projectType?.name || "Unknown Project Type"}</span>
                    <Badge variant="outline" className="text-xs">
                      {project.currentStatus?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              );
            }
          })}
          {combinedItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          )}
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
