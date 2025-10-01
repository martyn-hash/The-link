import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Clock, User as UserIcon, Calendar, Building2, Columns3, Settings2, GripVertical, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import type { ProjectWithRelations, User } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TaskListProps {
  projects: ProjectWithRelations[];
  user: User;
  serviceFilter?: string;
  onSwitchToKanban?: () => void;
}

// Column configuration with ID, label, and metadata
interface ColumnConfig {
  id: string;
  label: string;
  sortable: boolean;
  defaultVisible: boolean;
  minWidth?: number;
}

const ALL_COLUMNS: ColumnConfig[] = [
  { id: "client", label: "Client", sortable: true, defaultVisible: true, minWidth: 150 },
  { id: "projectType", label: "Project Type", sortable: true, defaultVisible: true, minWidth: 150 },
  { id: "serviceOwner", label: "Service Owner", sortable: true, defaultVisible: true, minWidth: 150 },
  { id: "dueDate", label: "Due Date", sortable: true, defaultVisible: true, minWidth: 120 },
  { id: "status", label: "Status", sortable: true, defaultVisible: true, minWidth: 180 },
  { id: "assignedTo", label: "Assigned To", sortable: false, defaultVisible: true, minWidth: 150 },
  { id: "timeInStage", label: "Time in Stage", sortable: true, defaultVisible: true, minWidth: 120 },
  { id: "createdDate", label: "Created Date", sortable: true, defaultVisible: false, minWidth: 120 },
  { id: "lastUpdated", label: "Last Updated", sortable: true, defaultVisible: false, minWidth: 120 },
  { id: "daysUntilDue", label: "Days Until Due", sortable: true, defaultVisible: false, minWidth: 120 },
  { id: "overdueIndicator", label: "Overdue", sortable: false, defaultVisible: false, minWidth: 90 },
  { id: "projectMonth", label: "Project Month", sortable: true, defaultVisible: false, minWidth: 120 },
  { id: "currentStage", label: "Current Stage", sortable: true, defaultVisible: false, minWidth: 150 },
  { id: "actions", label: "Actions", sortable: false, defaultVisible: true, minWidth: 100 },
];

// Sortable column header component
function SortableColumnHeader({ column, sortBy, sortOrder, onSort, width, onResize }: {
  column: ColumnConfig;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort?: (columnId: string) => void;
  width?: number;
  onResize?: (columnId: string, width: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: width ? `${width}px` : undefined,
    minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
  };

  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onResize) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(width || column.minWidth || 100);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!onResize) return;
      const diff = e.clientX - startX;
      const newWidth = Math.max(column.minWidth || 50, startWidth + diff);
      onResize(column.id, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, startX, startWidth, column, onResize]);

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={`relative ${column.sortable && onSort ? "cursor-pointer hover:bg-muted/50" : ""}`}
      onClick={() => column.sortable && onSort && onSort(column.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {column.id !== "actions" && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <span>
            {column.label} {column.sortable && sortBy === column.id && (sortOrder === "asc" ? "↑" : "↓")}
          </span>
        </div>
        {onResize && column.id !== "actions" && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
            onMouseDown={handleMouseDown}
          />
        )}
      </div>
    </TableHead>
  );
}

export default function TaskList({ projects, user, serviceFilter, onSwitchToKanban }: TaskListProps) {
  const [, setLocation] = useLocation();
  const [sortBy, setSortBy] = useState<string>("timeInStage");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Type for saved preferences
  interface SavedPreferences {
    columnOrder: string[];
    visibleColumns: string[];
    columnWidths: Record<string, number>;
  }

  // Column preferences state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    ALL_COLUMNS.filter(col => col.defaultVisible).map(col => col.id)
  );
  const [columnOrder, setColumnOrder] = useState<string[]>(
    ALL_COLUMNS.map(col => col.id)
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Load column preferences from API
  const { data: savedPreferences } = useQuery<SavedPreferences>({
    queryKey: ["/api/column-preferences"],
  });

  // Save column preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (preferences: SavedPreferences) => {
      return await apiRequest("POST", "/api/column-preferences", preferences);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/column-preferences"] });
    },
  });

  // Apply saved preferences on load
  useEffect(() => {
    if (savedPreferences) {
      if (savedPreferences.columnOrder) setColumnOrder(savedPreferences.columnOrder);
      if (savedPreferences.visibleColumns) setVisibleColumns(savedPreferences.visibleColumns);
      if (savedPreferences.columnWidths) setColumnWidths(savedPreferences.columnWidths as Record<string, number>);
    }
  }, [savedPreferences]);

  // Save preferences whenever they change (debounced would be better in production)
  const savePreferences = () => {
    savePreferencesMutation.mutate({
      columnOrder,
      visibleColumns,
      columnWidths,
    });
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        // Save to backend after reordering
        setTimeout(() => {
          savePreferencesMutation.mutate({
            columnOrder: newOrder,
            visibleColumns,
            columnWidths,
          });
        }, 100);
        return newOrder;
      });
    }
  };

  const toggleColumnVisibility = (columnId: string) => {
    setVisibleColumns((prev) => {
      const newVisible = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      // Save to backend after toggling
      setTimeout(() => {
        savePreferencesMutation.mutate({
          columnOrder,
          visibleColumns: newVisible,
          columnWidths,
        });
      }, 100);
      return newVisible;
    });
  };

  const handleColumnResize = (columnId: string, width: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [columnId]: width,
    }));
    // Debounce save in production
    setTimeout(() => {
      savePreferences();
    }, 500);
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      no_latest_action: "No Latest Action",
      bookkeeping_work_required: "Bookkeeping Work Required",
      in_review: "In Review",
      needs_client_input: "Needs Input from Client",
      completed: "Completed",
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      no_latest_action: "bg-amber-100 text-amber-800",
      bookkeeping_work_required: "bg-blue-100 text-blue-800",
      in_review: "bg-purple-100 text-purple-800",
      needs_client_input: "bg-orange-100 text-orange-800",
      completed: "bg-green-100 text-green-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getTimeInStage = (project: ProjectWithRelations) => {
    const lastChronology = project.chronology?.[0];
    if (!lastChronology || !lastChronology.timestamp) return 0;
    return Date.now() - new Date(lastChronology.timestamp).getTime();
  };

  const formatTimeInStage = (project: ProjectWithRelations) => {
    const timeDiff = getTimeInStage(project);
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h`;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysUntilDue = (dueDate: Date | string | null) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDaysUntilDue = (dueDate: Date | string | null) => {
    const days = getDaysUntilDue(dueDate);
    if (days === null) return "No due date";
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return "Due today";
    return `${days} days`;
  };

  const isOverdue = (dueDate: Date | string | null) => {
    const days = getDaysUntilDue(dueDate);
    return days !== null && days < 0;
  };

  const sortedProjects = [...projects].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "client":
        comparison = a.client.name.localeCompare(b.client.name);
        break;
      case "projectType":
        comparison = (a.projectType?.name || "").localeCompare(b.projectType?.name || "");
        break;
      case "serviceOwner":
        const aOwner = a.projectOwner ? `${a.projectOwner.firstName} ${a.projectOwner.lastName}` : "";
        const bOwner = b.projectOwner ? `${b.projectOwner.firstName} ${b.projectOwner.lastName}` : "";
        comparison = aOwner.localeCompare(bOwner);
        break;
      case "dueDate":
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        comparison = aDate - bDate;
        break;
      case "status":
        comparison = a.currentStatus.localeCompare(b.currentStatus);
        break;
      case "timeInStage":
        comparison = getTimeInStage(a) - getTimeInStage(b);
        break;
      case "createdDate":
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = aCreated - bCreated;
        break;
      case "lastUpdated":
        const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        comparison = aUpdated - bUpdated;
        break;
      case "daysUntilDue":
        const aDays = getDaysUntilDue(a.dueDate) ?? Infinity;
        const bDays = getDaysUntilDue(b.dueDate) ?? Infinity;
        comparison = aDays - bDays;
        break;
      case "projectMonth":
        comparison = (a.projectMonth || "").localeCompare(b.projectMonth || "");
        break;
      case "currentStage":
        comparison = a.currentStatus.localeCompare(b.currentStatus);
        break;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(columnId);
      setSortOrder("desc");
    }
  };

  const visibleProjects = sortedProjects.filter(project => {
    if (user.isAdmin || user.canSeeAdminMenu) {
      return true;
    }
    return (
      project.currentAssigneeId === user.id ||
      project.clientManagerId === user.id ||
      project.bookkeeperId === user.id
    );
  });

  // Get columns in order and filter to visible ones
  const orderedColumns = columnOrder
    .map(id => ALL_COLUMNS.find(col => col.id === id))
    .filter((col): col is ColumnConfig => col !== undefined && visibleColumns.includes(col.id));

  const renderCellContent = (columnId: string, project: ProjectWithRelations) => {
    switch (columnId) {
      case "client":
        return (
          <span data-testid={`text-client-${project.id}`} className="font-medium">
            {project.client.name}
          </span>
        );
      case "projectType":
        return (
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm" data-testid={`text-project-type-${project.id}`}>
              {project.projectType?.name || "No type"}
            </span>
          </div>
        );
      case "serviceOwner":
        return (
          <div className="flex items-center space-x-2">
            <UserIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm" data-testid={`text-service-owner-${project.id}`}>
              {project.projectOwner
                ? `${project.projectOwner.firstName} ${project.projectOwner.lastName}`
                : "Unassigned"}
            </span>
          </div>
        );
      case "dueDate":
        return (
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm" data-testid={`text-due-date-${project.id}`}>
              {formatDate(project.dueDate)}
            </span>
          </div>
        );
      case "status":
        return (
          <Badge className={getStatusColor(project.currentStatus)} data-testid={`badge-status-${project.id}`}>
            {getStatusLabel(project.currentStatus)}
          </Badge>
        );
      case "assignedTo":
        return (
          <div className="flex items-center space-x-2">
            <UserIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm" data-testid={`text-assigned-to-${project.id}`}>
              {project.stageRoleAssignee
                ? `${project.stageRoleAssignee.firstName} ${project.stageRoleAssignee.lastName}`
                : "Unassigned"}
            </span>
          </div>
        );
      case "timeInStage":
        return (
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{formatTimeInStage(project)}</span>
          </div>
        );
      case "createdDate":
        return (
          <span className="text-sm" data-testid={`text-created-date-${project.id}`}>
            {formatDate(project.createdAt)}
          </span>
        );
      case "lastUpdated":
        return (
          <span className="text-sm" data-testid={`text-last-updated-${project.id}`}>
            {formatDate(project.updatedAt)}
          </span>
        );
      case "daysUntilDue":
        const days = getDaysUntilDue(project.dueDate);
        return (
          <span
            className={`text-sm ${days !== null && days < 0 ? "text-red-600 font-semibold" : days !== null && days <= 3 ? "text-orange-600" : ""}`}
            data-testid={`text-days-until-due-${project.id}`}
          >
            {formatDaysUntilDue(project.dueDate)}
          </span>
        );
      case "overdueIndicator":
        return isOverdue(project.dueDate) ? (
          <div className="flex items-center justify-center" data-testid={`indicator-overdue-${project.id}`}>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
        ) : null;
      case "projectMonth":
        return (
          <span className="text-sm" data-testid={`text-project-month-${project.id}`}>
            {project.projectMonth || "N/A"}
          </span>
        );
      case "currentStage":
        return (
          <span className="text-sm" data-testid={`text-current-stage-${project.id}`}>
            {getStatusLabel(project.currentStatus)}
          </span>
        );
      case "actions":
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/projects/${project.id}`);
            }}
            data-testid={`button-view-project-${project.id}`}
          >
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6" data-testid="task-list">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span>Task List</span>
              <Badge variant="secondary">{visibleProjects.length} tasks</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-column-settings">
                    <Settings2 className="w-4 h-4 mr-2" />
                    Columns
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-column-settings">
                  <DialogHeader>
                    <DialogTitle>Column Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    <p className="text-sm text-muted-foreground">
                      Select which columns to display. Drag column headers to reorder them.
                    </p>
                    <div className="space-y-2">
                      {ALL_COLUMNS.filter(col => col.id !== "actions").map((column) => (
                        <div key={column.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`column-${column.id}`}
                            checked={visibleColumns.includes(column.id)}
                            onCheckedChange={() => toggleColumnVisibility(column.id)}
                            data-testid={`checkbox-column-${column.id}`}
                          />
                          <label
                            htmlFor={`column-${column.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {column.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              {serviceFilter && serviceFilter !== "all" && onSwitchToKanban && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSwitchToKanban}
                  className="flex items-center space-x-2"
                  data-testid="button-switch-to-kanban"
                >
                  <Columns3 className="w-4 h-4" />
                  <span>Switch to Kanban</span>
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visibleProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg font-medium mb-2">No tasks found</p>
              <p>You don't have any assigned tasks at the moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableContext
                        items={orderedColumns.map(col => col.id)}
                        strategy={horizontalListSortingStrategy}
                      >
                        {orderedColumns.map((column) => (
                          <SortableColumnHeader
                            key={column.id}
                            column={column}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSort={column.sortable ? handleSort : undefined}
                            width={columnWidths[column.id]}
                            onResize={handleColumnResize}
                          />
                        ))}
                      </SortableContext>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProjects.map((project) => (
                      <TableRow
                        key={project.id}
                        className="hover:bg-muted/50"
                        data-testid={`task-row-${project.id}`}
                      >
                        {orderedColumns.map((column) => (
                          <TableCell
                            key={column.id}
                            style={{
                              width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : undefined,
                              minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
                            }}
                          >
                            {renderCellContent(column.id, project)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
