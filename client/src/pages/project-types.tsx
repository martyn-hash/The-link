import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Search, Settings, Plus, ChevronRight, Activity, Layers, CheckCircle, XCircle, Power, ExternalLink, Users, Eye } from "lucide-react";
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

function ProjectTypeRow({ 
  projectType, 
  stageCount,
  serviceName 
}: { 
  projectType: ProjectType;
  stageCount: number;
  serviceName: string | null;
}) {
  return (
    <TableRow data-testid={`row-project-type-${projectType.id}`}>
      <TableCell className="font-medium">
        <span data-testid={`text-project-type-name-${projectType.id}`}>
          {projectType.name}
        </span>
      </TableCell>
      
      <TableCell>
        <span className="text-sm line-clamp-2" data-testid={`text-project-type-description-${projectType.id}`}>
          {projectType.description || '-'}
        </span>
      </TableCell>
      
      <TableCell>
        <span className="text-sm" data-testid={`text-project-type-service-${projectType.id}`}>
          {serviceName || <span className="text-muted-foreground">-</span>}
        </span>
      </TableCell>
      
      <TableCell>
        <div className="flex items-center">
          <Layers className="h-4 w-4 mr-1 text-muted-foreground" />
          <span className="text-sm" data-testid={`text-project-type-stages-${projectType.id}`}>
            {stageCount}
          </span>
        </div>
      </TableCell>
      
      <TableCell>
        {projectType.active ? (
          <Badge variant="secondary" className="bg-green-500 text-white text-xs">
            <CheckCircle className="h-4 w-4 mr-1" />
            Active
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-gray-500 text-white text-xs">
            <XCircle className="h-4 w-4 mr-1" />
            Inactive
          </Badge>
        )}
      </TableCell>
      
      <TableCell className="text-right">
        <Link href={`/settings/project-types/${projectType.id}`}>
          <Button
            variant="default"
            size="sm"
            data-testid={`button-view-${projectType.id}`}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
        </Link>
      </TableCell>
    </TableRow>
  );
}

export default function ProjectTypes() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading]);

  // Redirect non-admin users
  useEffect(() => {
    if (user && !user.isAdmin) {
      showFriendlyError({ error: "You don't have permission to access this page." });
      setLocation('/');
      return;
    }
  }, [user, setLocation]);
  
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [isUnmappedServicesModalOpen, setIsUnmappedServicesModalOpen] = useState(false);

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
    enabled: isAuthenticated && Boolean(user?.isAdmin),
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

  // Calculate unmapped services (services not referenced by any project type)
  const unmappedServices = services?.filter(service => {
    return !projectTypes?.some(pt => pt.serviceId === service.id);
  }) || [];
  
  // Get selected service details
  const selectedServiceId = form.watch("serviceId");
  const selectedService = services?.find(service => service.id === selectedServiceId);

  // Create project type mutation
  const createProjectTypeMutation = useMutation({
    mutationFn: async (data: CreateProjectTypeForm) => {
      // Normalize serviceId: treat empty string, "none", or whitespace as undefined
      const normalizedServiceId = data.serviceId && data.serviceId.trim() && data.serviceId !== "none"
        ? data.serviceId
        : undefined;
      
      const projectTypeData = {
        ...data,
        serviceId: normalizedServiceId
      };
      
      const projectType = await apiRequest("POST", "/api/config/project-types", projectTypeData);
      
      return projectType;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Project type created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-type-stage-counts"] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Handle query errors
  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [error]);

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
          <div className="page-container py-6 md:py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">Project Types</h1>
                <p className="text-meta mt-1">Manage project type configurations and their stages</p>
              </div>
              <div className="flex items-center space-x-4">
                {/* Unmapped Services Button */}
                {!servicesLoading && unmappedServices.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsUnmappedServicesModalOpen(true)}
                    data-testid="button-show-unmapped-services"
                  >
                    <AlertCircle className="w-4 h-4 mr-2 text-amber-500" />
                    Show Unmapped Services ({unmappedServices.length})
                  </Button>
                )}
                
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

        {/* Unmapped Services Modal */}
        <Dialog open={isUnmappedServicesModalOpen} onOpenChange={setIsUnmappedServicesModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span>Unmapped Services ({unmappedServices.length})</span>
              </DialogTitle>
              <DialogDescription>
                These services don't have a project type mapping yet. You can map them when creating a new project type.
              </DialogDescription>
            </DialogHeader>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmappedServices.map((service) => (
                    <TableRow key={service.id} data-testid={`row-unmapped-service-${service.id}`}>
                      <TableCell className="font-medium">
                        <span data-testid={`text-unmapped-service-name-${service.id}`}>
                          {service.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm" data-testid={`text-unmapped-service-description-${service.id}`}>
                          {service.description || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Needs Mapping
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-center pt-2">
              <p className="text-sm text-muted-foreground">
                Create a new project type and select one of these services to establish the mapping.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Content */}
        <div className="flex-1 overflow-auto page-container py-6 md:py-8">
          {projectTypesLoading ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Mapped Service</TableHead>
                    <TableHead>Stages</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(6)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Mapped Service</TableHead>
                    <TableHead>Stages</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjectTypes.map((projectType) => {
                    const service = services?.find(s => s.id === projectType.serviceId);
                    const stageCount = stageCountQueries.data?.[projectType.id] || 0;
                    
                    return (
                      <ProjectTypeRow
                        key={projectType.id}
                        projectType={projectType}
                        stageCount={stageCount}
                        serviceName={service?.name || null}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
