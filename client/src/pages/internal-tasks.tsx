import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ClipboardList,
  Clock,
  Eye,
} from "lucide-react";
import type { InternalTask, TaskType, User } from "@shared/schema";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import TopNavigation from "@/components/top-navigation";
import { format } from "date-fns";

interface InternalTaskWithRelations extends InternalTask {
  taskType?: TaskType | null;
  assignee?: User | null;
  creator?: User | null;
}

function TaskRow({ task, selected, onSelect, onViewClick }: {
  task: InternalTaskWithRelations;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onViewClick: () => void;
}) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500 text-white";
      case "high":
        return "bg-orange-500 text-white";
      case "medium":
        return "bg-blue-500 text-white";
      case "low":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500 text-white";
      case "in_progress":
        return "bg-yellow-500 text-white";
      case "closed":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'd MMM yyyy');
  };

  return (
    <TableRow data-testid={`row-task-${task.id}`}>
      <TableCell className="w-12">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          data-testid={`checkbox-task-${task.id}`}
        />
      </TableCell>
      <TableCell className="font-medium">
        <span data-testid={`text-title-${task.id}`}>
          {task.title}
        </span>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1" data-testid={`text-description-${task.id}`}>
            {task.description}
          </p>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`} data-testid={`badge-priority-${task.id}`}>
          {task.priority}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`} data-testid={`badge-status-${task.id}`}>
          {task.status === "in_progress" ? "In Progress" : task.status}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-sm" data-testid={`text-type-${task.id}`}>
          {task.taskType?.name || '-'}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm" data-testid={`text-assignee-${task.id}`}>
          {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : '-'}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm" data-testid={`text-due-${task.id}`}>
          {formatDate(task.dueDate)}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="default"
          size="sm"
          onClick={onViewClick}
          data-testid={`button-view-${task.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function InternalTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"assigned" | "created" | "all">("assigned");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Fetch staff members for bulk reassign
  const { data: staff = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: assignedTasks, isLoading: isLoadingAssigned } = useQuery<InternalTaskWithRelations[]>({
    queryKey: ['/api/internal-tasks/assigned', user?.id, statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      const queryString = params.toString();
      const url = `/api/internal-tasks/assigned/${user?.id}${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch assigned tasks');
      return response.json();
    },
    enabled: !!user && activeTab === "assigned",
  });

  const { data: createdTasks, isLoading: isLoadingCreated } = useQuery<InternalTaskWithRelations[]>({
    queryKey: ['/api/internal-tasks/created', user?.id, statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      const queryString = params.toString();
      const url = `/api/internal-tasks/created/${user?.id}${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch created tasks');
      return response.json();
    },
    enabled: !!user && activeTab === "created",
  });

  const { data: allTasks, isLoading: isLoadingAll } = useQuery<InternalTaskWithRelations[]>({
    queryKey: ['/api/internal-tasks', statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      const queryString = params.toString();
      const url = `/api/internal-tasks${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch all tasks');
      return response.json();
    },
    enabled: activeTab === "all",
  });

  const getCurrentTasks = () => {
    switch (activeTab) {
      case "assigned":
        return assignedTasks || [];
      case "created":
        return createdTasks || [];
      case "all":
        return allTasks || [];
      default:
        return [];
    }
  };

  const isLoading = activeTab === "assigned" ? isLoadingAssigned : activeTab === "created" ? isLoadingCreated : isLoadingAll;
  const tasks = getCurrentTasks();

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(tasks.map(t => t.id));
    } else {
      setSelectedTasks([]);
    }
  };

  const handleSelectTask = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTasks([...selectedTasks, taskId]);
    } else {
      setSelectedTasks(selectedTasks.filter(id => id !== taskId));
    }
  };

  const handleViewTask = (taskId: string) => {
    setLocation(`/internal-tasks/${taskId}`);
  };

  // Bulk reassign mutation
  const bulkReassignMutation = useMutation({
    mutationFn: async (assignedToId: string) => {
      return await apiRequest("POST", "/api/internal-tasks/bulk/reassign", {
        taskIds: selectedTasks,
        assignedToId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Tasks reassigned",
        description: `${selectedTasks.length} task(s) have been reassigned successfully.`,
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/internal-tasks');
        }
      });
      setSelectedTasks([]);
      setBulkReassignOpen(false);
      setSelectedAssignee("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reassign tasks",
        variant: "destructive",
      });
    },
  });

  // Bulk status change mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return await apiRequest("POST", "/api/internal-tasks/bulk/update-status", {
        taskIds: selectedTasks,
        status,
      });
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: `${selectedTasks.length} task(s) have been updated successfully.`,
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/internal-tasks');
        }
      });
      setSelectedTasks([]);
      setBulkStatusOpen(false);
      setSelectedStatus("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task status",
        variant: "destructive",
      });
    },
  });

  const handleBulkReassign = () => {
    if (selectedAssignee) {
      bulkReassignMutation.mutate(selectedAssignee);
    }
  };

  const handleBulkStatusChange = () => {
    if (selectedStatus) {
      bulkStatusMutation.mutate(selectedStatus);
    }
  };

  const TaskTable = () => (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedTasks.length === tasks.length && tasks.length > 0}
                onCheckedChange={handleSelectAll}
                data-testid="checkbox-select-all"
              />
            </TableHead>
            <TableHead>Task</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              selected={selectedTasks.includes(task.id)}
              onSelect={(checked) => handleSelectTask(task.id, checked)}
              onViewClick={() => handleViewTask(task.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavigation user={user} />
      
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-tasks">
              <ClipboardList className="w-8 h-8" />
              Internal Tasks
            </h1>
            <p className="text-muted-foreground">Manage staff tasks and track progress</p>
          </div>
          <CreateTaskDialog />
        </div>

        {/* Tabs and Filters */}
        <Card>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <TabsList>
                  <TabsTrigger value="assigned" data-testid="tab-assigned">
                    Assigned to Me
                    {assignedTasks && assignedTasks.length > 0 && (
                      <Badge variant="secondary" className="ml-2" data-testid="count-assigned">
                        {assignedTasks.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="created" data-testid="tab-created">
                    Created by Me
                    {createdTasks && createdTasks.length > 0 && (
                      <Badge variant="secondary" className="ml-2" data-testid="count-created">
                        {createdTasks.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="all" data-testid="tab-all">
                    All Tasks
                    {allTasks && allTasks.length > 0 && (
                      <Badge variant="secondary" className="ml-2" data-testid="count-all">
                        {allTasks.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-status-all">All Statuses</SelectItem>
                      <SelectItem value="open" data-testid="option-status-open">Open</SelectItem>
                      <SelectItem value="in_progress" data-testid="option-status-in-progress">In Progress</SelectItem>
                      <SelectItem value="closed" data-testid="option-status-closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-priority-filter">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-priority-all">All Priorities</SelectItem>
                      <SelectItem value="low" data-testid="option-priority-low">Low</SelectItem>
                      <SelectItem value="medium" data-testid="option-priority-medium">Medium</SelectItem>
                      <SelectItem value="high" data-testid="option-priority-high">High</SelectItem>
                      <SelectItem value="urgent" data-testid="option-priority-urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bulk Actions Bar */}
              {selectedTasks.length > 0 && (
                <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between" data-testid="bulk-actions-bar">
                  <span className="text-sm font-medium" data-testid="text-selected-count">
                    {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
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
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTasks([])}
                      data-testid="button-clear-selection"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              <TabsContent value="assigned" className="mt-0">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
                    Loading tasks...
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-no-tasks">
                    No tasks assigned to you
                  </div>
                ) : (
                  <TaskTable />
                )}
              </TabsContent>

              <TabsContent value="created" className="mt-0">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
                    Loading tasks...
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-no-tasks">
                    No tasks created by you
                  </div>
                ) : (
                  <TaskTable />
                )}
              </TabsContent>

              <TabsContent value="all" className="mt-0">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
                    Loading tasks...
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-no-tasks">
                    No tasks found
                  </div>
                ) : (
                  <TaskTable />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Reassign Dialog */}
      <Dialog open={bulkReassignOpen} onOpenChange={setBulkReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Tasks</DialogTitle>
            <DialogDescription>
              Reassign {selectedTasks.length} selected task{selectedTasks.length !== 1 ? 's' : ''} to a new assignee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="bulk-assignee">Assign To</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger data-testid="select-bulk-assignee">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkReassignOpen(false)} data-testid="button-cancel-reassign">
              Cancel
            </Button>
            <Button
              onClick={handleBulkReassign}
              disabled={!selectedAssignee || bulkReassignMutation.isPending}
              data-testid="button-confirm-reassign"
            >
              {bulkReassignMutation.isPending ? "Reassigning..." : "Reassign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Change Dialog */}
      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Change status for {selectedTasks.length} selected task{selectedTasks.length !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="bulk-status">New Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-bulk-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkStatusOpen(false)} data-testid="button-cancel-status">
              Cancel
            </Button>
            <Button
              onClick={handleBulkStatusChange}
              disabled={!selectedStatus || bulkStatusMutation.isPending}
              data-testid="button-confirm-status"
            >
              {bulkStatusMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
