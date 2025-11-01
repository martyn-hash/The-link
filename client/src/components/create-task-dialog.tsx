import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Loader2 } from "lucide-react";
import { type TaskType, type User } from "@shared/schema";
import { format } from "date-fns";
import { z } from "zod";

// Custom form schema that matches the form fields
// Note: createdBy will be added by the server, assignedToId will be mapped to assignedTo
const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  taskTypeId: z.string().uuid("Please select a task type"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["open", "in_progress", "closed"]),
  assignedToId: z.string().uuid("Please select an assignee"),
  dueDate: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

// Connection data is handled separately, not part of the form schema
interface ConnectionData {
  clientId?: string;
  projectId?: string;
  personId?: string;
  messageId?: string;
  serviceId?: string;
}

interface CreateTaskDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Pre-fill fields when creating from a specific context
  defaultValues?: Partial<TaskFormData>;
  // Pre-fill connections when creating from a specific context
  defaultConnections?: ConnectionData;
  // Callback after successful creation
  onSuccess?: () => void;
}

export function CreateTaskDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultValues,
  defaultConnections,
  onSuccess,
}: CreateTaskDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();

  // Use controlled or internal state
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  
  // Store connections separately from form data
  const connections = defaultConnections || {};

  // Fetch task types
  const { data: taskTypes = [], isLoading: loadingTypes } = useQuery<TaskType[]>({
    queryKey: ["/api/internal-task-types"],
  });

  // Fetch staff members
  const { data: staff = [], isLoading: loadingStaff } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Form setup with default values
  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      description: defaultValues?.description || "",
      taskTypeId: defaultValues?.taskTypeId || "",
      priority: defaultValues?.priority || "medium",
      status: defaultValues?.status || "open",
      assignedToId: defaultValues?.assignedToId || "",
      dueDate: defaultValues?.dueDate || "",
    },
  });

  // Reset form whenever defaultValues change or when dialog opens
  useEffect(() => {
    form.reset({
      title: defaultValues?.title || "",
      description: defaultValues?.description || "",
      taskTypeId: defaultValues?.taskTypeId || "",
      priority: defaultValues?.priority || "medium",
      status: defaultValues?.status || "open",
      assignedToId: defaultValues?.assignedToId || "",
      dueDate: defaultValues?.dueDate || "",
    });
  }, [defaultValues, form]);

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      // Create the task
      const task = await apiRequest("POST", "/api/internal-tasks", {
        title: data.title,
        description: data.description,
        taskTypeId: data.taskTypeId,
        priority: data.priority,
        status: data.status,
        assignedTo: data.assignedToId, // Backend expects 'assignedTo' not 'assignedToId'
        dueDate: data.dueDate || null,
        // createdBy will be added by the server from authenticated user
      });

      // Create connections if provided
      const connectionList = [];
      if (connections.clientId) connectionList.push({ entityType: "client" as const, entityId: connections.clientId });
      if (connections.projectId) connectionList.push({ entityType: "project" as const, entityId: connections.projectId });
      if (connections.personId) connectionList.push({ entityType: "person" as const, entityId: connections.personId });
      if (connections.messageId) connectionList.push({ entityType: "message" as const, entityId: connections.messageId });
      if (connections.serviceId) connectionList.push({ entityType: "service" as const, entityId: connections.serviceId });

      // Add connections if any
      if (connectionList.length > 0) {
        await apiRequest("POST", `/api/internal-tasks/${task.id}/connections`, {
          connections: connectionList,
        });
      }

      return task;
    },
    onSuccess: (data) => {
      toast({
        title: "Task created",
        description: "The task has been created successfully.",
      });
      
      // Invalidate all task list queries using predicate matching to ensure new task appears everywhere
      // This will invalidate queries like ["/api/internal-tasks", ...] with any additional parameters
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/internal-tasks');
        }
      });
      
      // Reset form and close dialog
      form.reset();
      setOpen(false);
      
      // Call success callback if provided
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  const dialogContent = (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create New Task</DialogTitle>
        <DialogDescription>
          Create a new internal task and assign it to a staff member.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter task title"
                    data-testid="input-task-title"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Enter task description"
                    rows={3}
                    data-testid="input-task-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Task Type and Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="taskTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={loadingTypes}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-task-type">
                        <SelectValue placeholder="Select task type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {taskTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-task-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">
                        <Badge variant="secondary" className="bg-gray-100 text-gray-800">Low</Badge>
                      </SelectItem>
                      <SelectItem value="medium">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">Medium</Badge>
                      </SelectItem>
                      <SelectItem value="high">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">High</Badge>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <Badge variant="secondary" className="bg-red-100 text-red-800">Urgent</Badge>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Assigned To and Status Row */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="assignedToId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign To *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      console.log("[CreateTaskDialog] Assignee changed to:", value);
                      field.onChange(value);
                    }}
                    value={field.value}
                    disabled={loadingStaff}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-task-assignee">
                        <SelectValue placeholder="Select staff member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {staff.map((user) => (
                        <SelectItem key={user.id} value={user.id} data-testid={`select-option-${user.id}`}>
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-task-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Due Date */}
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="date"
                    data-testid="input-task-due-date"
                  />
                </FormControl>
                <FormDescription>Optional due date for this task</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createTaskMutation.isPending}
              data-testid="button-cancel-task"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTaskMutation.isPending}
              data-testid="button-create-task"
            >
              {createTaskMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create Task
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );

  // If a custom trigger is provided, use it
  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={setOpen} modal={false}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  // Default trigger button
  return (
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-task-trigger">
          <Plus className="w-4 h-4 mr-2" />
          Create Task
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
