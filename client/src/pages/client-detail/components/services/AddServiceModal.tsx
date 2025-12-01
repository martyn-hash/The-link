import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
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
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, User as UserIcon, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { formatPersonName } from "../../utils/formatters";
import { 
  AddServiceData, 
  addServiceSchema, 
  ServiceWithDetails, 
  ClientPersonWithPerson,
  AddServiceModalProps 
} from "../../utils/types";
import type { User, Client } from "@shared/schema";

const VAT_UDF_FIELD_ID = 'vat_number_auto';
const VAT_ADDRESS_UDF_FIELD_ID = 'vat_address_auto';

interface VatValidationStatus {
  status: 'idle' | 'validating' | 'valid' | 'invalid' | 'bypassed';
  companyName?: string;
  address?: string;
  error?: string;
}

export function AddServiceModal({ clientId, clientType = 'company', onSuccess }: AddServiceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [udfValues, setUdfValues] = useState<Record<string, any>>({});
  const [udfErrors, setUdfErrors] = useState<Record<string, string>>({});
  const [vatValidation, setVatValidation] = useState<VatValidationStatus>({ status: 'idle' });
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
      targetDeliveryDate: "",
      serviceOwnerId: "",
    },
  });

  // Fetch client data for Companies House fields
  const { data: client } = useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });

  // Fetch all services - we'll filter them based on applicableClientTypes
  const clientTypeLower = clientType?.toLowerCase();
    
  const { data: allServices, isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ['/api/services'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });
  
  // Filter services based on client type using applicableClientTypes field
  // 'both' services should show for either client type
  const services = allServices?.filter(service => {
    const applicableType = (service as any).applicableClientTypes || 'company';
    if (applicableType === 'both') return true;
    if (clientTypeLower === 'individual') {
      return applicableType === 'individual';
    }
    return applicableType === 'company';
  });

  // Fetch related people for this client (needed for personal service assignment)
  // Should fetch when service is 'individual' or 'both' for individual clients
  const selectedServiceApplicableType = selectedService ? (selectedService as any).applicableClientTypes || 'company' : null;
  const shouldShowPersonSelection = selectedServiceApplicableType === 'individual' || 
    (selectedServiceApplicableType === 'both' && clientTypeLower === 'individual');
  
  const { data: clientPeople, isLoading: peopleLoading } = useQuery<ClientPersonWithPerson[]>({
    queryKey: [`/api/clients/${clientId}/people`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(isOpen && shouldShowPersonSelection),
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
    
    // Reset assignments, UDF values, errors, and VAT validation when service changes
    setRoleAssignments({});
    setSelectedPersonId("");
    setUdfValues({});
    setUdfErrors({});
    setVatValidation({ status: 'idle' });
    
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
    return selectedService.roles.every((role: any) => roleAssignments[role.id]);
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

  // Check if selected service should be treated as personal service for this client type
  // A service is treated as personal if:
  // - applicableClientTypes === 'individual' (always personal)
  // - applicableClientTypes === 'both' AND the client is an individual
  const isPersonalService = (() => {
    if (!selectedService) return false;
    const applicableType = (selectedService as any).applicableClientTypes || 'company';
    if (applicableType === 'individual') return true;
    if (applicableType === 'both' && clientTypeLower === 'individual') return true;
    return false;
  })();

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
        targetDeliveryDate: formatDateToDateTime(data.targetDeliveryDate),
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
      setUdfValues({});
      setUdfErrors({});
      setVatValidation({ status: 'idle' });
      setIsOpen(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error: error?.message || "Failed to add personal service. Please try again." });
    },
  });

  // Create client service mutation with role assignments
  const createClientServiceMutation = useMutation({
    mutationFn: async (data: AddServiceData) => {
      // Process UDF values - convert date strings to ISO format
      const processedUdfValues: Record<string, any> = {};
      if (selectedService?.udfDefinitions && Array.isArray(selectedService.udfDefinitions)) {
        selectedService.udfDefinitions.forEach((field: any) => {
          const value = udfValues[field.id];
          if (field.type === 'date' && value) {
            processedUdfValues[field.id] = new Date(value).toISOString();
          } else if (value !== undefined && value !== '') {
            processedUdfValues[field.id] = value;
          }
        });
      }
      
      // Step 1: Create the client service
      const clientService = await apiRequest("POST", "/api/client-services", {
        clientId,
        serviceId: data.serviceId,
        frequency: data.frequency,
        nextStartDate: data.nextStartDate && data.nextStartDate.trim() ? new Date(data.nextStartDate).toISOString() : null,
        nextDueDate: data.nextDueDate && data.nextDueDate.trim() ? new Date(data.nextDueDate).toISOString() : null,
        targetDeliveryDate: data.targetDeliveryDate && data.targetDeliveryDate.trim() ? new Date(data.targetDeliveryDate).toISOString() : null,
        serviceOwnerId: data.serviceOwnerId && data.serviceOwnerId.trim() ? data.serviceOwnerId : null,
        udfValues: Object.keys(processedUdfValues).length > 0 ? processedUdfValues : undefined,
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
      setUdfValues({});
      setUdfErrors({});
      setVatValidation({ status: 'idle' });
      setIsOpen(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error: error?.message || "Failed to add service. Please try again." });
    },
  });

  // VAT validation mutation
  const validateVatMutation = useMutation({
    mutationFn: async (vatNumber: string) => {
      return await apiRequest("POST", "/api/vat/validate", { vatNumber });
    },
    onSuccess: (data: any) => {
      if (data.isValid) {
        // Check if validation was bypassed (HMRC API disabled)
        if (data.bypassed) {
          setVatValidation({
            status: 'bypassed',
          });
          toast({
            title: "VAT Validation Bypassed",
            description: "HMRC validation is temporarily unavailable. You can continue with the VAT number entered.",
          });
        } else {
          setVatValidation({
            status: 'valid',
            companyName: data.companyName,
            address: data.address,
          });
          // Auto-populate the VAT address field
          if (data.address) {
            let fullAddress = data.address;
            if (data.postcode) {
              fullAddress += '\n' + data.postcode;
            }
            setUdfValues(prev => ({ ...prev, [VAT_ADDRESS_UDF_FIELD_ID]: fullAddress }));
          }
          toast({
            title: "VAT Number Validated",
            description: `VAT is registered to: ${data.companyName}`,
          });
        }
      } else {
        setVatValidation({
          status: 'invalid',
          error: data.error || 'VAT number not found in HMRC records',
        });
        showFriendlyError({ error: data.error || "This VAT number was not found in HMRC records. Please check and try again." });
      }
    },
    onError: (error: any) => {
      setVatValidation({
        status: 'invalid',
        error: error?.message || 'Failed to validate VAT number',
      });
      showFriendlyError({ error: error?.message || "Could not connect to HMRC API. Please try again." });
    },
  });

  // Check if the selected service is a VAT service
  const isVatService = (selectedService as any)?.isVatService === true;

  // Handle VAT number validation
  const handleValidateVat = () => {
    const vatNumber = udfValues[VAT_UDF_FIELD_ID];
    if (!vatNumber) {
      showFriendlyError({ error: "Please enter a VAT number first" });
      return;
    }
    setVatValidation({ status: 'validating' });
    validateVatMutation.mutate(vatNumber);
  };

  // Handle VAT number change - reset validation when number changes
  const handleVatNumberChange = (value: string) => {
    setUdfValues(prev => ({ ...prev, [VAT_UDF_FIELD_ID]: value }));
    // Reset validation status when VAT number changes
    if (vatValidation.status !== 'idle') {
      setVatValidation({ status: 'idle' });
    }
    // Clear error for this field
    if (udfErrors[VAT_UDF_FIELD_ID]) {
      setUdfErrors(prev => ({ ...prev, [VAT_UDF_FIELD_ID]: '' }));
    }
  };

  // Validate UDF values (including required fields and regex patterns)
  const validateUdfValues = (): boolean => {
    if (!selectedService?.udfDefinitions || !Array.isArray(selectedService.udfDefinitions)) {
      return true;
    }

    const errors: Record<string, string> = {};
    let hasErrors = false;

    (selectedService.udfDefinitions as any[]).forEach((field: any) => {
      const value = udfValues[field.id];
      const isEmpty = value === undefined || value === null || value === '' || 
                      (typeof value === 'string' && value.trim() === '');

      // Check required fields
      if (field.required && isEmpty && field.type !== 'boolean') {
        errors[field.id] = `${field.name} is required`;
        hasErrors = true;
        return;
      }

      // Check regex pattern if defined and value is not empty
      if (field.regex && !isEmpty) {
        try {
          const regex = new RegExp(field.regex);
          if (!regex.test(String(value))) {
            errors[field.id] = field.regexError || `Invalid format for ${field.name}`;
            hasErrors = true;
          }
        } catch {
          // Invalid regex pattern - skip validation
        }
      }
    });

    setUdfErrors(errors);

    if (hasErrors) {
      const firstError = Object.values(errors)[0];
      showFriendlyError({ error: firstError });
    }

    return !hasErrors;
  };

  const onSubmit = (data: AddServiceData) => {
    // Validate UDF values first (for both personal and client services)
    if (!validateUdfValues()) {
      return;
    }

    // For VAT services, check that VAT has been validated successfully
    // Allow 'valid' or 'bypassed' status to proceed
    if (isVatService && udfValues[VAT_UDF_FIELD_ID]) {
      if (vatValidation.status === 'idle' || vatValidation.status === 'validating') {
        showFriendlyError({ error: "Please validate the VAT number before adding this service." });
        return;
      }
      if (vatValidation.status === 'invalid') {
        showFriendlyError({ error: "The VAT number is invalid. Please correct it or remove it before continuing." });
        return;
      }
      // 'valid' and 'bypassed' statuses allow submission
    }

    // Handle personal services vs client services
    if (isPersonalService) {
      // Validate person selection for personal services
      if (!selectedPersonId) {
        showFriendlyError({ error: "Please select a person to assign this personal service to." });
        return;
      }
      createPeopleServiceMutation.mutate(data);
    } else {
      // Skip validation for static services (they don't require frequency, dates, or service owner)
      if (!isStaticService) {
        // Validate required fields for non-static client services
        if (!data.frequency) {
          showFriendlyError({ error: "Please select a frequency for this client service." });
          return;
        }
        if (!data.nextStartDate) {
          showFriendlyError({ error: "Please select a next start date for this client service." });
          return;
        }
        if (!data.nextDueDate) {
          showFriendlyError({ error: "Please select a next due date for this client service." });
          return;
        }
        if (!data.serviceOwnerId) {
          showFriendlyError({ error: "Please select a service owner for this client service." });
          return;
        }
        // Validate role assignments for client services
        if (!areAllRolesAssigned()) {
          showFriendlyError({ error: "Please assign users to all required roles before saving." });
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
  
  // Check if service has UDF definitions
  const hasUdfFields = selectedService?.udfDefinitions && 
    Array.isArray(selectedService.udfDefinitions) && 
    selectedService.udfDefinitions.length > 0;
  
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
      <DialogContent className={`max-h-[80vh] overflow-y-auto ${hasUdfFields ? 'sm:max-w-6xl' : 'sm:max-w-4xl'}`}>
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className={`grid grid-cols-1 gap-8 ${hasUdfFields ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
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
                                {(service as any).applicableClientTypes === 'both' && (
                                  <Badge variant="secondary" className="ml-2 text-xs bg-indigo-500 text-white">Both</Badge>
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

                <FormField
                  control={form.control}
                  name="targetDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel fieldState="optional">
                        Target Delivery Date
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-target-delivery-date"
                          disabled={isStaticService}
                          className={isStaticService ? 'bg-muted text-muted-foreground pointer-events-none' : ''}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Internal target date for delivery before the due date
                      </p>
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
                        {selectedService?.roles?.map((role: any) => (
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

              {/* Column 3: Service-Specific Details (UDFs) - Only shown when service has UDF definitions */}
              {hasUdfFields && (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Service-Specific Details
                  </h3>
                  <div className="space-y-4">
                    {(selectedService?.udfDefinitions as any[])?.map((field: any) => {
                      const hasError = !!udfErrors[field.id];
                      const errorMessage = udfErrors[field.id];
                      const inputClassName = hasError ? "border-red-500 focus-visible:ring-red-500" : "";
                      
                      return (
                        <div key={field.id} className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-1">
                            {field.name}
                            {field.required && <span className="text-red-500">*</span>}
                          </label>
                          
                          {field.type === 'number' && (
                            <Input
                              type="number"
                              value={udfValues[field.id] ?? ''}
                              onChange={(e) => {
                                setUdfValues({ ...udfValues, [field.id]: e.target.value ? Number(e.target.value) : null });
                                if (udfErrors[field.id]) {
                                  setUdfErrors({ ...udfErrors, [field.id]: '' });
                                }
                              }}
                              placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
                              className={inputClassName}
                              data-testid={`input-udf-${field.id}`}
                            />
                          )}
                          
                          {field.type === 'date' && (
                            <Input
                              type="date"
                              value={udfValues[field.id] ?? ''}
                              onChange={(e) => {
                                setUdfValues({ ...udfValues, [field.id]: e.target.value });
                                if (udfErrors[field.id]) {
                                  setUdfErrors({ ...udfErrors, [field.id]: '' });
                                }
                              }}
                              className={inputClassName}
                              data-testid={`input-udf-${field.id}`}
                            />
                          )}
                          
                          {field.type === 'boolean' && (
                            <div className="flex items-center space-x-2 h-10">
                              <Switch
                                checked={udfValues[field.id] ?? false}
                                onCheckedChange={(checked) => setUdfValues({ ...udfValues, [field.id]: checked })}
                                data-testid={`switch-udf-${field.id}`}
                              />
                              <span className="text-sm text-muted-foreground">
                                {udfValues[field.id] ? 'Yes' : 'No'}
                              </span>
                            </div>
                          )}
                          
                          {field.type === 'short_text' && field.id === VAT_UDF_FIELD_ID && isVatService && (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  value={udfValues[field.id] ?? ''}
                                  onChange={(e) => handleVatNumberChange(e.target.value)}
                                  placeholder={field.placeholder || "e.g. GB123456789"}
                                  className={`flex-1 ${hasError ? 'border-red-500 focus-visible:ring-red-500' : vatValidation.status === 'valid' ? 'border-green-500' : vatValidation.status === 'bypassed' ? 'border-amber-500' : vatValidation.status === 'invalid' ? 'border-red-500' : ''}`}
                                  data-testid="input-vat-number"
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant={vatValidation.status === 'valid' || vatValidation.status === 'bypassed' ? 'outline' : 'default'}
                                      size="sm"
                                      onClick={handleValidateVat}
                                      disabled={vatValidation.status === 'validating' || !udfValues[field.id]}
                                      className="whitespace-nowrap"
                                      data-testid="button-validate-vat"
                                    >
                                      {vatValidation.status === 'validating' ? (
                                        <><Loader2 className="h-4 w-4 animate-spin mr-1" />Checking</>
                                      ) : vatValidation.status === 'valid' ? (
                                        <><CheckCircle2 className="h-4 w-4 text-green-600 mr-1" />Valid</>
                                      ) : vatValidation.status === 'bypassed' ? (
                                        <><CheckCircle2 className="h-4 w-4 text-amber-600 mr-1" />Accepted</>
                                      ) : vatValidation.status === 'invalid' ? (
                                        <><AlertCircle className="h-4 w-4 text-red-600 mr-1" />Retry</>
                                      ) : (
                                        'Validate'
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Validate VAT number with HMRC</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              {vatValidation.status === 'valid' && vatValidation.companyName && (
                                <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                                  <p className="text-sm text-green-800 dark:text-green-200">
                                    <CheckCircle2 className="h-4 w-4 inline mr-1" />
                                    Registered to: <strong>{vatValidation.companyName}</strong>
                                  </p>
                                </div>
                              )}
                              {vatValidation.status === 'bypassed' && (
                                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                                  <p className="text-sm text-amber-800 dark:text-amber-200">
                                    <AlertCircle className="h-4 w-4 inline mr-1" />
                                    HMRC validation temporarily unavailable. VAT number accepted without verification.
                                  </p>
                                </div>
                              )}
                              {vatValidation.status === 'invalid' && (
                                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                                  <p className="text-sm text-red-800 dark:text-red-200">
                                    <AlertCircle className="h-4 w-4 inline mr-1" />
                                    {vatValidation.error || 'VAT number not found'}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {field.type === 'short_text' && !(field.id === VAT_UDF_FIELD_ID && isVatService) && (
                            <Input
                              type="text"
                              value={udfValues[field.id] ?? ''}
                              onChange={(e) => {
                                setUdfValues({ ...udfValues, [field.id]: e.target.value });
                                if (udfErrors[field.id]) {
                                  setUdfErrors({ ...udfErrors, [field.id]: '' });
                                }
                              }}
                              placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
                              className={inputClassName}
                              data-testid={`input-udf-${field.id}`}
                            />
                          )}
                          
                          {field.type === 'long_text' && field.id === VAT_ADDRESS_UDF_FIELD_ID && isVatService && (
                            <div className="space-y-1">
                              <textarea
                                value={udfValues[field.id] ?? ''}
                                onChange={(e) => {
                                  setUdfValues({ ...udfValues, [field.id]: e.target.value });
                                  if (udfErrors[field.id]) {
                                    setUdfErrors({ ...udfErrors, [field.id]: '' });
                                  }
                                }}
                                readOnly={vatValidation.status === 'valid'}
                                placeholder={vatValidation.status === 'valid' ? '' : 'Validate VAT number to auto-populate address'}
                                className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${hasError ? 'border-red-500 focus-visible:ring-red-500' : vatValidation.status === 'valid' ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : ''}`}
                                data-testid="textarea-vat-address"
                              />
                              {vatValidation.status === 'valid' && (
                                <p className="text-xs text-muted-foreground">
                                  Address auto-populated from HMRC VAT records
                                </p>
                              )}
                            </div>
                          )}
                          
                          {field.type === 'long_text' && !(field.id === VAT_ADDRESS_UDF_FIELD_ID && isVatService) && (
                            <textarea
                              value={udfValues[field.id] ?? ''}
                              onChange={(e) => {
                                setUdfValues({ ...udfValues, [field.id]: e.target.value });
                                if (udfErrors[field.id]) {
                                  setUdfErrors({ ...udfErrors, [field.id]: '' });
                                }
                              }}
                              placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
                              className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${hasError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                              data-testid={`textarea-udf-${field.id}`}
                            />
                          )}
                          
                          {field.type === 'select' && field.options && (
                            <Select 
                              value={udfValues[field.id] ?? ''} 
                              onValueChange={(value) => {
                                setUdfValues({ ...udfValues, [field.id]: value });
                                if (udfErrors[field.id]) {
                                  setUdfErrors({ ...udfErrors, [field.id]: '' });
                                }
                              }}
                            >
                              <SelectTrigger 
                                className={inputClassName}
                                data-testid={`select-udf-${field.id}`}
                              >
                                <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options.map((option: string) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          
                          {/* Error message display */}
                          {hasError && (
                            <p className="text-xs text-red-500">{errorMessage}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
