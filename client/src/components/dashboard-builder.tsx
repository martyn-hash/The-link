import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Plus, 
  Save,
  Layout,
  List,
  Trash2,
  Settings
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";

interface DashboardBuilderProps {
  filters: {
    serviceFilter: string;
    taskAssigneeFilter: string;
    serviceOwnerFilter: string;
    userFilter: string;
    showArchived: boolean;
    dynamicDateFilter: "all" | "overdue" | "today" | "next7days" | "next14days" | "next30days" | "custom";
    customDateRange: { from: Date | undefined; to: Date | undefined };
  };
  onApplyFilters?: (filters: {
    serviceFilter: string;
    taskAssigneeFilter: string;
    serviceOwnerFilter: string;
    userFilter: string;
    showArchived: boolean;
    dynamicDateFilter: "all" | "overdue" | "today" | "next7days" | "next14days" | "next30days" | "custom";
    customDateRange: { from: Date | undefined; to: Date | undefined };
  }) => void;
  onSwitchToList: () => void;
}

interface Widget {
  id: string;
  type: "bar" | "pie" | "number";
  title: string;
  groupBy: "projectType" | "status" | "assignee";
  metric?: string;
}

interface Dashboard {
  id: string;
  userId: string;
  name: string;
  filters: any;
  widgets: Widget[];
  visibility: "private" | "shared";
  createdAt: string;
  updatedAt: string;
}

interface AnalyticsDataPoint {
  label: string;
  value: number;
}

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

export default function DashboardBuilder({ filters, onApplyFilters, onSwitchToList }: DashboardBuilderProps) {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [addWidgetDialogOpen, setAddWidgetDialogOpen] = useState(false);
  const [saveDashboardDialogOpen, setSaveDashboardDialogOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState("");
  
  // New widget form state
  const [newWidgetType, setNewWidgetType] = useState<"bar" | "pie" | "number">("bar");
  const [newWidgetTitle, setNewWidgetTitle] = useState("");
  const [newWidgetGroupBy, setNewWidgetGroupBy] = useState<"projectType" | "status" | "assignee">("projectType");

  // Fetch saved dashboards
  const { data: dashboards = [] } = useQuery<Dashboard[]>({
    queryKey: ["/api/dashboards"],
  });

  // Save dashboard mutation
  const saveDashboardMutation = useMutation({
    mutationFn: async (data: { name: string; filters: any; widgets: Widget[]; visibility: "private" | "shared" }) => {
      if (currentDashboard) {
        return apiRequest("PATCH", `/api/dashboards/${currentDashboard.id}`, data);
      } else {
        return apiRequest("POST", "/api/dashboards", data);
      }
    },
    onSuccess: (savedDashboard: Dashboard) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      setCurrentDashboard(savedDashboard);
      setDashboardName(savedDashboard.name);
      toast({
        title: "Success",
        description: "Dashboard saved successfully",
      });
      setSaveDashboardDialogOpen(false);
      setEditMode(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save dashboard",
        variant: "destructive",
      });
    },
  });

  const handleAddWidget = () => {
    if (!newWidgetTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a widget title",
        variant: "destructive",
      });
      return;
    }

    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type: newWidgetType,
      title: newWidgetTitle,
      groupBy: newWidgetGroupBy,
    };

    setWidgets([...widgets, newWidget]);
    setAddWidgetDialogOpen(false);
    
    // Reset form
    setNewWidgetTitle("");
    setNewWidgetType("bar");
    setNewWidgetGroupBy("projectType");
    
    toast({
      title: "Success",
      description: "Widget added to dashboard",
    });
  };

  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
  };

  const handleSaveDashboard = () => {
    if (!dashboardName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a dashboard name",
        variant: "destructive",
      });
      return;
    }

    // Stringify filters as the database expects a JSON string
    const filtersToSave = {
      ...filters,
      customDateRange: {
        from: filters.customDateRange.from ? filters.customDateRange.from.toISOString() : undefined,
        to: filters.customDateRange.to ? filters.customDateRange.to.toISOString() : undefined,
      },
    };

    saveDashboardMutation.mutate({
      name: dashboardName,
      filters: JSON.stringify(filtersToSave),
      widgets,
      visibility: "private",
    });
  };

  const handleLoadDashboard = (dashboard: Dashboard) => {
    setCurrentDashboard(dashboard);
    setWidgets(dashboard.widgets);
    setDashboardName(dashboard.name);
    setEditMode(false);
    
    // Parse filters from JSON string
    if (dashboard.filters && onApplyFilters) {
      const parsedFilters = typeof dashboard.filters === 'string' 
        ? JSON.parse(dashboard.filters) 
        : dashboard.filters;
      
      onApplyFilters({
        serviceFilter: parsedFilters.serviceFilter || "all",
        taskAssigneeFilter: parsedFilters.taskAssigneeFilter || "all",
        serviceOwnerFilter: parsedFilters.serviceOwnerFilter || "all",
        userFilter: parsedFilters.userFilter || "all",
        showArchived: parsedFilters.showArchived || false,
        dynamicDateFilter: parsedFilters.dynamicDateFilter || "all",
        customDateRange: {
          from: parsedFilters.customDateRange?.from ? new Date(parsedFilters.customDateRange.from) : undefined,
          to: parsedFilters.customDateRange?.to ? new Date(parsedFilters.customDateRange.to) : undefined,
        },
      });
      
      toast({
        title: "Dashboard Loaded",
        description: "Dashboard and filters have been applied",
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSwitchToList}
              data-testid="button-switch-to-list"
            >
              <List className="w-4 h-4 mr-2" />
              Back to List
            </Button>
            
            <div className="h-6 w-px bg-border" />
            
            <h3 className="text-lg font-semibold text-foreground">
              {currentDashboard ? currentDashboard.name : "Dashboard Builder"}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Load Dashboard Dropdown */}
            {dashboards.length > 0 && (
              <Select onValueChange={(value) => {
                const dashboard = dashboards.find(d => d.id === value);
                if (dashboard) handleLoadDashboard(dashboard);
              }}>
                <SelectTrigger className="w-[200px]" data-testid="select-load-dashboard">
                  <SelectValue placeholder="Load dashboard..." />
                </SelectTrigger>
                <SelectContent>
                  {dashboards.map(dashboard => (
                    <SelectItem key={dashboard.id} value={dashboard.id}>
                      {dashboard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode(!editMode)}
              data-testid="button-toggle-edit-mode"
            >
              <Layout className="w-4 h-4 mr-2" />
              {editMode ? "View Mode" : "Edit Mode"}
            </Button>

            {editMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddWidgetDialogOpen(true)}
                  data-testid="button-add-widget"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Widget
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setSaveDashboardDialogOpen(true)}
                  disabled={widgets.length === 0}
                  data-testid="button-save-dashboard"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Dashboard
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-auto p-6">
        {widgets.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>No Widgets Added</CardTitle>
                <CardDescription>
                  Start building your dashboard by adding charts and visualizations
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button
                  onClick={() => {
                    setEditMode(true);
                    setAddWidgetDialogOpen(true);
                  }}
                  data-testid="button-add-first-widget"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Widget
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {widgets.map((widget) => (
              <WidgetCard
                key={widget.id}
                widget={widget}
                filters={filters}
                editMode={editMode}
                onRemove={handleRemoveWidget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Widget Dialog */}
      <Dialog open={addWidgetDialogOpen} onOpenChange={setAddWidgetDialogOpen}>
        <DialogContent data-testid="dialog-add-widget">
          <DialogHeader>
            <DialogTitle>Add New Widget</DialogTitle>
            <DialogDescription>
              Configure your chart or metric to visualize project data
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="widget-title">Widget Title</Label>
              <Input
                id="widget-title"
                placeholder="e.g., Projects by Type"
                value={newWidgetTitle}
                onChange={(e) => setNewWidgetTitle(e.target.value)}
                data-testid="input-widget-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="widget-type">Chart Type</Label>
              <Select value={newWidgetType} onValueChange={(v: any) => setNewWidgetType(v)}>
                <SelectTrigger id="widget-type" data-testid="select-widget-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                  <SelectItem value="number">Number Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="widget-groupby">Group By</Label>
              <Select value={newWidgetGroupBy} onValueChange={(v: any) => setNewWidgetGroupBy(v)}>
                <SelectTrigger id="widget-groupby" data-testid="select-widget-groupby">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="projectType">Project Type</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="assignee">Assignee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddWidgetDialogOpen(false)} data-testid="button-cancel-widget">
              Cancel
            </Button>
            <Button onClick={handleAddWidget} data-testid="button-confirm-add-widget">
              Add Widget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Dashboard Dialog */}
      <Dialog open={saveDashboardDialogOpen} onOpenChange={setSaveDashboardDialogOpen}>
        <DialogContent data-testid="dialog-save-dashboard">
          <DialogHeader>
            <DialogTitle>Save Dashboard</DialogTitle>
            <DialogDescription>
              Give your dashboard a name to save it for later use
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dashboard-name">Dashboard Name</Label>
              <Input
                id="dashboard-name"
                placeholder="e.g., Project Overview"
                value={dashboardName}
                onChange={(e) => setDashboardName(e.target.value)}
                data-testid="input-dashboard-name"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDashboardDialogOpen(false)} data-testid="button-cancel-save">
              Cancel
            </Button>
            <Button onClick={handleSaveDashboard} disabled={saveDashboardMutation.isPending} data-testid="button-confirm-save">
              {saveDashboardMutation.isPending ? "Saving..." : "Save Dashboard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Widget Card Component
interface WidgetCardProps {
  widget: Widget;
  filters: any;
  editMode: boolean;
  onRemove: (id: string) => void;
}

function WidgetCard({ widget, filters, editMode, onRemove }: WidgetCardProps) {
  const { data: analyticsData, isLoading } = useQuery<{ series: AnalyticsDataPoint[]; meta: any }>({
    queryKey: ["/api/analytics", { filters, groupBy: widget.groupBy }],
    queryFn: async () => {
      return apiRequest("POST", "/api/analytics", {
        filters: {
          serviceFilter: filters.serviceFilter !== "all" ? filters.serviceFilter : undefined,
          showArchived: filters.showArchived,
          taskAssigneeFilter: filters.taskAssigneeFilter !== "all" ? filters.taskAssigneeFilter : undefined,
          serviceOwnerFilter: filters.serviceOwnerFilter !== "all" ? filters.serviceOwnerFilter : undefined,
          userFilter: filters.userFilter !== "all" ? filters.userFilter : undefined,
          dynamicDateFilter: filters.dynamicDateFilter !== "all" ? filters.dynamicDateFilter : undefined,
          customDateRange: filters.dynamicDateFilter === "custom" && filters.customDateRange ? {
            from: filters.customDateRange.from ? filters.customDateRange.from.toISOString() : undefined,
            to: filters.customDateRange.to ? filters.customDateRange.to.toISOString() : undefined,
          } : undefined,
        },
        groupBy: widget.groupBy,
      });
    },
  });

  const chartData = analyticsData?.series || [];
  const totalCount = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="relative" data-testid={`widget-card-${widget.id}`}>
      {editMode && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10"
          onClick={() => onRemove(widget.id)}
          data-testid={`button-remove-widget-${widget.id}`}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      )}
      
      <CardHeader>
        <CardTitle className="text-lg">{widget.title}</CardTitle>
        <CardDescription>
          {widget.groupBy === "projectType" && "Grouped by Project Type"}
          {widget.groupBy === "status" && "Grouped by Status"}
          {widget.groupBy === "assignee" && "Grouped by Assignee"}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available
          </div>
        ) : widget.type === "number" ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="text-6xl font-bold text-primary" data-testid={`widget-total-${widget.id}`}>
              {totalCount}
            </div>
            <div className="text-lg text-muted-foreground">Total Projects</div>
          </div>
        ) : widget.type === "bar" ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.label}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
