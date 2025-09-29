import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { getCurrentMonthForFiltering, type ProjectWithRelations, type User } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import KanbanBoard from "@/components/kanban-board";
import TaskList from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Columns3, List, Filter, Folder, Clock, AlertTriangle, Calendar, Archive, Power, Eye, UserCheck, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ViewMode = "kanban" | "list";
type ViewScope = "all" | "my";

// Note: Using shared month normalization utility for consistent filtering

export default function Projects() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState<string>(getCurrentMonthForFiltering());
  const [showArchived, setShowArchived] = useState<boolean>(false);
  
  // New scope filter: For staff, default to "my", for managers default to "all"
  const [viewScope, setViewScope] = useState<ViewScope>(() => {
    // We'll set this properly once user is loaded
    return "all";
  });

  // Set initial view scope based on user role
  useEffect(() => {
    if (user && !user.isAdmin && !user.canSeeAdminMenu) {
      setViewScope("my");
    } else {
      setViewScope("all");
    }
  }, [user]);

  const { data: projects, isLoading: projectsLoading, error } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/projects", { month: monthFilter || undefined, archived: showArchived }],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && Boolean(user?.isAdmin || user?.canSeeAdminMenu),
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

  const isManagerOrAdmin = user.isAdmin || user.canSeeAdminMenu;

  const filteredProjects = (projects || []).filter((project: ProjectWithRelations) => {
    // Scope filter: Show user's assigned projects or all projects
    let scopeMatch = true;
    if (viewScope === "my") {
      scopeMatch = project.bookkeeperId === user.id || 
                   project.clientManagerId === user.id ||
                   project.currentAssigneeId === user.id;
    }

    // Status filter
    let statusMatch = true;
    switch (statusFilter) {
      case "overdue":
        const lastChronology = project.chronology?.[0];
        if (!lastChronology || !lastChronology.timestamp) {
          statusMatch = false;
          break;
        }
        const daysSinceLastChange = (Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        statusMatch = daysSinceLastChange > 7;
        break;
      case "in-review":
        statusMatch = project.currentStatus.toLowerCase().includes("review");
        break;
      case "completed":
        statusMatch = project.currentStatus.toLowerCase().includes("completed");
        break;
      default:
        statusMatch = true;
    }

    // User filter (only available for managers/admins when viewing all projects)
    let userMatch = true;
    if (userFilter !== "all" && viewScope === "all" && isManagerOrAdmin) {
      userMatch = project.bookkeeperId === userFilter || 
                  project.clientManagerId === userFilter ||
                  project.currentAssigneeId === userFilter;
    }

    return scopeMatch && statusMatch && userMatch;
  });

  const projectStats = projects && Array.isArray(projects) ? {
    total: projects.length,
    myAssignments: projects.filter((p: ProjectWithRelations) => 
      p.bookkeeperId === user.id || 
      p.clientManagerId === user.id || 
      p.currentAssigneeId === user.id
    ).length,
    urgent: projects.filter((p: ProjectWithRelations) => p.priority === "urgent").length,
    overdue: projects.filter((p: ProjectWithRelations) => {
      const lastChronology = p.chronology?.[0];
      if (!lastChronology || !lastChronology.timestamp) return false;
      const daysSinceLastChange = (Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastChange > 7;
    }).length,
  } : null;

  const getPageTitle = () => {
    if (viewScope === "my") {
      return "My Tasks";
    }
    return isManagerOrAdmin ? "All Projects" : "Projects";
  };

  const getPageDescription = () => {
    if (viewScope === "my") {
      return "Projects and tasks assigned to you";
    }
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
              <p className="text-sm text-muted-foreground">
                {getPageDescription()}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* View Scope Toggle (for managers/admins) */}
              {isManagerOrAdmin && (
                <div className="flex items-center bg-muted rounded-lg p-1">
                  <Button
                    variant={viewScope === "my" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewScope("my")}
                    className="px-3"
                    data-testid="button-my-tasks-scope"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    My Tasks
                  </Button>
                  <Button
                    variant={viewScope === "all" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewScope("all")}
                    className="px-3"
                    data-testid="button-all-projects-scope"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    All Projects
                  </Button>
                </div>
              )}

              {/* Month Filter */}
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <Label htmlFor="month-filter-projects" className="text-xs text-muted-foreground mb-1">Month</Label>
                  <Input
                    id="month-filter-projects"
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="w-32 h-9"
                    data-testid="input-month-filter-projects"
                  />
                </div>
              </div>

              {/* Archived Toggle */}
              <div className="flex items-center space-x-2">
                <Archive className="w-4 h-4 text-muted-foreground" />
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-archived-projects"
                    checked={showArchived}
                    onCheckedChange={setShowArchived}
                    data-testid="switch-show-archived-projects"
                  />
                  <Label htmlFor="show-archived-projects" className="text-sm">
                    Show archived
                  </Label>
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter-projects">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="in-review">In Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* User Filter (only for managers/admins viewing all projects) */}
              {isManagerOrAdmin && viewScope === "all" && (
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger className="w-48" data-testid="select-user-filter-projects">
                      <SelectValue placeholder="Filter by user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {(users || []).map((u: User) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email} 
                          ({u.isAdmin ? "Admin" : u.canSeeAdminMenu ? "Manager" : "User"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* View Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-1">
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  className="px-3"
                  data-testid="button-kanban-view-projects"
                >
                  <Columns3 className="w-4 h-4 mr-2" />
                  Kanban
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="px-3"
                  data-testid="button-list-view-projects"
                >
                  <List className="w-4 h-4 mr-2" />
                  List
                </Button>
              </div>
            </div>
          </div>

          {/* Project Stats */}
          {projectStats && (
            <div className="grid grid-cols-4 gap-4 mt-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Folder className="w-4 h-4 mr-2 text-primary" />
                    Total Projects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-projects">
                    {filteredProjects.length} / {projectStats.total}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-blue-600" />
                    My Assignments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="text-my-assignments">
                    {projectStats.myAssignments}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-red-600" />
                    Urgent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-urgent-projects">
                    {projectStats.urgent}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-orange-600" />
                    Overdue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600" data-testid="text-overdue-projects">
                    {projectStats.overdue}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
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
          ) : viewMode === "kanban" ? (
            <KanbanBoard projects={filteredProjects} user={user} />
          ) : (
            <TaskList projects={filteredProjects} user={user} />
          )}
        </main>
      </div>
    </div>
  );
}