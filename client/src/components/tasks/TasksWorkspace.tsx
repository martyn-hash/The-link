import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  ClipboardList,
  Bell,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  X,
  Minimize2,
  Maximize2,
  Search,
  Link2,
  Calendar,
  Building2,
  FolderKanban,
  User as UserIcon,
} from "lucide-react";
import type { InternalTask, TaskType, User, Client, Project, Person } from "@shared/schema";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { CreateReminderDialog } from "@/components/create-reminder-dialog";
import { ReminderViewModal } from "@/components/reminder-view-modal";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import { format } from "date-fns";

interface TaskConnection {
  id: string;
  entityType: string;
  entityId: string;
  client?: Client | null;
  project?: Project | null;
  person?: Person | null;
}

interface InternalTaskWithRelations extends InternalTask {
  taskType?: TaskType | null;
  assignee?: User | null;
  creator?: User | null;
  connections?: TaskConnection[];
}

const ITEMS_PER_PAGE = 10;

const COLUMN_WIDTHS = {
  checkbox: "w-[40px]",
  title: "w-[18%] min-w-[140px]",
  description: "w-[20%] min-w-[150px]",
  status: "w-[14%] min-w-[130px]",
  linkedEntities: "w-[16%] min-w-[140px]",
  assignee: "w-[14%] min-w-[120px]",
  dueDate: "w-[12%] min-w-[100px]",
  actions: "w-[90px]",
};

const COLUMN_WIDTHS_NO_ASSIGNEE = {
  checkbox: "w-[40px]",
  title: "w-[20%] min-w-[140px]",
  description: "w-[24%] min-w-[150px]",
  status: "w-[16%] min-w-[130px]",
  linkedEntities: "w-[20%] min-w-[140px]",
  assignee: "", // Not used when showAssignee=false, but needed for consistent type
  dueDate: "w-[14%] min-w-[100px]",
  actions: "w-[90px]",
};

function getPriorityColor(priority: string) {
  switch (priority) {
    case "urgent": return "bg-red-500 text-white";
    case "high": return "bg-orange-500 text-white";
    case "medium": return "bg-blue-500 text-white";
    case "low": return "bg-gray-500 text-white";
    default: return "bg-gray-500 text-white";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "open": return "bg-blue-500 text-white";
    case "in_progress": return "bg-yellow-500 text-white";
    case "closed": return "bg-green-500 text-white";
    default: return "bg-gray-500 text-white";
  }
}

function formatDate(date: Date | string | null) {
  if (!date) return '-';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'd MMM yyyy');
}

function LinkedEntitiesCell({ connections }: { connections?: TaskConnection[] }) {
  if (!connections || connections.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  
  return (
    <div className="flex flex-wrap gap-1">
      {connections.slice(0, 2).map((conn) => {
        let icon = null;
        let displayName = '';
        let bgColor = 'bg-muted';
        
        if (conn.client) {
          icon = <Building2 className="h-3 w-3" />;
          displayName = conn.client.name;
          bgColor = 'bg-blue-100 dark:bg-blue-900/30';
        } else if (conn.project) {
          icon = <FolderKanban className="h-3 w-3" />;
          displayName = conn.project.description || 'Project';
          bgColor = 'bg-green-100 dark:bg-green-900/30';
        } else if (conn.person) {
          icon = <UserIcon className="h-3 w-3" />;
          displayName = `${conn.person.firstName} ${conn.person.lastName}`;
          bgColor = 'bg-purple-100 dark:bg-purple-900/30';
        }
        
        if (!displayName) return null;
        
        return (
          <Badge
            key={conn.id}
            variant="secondary"
            className={`text-xs px-1.5 py-0.5 ${bgColor} flex items-center gap-1 max-w-[80px]`}
          >
            {icon}
            <span className="truncate">{displayName}</span>
          </Badge>
        );
      })}
      {connections.length > 2 && (
        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
          +{connections.length - 2}
        </Badge>
      )}
    </div>
  );
}

interface ColumnFilterState {
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
}

interface TaskRowProps {
  task: InternalTaskWithRelations;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onViewClick: () => void;
  isMobile?: boolean;
  showLinkedEntities?: boolean;
  showAssignee?: boolean;
}

function TaskRow({ task, selected, onSelect, onViewClick, isMobile, showLinkedEntities = true, showAssignee = true }: TaskRowProps) {
  const truncateDescription = (text: string | null, maxLength: number = 50) => {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const colWidths = showAssignee ? COLUMN_WIDTHS : COLUMN_WIDTHS_NO_ASSIGNEE;

  return (
    <TableRow data-testid={`row-task-${task.id}`}>
      <TableCell className={colWidths.checkbox}>
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          data-testid={`checkbox-task-${task.id}`}
        />
      </TableCell>
      <TableCell className={`font-medium ${colWidths.title}`}>
        <span className="truncate block" data-testid={`text-title-${task.id}`}>
          {task.title}
        </span>
      </TableCell>
      {!isMobile && (
        <TableCell className={`text-sm text-muted-foreground ${colWidths.description}`}>
          <span className="line-clamp-1" data-testid={`text-description-${task.id}`}>
            {truncateDescription(task.description)}
          </span>
        </TableCell>
      )}
      <TableCell className={colWidths.status}>
        <div className="flex items-center gap-1">
          <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </Badge>
          <Badge className={`text-xs ${getStatusColor(task.status)}`}>
            {task.status === "in_progress" ? "In Progress" : task.status}
          </Badge>
        </div>
      </TableCell>
      {!isMobile && showLinkedEntities && (
        <TableCell className={colWidths.linkedEntities}>
          <LinkedEntitiesCell connections={task.connections} />
        </TableCell>
      )}
      {!isMobile && showAssignee && (
        <TableCell className={`text-sm ${colWidths.assignee}`}>
          <span data-testid={`text-assignee-${task.id}`}>
            {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : '-'}
          </span>
        </TableCell>
      )}
      {!isMobile && (
        <TableCell className={`text-sm ${colWidths.dueDate}`}>
          <span data-testid={`text-duedate-${task.id}`}>
            {formatDate(task.dueDate)}
          </span>
        </TableCell>
      )}
      <TableCell className={`text-right ${colWidths.actions}`}>
        <Button
          variant="default"
          size="sm"
          onClick={onViewClick}
          data-testid={`button-view-task-${task.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

interface ReminderRowProps {
  reminder: InternalTaskWithRelations;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onViewClick: () => void;
  isMobile?: boolean;
  showLinkedEntities?: boolean;
  showAssignee?: boolean;
}

function ReminderRow({ reminder, selected, onSelect, onViewClick, isMobile, showLinkedEntities = true, showAssignee = true }: ReminderRowProps) {
  const truncateDescription = (text: string | null, maxLength: number = 50) => {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const colWidths = showAssignee ? COLUMN_WIDTHS : COLUMN_WIDTHS_NO_ASSIGNEE;

  return (
    <TableRow data-testid={`row-reminder-${reminder.id}`}>
      <TableCell className={colWidths.checkbox}>
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          data-testid={`checkbox-reminder-${reminder.id}`}
        />
      </TableCell>
      <TableCell className={`font-medium ${colWidths.title}`}>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="truncate" data-testid={`text-title-${reminder.id}`}>
            {reminder.title}
          </span>
        </div>
      </TableCell>
      {!isMobile && (
        <TableCell className={`text-sm text-muted-foreground ${colWidths.description}`}>
          <span className="line-clamp-1" data-testid={`text-description-${reminder.id}`}>
            {truncateDescription(reminder.description)}
          </span>
        </TableCell>
      )}
      <TableCell className={colWidths.status}>
        <Badge className={`text-xs ${getStatusColor(reminder.status)}`}>
          {reminder.status === "in_progress" ? "In Progress" : reminder.status}
        </Badge>
      </TableCell>
      {!isMobile && showLinkedEntities && (
        <TableCell className={colWidths.linkedEntities}>
          <LinkedEntitiesCell connections={reminder.connections} />
        </TableCell>
      )}
      {!isMobile && showAssignee && (
        <TableCell className={`text-sm ${colWidths.assignee}`}>
          <span data-testid={`text-assignee-${reminder.id}`}>
            {reminder.assignee ? `${reminder.assignee.firstName} ${reminder.assignee.lastName}` : '-'}
          </span>
        </TableCell>
      )}
      {!isMobile && (
        <TableCell className={`text-sm ${colWidths.dueDate}`}>
          <span data-testid={`text-duedate-${reminder.id}`}>
            {formatDate(reminder.dueDate)}
          </span>
        </TableCell>
      )}
      <TableCell className={`text-right ${colWidths.actions}`}>
        <Button
          variant="default"
          size="sm"
          onClick={onViewClick}
          data-testid={`button-view-reminder-${reminder.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

interface TasksSectionProps {
  title: string;
  icon: React.ReactNode;
  items: InternalTaskWithRelations[];
  totalCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  selectedIds: string[];
  onSelectItem: (id: string, checked: boolean) => void;
  onViewItem: (item: InternalTaskWithRelations) => void;
  isLoading?: boolean;
  isReminders?: boolean;
  isMobile?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  filters: ColumnFilterState;
  onFilterChange: (field: keyof ColumnFilterState, value: string) => void;
  showFilters?: boolean;
  showAssignee?: boolean;
}

function TasksSection({
  title,
  icon,
  items,
  totalCount,
  isExpanded,
  onToggleExpand,
  currentPage,
  onPageChange,
  selectedIds,
  onSelectItem,
  onViewItem,
  isLoading,
  isReminders = false,
  isMobile = false,
  isCollapsed = false,
  onToggleCollapse,
  filters,
  onFilterChange,
  showFilters = true,
  showAssignee = true,
}: TasksSectionProps) {
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasActiveFilters = filters.title || filters.description || (showAssignee && filters.assignee) || filters.dueDate;
  const colWidths = showAssignee ? COLUMN_WIDTHS : COLUMN_WIDTHS_NO_ASSIGNEE;

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-1">
            {totalCount}
          </Badge>
          {hasActiveFilters && (
            <Badge variant="outline" className="ml-1 text-xs bg-blue-50 dark:bg-blue-900/20">
              <Filter className="h-3 w-3 mr-1" />
              Filtered
            </Badge>
          )}
        </h4>
        <div className="flex items-center gap-2">
          {/* Collapse button - only for Tasks section */}
          {!isReminders && onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="text-xs h-7 px-2"
              data-testid="button-collapse-tasks"
            >
              {isCollapsed ? (
                <>
                  <Maximize2 className="h-3.5 w-3.5 mr-1" />
                  Expand
                </>
              ) : (
                <>
                  <Minimize2 className="h-3.5 w-3.5 mr-1" />
                  Collapse
                </>
              )}
            </Button>
          )}
          {totalCount > ITEMS_PER_PAGE && !isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="text-xs"
              data-testid={`button-expand-${isReminders ? 'reminders' : 'tasks'}`}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Back to Summary
                </>
              ) : (
                <>
                  Show All
                  <ChevronDown className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Table Container - hidden when collapsed */}
      {!isCollapsed && (
        <div className="border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No {isReminders ? 'reminders' : 'tasks'} found
              {hasActiveFilters && (
                <span className="block mt-1 text-xs">Try adjusting your column filters</span>
              )}
            </div>
          ) : (
            <>
              <div className={isExpanded ? "max-h-[60vh] overflow-y-auto" : ""}>
                <Table>
                  <TableHeader>
                    {/* Column Headers Row */}
                    <TableRow>
                      <TableHead className={colWidths.checkbox}></TableHead>
                      <TableHead className={colWidths.title}>{isReminders ? 'Reminder' : 'Task'}</TableHead>
                      {!isMobile && <TableHead className={colWidths.description}>Description</TableHead>}
                      <TableHead className={colWidths.status}>Status</TableHead>
                      {!isMobile && <TableHead className={colWidths.linkedEntities}>Linked Entities</TableHead>}
                      {!isMobile && showAssignee && <TableHead className={colWidths.assignee}>Assigned To</TableHead>}
                      {!isMobile && <TableHead className={colWidths.dueDate}>Due Date</TableHead>}
                      <TableHead className={`text-right ${colWidths.actions}`}>Actions</TableHead>
                    </TableRow>
                    {/* Filter Row */}
                    {showFilters && !isMobile && (
                      <TableRow className="bg-muted/30">
                        <TableHead className={colWidths.checkbox}></TableHead>
                        <TableHead className={colWidths.title}>
                          <Input
                            placeholder="Filter..."
                            value={filters.title}
                            onChange={(e) => onFilterChange('title', e.target.value)}
                            className="h-7 text-xs"
                            data-testid={`filter-title-${isReminders ? 'reminders' : 'tasks'}`}
                          />
                        </TableHead>
                        <TableHead className={colWidths.description}>
                          <Input
                            placeholder="Filter..."
                            value={filters.description}
                            onChange={(e) => onFilterChange('description', e.target.value)}
                            className="h-7 text-xs"
                            data-testid={`filter-description-${isReminders ? 'reminders' : 'tasks'}`}
                          />
                        </TableHead>
                        <TableHead className={colWidths.status}></TableHead>
                        <TableHead className={colWidths.linkedEntities}></TableHead>
                        {showAssignee && (
                          <TableHead className={colWidths.assignee}>
                            <Input
                              placeholder="Filter..."
                              value={filters.assignee}
                              onChange={(e) => onFilterChange('assignee', e.target.value)}
                              className="h-7 text-xs"
                              data-testid={`filter-assignee-${isReminders ? 'reminders' : 'tasks'}`}
                            />
                          </TableHead>
                        )}
                        <TableHead className={colWidths.dueDate}>
                          <Input
                            type="date"
                            value={filters.dueDate}
                            onChange={(e) => onFilterChange('dueDate', e.target.value)}
                            className="h-7 text-xs"
                            data-testid={`filter-duedate-${isReminders ? 'reminders' : 'tasks'}`}
                          />
                        </TableHead>
                        <TableHead className={colWidths.actions}></TableHead>
                      </TableRow>
                    )}
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      isReminders ? (
                        <ReminderRow
                          key={item.id}
                          reminder={item}
                          selected={selectedIds.includes(item.id)}
                          onSelect={(checked) => onSelectItem(item.id, checked)}
                          onViewClick={() => onViewItem(item)}
                          isMobile={isMobile}
                          showLinkedEntities={!isMobile}
                          showAssignee={showAssignee}
                        />
                      ) : (
                        <TaskRow
                          key={item.id}
                          task={item}
                          selected={selectedIds.includes(item.id)}
                          onSelect={(checked) => onSelectItem(item.id, checked)}
                          onViewClick={() => onViewItem(item)}
                          isMobile={isMobile}
                          showLinkedEntities={!isMobile}
                          showAssignee={showAssignee}
                        />
                      )
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              {!isExpanded && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="h-7 px-2"
                      data-testid={`button-prev-${isReminders ? 'reminders' : 'tasks'}`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="h-7 px-2"
                      data-testid={`button-next-${isReminders ? 'reminders' : 'tasks'}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Collapsed state message */}
      {isCollapsed && (
        <div className="border rounded-lg py-3 px-4 text-center text-muted-foreground text-sm bg-muted/30">
          {totalCount} task{totalCount !== 1 ? 's' : ''} hidden
        </div>
      )}
    </div>
  );
}

export type OwnershipFilter = "assigned" | "created" | "all";

interface TasksWorkspaceProps {
  className?: string;
  ownershipFilter: OwnershipFilter;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter?: string;
  onOwnershipFilterChange: (value: OwnershipFilter) => void;
  onStatusFilterChange: (value: string) => void;
  onPriorityFilterChange: (value: string) => void;
  onAssigneeFilterChange?: (value: string) => void;
}

export function TasksWorkspace({ 
  className,
  ownershipFilter,
  statusFilter,
  priorityFilter,
  assigneeFilter = "all",
  onOwnershipFilterChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onAssigneeFilterChange,
}: TasksWorkspaceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [remindersExpanded, setRemindersExpanded] = useState(false);
  const [tasksPage, setTasksPage] = useState(1);
  const [remindersPage, setRemindersPage] = useState(1);
  
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedReminders, setSelectedReminders] = useState<string[]>([]);
  
  const [viewingTask, setViewingTask] = useState<InternalTaskWithRelations | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [viewingReminder, setViewingReminder] = useState<InternalTaskWithRelations | null>(null);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  
  const [tasksCollapsed, setTasksCollapsed] = useState(false);
  
  const [tasksFilters, setTasksFilters] = useState<ColumnFilterState>({
    title: '',
    description: '',
    assignee: '',
    dueDate: '',
  });
  
  const [remindersFilters, setRemindersFilters] = useState<ColumnFilterState>({
    title: '',
    description: '',
    assignee: '',
    dueDate: '',
  });
  
  const handleTasksFilterChange = useCallback((field: keyof ColumnFilterState, value: string) => {
    setTasksFilters(prev => ({ ...prev, [field]: value }));
    setTasksPage(1);
  }, []);
  
  const handleRemindersFilterChange = useCallback((field: keyof ColumnFilterState, value: string) => {
    setRemindersFilters(prev => ({ ...prev, [field]: value }));
    setRemindersPage(1);
  }, []);

  const { data: staff = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Derive effective assignee filter based on ownership mode to prevent stale state leakage
  const effectiveAssigneeFilter = useMemo(() => {
    // In "assigned" mode, assignee filter is not applicable - always treat as "all"
    if (ownershipFilter === "assigned") return "all";
    return assigneeFilter;
  }, [ownershipFilter, assigneeFilter]);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (priorityFilter !== "all") params.append("priority", priorityFilter);
    // Only include assignee filter when applicable (derived from effectiveAssigneeFilter)
    if (effectiveAssigneeFilter !== "all") params.append("assigneeId", effectiveAssigneeFilter);
    return params.toString();
  }, [statusFilter, priorityFilter, effectiveAssigneeFilter]);

  const { data: assignedData, isLoading: isLoadingAssigned } = useQuery<InternalTaskWithRelations[]>({
    queryKey: ['/api/internal-tasks/assigned', user?.id, statusFilter, priorityFilter],
    queryFn: async () => {
      // For "assigned" mode, build params without assignee (effectiveAssigneeFilter is already "all")
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      const queryString = params.toString();
      const url = `/api/internal-tasks/assigned/${user?.id}${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch assigned tasks');
      return response.json();
    },
    enabled: !!user && ownershipFilter === "assigned",
  });

  const { data: createdData, isLoading: isLoadingCreated } = useQuery<InternalTaskWithRelations[]>({
    queryKey: ['/api/internal-tasks/created', user?.id, statusFilter, priorityFilter, effectiveAssigneeFilter],
    queryFn: async () => {
      const queryString = buildQueryParams();
      const url = `/api/internal-tasks/created/${user?.id}${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch created tasks');
      return response.json();
    },
    enabled: !!user && ownershipFilter === "created",
  });

  const { data: allData, isLoading: isLoadingAll } = useQuery<InternalTaskWithRelations[]>({
    queryKey: ['/api/internal-tasks', statusFilter, priorityFilter, effectiveAssigneeFilter],
    queryFn: async () => {
      const queryString = buildQueryParams();
      const url = `/api/internal-tasks${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch all tasks');
      return response.json();
    },
    enabled: ownershipFilter === "all",
  });

  const isLoading = ownershipFilter === "assigned" ? isLoadingAssigned 
    : ownershipFilter === "created" ? isLoadingCreated 
    : isLoadingAll;

  const rawData = ownershipFilter === "assigned" ? assignedData 
    : ownershipFilter === "created" ? createdData 
    : allData;

  const applyColumnFilters = useCallback((items: InternalTaskWithRelations[], filters: ColumnFilterState) => {
    return items.filter(item => {
      if (filters.title && !item.title.toLowerCase().includes(filters.title.toLowerCase())) {
        return false;
      }
      if (filters.description) {
        if (!item.description || !item.description.toLowerCase().includes(filters.description.toLowerCase())) {
          return false;
        }
      }
      if (filters.assignee) {
        if (!item.assignee) {
          return false;
        }
        const assigneeName = `${item.assignee.firstName} ${item.assignee.lastName}`.toLowerCase();
        if (!assigneeName.includes(filters.assignee.toLowerCase())) {
          return false;
        }
      }
      if (filters.dueDate) {
        if (!item.dueDate) {
          return false;
        }
        const filterDate = new Date(filters.dueDate).toDateString();
        const itemDate = new Date(item.dueDate).toDateString();
        if (filterDate !== itemDate) {
          return false;
        }
      }
      return true;
    });
  }, []);

  const allTasks = useMemo(() => {
    const tasks = (rawData || []).filter(t => !t.isQuickReminder);
    return applyColumnFilters(tasks, tasksFilters);
  }, [rawData, tasksFilters, applyColumnFilters]);

  const allReminders = useMemo(() => {
    const reminders = (rawData || []).filter(t => t.isQuickReminder === true);
    return applyColumnFilters(reminders, remindersFilters);
  }, [rawData, remindersFilters, applyColumnFilters]);

  const paginatedTasks = useMemo(() => {
    if (tasksExpanded) return allTasks;
    const start = (tasksPage - 1) * ITEMS_PER_PAGE;
    return allTasks.slice(start, start + ITEMS_PER_PAGE);
  }, [allTasks, tasksPage, tasksExpanded]);

  const paginatedReminders = useMemo(() => {
    if (remindersExpanded) return allReminders;
    const start = (remindersPage - 1) * ITEMS_PER_PAGE;
    return allReminders.slice(start, start + ITEMS_PER_PAGE);
  }, [allReminders, remindersPage, remindersExpanded]);

  const handleOwnershipChange = (value: OwnershipFilter) => {
    onOwnershipFilterChange(value);
    setTasksPage(1);
    setRemindersPage(1);
    setSelectedTasks([]);
    setSelectedReminders([]);
  };

  const handleSelectTask = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedTasks([...selectedTasks, id]);
    } else {
      setSelectedTasks(selectedTasks.filter(t => t !== id));
    }
  };

  const handleSelectReminder = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedReminders([...selectedReminders, id]);
    } else {
      setSelectedReminders(selectedReminders.filter(r => r !== id));
    }
  };

  const handleViewTask = (task: InternalTaskWithRelations) => {
    if (task.isQuickReminder) {
      setViewingReminder(task);
      setReminderModalOpen(true);
    } else {
      setViewingTask(task);
      setTaskModalOpen(true);
    }
  };

  const bulkReassignMutation = useMutation({
    mutationFn: async (assignedToId: string) => {
      const allSelected = [...selectedTasks, ...selectedReminders];
      return await apiRequest("POST", "/api/internal-tasks/bulk/reassign", {
        taskIds: allSelected,
        assignedToId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Items reassigned",
        description: `${selectedTasks.length + selectedReminders.length} item(s) have been reassigned.`,
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/internal-tasks');
        }
      });
      setSelectedTasks([]);
      setSelectedReminders([]);
      setBulkReassignOpen(false);
      setSelectedAssignee("");
    },
    onError: (error: Error) => {
      showFriendlyError({ error: error.message || "Failed to reassign items" });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const allSelected = [...selectedTasks, ...selectedReminders];
      return await apiRequest("POST", "/api/internal-tasks/bulk/update-status", {
        taskIds: allSelected,
        status,
      });
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: `${selectedTasks.length + selectedReminders.length} item(s) have been updated.`,
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/internal-tasks');
        }
      });
      setSelectedTasks([]);
      setSelectedReminders([]);
      setBulkStatusOpen(false);
      setSelectedStatus("");
    },
    onError: (error: Error) => {
      showFriendlyError({ error: error.message || "Failed to update status" });
    },
  });

  const totalSelected = selectedTasks.length + selectedReminders.length;

  return (
    <div className={className}>
      {/* Bulk Actions Bar */}
      {totalSelected > 0 && (
        <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between" data-testid="bulk-actions-bar">
          <span className="text-sm font-medium">
            {totalSelected} item{totalSelected !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkReassignOpen(true)}
              data-testid="button-bulk-reassign"
            >
              Reassign
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkStatusOpen(true)}
              data-testid="button-bulk-status"
            >
              Change Status
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedTasks([]);
                setSelectedReminders([]);
              }}
              data-testid="button-clear-selection"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Tasks Section */}
      <div className="space-y-6">
        <TasksSection
          title="Tasks"
          icon={<ClipboardList className="h-4 w-4" />}
          items={paginatedTasks}
          totalCount={allTasks.length}
          isExpanded={tasksExpanded}
          onToggleExpand={() => setTasksExpanded(!tasksExpanded)}
          currentPage={tasksPage}
          onPageChange={setTasksPage}
          selectedIds={selectedTasks}
          onSelectItem={handleSelectTask}
          onViewItem={handleViewTask}
          isLoading={isLoading && !tasksExpanded}
          isReminders={false}
          isMobile={isMobile}
          isCollapsed={tasksCollapsed}
          onToggleCollapse={() => setTasksCollapsed(!tasksCollapsed)}
          filters={tasksFilters}
          onFilterChange={handleTasksFilterChange}
          showAssignee={ownershipFilter !== "assigned"}
        />

        {/* Visual separator between Tasks and Reminders */}
        <div className="border-t-2 border-dashed border-border/50 my-2" />

        <TasksSection
          title="Reminders"
          icon={<Bell className="h-4 w-4 text-amber-500" />}
          items={paginatedReminders}
          totalCount={allReminders.length}
          isExpanded={remindersExpanded}
          onToggleExpand={() => setRemindersExpanded(!remindersExpanded)}
          currentPage={remindersPage}
          onPageChange={setRemindersPage}
          selectedIds={selectedReminders}
          onSelectItem={handleSelectReminder}
          onViewItem={handleViewTask}
          isLoading={isLoading && !remindersExpanded}
          isReminders={true}
          isMobile={isMobile}
          filters={remindersFilters}
          onFilterChange={handleRemindersFilterChange}
          showAssignee={ownershipFilter !== "assigned"}
        />
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={viewingTask?.id || null}
        open={taskModalOpen}
        onOpenChange={(isOpen: boolean) => {
          setTaskModalOpen(isOpen);
          if (!isOpen) setViewingTask(null);
        }}
      />

      {/* Reminder View Modal */}
      <ReminderViewModal
        reminder={viewingReminder}
        open={reminderModalOpen}
        onOpenChange={(isOpen: boolean) => {
          setReminderModalOpen(isOpen);
          if (!isOpen) setViewingReminder(null);
        }}
      />

      {/* Bulk Reassign Dialog */}
      <AlertDialog open={bulkReassignOpen} onOpenChange={setBulkReassignOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign Items</AlertDialogTitle>
            <AlertDialogDescription>
              Select a team member to reassign {totalSelected} item(s) to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Assign to</Label>
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger className="mt-2" data-testid="select-assignee">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedAssignee && bulkReassignMutation.mutate(selectedAssignee)}
              disabled={!selectedAssignee || bulkReassignMutation.isPending}
            >
              {bulkReassignMutation.isPending ? "Reassigning..." : "Reassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Status Dialog */}
      <AlertDialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Status</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new status for {totalSelected} item(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>New Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="mt-2" data-testid="select-bulk-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedStatus && bulkStatusMutation.mutate(selectedStatus)}
              disabled={!selectedStatus || bulkStatusMutation.isPending}
            >
              {bulkStatusMutation.isPending ? "Updating..." : "Update Status"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
