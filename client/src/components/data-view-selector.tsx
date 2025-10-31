import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutDashboard, Filter as FilterIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ProjectView {
  id: string;
  userId: string;
  name: string;
  filters: any;
  createdAt: string;
  updatedAt: string;
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

interface DataViewSelectorProps {
  onLoadView?: (view: ProjectView) => void;
  onLoadDashboard?: (dashboard: Dashboard) => void;
}

export default function DataViewSelector({ onLoadView, onLoadDashboard }: DataViewSelectorProps) {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<"view" | "dashboard" | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  // Fetch saved project views
  const { data: savedViews = [], isLoading: viewsLoading } = useQuery<ProjectView[]>({
    queryKey: ["/api/project-views"],
    enabled: !!user,
    retry: false,
  });

  // Fetch saved dashboards
  const { data: dashboards = [], isLoading: dashboardsLoading } = useQuery<Dashboard[]>({
    queryKey: ["/api/dashboards"],
    enabled: !!user,
    retry: false,
  });

  const handleSelectionChange = (value: string) => {
    if (!value) {
      setSelectedType(null);
      setSelectedId("");
      return;
    }

    // Value format: "view:id" or "dashboard:id"
    const [type, id] = value.split(":");
    
    if (type === "view") {
      setSelectedType("view");
      setSelectedId(id);
      const view = savedViews.find(v => v.id === id);
      if (view && onLoadView) {
        onLoadView(view);
      }
    } else if (type === "dashboard") {
      setSelectedType("dashboard");
      setSelectedId(id);
      const dashboard = dashboards.find(d => d.id === id);
      if (dashboard && onLoadDashboard) {
        onLoadDashboard(dashboard);
      }
    }
  };

  const currentValue = selectedType && selectedId ? `${selectedType}:${selectedId}` : "";

  const isLoading = viewsLoading || dashboardsLoading;

  return (
    <Card data-testid="data-view-selector">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-emerald-500" />
          Saved Views & Dashboards
        </CardTitle>
        <CardDescription>Load a saved data view or dashboard configuration</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (savedViews.length === 0 && dashboards.length === 0) ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No saved views or dashboards yet. Create one from the Projects page to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Select value={currentValue} onValueChange={handleSelectionChange}>
              <SelectTrigger data-testid="select-data-view">
                <SelectValue placeholder="Select a view or dashboard..." />
              </SelectTrigger>
              <SelectContent>
                {savedViews.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>
                      <div className="flex items-center gap-2">
                        <FilterIcon className="w-4 h-4" />
                        <span>Data Views</span>
                      </div>
                    </SelectLabel>
                    {savedViews.map(view => (
                      <SelectItem 
                        key={`view:${view.id}`} 
                        value={`view:${view.id}`}
                        data-testid={`select-item-view-${view.id}`}
                      >
                        {view.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {dashboards.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>
                      <div className="flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Dashboards</span>
                      </div>
                    </SelectLabel>
                    {dashboards.map(dashboard => (
                      <SelectItem 
                        key={`dashboard:${dashboard.id}`} 
                        value={`dashboard:${dashboard.id}`}
                        data-testid={`select-item-dashboard-${dashboard.id}`}
                      >
                        <div className="flex flex-col">
                          <span>{dashboard.name}</span>
                          {dashboard.description && (
                            <span className="text-xs text-muted-foreground">{dashboard.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>

            {selectedType && selectedId && (
              <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-start gap-2">
                  {selectedType === "view" ? (
                    <FilterIcon className="w-4 h-4 text-blue-500 mt-0.5" />
                  ) : (
                    <LayoutDashboard className="w-4 h-4 text-purple-500 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {selectedType === "view" 
                        ? savedViews.find(v => v.id === selectedId)?.name 
                        : dashboards.find(d => d.id === selectedId)?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedType === "view" 
                        ? "Filter configuration loaded"
                        : `Dashboard with ${dashboards.find(d => d.id === selectedId)?.widgets?.length || 0} widgets`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
