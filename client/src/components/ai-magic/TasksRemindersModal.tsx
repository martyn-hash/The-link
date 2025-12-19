import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList,
  Bell,
  Clock,
  ChevronRight,
  Building2,
  FolderKanban,
  Eye,
  ExternalLink,
  User as UserIcon,
  AlertCircle,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import type { InternalTask, TaskType, User, Client, Project, Person } from "@shared/schema";

interface TaskConnection {
  id: string;
  entityType: string;
  entityId: string;
  client?: Client | null;
  project?: Project | null;
  person?: Person | null;
}

interface CachedTasksResponse {
  data: InternalTaskWithRelations[];
  fromCache: boolean;
  cachedAt: string | null;
  isStale: boolean;
  staleAt: string | null;
}

interface InternalTaskWithRelations extends InternalTask {
  taskType?: TaskType | null;
  assignee?: User | null;
  creator?: User | null;
  connections?: TaskConnection[];
}

interface ProjectWithRelations {
  id: string;
  description: string;
  dueDate: string | null;
  currentStatus: string;
  isBenched: boolean;
  client?: { id: string; name: string } | null;
  projectType?: { id: string; name: string } | null;
  currentAssignee?: { id: string; firstName: string; lastName: string } | null;
}

interface TasksRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "tasks" | "reminders";
  filterUserId?: string;
  filterUserName?: string;
}

function TaskItem({ task, onClick }: { task: InternalTaskWithRelations; onClick: () => void }) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-blue-500 text-white";
      case "low": return "bg-gray-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "in_progress": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case "closed": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== "closed";

  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
      data-testid={`task-item-${task.id}`}
    >
      <ClipboardList className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{task.title}</span>
          <Badge className={`text-[10px] px-1.5 py-0 ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </Badge>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getStatusColor(task.status)}`}>
            {task.status === "in_progress" ? "In Progress" : task.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {task.taskType?.name && <span>{task.taskType.name}</span>}
          {task.dueDate && (
            <span className={isOverdue ? "text-red-500 font-medium" : ""}>
              Due {format(new Date(task.dueDate), "d MMM")}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

function ReminderItem({ task, onClick }: { task: InternalTaskWithRelations; onClick: () => void }) {
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== "closed";
  const isDueToday = task.dueDate && isToday(new Date(task.dueDate));

  const getLinkedEntityName = () => {
    if (!task.connections || task.connections.length === 0) return null;
    const conn = task.connections[0];
    if (conn.entityType === 'client' && conn.client) return conn.client.name;
    if (conn.entityType === 'project' && conn.project) return conn.project.description || 'Project';
    if (conn.entityType === 'person' && conn.person) return `${conn.person.firstName} ${conn.person.lastName}`;
    return null;
  };

  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
      data-testid={`reminder-item-${task.id}`}
    >
      <Bell className={`w-4 h-4 flex-shrink-0 ${isOverdue ? "text-red-500" : isDueToday ? "text-amber-500" : "text-muted-foreground"}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{task.title}</div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {getLinkedEntityName() && (
            <span className="text-primary">{getLinkedEntityName()}</span>
          )}
          {task.dueDate && (
            <span className={isOverdue ? "text-red-500 font-medium" : isDueToday ? "text-amber-500" : ""}>
              {format(new Date(task.dueDate), "d MMM h:mm a")}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

function ProjectItem({ project, onClick }: { project: ProjectWithRelations; onClick: () => void }) {
  const isOverdue = project.dueDate && isPast(new Date(project.dueDate)) && !project.isBenched;

  const getStatusColor = (status: string) => {
    if (status.toLowerCase().includes("complete")) return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    if (status.toLowerCase().includes("progress")) return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    if (status.toLowerCase().includes("review")) return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  };

  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
      data-testid={`project-item-${project.id}`}
    >
      <FolderKanban className="w-4 h-4 text-indigo-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{project.description}</span>
          {project.isBenched && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700">
              Benched
            </Badge>
          )}
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getStatusColor(project.currentStatus)}`}>
            {project.currentStatus}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {project.client?.name && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {project.client.name}
            </span>
          )}
          {project.projectType?.name && <span>{project.projectType.name}</span>}
          {project.dueDate && (
            <span className={isOverdue ? "text-red-500 font-medium" : ""}>
              Due {format(new Date(project.dueDate), "d MMM")}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

interface OverdueWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterUserId?: string;
  filterUserName?: string;
}

export function OverdueWorkModal({ 
  isOpen, 
  onClose, 
  filterUserId,
  filterUserName 
}: OverdueWorkModalProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"tasks" | "reminders">("tasks");

  const effectiveUserId = filterUserId || user?.id;

  const { data: tasksResponse, isLoading: isLoadingTasks } = useQuery<CachedTasksResponse>({
    queryKey: ['/api/internal-tasks/assigned', effectiveUserId],
    queryFn: async () => {
      const response = await fetch(`/api/internal-tasks/assigned/${effectiveUserId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    enabled: isOpen && !!effectiveUserId,
  });

  // Extract the data array from the wrapped response
  const tasks = tasksResponse?.data ?? [];

  const overdueTasks = useMemo(() => 
    tasks.filter(t => 
      !t.isQuickReminder && 
      t.status !== "closed" && 
      t.dueDate && 
      isPast(new Date(t.dueDate))
    ),
    [tasks]
  );

  const overdueReminders = useMemo(() => 
    tasks.filter(t => 
      t.isQuickReminder === true && 
      t.status !== "closed" && 
      t.dueDate && 
      isPast(new Date(t.dueDate))
    ),
    [tasks]
  );

  const handleViewTask = (taskId: string) => {
    onClose();
    setLocation(`/internal-tasks/${taskId}`);
  };

  const handleViewAllTasks = () => {
    onClose();
    setLocation('/internal-tasks?tab=tasks');
  };

  const handleViewAllReminders = () => {
    onClose();
    setLocation('/internal-tasks?tab=reminders');
  };

  const displayName = filterUserName || (user ? `${user.firstName} ${user.lastName}` : "Your");
  const isViewingOther = filterUserId && filterUserId !== user?.id;
  const totalOverdue = overdueTasks.length + overdueReminders.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0" data-testid="modal-overdue-work">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
          <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            {isViewingOther ? `${filterUserName}'s Overdue Work` : "My Overdue Work"}
            {totalOverdue > 0 && (
              <Badge variant="destructive" className="ml-2">
                {totalOverdue}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "tasks" | "reminders")} className="flex-1">
          <div className="px-6 pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="tasks" className="flex-1 gap-2" data-testid="tab-overdue-tasks">
                <ClipboardList className="w-4 h-4" />
                Overdue Tasks
                <Badge variant={overdueTasks.length > 0 ? "destructive" : "secondary"} className="ml-1">
                  {overdueTasks.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="reminders" className="flex-1 gap-2" data-testid="tab-overdue-reminders">
                <Bell className="w-4 h-4" />
                Overdue Reminders
                <Badge variant={overdueReminders.length > 0 ? "destructive" : "secondary"} className="ml-1">
                  {overdueReminders.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tasks" className="mt-0 flex-1">
            <ScrollArea className="h-[400px] px-6 py-4">
              {isLoadingTasks ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : overdueTasks.length > 0 ? (
                <div className="space-y-2">
                  {overdueTasks.map(task => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      onClick={() => handleViewTask(task.id)} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="text-muted-foreground">No overdue tasks - great job!</p>
                </div>
              )}
            </ScrollArea>
            <div className="px-6 py-3 border-t flex justify-end">
              <Button variant="outline" size="sm" onClick={handleViewAllTasks} data-testid="button-view-all-tasks-overdue">
                <ExternalLink className="w-4 h-4 mr-2" />
                View All Tasks
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="reminders" className="mt-0 flex-1">
            <ScrollArea className="h-[400px] px-6 py-4">
              {isLoadingTasks ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : overdueReminders.length > 0 ? (
                <div className="space-y-2">
                  {overdueReminders.map(reminder => (
                    <ReminderItem 
                      key={reminder.id} 
                      task={reminder} 
                      onClick={() => handleViewTask(reminder.id)} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="text-muted-foreground">No overdue reminders - all caught up!</p>
                </div>
              )}
            </ScrollArea>
            <div className="px-6 py-3 border-t flex justify-end">
              <Button variant="outline" size="sm" onClick={handleViewAllReminders} data-testid="button-view-all-reminders-overdue">
                <ExternalLink className="w-4 h-4 mr-2" />
                View All Reminders
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function TasksRemindersModal({ 
  isOpen, 
  onClose, 
  initialTab = "tasks",
  filterUserId,
  filterUserName 
}: TasksRemindersModalProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"tasks" | "reminders">(initialTab);

  const effectiveUserId = filterUserId || user?.id;

  const { data: tasksResponse2, isLoading: isLoadingTasks } = useQuery<CachedTasksResponse>({
    queryKey: ['/api/internal-tasks/assigned', effectiveUserId],
    queryFn: async () => {
      const response = await fetch(`/api/internal-tasks/assigned/${effectiveUserId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    enabled: isOpen && !!effectiveUserId,
  });

  // Extract the data array from the wrapped response
  const tasks = tasksResponse2?.data ?? [];

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<ProjectWithRelations[]>({
    queryKey: ['/api/projects', 'assigned', effectiveUserId],
    queryFn: async () => {
      const response = await fetch(`/api/projects?assigneeId=${effectiveUserId}&active=true`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: isOpen && !!effectiveUserId && activeTab === "tasks",
  });

  const internalTasks = useMemo(() => 
    tasks.filter(t => !t.isQuickReminder && t.status !== "closed"),
    [tasks]
  );

  const reminders = useMemo(() => 
    tasks.filter(t => t.isQuickReminder === true && t.status !== "closed"),
    [tasks]
  );

  const activeProjects = useMemo(() => 
    projects.filter(p => !p.isBenched),
    [projects]
  );

  const handleViewTask = (taskId: string) => {
    onClose();
    setLocation(`/internal-tasks/${taskId}`);
  };

  const handleViewProject = (projectId: string) => {
    onClose();
    setLocation(`/projects/${projectId}`);
  };

  const handleViewAllTasks = () => {
    onClose();
    setLocation('/internal-tasks?tab=tasks');
  };

  const handleViewAllReminders = () => {
    onClose();
    setLocation('/internal-tasks?tab=reminders');
  };

  const displayName = filterUserName || (user ? `${user.firstName} ${user.lastName}` : "Your");
  const isViewingOther = filterUserId && filterUserId !== user?.id;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0" data-testid="modal-tasks-reminders">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            {isViewingOther && <UserIcon className="w-5 h-5 text-muted-foreground" />}
            {isViewingOther ? `${filterUserName}'s Tasks & Reminders` : "My Tasks & Reminders"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "tasks" | "reminders")} className="flex-1">
          <div className="px-6 pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="tasks" className="flex-1 gap-2" data-testid="tab-tasks">
                <ClipboardList className="w-4 h-4" />
                Tasks
                <Badge variant="secondary" className="ml-1">
                  {internalTasks.length + activeProjects.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="reminders" className="flex-1 gap-2" data-testid="tab-reminders">
                <Bell className="w-4 h-4" />
                Reminders
                <Badge variant="secondary" className="ml-1">
                  {reminders.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tasks" className="mt-0 flex-1">
            <ScrollArea className="h-[400px] px-6 py-4">
              {isLoadingTasks || isLoadingProjects ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {activeProjects.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <FolderKanban className="w-4 h-4" />
                        Assigned Projects ({activeProjects.length})
                      </h3>
                      <div className="space-y-2">
                        {activeProjects.slice(0, 5).map(project => (
                          <ProjectItem 
                            key={project.id} 
                            project={project} 
                            onClick={() => handleViewProject(project.id)} 
                          />
                        ))}
                        {activeProjects.length > 5 && (
                          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleViewAllTasks}>
                            +{activeProjects.length - 5} more projects
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {internalTasks.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        Internal Tasks ({internalTasks.length})
                      </h3>
                      <div className="space-y-2">
                        {internalTasks.slice(0, 5).map(task => (
                          <TaskItem 
                            key={task.id} 
                            task={task} 
                            onClick={() => handleViewTask(task.id)} 
                          />
                        ))}
                        {internalTasks.length > 5 && (
                          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleViewAllTasks}>
                            +{internalTasks.length - 5} more tasks
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {internalTasks.length === 0 && activeProjects.length === 0 && (
                    <div className="text-center py-12">
                      <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No open tasks or assigned projects</p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
            <div className="px-6 py-3 border-t flex justify-end">
              <Button variant="outline" size="sm" onClick={handleViewAllTasks} data-testid="button-view-all-tasks">
                <ExternalLink className="w-4 h-4 mr-2" />
                View All Tasks
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="reminders" className="mt-0 flex-1">
            <ScrollArea className="h-[400px] px-6 py-4">
              {isLoadingTasks ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : reminders.length > 0 ? (
                <div className="space-y-2">
                  {reminders.map(reminder => (
                    <ReminderItem 
                      key={reminder.id} 
                      task={reminder} 
                      onClick={() => handleViewTask(reminder.id)} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No pending reminders</p>
                </div>
              )}
            </ScrollArea>
            <div className="px-6 py-3 border-t flex justify-end">
              <Button variant="outline" size="sm" onClick={handleViewAllReminders} data-testid="button-view-all-reminders">
                <ExternalLink className="w-4 h-4 mr-2" />
                View All Reminders
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
