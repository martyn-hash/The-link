import { useState, useEffect, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Clock, User as UserIcon, Calendar, Building2, Settings2, GripVertical, AlertCircle, Timer, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { useLocation } from "wouter";
import type { ProjectWithRelations, User, KanbanStage } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { calculateCurrentInstanceTime } from "@shared/businessTime";
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

interface MiniProjectsTableProps {
  projects: ProjectWithRelations[];
  user: User;
}

// Column configuration
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
  { id: "assignedTo", label: "Assigned To", sortable: false, defaultVisible: false, minWidth: 150 },
  { id: "timeInStage", label: "Time in Stage", sortable: true, defaultVisible: false, minWidth: 120 },
  { id: "stageTimer", label: "Stage Timer", sortable: true, defaultVisible: false, minWidth: 160 },
  { id: "daysUntilDue", label: "Days Until Due", sortable: true, defaultVisible: false, minWidth: 120 },
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
      className={`relative text-xs ${column.sortable && onSort ? "cursor-pointer hover:bg-muted/50" : ""}`}
      onClick={() => column.sortable && onSort && onSort(column.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {column.id !== "actions" && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-3 h-3 text-muted-foreground" />
            </div>
          )}
          <span className="text-xs">
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

export default function MiniProjectsTable({ projects, user }: MiniProjectsTableProps) {
  const [, setLocation] = useLocation();
  const [sortBy, setSortBy] = useState<string>("timeInStage");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 8;

  // Filter states
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Fetch all services for filter dropdown
  const { data: allServices = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/services"],
    enabled: !!user,
    retry: false,
    select: (data: any[]) => data.map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name))
  });

  // Fetch stage configurations for all unique project types
  const uniqueProjectTypeIds = useMemo(() => {
    return Array.from(new Set(projects.map(p => p.projectTypeId).filter(Boolean)));
  }, [projects]);

  const stageQueries = useQuery({
    queryKey: ['/api/config/project-types', 'all-stages', uniqueProjectTypeIds],
    queryFn: async () => {
      const stagesByType: Record<string, KanbanStage[]> = {};
      await Promise.all(
        uniqueProjectTypeIds.map(async (projectTypeId) => {
          if (projectTypeId) {
            try {
              const response = await fetch(`/api/config/project-types/${projectTypeId}/stages`);
              if (response.ok) {
                const stages = await response.json();
                stagesByType[projectTypeId] = stages;
              }
            } catch (error) {
              console.error(`Failed to fetch stages for project type ${projectTypeId}:`, error);
            }
          }
        })
      );
      return stagesByType;
    },
    enabled: uniqueProjectTypeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const projectStageConfigMap = useMemo(() => {
    const map = new Map<string, KanbanStage | undefined>();
    if (!stageQueries.data) return map;

    projects.forEach((project) => {
      if (project.projectTypeId && stageQueries.data[project.projectTypeId]) {
        const stages = stageQueries.data[project.projectTypeId];
        const stageConfig = stages.find(s => s.name === project.currentStatus);
        map.set(project.id, stageConfig);
      }
    });
    return map;
  }, [projects, stageQueries.data]);

  // Load state from localStorage
  const STORAGE_KEY = 'mini-projects-table-state';
  
  interface SavedState {
    columnOrder: string[];
    visibleColumns: string[];
    columnWidths: Record<string, number>;
    sortBy: string;
    sortOrder: "asc" | "desc";
    serviceFilter: string;
    statusFilter: string;
    dateFilter: string;
  }

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state: SavedState = JSON.parse(saved);
      return state.visibleColumns || ALL_COLUMNS.filter(col => col.defaultVisible).map(col => col.id);
    }
    return ALL_COLUMNS.filter(col => col.defaultVisible).map(col => col.id);
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state: SavedState = JSON.parse(saved);
      return state.columnOrder || ALL_COLUMNS.map(col => col.id);
    }
    return ALL_COLUMNS.map(col => col.id);
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state: SavedState = JSON.parse(saved);
      return state.columnWidths || {};
    }
    return {};
  });

  // Load filters and sort from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state: SavedState = JSON.parse(saved);
      if (state.sortBy) setSortBy(state.sortBy);
      if (state.sortOrder) setSortOrder(state.sortOrder);
      if (state.serviceFilter) setServiceFilter(state.serviceFilter);
      if (state.statusFilter) setStatusFilter(state.statusFilter);
      if (state.dateFilter) setDateFilter(state.dateFilter);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const state: SavedState = {
      columnOrder,
      visibleColumns,
      columnWidths,
      sortBy,
      sortOrder,
      serviceFilter,
      statusFilter,
      dateFilter,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [columnOrder, visibleColumns, columnWidths, sortBy, sortOrder, serviceFilter, statusFilter, dateFilter]);

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
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleColumnVisibility = (columnId: string) => {
    setVisibleColumns((prev) => 
      prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId]
    );
  };

  const handleColumnResize = (columnId: string, width: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [columnId]: width,
    }));
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
      no_latest_action: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      bookkeeping_work_required: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      in_review: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      needs_client_input: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
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

  const getBusinessHoursInStage = (project: ProjectWithRelations) => {
    const createdAt = project.createdAt 
      ? (typeof project.createdAt === 'string' ? project.createdAt : new Date(project.createdAt).toISOString())
      : undefined;
    
    const transformedChronology = (project.chronology || [])
      .filter((entry): entry is typeof entry & { timestamp: NonNullable<typeof entry.timestamp> } => {
        return entry.timestamp !== null && entry.timestamp !== undefined;
      })
      .map((entry) => ({
        toStatus: entry.toStatus,
        timestamp: entry.timestamp instanceof Date 
          ? entry.timestamp.toISOString() 
          : typeof entry.timestamp === 'string'
          ? entry.timestamp
          : new Date(entry.timestamp).toISOString()
      }));
    
    try {
      return calculateCurrentInstanceTime(
        transformedChronology,
        project.currentStatus,
        createdAt
      );
    } catch (error) {
      console.error("Error calculating business hours in stage:", error);
      return 0;
    }
  };

  const getStageTimerInfo = (project: ProjectWithRelations) => {
    const stageConfig = projectStageConfigMap.get(project.id);
    const currentHours = getBusinessHoursInStage(project);
    
    if (!stageConfig?.maxInstanceTime || stageConfig.maxInstanceTime === 0) {
      return { 
        hasLimit: false, 
        remainingHours: 0, 
        isOverdue: false,
        maxHours: 0,
        currentHours 
      };
    }

    const maxHours = stageConfig.maxInstanceTime;
    const remainingHours = maxHours - currentHours;
    const isOverdue = currentHours >= maxHours;

    return {
      hasLimit: true,
      remainingHours,
      isOverdue,
      maxHours,
      currentHours
    };
  };

  const formatStageTimer = (project: ProjectWithRelations) => {
    const timerInfo = getStageTimerInfo(project);
    
    if (!timerInfo.hasLimit) {
      return { text: "No limit", color: "text-gray-500" };
    }

    const hours = Math.abs(timerInfo.remainingHours);
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);

    let formattedTime = "";
    if (days > 0) {
      formattedTime = `${days}d ${remainingHours}h`;
    } else {
      formattedTime = `${remainingHours}h`;
    }

    if (timerInfo.isOverdue) {
      return { 
        text: `${formattedTime} behind`, 
        color: "text-red-600 dark:text-red-400 font-semibold" 
      };
    } else {
      const percentRemaining = (timerInfo.remainingHours / timerInfo.maxHours) * 100;
      let color = "text-green-600 dark:text-green-400";
      if (percentRemaining < 25) {
        color = "text-orange-600 dark:text-orange-400 font-semibold";
      } else if (percentRemaining < 50) {
        color = "text-orange-500 dark:text-orange-300";
      }
      
      return { 
        text: `${formattedTime} left`, 
        color 
      };
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
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
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Due today";
    return `${days}d`;
  };

  // Apply filters
  const filteredProjects = projects.filter(project => {
    // Service filter
    if (serviceFilter !== "all") {
      if (project.projectType?.service?.id !== serviceFilter) return false;
    }

    // Status filter
    if (statusFilter !== "all") {
      if (project.currentStatus !== statusFilter) return false;
    }

    // Date filter
    if (dateFilter !== "all" && project.dueDate) {
      const dueDate = new Date(project.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (dateFilter) {
        case "overdue":
          if (dueDate >= today) return false;
          break;
        case "today":
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);
          if (dueDate < today || dueDate > todayEnd) return false;
          break;
        case "next7days":
          const next7Days = new Date(today);
          next7Days.setDate(next7Days.getDate() + 7);
          if (dueDate < today || dueDate > next7Days) return false;
          break;
      }
    }

    return true;
  });

  // Sort projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
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
      case "daysUntilDue":
        const aDays = getDaysUntilDue(a.dueDate) ?? Infinity;
        const bDays = getDaysUntilDue(b.dueDate) ?? Infinity;
        comparison = aDays - bDays;
        break;
      case "stageTimer":
        const aTimerInfo = getStageTimerInfo(a);
        const bTimerInfo = getStageTimerInfo(b);
        
        if (!aTimerInfo.hasLimit && !bTimerInfo.hasLimit) {
          comparison = 0;
        } else if (!aTimerInfo.hasLimit) {
          comparison = -1;
        } else if (!bTimerInfo.hasLimit) {
          comparison = 1;
        } else {
          if (aTimerInfo.isOverdue !== bTimerInfo.isOverdue) {
            comparison = aTimerInfo.isOverdue ? 1 : -1;
          } else {
            comparison = bTimerInfo.remainingHours - aTimerInfo.remainingHours;
          }
        }
        break;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Apply pagination
  const totalPages = Math.ceil(sortedProjects.length / rowsPerPage);
  const paginatedProjects = sortedProjects.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );

  // Reset to page 0 if current page is out of bounds
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(0);
    }
  }, [currentPage, totalPages]);

  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(columnId);
      setSortOrder("desc");
    }
  };

  // Get columns in order and filter to visible ones
  const orderedColumns = columnOrder
    .map(id => ALL_COLUMNS.find(col => col.id === id))
    .filter((col): col is ColumnConfig => col !== undefined && visibleColumns.includes(col.id));

  const renderCellContent = (columnId: string, project: ProjectWithRelations) => {
    switch (columnId) {
      case "client":
        return (
          <span data-testid={`text-client-${project.id}`} className="font-medium text-xs">
            {project.client.name}
          </span>
        );
      case "projectType":
        return (
          <div className="flex items-center space-x-1">
            <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs truncate" data-testid={`text-project-type-${project.id}`}>
              {project.projectType?.name || "No type"}
            </span>
          </div>
        );
      case "serviceOwner":
        return (
          <div className="flex items-center space-x-1">
            <UserIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs truncate" data-testid={`text-service-owner-${project.id}`}>
              {project.projectOwner
                ? `${project.projectOwner.firstName} ${project.projectOwner.lastName}`
                : "Unassigned"}
            </span>
          </div>
        );
      case "dueDate":
        return (
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs" data-testid={`text-due-date-${project.id}`}>
              {formatDate(project.dueDate)}
            </span>
          </div>
        );
      case "status":
        return (
          <Badge className={`${getStatusColor(project.currentStatus)} text-xs py-0 px-1.5`} data-testid={`badge-status-${project.id}`}>
            {getStatusLabel(project.currentStatus)}
          </Badge>
        );
      case "assignedTo":
        return (
          <div className="flex items-center space-x-1">
            <UserIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs truncate" data-testid={`text-assigned-to-${project.id}`}>
              {project.stageRoleAssignee
                ? `${project.stageRoleAssignee.firstName} ${project.stageRoleAssignee.lastName}`
                : "Unassigned"}
            </span>
          </div>
        );
      case "timeInStage":
        return (
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs">{formatTimeInStage(project)}</span>
          </div>
        );
      case "stageTimer":
        const timerDisplay = formatStageTimer(project);
        return (
          <div className="flex items-center space-x-1">
            <Timer className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className={`text-xs ${timerDisplay.color}`} data-testid={`text-stage-timer-${project.id}`}>
              {timerDisplay.text}
            </span>
          </div>
        );
      case "daysUntilDue":
        const days = getDaysUntilDue(project.dueDate);
        return (
          <span
            className={`text-xs ${days !== null && days < 0 ? "text-red-600 dark:text-red-400 font-semibold" : days !== null && days <= 3 ? "text-orange-600 dark:text-orange-400" : ""}`}
            data-testid={`text-days-until-due-${project.id}`}
          >
            {formatDaysUntilDue(project.dueDate)}
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
            className="h-6 px-2"
            data-testid={`button-view-project-${project.id}`}
          >
            <Eye className="w-3 h-3 mr-1" />
            <span className="text-xs">View</span>
          </Button>
        );
      default:
        return null;
    }
  };

  const activeFilterCount = () => {
    let count = 0;
    if (serviceFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    if (dateFilter !== "all") count++;
    return count;
  };

  return (
    <Card data-testid="mini-projects-table">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-base">Projects</span>
            <Badge variant="secondary" className="text-xs">{sortedProjects.length}</Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2" data-testid="button-open-filters">
                  <Filter className="w-3 h-3 mr-1" />
                  <span className="text-xs">Filters</span>
                  {activeFilterCount() > 0 && (
                    <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">
                      {activeFilterCount()}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-filters" className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Filters</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Service</label>
                    <Select value={serviceFilter} onValueChange={setServiceFilter}>
                      <SelectTrigger data-testid="select-service-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Services</SelectItem>
                        {allServices.map(service => (
                          <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger data-testid="select-status-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="no_latest_action">No Latest Action</SelectItem>
                        <SelectItem value="bookkeeping_work_required">Bookkeeping Work Required</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="needs_client_input">Needs Input from Client</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Due Date</label>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger data-testid="select-date-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Dates</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="today">Due Today</SelectItem>
                        <SelectItem value="next7days">Next 7 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2" data-testid="button-column-settings">
                  <Settings2 className="w-3 h-3 mr-1" />
                  <span className="text-xs">Columns</span>
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-column-settings">
                <DialogHeader>
                  <DialogTitle>Column Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  <p className="text-sm text-muted-foreground">
                    Select columns to display. Drag headers to reorder.
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
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {paginatedProjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground px-6">
            <p className="text-sm">No projects found</p>
          </div>
        ) : (
          <>
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
                    {paginatedProjects.map((project) => (
                      <TableRow
                        key={project.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => setLocation(`/projects/${project.id}`)}
                        data-testid={`project-row-${project.id}`}
                      >
                        {orderedColumns.map((column) => (
                          <TableCell
                            key={column.id}
                            className="py-2"
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
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-xs text-muted-foreground">
                  Showing {currentPage * rowsPerPage + 1} to {Math.min((currentPage + 1) * rowsPerPage, sortedProjects.length)} of {sortedProjects.length}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    className="h-7 px-2"
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="h-7 px-2"
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
