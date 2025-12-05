import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

type OwnershipFilter = "assigned" | "created" | "all";

const ITEMS_PER_PAGE = 10;

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

interface TaskRowProps {
  task: InternalTaskWithRelations;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onViewClick: () => void;
}

function TaskRow({ task, selected, onSelect, onViewClick }: TaskRowProps) {
  return (
    <div 
      className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
      data-testid={`row-task-${task.id}`}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onSelect}
        data-testid={`checkbox-task-${task.id}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate" data-testid={`text-title-${task.id}`}>
            {task.title}
          </span>
          <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </Badge>
          <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`}>
            {task.status === "in_progress" ? "In Progress" : task.status}
          </Badge>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {task.assignee && (
            <span>{task.assignee.firstName} {task.assignee.lastName}</span>
          )}
          {task.dueDate && (
            <span>Due: {formatDate(task.dueDate)}</span>
          )}
        </div>
      </div>
      <Button
        variant="default"
        size="sm"
        onClick={onViewClick}
        data-testid={`button-view-${task.id}`}
      >
        <Eye className="h-4 w-4 mr-1" />
        View
      </Button>
    </div>
  );
}

interface ReminderRowProps {
  reminder: InternalTaskWithRelations;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onViewClick: () => void;
}

function ReminderRow({ reminder, selected, onSelect, onViewClick }: ReminderRowProps) {
  return (
    <div 
      className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
      data-testid={`row-reminder-${reminder.id}`}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onSelect}
        data-testid={`checkbox-reminder-${reminder.id}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Bell className="h-4 w-4 text-amber-500" />
          <span className="font-medium truncate" data-testid={`text-title-${reminder.id}`}>
            {reminder.title}
          </span>
          <Badge variant="outline" className={`text-xs ${getStatusColor(reminder.status)}`}>
            {reminder.status === "in_progress" ? "In Progress" : reminder.status}
          </Badge>
        </div>
        {reminder.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {reminder.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {reminder.assignee && (
            <span>{reminder.assignee.firstName} {reminder.assignee.lastName}</span>
          )}
          {reminder.dueDate && (
            <span>Due: {formatDate(reminder.dueDate)}</span>
          )}
        </div>
      </div>
      <Button
        variant="default"
        size="sm"
        onClick={onViewClick}
        data-testid={`button-view-${reminder.id}`}
      >
        <Eye className="h-4 w-4 mr-1" />
        View
      </Button>
    </div>
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
}: TasksSectionProps) {
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
            <Badge variant="secondary" className="ml-1">
              {totalCount}
            </Badge>
          </CardTitle>
          {totalCount > ITEMS_PER_PAGE && (
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
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No {isReminders ? 'reminders' : 'tasks'} found
          </div>
        ) : (
          <>
            <div className={isExpanded ? "max-h-[60vh] overflow-y-auto" : ""}>
              {items.map((item) => (
                isReminders ? (
                  <ReminderRow
                    key={item.id}
                    reminder={item}
                    selected={selectedIds.includes(item.id)}
                    onSelect={(checked) => onSelectItem(item.id, checked)}
                    onViewClick={() => onViewItem(item)}
                  />
                ) : (
                  <TaskRow
                    key={item.id}
                    task={item}
                    selected={selectedIds.includes(item.id)}
                    onSelect={(checked) => onSelectItem(item.id, checked)}
                    onViewClick={() => onViewItem(item)}
                  />
                )
              ))}
            </div>
            
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
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="h-7 px-2"
                  >
                    <ChevronRight className="h-4 w-4" />
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

interface TasksWorkspaceProps {
  className?: string;
}

export function TasksWorkspace({ className }: TasksWorkspaceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("assigned");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  
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
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: staff = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (priorityFilter !== "all") params.append("priority", priorityFilter);
    return params.toString();
  }, [statusFilter, priorityFilter]);

  const { data: assignedData, isLoading: isLoadingAssigned } = useQuery<InternalTaskWithRelations[]>({
    queryKey: ['/api/internal-tasks/assigned', user?.id, statusFilter, priorityFilter],
    queryFn: async () => {
      const queryString = buildQueryParams();
      const url = `/api/internal-tasks/assigned/${user?.id}${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch assigned tasks');
      return response.json();
    },
    enabled: !!user && ownershipFilter === "assigned",
  });

  const { data: createdData, isLoading: isLoadingCreated } = useQuery<InternalTaskWithRelations[]>({
    queryKey: ['/api/internal-tasks/created', user?.id, statusFilter, priorityFilter],
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
    queryKey: ['/api/internal-tasks', statusFilter, priorityFilter],
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

  const allTasks = useMemo(() => {
    return (rawData || []).filter(t => !t.isQuickReminder);
  }, [rawData]);

  const allReminders = useMemo(() => {
    return (rawData || []).filter(t => t.isQuickReminder === true);
  }, [rawData]);

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
    setOwnershipFilter(value);
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
  const activeFilterCount = (ownershipFilter !== "assigned" ? 1 : 0) + 
    (statusFilter !== "open" ? 1 : 0) + 
    (priorityFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setOwnershipFilter("assigned");
    setStatusFilter("open");
    setPriorityFilter("all");
  };

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <CreateTaskDialog 
            trigger={
              <Button size="sm" data-testid="button-create-task">
                <ClipboardList className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            }
          />
          <CreateReminderDialog 
            trigger={
              <Button variant="outline" size="sm" data-testid="button-create-reminder">
                <Bell className="h-4 w-4 mr-2" />
                Set Reminder
              </Button>
            }
          />
        </div>

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="relative" data-testid="button-tasks-filters">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Show</Label>
                <Select value={ownershipFilter} onValueChange={(v) => handleOwnershipChange(v as OwnershipFilter)}>
                  <SelectTrigger className="mt-1" data-testid="select-ownership-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Assigned to Me</SelectItem>
                    <SelectItem value="created">Created by Me</SelectItem>
                    <SelectItem value="all">All Team Items</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Priority</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="mt-1" data-testid="select-priority-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {activeFilterCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="w-full"
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

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
      <div className="space-y-4">
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
        />

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
