import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/sidebar";
import KanbanBoard from "@/components/kanban-board";
import TaskList from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Columns3, List, Filter, Folder, Clock, AlertTriangle, Calendar, Archive } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ViewMode = "kanban" | "list";

// Helper function to get current month in DD/MM/YYYY format
const getCurrentMonth = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function Projects() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [filter, setFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState<string>(getCurrentMonth());
  const [showArchived, setShowArchived] = useState<boolean>(false);

  const { data: projects, isLoading: projectsLoading, error } = useQuery({
    queryKey: ["/api/projects", { month: monthFilter, archived: showArchived }],
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

  // Role-based access control
  const canViewMyProjects = user.role === 'client_manager' || user.role === 'bookkeeper';
  
  if (!canViewMyProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">This page is for bookkeepers and client managers only.</p>
        </div>
      </div>
    );
  }

  // Apply client-side filters (month and archived are handled server-side)
  const filteredProjects = projects ? projects.filter((project: any) => {
    switch (filter) {
      case "urgent":
        return project.priority === "urgent";
      case "overdue":
        // Simple overdue check - projects in same stage for more than 7 days
        const lastChronology = project.chronology?.[0];
        if (!lastChronology) return false;
        const daysSinceLastChange = (Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastChange > 7;
      case "my-assignments":
        return project.currentAssigneeId === user.id;
      case "pending-review":
        return project.currentStatus.toLowerCase().includes("review");
      case "in-progress":
        return !project.currentStatus.toLowerCase().includes("completed") && 
               !project.currentStatus.toLowerCase().includes("review");
      default:
        return true;
    }
  }) : [];

  const projectStats = projects ? {
    total: projects.length,
    myAssignments: projects.filter((p: any) => p.currentAssigneeId === user.id).length,
    urgent: projects.filter((p: any) => p.priority === "urgent").length,
    overdue: projects.filter((p: any) => {
      const lastChronology = p.chronology?.[0];
      if (!lastChronology) return false;
      const daysSinceLastChange = (Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastChange > 7;
    }).length,
  } : null;

  const getRoleSpecificTitle = () => {
    switch (user.role) {
      case 'bookkeeper':
        return 'My Bookkeeping Projects';
      case 'client_manager':
        return 'My Client Projects';
      default:
        return 'My Projects';
    }
  };

  const getRoleSpecificDescription = () => {
    switch (user.role) {
      case 'bookkeeper':
        return 'Projects assigned to you for bookkeeping work';
      case 'client_manager':
        return 'Projects you manage for clients';
      default:
        return 'Projects you are connected with';
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
                {getRoleSpecificTitle()}
              </h2>
              <p className="text-sm text-muted-foreground">
                {getRoleSpecificDescription()}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Month Filter */}
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <Label htmlFor="month-filter" className="text-xs text-muted-foreground mb-1">Month</Label>
                  <Input
                    id="month-filter"
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="w-32 h-9"
                    data-testid="input-month-filter"
                  />
                </div>
              </div>

              {/* Archived Toggle */}
              <div className="flex items-center space-x-2">
                <Archive className="w-4 h-4 text-muted-foreground" />
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-archived"
                    checked={showArchived}
                    onCheckedChange={setShowArchived}
                    data-testid="switch-show-archived"
                  />
                  <Label htmlFor="show-archived" className="text-sm">
                    Show archived
                  </Label>
                </div>
              </div>
              
              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-44" data-testid="select-filter">
                    <SelectValue placeholder="Filter projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    <SelectItem value="my-assignments">My Assignments</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="pending-review">Pending Review</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
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
        <main className="flex-1 overflow-auto">
          {projectsLoading ? (
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