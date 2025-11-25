import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, User as UserIcon } from "lucide-react";
import { formatPersonName } from "../../utils/formatters";
import { 
  AddServiceData, 
  addServiceSchema, 
  ServiceWithDetails, 
  ClientPersonWithPerson,
  AddServiceModalProps 
} from "../../utils/types";
import type { User, Client } from "@shared/schema";

export function AddServiceModal({ clientId, clientType = 'company', onSuccess }: AddServiceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const { toast } = useToast();
  
  // Helper function to determine field state for visual indicators
  const getFieldState = (fieldName: keyof AddServiceData, isRequired: boolean = false): 'required-empty' | 'required-filled' | 'optional' | 'error' => {
    const formErrors = form.formState.errors;
    const fieldValue = form.getValues(fieldName);
    const hasError = !!formErrors[fieldName];
    
    if (hasError) return 'error';
    
    if (isRequired) {
      return fieldValue ? 'required-filled' : 'required-empty';
    }
    
    return 'optional';
  };
  
  // Helper for role assignment field states
  const getRoleFieldState = (roleId: string): 'required-empty' | 'required-filled' | 'error' => {
    const hasAssignment = !!roleAssignments[roleId];
    return hasAssignment ? 'required-filled' : 'required-empty';
  };
  
  // Helper for person selection field state
  const getPersonFieldState = (): 'required-empty' | 'required-filled' | 'error' => {
    return selectedPersonId ? 'required-filled' : 'required-empty';
  };
  
  const form = useForm<AddServiceData>({
    resolver: zodResolver(addServiceSchema),
    defaultValues: {
      frequency: "monthly",
      nextStartDate: "",
      nextDueDate: "",
      serviceOwnerId: "",
    },
  });

  // Fetch client data for Companies House fields
  const { data: client } = useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });

  // Fetch available services based on client type
  const servicesQueryKey = clientType === 'individual' 
    ? ['/api/services'] // All services (will filter to personal services only)
    : ['/api/services/client-assignable']; // Client assignable services only
    
  const { data: allServices, isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: servicesQueryKey,
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });
  
  // Filter services based on client type
  const services = clientType === 'individual' 
    ? allServices?.filter(service => service.isPersonalService) 
    : allServices;

  // Fetch related people for this client (needed for personal service assignment)
  const { data: clientPeople, isLoading: peopleLoading } = useQuery<ClientPersonWithPerson[]>({
    queryKey: [`/api/clients/${clientId}/people`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(isOpen && selectedService?.isPersonalService),
  });

  // Fetch users for role assignments and service owner selection
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });

  // Service selection change handler with Companies House auto-population and personal service detection
  const handleServiceChange = (serviceId: string) => {
    const service = services?.find(s => s.id === serviceId);
    if (!service) return;
    
    setSelectedService(service);
    
    // Reset assignments when service changes
    setRoleAssignments({});
    setSelectedPersonId("");
    
    // Clear fields for static services (they don't need frequency, dates, or owner)
    if (service.isStaticService) {
      form.setValue('frequency', undefined as any);
      form.setValue('nextStartDate', '');
      form.setValue('nextDueDate', '');
      form.setValue('serviceOwnerId', '');
    }
    // Auto-populate Companies House fields if service is CH-connected
    else if (service.isCompaniesHouseConnected && client) {
      // Force annual frequency
      form.setValue('frequency', 'annually');
      
      // Auto-populate start and due dates from client CH data
      if (service.chStartDateField && service.chDueDateField) {
        const startDateValue = client[service.chStartDateField as keyof Client] as string | Date | null;
        const dueDateValue = client[service.chDueDateField as keyof Client] as string | Date | null;
        
        if (startDateValue) {
          const startDate = new Date(startDateValue);
          form.setValue('nextStartDate', startDate.toISOString().split('T')[0]);
        }
        
        if (dueDateValue) {
          const dueDate = new Date(dueDateValue);
          form.setValue('nextDueDate', dueDate.toISOString().split('T')[0]);
        }
      }
    }
  };
  
  // Handle role assignment changes
  const handleRoleAssignmentChange = (roleId: string, userId: string) => {
    setRoleAssignments(prev => ({ ...prev, [roleId]: userId }));
  };
  
  // Validate that all roles are assigned (gracefully handle missing roles data)
  const areAllRolesAssigned = () => {
    if (!selectedService || !selectedService.roles || selectedService.roles.length === 0) return true;
    return selectedService.roles.every(role => roleAssignments[role.id]);
  };

  // Validate form is ready for submission
  const canSubmit = () => {
    if (!selectedService) return false;
    if (isPersonalService) {
      return !!selectedPersonId; // Personal service requires person selection
    } else {
      return areAllRolesAssigned(); // Client service requires role assignments
    }
  };
  
  // Check if service has roles that need assignment
  const hasRolesToAssign = () => {
    return selectedService?.roles && selectedService.roles.length > 0;
  };

  // Check if selected service is personal service
  const isPersonalService = selectedService?.isPersonalService || false;

  // Handle person selection change
  const handlePersonChange = (personId: string) => {
    setSelectedPersonId(personId);
  };

  // Create people service mutation for personal services
  const createPeopleServiceMutation = useMutation({
    mutationFn: async (data: AddServiceData) => {
      // Convert date strings to datetime format for backend validation
      const formatDateToDateTime = (dateString: string | undefined): string | null => {
        if (!dateString) return null;
        // HTML date inputs provide YYYY-MM-DD format, convert to ISO datetime
        return new Date(dateString + 'T00:00:00.000Z').toISOString();
      };

      return await apiRequest("POST", "/api/people-services", {
        personId: selectedPersonId,
        serviceId: data.serviceId,
        serviceOwnerId: data.serviceOwnerId || null,
        frequency: data.frequency,
        nextStartDate: formatDateToDateTime(data.nextStartDate),
        nextDueDate: formatDateToDateTime(data.nextDueDate),
        notes: null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Personal Service Added",
        description: "Personal service has been successfully assigned to the person.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/people-services/service/${selectedService?.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/people`] });
      form.reset();
      setSelectedService(null);
      setSelectedPersonId("");
      setRoleAssignments({});
      setIsOpen(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add personal service. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create client service mutation with role assignments
  const createClientServiceMutation = useMutation({
    mutationFn: async (data: AddServiceData) => {
      // Step 1: Create the client service
      const clientService = await apiRequest("POST", "/api/client-services", {
        clientId,
        serviceId: data.serviceId,
        frequency: data.frequency,
        nextStartDate: data.nextStartDate && data.nextStartDate.trim() ? new Date(data.nextStartDate).toISOString() : null,
        nextDueDate: data.nextDueDate && data.nextDueDate.trim() ? new Date(data.nextDueDate).toISOString() : null,
        serviceOwnerId: data.serviceOwnerId && data.serviceOwnerId.trim() ? data.serviceOwnerId : null,
      });
      
      // Step 2: Create role assignments if any roles are assigned
      if (selectedService?.roles && roleAssignments && Object.keys(roleAssignments).length > 0) {
        try {
          const roleAssignmentPromises = Object.entries(roleAssignments).map(([roleId, userId]) => 
            apiRequest("POST", `/api/client-services/${clientService.id}/role-assignments`, {
              workRoleId: roleId,
              userId: userId,
            })
          );
          
          await Promise.all(roleAssignmentPromises);
        } catch (roleError) {
          // Role assignment failed but service was created - inform user
          throw new Error(`Service was created but role assignments failed: ${roleError instanceof Error ? roleError.message : 'Unknown error'}. Please assign roles manually from the service management page.`);
        }
      }
      
      return clientService;
    },
    onSuccess: () => {
      toast({
        title: "Service Added",
        description: "Service has been successfully added to the client.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/client-services/client/${clientId}`] });
      form.reset();
      setSelectedService(null);
      setRoleAssignments({});
      setIsOpen(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add service. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddServiceData) => {
    // Handle personal services vs client services
    if (isPersonalService) {
      // Validate person selection for personal services
      if (!selectedPersonId) {
        toast({
          title: "Person Required",
          description: "Please select a person to assign this personal service to.",
          variant: "destructive",
        });
        return;
      }
      createPeopleServiceMutation.mutate(data);
    } else {
      // Skip validation for static services (they don't require frequency, dates, or service owner)
      if (!isStaticService) {
        // Validate required fields for non-static client services
        if (!data.frequency) {
          toast({
            title: "Frequency Required",
            description: "Please select a frequency for this client service.",
            variant: "destructive",
          });
          return;
        }
        if (!data.nextStartDate) {
          toast({
            title: "Start Date Required", 
            description: "Please select a next start date for this client service.",
            variant: "destructive",
          });
          return;
        }
        if (!data.nextDueDate) {
          toast({
            title: "Due Date Required",
            description: "Please select a next due date for this client service.",
            variant: "destructive",
          });
          return;
        }
        if (!data.serviceOwnerId) {
          toast({
            title: "Service Owner Required",
            description: "Please select a service owner for this client service.",
            variant: "destructive",
          });
          return;
        }
        // Validate role assignments for client services
        if (!areAllRolesAssigned()) {
          toast({
            title: "Incomplete Role Assignments",
            description: "Please assign users to all required roles before saving.",
            variant: "destructive",
          });
          return;
        }
      }
      createClientServiceMutation.mutate(data);
    }
  };
  
  // Check if Companies House service is selected
  const isCompaniesHouseService = selectedService?.isCompaniesHouseConnected || false;
  
  // Check if Static service is selected
  const isStaticService = selectedService?.isStaticService || false;
  
  // Helper to check if field should be disabled (only if CH service AND data was successfully populated)
  const isFieldDisabled = (fieldName: 'frequency' | 'nextStartDate' | 'nextDueDate') => {
    if (!isCompaniesHouseService) return false;
    
    // Only disable if the field was actually populated with CH data
    if (fieldName === 'frequency') {
      return form.getValues('frequency') === 'annually';
    }
    if (fieldName === 'nextStartDate') {
      return !!form.getValues('nextStartDate');
    }
    if (fieldName === 'nextDueDate') {
      return !!form.getValues('nextDueDate');
    }
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-service">
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Column 1: Service Details */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Service Details</h3>
                <FormField
                  control={form.control}
                  name="serviceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        required={true} 
                        fieldState={getFieldState('serviceId', true)}
                      >
                        Service
                      </FormLabel>
                      <Select onValueChange={(value) => { field.onChange(value); handleServiceChange(value); }} value={field.value}>
                        <FormControl>
                          <SelectTrigger 
                            data-testid="select-service"
                            fieldState={getFieldState('serviceId', true)}
                          >
                            <SelectValue placeholder="Select a service" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {servicesLoading ? (
                            <div className="p-2 text-center text-muted-foreground">Loading services...</div>
                          ) : services && services.length > 0 ? (
                            services.map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name}
                                {service.isPersonalService && (
                                  <Badge variant="secondary" className="ml-2 text-xs">Personal Service</Badge>
                                )}
                                {service.isStaticService && (
                                  <Badge variant="outline" className="ml-2 text-xs text-gray-500 border-gray-300">Static</Badge>
                                )}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-center text-muted-foreground">No services available</div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Wrapper for fields that should be grayed out for static services */}
                <div className="relative">
                  {/* Overlay for static services */}
                  {isStaticService && (
                    <div className="absolute inset-0 bg-blue-100/80 dark:bg-blue-950/80 rounded-lg z-10 flex items-center justify-center backdrop-blur-sm">
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-blue-200 dark:border-blue-700 max-w-sm">
                        <p className="text-sm text-blue-900 dark:text-blue-100 text-center font-medium">
                          No details are required for the <span className="font-semibold">{selectedService?.name}</span> service
                        </p>
                      </div>
                    </div>
                  )}

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        fieldState={isPersonalService || isStaticService ? 'optional' : getFieldState('frequency', !isPersonalService && !isStaticService)}
                      >
                        Frequency
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={isFieldDisabled('frequency') || isStaticService}
                      >
                        <FormControl>
                          <SelectTrigger 
                            data-testid="select-frequency"
                            fieldState={isFieldDisabled('frequency') || isStaticService ? undefined : (isPersonalService ? 'optional' : getFieldState('frequency', !isPersonalService))}
                            className={isFieldDisabled('frequency') || isStaticService ? 'bg-muted text-muted-foreground pointer-events-none' : ''}
                          >
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                      {isCompaniesHouseService && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Frequency is automatically set to "Annually" for Companies House services
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        fieldState={isPersonalService || isStaticService ? 'optional' : getFieldState('nextStartDate', !isPersonalService && !isStaticService)}
                      >
                        Next Start Date
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-next-start-date"
                          fieldState={isFieldDisabled('nextStartDate') || isStaticService ? undefined : (isPersonalService ? 'optional' : getFieldState('nextStartDate', !isPersonalService))}
                          disabled={isFieldDisabled('nextStartDate') || isStaticService}
                          className={isFieldDisabled('nextStartDate') || isStaticService ? 'bg-muted text-muted-foreground pointer-events-none' : ''}
                        />
                      </FormControl>
                      {isCompaniesHouseService && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Date automatically populated from Companies House data
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextDueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        fieldState={isPersonalService || isStaticService ? 'optional' : getFieldState('nextDueDate', !isPersonalService && !isStaticService)}
                      >
                        Next Due Date
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-next-due-date"
                          fieldState={isFieldDisabled('nextDueDate') || isStaticService ? undefined : (isPersonalService ? 'optional' : getFieldState('nextDueDate', !isPersonalService))}
                          disabled={isFieldDisabled('nextDueDate') || isStaticService}
                          className={isFieldDisabled('nextDueDate') || isStaticService ? 'bg-muted text-muted-foreground pointer-events-none' : ''}
                        />
                      </FormControl>
                      {isCompaniesHouseService && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Date automatically populated from Companies House data
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
              </div>

              {/* Column 2: Service Owner & Role Assignments */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Owner & Team</h3>
                
                {/* Wrapper for Service Owner that should be grayed out for static services */}
                <div className="relative">
                  {/* Overlay for static services */}
                  {isStaticService && (
                    <div className="absolute inset-0 bg-blue-100/80 dark:bg-blue-950/80 rounded-lg z-10 flex items-center justify-center backdrop-blur-sm">
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-blue-200 dark:border-blue-700 max-w-sm">
                        <p className="text-sm text-blue-900 dark:text-blue-100 text-center font-medium">
                          No owner assignment needed
                        </p>
                      </div>
                    </div>
                  )}

                <FormField
                  control={form.control}
                  name="serviceOwnerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        required={!isPersonalService && !isStaticService} 
                        fieldState={isPersonalService || isStaticService ? 'optional' : getFieldState('serviceOwnerId', !isPersonalService && !isStaticService)}
                      >
                        Service Owner
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isStaticService}>
                        <FormControl>
                          <SelectTrigger 
                            data-testid="select-service-owner"
                            fieldState={isPersonalService || isStaticService ? 'optional' : getFieldState('serviceOwnerId', !isPersonalService && !isStaticService)}
                            className={isStaticService ? 'bg-muted text-muted-foreground pointer-events-none' : ''}
                          >
                            <SelectValue placeholder="Select service owner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {usersLoading ? (
                            <div className="p-2 text-center text-muted-foreground">Loading users...</div>
                          ) : users && users.length > 0 ? (
                            users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-center text-muted-foreground">No users available</div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>

                {/* Person Selection - Only shown for personal services */}
                {isPersonalService && (
                  <div className="space-y-2">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <UserIcon className="w-4 h-4 text-blue-600" />
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">Personal Service Assignment</h4>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-200 mb-4">
                        This is a personal service. Please select the person to assign this service to.
                      </p>
                      {peopleLoading ? (
                        <div className="text-sm text-muted-foreground">Loading related people...</div>
                      ) : clientPeople && clientPeople.length > 0 ? (
                        <div>
                          <label className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 block">
                            Select Person <span className="text-red-500">*</span>
                          </label>
                          <Select onValueChange={handlePersonChange} value={selectedPersonId}>
                            <SelectTrigger 
                              data-testid="select-person" 
                              fieldState={getPersonFieldState()}
                              className="bg-white dark:bg-gray-800"
                            >
                              <SelectValue placeholder="Choose a person to assign this service to" />
                            </SelectTrigger>
                            <SelectContent>
                              {clientPeople.map((clientPerson) => (
                                <SelectItem key={clientPerson.person.id} value={clientPerson.person.id}>
                                  {formatPersonName(clientPerson.person.fullName)}
                                  {(clientPerson.person.primaryEmail || clientPerson.person.email) && (
                                    <span className="text-muted-foreground ml-2">({clientPerson.person.primaryEmail || clientPerson.person.email})</span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="text-sm text-amber-700 dark:text-amber-200">
                          No people are associated with this client yet. Please add people to the client first.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Role Assignments Section */}
                {hasRolesToAssign() && !isPersonalService && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-sm mb-3">Role Assignments</h4>
                      <p className="text-xs text-muted-foreground mb-4">
                        Assign users to the required roles for this service.
                      </p>
                      
                      <div className="space-y-3">
                        {selectedService?.roles?.map((role) => (
                          <div key={role.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h5 className="font-medium text-sm">{role.name}</h5>
                                {role.description && (
                                  <p className="text-xs text-muted-foreground">{role.description}</p>
                                )}
                              </div>
                            </div>
                            <Select 
                              value={roleAssignments[role.id] || ""} 
                              onValueChange={(userId) => handleRoleAssignmentChange(role.id, userId)}
                            >
                              <SelectTrigger 
                                className="w-full" 
                                data-testid={`select-role-${role.id}`}
                                fieldState={getRoleFieldState(role.id)}
                              >
                                <SelectValue placeholder="Select user" />
                              </SelectTrigger>
                              <SelectContent>
                                {usersLoading ? (
                                  <div className="p-2 text-center text-muted-foreground">Loading users...</div>
                                ) : users && users.length > 0 ? (
                                  users.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {user.firstName} {user.lastName}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="p-2 text-center text-muted-foreground">No users available</div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                      
                      {/* Role assignment validation message */}
                      {hasRolesToAssign() && !areAllRolesAssigned() && !isPersonalService && (
                        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Please assign users to all roles before saving the service.
                          </p>
                        </div>
                      )}
                      
                      {/* Personal service validation message */}
                      {isPersonalService && !selectedPersonId && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Please select a person to assign this personal service to.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                data-testid="button-cancel-add-service"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createClientServiceMutation.isPending || createPeopleServiceMutation.isPending || !canSubmit()}
                data-testid="button-save-service"
              >
                {(createClientServiceMutation.isPending || createPeopleServiceMutation.isPending) ? 
                  "Adding..." : 
                  isPersonalService ? "Assign Personal Service" : "Add Service"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
