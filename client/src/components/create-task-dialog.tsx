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
import { Label } from "@/components/ui/label";
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
  
  // Store connections state (optional entity links)
  const [connectionClientId, setConnectionClientId] = useState<string>(defaultConnections?.clientId || "");
  const [connectionPersonId, setConnectionPersonId] = useState<string>(defaultConnections?.personId || "");
  const [connectionProjectId, setConnectionProjectId] = useState<string>(defaultConnections?.projectId || "");
  const [connectionServiceId, setConnectionServiceId] = useState<string>(defaultConnections?.serviceId || "");
  const [connectionMessageId, setConnectionMessageId] = useState<string>(defaultConnections?.messageId || "");

  // Fetch task types
  const { data: taskTypes = [], isLoading: loadingTypes } = useQuery<TaskType[]>({
    queryKey: ["/api/internal-task-types"],
  });

  // Fetch staff members
  const { data: staff = [], isLoading: loadingStaff } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch entities for connections (only when dialog is open)
  const { data: clients = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/clients"],
    enabled: open,
    select: (data: any[]) => data.map(c => ({ id: c.id, name: c.name })),
  });

  const { data: people = [] } = useQuery<Array<{ id: string; firstName: string; lastName: string }>>({
    queryKey: ["/api/people"],
    enabled: open,
    select: (data: any[]) => data.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })),
  });

  const { data: projects = [] } = useQuery<Array<{ id: string; clientName?: string; projectTypeName?: string }>>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  const { data: services = [] } = useQuery<Array<{ id: string; serviceName?: string; clientName?: string }>>({
    queryKey: ["/api/scheduled-services/all"],
    enabled: open,
  });

  const { data: messageThreads = [] } = useQuery<Array<{ id: string; subject?: string }>>({
    queryKey: ["/api/project-messages/my-threads"],
    enabled: open,
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
      if (connectionClientId) connectionList.push({ entityType: "client" as const, entityId: connectionClientId });
      if (connectionProjectId) connectionList.push({ entityType: "project" as const, entityId: connectionProjectId });
      if (connectionPersonId) connectionList.push({ entityType: "person" as const, entityId: connectionPersonId });
      if (connectionMessageId) connectionList.push({ entityType: "message" as const, entityId: connectionMessageId });
      if (connectionServiceId) connectionList.push({ entityType: "service" as const, entityId: connectionServiceId });

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
      
      // Reset form and connections
      form.reset();
      setConnectionClientId("");
      setConnectionPersonId("");
      setConnectionProjectId("");
      setConnectionServiceId("");
      setConnectionMessageId("");
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

          {/* Entity Connections Section */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3">Connections (Optional)</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Link this task to related entities for better tracking and context
            </p>
            
            <div className="space-y-3">
              {/* Client Connection */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="connection-client" className="text-xs">Client (Optional)</Label>
                <Select
                  value={connectionClientId}
                  onValueChange={setConnectionClientId}
                >
                  <SelectTrigger id="connection-client" data-testid="select-connection-client">
                    <SelectValue placeholder="None selected" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Person Connection */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="connection-person" className="text-xs">Person (Optional)</Label>
                <Select
                  value={connectionPersonId}
                  onValueChange={setConnectionPersonId}
                >
                  <SelectTrigger id="connection-person" data-testid="select-connection-person">
                    <SelectValue placeholder="None selected" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.firstName} {person.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Connection */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="connection-project" className="text-xs">Project (Optional)</Label>
                <Select
                  value={connectionProjectId}
                  onValueChange={setConnectionProjectId}
                >
                  <SelectTrigger id="connection-project" data-testid="select-connection-project">
                    <SelectValue placeholder="None selected" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.clientName} - {project.projectTypeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service Connection */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="connection-service" className="text-xs">Service (Optional)</Label>
                <Select
                  value={connectionServiceId}
                  onValueChange={setConnectionServiceId}
                >
                  <SelectTrigger id="connection-service" data-testid="select-connection-service">
                    <SelectValue placeholder="None selected" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.clientName} - {service.serviceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Message Thread Connection */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="connection-message" className="text-xs">Message Thread (Optional)</Label>
                <Select
                  value={connectionMessageId}
                  onValueChange={setConnectionMessageId}
                >
                  <SelectTrigger id="connection-message" data-testid="select-connection-message">
                    <SelectValue placeholder="None selected" />
                  </SelectTrigger>
                  <SelectContent>
                    {messageThreads.map((thread) => (
                      <SelectItem key={thread.id} value={thread.id}>
                        {thread.subject || `Thread ${thread.id.substring(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

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
