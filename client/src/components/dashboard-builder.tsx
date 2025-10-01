import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { ProjectWithRelations } from "@shared/schema";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Plus, 
  Save,
  Layout,
  List,
  Trash2,
  Settings,
  Table as TableIcon
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";

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
  widgets: Widget[];
  editMode?: boolean;
  onAddWidget?: () => void;
  onRemoveWidget?: (widgetId: string) => void;
  currentDashboard?: Dashboard | null;
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

interface TableFilter {
  groupBy: "projectType" | "status" | "assignee" | "serviceOwner" | "daysOverdue";
  value: string;
}

export default function DashboardBuilder({ 
  filters, 
  widgets, 
  editMode = false, 
  onAddWidget, 
  onRemoveWidget,
  currentDashboard 
}: DashboardBuilderProps) {
  const [tableFilter, setTableFilter] = useState<TableFilter | null>(null);

  const handleChartClick = (groupBy: string, value: string) => {
    // Toggle filter: if clicking the same value, clear the filter
    if (tableFilter && tableFilter.groupBy === groupBy && tableFilter.value === value) {
      setTableFilter(null);
    } else {
      setTableFilter({ 
        groupBy: groupBy as TableFilter["groupBy"], 
        value 
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
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
                  onClick={onAddWidget}
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
                onRemove={onRemoveWidget}
                onChartClick={handleChartClick}
                isActive={tableFilter?.groupBy === widget.groupBy}
              />
            ))}
          </div>
        )}

        {/* Mini Kanban Board - Show when service filter is active */}
        {filters.serviceFilter !== "all" && (
          <div className="mt-6">
            <MiniKanbanBoard serviceId={filters.serviceFilter} filters={filters} />
          </div>
        )}

        {/* Data Table - Show underlying filtered data */}
        {widgets.length > 0 && (
          <div className="mt-6">
            <FilteredDataTable 
              filters={filters} 
              tableFilter={tableFilter}
              onClearFilter={() => setTableFilter(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Widget Card Component
interface WidgetCardProps {
  widget: Widget;
  filters: any;
  editMode: boolean;
  onRemove?: (id: string) => void;
  onChartClick: (groupBy: string, value: string) => void;
  isActive: boolean;
}

function WidgetCard({ widget, filters, editMode, onRemove, onChartClick, isActive }: WidgetCardProps) {
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
      {editMode && onRemove && (
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
          {widget.groupBy === "serviceOwner" && "Grouped by Service Owner"}
          {widget.groupBy === "daysOverdue" && "Grouped by Days Overdue"}
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
              <Bar 
                dataKey="value" 
                fill="#3b82f6" 
                onClick={({ payload }) => onChartClick(widget.groupBy, payload.label)}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : widget.type === "line" ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} onClick={(e) => {
              if (e && e.activeLabel) {
                onChartClick(widget.groupBy, e.activeLabel);
              }
            }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                cursor="pointer"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                nameKey="label"
                labelLine={false}
                label={(entry) => `${entry.label}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onClick={(data) => onChartClick(widget.groupBy, data.name)}
                cursor="pointer"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
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

// Mini Kanban Board Component - Compact view for dashboard
interface MiniKanbanBoardProps {
  serviceId: string;
  filters: any;
}

function MiniKanbanBoard({ serviceId, filters }: MiniKanbanBoardProps) {
  // Fetch projects filtered by service and other filters
  const { data: projects = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/projects", { serviceId, filters }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.serviceFilter !== "all") params.append("serviceId", filters.serviceFilter);
      params.append("showArchived", filters.showArchived.toString());
      if (filters.taskAssigneeFilter !== "all") params.append("assigneeId", filters.taskAssigneeFilter);
      if (filters.serviceOwnerFilter !== "all") params.append("serviceOwnerId", filters.serviceOwnerFilter);
      if (filters.userFilter !== "all") params.append("userId", filters.userFilter);
      if (filters.dynamicDateFilter !== "all") params.append("dynamicDateFilter", filters.dynamicDateFilter);
      if (filters.dynamicDateFilter === "custom" && filters.customDateRange) {
        if (filters.customDateRange.from) params.append("dateFrom", filters.customDateRange.from.toISOString());
        if (filters.customDateRange.to) params.append("dateTo", filters.customDateRange.to.toISOString());
      }
      
      return fetch(`/api/projects?${params.toString()}`).then(r => r.json());
    },
  });

  // Get the project type from the first project to fetch stages
  const projectTypeId = projects[0]?.projectTypeId;

  // Fetch stages for the project type
  const { data: stages = [] } = useQuery<any[]>({
    queryKey: ['/api/config/project-types', projectTypeId, 'stages'],
    enabled: !!projectTypeId,
    staleTime: 5 * 60 * 1000,
  });

  // Group projects by stage
  const projectsByStage = stages.reduce((acc, stage) => {
    acc[stage.name] = projects.filter(p => p.currentStatus === stage.name);
    return acc;
  }, {} as Record<string, any[]>);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layout className="w-5 h-5" />
            Service Kanban Board
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layout className="w-5 h-5" />
            Service Kanban Board
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No projects found for the selected filters
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="mini-kanban-board">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layout className="w-5 h-5" />
          Service Kanban Board
        </CardTitle>
        <CardDescription>
          {projects.length} project{projects.length !== 1 ? 's' : ''} across {stages.length} stage{stages.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((stage) => {
              const stageProjects = projectsByStage[stage.name] || [];
              
              return (
                <div
                  key={stage.id}
                  className="flex-shrink-0 w-64 bg-muted/50 rounded-lg p-3"
                  data-testid={`mini-kanban-column-${stage.name}`}
                >
                  {/* Stage Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color || "#6b7280" }}
                      />
                      <span className="font-medium text-sm">
                        {stage.name.split('_').map((word: string) => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {stageProjects.length}
                    </Badge>
                  </div>

                  {/* Mini Project Cards */}
                  <div className="space-y-2">
                    {stageProjects.slice(0, 5).map((project: any) => (
                      <Card
                        key={project.id}
                        className="p-2 hover:shadow-md transition-shadow cursor-pointer"
                        data-testid={`mini-project-card-${project.id}`}
                      >
                        <div className="space-y-1">
                          <div className="font-medium text-xs truncate">
                            {project.client?.name || 'Unknown Client'}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {project.projectType?.name || 'Unknown Type'}
                          </div>
                        </div>
                      </Card>
                    ))}
                    {stageProjects.length > 5 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        +{stageProjects.length - 5} more
                      </div>
                    )}
                    {stageProjects.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        No projects
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}

// Filtered Data Table Component
interface FilteredDataTableProps {
  filters: any;
  tableFilter: TableFilter | null;
  onClearFilter: () => void;
}

function FilteredDataTable({ filters, tableFilter, onClearFilter }: FilteredDataTableProps) {
  // Build query params from filters - memoized to prevent unnecessary re-renders
  const queryParams = useMemo(() => {
    const params: Record<string, any> = {};
    if (filters.serviceFilter !== "all") params.serviceId = filters.serviceFilter;
    params.showArchived = filters.showArchived;
    if (filters.taskAssigneeFilter !== "all") params.assigneeId = filters.taskAssigneeFilter;
    if (filters.serviceOwnerFilter !== "all") params.serviceOwnerId = filters.serviceOwnerFilter;
    if (filters.userFilter !== "all") params.userId = filters.userFilter;
    if (filters.dynamicDateFilter !== "all") params.dynamicDateFilter = filters.dynamicDateFilter;
    if (filters.dynamicDateFilter === "custom" && filters.customDateRange) {
      if (filters.customDateRange.from) params.dateFrom = filters.customDateRange.from.toISOString();
      if (filters.customDateRange.to) params.dateTo = filters.customDateRange.to.toISOString();
    }
    return params;
  }, [filters]);

  // Fetch projects with applied filters using default fetcher
  const { data: allProjects = [], isLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/projects", queryParams],
  });

  // Apply table filter client-side
  const projects = tableFilter ? allProjects.filter(project => {
    switch (tableFilter.groupBy) {
      case "projectType":
        return project.projectType?.name === tableFilter.value;
      case "status":
        return project.currentStatus === tableFilter.value;
      case "assignee":
        const assigneeName = project.currentAssignee ? 
          `${project.currentAssignee.firstName || ''} ${project.currentAssignee.lastName || ''}`.trim() 
          : 'Unassigned';
        return assigneeName === tableFilter.value;
      case "serviceOwner":
        const ownerName = project.projectOwner ? 
          `${project.projectOwner.firstName || ''} ${project.projectOwner.lastName || ''}`.trim() 
          : 'N/A';
        return ownerName === tableFilter.value;
      case "daysOverdue":
        // Simplified overdue logic - you may need to adjust this based on your business logic
        if (!project.dueDate) return tableFilter.value === "No Due Date";
        const today = new Date();
        const dueDate = new Date(project.dueDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (tableFilter.value === "On Time") return daysOverdue <= 0;
        if (tableFilter.value === "1-7 Days") return daysOverdue >= 1 && daysOverdue <= 7;
        if (tableFilter.value === "8-14 Days") return daysOverdue >= 8 && daysOverdue <= 14;
        if (tableFilter.value === "15-30 Days") return daysOverdue >= 15 && daysOverdue <= 30;
        if (tableFilter.value === "30+ Days") return daysOverdue > 30;
        return false;
      default:
        return true;
    }
  }) : allProjects;

  return (
    <Card data-testid="filtered-data-table">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TableIcon className="w-5 h-5" />
              Filtered Project Data
            </CardTitle>
            <CardDescription>
              {projects.length} project{projects.length !== 1 ? 's' : ''} matching current filters
              {tableFilter && (
                <span className="ml-2">
                  • Filtered by {tableFilter.groupBy}: <strong>{tableFilter.value}</strong>
                </span>
              )}
            </CardDescription>
          </div>
          {tableFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilter}
              data-testid="button-clear-table-filter"
            >
              Clear Filter
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No projects found matching the current filters
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Project Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id} data-testid={`table-row-${project.id}`}>
                    <TableCell className="font-medium" data-testid={`cell-client-${project.id}`}>
                      {project.client?.name || 'N/A'}
                    </TableCell>
                    <TableCell data-testid={`cell-type-${project.id}`}>
                      {project.projectType?.name || 'N/A'}
                    </TableCell>
                    <TableCell data-testid={`cell-status-${project.id}`}>
                      <Badge variant="outline">{project.currentStatus || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-assignee-${project.id}`}>
                      {project.currentAssignee ? 
                        `${project.currentAssignee.firstName || ''} ${project.currentAssignee.lastName || ''}`.trim() 
                        : 'Unassigned'}
                    </TableCell>
                    <TableCell data-testid={`cell-owner-${project.id}`}>
                      {project.projectOwner ? 
                        `${project.projectOwner.firstName || ''} ${project.projectOwner.lastName || ''}`.trim() 
                        : 'N/A'}
                    </TableCell>
                    <TableCell data-testid={`cell-due-date-${project.id}`}>
                      {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
