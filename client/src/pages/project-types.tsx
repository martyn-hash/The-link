import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { type ProjectType, type KanbanStage, type Service } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Search, Settings, Plus, ChevronRight, Activity, Layers, CheckCircle, XCircle, Power, ExternalLink, Users } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const createProjectTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  description: z.string().optional(),
  active: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
  serviceId: z.string().optional(),
});

type CreateProjectTypeForm = z.infer<typeof createProjectTypeSchema>;

export default function ProjectTypes() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      setLocation('/');
      return;
    }
  }, [user, toast, setLocation]);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showInactive, setShowInactive] = useState<boolean>(false);

  // Form for creating new project type
  const form = useForm<CreateProjectTypeForm>({
    resolver: zodResolver(createProjectTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      active: true,
      order: 0,
      serviceId: "",
    },
  });

  // Fetch project types
  const { data: projectTypes, isLoading: projectTypesLoading, error } = useQuery<ProjectType[]>({
    queryKey: ["/api/config/project-types", { inactive: showInactive }],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  // Fetch services
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    enabled: isAuthenticated && !!user && user.role === "admin",
    retry: false,
  });

  // Get stage counts for each project type
  const stageCountQueries = useQuery({
    queryKey: ["/api/config/project-type-stage-counts"],
    queryFn: async () => {
      if (!projectTypes || !projectTypes.length) return {};
      
      const counts: Record<string, number> = {};
      
      // Fetch stage counts for each project type
      await Promise.all(
        projectTypes.map(async (projectType) => {
          try {
            const stages = await fetch(`/api/config/project-types/${projectType.id}/stages`).then(res => res.json()) as KanbanStage[];
            counts[projectType.id] = stages.length;
          } catch (error) {
            counts[projectType.id] = 0;
          }
        })
      );
      
      return counts;
    },
    enabled: !!projectTypes && projectTypes.length > 0,
  });

  // Calculate unmapped services
  const unmappedServices = services?.filter(service => !service.projectTypeId) || [];
  
  // Get selected service details
  const selectedServiceId = form.watch("serviceId");
  const selectedService = services?.find(service => service.id === selectedServiceId);

  // Create project type mutation
  const createProjectTypeMutation = useMutation({
    mutationFn: async (data: CreateProjectTypeForm) => {
      const { serviceId, ...projectTypeData } = data;
      
      // First create the project type
      const response = await apiRequest("POST", "/api/config/project-types", projectTypeData);
      const projectType = await response.json();
      
      // If a service is selected, update the service to link to this project type
      if (serviceId && serviceId.trim()) {
        await apiRequest("PATCH", `/api/services/${serviceId}`, {
          projectTypeId: projectType.id
        });
      }
      
      return projectType;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Project type created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create project type",
        variant: "destructive",
      });
    },
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
  }, [error, toast]);

  // Filter project types based on search term
  const filteredProjectTypes = projectTypes?.filter(projectType =>
    projectType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (projectType.description && projectType.description.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const handleCreateSubmit = (data: CreateProjectTypeForm) => {
    createProjectTypeMutation.mutate(data);
  };

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">Project Types</h1>
                <p className="text-muted-foreground">Manage project type configurations and their stages</p>
              </div>
              <div className="flex items-center space-x-4">
                {/* Show Inactive Toggle */}
                <div className="flex items-center space-x-2">
                  <Power className="w-4 h-4 text-muted-foreground" />
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-inactive"
                      checked={showInactive}
                      onCheckedChange={setShowInactive}
                      data-testid="switch-show-inactive"
                    />
                    <Label htmlFor="show-inactive" className="text-sm text-muted-foreground">
                      Show inactive
                    </Label>
                  </div>
                </div>
                
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-project-type">
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Project Type
                    </Button>
                  </DialogTrigger>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle>Create New Project Type</DialogTitle>
                    <DialogDescription>
                      Create a new project type to define workflow stages and optional service mappings for role-based assignments.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Monthly Bookkeeping"
                                data-testid="input-project-type-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe this project type..."
                                data-testid="textarea-project-type-description"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Separator />
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Optional: Map to Service</h4>
                        <p className="text-xs text-muted-foreground">
                          Link this project type to an existing service for role-based assignments
                        </p>
                      </div>
                      <FormField
                        control={form.control}
                        name="serviceId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Service (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} data-testid="select-service-mapping">
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a service to map to this project type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">No service mapping</SelectItem>
                                {unmappedServices.map((service) => (
                                  <SelectItem key={service.id} value={service.id} data-testid={`option-service-${service.id}`}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{service.name}</span>
                                      {service.description && (
                                        <span className="text-xs text-muted-foreground">{service.description}</span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {selectedService && (
                        <div className="rounded-lg border p-3 bg-muted/50">
                          <div className="flex items-start space-x-2">
                            <Users className="w-4 h-4 mt-0.5 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="font-medium">Role-based Assignments</p>
                              <p className="text-muted-foreground text-xs mt-1">
                                When this service is mapped, kanban stages will assign tasks to users based on their roles rather than specific individuals. This enables flexible team management.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <FormField
                        control={form.control}
                        name="active"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Active</FormLabel>
                              <FormDescription className="text-sm text-muted-foreground">
                                Allow new projects to be created with this type
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-project-type-active"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end space-x-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                          data-testid="button-cancel-create"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createProjectTypeMutation.isPending}
                          data-testid="button-submit-create"
                        >
                          {createProjectTypeMutation.isPending ? "Creating..." : "Create Project Type"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search project types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-project-types"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Unmapped Services Section */}
          {!servicesLoading && services && unmappedServices.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <CardTitle className="text-lg" data-testid="text-unmapped-services-title">
                    Unmapped Services ({unmappedServices.length})
                  </CardTitle>
                </div>
                <CardDescription>
                  These services don't have a project type mapping yet. You can map them when creating a new project type.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unmappedServices.map((service) => (
                    <Card key={service.id} className="border-2 border-dashed border-amber-200 dark:border-amber-800" data-testid={`card-unmapped-service-${service.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-foreground truncate" data-testid={`text-unmapped-service-name-${service.id}`}>
                              {service.name}
                            </h4>
                            {service.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2" data-testid={`text-unmapped-service-description-${service.id}`}>
                                {service.description}
                              </p>
                            )}
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground ml-2 flex-shrink-0" />
                        </div>
                        <div className="mt-3">
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Needs Mapping
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Create a new project type and select one of these services to establish the mapping.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {projectTypesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Unable to load project types</h3>
              <p className="text-muted-foreground text-center max-w-md">
                There was an issue loading the project types. Please try refreshing the page or contact support if the problem persists.
              </p>
            </div>
          ) : filteredProjectTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              {searchTerm ? (
                <>
                  <Search className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-search-results">No project types found</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    No project types match your search for "{searchTerm}". Try adjusting your search terms.
                  </p>
                </>
              ) : (
                <>
                  <Settings className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-project-types">No project types yet</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Create your first project type to get started managing workflows and configurations.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjectTypes.map((projectType) => (
                <Link key={projectType.id} href={`/settings/project-types/${projectType.id}`}>
                  <Card 
                    className="hover:shadow-md transition-all duration-200 cursor-pointer hover:border-primary/50" 
                    data-testid={`card-project-type-${projectType.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Settings className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate flex items-center" data-testid={`text-project-type-name-${projectType.id}`}>
                              {projectType.name}
                              <ChevronRight className="w-4 h-4 ml-2 text-muted-foreground" />
                            </CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              {projectType.active ? (
                                <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {projectType.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-project-type-description-${projectType.id}`}>
                            {projectType.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Layers className="w-3 h-3 mr-1" />
                            <span data-testid={`text-project-type-stages-${projectType.id}`}>
                              {stageCountQueries.data?.[projectType.id] || 0} stages
                            </span>
                          </div>
                          <p data-testid={`text-project-type-created-${projectType.id}`}>
                            Created: {projectType.createdAt ? format(new Date(projectType.createdAt), "MMM d, yyyy") : "Unknown"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}