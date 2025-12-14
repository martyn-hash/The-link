import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Bell,
  Calendar,
  Clock,
  User,
  FileText,
  Link as LinkIcon,
  CheckCircle2,
  Loader2,
  Send,
  X,
  ExternalLink,
} from "lucide-react";
import type { InternalTask, TaskType, User as UserType, Client, Project, Person, Service, Message } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";

interface InternalTaskWithRelations extends InternalTask {
  taskType?: TaskType | null;
  assignee?: UserType | null;
  creator?: UserType | null;
  client?: Client | null;
  project?: Project | null;
  person?: Person | null;
  service?: Service | null;
  message?: Message | null;
  progressNotes?: Array<{
    id: string;
    content: string;
    createdAt: Date;
    userId: string;
    user?: UserType;
  }>;
}

interface TaskConnection {
  id: string;
  entityType: string;
  entityId: string;
  client?: Client | null;
  project?: Project | null;
  person?: Person | null;
}

interface TaskDetailModalProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "urgent": return "destructive";
    case "high": return "default";
    case "medium": return "secondary";
    case "low": return "outline";
    default: return "outline";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "open": return "default";
    case "in_progress": return "secondary";
    case "closed": return "outline";
    default: return "outline";
  }
}

export function TaskDetailModal({ taskId, open, onOpenChange }: TaskDetailModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [newProgressNote, setNewProgressNote] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closureNote, setClosureNote] = useState("");
  const [totalTimeSpent, setTotalTimeSpent] = useState("");

  const { data: task, isLoading: taskLoading } = useQuery<InternalTaskWithRelations>({
    queryKey: [`/api/internal-tasks/${taskId}`],
    enabled: !!taskId && open,
  });

  const { data: connections = [] } = useQuery<TaskConnection[]>({
    queryKey: [`/api/internal-tasks/${taskId}/connections`],
    enabled: !!taskId && open,
  });

  const { data: staff = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: taskTypes = [] } = useQuery<TaskType[]>({
    queryKey: ["/api/internal-task-types"],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (updates: Partial<InternalTask>) => {
      return await apiRequest("PATCH", `/api/internal-tasks/${taskId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/internal-tasks"),
      });
      toast({
        title: "Task updated",
        description: "Task has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      showFriendlyError({ error: error.message || "Failed to update task" });
    },
  });

  const addProgressNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/internal-tasks/${taskId}/progress-notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/internal-tasks"),
      });
      setNewProgressNote("");
      toast({
        title: "Progress note added",
        description: "Your progress note has been added successfully.",
      });
    },
    onError: (error: Error) => {
      showFriendlyError({ error: error.message || "Failed to add progress note" });
    },
  });

  const closeTaskMutation = useMutation({
    mutationFn: async ({ closureNote, totalTimeSpentMinutes }: { closureNote: string; totalTimeSpentMinutes: number }) => {
      return await apiRequest("POST", `/api/internal-tasks/${taskId}/close`, {
        closureNote,
        totalTimeSpentMinutes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/internal-tasks"),
      });
      toast({
        title: "Task closed",
        description: "The task has been marked as closed.",
      });
      setCloseDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showFriendlyError({ error: error.message || "Failed to close task" });
    },
  });

  const handleCloseTask = () => {
    const minutes = totalTimeSpent ? parseInt(totalTimeSpent, 10) : 0;
    closeTaskMutation.mutate({ closureNote, totalTimeSpentMinutes: minutes });
  };

  const handleAddProgressNote = () => {
    if (newProgressNote.trim()) {
      addProgressNoteMutation.mutate(newProgressNote.trim());
    }
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return 'Not set';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, "d MMM yyyy 'at' h:mm a");
  };

  if (!taskId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
          {taskLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !task ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground">Task not found</p>
            </div>
          ) : (
            <>
              <DialogHeader className="px-6 py-4 border-b">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {task.isQuickReminder ? (
                        <Bell className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      ) : (
                        <ClipboardList className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <DialogTitle className="text-xl truncate" data-testid="text-task-title">
                        {task.title}
                      </DialogTitle>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.isQuickReminder && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          <Bell className="w-3 h-3 mr-1" />
                          Reminder
                        </Badge>
                      )}
                      <Badge variant={getPriorityColor(task.priority)} data-testid="badge-priority">
                        {task.priority}
                      </Badge>
                      <Badge variant={getStatusColor(task.status)} data-testid="badge-status">
                        {task.status === "in_progress" ? "In Progress" : task.status}
                      </Badge>
                      {task.taskType && (
                        <Badge variant="outline">{task.taskType.name}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {task.status !== "closed" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setCloseDialogOpen(true)}
                        data-testid="button-close-task"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Close Task
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        setLocation(`/internal-tasks/${taskId}`);
                      }}
                      data-testid="button-open-full-page"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
                <div className="p-6 space-y-6">
                  {/* Description */}
                  {task.description && (
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                        {task.description}
                      </p>
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Assigned To</Label>
                      <Select
                        value={task.assignedTo || ""}
                        onValueChange={(value) => updateTaskMutation.mutate({ assignedTo: value })}
                        disabled={task.status === "closed"}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-assignee">
                          <SelectValue placeholder="Select assignee" />
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

                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select
                        value={task.status}
                        onValueChange={(value) => updateTaskMutation.mutate({ status: value as any })}
                        disabled={task.status === "closed"}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Priority</Label>
                      <Select
                        value={task.priority}
                        onValueChange={(value) => updateTaskMutation.mutate({ priority: value as any })}
                        disabled={task.status === "closed"}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Due Date</Label>
                      <Input
                        type="date"
                        className="mt-1"
                        value={task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : ''}
                        onChange={(e) => updateTaskMutation.mutate({ dueDate: e.target.value ? new Date(e.target.value) : undefined })}
                        disabled={task.status === "closed"}
                        data-testid="input-due-date"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Task Type</Label>
                      <Select
                        value={task.taskTypeId || ""}
                        onValueChange={(value) => updateTaskMutation.mutate({ taskTypeId: value })}
                        disabled={task.status === "closed"}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-task-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {taskTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Created By</Label>
                      <p className="mt-2 text-sm">
                        {task.creator ? `${task.creator.firstName} ${task.creator.lastName}` : 'Unknown'}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Connections */}
                  {connections.length > 0 && (
                    <>
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <LinkIcon className="h-4 w-4" />
                          Linked Items
                        </Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {connections.map((conn) => (
                            <Badge key={conn.id} variant="outline" className="py-1">
                              {conn.entityType === 'client' && conn.client?.name}
                              {conn.entityType === 'project' && conn.project?.description}
                              {conn.entityType === 'person' && conn.person && `${conn.person.firstName} ${conn.person.lastName}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Progress Notes */}
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Progress Notes
                    </Label>
                    
                    {task.status !== "closed" && (
                      <div className="mt-3 flex gap-2">
                        <Textarea
                          placeholder="Add a progress note..."
                          value={newProgressNote}
                          onChange={(e) => setNewProgressNote(e.target.value)}
                          className="min-h-[60px]"
                          data-testid="input-progress-note"
                        />
                        <Button
                          onClick={handleAddProgressNote}
                          disabled={!newProgressNote.trim() || addProgressNoteMutation.isPending}
                          size="sm"
                          className="self-end"
                          data-testid="button-add-note"
                        >
                          {addProgressNoteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}

                    {task.progressNotes && task.progressNotes.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {task.progressNotes.map((note) => (
                          <Card key={note.id} className="bg-muted/50">
                            <CardContent className="p-3">
                              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span>
                                  {note.user ? `${note.user.firstName} ${note.user.lastName}` : 'Unknown'}
                                </span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">No progress notes yet</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Close Task Dialog */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Task</AlertDialogTitle>
            <AlertDialogDescription>
              Add a closing note and time spent (optional).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="closure-note">Closure Note</Label>
              <Textarea
                id="closure-note"
                value={closureNote}
                onChange={(e) => setClosureNote(e.target.value)}
                placeholder="Add any final notes about this task..."
                className="mt-2"
                data-testid="input-closure-note"
              />
            </div>
            <div>
              <Label htmlFor="total-time">Total Time Spent (minutes)</Label>
              <Input
                id="total-time"
                type="number"
                value={totalTimeSpent}
                onChange={(e) => setTotalTimeSpent(e.target.value)}
                placeholder="0"
                min="0"
                className="mt-2"
                data-testid="input-total-time"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-close">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseTask}
              disabled={closeTaskMutation.isPending}
              data-testid="button-confirm-close"
            >
              {closeTaskMutation.isPending ? "Closing..." : "Close Task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
