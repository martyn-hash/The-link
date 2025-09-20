import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { type Service, type WorkRole, type ProjectType, insertServiceSchema, insertWorkRoleSchema } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Plus, Settings, Edit, Trash2, Users, Briefcase } from "lucide-react";

// Form schemas
const createServiceFormSchema = insertServiceSchema.extend({
  roleIds: z.array(z.string()).default([]),
});

const createWorkRoleFormSchema = insertWorkRoleSchema;

type CreateServiceFormData = z.infer<typeof createServiceFormSchema>;
type CreateWorkRoleFormData = z.infer<typeof createWorkRoleFormSchema>;

interface ServiceWithDetails extends Service {
  projectType: ProjectType;
  roles: WorkRole[];
}

interface WorkRoleWithUsage extends WorkRole {
  serviceCount: number;
}

export default function Services() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Dialog states
  const [isCreateServiceDialogOpen, setIsCreateServiceDialogOpen] = useState(false);
  const [isCreateRoleDialogOpen, setIsCreateRoleDialogOpen] = useState(false);
  const [isEditServiceDialogOpen, setIsEditServiceDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  
  // Edit states
  const [editingService, setEditingService] = useState<ServiceWithDetails | null>(null);
  const [editingRole, setEditingRole] = useState<WorkRoleWithUsage | null>(null);

  // Forms
  const serviceForm = useForm<CreateServiceFormData>({
    resolver: zodResolver(createServiceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      projectTypeId: "",
      roleIds: [],
    },
  });

  const roleForm = useForm<CreateWorkRoleFormData>({
    resolver: zodResolver(createWorkRoleFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Data fetching
  const { data: services, isLoading: servicesLoading, error: servicesError } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services"],
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  const { data: basicWorkRoles, isLoading: rolesLoading, error: rolesError } = useQuery<WorkRole[]>({
    queryKey: ["/api/work-roles"],
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  // Compute work roles with service count
  const workRoles: WorkRoleWithUsage[] = basicWorkRoles?.map(role => {
    const serviceCount = services?.filter(service => 
      service.roles.some(serviceRole => serviceRole.id === role.id)
    ).length || 0;
    return {
      ...role,
      serviceCount
    };
  }) || [];

  const { data: projectTypes } = useQuery<ProjectType[]>({
    queryKey: ["/api/config/project-types"],
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  const { data: allWorkRoles } = useQuery<WorkRole[]>({
    queryKey: ["/api/work-roles"],
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  // Mutations
  const createServiceMutation = useMutation({
    mutationFn: async (data: CreateServiceFormData) => {
      const { roleIds, ...serviceData } = data;
      const response = await apiRequest("POST", "/api/services", serviceData);
      const service = await response.json() as Service;
      
      // Add roles to service
      if (roleIds.length > 0) {
        await Promise.all(
          roleIds.map(roleId =>
            apiRequest("POST", `/api/services/${service.id}/roles`, { roleId })
          )
        );
      }
      
      return service;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Service created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      setIsCreateServiceDialogOpen(false);
      serviceForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create service",
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: CreateServiceFormData & { id: string }) => {
      const { roleIds, id, ...serviceData } = data;
      
      // Update service
      const serviceResponse = await apiRequest("PATCH", `/api/services/${id}`, serviceData);
      const service = await serviceResponse.json() as Service;
      
      // Get current roles
      const rolesResponse = await apiRequest("GET", `/api/services/${id}/roles`);
      const currentRoles = await rolesResponse.json() as WorkRole[];
      const currentRoleIds = currentRoles.map(role => role.id);
      
      // Remove roles not in new list
      const rolesToRemove = currentRoleIds.filter(roleId => !roleIds.includes(roleId));
      await Promise.all(
        rolesToRemove.map(roleId =>
          apiRequest("DELETE", `/api/services/${id}/roles/${roleId}`)
        )
      );
      
      // Add new roles
      const rolesToAdd = roleIds.filter(roleId => !currentRoleIds.includes(roleId));
      await Promise.all(
        rolesToAdd.map(roleId =>
          apiRequest("POST", `/api/services/${id}/roles`, { roleId })
        )
      );
      
      return service;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Service updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      setIsEditServiceDialogOpen(false);
      setEditingService(null);
      serviceForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service",
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      return await apiRequest("DELETE", `/api/services/${serviceId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Service deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      setDeleteServiceId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete service",
        variant: "destructive",
      });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: CreateWorkRoleFormData) => {
      const response = await apiRequest("POST", "/api/work-roles", data);
      return await response.json() as WorkRole;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Work role created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles", "all"] });
      setIsCreateRoleDialogOpen(false);
      roleForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create work role",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: CreateWorkRoleFormData & { id: string }) => {
      const { id, ...roleData } = data;
      const response = await apiRequest("PATCH", `/api/work-roles/${id}`, roleData);
      return await response.json() as WorkRole;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Work role updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles", "all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setIsEditRoleDialogOpen(false);
      setEditingRole(null);
      roleForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update work role",
        variant: "destructive",
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      return await apiRequest("DELETE", `/api/work-roles/${roleId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Work role deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles", "all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setDeleteRoleId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete work role",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleCreateService = (data: CreateServiceFormData) => {
    createServiceMutation.mutate(data);
  };

  const handleUpdateService = (data: CreateServiceFormData) => {
    if (!editingService) return;
    updateServiceMutation.mutate({ ...data, id: editingService.id });
  };

  const handleEditService = (service: ServiceWithDetails) => {
    setEditingService(service);
    serviceForm.reset({
      name: service.name,
      description: service.description ?? "",
      projectTypeId: service.projectTypeId,
      roleIds: service.roles.map(role => role.id),
    });
    setIsEditServiceDialogOpen(true);
  };

  const handleCreateRole = (data: CreateWorkRoleFormData) => {
    createRoleMutation.mutate(data);
  };

  const handleUpdateRole = (data: CreateWorkRoleFormData) => {
    if (!editingRole) return;
    updateRoleMutation.mutate({ ...data, id: editingRole.id });
  };

  const handleEditRole = (role: WorkRoleWithUsage) => {
    setEditingRole(role);
    roleForm.reset({
      name: role.name,
      description: role.description ?? "",
    });
    setIsEditRoleDialogOpen(true);
  };

  // Auth and error handling
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

  useEffect(() => {
    const error = servicesError || rolesError;
    if (error && isUnauthorizedError(error)) {
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
  }, [servicesError, rolesError, toast]);

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

  if (user.role !== "admin") {
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
    <div className="min-h-screen bg-background flex">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">Services & Roles</h1>
                <p className="text-muted-foreground">Manage services and work roles for your organization</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content with tabs */}
        <div className="flex-1 overflow-auto">
          <Tabs defaultValue="services" className="h-full">
            <div className="border-b border-border bg-card px-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="services" className="flex items-center" data-testid="tab-services">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Services
                </TabsTrigger>
                <TabsTrigger value="roles" className="flex items-center" data-testid="tab-roles">
                  <Users className="w-4 h-4 mr-2" />
                  Work Roles
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Services Tab */}
            <TabsContent value="services" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Services</h2>
                  <p className="text-muted-foreground">Manage services and their associated project types and roles</p>
                </div>
                <Dialog open={isCreateServiceDialogOpen} onOpenChange={setIsCreateServiceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-service">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Service
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[525px]">
                    <DialogHeader>
                      <DialogTitle>Create New Service</DialogTitle>
                      <DialogDescription>
                        Add a new service with associated project type and roles
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...serviceForm}>
                      <form onSubmit={serviceForm.handleSubmit(handleCreateService)} className="space-y-4">
                        <FormField
                          control={serviceForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Monthly Bookkeeping Service"
                                  data-testid="input-service-name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={serviceForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Describe this service..."
                                  data-testid="textarea-service-description"
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={serviceForm.control}
                          name="projectTypeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Project Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} data-testid="select-project-type">
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a project type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {projectTypes?.map((type) => (
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
                          control={serviceForm.control}
                          name="roleIds"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Work Roles</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  {allWorkRoles?.map((role) => (
                                    <div key={role.id} className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id={role.id}
                                        checked={field.value.includes(role.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            field.onChange([...field.value, role.id]);
                                          } else {
                                            field.onChange(field.value.filter(id => id !== role.id));
                                          }
                                        }}
                                        data-testid={`checkbox-role-${role.id}`}
                                      />
                                      <label htmlFor={role.id} className="text-sm font-medium">
                                        {role.name}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCreateServiceDialogOpen(false)}
                            data-testid="button-cancel-create-service"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createServiceMutation.isPending}
                            data-testid="button-save-service"
                          >
                            {createServiceMutation.isPending ? "Creating..." : "Create Service"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Services Table */}
              <div className="border rounded-lg">
                {servicesLoading ? (
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
                        <TableHead>Project Type</TableHead>
                        <TableHead>Mapped Roles</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services?.map((service) => (
                        <TableRow key={service.id} data-testid={`row-service-${service.id}`}>
                          <TableCell className="font-medium">{service.name}</TableCell>
                          <TableCell>{service.description || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{service.projectType.name}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {service.roles.map((role) => (
                                <Badge key={role.id} variant="outline" className="text-xs">
                                  {role.name}
                                </Badge>
                              ))}
                              {service.roles.length === 0 && <span className="text-muted-foreground">No roles</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleEditService(service)}
                                data-testid={`button-edit-service-${service.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setDeleteServiceId(service.id)}
                                data-testid={`button-delete-service-${service.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {services?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No services found. Create your first service to get started.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Work Roles</h2>
                  <p className="text-muted-foreground">Manage work roles that can be assigned to services</p>
                </div>
                <Dialog open={isCreateRoleDialogOpen} onOpenChange={setIsCreateRoleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-role">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Role
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[525px]">
                    <DialogHeader>
                      <DialogTitle>Create New Work Role</DialogTitle>
                      <DialogDescription>
                        Add a new work role that can be assigned to services
                      </DialogDescription>
                    </DialogHeader>
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
                            onClick={() => setIsCreateRoleDialogOpen(false)}
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
                  </DialogContent>
                </Dialog>
              </div>

              {/* Roles Table */}
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
                      {workRoles?.map((role) => (
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
                      {workRoles?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No work roles found. Create your first role to get started.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Service Dialog */}
      <Dialog open={isEditServiceDialogOpen} onOpenChange={setIsEditServiceDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>
              Update service details, project type, and role assignments
            </DialogDescription>
          </DialogHeader>
          <Form {...serviceForm}>
            <form onSubmit={serviceForm.handleSubmit(handleUpdateService)} className="space-y-4">
              <FormField
                control={serviceForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Monthly Bookkeeping Service"
                        data-testid="input-edit-service-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={serviceForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe this service..."
                        data-testid="textarea-edit-service-description"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={serviceForm.control}
                name="projectTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} data-testid="select-edit-project-type">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projectTypes?.map((type) => (
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
                control={serviceForm.control}
                name="roleIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Roles</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        {allWorkRoles?.map((role) => (
                          <div key={role.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`edit-${role.id}`}
                              checked={field.value.includes(role.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, role.id]);
                                } else {
                                  field.onChange(field.value.filter(id => id !== role.id));
                                }
                              }}
                              data-testid={`checkbox-edit-role-${role.id}`}
                            />
                            <label htmlFor={`edit-${role.id}`} className="text-sm font-medium">
                              {role.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditServiceDialogOpen(false)}
                  data-testid="button-cancel-edit-service"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateServiceMutation.isPending}
                  data-testid="button-update-service"
                >
                  {updateServiceMutation.isPending ? "Updating..." : "Update Service"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Work Role</DialogTitle>
            <DialogDescription>
              Update work role details
            </DialogDescription>
          </DialogHeader>
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
                        data-testid="input-edit-role-name"
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
                        data-testid="textarea-edit-role-description"
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
                  onClick={() => setIsEditRoleDialogOpen(false)}
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
        </DialogContent>
      </Dialog>

      {/* Delete Service Confirmation */}
      <AlertDialog open={!!deleteServiceId} onOpenChange={() => setDeleteServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-service">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteServiceId && deleteServiceMutation.mutate(deleteServiceId)}
              data-testid="button-confirm-delete-service"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Role Confirmation */}
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