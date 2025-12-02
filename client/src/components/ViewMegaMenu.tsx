import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Trash2, List, Columns3, LayoutDashboard, Calendar } from "lucide-react";
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
import { showFriendlyError } from "@/lib/friendlyErrors";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ProjectView } from "@shared/schema";
import type { Dashboard } from "@/pages/projects";

interface ViewMegaMenuProps {
  currentViewMode: "list" | "kanban" | "dashboard" | "calendar";
  onLoadListView: (view: ProjectView) => void;
  onLoadKanbanView: (view: ProjectView) => void;
  onLoadCalendarView: (view: ProjectView) => void;
  onLoadDashboard: (dashboard: Dashboard) => void;
  isMobileIconOnly?: boolean;
}

export default function ViewMegaMenu({
  currentViewMode,
  onLoadListView,
  onLoadKanbanView,
  onLoadCalendarView,
  onLoadDashboard,
  isMobileIconOnly = false,
}: ViewMegaMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch all saved views
  const { data: savedViews = [] } = useQuery<ProjectView[]>({
    queryKey: ["/api/project-views"],
  });

  // Fetch all dashboards
  const { data: dashboards = [] } = useQuery<Dashboard[]>({
    queryKey: ["/api/dashboards"],
  });

  // Separate views by type
  const listViews = savedViews.filter(v => v.viewMode === "list");
  const kanbanViews = savedViews.filter(v => v.viewMode === "kanban");
  const calendarViews = savedViews.filter(v => v.viewMode === "calendar");

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
    onError: (error) => {
      showFriendlyError({ error });
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
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const handleLoadView = (view: ProjectView) => {
    if (view.viewMode === "list") {
      onLoadListView(view);
    } else if (view.viewMode === "kanban") {
      onLoadKanbanView(view);
    } else if (view.viewMode === "calendar") {
      onLoadCalendarView(view);
    }
    setMenuOpen(false);
  };

  const handleLoadDashboard = (dashboard: Dashboard) => {
    onLoadDashboard(dashboard);
    setMenuOpen(false);
  };

  const hasAnyViews = listViews.length > 0 || kanbanViews.length > 0 || calendarViews.length > 0 || dashboards.length > 0;

  if (!hasAnyViews) {
    return null; // Don't show the menu if there are no saved views
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          data-testid="button-view-mega-menu"
          className={isMobileIconOnly ? "h-11 px-3" : "gap-2"}
        >
          <LayoutDashboard className="h-4 w-4" />
          {!isMobileIconOnly && <span>Saved Views</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={isMobile ? "w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto p-0" : "w-[900px] p-0"}
        onMouseLeave={() => !isMobile && setMenuOpen(false)}
      >
        <div className={isMobile ? "flex flex-col divide-y" : "grid grid-cols-4 divide-x"}>
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
                        deleteViewMutation.mutate(view.id);
                      }}
                      className={isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}
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
                        deleteViewMutation.mutate(view.id);
                      }}
                      className={isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}
                      data-testid={`button-delete-kanban-${view.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Calendars Column */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Calendars</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {calendarViews.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {calendarViews.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No saved calendar views</p>
              ) : (
                calendarViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center gap-1 group hover:bg-accent rounded-sm p-1.5"
                  >
                    <button
                      onClick={() => handleLoadView(view)}
                      className="flex-1 text-left text-sm truncate hover:text-primary transition-colors"
                      data-testid={`button-load-calendar-view-${view.id}`}
                    >
                      {view.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteViewMutation.mutate(view.id);
                      }}
                      className={isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}
                      data-testid={`button-delete-calendar-${view.id}`}
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
                        deleteDashboardMutation.mutate(dashboard.id);
                      }}
                      className={isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}
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
