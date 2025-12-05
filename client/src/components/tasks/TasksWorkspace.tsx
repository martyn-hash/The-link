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
  isMobile?: boolean;
}

function TaskRow({ task, selected, onSelect, onViewClick, isMobile }: TaskRowProps) {
  return (
    <TableRow data-testid={`row-task-${task.id}`}>
      <TableCell className="w-10">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          data-testid={`checkbox-task-${task.id}`}
        />
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="truncate" data-testid={`text-title-${task.id}`}>
            {task.title}
          </span>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {task.description}
          </p>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </Badge>
          <Badge className={`text-xs ${getStatusColor(task.status)}`}>
            {task.status === "in_progress" ? "In Progress" : task.status}
          </Badge>
        </div>
      </TableCell>
      {!isMobile && (
        <TableCell className="text-sm">
          <span data-testid={`text-assignee-${task.id}`}>
            {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : '-'}
          </span>
        </TableCell>
      )}
      {!isMobile && (
        <TableCell className="text-sm">
          <span data-testid={`text-duedate-${task.id}`}>
            {formatDate(task.dueDate)}
          </span>
        </TableCell>
      )}
      <TableCell className="text-right">
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
}

function ReminderRow({ reminder, selected, onSelect, onViewClick, isMobile }: ReminderRowProps) {
  return (
    <TableRow data-testid={`row-reminder-${reminder.id}`}>
      <TableCell className="w-10">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          data-testid={`checkbox-reminder-${reminder.id}`}
        />
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="truncate" data-testid={`text-title-${reminder.id}`}>
            {reminder.title}
          </span>
        </div>
        {reminder.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {reminder.description}
          </p>
        )}
      </TableCell>
      <TableCell>
        <Badge className={`text-xs ${getStatusColor(reminder.status)}`}>
          {reminder.status === "in_progress" ? "In Progress" : reminder.status}
        </Badge>
      </TableCell>
      {!isMobile && (
        <TableCell className="text-sm">
          <span data-testid={`text-assignee-${reminder.id}`}>
            {reminder.assignee ? `${reminder.assignee.firstName} ${reminder.assignee.lastName}` : '-'}
          </span>
        </TableCell>
      )}
      {!isMobile && (
        <TableCell className="text-sm">
          <span data-testid={`text-duedate-${reminder.id}`}>
            {formatDate(reminder.dueDate)}
          </span>
        </TableCell>
      )}
      <TableCell className="text-right">
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
}: TasksSectionProps) {
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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
        </h4>
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

      {/* Table Container */}
      <div className="border rounded-lg">
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>{isReminders ? 'Reminder' : 'Task'}</TableHead>
                    <TableHead>{isReminders ? 'Status' : 'Priority / Status'}</TableHead>
                    {!isMobile && <TableHead>Assigned To</TableHead>}
                    {!isMobile && <TableHead>Due Date</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
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
                      />
                    ) : (
                      <TaskRow
                        key={item.id}
                        task={item}
                        selected={selectedIds.includes(item.id)}
                        onSelect={(checked) => onSelectItem(item.id, checked)}
                        onViewClick={() => onViewItem(item)}
                        isMobile={isMobile}
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
    </div>
  );
}

export type OwnershipFilter = "assigned" | "created" | "all";

interface TasksWorkspaceProps {
  className?: string;
  ownershipFilter: OwnershipFilter;
  statusFilter: string;
  priorityFilter: string;
  onOwnershipFilterChange: (value: OwnershipFilter) => void;
  onStatusFilterChange: (value: string) => void;
  onPriorityFilterChange: (value: string) => void;
}

export function TasksWorkspace({ 
  className,
  ownershipFilter,
  statusFilter,
  priorityFilter,
  onOwnershipFilterChange,
  onStatusFilterChange,
  onPriorityFilterChange,
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
          isMobile={isMobile}
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
