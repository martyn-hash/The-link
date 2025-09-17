import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/sidebar";
import KanbanBoard from "@/components/kanban-board";
import TaskList from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Columns3, List, Filter, Users, Clock, User as UserIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { formatDistanceToNow } from "date-fns";

type ViewMode = "kanban" | "list";

export default function AllProjects() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

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

  // Find selected project from filtered projects
  const selectedProject = selectedProjectId ? filteredProjects.find(p => p.id === selectedProjectId) : null;

  // Clear selection if project is no longer in filtered results
  useEffect(() => {
    if (selectedProjectId && !filteredProjects.some(p => p.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [selectedProjectId, filteredProjects]);


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
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={60} minSize={40} data-testid="pane-left">
                <TaskList 
                  projects={filteredProjects} 
                  user={user} 
                  selectedProjectId={selectedProjectId}
                  onSelectProject={setSelectedProjectId}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={40} minSize={30} data-testid="pane-right">
                <div className="h-full p-6 bg-muted/20" data-testid="chronology-panel">
                  {selectedProject ? (
                    <div className="h-full flex flex-col">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold">{selectedProject.client.name}</h3>
                        <p className="text-sm text-muted-foreground">{selectedProject.description}</p>
                      </div>
                      
                      <div className="flex-1 overflow-auto">
                        <h4 className="text-sm font-medium mb-3 flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          Project Timeline
                        </h4>
                        
                        {selectedProject.chronology && selectedProject.chronology.length > 0 ? (
                          <div className="space-y-3">
                            {[...selectedProject.chronology]
                              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                              .map((entry, index) => (
                                <div key={index} className="border-l-2 border-primary/20 pl-4 pb-3">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <div className="w-2 h-2 bg-primary rounded-full -ml-5 border-2 border-background"></div>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                                    </span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium">Status: </span>
                                    {entry.status || entry.action || 'Status changed'}
                                  </div>
                                  {entry.notes && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {entry.notes}
                                    </div>
                                  )}
                                  {entry.assignedTo && (
                                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                                      <UserIcon className="w-3 h-3 mr-1" />
                                      {entry.assignedTo}
                                    </div>
                                  )}
                                </div>
                              ))
                            }
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground py-8">
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No timeline entries yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center" data-testid="chronology-empty-state">
                      <div className="text-center text-muted-foreground">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">Select a project</h3>
                        <p className="text-sm">Click on any project row to view its chronology and timeline</p>
                      </div>
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </main>
      </div>
    </div>
  );
}