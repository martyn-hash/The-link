import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { apiRequest } from "@/lib/queryClient";
import { type WorkRole, type Service, insertWorkRoleSchema } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Edit, Trash2, ArrowLeft, Search } from "lucide-react";

const createWorkRoleFormSchema = insertWorkRoleSchema;
type CreateWorkRoleFormData = z.infer<typeof createWorkRoleFormSchema>;

interface WorkRoleWithUsage extends WorkRole {
  serviceCount: number;
}

type ViewMode = 'list' | 'create-role' | 'edit-role';

export default function WorkRoles() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingRole, setEditingRole] = useState<WorkRoleWithUsage | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const roleForm = useForm<CreateWorkRoleFormData>({
    resolver: zodResolver(createWorkRoleFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const { data: basicWorkRoles, isLoading: rolesLoading, error: rolesError } = useQuery<WorkRole[]>({
    queryKey: ["/api/work-roles"],
    enabled: isAuthenticated && !!user?.isAdmin,
    retry: false,
  });

  interface ServiceWithRoles extends Service {
    roles: WorkRole[];
  }

  const { data: services } = useQuery<ServiceWithRoles[]>({
    queryKey: ["/api/services"],
    enabled: isAuthenticated && !!user?.isAdmin,
    retry: false,
  });

  const workRoles: WorkRoleWithUsage[] = basicWorkRoles?.map(role => {
    const serviceCount = services?.filter(service => 
      service.roles?.some(serviceRole => serviceRole.id === role.id)
    ).length || 0;
    return {
      ...role,
      serviceCount
    };
  }) || [];

  const createRoleMutation = useMutation({
    mutationFn: async (data: CreateWorkRoleFormData) => {
      return apiRequest("POST", "/api/work-roles", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Work role created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setViewMode('list');
      roleForm.reset();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateWorkRoleFormData> }) => {
      return apiRequest("PUT", `/api/work-roles/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Work role updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setViewMode('list');
      setEditingRole(null);
      roleForm.reset();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/work-roles/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Work role deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setDeleteRoleId(null);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (rolesError && isUnauthorizedError(rolesError)) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [rolesError]);

  const handleStartCreateRole = () => {
    roleForm.reset({ name: "", description: "" });
    setViewMode('create-role');
  };

  const handleEditRole = (role: WorkRoleWithUsage) => {
    setEditingRole(role);
    roleForm.reset({ name: role.name, description: role.description || "" });
    setViewMode('edit-role');
  };

  const handleCancelForm = () => {
    setViewMode('list');
    setEditingRole(null);
    roleForm.reset();
  };

  const handleCreateRole = (data: CreateWorkRoleFormData) => {
    createRoleMutation.mutate(data);
  };

  const handleUpdateRole = (data: CreateWorkRoleFormData) => {
    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, data });
    }
  };

  const filteredRoles = workRoles?.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

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

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card">
          <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">Work Roles</h1>
                <p className="text-meta mt-1">Manage work roles that can be assigned to services</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
            {viewMode === 'list' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Search work roles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-work-roles"
                    />
                  </div>
                  <Button onClick={handleStartCreateRole} data-testid="button-add-role">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Role
                  </Button>
                </div>

                <div className="border rounded-lg">
                  {rolesLoading ? (
                    <div className="p-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4 mb-4">
                          <Skeleton className="h-12 w-12 rounded" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Used in Services</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRoles.map((role) => (
                          <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                            <TableCell className="font-medium">{role.name}</TableCell>
                            <TableCell>{role.description || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={role.serviceCount > 0 ? "default" : "secondary"}>
                                {role.serviceCount} service{role.serviceCount !== 1 ? 's' : ''}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEditRole(role)}
                                  data-testid={`button-edit-role-${role.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setDeleteRoleId(role.id)}
                                  data-testid={`button-delete-role-${role.id}`}
                                  disabled={role.serviceCount > 0}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredRoles.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              {searchTerm ? "No work roles match your search." : "No work roles found. Create your first role to get started."}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            )}

            {viewMode === 'create-role' && (
              <>
                <div className="flex items-center space-x-4 mb-6">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCancelForm}
                    data-testid="button-back-to-roles"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <h2 className="text-xl font-semibold">Create New Work Role</h2>
                    <p className="text-muted-foreground">Add a new work role that can be assigned to services</p>
                  </div>
                </div>
                <Card className="max-w-4xl">
                  <CardHeader>
                    <CardTitle>Role Details</CardTitle>
                    <CardDescription>Enter the information for your new work role</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...roleForm}>
                      <form onSubmit={roleForm.handleSubmit(handleCreateRole)} className="space-y-4">
                        <FormField
                          control={roleForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Senior Bookkeeper"
                                  data-testid="input-role-name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={roleForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Describe this work role..."
                                  data-testid="textarea-role-description"
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelForm}
                            data-testid="button-cancel-create-role"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createRoleMutation.isPending}
                            data-testid="button-save-role"
                          >
                            {createRoleMutation.isPending ? "Creating..." : "Create Role"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </>
            )}

            {viewMode === 'edit-role' && editingRole && (
              <>
                <div className="flex items-center space-x-4 mb-6">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCancelForm}
                    data-testid="button-back-to-roles"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <h2 className="text-xl font-semibold">Edit Work Role</h2>
                    <p className="text-muted-foreground">Update the work role information</p>
                  </div>
                </div>
                <Card className="max-w-4xl">
                  <CardHeader>
                    <CardTitle>Edit Role: {editingRole.name}</CardTitle>
                    <CardDescription>Modify the role details below</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...roleForm}>
                      <form onSubmit={roleForm.handleSubmit(handleUpdateRole)} className="space-y-4">
                        <FormField
                          control={roleForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Senior Bookkeeper"
                                  data-testid="input-role-name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={roleForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Describe this work role..."
                                  data-testid="textarea-role-description"
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelForm}
                            data-testid="button-cancel-edit-role"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={updateRoleMutation.isPending}
                            data-testid="button-update-role"
                          >
                            {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteRoleId} onOpenChange={() => setDeleteRoleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this work role? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-role">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRoleId && deleteRoleMutation.mutate(deleteRoleId)}
              data-testid="button-confirm-delete-role"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
