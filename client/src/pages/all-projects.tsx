import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type ProjectWithRelations, type User } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import KanbanBoard from "@/components/kanban-board";
import TaskList from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Columns3, List, Filter, Users, Calendar, Archive } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ViewMode = "kanban" | "list";

// Note: Using shared month normalization utility for consistent filtering

const STATUS_OPTIONS = [
  { value: "no_latest_action", label: "No Latest Action", assignedTo: "Client Manager" },
  { value: "bookkeeping_work_required", label: "Bookkeeping Work Required", assignedTo: "Bookkeeper" },
  { value: "in_review", label: "In Review", assignedTo: "Client Manager" },
  { value: "needs_client_input", label: "Needs Input from Client", assignedTo: "Client Manager" },
  { value: "completed", label: "Completed", assignedTo: "Project Status" },
];


export default function AllProjects() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [showArchived, setShowArchived] = useState<boolean>(false);

  const { data: projects, isLoading: projectsLoading, error } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/projects", { month: monthFilter || undefined, archived: showArchived }],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && !!user && (user.isAdmin || user.canSeeAdminMenu),
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

  // Access control - only admins and managers can view all projects
  const canViewAllProjects = user.isAdmin || user.canSeeAdminMenu;
  
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

  const filteredProjects = (projects || []).filter((project: ProjectWithRelations) => {
    // Status filter
    let statusMatch = true;
    switch (statusFilter) {
      case "overdue":
        // Simple overdue check - projects in same stage for more than 7 days
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

    // User filter (for admins/managers)
    let userMatch = true;
    if (userFilter !== "all") {
      userMatch = project.bookkeeperId === userFilter || 
                  project.clientManagerId === userFilter ||
                  project.currentAssigneeId === userFilter;
    }

    return statusMatch && userMatch;
  });



  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
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
              {/* Month Filter */}
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <Label htmlFor="month-filter-all" className="text-xs text-muted-foreground mb-1">Month</Label>
                  <Input
                    id="month-filter-all"
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="w-32 h-9"
                    data-testid="input-month-filter-all"
                  />
                </div>
              </div>

              {/* Archived Toggle */}
              <div className="flex items-center space-x-2">
                <Archive className="w-4 h-4 text-muted-foreground" />
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-archived-all"
                    checked={showArchived}
                    onCheckedChange={setShowArchived}
                    data-testid="switch-show-archived-all"
                  />
                  <Label htmlFor="show-archived-all" className="text-sm">
                    Show archived
                  </Label>
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
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

              {/* User Filter (for Admins/Managers) */}
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-48" data-testid="select-user-filter">
                    <SelectValue placeholder="Filter by user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {(users || []).map((u: User) => (
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

        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
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