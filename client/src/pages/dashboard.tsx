import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
// Navigation handled via window.location.href for reliability
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type ProjectWithRelations, type Client, type Person, type ProjectType } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Target,
  TrendingUp,
  AlertCircle,
  Bell,
  Filter
} from "lucide-react";

// Dashboard data interfaces
interface DashboardStats {
  myActiveTasks: ProjectWithRelations[];
  overdueItems: ProjectWithRelations[];
  recentClients: (Client & { activeProjects: number; lastContact: string })[];
  recentProjects: ProjectWithRelations[];
  projectsByType: { [key: string]: ProjectWithRelations[] };
  deadlineAlerts: any[];
  stuckProjects: ProjectWithRelations[];
  upcomingRenewals: any[];
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
          <div className="grid grid-cols-12 gap-6 h-full">
            
            {/* Left Column: My Active Work */}
            <div className="col-span-3 space-y-6">
              <MyActiveWorkPanel data={dashboardData} user={user} />
            </div>
            
            {/* Center Column: Recently Viewed & Projects Overview */}
            <div className="col-span-6 space-y-6">
              <RecentlyViewedPanel data={dashboardData} />
              <MyProjectsOverviewPanel 
                data={dashboardData} 
                selectedProjectType={selectedProjectType}
                onProjectTypeChange={setSelectedProjectType}
              />
            </div>
            
            {/* Right Column: Quick Access & Intelligence */}
            <div className="col-span-3 space-y-6">
              <QuickAccessPanel user={user} />
              <IntelligencePanel data={dashboardData} />
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
}

// Panel Components

function MyActiveWorkPanel({ data, user }: { data?: DashboardStats; user: any }) {
  const myTasks = data?.myActiveTasks || [];
  const overdueItems = data?.overdueItems || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            My Active Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Tasks Due Soon */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Tasks Due Soon</h4>
            <div className="space-y-2">
              {myTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{task.client?.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {task.currentStatus?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{(task as any).projectType?.name || "Unknown Project Type"}</p>
                </div>
              ))}
              {myTasks.length === 0 && (
                <p className="text-sm text-muted-foreground">No active tasks</p>
              )}
            </div>
          </div>

          {/* Overdue Items */}
          {overdueItems.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Overdue Items
              </h4>
              <div className="space-y-2">
                {overdueItems.slice(0, 2).map((item) => (
                  <div key={item.id} className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.client?.name}</span>
                      <Badge variant="destructive" className="text-xs">
                        Overdue
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{(item as any).projectType?.name || "Unknown Project Type"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

function RecentlyViewedPanel({ data }: { data?: DashboardStats }) {
  const recentClients = data?.recentClients || [];
  const recentProjects = data?.recentProjects || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-500" />
          Recently Viewed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          
          {/* Recent Clients */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Recent Clients</h4>
            <div className="space-y-3">
              {recentClients.slice(0, 3).map((client) => (
                <div key={client.id} className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">{client.name}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{client.activeProjects} active projects</span>
                    <span>{client.lastContact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Projects */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Recent Projects</h4>
            <div className="space-y-3">
              {recentProjects.slice(0, 3).map((project) => (
                <div key={project.id} className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
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
              ))}
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

function MyProjectsOverviewPanel({ 
  data, 
  selectedProjectType, 
  onProjectTypeChange 
}: { 
  data?: DashboardStats; 
  selectedProjectType: string;
  onProjectTypeChange: (type: string) => void;
}) {
  const projectsByType = data?.projectsByType || {};
  const projectTypes = Object.keys(projectsByType);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-violet-500" />
          My Projects Overview
        </CardTitle>
        <div className="flex gap-2 mt-3">
          <Button
            variant={selectedProjectType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => onProjectTypeChange("all")}
          >
            All Types
          </Button>
          {projectTypes.slice(0, 3).map((type) => (
            <Button
              key={type}
              variant={selectedProjectType === type ? "default" : "outline"}
              size="sm"
              onClick={() => onProjectTypeChange(type)}
              className="text-xs"
            >
              {type}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {selectedProjectType === "all" ? (
          <div className="space-y-4">
            {projectTypes.map((type) => (
              <div key={type} className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">{type}</h4>
                  <Badge variant="outline">{projectsByType[type]?.length || 0} projects</Badge>
                </div>
                <div className="flex gap-2">
                  {["no_latest_action", "bookkeeping_work_required", "in_review", "needs_client_input", "completed"].map((status) => {
                    const count = projectsByType[type]?.filter(p => p.currentStatus === status).length || 0;
                    return (
                      <div key={status} className="text-xs text-center">
                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center mb-1 text-xs font-medium">
                          {count}
                        </div>
                        <div className="text-muted-foreground">{status.replace(/_/g, ' ')}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(projectsByType[selectedProjectType] || []).map((project) => (
              <div key={project.id} className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{project.client?.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {project.currentStatus?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{project.description}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickAccessPanel({ user }: { user: any }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button 
          className="w-full justify-start" 
          variant="outline" 
          data-testid="button-create-monthly-bookkeeping"
          onClick={() => window.location.href = '/scheduled-services'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Monthly Bookkeeping
        </Button>
        <Button 
          className="w-full justify-start" 
          variant="outline" 
          data-testid="button-create-payroll"
          onClick={() => window.location.href = '/scheduled-services'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Payroll Project
        </Button>
        <Button 
          className="w-full justify-start" 
          variant="outline" 
          data-testid="button-create-tax-return"
          onClick={() => window.location.href = '/scheduled-services'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tax Return
        </Button>
        <hr className="my-3" />
        <Button 
          className="w-full justify-start" 
          variant="outline" 
          data-testid="button-view-all-projects"
          onClick={() => window.location.href = '/all-projects'}
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          View All Projects
        </Button>
        <Button 
          className="w-full justify-start" 
          variant="outline" 
          data-testid="button-view-clients"
          onClick={() => window.location.href = '/clients'}
        >
          <Building2 className="w-4 h-4 mr-2" />
          View All Clients
        </Button>
      </CardContent>
    </Card>
  );
}

function IntelligencePanel({ data }: { data?: DashboardStats }) {
  const deadlineAlerts = data?.deadlineAlerts || [];
  const stuckProjects = data?.stuckProjects || [];
  const upcomingRenewals = data?.upcomingRenewals || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          Intelligence Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Deadline Alerts */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Deadline Alerts
          </h4>
          {deadlineAlerts.length > 0 ? (
            <div className="space-y-2">
              {deadlineAlerts.slice(0, 2).map((alert, index) => (
                <div key={index} className="p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-700 dark:text-red-300">{alert.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No urgent deadlines</p>
          )}
        </div>

        {/* Stuck Projects */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Stuck Projects
          </h4>
          {stuckProjects.length > 0 ? (
            <div className="space-y-2">
              {stuckProjects.slice(0, 2).map((project) => (
                <div key={project.id} className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-800">
                  <p className="text-xs font-medium">{project.client?.name}</p>
                  <p className="text-xs text-muted-foreground">{(project as any).projectType?.name || "Unknown Project Type"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No stuck projects</p>
          )}
        </div>

        {/* Upcoming Renewals */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Service Renewals
          </h4>
          {upcomingRenewals.length > 0 ? (
            <div className="space-y-2">
              {upcomingRenewals.slice(0, 2).map((renewal, index) => (
                <div key={index} className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">{renewal.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No upcoming renewals</p>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
