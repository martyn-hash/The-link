import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type ProjectWithRelations } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import KanbanBoard from "@/components/kanban-board";
import TaskList from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Columns3, List, Filter, Archive } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ViewMode = "kanban" | "list";

export default function Dashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [filter, setFilter] = useState("all");
  const [showArchived, setShowArchived] = useState<boolean>(false);

  const { data: projects, isLoading: projectsLoading, error } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/projects", { archived: showArchived }],
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

  const filteredProjects = projects ? projects.filter((project: ProjectWithRelations) => {
    switch (filter) {
      case "urgent":
        return project.priority === "urgent";
      case "overdue":
        // Simple overdue check - projects in same stage for more than 7 days
        const lastChronology = project.chronology?.[0];
        if (!lastChronology || !lastChronology.timestamp) return false;
        const daysSinceLastChange = (Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastChange > 7;
      case "my-assignments":
        return project.currentAssigneeId === user.id;
      default:
        return true;
    }
  }) : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
                {viewMode === "kanban" ? "Project Kanban Board" : "Task List"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage your bookkeeping projects workflow
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-40" data-testid="select-filter">
                    <SelectValue placeholder="Filter projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="my-assignments">My Assignments</SelectItem>
                  </SelectContent>
                </Select>
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
              
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                <i className="fas fa-bell w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                  3
                </span>
              </Button>
            </div>
          </div>
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
