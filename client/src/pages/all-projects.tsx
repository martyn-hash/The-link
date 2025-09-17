import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/sidebar";
import KanbanBoard from "@/components/kanban-board";
import TaskList from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Columns3, List, Filter, Users, Folder } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ViewMode = "kanban" | "list";

export default function AllProjects() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  const { data: projects, isLoading: projectsLoading, error } = useQuery({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && !!user && (user.role === 'admin' || user.role === 'manager'),
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

  // Role-based access control
  const canViewAllProjects = user.role === 'admin' || user.role === 'manager';
  
  if (!canViewAllProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin or manager privileges to access all projects.</p>
        </div>
      </div>
    );
  }

  const filteredProjects = projects ? projects.filter((project: any) => {
    // Status filter
    let statusMatch = true;
    switch (statusFilter) {
      case "urgent":
        statusMatch = project.priority === "urgent";
        break;
      case "overdue":
        // Simple overdue check - projects in same stage for more than 7 days
        const lastChronology = project.chronology?.[0];
        if (!lastChronology) {
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

    // User filter (for admins/managers)
    let userMatch = true;
    if (userFilter !== "all") {
      userMatch = project.bookkeeperId === userFilter || 
                  project.clientManagerId === userFilter ||
                  project.currentAssigneeId === userFilter;
    }

    return statusMatch && userMatch;
  }) : [];

  const projectStats = projects ? {
    total: projects.length,
    urgent: projects.filter((p: any) => p.priority === "urgent").length,
    overdue: projects.filter((p: any) => {
      const lastChronology = p.chronology?.[0];
      if (!lastChronology) return false;
      const daysSinceLastChange = (Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastChange > 7;
    }).length,
    active: projects.filter((p: any) => !p.currentStatus.toLowerCase().includes("completed")).length,
  } : null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
                All Projects
              </h2>
              <p className="text-sm text-muted-foreground">
                Complete overview of all projects across the organization
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="in-review">In Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* User Filter (for Admins/Managers) */}
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-48" data-testid="select-user-filter">
                    <SelectValue placeholder="Filter by user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users && users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email} 
                        ({u.role.replace('_', ' ')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* View Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-1">
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  className="px-3"
                  data-testid="button-kanban-view"
                >
                  <Columns3 className="w-4 h-4 mr-2" />
                  Kanban
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="px-3"
                  data-testid="button-list-view"
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
                  <CardTitle className="text-sm font-medium">
                    Urgent Priority
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
                  <CardTitle className="text-sm font-medium">
                    Overdue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600" data-testid="text-overdue-projects">
                    {projectStats.overdue}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-active-projects">
                    {projectStats.active}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {projectsLoading || usersLoading ? (
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