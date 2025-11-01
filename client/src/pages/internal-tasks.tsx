import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Plus,
  Filter,
  MoreVertical,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";
import type { InternalTask, TaskType, User } from "@shared/schema";

interface InternalTaskWithRelations extends InternalTask {
  taskType?: TaskType | null;
  assignee?: User | null;
  creator?: User | null;
}

export default function InternalTasks() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"assigned" | "created" | "all">("assigned");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <Circle className="w-4 h-4 text-blue-500" data-testid={`icon-status-open`} />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-yellow-500" data-testid={`icon-status-in-progress`} />;
      case "closed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" data-testid={`icon-status-closed`} />;
      default:
        return <Circle className="w-4 h-4" data-testid={`icon-status-default`} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="secondary" data-testid={`badge-status-open`}>Open</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-yellow-500" data-testid={`badge-status-in-progress`}>In Progress</Badge>;
      case "closed":
        return <Badge variant="default" className="bg-green-500" data-testid={`badge-status-closed`}>Closed</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-default`}>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "low":
        return <Badge variant="outline" data-testid={`badge-priority-low`}>Low</Badge>;
      case "medium":
        return <Badge variant="secondary" data-testid={`badge-priority-medium`}>Medium</Badge>;
      case "high":
        return <Badge variant="destructive" data-testid={`badge-priority-high`}>High</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-priority-default`}>{priority}</Badge>;
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return null;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background">
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
          <Button data-testid="button-create-task">
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Button>
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
                    <Button variant="outline" size="sm" data-testid="button-bulk-reassign">
                      Reassign
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-bulk-status">
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
                  <div className="space-y-3">
                    {/* Select All */}
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Checkbox
                        checked={selectedTasks.length === tasks.length && tasks.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                      <span className="text-sm font-medium">Select All</span>
                    </div>

                    {tasks.map((task) => (
                      <Card key={task.id} className="hover:bg-accent/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedTasks.includes(task.id)}
                              onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)}
                              data-testid={`checkbox-task-${task.id}`}
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <Link href={`/internal-tasks/${task.id}`}>
                                    <h3 className="font-semibold hover:underline cursor-pointer" data-testid={`link-task-${task.id}`}>
                                      {task.title}
                                    </h3>
                                  </Link>
                                  {task.description && (
                                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-description-${task.id}`}>
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" data-testid={`button-menu-${task.id}`}>
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem data-testid={`menu-edit-${task.id}`}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem data-testid={`menu-close-${task.id}`}>Close Task</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" data-testid={`menu-delete-${task.id}`}>
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <div className="flex items-center gap-1">
                                  {getStatusIcon(task.status)}
                                  {getStatusBadge(task.status)}
                                </div>
                                {getPriorityBadge(task.priority)}
                                {task.taskType && (
                                  <Badge variant="outline" data-testid={`badge-type-${task.id}`}>
                                    {task.taskType.name}
                                  </Badge>
                                )}
                                {task.dueDate && (
                                  <span className="text-muted-foreground flex items-center gap-1" data-testid={`text-due-${task.id}`}>
                                    <Clock className="w-3 h-3" />
                                    Due: {formatDate(task.dueDate)}
                                  </span>
                                )}
                                {task.assignee && (
                                  <span className="text-muted-foreground" data-testid={`text-assignee-${task.id}`}>
                                    Assigned to: {task.assignee.firstName} {task.assignee.lastName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
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
                  <div className="space-y-3">
                    {/* Select All */}
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Checkbox
                        checked={selectedTasks.length === tasks.length && tasks.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                      <span className="text-sm font-medium">Select All</span>
                    </div>

                    {tasks.map((task) => (
                      <Card key={task.id} className="hover:bg-accent/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedTasks.includes(task.id)}
                              onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)}
                              data-testid={`checkbox-task-${task.id}`}
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <Link href={`/internal-tasks/${task.id}`}>
                                    <h3 className="font-semibold hover:underline cursor-pointer" data-testid={`link-task-${task.id}`}>
                                      {task.title}
                                    </h3>
                                  </Link>
                                  {task.description && (
                                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-description-${task.id}`}>
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" data-testid={`button-menu-${task.id}`}>
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem data-testid={`menu-edit-${task.id}`}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem data-testid={`menu-close-${task.id}`}>Close Task</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" data-testid={`menu-delete-${task.id}`}>
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <div className="flex items-center gap-1">
                                  {getStatusIcon(task.status)}
                                  {getStatusBadge(task.status)}
                                </div>
                                {getPriorityBadge(task.priority)}
                                {task.taskType && (
                                  <Badge variant="outline" data-testid={`badge-type-${task.id}`}>
                                    {task.taskType.name}
                                  </Badge>
                                )}
                                {task.dueDate && (
                                  <span className="text-muted-foreground flex items-center gap-1" data-testid={`text-due-${task.id}`}>
                                    <Clock className="w-3 h-3" />
                                    Due: {formatDate(task.dueDate)}
                                  </span>
                                )}
                                {task.assignee && (
                                  <span className="text-muted-foreground" data-testid={`text-assignee-${task.id}`}>
                                    Assigned to: {task.assignee.firstName} {task.assignee.lastName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
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
                  <div className="space-y-3">
                    {/* Select All */}
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Checkbox
                        checked={selectedTasks.length === tasks.length && tasks.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                      <span className="text-sm font-medium">Select All</span>
                    </div>

                    {tasks.map((task) => (
                      <Card key={task.id} className="hover:bg-accent/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedTasks.includes(task.id)}
                              onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)}
                              data-testid={`checkbox-task-${task.id}`}
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <Link href={`/internal-tasks/${task.id}`}>
                                    <h3 className="font-semibold hover:underline cursor-pointer" data-testid={`link-task-${task.id}`}>
                                      {task.title}
                                    </h3>
                                  </Link>
                                  {task.description && (
                                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-description-${task.id}`}>
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" data-testid={`button-menu-${task.id}`}>
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem data-testid={`menu-edit-${task.id}`}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem data-testid={`menu-close-${task.id}`}>Close Task</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" data-testid={`menu-delete-${task.id}`}>
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <div className="flex items-center gap-1">
                                  {getStatusIcon(task.status)}
                                  {getStatusBadge(task.status)}
                                </div>
                                {getPriorityBadge(task.priority)}
                                {task.taskType && (
                                  <Badge variant="outline" data-testid={`badge-type-${task.id}`}>
                                    {task.taskType.name}
                                  </Badge>
                                )}
                                {task.dueDate && (
                                  <span className="text-muted-foreground flex items-center gap-1" data-testid={`text-due-${task.id}`}>
                                    <Clock className="w-3 h-3" />
                                    Due: {formatDate(task.dueDate)}
                                  </span>
                                )}
                                {task.assignee && (
                                  <span className="text-muted-foreground" data-testid={`text-assignee-${task.id}`}>
                                    Assigned to: {task.assignee.firstName} {task.assignee.lastName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
