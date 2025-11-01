import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  User as UserIcon,
  MessageSquare,
  FileText,
  Link as LinkIcon,
  Paperclip,
  PlayCircle,
  StopCircle,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { InternalTask, TaskType, User, Client, Project, Person, Service, Message } from "@shared/schema";

interface TaskDetailDialogProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InternalTaskWithRelations extends InternalTask {
  taskType?: TaskType | null;
  assignee?: User | null;
  creator?: User | null;
  client?: Client | null;
  project?: Project | null;
  person?: Person | null;
  service?: Service | null;
  message?: Message | null;
  comments?: Array<{
    id: string;
    content: string;
    createdAt: Date;
    author: User;
  }>;
  notes?: Array<{
    id: string;
    content: string;
    createdAt: Date;
    author: User;
  }>;
  timeEntries?: Array<{
    id: string;
    startTime: Date;
    endTime: Date | null;
    duration: number | null;
    description: string | null;
    user: User;
  }>;
}

export function TaskDetailDialog({ taskId, open, onOpenChange }: TaskDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [newNote, setNewNote] = useState("");
  const [activeTimer, setActiveTimer] = useState<string | null>(null);

  // Fetch task details
  const { data: task, isLoading } = useQuery<InternalTaskWithRelations>({
    queryKey: [`/api/internal-tasks/${taskId}`],
    enabled: !!taskId && open,
  });

  // Initialize active timer from task data
  useEffect(() => {
    if (task?.timeEntries) {
      const runningEntry = task.timeEntries.find(entry => !entry.endTime);
      setActiveTimer(runningEntry?.id || null);
    }
  }, [task]);

  // Fetch staff for reassignment
  const { data: staff = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: open,
  });

  // Fetch task types
  const { data: taskTypes = [] } = useQuery<TaskType[]>({
    queryKey: ["/api/internal-task-types"],
    enabled: open,
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/internal-tasks/${taskId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/internal-tasks"),
      });
      setNewComment("");
      toast({
        title: "Comment added",
        description: "Your comment has been posted successfully.",
      });
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/internal-tasks/${taskId}/notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/internal-tasks"),
      });
      setNewNote("");
      toast({
        title: "Note added",
        description: "Progress note has been added successfully.",
      });
    },
  });

  // Start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/internal-tasks/${taskId}/time-entries`, {
        description: null,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/internal-tasks"),
      });
      setActiveTimer(data.id);
      toast({
        title: "Timer started",
        description: "Time tracking has begun for this task.",
      });
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: async ({ entryId, description }: { entryId: string; description: string | null }) => {
      return await apiRequest("PATCH", `/api/internal-tasks/${taskId}/time-entries/${entryId}/stop`, {
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/internal-tasks"),
      });
      setActiveTimer(null);
      toast({
        title: "Timer stopped",
        description: "Time entry has been recorded.",
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async (updates: Partial<InternalTask>) => {
      return await apiRequest("PATCH", `/api/internal-tasks/${taskId}`, updates);
    },
    onSuccess: () => {
      // Invalidate all internal tasks queries to ensure all views update
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
  });

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "closed":
        return "outline";
      case "in_progress":
        return "default";
      case "open":
        return "secondary";
      default:
        return "secondary";
    }
  };

  if (!taskId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : task ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <DialogTitle className="text-2xl" data-testid="text-task-title">
                    {task.title}
                  </DialogTitle>
                  <DialogDescription>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getPriorityColor(task.priority)} data-testid="badge-priority">
                        {task.priority}
                      </Badge>
                      <Badge variant={getStatusColor(task.status)} data-testid="badge-status">
                        {task.status === "in_progress" ? "In Progress" : task.status}
                      </Badge>
                      {task.taskType && (
                        <Badge variant="outline" data-testid="badge-task-type">
                          {task.taskType.name}
                        </Badge>
                      )}
                    </div>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
                <TabsTrigger value="connections" data-testid="tab-connections">Connections</TabsTrigger>
                <TabsTrigger value="comments" data-testid="tab-comments">
                  Comments {task.comments && task.comments.length > 0 && `(${task.comments.length})`}
                </TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-notes">
                  Notes {task.notes && task.notes.length > 0 && `(${task.notes.length})`}
                </TabsTrigger>
                <TabsTrigger value="time" data-testid="tab-time">Time Tracking</TabsTrigger>
                <TabsTrigger value="attachments" data-testid="tab-attachments">Attachments</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Task Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Assigned To</Label>
                        <Select
                          value={task.assignedTo || ""}
                          onValueChange={(value) => updateTaskMutation.mutate({ assignedTo: value })}
                          data-testid="select-assignee"
                        >
                          <SelectTrigger>
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

                      <div>
                        <Label>Status</Label>
                        <Select
                          value={task.status}
                          onValueChange={(value) => updateTaskMutation.mutate({ status: value as any })}
                          data-testid="select-status"
                        >
                          <SelectTrigger>
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
                        <Label>Priority</Label>
                        <Select
                          value={task.priority}
                          onValueChange={(value) => updateTaskMutation.mutate({ priority: value as any })}
                          data-testid="select-priority"
                        >
                          <SelectTrigger>
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
                        <Label>Task Type</Label>
                        <Select
                          value={task.taskTypeId || ""}
                          onValueChange={(value) => updateTaskMutation.mutate({ taskTypeId: value })}
                          data-testid="select-task-type"
                        >
                          <SelectTrigger>
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
                        <Label>Due Date</Label>
                        <Input
                          type="date"
                          value={task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : ''}
                          onChange={(e) => updateTaskMutation.mutate({ dueDate: e.target.value ? new Date(e.target.value) : null })}
                          data-testid="input-due-date"
                        />
                      </div>

                      <div>
                        <Label>Created By</Label>
                        <p className="text-sm mt-2" data-testid="text-creator">
                          {task.creator ? `${task.creator.firstName} ${task.creator.lastName}` : 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={task.description || ''}
                        onChange={(e) => updateTaskMutation.mutate({ description: e.target.value })}
                        rows={4}
                        placeholder="Add task description..."
                        data-testid="textarea-description"
                      />
                    </div>

                    {task.closedAt && (
                      <div className="border-t pt-4 space-y-2">
                        <h4 className="font-semibold text-sm">Closure Information</h4>
                        <div className="text-sm space-y-1">
                          <p data-testid="text-closed-at">
                            <strong>Closed:</strong> {format(new Date(task.closedAt), 'PPpp')}
                          </p>
                          {task.closureNote && (
                            <p data-testid="text-closure-note">
                              <strong>Note:</strong> {task.closureNote}
                            </p>
                          )}
                          {task.totalTimeSpentMinutes && (
                            <p data-testid="text-total-time">
                              <strong>Total Time:</strong> {formatDuration(task.totalTimeSpentMinutes)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="connections" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <LinkIcon className="w-4 h-4" />
                      Connected Entities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {task.client && (
                      <div className="flex items-center gap-2 p-2 border rounded" data-testid="connection-client">
                        <Badge variant="outline">Client</Badge>
                        <span className="font-medium">{task.client.name}</span>
                      </div>
                    )}
                    {task.project && (
                      <div className="flex items-center gap-2 p-2 border rounded" data-testid="connection-project">
                        <Badge variant="outline">Project</Badge>
                        <span className="font-medium">{task.project.description}</span>
                      </div>
                    )}
                    {task.person && (
                      <div className="flex items-center gap-2 p-2 border rounded" data-testid="connection-person">
                        <Badge variant="outline">Person</Badge>
                        <span className="font-medium">{task.person.fullName}</span>
                      </div>
                    )}
                    {task.service && (
                      <div className="flex items-center gap-2 p-2 border rounded" data-testid="connection-service">
                        <Badge variant="outline">Service</Badge>
                        <span className="font-medium">{task.service.name}</span>
                      </div>
                    )}
                    {task.message && (
                      <div className="flex items-center gap-2 p-2 border rounded" data-testid="connection-message">
                        <Badge variant="outline">Message</Badge>
                        <span className="font-medium">Message #{task.message.id}</span>
                      </div>
                    )}
                    {!task.client && !task.project && !task.person && !task.service && !task.message && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No connections to other entities.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Comments
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {task.comments && task.comments.length > 0 ? (
                        task.comments.map((comment) => (
                          <div key={comment.id} className="border rounded p-3 space-y-2" data-testid={`comment-${comment.id}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold">
                                {comment.author.firstName} {comment.author.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No comments yet. Be the first to comment!
                        </p>
                      )}
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <Label htmlFor="new-comment">Add Comment</Label>
                      <Textarea
                        id="new-comment"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        rows={3}
                        data-testid="textarea-new-comment"
                      />
                      <Button
                        onClick={() => addCommentMutation.mutate(newComment)}
                        disabled={!newComment.trim() || addCommentMutation.isPending}
                        data-testid="button-add-comment"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Post Comment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Progress Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {task.notes && task.notes.length > 0 ? (
                        task.notes.map((note) => (
                          <div key={note.id} className="border rounded p-3 space-y-2" data-testid={`note-${note.id}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold">
                                {note.author.firstName} {note.author.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No progress notes yet.
                        </p>
                      )}
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <Label htmlFor="new-note">Add Progress Note</Label>
                      <Textarea
                        id="new-note"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Document progress updates..."
                        rows={3}
                        data-testid="textarea-new-note"
                      />
                      <Button
                        onClick={() => addNoteMutation.mutate(newNote)}
                        disabled={!newNote.trim() || addNoteMutation.isPending}
                        data-testid="button-add-note"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Add Note
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="time" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time Tracking
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {task.timeEntries?.some(entry => !entry.endTime) ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const activeEntry = task.timeEntries?.find(entry => !entry.endTime);
                              if (activeEntry) {
                                stopTimerMutation.mutate({ entryId: activeEntry.id, description: null });
                              }
                            }}
                            disabled={stopTimerMutation.isPending}
                            data-testid="button-stop-timer"
                          >
                            <StopCircle className="w-4 h-4 mr-2" />
                            Stop Timer
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => startTimerMutation.mutate()}
                            disabled={startTimerMutation.isPending}
                            data-testid="button-start-timer"
                          >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            Start Timer
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {task.timeEntries && task.timeEntries.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Start Time</TableHead>
                            <TableHead>End Time</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {task.timeEntries.map((entry) => (
                            <TableRow key={entry.id} data-testid={`time-entry-${entry.id}`}>
                              <TableCell className="text-sm">
                                {entry.user.firstName} {entry.user.lastName}
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(entry.startTime), 'PPp')}
                              </TableCell>
                              <TableCell className="text-sm">
                                {entry.endTime ? format(new Date(entry.endTime), 'PPp') : (
                                  <Badge variant="default">Running</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {entry.duration ? formatDuration(entry.duration) : '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {entry.description || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No time entries yet. Start the timer to begin tracking time.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="attachments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Attachments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Attachment functionality coming soon.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Task not found.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
