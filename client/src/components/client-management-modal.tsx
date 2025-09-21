import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Client, type Service, type WorkRole, type User, type ClientService, type ClientServiceRoleAssignment, insertClientSchema } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  X, 
  Loader2,
  UserCheck,
  UserX
} from "lucide-react";

// Form schema for client creation/editing
const clientFormSchema = insertClientSchema;

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ServiceRoleCompleteness {
  clientServiceId: string;
  serviceName: string;
  serviceId: string;
  isComplete: boolean;
  missingRoles: { id: string; name: string }[];
  assignedRoles: { id: string; name: string; assignedUser: string }[];
}

interface ServiceRoleCompletenessResponse {
  clientId: string;
  overallComplete: boolean;
  services: ServiceRoleCompleteness[];
}

interface ServiceWithDetails extends Service {
  projectType: {
    id: string;
    name: string;
  };
  roles: WorkRole[];
}

interface ClientManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSuccess?: () => void;
}

export function ClientManagementModal({
  open,
  onOpenChange,
  client,
  onSuccess,
}: ClientManagementModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'details' | 'services'>('details');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, Record<string, string>>>({});
  const [serviceOwnerAssignments, setServiceOwnerAssignments] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ServiceRoleCompleteness[]>([]);

  const isEditing = !!client;

  // Form setup
  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  // Reset form when client changes
  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        email: client.email || "",
      });
      setStep('services'); // Start on services step for editing
    } else {
      form.reset({
        name: "",
        email: "",
      });
      setStep('details'); // Start on details step for creation
      setSelectedServices([]);
      setRoleAssignments({});
      setServiceOwnerAssignments({});
      setValidationErrors([]);
    }
  }, [client, form]);

  // Fetch services
  const { data: services, isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services"],
    enabled: open,
    retry: false,
  });

  // Fetch users for role assignments
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: open,
    retry: false,
  });

  // Fetch existing client services when editing
  const { data: existingClientServices } = useQuery<(ClientService & { service: ServiceWithDetails })[]>({
    queryKey: ["/api/client-services/client", client?.id],
    enabled: open && isEditing && !!client?.id,
    retry: false,
  });

  // Fetch service role completeness for existing client
  const { data: roleCompleteness, refetch: refetchCompleteness } = useQuery<ServiceRoleCompletenessResponse>({
    queryKey: ["/api/clients", client?.id, "service-role-completeness"],
    enabled: open && isEditing && !!client?.id,
    retry: false,
  });

  // Set existing services, role assignments, service owner assignments, and validation errors when data loads
  useEffect(() => {
    if (existingClientServices && !selectedServices.length) {
      setSelectedServices(existingClientServices.map(cs => cs.serviceId));
      
      // Initialize service owner assignments from existing client services
      const initialServiceOwnerAssignments: Record<string, string> = {};
      existingClientServices.forEach(cs => {
        if (cs.serviceOwnerId) {
          initialServiceOwnerAssignments[cs.serviceId] = cs.serviceOwnerId;
        }
      });
      setServiceOwnerAssignments(initialServiceOwnerAssignments);
    }
    if (roleCompleteness) {
      const incompleteServices = roleCompleteness.services.filter(s => !s.isComplete);
      setValidationErrors(incompleteServices);
      
      // Initialize roleAssignments from server data during edit mode
      if (isEditing) {
        const initialRoleAssignments: Record<string, Record<string, string>> = {};
        
        roleCompleteness.services.forEach(service => {
          initialRoleAssignments[service.serviceId] = {};
          service.assignedRoles.forEach(assignedRole => {
            // Find the user ID by matching the assigned user name
            const assignedUser = users?.find(u => `${u.firstName} ${u.lastName}` === assignedRole.assignedUser);
            if (assignedUser) {
              initialRoleAssignments[service.serviceId][assignedRole.id] = assignedUser.id;
            }
          });
        });
        
        setRoleAssignments(initialRoleAssignments);
      }
    }
  }, [existingClientServices, roleCompleteness, selectedServices.length, isEditing, users]);

  // Atomic client creation with services and role assignments
  const createClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      // Step 1: Create the client
      const clientResponse = await apiRequest("POST", "/api/clients", data);
      const newClient = await clientResponse.json() as Client;
      
      // Step 2: If services are selected, create all services and role assignments atomically
      if (selectedServices.length > 0) {
        try {
          // Create all client-service mappings in parallel
          const clientServicePromises = selectedServices.map(serviceId => {
            const payload: any = {
              clientId: newClient.id,
              serviceId,
            };
            
            // Add serviceOwnerId if assigned for this service
            const assignedOwnerId = serviceOwnerAssignments[serviceId];
            if (assignedOwnerId && assignedOwnerId.trim() !== "") {
              payload.serviceOwnerId = assignedOwnerId;
            }
            
            return apiRequest("POST", "/api/client-services", payload);
          });
          
          await Promise.all(clientServicePromises);
          
          // Get the created client services to get their IDs
          const clientServicesResponse = await apiRequest("GET", `/api/client-services/client/${newClient.id}`);
          const clientServices = await clientServicesResponse.json() as (ClientService & { service: ServiceWithDetails })[];
          
          // Create all role assignments in parallel
          const roleAssignmentPromises: Promise<any>[] = [];
          
          for (const clientService of clientServices) {
            if (selectedServices.includes(clientService.serviceId)) {
              const serviceRoles = clientService.service.roles;
              
              for (const role of serviceRoles) {
                const assignedUserId = roleAssignments[clientService.serviceId]?.[role.id];
                if (assignedUserId) {
                  roleAssignmentPromises.push(
                    apiRequest("POST", `/api/client-services/${clientService.id}/role-assignments`, {
                      clientServiceId: clientService.id,
                      workRoleId: role.id,
                      userId: assignedUserId,
                      isActive: true,
                    })
                  );
                }
              }
            }
          }
          
          // Execute all role assignments in parallel
          await Promise.all(roleAssignmentPromises);
          
          // Final validation to ensure everything was created correctly
          const validationResponse = await apiRequest("GET", `/api/clients/${newClient.id}/service-role-completeness`);
          const completeness = await validationResponse.json() as ServiceRoleCompletenessResponse;
          
          const incompleteServices = completeness.services.filter(s => !s.isComplete);
          if (incompleteServices.length > 0) {
            throw new Error(`Client created but ${incompleteServices.length} service(s) have incomplete role assignments`);
          }
          
        } catch (error) {
          // If service/role assignment fails, we need to clean up the client
          try {
            await apiRequest("DELETE", `/api/clients/${newClient.id}`);
          } catch (cleanupError) {
            console.error("Failed to cleanup client after service assignment failure:", cleanupError);
          }
          throw error;
        }
      }
      
      return newClient;
    },
    onSuccess: (newClient) => {
      toast({ 
        title: "Success", 
        description: selectedServices.length > 0 
          ? "Client created successfully with all service role assignments" 
          : "Client created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      });
    },
  });

  // Update client mutation with role completeness validation
  const updateClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      if (!client?.id) throw new Error("Client ID is required");
      
      // CRITICAL FIX: Validate role completeness BEFORE saving
      const validationResponse = await apiRequest("GET", `/api/clients/${client.id}/service-role-completeness`);
      const completeness = await validationResponse.json() as ServiceRoleCompletenessResponse;
      
      const incompleteServices = completeness.services.filter(s => !s.isComplete);
      if (incompleteServices.length > 0) {
        throw new Error(`Cannot save client: ${incompleteServices.length} service(s) have incomplete role assignments. Please assign all required roles before saving.`);
      }
      
      // Only update the client AFTER validation passes
      const response = await apiRequest("PUT", `/api/clients/${client.id}`, data);
      const updatedClient = await response.json() as Client;
      
      return updatedClient;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Client updated successfully with complete role assignments" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client?.id, "service-role-completeness"] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update client",
        variant: "destructive",
      });
    },
  });

  // These functions are no longer needed as we now use atomic operations in the mutations

  // Pre-submit validation for service role completeness
  const validateBeforeSubmit = (): boolean => {
    if (selectedServices.length === 0) {
      return true; // No services selected, no validation needed
    }
    
    // For editing mode, use the server roleCompleteness data if available
    if (isEditing && roleCompleteness) {
      const incompleteServices = roleCompleteness.services.filter(s => !s.isComplete);
      if (incompleteServices.length > 0) {
        setValidationErrors(incompleteServices);
        toast({
          title: "Incomplete Role Assignments",
          description: `${incompleteServices.length} service(s) have incomplete role assignments. Please assign all required roles before saving.`,
          variant: "destructive",
        });
        return false;
      }
      setValidationErrors([]);
      return true;
    }
    
    // For creation mode, use client-side validation
    const validation = validateRoleCompleteness();
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      toast({
        title: "Incomplete Role Assignments",
        description: `${validation.errors.length} service(s) have incomplete role assignments. Please assign all required roles before saving.`,
        variant: "destructive",
      });
      return false;
    }
    
    setValidationErrors([]);
    return true;
  };

  // Handle form submission
  const onSubmit = async (data: ClientFormData) => {
    // For editing mode, allow submission from both steps
    if (isEditing) {
      // Validate roles first, then update client
      if (!validateBeforeSubmit()) {
        return; // Validation failed, don't proceed
      }
      updateClientMutation.mutate(data);
    } else {
      // For creation mode, only allow submission from details step
      if (step === 'details') {
        // Validate first if services are selected
        if (!validateBeforeSubmit()) {
          return; // Validation failed, don't proceed
        }
        createClientMutation.mutate(data);
      }
    }
  };

  // Handle service selection change
  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  // Handle role assignment change
  const handleRoleAssignmentChange = (serviceId: string, roleId: string, userId: string) => {
    setRoleAssignments(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [roleId]: userId,
      }
    }));
  };

  // Enhanced validation to check role completeness and get detailed error info
  const validateRoleCompleteness = () => {
    if (!services || selectedServices.length === 0) return { isValid: true, errors: [] };
    
    const errors: ServiceRoleCompleteness[] = [];
    
    for (const serviceId of selectedServices) {
      const service = services.find(s => s.id === serviceId);
      if (service) {
        const missingRoles: { id: string; name: string }[] = [];
        const assignedRoles: { id: string; name: string; assignedUser: string }[] = [];
        
        for (const role of service.roles) {
          const assignedUserId = roleAssignments[serviceId]?.[role.id];
          if (!assignedUserId) {
            missingRoles.push({ id: role.id, name: role.name });
          } else {
            const assignedUser = users?.find(u => u.id === assignedUserId);
            assignedRoles.push({ 
              id: role.id, 
              name: role.name, 
              assignedUser: assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : 'Unknown User'
            });
          }
        }
        
        if (missingRoles.length > 0) {
          errors.push({
            clientServiceId: serviceId, // Using serviceId as placeholder since client service doesn't exist yet
            serviceName: service.name,
            serviceId: serviceId,
            isComplete: false,
            missingRoles,
            assignedRoles
          });
        }
      }
    }
    
    return { isValid: errors.length === 0, errors };
  };

  // Check if all required roles are assigned for selected services
  const areAllRolesAssigned = () => {
    return validateRoleCompleteness().isValid;
  };

  // Enhanced submit validation with proper error checking
  const canSubmit = () => {
    if (isEditing) {
      // For editing mode, allow submit from both steps if form is valid and roles are complete
      const formValid = form.formState.isValid;
      const rolesValid = step === 'services' 
        ? (roleCompleteness ? roleCompleteness.overallComplete : areAllRolesAssigned())
        : true;
      return formValid && rolesValid && validationErrors.length === 0;
    } else {
      // For creation mode, only allow submit from details step
      if (step === 'details') {
        return form.formState.isValid;
      }
      return false;
    }
  };

  const isSubmitting = createClientMutation.isPending || updateClientMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title-client">
            {isEditing ? "Edit Client" : "Create New Client"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update client information and manage service role assignments"
              : "Add a new client and assign services with their required roles"
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Client Details */}
            {step === 'details' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5" />
                  <h3 className="text-lg font-medium">Client Details</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter client name"
                            data-testid="input-client-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="client@example.com"
                            data-testid="input-client-email"
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!isEditing && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      <h3 className="text-lg font-medium">Service Assignment (Optional)</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Select services to assign to this client. You can also assign services later.
                    </p>

                    {servicesLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="border rounded-lg p-4">
                            <Skeleton className="h-4 w-32 mb-2" />
                            <Skeleton className="h-3 w-48 mb-2" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {services?.map((service) => (
                          <Card 
                            key={service.id} 
                            className={`cursor-pointer border-2 transition-colors ${
                              selectedServices.includes(service.id) 
                                ? 'border-primary bg-primary/5' 
                                : 'border-muted hover:border-primary/50'
                            }`}
                            onClick={() => handleServiceToggle(service.id)}
                            data-testid={`card-service-${service.id}`}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between">
                                <CardTitle className="text-base">{service.name}</CardTitle>
                                {selectedServices.includes(service.id) && (
                                  <CheckCircle className="w-5 h-5 text-primary" />
                                )}
                              </div>
                              {service.description && (
                                <CardDescription className="text-sm">
                                  {service.description}
                                </CardDescription>
                              )}
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="w-4 h-4" />
                                <span>{service.roles.length} role(s) required</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {service.roles.map((role) => (
                                  <Badge key={role.id} variant="secondary" className="text-xs">
                                    {role.name}
                                  </Badge>
                                ))}
                              </div>
                              
                              {/* Service Owner Selection - only show for selected services */}
                              {selectedServices.includes(service.id) && (
                                <div className="mt-3 pt-3 border-t">
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Service Owner Override (Optional)
                                    </label>
                                    <Select
                                      value={serviceOwnerAssignments[service.id] || "none"}
                                      onValueChange={(value) => {
                                        setServiceOwnerAssignments(prev => ({
                                          ...prev,
                                          [service.id]: value === "none" ? "" : (value || "")
                                        }));
                                      }}
                                      data-testid={`select-service-owner-${service.id}`}
                                    >
                                      <SelectTrigger className="w-full" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue placeholder="Choose service owner (optional)" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none" key="none">No override (use service default)</SelectItem>
                                        {users?.map((user) => (
                                          <SelectItem key={user.id} value={user.id}>
                                            {user.firstName} {user.lastName}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {service.serviceOwnerId && (
                                      <p className="text-xs text-muted-foreground">
                                        Default: {users?.find(u => u.id === service.serviceOwnerId)?.firstName} {users?.find(u => u.id === service.serviceOwnerId)?.lastName || "Unknown"}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Role assignments for selected services */}
                    {selectedServices.length > 0 && (
                      <div className="space-y-4">
                        <Separator />
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-5 h-5" />
                          <h3 className="text-lg font-medium">Role Assignments</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Assign users to the required roles for each selected service.
                        </p>

                        {/* Validation errors display for creation flow */}
                        {validationErrors.length > 0 && (
                          <Alert variant="destructive" data-testid="alert-creation-validation-errors">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>
                              <div className="space-y-2">
                                <p className="font-medium">Service role assignments are incomplete:</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {validationErrors.map((error) => (
                                    <li key={error.clientServiceId}>
                                      <strong>{error.serviceName}</strong>: {error.missingRoles.map(r => r.name).join(", ")} need user assignments
                                    </li>
                                  ))}
                                </ul>
                                <p className="text-sm">Please assign users to all required roles before creating the client.</p>
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}

                        {selectedServices.map((serviceId) => {
                          const service = services?.find(s => s.id === serviceId);
                          if (!service) return null;

                          // Check if this service has missing role assignments
                          const serviceValidationError = validationErrors.find(error => error.serviceId === serviceId);
                          const hasValidationErrors = !!serviceValidationError;

                          return (
                            <Card key={serviceId} data-testid={`card-role-assignment-${serviceId}`} 
                                  className={hasValidationErrors ? "border-destructive" : ""}>
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base">{service.name}</CardTitle>
                                  {hasValidationErrors && (
                                    <Badge variant="destructive" className="text-xs">
                                      <UserX className="w-3 h-3 mr-1" />
                                      Incomplete
                                    </Badge>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {service.roles.map((role) => {
                                  const isRoleMissing = serviceValidationError?.missingRoles.some(mr => mr.id === role.id);
                                  return (
                                    <div key={role.id} className="flex items-center gap-4">
                                      <div className="min-w-0 flex-1">
                                        <p className={`font-medium text-sm ${isRoleMissing ? 'text-destructive' : ''}`}>
                                          {role.name}
                                          {isRoleMissing && <span className="ml-1 text-destructive">*</span>}
                                        </p>
                                        {role.description && (
                                          <p className="text-xs text-muted-foreground">{role.description}</p>
                                        )}
                                        {isRoleMissing && (
                                          <p className="text-xs text-destructive">This role requires a user assignment</p>
                                        )}
                                      </div>
                                      <div className="w-48">
                                        <Select 
                                          value={roleAssignments[serviceId]?.[role.id] || ""}
                                          onValueChange={(userId) => {
                                            handleRoleAssignmentChange(serviceId, role.id, userId);
                                            // Clear validation errors when user makes assignments
                                            if (validationErrors.length > 0) {
                                              const newValidation = validateRoleCompleteness();
                                              setValidationErrors(newValidation.errors);
                                            }
                                          }}
                                          data-testid={`select-role-assignment-${serviceId}-${role.id}`}
                                        >
                                          <SelectTrigger className={`w-full ${isRoleMissing ? 'border-destructive' : ''}`}>
                                            <SelectValue placeholder="Select user" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {users?.map((user) => (
                                              <SelectItem key={user.id} value={user.id}>
                                                {user.firstName} {user.lastName}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  );
                                })}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Service Management (for editing) */}
            {step === 'services' && isEditing && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5" />
                  <h3 className="text-lg font-medium">Service Role Assignments</h3>
                </div>

                {/* Validation errors */}
                {validationErrors.length > 0 && (
                  <Alert variant="destructive" data-testid="alert-validation-errors">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">Service role assignments are incomplete:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {validationErrors.map((error) => (
                            <li key={error.clientServiceId}>
                              <strong>{error.serviceName}</strong>: {error.missingRoles.map(r => r.name).join(", ")} need user assignments
                            </li>
                          ))}
                        </ul>
                        <p className="text-sm">Please assign users to all required roles before saving.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Service completeness display */}
                {roleCompleteness && (
                  <div className="space-y-4">
                    {roleCompleteness.services.map((service) => (
                      <Card key={service.clientServiceId} data-testid={`card-service-completeness-${service.serviceId}`}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{service.serviceName}</CardTitle>
                            <div className="flex items-center gap-2">
                              {service.isComplete ? (
                                <Badge variant="default" className="bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Complete
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <UserX className="w-3 h-3 mr-1" />
                                  Incomplete
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {service.assignedRoles.map((role) => (
                              <div key={role.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                <span className="font-medium">{role.name}</span>
                                <span className="text-sm text-muted-foreground">Assigned to {role.assignedUser}</span>
                              </div>
                            ))}
                            {service.missingRoles.map((role) => (
                              <div key={role.id} className="flex items-center justify-between p-2 bg-destructive/10 rounded">
                                <span className="font-medium">{role.name}</span>
                                <span className="text-sm text-destructive">Not assigned</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => refetchCompleteness()}
                    data-testid="button-refresh-completeness"
                  >
                    <Loader2 className="w-4 h-4 mr-2" />
                    Refresh Status
                  </Button>
                </div>
              </div>
            )}

            {/* Form actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-client"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit() || isSubmitting}
                data-testid="button-submit-client"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    {isEditing ? "Update Client" : "Create Client"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}