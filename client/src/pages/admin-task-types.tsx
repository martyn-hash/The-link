import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";
import TopNavigation from "@/components/top-navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskTypeSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { z } from "zod";
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

type TaskTypeFormData = z.infer<typeof insertTaskTypeSchema>;

export default function AdminTaskTypes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTaskType, setEditingTaskType] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTaskType, setDeletingTaskType] = useState<any>(null);

  // Fetch all task types (including inactive)
  const { data: taskTypes, isLoading } = useQuery<any[]>({
    queryKey: ['/api/internal-task-types', { includeInactive: true }],
  });

  // Form for creating task type
  const createForm = useForm<TaskTypeFormData>({
    resolver: zodResolver(insertTaskTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
    },
  });

  // Form for editing task type
  const editForm = useForm<TaskTypeFormData>({
    resolver: zodResolver(insertTaskTypeSchema),
  });

  // Create task type mutation
  const createMutation = useMutation({
    mutationFn: async (data: TaskTypeFormData) => {
      return await apiRequest("POST", "/api/internal-task-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === '/api/internal-task-types',
      });
      setCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Task type created",
        description: "The task type has been created successfully.",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Update task type mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskTypeFormData> }) => {
      return await apiRequest("PATCH", `/api/internal-task-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === '/api/internal-task-types',
      });
      setEditDialogOpen(false);
      setEditingTaskType(null);
      toast({
        title: "Task type updated",
        description: "The task type has been updated successfully.",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Delete task type mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/internal-task-types/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === '/api/internal-task-types',
      });
      setDeleteDialogOpen(false);
      setDeletingTaskType(null);
      toast({
        title: "Task type deleted",
        description: "The task type has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleCreateSubmit = (data: TaskTypeFormData) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: TaskTypeFormData) => {
    if (editingTaskType) {
      updateMutation.mutate({ id: editingTaskType.id, data });
    }
  };

  const handleEditClick = (taskType: any) => {
    setEditingTaskType(taskType);
    editForm.reset({
      name: taskType.name,
      description: taskType.description || "",
      isActive: taskType.isActive,
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (taskType: any) => {
    setDeletingTaskType(taskType);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingTaskType) {
      deleteMutation.mutate(deletingTaskType.id);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="text-page-title">
              Task Type Management
            </h1>
            <p className="text-meta mt-1">
              Manage task types for internal task organization
            </p>
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-8">

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Task Types</CardTitle>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                data-testid="button-create-task-type"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task Type
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !taskTypes || taskTypes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No task types found. Create one to get started.</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskTypes.map((taskType: any) => (
                      <TableRow key={taskType.id} data-testid={`row-task-type-${taskType.id}`}>
                        <TableCell className="font-medium" data-testid={`text-name-${taskType.id}`}>
                          {taskType.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground" data-testid={`text-description-${taskType.id}`}>
                          {taskType.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={taskType.isActive ? "default" : "outline"}
                            data-testid={`badge-status-${taskType.id}`}
                          >
                            {taskType.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(taskType)}
                              data-testid={`button-edit-${taskType.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(taskType)}
                              data-testid={`button-delete-${taskType.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Task Type Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-task-type">
          <DialogHeader>
            <DialogTitle>Create Task Type</DialogTitle>
            <DialogDescription>
              Add a new task type for organizing internal tasks.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter task type name"
                        data-testid="input-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Enter description (optional)"
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Make this task type available for selection
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create"
                >
                  {createMutation.isPending ? "Creating..." : "Create Task Type"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Task Type Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-task-type">
          <DialogHeader>
            <DialogTitle>Edit Task Type</DialogTitle>
            <DialogDescription>
              Update the task type details.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter task type name"
                        data-testid="input-edit-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Enter description (optional)"
                        data-testid="input-edit-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Make this task type available for selection
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateMutation.isPending ? "Updating..." : "Update Task Type"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTaskType?.name}"? This action cannot be undone.
              {deletingTaskType && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Note: You can only delete task types that are not currently in use.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
