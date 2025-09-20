import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { type Service, type WorkRole, type ProjectType, type UDFDefinition, insertServiceSchema, insertWorkRoleSchema } from "@shared/schema";
import Sidebar from "@/components/sidebar";
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
import { Plus, Settings, Edit, Trash2, Users, Briefcase, ArrowLeft, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { nanoid } from "nanoid";

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

// View mode types
type ViewMode = 'list' | 'create-service' | 'edit-service' | 'create-role' | 'edit-role';
type TabMode = 'services' | 'roles';

// UDF Editor Component
interface UDFEditorProps {
  control: any;
  name: string;
}

function UDFEditor({ control, name }: UDFEditorProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const addUDF = () => {
    append({
      id: nanoid(),
      name: "",
      type: "short_text" as const,
      required: false,
      placeholder: "",
    });
  };

  const udfTypes = [
    { value: "short_text", label: "Short Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "boolean", label: "Boolean" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">User Defined Fields</h4>
          <p className="text-sm text-muted-foreground">
            Define custom fields that will be available when creating clients for this service
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addUDF}
          data-testid="button-add-udf"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Field
        </Button>
      </div>

      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <Card key={field.id} className="p-4" data-testid={`card-udf-${index}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={control}
                  name={`${name}.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Field Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Tax ID"
                          data-testid={`input-udf-name-${index}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`${name}.${index}.type`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Field Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} data-testid={`select-udf-type-${index}`}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {udfTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`${name}.${index}.placeholder`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placeholder</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Enter tax ID..."
                          data-testid={`input-udf-placeholder-${index}`}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center space-x-4">
                  <FormField
                    control={control}
                    name={`${name}.${index}.required`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid={`checkbox-udf-required-${index}`}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Required</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => remove(index)}
                    data-testid={`button-remove-udf-${index}`}
                    className="shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {fields.length === 0 && (
        <Card className="p-6" data-testid="card-no-udfs">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No custom fields defined</p>
            <p className="text-xs mt-1">Click "Add Field" to create custom fields for this service</p>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function Services() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // View state management
  const [currentTab, setCurrentTab] = useState<TabMode>('services');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
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
      udfDefinitions: [],
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
      setViewMode('list');
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
      
      // Filter out any null, undefined, or empty roleIds
      const validRoleIds = roleIds.filter(roleId => roleId && roleId.trim() !== "");
      
      // Update service
      const serviceResponse = await apiRequest("PATCH", `/api/services/${id}`, serviceData);
      const service = await serviceResponse.json() as Service;
      
      // Get current roles
      const rolesResponse = await apiRequest("GET", `/api/services/${id}/roles`);
      const currentRoles = await rolesResponse.json() as WorkRole[];
      const currentRoleIds = currentRoles.map(role => role.id);
      
      // Remove roles not in new list
      const rolesToRemove = currentRoleIds.filter(roleId => !validRoleIds.includes(roleId));
      await Promise.all(
        rolesToRemove.map(roleId =>
          apiRequest("DELETE", `/api/services/${id}/roles/${roleId}`)
        )
      );
      
      // Add new roles
      const rolesToAdd = validRoleIds.filter(roleId => !currentRoleIds.includes(roleId));
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
      setViewMode('list');
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
      setViewMode('list');
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
      setViewMode('list');
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
      udfDefinitions: Array.isArray(service.udfDefinitions) ? service.udfDefinitions : [],
    });
    setViewMode('edit-service');
  };

  const handleCreateRole = (data: CreateWorkRoleFormData) => {
    createRoleMutation.mutate(data);
  };

  const handleUpdateRole = (data: CreateWorkRoleFormData) => {
    if (!editingRole) return;
    updateRoleMutation.mutate({ ...data, id: editingRole.id });
  };

  // Navigation helpers
  const handleStartCreateService = () => {
    serviceForm.reset();
    setViewMode('create-service');
  };

  const handleStartCreateRole = () => {
    roleForm.reset();
    setViewMode('create-role');
  };

  const handleCancelForm = () => {
    serviceForm.reset();
    roleForm.reset();
    setEditingService(null);
    setEditingRole(null);
    setViewMode('list');
  };

  const handleEditRole = (role: WorkRoleWithUsage) => {
    setEditingRole(role);
    roleForm.reset({
      name: role.name,
      description: role.description ?? "",
    });
    setViewMode('edit-role');
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
          <Tabs value={currentTab} onValueChange={(value) => { setCurrentTab(value as TabMode); setViewMode('list'); }} className="h-full">
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
              {/* Services List View */}
              {currentTab === 'services' && viewMode === 'list' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">Services</h2>
                      <p className="text-muted-foreground">Manage services and their associated project types and roles</p>
                    </div>
                    <Button onClick={handleStartCreateService} data-testid="button-add-service">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Service
                    </Button>
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
                                <Badge variant="secondary">{service.projectType?.name || "—"}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {service.roles.filter(role => role && role.id && role.name).map((role) => (
                                    <Badge key={role.id} variant="outline" className="text-xs">
                                      {role.name}
                                    </Badge>
                                  ))}
                                  {service.roles.filter(role => role && role.id && role.name).length === 0 && <span className="text-muted-foreground">No roles</span>}
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
                </>
              )}

              {/* Create Service Form View */}
              {currentTab === 'services' && viewMode === 'create-service' && (
                <>
                  <div className="flex items-center space-x-4 mb-6">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCancelForm}
                      data-testid="button-back-to-services"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold">Create New Service</h2>
                      <p className="text-muted-foreground">Add a new service with associated project type and roles</p>
                    </div>
                  </div>
                  <Card className="max-w-2xl">
                    <CardHeader>
                      <CardTitle>Service Details</CardTitle>
                      <CardDescription>Enter the information for your new service</CardDescription>
                    </CardHeader>
                    <CardContent>
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
                                    {allWorkRoles?.filter(role => role && role.id && role.name).map((role) => (
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
                          
                          {/* UDF Editor Section */}
                          <UDFEditor control={serviceForm.control} name="udfDefinitions" />
                          
                          <div className="flex justify-end space-x-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCancelForm}
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
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Edit Service Form View */}
              {currentTab === 'services' && viewMode === 'edit-service' && editingService && (
                <>
                  <div className="flex items-center space-x-4 mb-6">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCancelForm}
                      data-testid="button-back-to-services"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold">Edit Service</h2>
                      <p className="text-muted-foreground">Update the service information</p>
                    </div>
                  </div>
                  <Card className="max-w-2xl">
                    <CardHeader>
                      <CardTitle>Edit Service: {editingService.name}</CardTitle>
                      <CardDescription>Modify the service details below</CardDescription>
                    </CardHeader>
                    <CardContent>
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
                                    {allWorkRoles?.filter(role => role && role.id && role.name).map((role) => (
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
                          
                          {/* UDF Editor Section */}
                          <UDFEditor control={serviceForm.control} name="udfDefinitions" />
                          
                          <div className="flex justify-end space-x-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCancelForm}
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
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles" className="p-6 space-y-6">
              {/* Roles List View */}
              {currentTab === 'roles' && viewMode === 'list' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">Work Roles</h2>
                      <p className="text-muted-foreground">Manage work roles that can be assigned to services</p>
                    </div>
                    <Button onClick={handleStartCreateRole} data-testid="button-add-role">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Role
                    </Button>
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
                </>
              )}

              {/* Create Role Form View */}
              {currentTab === 'roles' && viewMode === 'create-role' && (
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
                  <Card className="max-w-2xl">
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

              {/* Edit Role Form View */}
              {currentTab === 'roles' && viewMode === 'edit-role' && editingRole && (
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
                  <Card className="max-w-2xl">
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
            </TabsContent>
          </Tabs>
        </div>
      </div>


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