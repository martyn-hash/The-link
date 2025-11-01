import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type ProjectWithRelations, type Client, type Person, type ProjectType, type Service, type KanbanStage, type User } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import DashboardBuilder from "@/components/dashboard-builder";
import TaskList from "@/components/task-list";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Home,
  Eye
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

  // Fetch dashboard cache (lightweight statistics)
  const { data: dashboardCache, isLoading: cacheLoading, refetch: refetchCache } = useQuery<{
    myTasksCount: number;
    myProjectsCount: number;
    overdueTasksCount: number;
    behindScheduleCount: number;
    lastUpdated: string;
  }>({
    queryKey: ["/api/dashboard/cache"],
    enabled: isAuthenticated && !!user,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache is pre-computed
  });

  // Manual refresh mutation
  const refreshCacheMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/dashboard/cache/refresh");
    },
    onSuccess: () => {
      refetchCache();
      toast({
        title: "Success",
        description: "Dashboard refreshed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh dashboard",
        variant: "destructive",
      });
    },
  });

  // Fetch dashboard data (only for recently viewed)
  const { data: dashboardData, isLoading: dashboardLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    enabled: isAuthenticated && !!user,
    retry: false,
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch my owned projects (service owner)
  const { data: myOwnedProjects, isLoading: ownedProjectsLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/dashboard/my-owned-projects"],
    enabled: isAuthenticated && !!user,
    retry: false,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Fetch my assigned tasks (current assignee)
  const { data: myAssignedTasks, isLoading: assignedTasksLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/dashboard/my-assigned-tasks"],
    enabled: isAuthenticated && !!user,
    retry: false,
    staleTime: 30000,
    refetchInterval: 30000,
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

  const isAnyLoading = dashboardLoading || ownedProjectsLoading || assignedTasksLoading || cacheLoading;

  if (isAnyLoading && !dashboardData) {
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

            {/* Dashboard Summary Cards */}
            {dashboardCache && (
              <DashboardSummaryCards 
                cache={dashboardCache} 
                onRefresh={() => refreshCacheMutation.mutate()}
                isRefreshing={refreshCacheMutation.isPending}
              />
            )}

            {/* My Tasks (Current Assignee) */}
            {myAssignedTasks && myAssignedTasks.length > 0 && (
              <MyTasksPanel tasks={myAssignedTasks} />
            )}

            {/* My Projects (Service Owner) */}
            {myOwnedProjects && myOwnedProjects.length > 0 && (
              <MyProjectsPanel projects={myOwnedProjects} />
            )}
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

function DashboardSummaryCards({ 
  cache, 
  onRefresh, 
  isRefreshing 
}: { 
  cache: {
    myTasksCount: number;
    myProjectsCount: number;
    overdueTasksCount: number;
    behindScheduleCount: number;
    lastUpdated: string;
  };
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const summaryCards = [
    {
      title: "My Tasks",
      count: cache.myTasksCount,
      icon: CheckCircle2,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      testId: "card-my-tasks"
    },
    {
      title: "My Projects",
      count: cache.myProjectsCount,
      icon: FolderOpen,
      color: "text-violet-500",
      bgColor: "bg-violet-50 dark:bg-violet-950/20",
      testId: "card-my-projects"
    },
    {
      title: "Overdue Tasks",
      count: cache.overdueTasksCount,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      testId: "card-overdue-tasks"
    },
    {
      title: "Behind Schedule",
      count: cache.behindScheduleCount,
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      testId: "card-behind-schedule"
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dashboard Overview</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground" data-testid="text-last-updated">
            Updated {formatLastUpdated(cache.lastUpdated)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-dashboard"
          >
            {isRefreshing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                Refreshing...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="relative overflow-hidden" data-testid={card.testId}>
              <CardHeader className={`pb-2 ${card.bgColor}`}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className={`text-3xl font-bold ${card.color}`} data-testid={`count-${card.testId}`}>
                  {card.count}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MyTasksPanel({ tasks }: { tasks: ProjectWithRelations[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");
  const [serviceOwnerFilter, setServiceOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dynamicDateFilter, setDynamicDateFilter] = useState<"all" | "overdue" | "today" | "next7days" | "next14days" | "next30days">("all");
  
  const itemsPerPage = 6;
  
  // Get unique services, assignees, owners, and statuses from tasks using Maps for proper deduplication
  const servicesMap = new Map<string, { id: string; name: string }>();
  tasks.forEach(t => {
    const pt = (t as any).projectType;
    if (pt && pt.id) servicesMap.set(pt.id, { id: pt.id, name: pt.name });
  });
  const services = Array.from(servicesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  
  const assigneesMap = new Map<string, User>();
  tasks.forEach(t => {
    if (t.currentAssignee && t.currentAssignee.id) {
      assigneesMap.set(t.currentAssignee.id, t.currentAssignee);
    }
  });
  const assignees = Array.from(assigneesMap.values()).sort((a, b) => 
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  );
  
  const ownersMap = new Map<string, User>();
  tasks.forEach(t => {
    if (t.projectOwner && t.projectOwner.id) {
      ownersMap.set(t.projectOwner.id, t.projectOwner);
    }
  });
  const owners = Array.from(ownersMap.values()).sort((a, b) => 
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  );
  
  const statuses = Array.from(new Set(tasks.map(t => t.currentStatus).filter(Boolean))).sort();
  
  // Apply filters
  const filteredTasks = tasks.filter(task => {
    if (serviceFilter !== "all" && (task as any).projectType?.id !== serviceFilter) return false;
    if (taskAssigneeFilter !== "all" && task.currentAssignee?.id !== taskAssigneeFilter) return false;
    if (serviceOwnerFilter !== "all" && task.projectOwner?.id !== serviceOwnerFilter) return false;
    if (statusFilter !== "all" && task.currentStatus !== statusFilter) return false;
    
    // Date filters
    if (dynamicDateFilter !== "all" && task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (dynamicDateFilter) {
        case "overdue":
          if (dueDate >= today) return false;
          break;
        case "today":
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (dueDate < today || dueDate >= tomorrow) return false;
          break;
        case "next7days":
          const next7 = new Date(today);
          next7.setDate(next7.getDate() + 7);
          if (dueDate < today || dueDate >= next7) return false;
          break;
        case "next14days":
          const next14 = new Date(today);
          next14.setDate(next14.getDate() + 14);
          if (dueDate < today || dueDate >= next14) return false;
          break;
        case "next30days":
          const next30 = new Date(today);
          next30.setDate(next30.getDate() + 30);
          if (dueDate < today || dueDate >= next30) return false;
          break;
      }
    }
    
    return true;
  });
  
  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [serviceFilter, taskAssigneeFilter, serviceOwnerFilter, statusFilter, dynamicDateFilter]);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
              My Tasks
            </CardTitle>
            <CardDescription>Projects where you're the current assignee</CardDescription>
          </div>
          <Badge variant="secondary" data-testid="badge-my-tasks-count">{filteredTasks.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Service</Label>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger data-testid="select-my-tasks-service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {services.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-my-tasks-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map(s => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Due Date</Label>
            <Select value={dynamicDateFilter} onValueChange={(v: any) => setDynamicDateFilter(v)}>
              <SelectTrigger data-testid="select-my-tasks-date">
                <SelectValue />
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
        </div>
        
        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No tasks found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTasks.map(task => (
                  <MyTaskRow key={task.id} task={task} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="button-my-tasks-prev-page"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-my-tasks-next-page"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MyTaskRow({ task }: { task: ProjectWithRelations }) {
  const navigate = useLocation()[1];
  
  return (
    <TableRow data-testid={`row-my-task-${task.id}`}>
      <TableCell className="font-medium">
        <span data-testid={`text-client-${task.id}`}>
          {task.client?.name || '-'}
        </span>
      </TableCell>
      
      <TableCell>
        <span className="text-sm" data-testid={`text-service-${task.id}`}>
          {(task as any).projectType?.name || '-'}
        </span>
      </TableCell>
      
      <TableCell>
        <Badge variant="outline" className="text-xs" data-testid={`badge-status-${task.id}`}>
          {task.currentStatus?.replace(/_/g, ' ') || '-'}
        </Badge>
      </TableCell>
      
      <TableCell>
        <span className="text-sm" data-testid={`text-due-date-${task.id}`}>
          {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
        </span>
      </TableCell>
      
      <TableCell className="text-right">
        <Button
          variant="default"
          size="sm"
          onClick={() => navigate(`/projects/${task.id}`)}
          data-testid={`button-view-${task.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AttentionNeededPanel({ data }: { 
  data: {
    overdueProjects: ProjectWithRelations[];
    behindScheduleProjects: ProjectWithRelations[];
    attentionNeeded: ProjectWithRelations[];
  } 
}) {
  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardHeader className="pb-3 bg-orange-50/50 dark:bg-orange-950/20">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Attention Needed
            </CardTitle>
            <CardDescription>Overdue or behind schedule projects</CardDescription>
          </div>
          <Badge variant="destructive">{data.attentionNeeded.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {data.attentionNeeded.slice(0, 8).map((project) => {
            const isOverdue = data.overdueProjects.some(p => p.id === project.id);
            const isBehindSchedule = data.behindScheduleProjects.some(p => p.id === project.id);
            
            return (
              <div 
                key={project.id} 
                className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/30 cursor-pointer transition-colors"
                onClick={() => window.location.href = `/projects/${project.id}`}
                data-testid={`attention-needed-project-${project.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{project.client?.name}</span>
                  <div className="flex gap-1">
                    {isOverdue && (
                      <Badge variant="destructive" className="text-xs">
                        Overdue
                      </Badge>
                    )}
                    {isBehindSchedule && (
                      <Badge variant="secondary" className="text-xs">
                        Behind Schedule
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{(project as any).projectType?.name || "Unknown Project Type"}</p>
                {project.dueDate && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    {isOverdue ? 'Was due:' : 'Due:'} {new Date(project.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
          {data.attentionNeeded.length > 8 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-2 border-orange-200 dark:border-orange-800"
              onClick={() => window.location.href = '/all-projects'}
              data-testid="button-view-all-attention-needed"
            >
              View All {data.attentionNeeded.length} Projects
            </Button>
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

function MyProjectsPanel({ projects }: { projects: ProjectWithRelations[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dynamicDateFilter, setDynamicDateFilter] = useState<"all" | "overdue" | "today" | "next7days" | "next14days" | "next30days">("all");
  
  const itemsPerPage = 6;
  
  // Get unique services and statuses from projects using Maps for proper deduplication
  const servicesMap = new Map<string, { id: string; name: string }>();
  projects.forEach(p => {
    const pt = (p as any).projectType;
    if (pt && pt.id) servicesMap.set(pt.id, { id: pt.id, name: pt.name });
  });
  const services = Array.from(servicesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  
  const statuses = Array.from(new Set(projects.map(p => p.currentStatus).filter(Boolean))).sort();
  
  // Apply filters
  const filteredProjects = projects.filter(project => {
    if (serviceFilter !== "all" && (project as any).projectType?.id !== serviceFilter) return false;
    if (statusFilter !== "all" && project.currentStatus !== statusFilter) return false;
    
    // Date filters
    if (dynamicDateFilter !== "all" && project.dueDate) {
      const dueDate = new Date(project.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (dynamicDateFilter) {
        case "overdue":
          if (dueDate >= today) return false;
          break;
        case "today":
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (dueDate < today || dueDate >= tomorrow) return false;
          break;
        case "next7days":
          const next7 = new Date(today);
          next7.setDate(next7.getDate() + 7);
          if (dueDate < today || dueDate >= next7) return false;
          break;
        case "next14days":
          const next14 = new Date(today);
          next14.setDate(next14.getDate() + 14);
          if (dueDate < today || dueDate >= next14) return false;
          break;
        case "next30days":
          const next30 = new Date(today);
          next30.setDate(next30.getDate() + 30);
          if (dueDate < today || dueDate >= next30) return false;
          break;
      }
    }
    
    return true;
  });
  
  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [serviceFilter, statusFilter, dynamicDateFilter]);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-violet-500" />
              My Projects
            </CardTitle>
            <CardDescription>Projects where you're the service owner</CardDescription>
          </div>
          <Badge variant="secondary" data-testid="badge-my-projects-count">{filteredProjects.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Service</Label>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger data-testid="select-my-projects-service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {services.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-my-projects-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map(s => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Due Date</Label>
            <Select value={dynamicDateFilter} onValueChange={(v: any) => setDynamicDateFilter(v)}>
              <SelectTrigger data-testid="select-my-projects-date">
                <SelectValue />
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
        </div>
        
        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProjects.map(project => (
                  <MyProjectRow key={project.id} project={project} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="button-my-projects-prev-page"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-my-projects-next-page"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MyProjectRow({ project }: { project: ProjectWithRelations }) {
  const navigate = useLocation()[1];
  
  return (
    <TableRow data-testid={`row-my-project-${project.id}`}>
      <TableCell className="font-medium">
        <span data-testid={`text-client-${project.id}`}>
          {project.client?.name || '-'}
        </span>
      </TableCell>
      
      <TableCell>
        <span className="text-sm" data-testid={`text-service-${project.id}`}>
          {(project as any).projectType?.name || '-'}
        </span>
      </TableCell>
      
      <TableCell>
        <Badge variant="outline" className="text-xs" data-testid={`badge-status-${project.id}`}>
          {project.currentStatus?.replace(/_/g, ' ') || '-'}
        </Badge>
      </TableCell>
      
      <TableCell>
        <span className="text-sm" data-testid={`text-due-date-${project.id}`}>
          {project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
        </span>
      </TableCell>
      
      <TableCell className="text-right">
        <Button
          variant="default"
          size="sm"
          onClick={() => navigate(`/projects/${project.id}`)}
          data-testid={`button-view-${project.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      </TableCell>
    </TableRow>
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
        const projectDate = project.createdAt ? new Date(project.createdAt) : null;
        
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
