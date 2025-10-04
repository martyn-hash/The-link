import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Briefcase, Users, Calendar, Clock, UserIcon, Edit, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import TopNavigation from "@/components/top-navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { ClientService, Service, User, WorkRole, ClientServiceRoleAssignment, ProjectWithRelations, Client } from "@shared/schema";

type EnhancedClientService = ClientService & {
  service: Service & {
    projectType?: {
      id: string;
      name: string;
      description: string | null;
    };
  };
  serviceOwner?: User | null;
  roleAssignments?: Array<ClientServiceRoleAssignment & { 
    workRole: WorkRole; 
    user: User;
  }>;
  client: Client;
};

// Utility function to format dates
function formatDate(date: string | Date | null): string {
  if (!date) return 'Not provided';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Form schema for editing service
const updateServiceSchema = z.object({
  nextStartDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'annually', 'one-off']).optional(),
  serviceOwnerId: z.string().optional(),
  isActive: z.boolean().optional(),
});

type UpdateServiceData = z.infer<typeof updateServiceSchema>;

export default function ClientServiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Fetch client service data
  const { data: clientService, isLoading, error } = useQuery<EnhancedClientService>({
    queryKey: [`/api/client-services/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  // Fetch related projects
  const { data: projects = [] } = useQuery<ProjectWithRelations[]>({
    queryKey: [`/api/projects/service/${clientService?.serviceId}`],
    enabled: !!clientService?.serviceId,
  });

  // Fetch all users for service owner dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Edit form setup
  const editForm = useForm<UpdateServiceData>({
    resolver: zodResolver(updateServiceSchema),
    defaultValues: {
      nextStartDate: "",
      nextDueDate: "",
      frequency: "monthly",
      serviceOwnerId: "",
      isActive: true,
    },
  });

  // Populate form when data loads
  useEffect(() => {
    if (clientService) {
      editForm.reset({
        nextStartDate: clientService.nextStartDate ? new Date(clientService.nextStartDate).toISOString().split('T')[0] : "",
        nextDueDate: clientService.nextDueDate ? new Date(clientService.nextDueDate).toISOString().split('T')[0] : "",
        frequency: clientService.frequency as any,
        serviceOwnerId: clientService.serviceOwnerId || "",
        isActive: clientService.isActive !== false,
      });
    }
  }, [clientService, editForm]);

  // Update service mutation
  const updateServiceMutation = useMutation({
    mutationFn: async (data: UpdateServiceData) => {
      return await apiRequest("PUT", `/api/client-services/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Service Updated",
        description: "Service details have been updated successfully",
      });
      setShowEditDialog(false);
      queryClient.invalidateQueries({ queryKey: [`/api/client-services/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update service",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: UpdateServiceData) => {
    updateServiceMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="container mx-auto p-4 md:p-6">
          <Skeleton className="h-12 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
        </div>
        {isMobile && <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />}
      </div>
    );
  }

  if (error || !clientService) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="container mx-auto p-4 md:p-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Service Not Found</h2>
            <p className="text-muted-foreground mb-4">The service you're looking for doesn't exist or you don't have permission to view it.</p>
            <Button onClick={() => setLocation('/clients')} data-testid="button-back-to-clients">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Button>
          </div>
        </div>
        {isMobile && <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      
      {!isMobile && <SuperSearch />}

      <div className="container mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation(`/clients/${clientService.clientId}`)}
            className="mb-4"
            data-testid="button-back-to-client"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {clientService.client.name}
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold" data-testid="text-service-name">
                  {clientService.service.name}
                </h1>
                {clientService.service?.isStaticService && (
                  <Badge variant="secondary" className="bg-gray-500 text-white" data-testid="badge-static">
                    Static
                  </Badge>
                )}
                {clientService.service?.isPersonalService && (
                  <Badge variant="secondary" className="bg-purple-500 text-white" data-testid="badge-personal">
                    Personal
                  </Badge>
                )}
                {clientService.service?.isCompaniesHouseConnected && (
                  <Badge variant="secondary" className="bg-blue-500 text-white" data-testid="badge-ch">
                    CH
                  </Badge>
                )}
                <Badge variant={clientService.isActive !== false ? "default" : "secondary"} data-testid="badge-status">
                  {clientService.isActive !== false ? "Active" : "Inactive"}
                </Badge>
              </div>
              {clientService.service.description && (
                <p className="text-muted-foreground" data-testid="text-service-description">
                  {clientService.service.description}
                </p>
              )}
            </div>
            <Button onClick={() => setShowEditDialog(true)} data-testid="button-edit-service">
              <Edit className="h-4 w-4 mr-2" />
              Edit Service
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Service Details Card */}
          <Card data-testid="card-service-details">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Service Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Frequency</label>
                <p className="font-medium" data-testid="text-frequency">
                  {clientService.frequency || '-'}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Next Start Date</label>
                <p className="font-medium" data-testid="text-next-start">
                  {formatDate(clientService.nextStartDate)}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Next Due Date</label>
                <p className="font-medium" data-testid="text-next-due">
                  {formatDate(clientService.nextDueDate)}
                </p>
              </div>
              {clientService.service.projectType && (
                <div>
                  <label className="text-sm text-muted-foreground">Project Type</label>
                  <p className="font-medium" data-testid="text-project-type">
                    {clientService.service.projectType.name}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service Owner Card */}
          <Card data-testid="card-service-owner">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Service Owner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientService.serviceOwner ? (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground">Name</label>
                    <p className="font-medium" data-testid="text-owner-name">
                      {clientService.serviceOwner.firstName} {clientService.serviceOwner.lastName}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <p className="font-medium" data-testid="text-owner-email">
                      {clientService.serviceOwner.email || '-'}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">No service owner assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Role Assignments Card */}
          <Card data-testid="card-role-assignments" className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Role Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientService.roleAssignments && clientService.roleAssignments.length > 0 ? (
                <div className="space-y-3">
                  {clientService.roleAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-4 rounded-lg border bg-card"
                      data-testid={`role-assignment-${assignment.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium" data-testid={`text-role-name-${assignment.id}`}>
                            {assignment.workRole.name}
                          </h4>
                          {assignment.workRole.description && (
                            <p className="text-sm text-muted-foreground" data-testid={`text-role-description-${assignment.id}`}>
                              {assignment.workRole.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-medium" data-testid={`text-assigned-user-${assignment.id}`}>
                            {assignment.user.firstName} {assignment.user.lastName}
                          </div>
                          {assignment.user.email && (
                            <p className="text-sm text-muted-foreground">{assignment.user.email}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No role assignments configured for this service.</p>
              )}
            </CardContent>
          </Card>

          {/* Related Projects Card */}
          <Card data-testid="card-related-projects" className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Related Projects
                {projects.length > 0 && <Badge variant="secondary">{projects.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/projects/${project.id}`)}
                      data-testid={`project-${project.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium" data-testid={`text-project-title-${project.id}`}>
                            {project.description}
                          </h4>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            {project.dueDate && (
                              <span>Due: {formatDate(project.dueDate)}</span>
                            )}
                            {project.projectMonth && (
                              <span>Month: {project.projectMonth}</span>
                            )}
                          </div>
                        </div>
                        <Badge variant={project.currentStatus === 'completed' ? 'default' : 'secondary'}>
                          {project.currentStatus}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No related projects found for this service.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Service Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-service">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                        <SelectItem value="one-off">One-off</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="nextStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-next-start" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="nextDueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-next-due" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="serviceOwnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Owner</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-service-owner">
                          <SelectValue placeholder="Select service owner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  disabled={updateServiceMutation.isPending}
                  data-testid="button-cancel-edit"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateServiceMutation.isPending}
                  data-testid="button-save-edit"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateServiceMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Mobile Search Modal */}
      {isMobile && (
        <SuperSearch 
          isOpen={mobileSearchOpen} 
          onOpenChange={setMobileSearchOpen}
        />
      )}

      {isMobile && <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />}
    </div>
  );
}
