import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { type TaskType, type User } from "@shared/schema";
import { format } from "date-fns";
import { z } from "zod";
import EntitySearch, { type SelectedEntity } from "@/components/entity-search";

// Custom form schema that matches the form fields
// Note: createdBy will be added by the server, assignedToId will be mapped to assignedTo
const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  taskTypeId: z.string().uuid("Please select a task type"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["open", "in_progress", "closed"]),
  assignedToId: z.string().uuid("Please select an assignee"),
  dueDate: z.string().min(1, "Due date is required"),
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
  
  // Store connections state (optional entity links) using new EntitySearch component
  const [selectedEntities, setSelectedEntities] = useState<SelectedEntity[]>([]);
  
  // Track if search is active to collapse form fields
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(true);

  // Track if we've hydrated connections for the current dialog open state
  const hasHydratedRef = useRef(false);
  // Track if we've added the project's client (to avoid duplicate additions)
  const hasAddedProjectClientRef = useRef(false);

  // Fetch task types
  const { data: taskTypes = [], isLoading: loadingTypes } = useQuery<TaskType[]>({
    queryKey: ["/api/internal-task-types"],
  });

  // Fetch staff members
  const { data: staff = [], isLoading: loadingStaff } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch project data if projectId is provided (to auto-add client connection)
  const { data: project } = useQuery<any>({
    queryKey: [`/api/projects/${defaultConnections?.projectId}`],
    enabled: !!defaultConnections?.projectId && open,
  });

  // Form setup with default values
  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    mode: "onChange", // Validate on change to clear errors as user fills form
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

  // Reset hydration flags when dialog closes
  useEffect(() => {
    if (!open) {
      hasHydratedRef.current = false;
      hasAddedProjectClientRef.current = false;
    }
  }, [open]);

  // Hydrate entity connections from defaultConnections when dialog opens
  useEffect(() => {
    if (!open) return; // Only hydrate when dialog is opening
    if (hasHydratedRef.current) return; // Already hydrated for this open state
    
    if (!defaultConnections) {
      setSelectedEntities([]);
      hasHydratedRef.current = true;
      return;
    }

    const entities: SelectedEntity[] = [];
    
    if (defaultConnections.clientId) {
      entities.push({
        id: defaultConnections.clientId,
        type: 'client',
        label: 'Preselected Client'
      });
    }
    
    if (defaultConnections.personId) {
      entities.push({
        id: defaultConnections.personId,
        type: 'person',
        label: 'Preselected Person'
      });
    }
    
    if (defaultConnections.projectId) {
      entities.push({
        id: defaultConnections.projectId,
        type: 'project',
        label: 'Preselected Project'
      });
    }
    
    if (defaultConnections.messageId) {
      entities.push({
        id: defaultConnections.messageId,
        type: 'message',
        label: 'Preselected Message'
      });
    }
    
    setSelectedEntities(entities);
    hasHydratedRef.current = true; // Mark as hydrated
  }, [open, defaultConnections]);

  // Separate effect to auto-add project's client when project data loads
  useEffect(() => {
    if (!open) return;
    if (!hasHydratedRef.current) return; // Wait for initial hydration
    if (hasAddedProjectClientRef.current) return; // Already added client
    if (!defaultConnections?.projectId) return; // No project connection
    if (defaultConnections.clientId) return; // Client explicitly provided
    if (!project?.client?.id) return; // Project data not loaded yet or no client
    
    // Add the project's client to existing connections
    setSelectedEntities(prev => {
      // Check if client already exists (in case user manually added it)
      const clientExists = prev.some(e => e.type === 'client' && e.id === project.client.id);
      if (clientExists) return prev;
      
      return [...prev, {
        id: project.client.id,
        type: 'client',
        label: project.client.name || 'Project Client'
      }];
    });
    
    hasAddedProjectClientRef.current = true;
  }, [open, project, defaultConnections, hasHydratedRef.current]);

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
        dueDate: data.dueDate,
        // createdBy will be added by the server from authenticated user
      });

      // Create connections if provided
      if (selectedEntities.length > 0) {
        const connectionList = selectedEntities.map(entity => ({
          entityType: entity.type,
          entityId: entity.id
        }));

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
      setSelectedEntities([]);
      setOpen(false);
      
      // Call success callback if provided
      onSuccess?.();
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
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
          {/* Collapsible Form Fields */}
          <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
            <CollapsibleContent>
              <div className="space-y-4">
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

                <div className="space-y-4 pt-4">
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
                            onValueChange={async (value) => {
                              console.log("[CreateTaskDialog] Assignee changed to:", value);
                              field.onChange(value);
                              // Explicitly clear and revalidate the field to ensure error state updates
                              await form.trigger("assignedToId");
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CollapsibleContent>

            {/* Expand trigger - must be inside Collapsible */}
            {!isFormOpen && (
              <div className="py-2">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3"
                    data-testid="button-expand-form"
                  >
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show form fields
                  </Button>
                </CollapsibleTrigger>
              </div>
            )}
          </Collapsible>

          {/* Entity Connections Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Connections (Optional)</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Link this task to related clients, people, projects, or messages
            </p>
            
            <EntitySearch
              placeholder="Search for clients, people, projects, or messages..."
              selectedEntities={selectedEntities}
              onSelect={(entity) => setSelectedEntities([...selectedEntities, entity])}
              onRemove={(entityId) => setSelectedEntities(selectedEntities.filter(e => e.id !== entityId))}
              allowMultiple={true}
              onSearchStart={() => setIsFormOpen(false)}
              onSearchClear={() => setIsFormOpen(true)}
            />
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
