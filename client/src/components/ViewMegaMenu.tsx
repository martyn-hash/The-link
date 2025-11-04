import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, Trash2, List, Columns3, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProjectView, Dashboard, UserProjectPreferences } from "@shared/schema";

interface ViewMegaMenuProps {
  currentViewMode: "list" | "kanban" | "dashboard";
  onLoadListView: (view: ProjectView) => void;
  onLoadKanbanView: (view: ProjectView) => void;
  onLoadDashboard: (dashboard: Dashboard) => void;
}

export default function ViewMegaMenu({
  currentViewMode,
  onLoadListView,
  onLoadKanbanView,
  onLoadDashboard,
}: ViewMegaMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { toast } = useToast();

  // Fetch all saved views
  const { data: savedViews = [] } = useQuery<ProjectView[]>({
    queryKey: ["/api/project-views"],
  });

  // Fetch all dashboards
  const { data: dashboards = [] } = useQuery<Dashboard[]>({
    queryKey: ["/api/dashboards"],
  });

  // Fetch user preferences to see which view is marked as default
  const { data: preferences } = useQuery<UserProjectPreferences>({
    queryKey: ["/api/user-project-preferences"],
  });

  // Separate views by type
  const listViews = savedViews.filter(v => v.viewMode === "list");
  const kanbanViews = savedViews.filter(v => v.viewMode === "kanban");

  // Set default view mutation
  const setDefaultViewMutation = useMutation({
    mutationFn: async (data: { viewType: "list" | "kanban" | "dashboard"; viewId?: string }) => {
      return apiRequest("POST", "/api/user-project-preferences", {
        defaultViewType: data.viewType,
        defaultViewId: data.viewId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-project-preferences"] });
      toast({
        title: "Default view updated",
        description: "This view will load automatically when you visit the projects page.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update default view",
        variant: "destructive",
      });
    },
  });

  // Delete view mutation
  const deleteViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      return apiRequest("DELETE", `/api/project-views/${viewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-views"] });
      toast({
        title: "View deleted",
        description: "The saved view has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete view",
        variant: "destructive",
      });
    },
  });

  // Delete dashboard mutation
  const deleteDashboardMutation = useMutation({
    mutationFn: async (dashboardId: string) => {
      return apiRequest("DELETE", `/api/dashboards/${dashboardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      toast({
        title: "Dashboard deleted",
        description: "The dashboard has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete dashboard",
        variant: "destructive",
      });
    },
  });

  const handleSetDefault = (viewType: "list" | "kanban" | "dashboard", viewId?: string) => {
    setDefaultViewMutation.mutate({ viewType, viewId });
  };

  const handleUnsetDefault = () => {
    // Delete the preference to unset default
    apiRequest("DELETE", "/api/user-project-preferences")
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/user-project-preferences"] });
        toast({
          title: "Default view cleared",
          description: "No default view will be loaded automatically.",
        });
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to clear default view",
          variant: "destructive",
        });
      });
  };

  const handleLoadView = (view: ProjectView) => {
    if (view.viewMode === "list") {
      onLoadListView(view);
    } else {
      onLoadKanbanView(view);
    }
    setMenuOpen(false);
  };

  const handleLoadDashboard = (dashboard: Dashboard) => {
    onLoadDashboard(dashboard);
    setMenuOpen(false);
  };

  const isViewDefault = (viewType: "list" | "kanban" | "dashboard", viewId: string) => {
    return preferences?.defaultViewType === viewType && preferences?.defaultViewId === viewId;
  };

  const hasAnyViews = listViews.length > 0 || kanbanViews.length > 0 || dashboards.length > 0;

  if (!hasAnyViews) {
    return null; // Don't show the menu if there are no saved views
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          data-testid="button-view-mega-menu"
          className="gap-2"
        >
          <LayoutDashboard className="h-4 w-4" />
          Saved Views
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[700px] p-0"
        onMouseLeave={() => setMenuOpen(false)}
      >
        <div className="grid grid-cols-3 divide-x">
          {/* Lists Column */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <List className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Lists</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {listViews.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {listViews.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No saved list views</p>
              ) : (
                listViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center gap-1 group hover:bg-accent rounded-sm p-1.5"
                  >
                    <button
                      onClick={() => handleLoadView(view)}
                      className="flex-1 text-left text-sm truncate hover:text-primary transition-colors"
                      data-testid={`button-load-list-view-${view.id}`}
                    >
                      {view.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isViewDefault("list", view.id)) {
                          handleUnsetDefault();
                        } else {
                          handleSetDefault("list", view.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-star-list-${view.id}`}
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${
                          isViewDefault("list", view.id)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground hover:text-yellow-400"
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteViewMutation.mutate(view.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-delete-list-${view.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Kanbans Column */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Columns3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Kanbans</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {kanbanViews.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {kanbanViews.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No saved kanban views</p>
              ) : (
                kanbanViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center gap-1 group hover:bg-accent rounded-sm p-1.5"
                  >
                    <button
                      onClick={() => handleLoadView(view)}
                      className="flex-1 text-left text-sm truncate hover:text-primary transition-colors"
                      data-testid={`button-load-kanban-view-${view.id}`}
                    >
                      {view.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isViewDefault("kanban", view.id)) {
                          handleUnsetDefault();
                        } else {
                          handleSetDefault("kanban", view.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-star-kanban-${view.id}`}
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${
                          isViewDefault("kanban", view.id)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground hover:text-yellow-400"
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteViewMutation.mutate(view.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-delete-kanban-${view.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dashboards Column */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Dashboards</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {dashboards.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {dashboards.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No saved dashboards</p>
              ) : (
                dashboards.map((dashboard) => (
                  <div
                    key={dashboard.id}
                    className="flex items-center gap-1 group hover:bg-accent rounded-sm p-1.5"
                  >
                    <button
                      onClick={() => handleLoadDashboard(dashboard)}
                      className="flex-1 text-left text-sm truncate hover:text-primary transition-colors"
                      data-testid={`button-load-dashboard-${dashboard.id}`}
                    >
                      {dashboard.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isViewDefault("dashboard", dashboard.id)) {
                          handleUnsetDefault();
                        } else {
                          handleSetDefault("dashboard", dashboard.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-star-dashboard-${dashboard.id}`}
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${
                          isViewDefault("dashboard", dashboard.id)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground hover:text-yellow-400"
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDashboardMutation.mutate(dashboard.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-delete-dashboard-${dashboard.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
