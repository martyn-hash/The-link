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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Columns3, List, Filter, Archive, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ViewMode = "kanban" | "list";

// Note: Using shared month normalization utility for consistent filtering

export default function Projects() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");
  const [serviceOwnerFilter, setServiceOwnerFilter] = useState("all");

  // Reset to list view when no service is selected for kanban
  useEffect(() => {
    if (serviceFilter === "all" && viewMode === "kanban") {
      setViewMode("list");
    }
  }, [serviceFilter, viewMode]);
  const [userFilter, setUserFilter] = useState("all");
  const [showArchived, setShowArchived] = useState<boolean>(false);

  const { data: projects, isLoading: projectsLoading, error } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/projects", { archived: showArchived }],
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
    // Service filter using projectType and service data
    let serviceMatch = true;
    if (serviceFilter !== "all") {
      serviceMatch = project.projectType?.service?.name === serviceFilter;
    }

    // Task Assignee filter (using stageRoleAssignee)
    let taskAssigneeMatch = true;
    if (taskAssigneeFilter !== "all") {
      taskAssigneeMatch = project.stageRoleAssignee?.id === taskAssigneeFilter;
    }

    // Service Owner filter
    let serviceOwnerMatch = true;
    if (serviceOwnerFilter !== "all") {
      serviceOwnerMatch = project.projectOwnerId === serviceOwnerFilter;
    }

    // User filter (only available for managers/admins)
    let userMatch = true;
    if (userFilter !== "all" && isManagerOrAdmin) {
      userMatch = project.bookkeeperId === userFilter || 
                  project.clientManagerId === userFilter ||
                  project.currentAssigneeId === userFilter;
    }

    return serviceMatch && taskAssigneeMatch && serviceOwnerMatch && userMatch;
  });


  const getPageTitle = () => {
    return isManagerOrAdmin ? "All Projects" : "Projects";
  };

  const getPageDescription = () => {
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
            </div>
            
            <div className="flex items-center space-x-4">

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

              {/* Service Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="w-40" data-testid="select-service-filter-projects">
                    <SelectValue placeholder="Filter by service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    {Array.from(new Set((projects || []).map((p: ProjectWithRelations) => p.projectType?.service?.name).filter((s): s is string => Boolean(s)))).map((serviceName) => (
                      <SelectItem key={serviceName} value={serviceName}>
                        {serviceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Task Assignee Filter */}
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Select value={taskAssigneeFilter} onValueChange={setTaskAssigneeFilter}>
                  <SelectTrigger className="w-48" data-testid="select-task-assignee-filter-projects">
                    <SelectValue placeholder="Task Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Task Assignee</SelectItem>
                    {Array.from(new Map((projects || []).map((p: ProjectWithRelations) => p.stageRoleAssignee).filter((assignee): assignee is NonNullable<typeof assignee> => Boolean(assignee)).map(assignee => [assignee.id, assignee])).values()).map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>
                        {assignee.firstName && assignee.lastName ? `${assignee.firstName} ${assignee.lastName}` : assignee.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service Owner Filter */}
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Select value={serviceOwnerFilter} onValueChange={setServiceOwnerFilter}>
                  <SelectTrigger className="w-48" data-testid="select-service-owner-filter-projects">
                    <SelectValue placeholder="Filter by service owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Service Owners</SelectItem>
                    {Array.from(new Map((projects || []).map((p: ProjectWithRelations) => p.projectOwner).filter((owner): owner is NonNullable<typeof owner> => Boolean(owner)).map(owner => [owner.id, owner])).values()).map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : owner.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User Filter (only for managers/admins) */}
              {isManagerOrAdmin && (
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
            </div>
          </div>

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
            <KanbanBoard 
              projects={filteredProjects} 
              user={user}
              onSwitchToList={() => setViewMode("list")}
            />
          ) : (
            <TaskList 
              projects={filteredProjects} 
              user={user} 
              serviceFilter={serviceFilter}
              onSwitchToKanban={() => setViewMode("kanban")}
            />
          )}
        </main>
      </div>
    </div>
  );
}