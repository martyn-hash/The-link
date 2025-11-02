import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import {
  ArrowLeft,
  Clock,
  MessageSquare,
  FileText,
  Link as LinkIcon,
  Paperclip,
  PlayCircle,
  StopCircle,
  CheckCircle2,
  Download,
  Trash2,
  Upload,
} from "lucide-react";
import TopNavigation from "@/components/top-navigation";
import { formatDistanceToNow, format } from "date-fns";
import { useEffect, useState, useRef } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InternalTask, TaskType, User, Client, Project, Person, Service, Message } from "@shared/schema";

interface TaskDocument {
  id: string;
  taskId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  createdAt: Date;
  uploader?: User;
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

export default function InternalTaskDetail() {
  const { id: taskId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [newNote, setNewNote] = useState("");
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closureNote, setClosureNote] = useState("");
  const [totalTimeSpent, setTotalTimeSpent] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch task details
  const {
    data: task,
    isLoading: taskLoading,
    error: taskError,
  } = useQuery<InternalTaskWithRelations>({
    queryKey: [`/api/internal-tasks/${taskId}`],
    enabled: isAuthenticated && !!user && !!taskId,
    retry: false,
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
  });

  // Fetch task types
  const { data: taskTypes = [] } = useQuery<TaskType[]>({
    queryKey: ["/api/internal-task-types"],
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Handle query errors
  useEffect(() => {
    if (taskError && isUnauthorizedError(taskError)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [taskError, toast]);

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

  // Fetch documents
  const { data: documents = [] } = useQuery<TaskDocument[]>({
    queryKey: [`/api/internal-tasks/${taskId}/documents`],
    enabled: !!taskId,
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/internal-tasks/${taskId}/documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/internal-tasks/${taskId}/documents`] });
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({
        title: "Document uploaded",
        description: "File has been uploaded successfully.",
      });
    },
    onError: () => {
      setUploadingFile(false);
      toast({
        title: "Upload failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return await apiRequest("DELETE", `/api/task-documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/internal-tasks/${taskId}/documents`] });
      toast({
        title: "Document deleted",
        description: "File has been removed successfully.",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB.",
          variant: "destructive",
        });
        return;
      }
      setUploadingFile(true);
      uploadDocumentMutation.mutate(file);
    }
  };

  const handleDownload = async (doc: TaskDocument) => {
    try {
      const response = await fetch(`/api/task-documents/${doc.id}/download`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download document.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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

  // Close task mutation
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
      setCloseDialogOpen(false);
      setClosureNote("");
      setTotalTimeSpent("");
      toast({
        title: "Task closed",
        description: "Task has been closed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to close task. Please try again.",
        variant: "destructive",
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

  const handleBack = () => {
    setLocation("/internal-tasks");
  };

  const handleCloseTask = () => {
    const minutes = parseInt(totalTimeSpent);
    if (!closureNote.trim()) {
      toast({
        title: "Closure note required",
        description: "Please provide a note explaining task completion.",
        variant: "destructive",
      });
      return;
    }
    if (isNaN(minutes) || minutes < 0) {
      toast({
        title: "Invalid time",
        description: "Please enter a valid time in minutes.",
        variant: "destructive",
      });
      return;
    }
    closeTaskMutation.mutate({ closureNote, totalTimeSpentMinutes: minutes });
  };

  // Loading state
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (taskLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="container mx-auto py-6 px-4">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="container mx-auto py-6 px-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tasks
          </Button>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Task not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavigation />

      <div className="container mx-auto py-6 px-4 max-w-6xl">
        {/* Header with Back Button */}
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tasks
        </Button>

        {/* Task Title and Badges */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-3" data-testid="text-task-title">
            {task.title}
          </h1>
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
            {task.dueDate && (
              <Badge variant="outline" data-testid="badge-due-date">
                Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}
              </Badge>
            )}
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
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

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Task Details</CardTitle>
                  {task.status !== "closed" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setCloseDialogOpen(true)}
                      data-testid="button-close-task"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Close Task
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Assigned To</Label>
                    <Select
                      value={task.assignedTo || ""}
                      onValueChange={(value) => updateTaskMutation.mutate({ assignedTo: value })}
                      data-testid="select-assignee"
                      disabled={task.status === "closed"}
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
                      disabled={task.status === "closed"}
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
                      disabled={task.status === "closed"}
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
                      disabled={task.status === "closed"}
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
                      onChange={(e) => updateTaskMutation.mutate({ dueDate: e.target.value ? new Date(e.target.value) : undefined })}
                      data-testid="input-due-date"
                      disabled={task.status === "closed"}
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
                    disabled={task.status === "closed"}
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

          {/* Connections Tab */}
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

          {/* Comments Tab */}
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
                    Add Comment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
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
                      No notes yet. Add a progress note!
                    </p>
                  )}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <Label htmlFor="new-note">Add Progress Note</Label>
                  <Textarea
                    id="new-note"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Document task progress..."
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

          {/* Time Tracking Tab */}
          <TabsContent value="time" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time Tracking
                  </CardTitle>
                  {task.status !== "closed" && (
                    <div>
                      {activeTimer ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => stopTimerMutation.mutate({ entryId: activeTimer, description: null })}
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
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {task.timeEntries && task.timeEntries.length > 0 ? (
                  <div className="border rounded-lg">
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
                            <TableCell className="font-medium">
                              {entry.user.firstName} {entry.user.lastName}
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(entry.startTime), 'MMM d, yyyy h:mm a')}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.endTime ? format(new Date(entry.endTime), 'MMM d, yyyy h:mm a') : (
                                <Badge variant="default">Running</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDuration(entry.duration)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.description || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No time entries recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attachments Tab */}
          <TabsContent value="attachments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  Attachments ({documents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload section */}
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploadingFile}
                    data-testid="input-file-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    data-testid="button-upload-document"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingFile ? "Uploading..." : "Upload Document"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Maximum file size: 10MB
                  </p>
                </div>

                {/* Documents list */}
                {documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded hover:bg-muted/50"
                        data-testid={`document-${doc.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" data-testid="text-document-filename">
                            {doc.fileName}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatFileSize(doc.fileSize)}</span>
                            <span>•</span>
                            <span>
                              {doc.uploader
                                ? `${doc.uploader.firstName} ${doc.uploader.lastName}`
                                : 'Unknown'}
                            </span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            data-testid="button-download-document"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteDocumentMutation.mutate(doc.id)}
                            disabled={deleteDocumentMutation.isPending}
                            data-testid="button-delete-document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No attachments yet. Upload a document to get started.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Close Task Dialog */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Task</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide closure details for this task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="closure-note">Closure Note (Required)</Label>
              <Textarea
                id="closure-note"
                value={closureNote}
                onChange={(e) => setClosureNote(e.target.value)}
                placeholder="Describe what was accomplished..."
                rows={4}
                data-testid="textarea-closure-note"
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
    </div>
  );
}
