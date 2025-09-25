import { useParams, Link as WouterLink } from "wouter";
import { useState, useLayoutEffect, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, ExternalLink, Plus, ChevronDown, ChevronRight, ChevronUp, Phone, Mail, UserIcon, Clock, Settings, Users, Briefcase, Check, ShieldCheck, Link, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import TopNavigation from "@/components/top-navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import AddressLookup from "@/components/address-lookup";
import AddressMap from "@/components/address-map";
import TagManager from "@/components/tag-manager";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { Client, Person, ClientPerson, Service, ClientService, User, WorkRole, ClientServiceRoleAssignment, PeopleService } from "@shared/schema";
import { insertPersonSchema } from "@shared/schema";

// Utility function to format names from "LASTNAME, Firstname" to "Firstname Lastname"
function formatPersonName(fullName: string): string {
  if (!fullName) return '';
  
  // Check if name is in "LASTNAME, Firstname" format
  if (fullName.includes(',')) {
    const [lastName, firstName] = fullName.split(',').map(part => part.trim());
    
    // Convert to proper case and return "Firstname Lastname"
    const formattedFirstName = firstName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    const formattedLastName = lastName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    
    return `${formattedFirstName} ${formattedLastName}`;
  }
  
  // If not in comma format, return as is (already in proper format)
  return fullName;
}

// Utility function to format general dates
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

// Utility function to format birth dates from Companies House (which only provides month/year)
function formatBirthDate(dateOfBirth: string | Date | null): string {
  if (!dateOfBirth) return 'Not provided';
  
  // Handle string inputs - detect if this looks like a partial date from Companies House
  if (typeof dateOfBirth === 'string') {
    // Pattern for partial dates: "YYYY-MM" or "YYYY-MM-01" with optional time suffix
    const partialDatePattern = /^(\d{4})-(\d{2})(?:-01(?:T00:00:00(?:\.\d+)?Z?)?)?$/;
    const match = dateOfBirth.match(partialDatePattern);
    
    if (match) {
      const [, year, month] = match;
      // This looks like a partial date - show as month/year
      // Use UTC to avoid timezone issues
      const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
      
      // Validate the constructed date
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-GB', { 
        month: 'long', 
        year: 'numeric',
        timeZone: 'UTC'
      });
    }
  }
  
  // For full dates or non-matching patterns, create date object
  const date = new Date(dateOfBirth);
  
  // Handle invalid dates
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  // Show full date for complete date information
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC'
  });
}

type ClientPersonWithPerson = ClientPerson & { person: Person };
type ClientServiceWithService = ClientService & { 
  service: Service & { 
    projectType: { id: string; name: string; description: string | null; serviceId: string | null; active: boolean | null; order: number; createdAt: Date | null } 
  } 
};

// Types for enhanced service data
type ServiceWithDetails = Service & {
  roles: WorkRole[];
};

// Enhanced client service type that includes service owner and role assignments
type EnhancedClientService = ClientService & {
  service: Service & {
    projectType?: {
      id: string;
      name: string;
      description: string | null;
      serviceId: string | null;
      active: boolean | null;
      order: number;
      createdAt: Date | null;
    };
  };
  serviceOwner?: User;
  roleAssignments: (ClientServiceRoleAssignment & {
    workRole: WorkRole;
    user: User;
  })[];
};

// Form schema for adding services (conditional validation based on service type)
const addServiceSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]).optional(),
  nextStartDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  serviceOwnerId: z.string().optional(),
});

type AddServiceData = z.infer<typeof addServiceSchema>;

// Validation schema for adding new person data
const addPersonSchema = insertPersonSchema.extend({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  email2: z.string().email("Invalid email format").optional().or(z.literal("")),
  telephone2: z.string().optional().or(z.literal("")),
  linkedinUrl: z.union([z.string().url("Invalid LinkedIn URL"), z.literal("")]).optional(),
  instagramUrl: z.union([z.string().url("Invalid Instagram URL"), z.literal("")]).optional(),
  twitterUrl: z.union([z.string().url("Invalid Twitter/X URL"), z.literal("")]).optional(),
  facebookUrl: z.union([z.string().url("Invalid Facebook URL"), z.literal("")]).optional(),
  tiktokUrl: z.union([z.string().url("Invalid TikTok URL"), z.literal("")]).optional(),
});

type InsertPersonData = z.infer<typeof addPersonSchema>;

// Validation schema for updating person data - use shared schema for consistency
const updatePersonSchema = insertPersonSchema.partial().extend({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  email2: z.string().email("Invalid email format").optional().or(z.literal("")),
  telephone2: z.string().optional().or(z.literal("")),
  linkedinUrl: z.union([z.string().url("Invalid LinkedIn URL"), z.literal("")]).optional(),
  instagramUrl: z.union([z.string().url("Invalid Instagram URL"), z.literal("")]).optional(),
  twitterUrl: z.union([z.string().url("Invalid Twitter/X URL"), z.literal("")]).optional(),
  facebookUrl: z.union([z.string().url("Invalid Facebook URL"), z.literal("")]).optional(),
  tiktokUrl: z.union([z.string().url("Invalid TikTok URL"), z.literal("")]).optional(),
});

type UpdatePersonData = z.infer<typeof updatePersonSchema>;

// Helper function to mask sensitive identifiers
function maskIdentifier(value: string, visibleChars = 2): string {
  if (!value || value.length <= visibleChars) return value;
  const masked = '*'.repeat(Math.max(0, value.length - visibleChars));
  return masked + value.slice(-visibleChars);
}

// PersonCardProps removed - using Accordion pattern

interface AddServiceModalProps {
  clientId: string;
  clientType?: 'company' | 'individual';
  onSuccess: () => void;
}

function AddServiceModal({ clientId, clientType = 'company', onSuccess }: AddServiceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const { toast } = useToast();
  
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
    
    // Auto-populate Companies House fields if service is CH-connected
    if (service.isCompaniesHouseConnected && client) {
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
      const peopleServiceResponse = await apiRequest("POST", "/api/people-services", {
        personId: selectedPersonId,
        serviceId: data.serviceId,
        serviceOwnerId: data.serviceOwnerId || null,
        notes: null,
      });
      
      return await peopleServiceResponse.json();
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
      onSuccess();
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
      const clientServiceResponse = await apiRequest("POST", "/api/client-services", {
        clientId,
        serviceId: data.serviceId,
        frequency: data.frequency,
        nextStartDate: data.nextStartDate && data.nextStartDate.trim() ? new Date(data.nextStartDate).toISOString() : null,
        nextDueDate: data.nextDueDate && data.nextDueDate.trim() ? new Date(data.nextDueDate).toISOString() : null,
        serviceOwnerId: data.serviceOwnerId,
      });
      
      const clientService = await clientServiceResponse.json();
      
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
      onSuccess();
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
      // Validate required fields for client services
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
      createClientServiceMutation.mutate(data);
    }
  };
  
  // Check if Companies House service is selected
  const isCompaniesHouseService = selectedService?.isCompaniesHouseConnected || false;
  
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
                      <FormLabel>Service</FormLabel>
                      <Select onValueChange={(value) => { field.onChange(value); handleServiceChange(value); }} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-service">
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


                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={isFieldDisabled('frequency')}
                      >
                        <FormControl>
                          <SelectTrigger 
                            data-testid="select-frequency"
                            className={isFieldDisabled('frequency') ? 'bg-muted text-muted-foreground' : ''}
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
                      <FormLabel>Next Start Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-next-start-date"
                          disabled={isFieldDisabled('nextStartDate')}
                          className={isFieldDisabled('nextStartDate') ? 'bg-muted text-muted-foreground' : ''}
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
                      <FormLabel>Next Due Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-next-due-date"
                          disabled={isFieldDisabled('nextDueDate')}
                          className={isFieldDisabled('nextDueDate') ? 'bg-muted text-muted-foreground' : ''}
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

              {/* Column 2: Service Owner & Role Assignments */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Owner & Team</h3>
                
                <FormField
                  control={form.control}
                  name="serviceOwnerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Owner *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-service-owner">
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
                            <SelectTrigger data-testid="select-person" className="bg-white dark:bg-gray-800">
                              <SelectValue placeholder="Choose a person to assign this service to" />
                            </SelectTrigger>
                            <SelectContent>
                              {clientPeople.map((clientPerson) => (
                                <SelectItem key={clientPerson.person.id} value={clientPerson.person.id}>
                                  {formatPersonName(clientPerson.person.fullName)}
                                  {clientPerson.person.email && (
                                    <span className="text-muted-foreground ml-2">({clientPerson.person.email})</span>
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
                {hasRolesToAssign() && (
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
                              <SelectTrigger className="w-full" data-testid={`select-role-${role.id}`}>
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

// Add Person Modal Component
function AddPersonModal({ 
  clientId, 
  isOpen, 
  onClose, 
  onSave, 
  isSaving 
}: {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InsertPersonData) => void;
  isSaving: boolean;
}) {
  const form = useForm<InsertPersonData>({
    resolver: zodResolver(insertPersonSchema),
    defaultValues: {
      fullName: "",
      title: "",
      dateOfBirth: "",
      nationality: "",
      occupation: "",
      telephone: "",
      email: "",
      telephone2: "",
      email2: "",
      linkedinUrl: "",
      twitterUrl: "",
      facebookUrl: "",
      instagramUrl: "",
      tiktokUrl: "",
      addressLine1: "",
      postalCode: "",
      locality: "",
      region: "",
      country: "",
      addressVerified: false,
      niNumber: "",
      personalUtrNumber: "",
      photoIdVerified: false,
      isMainContact: false,
    },
  });

  const handleSubmit = (data: InsertPersonData) => {
    onSave(data);
  };

  const handleAddressSelect = (addressData: any) => {
    // Map from AddressLookup format to form fields
    form.setValue("addressLine1", addressData.addressLine1 || "");
    form.setValue("postalCode", addressData.postalCode || "");
    form.setValue("locality", addressData.locality || "");
    form.setValue("region", addressData.region || "");
    form.setValue("country", addressData.country || "United Kingdom");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Person</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  Basic Information
                </h5>
                
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-fullName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} data-testid="input-dateOfBirth" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="nationality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nationality</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-nationality" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="occupation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occupation</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-occupation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isMainContact"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          data-testid="input-isMainContact"
                        />
                      </FormControl>
                      <FormLabel>Main Contact</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  Address Information
                </h5>
                
                <div>
                  <label className="text-sm font-medium">Address Lookup</label>
                  <AddressLookup 
                    onAddressSelect={handleAddressSelect}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Start typing to search for addresses
                  </p>
                </div>
                
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-addressLine1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-postalCode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="locality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Locality</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-locality" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-region" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-country" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Verification & Other */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <ShieldCheck className="h-4 w-4 mr-2 text-muted-foreground" />
                  Verification & Other
                </h5>
                
                <FormField
                  control={form.control}
                  name="niNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NI Number</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-niNumber" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="personalUtrNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personal UTR</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-personalUtrNumber" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="photoIdVerified"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          data-testid="input-photoIdVerified"
                        />
                      </FormControl>
                      <FormLabel>Photo ID Verified</FormLabel>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="addressVerified"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          data-testid="input-addressVerified"
                        />
                      </FormControl>
                      <FormLabel>Address Verified</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information - New 1-column section */}
            <div className="space-y-4 border-t pt-6">
              <h5 className="font-medium text-sm flex items-center">
                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                Contact Information
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Contact */}
                <div className="space-y-4">
                  <h6 className="text-sm font-medium">Primary Contact Details</h6>
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="telephone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-telephone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Secondary Contact */}
                <div className="space-y-4">
                  <h6 className="text-sm font-medium">Additional Contact Details</h6>
                  
                  <FormField
                    control={form.control}
                    name="email2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email2" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="telephone2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Phone</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-telephone2" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Social Media */}
              <div className="space-y-4">
                <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="linkedinUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://linkedin.com/in/..." data-testid="input-linkedinUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="twitterUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter/X URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://twitter.com/..." data-testid="input-twitterUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="facebookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://facebook.com/..." data-testid="input-facebookUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="instagramUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://instagram.com/..." data-testid="input-instagramUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="tiktokUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TikTok URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://tiktok.com/@..." data-testid="input-tiktokUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                data-testid="button-cancel-add-person"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSaving}
                data-testid="button-save-add-person"
              >
                {isSaving ? "Adding..." : "Add Person"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// PersonCard component removed - using Accordion pattern

// Component for viewing person details (read-only mode) - shows all fields like edit form
function PersonViewMode({ 
  clientPerson, 
  revealedIdentifiers, 
  setRevealedIdentifiers, 
  onEdit,
  peopleServices 
}: {
  clientPerson: ClientPersonWithPerson;
  revealedIdentifiers: Set<string>;
  setRevealedIdentifiers: (fn: (prev: Set<string>) => Set<string>) => void;
  onEdit: () => void;
  peopleServices?: (PeopleService & { person: Person; service: Service; serviceOwner?: User })[];
}) {
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h5 className="font-medium text-sm flex items-center">
            <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
            Basic Information
          </h5>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <p className="text-sm mt-1" data-testid={`view-fullName-${clientPerson.id}`}>
                {formatPersonName(clientPerson.person.fullName) || 'Not provided'}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <p className="text-sm mt-1" data-testid={`view-title-${clientPerson.id}`}>
                {clientPerson.person.title || 'Not provided'}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
              <p className="text-sm mt-1" data-testid={`view-dateOfBirth-${clientPerson.id}`}>
                {formatBirthDate(clientPerson.person.dateOfBirth)}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nationality</label>
              <p className="text-sm mt-1" data-testid={`view-nationality-${clientPerson.id}`}>
                {clientPerson.person.nationality ? clientPerson.person.nationality.charAt(0).toUpperCase() + clientPerson.person.nationality.slice(1) : 'Not provided'}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Occupation</label>
              <p className="text-sm mt-1" data-testid={`view-occupation-${clientPerson.id}`}>
                {clientPerson.person.occupation || 'Not provided'}
              </p>
            </div>
            
          </div>
        </div>

        {/* Address Information */}
        <div className="space-y-4">
          <h5 className="font-medium text-sm flex items-center">
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
            Address Information
          </h5>
          
          {(() => {
            const person = clientPerson.person;
            const hasAddress = !!(person.addressLine1 || person.addressLine2 || person.locality || person.region || person.postalCode || person.country);
            
            if (!hasAddress) {
              return (
                <p className="text-sm text-muted-foreground italic p-4 border rounded-lg bg-muted/30">
                  No address information available
                </p>
              );
            }

            // Create address lines while removing duplicates
            const addressParts = [];
            const usedValues = new Set();
            
            // Add address lines if they exist and aren't duplicates
            [person.addressLine1, person.addressLine2].forEach(line => {
              if (line && line.trim() && !usedValues.has(line.trim().toLowerCase())) {
                addressParts.push(line.trim());
                usedValues.add(line.trim().toLowerCase());
              }
            });
            
            // Add locality, region, postal code (avoiding duplicates)
            const locationParts = [person.locality, person.region, person.postalCode]
              .filter(part => part && part.trim() && !usedValues.has(part.trim().toLowerCase()))
              .map(part => part!.trim());
            
            if (locationParts.length > 0) {
              addressParts.push(locationParts.join(", "));
            }
            
            // Add country if not already included
            if (person.country && person.country.trim() && !usedValues.has(person.country.trim().toLowerCase())) {
              addressParts.push(person.country.trim());
            }

            return (
              <div className="p-4 rounded-lg bg-background border">
                <div className="space-y-1 text-sm" data-testid={`text-person-address-${clientPerson.id}`}>
                  {addressParts.map((part, index) => (
                    <div key={index} className={index === 0 ? "font-medium" : ""}>
                      {part}
                    </div>
                  ))}
                </div>
                {person.addressVerified && (
                  <div className="flex items-center space-x-2 mt-3 pt-3 border-t">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Address Verified</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Verification & Sensitive Information */}
        <div className="space-y-4">
          <h5 className="font-medium text-sm flex items-center">
            <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
            Verification & Details
          </h5>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Main Contact</span>
                </div>
                <div className="flex items-center space-x-2">
                  {clientPerson.person.isMainContact ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Yes</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">No</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Photo ID Verified</span>
                </div>
                <div className="flex items-center space-x-2">
                  {clientPerson.person.photoIdVerified ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Verified</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not verified</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Address Verified</span>
                </div>
                <div className="flex items-center space-x-2">
                  {clientPerson.person.addressVerified ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Verified</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not verified</span>
                  )}
                </div>
              </div>
            </div>
            
            {(clientPerson.person.niNumber || clientPerson.person.personalUtrNumber) && (
              <div className="p-4 rounded-lg border border-dashed bg-muted/30">
                <h6 className="text-sm font-medium mb-3">Sensitive Information</h6>
                <div className="space-y-3">
                  {clientPerson.person.niNumber && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">NI Number</label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          data-testid={`button-reveal-ni-${clientPerson.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const key = `ni-${clientPerson.person.id}`;
                            setRevealedIdentifiers(prev => {
                              const next = new Set(prev);
                              if (next.has(key)) {
                                next.delete(key);
                              } else {
                                next.add(key);
                              }
                              return next;
                            });
                          }}
                        >
                          {revealedIdentifiers.has(`ni-${clientPerson.person.id}`) ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      <p className="font-mono text-sm mt-1" data-testid={`text-ni-number-${clientPerson.id}`}>
                        {revealedIdentifiers.has(`ni-${clientPerson.person.id}`) 
                          ? clientPerson.person.niNumber 
                          : maskIdentifier(clientPerson.person.niNumber, 2)}
                      </p>
                    </div>
                  )}
                  {clientPerson.person.personalUtrNumber && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">Personal UTR</label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          data-testid={`button-reveal-utr-${clientPerson.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const key = `utr-${clientPerson.person.id}`;
                            setRevealedIdentifiers(prev => {
                              const next = new Set(prev);
                              if (next.has(key)) {
                                next.delete(key);
                              } else {
                                next.add(key);
                              }
                              return next;
                            });
                          }}
                        >
                          {revealedIdentifiers.has(`utr-${clientPerson.person.id}`) ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      <p className="font-mono text-sm mt-1" data-testid={`text-utr-number-${clientPerson.id}`}>
                        {revealedIdentifiers.has(`utr-${clientPerson.person.id}`) 
                          ? clientPerson.person.personalUtrNumber 
                          : maskIdentifier(clientPerson.person.personalUtrNumber, 2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Extended Contact Information - New 1-column section */}
      <div className="space-y-4 border-t pt-6">
        <h4 className="font-bold text-base flex items-center border-b pb-2 mb-4">
          <Phone className="h-5 w-5 mr-2 text-primary" />
          Contact Information
        </h4>
        
        <div className="grid grid-cols-1 gap-4">
          {/* Primary contact info */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h6 className="text-sm font-medium text-muted-foreground">Primary Contact Details</h6>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Email:</span> {clientPerson.person.email || "Not provided"}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {clientPerson.person.telephone || "Not provided"}
              </div>
            </div>
          </div>

          {/* Secondary contact info */}
          {(clientPerson.person.email2 || clientPerson.person.telephone2) && (
            <div className="space-y-3">
              <h6 className="text-sm font-medium">Additional Contact Details</h6>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secondary Email</label>
                  <p className="text-sm mt-1" data-testid={`view-email2-${clientPerson.id}`}>
                    {clientPerson.person.email2 || 'Not provided'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secondary Phone</label>
                  <p className="text-sm mt-1" data-testid={`view-telephone2-${clientPerson.id}`}>
                    {clientPerson.person.telephone2 || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Social media profiles */}
          <div className="space-y-3">
            <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
            {(clientPerson.person.linkedinUrl || 
              clientPerson.person.twitterUrl || 
              clientPerson.person.facebookUrl || 
              clientPerson.person.instagramUrl || 
              clientPerson.person.tiktokUrl) ? (
              <div className="grid grid-cols-1 gap-3">
                {clientPerson.person.linkedinUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-blue-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">LinkedIn</label>
                      <a 
                        href={clientPerson.person.linkedinUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block"
                        data-testid={`view-linkedinUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.linkedinUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.twitterUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-black dark:text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">Twitter/X</label>
                      <a 
                        href={clientPerson.person.twitterUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-black dark:text-white hover:underline block"
                        data-testid={`view-twitterUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.twitterUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.facebookUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-blue-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">Facebook</label>
                      <a 
                        href={clientPerson.person.facebookUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block"
                        data-testid={`view-facebookUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.facebookUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.instagramUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-pink-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.618 5.367 11.986 11.988 11.986C18.636 23.973 24 18.605 24 11.987 24 5.367 18.636.001 12.017.001zm5.568 16.855c-.778.778-1.697 1.139-2.773 1.139H9.188c-1.076 0-1.995-.361-2.773-1.139S5.276 15.158 5.276 14.082V9.917c0-1.076.361-1.995 1.139-2.773s1.697-1.139 2.773-1.139h5.624c1.076 0 1.995.361 2.773 1.139s1.139 1.697 1.139 2.773v4.165c0 1.076-.361 1.995-1.139 2.773zm-8.195-7.638a3.82 3.82 0 013.821-3.821c2.108 0 3.821 1.713 3.821 3.821s-1.713 3.821-3.821 3.821a3.82 3.82 0 01-3.821-3.821zm6.148-1.528a.905.905 0 11-1.81 0 .905.905 0 011.81 0z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">Instagram</label>
                      <a 
                        href={clientPerson.person.instagramUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-pink-600 hover:underline block"
                        data-testid={`view-instagramUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.instagramUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.tiktokUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-black dark:text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">TikTok</label>
                      <a 
                        href={clientPerson.person.tiktokUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-black dark:text-white hover:underline block"
                        data-testid={`view-tiktokUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.tiktokUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic p-4 border rounded-lg bg-muted/30" data-testid={`text-no-social-links-${clientPerson.id}`}>
                No social media profiles provided
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Personal Services section */}
      {peopleServices && (
        <div className="space-y-4 border-t pt-6">
          <h4 className="font-bold text-base flex items-center border-b pb-2 mb-4">
            <Settings className="h-5 w-5 mr-2 text-primary" />
            Personal Services
          </h4>

          {(() => {
            const personServices = peopleServices.filter(ps => ps.personId === clientPerson.person.id);
            
            if (personServices.length === 0) {
              return (
                <div className="p-4 rounded-lg border border-dashed bg-muted/30 text-center">
                  <p className="text-sm text-muted-foreground italic">
                    No personal services assigned to this person
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {personServices.map((peopleService) => (
                  <div 
                    key={peopleService.id}
                    className="p-4 rounded-lg border bg-background"
                    data-testid={`personal-service-${peopleService.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-sm mb-2">{peopleService.service.name}</h5>
                        {peopleService.service.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {peopleService.service.description}
                          </p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          {peopleService.serviceOwner && (
                            <div className="flex items-center space-x-1">
                              <UserIcon className="h-3 w-3" />
                              <span>Owner: {peopleService.serviceOwner.firstName} {peopleService.serviceOwner.lastName}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>Assigned: {formatDate(peopleService.createdAt)}</span>
                          </div>
                        </div>
                        
                        {peopleService.notes && (
                          <div className="mt-2 p-2 rounded bg-muted/50">
                            <p className="text-xs text-muted-foreground">
                              <strong>Notes:</strong> {peopleService.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button 
          variant="outline" 
          size="sm"
          data-testid={`button-edit-person-${clientPerson.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          Edit Details
        </Button>
      </div>
    </div>
  );
}

// Component for editing person details
function PersonEditForm({ 
  clientPerson, 
  onSave, 
  onCancel, 
  isSaving 
}: {
  clientPerson: ClientPersonWithPerson;
  onSave: (data: UpdatePersonData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const form = useForm<UpdatePersonData>({
    resolver: zodResolver(updatePersonSchema),
    defaultValues: {
      fullName: clientPerson.person.fullName || "",
      title: clientPerson.person.title || "",
      dateOfBirth: clientPerson.person.dateOfBirth || "",
      nationality: clientPerson.person.nationality || "",
      occupation: clientPerson.person.occupation || "",
      telephone: clientPerson.person.telephone || "",
      email: clientPerson.person.email || "",
      addressLine1: clientPerson.person.addressLine1 || "",
      addressLine2: clientPerson.person.addressLine2 || "",
      locality: clientPerson.person.locality || "",
      region: clientPerson.person.region || "",
      postalCode: clientPerson.person.postalCode || "",
      country: clientPerson.person.country || "",
      isMainContact: Boolean(clientPerson.person.isMainContact),
      niNumber: clientPerson.person.niNumber || "",
      personalUtrNumber: clientPerson.person.personalUtrNumber || "",
      photoIdVerified: Boolean(clientPerson.person.photoIdVerified),
      addressVerified: Boolean(clientPerson.person.addressVerified),
      // Extended contact information
      telephone2: clientPerson.person.telephone2 || "",
      email2: clientPerson.person.email2 || "",
      // Social media URLs
      linkedinUrl: clientPerson.person.linkedinUrl || "",
      instagramUrl: clientPerson.person.instagramUrl || "",
      twitterUrl: clientPerson.person.twitterUrl || "",
      facebookUrl: clientPerson.person.facebookUrl || "",
      tiktokUrl: clientPerson.person.tiktokUrl || "",
    },
  });

  const handleSubmit = (data: UpdatePersonData) => {
    onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h5 className="font-medium text-sm flex items-center">
              <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
              Basic Information
            </h5>
            
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid={`input-fullName-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid={`input-title-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} type="date" data-testid={`input-dateOfBirth-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="nationality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nationality</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid={`select-nationality-${clientPerson.id}`}>
                        <SelectValue placeholder="Select nationality" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="british">British</SelectItem>
                      <SelectItem value="american">American</SelectItem>
                      <SelectItem value="canadian">Canadian</SelectItem>
                      <SelectItem value="australian">Australian</SelectItem>
                      <SelectItem value="german">German</SelectItem>
                      <SelectItem value="french">French</SelectItem>
                      <SelectItem value="spanish">Spanish</SelectItem>
                      <SelectItem value="italian">Italian</SelectItem>
                      <SelectItem value="dutch">Dutch</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="occupation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupation</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid={`input-occupation-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h5 className="font-medium text-sm flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
              Address Information
            </h5>
            
            <div className="space-y-3">
              <AddressLookup
                onAddressSelect={(address) => {
                  form.setValue("addressLine1", address.addressLine1);
                  form.setValue("addressLine2", address.addressLine2 || "");
                  form.setValue("locality", address.locality);
                  form.setValue("region", address.region);
                  form.setValue("postalCode", address.postalCode);
                  form.setValue("country", address.country);
                }}
                value={
                  clientPerson.person.addressLine1 ? {
                    addressLine1: clientPerson.person.addressLine1,
                    addressLine2: clientPerson.person.addressLine2 || "",
                    locality: clientPerson.person.locality || "",
                    region: clientPerson.person.region || "",
                    postalCode: clientPerson.person.postalCode || "",
                    country: clientPerson.person.country || ""
                  } : undefined
                }
                data-testid={`input-address-lookup-${clientPerson.id}`}
              />
              
            </div>
          </div>

          {/* Verification & Sensitive Information */}
          <div className="space-y-4">
            <h5 className="font-medium text-sm flex items-center">
              <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
              Verification & Details
            </h5>
            
            <FormField
              control={form.control}
              name="isMainContact"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Main Contact</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      This person is the primary contact
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      data-testid={`switch-isMainContact-${clientPerson.id}`}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="photoIdVerified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      data-testid={`checkbox-photoIdVerified-${clientPerson.id}`}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Photo ID Verified</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Official photo identification has been verified
                    </div>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="addressVerified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      data-testid={`checkbox-addressVerified-${clientPerson.id}`}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Address Verified</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Address has been verified through official documents
                    </div>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="niNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NI Number</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="AB123456C"
                      data-testid={`input-niNumber-${clientPerson.id}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="personalUtrNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal UTR</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="1234567890"
                      data-testid={`input-personalUtrNumber-${clientPerson.id}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Extended Contact Information - New 1-column section */}
        <div className="space-y-4 border-t pt-6">
          <h5 className="font-medium text-sm flex items-center">
            <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
            Contact Information
          </h5>
          
          <div className="grid grid-cols-1 gap-4">
            {/* Primary contact info - read only display for reference */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h6 className="text-sm font-medium text-muted-foreground">Primary Contact Details</h6>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Email:</span> {clientPerson.person.email || "Not provided"}
                </div>
                <div>
                  <span className="font-medium">Phone:</span> {clientPerson.person.telephone || "Not provided"}
                </div>
              </div>
            </div>

            {/* Secondary contact fields */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium">Additional Contact Details</h6>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Email</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email" 
                          placeholder="secondary@example.com"
                          data-testid={`input-email2-${clientPerson.id}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="telephone2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Phone</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="tel" 
                          placeholder="+44 1234 567890"
                          data-testid={`input-telephone2-${clientPerson.id}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Social media fields */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
              
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn Profile</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="https://linkedin.com/in/username"
                          data-testid={`input-linkedinUrl-${clientPerson.id}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="twitterUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter/X Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://x.com/username"
                            data-testid={`input-twitterUrl-${clientPerson.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="facebookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://facebook.com/username"
                            data-testid={`input-facebookUrl-${clientPerson.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="instagramUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://instagram.com/username"
                            data-testid={`input-instagramUrl-${clientPerson.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="tiktokUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TikTok Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://tiktok.com/@username"
                            data-testid={`input-tiktokUrl-${clientPerson.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSaving}
            data-testid={`button-cancel-person-${clientPerson.id}`}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSaving}
            data-testid={`button-save-person-${clientPerson.id}`}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Company Creation Form Component
function CompanyCreationForm({ onSubmit, onCancel, isSubmitting }: {
  onSubmit: (data: { companyName: string; companyNumber?: string; officerRole?: string; isPrimaryContact?: boolean; }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(z.object({
      companyName: z.string().min(1, "Company name is required"),
      companyNumber: z.string().optional(),
      officerRole: z.string().optional(),
      isPrimaryContact: z.boolean().optional().default(false)
    })),
    defaultValues: {
      companyName: "",
      companyNumber: "",
      officerRole: "",
      isPrimaryContact: false
    }
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      companyName: data.companyName,
      companyNumber: data.companyNumber || undefined,
      officerRole: data.officerRole || undefined,
      isPrimaryContact: data.isPrimaryContact || false
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter company name" {...field} data-testid="input-company-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="companyNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter company number (optional)" {...field} data-testid="input-company-number" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="officerRole"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Role</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Director, Secretary (optional)" {...field} data-testid="input-officer-role" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="isPrimaryContact"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Primary Contact</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Mark this person as the main contact for the company
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-primary-contact"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="button-cancel-company-creation"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-submit-company-creation"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 mr-2" />
                Create Company
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [revealedIdentifiers, setRevealedIdentifiers] = useState<Set<string>>(new Set());
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  
  // DEBUG: Tab jumping investigation
  const [activeTab, setActiveTab] = useState<string>("overview");
  const debugMetricsRef = useRef<any[]>([]);

  // DEBUG: Comprehensive tab interaction logging
  useLayoutEffect(() => {
    const logMetrics = (eventType: string, tabValue?: string) => {
      const timestamp = Date.now();
      const metrics = {
        timestamp,
        eventType,
        tabValue,
        scrollY: window.scrollY,
        activeElement: document.activeElement?.tagName + (document.activeElement?.className ? `.${document.activeElement.className}` : ''),
        hash: location.hash,
        tabsList: document.querySelector('[role="tablist"]')?.getBoundingClientRect(),
        activeTabPanel: document.querySelector('[role="tabpanel"][data-state="active"]')?.getBoundingClientRect(),
        windowSize: { width: window.innerWidth, height: window.innerHeight },
        documentSize: { clientHeight: document.documentElement.clientHeight },
        bodyRect: document.body.getBoundingClientRect(),
      };
      
      console.log(`🔍 TAB DEBUG [${eventType}]:`, JSON.stringify(metrics, null, 2));
      debugMetricsRef.current.push(metrics);
      // Keep only last 20 entries to prevent memory issues
      if (debugMetricsRef.current.length > 20) {
        debugMetricsRef.current = debugMetricsRef.current.slice(-20);
      }
    };

    // Log on tab value change
    if (activeTab) {
      logMetrics('TAB_VALUE_CHANGE', activeTab);
      
      // Log again after DOM update
      requestAnimationFrame(() => {
        logMetrics('TAB_VALUE_CHANGE_AFTER_RAF', activeTab);
        setTimeout(() => logMetrics('TAB_VALUE_CHANGE_AFTER_TIMEOUT', activeTab), 0);
      });
    }
  }, [activeTab]);

  // DEBUG: Layout shift observer and global event listeners
  useEffect(() => {
    // Add PerformanceObserver for layout shifts
    let layoutShiftObserver: PerformanceObserver | null = null;
    if ('PerformanceObserver' in window) {
      layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift') {
            console.log(`⚡ LAYOUT SHIFT: value=${(entry as any).value}, hadRecentInput=${(entry as any).hadRecentInput}, activeTab=${activeTab}, scrollY=${window.scrollY}`);
          }
        }
      });
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
    }
    let scrollTimer: NodeJS.Timeout;
    const throttledScrollLog = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        console.log(`📜 SCROLL EVENT: scrollY=${window.scrollY}, activeTab=${activeTab}`);
      }, 50);
    };

    const focusHandler = (e: FocusEvent) => {
      const target = e.target as Element;
      console.log(`🎯 FOCUS EVENT: target=${target?.tagName}.${target?.className || ''}, relatedTarget=${(e.relatedTarget as Element)?.tagName || 'null'}, activeTab=${activeTab}, scrollY=${window.scrollY}`);
    };

    const hashChangeHandler = () => {
      console.log(`🔗 HASH CHANGE: hash=${location.hash}, activeTab=${activeTab}, scrollY=${window.scrollY}`);
    };

    window.addEventListener('scroll', throttledScrollLog, { passive: true });
    document.addEventListener('focusin', focusHandler);
    window.addEventListener('hashchange', hashChangeHandler);

    return () => {
      clearTimeout(scrollTimer);
      window.removeEventListener('scroll', throttledScrollLog);
      document.removeEventListener('focusin', focusHandler);
      window.removeEventListener('hashchange', hashChangeHandler);
      layoutShiftObserver?.disconnect();
    };
  }, [activeTab]);

  // DEBUG: Click event logging on tab triggers
  useEffect(() => {
    const handleTabClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[role="tab"]')) {
        const tabValue = target.getAttribute('data-value') || target.textContent?.toLowerCase().replace(/\s+/g, '') || 'unknown';
        console.log(`🖱️ TAB CLICK: tab=${tabValue}, scrollY=${window.scrollY}, timestamp=${Date.now()}`);
      }
    };

    document.addEventListener('mousedown', handleTabClick);
    return () => document.removeEventListener('mousedown', handleTabClick);
  }, []);

  const { data: client, isLoading, error } = useQuery<Client>({
    queryKey: [`/api/clients/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  // Fetch related people/directors
  const { data: relatedPeople, isLoading: peopleLoading, error: peopleError } = useQuery<ClientPersonWithPerson[]>({
    queryKey: ['/api/clients', id, 'people'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
    retry: 1, // Retry once on failure
  });

  // Fetch client services
  const { data: clientServices, isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useQuery<EnhancedClientService[]>({
    queryKey: [`/api/client-services/client/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
  });

  // Fetch personal services for people related to this client
  const { data: peopleServices, isLoading: peopleServicesLoading, error: peopleServicesError, refetch: refetchPeopleServices } = useQuery<(PeopleService & { person: Person; service: Service; serviceOwner?: User })[]>({
    queryKey: [`/api/people-services/client/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
  });

  // Mutation for updating person data
  const updatePersonMutation = useMutation({
    mutationFn: async ({ personId, data }: { personId: string; data: UpdatePersonData }) => {
      return await apiRequest("PATCH", `/api/people/${personId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'people'] });
      setEditingPersonId(null);
      toast({
        title: "Success",
        description: "Person details updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update person details",
        variant: "destructive",
      });
    },
  });

  // Mutation for creating new person
  const createPersonMutation = useMutation({
    mutationFn: async (data: InsertPersonData) => {
      return await apiRequest("POST", `/api/clients/${id}/people`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'people'] });
      setIsAddPersonModalOpen(false);
      toast({
        title: "Success",
        description: "Person added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add person",
        variant: "destructive",
      });
    },
  });

  // Company Connections functionality for individual clients (many-to-many)
  const [showCompanySelection, setShowCompanySelection] = useState(false);
  const [showCompanyCreation, setShowCompanyCreation] = useState(false);

  // Query to fetch company connections for this person (many-to-many)
  const { data: companyConnections = [], isLoading: connectionsLoading } = useQuery<Array<{
    client: Client;
    officerRole?: string;
    isPrimaryContact?: boolean;
  }>>({
    queryKey: [`/api/people/${id}/companies`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client && client.clientType === 'individual',
  });

  // Query to fetch client services for all connected companies (for individual clients)
  const companyServicesQueries = useQuery<ClientServiceWithService[]>({
    queryKey: ['connected-company-services', (companyConnections ?? []).map(conn => conn.client.id)],
    queryFn: async () => {
      const connectedCompanyIds = (companyConnections ?? []).map(conn => conn.client.id);
      if (client?.clientType !== 'individual' || connectedCompanyIds.length === 0) {
        return [];
      }
      
      // Fetch services for all connected companies
      const servicesPromises = connectedCompanyIds.map(async (companyId) => {
        const response = await fetch(`/api/client-services/client/${companyId}`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch services for company ${companyId}`);
        }
        const services = await response.json();
        return services.map((service: any) => ({ ...service, companyId, companyName: companyConnections.find(conn => conn.client.id === companyId)?.client.name }));
      });
      
      const allServices = await Promise.all(servicesPromises);
      return allServices.flat();
    },
    enabled: !!client && client.clientType === 'individual' && (companyConnections?.length ?? 0) > 0,
  });

  // Query to fetch all company clients for selection
  const { data: companyClients } = useQuery<Client[]>({
    queryKey: ['/api/clients?search='],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: showCompanySelection,
  });

  // Mutation to link person to a company
  const linkToCompanyMutation = useMutation({
    mutationFn: async (data: { companyClientId: string; officerRole?: string; isPrimaryContact?: boolean }) => {
      return await apiRequest("POST", `/api/people/${id}/companies`, {
        clientId: data.companyClientId,
        officerRole: data.officerRole,
        isPrimaryContact: data.isPrimaryContact
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/people/${id}/companies`] });
      setShowCompanySelection(false);
      toast({
        title: "Success",
        description: "Successfully linked to company",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to link to company",
        variant: "destructive",
      });
    },
  });

  // Mutation to unlink person from a company
  const unlinkFromCompanyMutation = useMutation({
    mutationFn: async (companyClientId: string) => {
      return await apiRequest("DELETE", `/api/people/${id}/companies/${companyClientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/people/${id}/companies`] });
      toast({
        title: "Success",
        description: "Successfully removed company connection",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove company connection",
        variant: "destructive",
      });
    },
  });

  // Mutation to convert individual client to company client
  const convertToCompanyMutation = useMutation({
    mutationFn: async (companyData: { 
      companyName: string; 
      companyNumber?: string; 
      officerRole?: string; 
      isPrimaryContact?: boolean;
    }) => {
      return await apiRequest("POST", `/api/people/${id}/convert-to-company-client`, companyData);
    },
    onSuccess: (result: any) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/people/${id}/companies`] });
      setShowCompanyCreation(false);
      toast({
        title: "Success",
        description: `Successfully created company "${result.companyClient.fullName}" and linked to this person`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });

  // Filter company clients (exclude individuals, current client, and already connected companies)
  const connectedCompanyIds = (companyConnections ?? []).map(conn => conn.client.id);
  const availableCompanies = companyClients?.filter(
    c => c.clientType === 'company' && c.id !== id && !connectedCompanyIds.includes(c.id)
  ) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {user && <TopNavigation user={user} />}
        <div className="flex-1">
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-6 py-4">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="container mx-auto p-6">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {user && <TopNavigation user={user} />}
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="text-destructive">Client Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                The client you're looking for could not be found.
              </p>
              <Button 
                onClick={() => window.history.back()}
                data-testid="button-go-back"
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {user && <TopNavigation user={user} />}
      <div className="flex-1">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-client-name">
                {client.name}
              </h1>
              <p className="text-muted-foreground flex items-center mt-1">
                {client.companyNumber && (
                  <>
                    <Building2 className="w-4 h-4 mr-1" />
                    Company #{client.companyNumber}
                  </>
                )}
                {client.dateOfCreation && (
                  <>
                    {client.companyNumber && <span className="mx-2">•</span>}
                    <Calendar className="w-4 h-4 mr-1" />
                    Formed: {new Date(client.dateOfCreation).toLocaleDateString()}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {client.companyStatus && (
                <Badge 
                  variant={client.companyStatus === 'active' ? 'default' : 'secondary'}
                  data-testid="badge-company-status"
                >
                  {client.companyStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Main Content */}
        <div className="container mx-auto p-6">
        <Tabs 
          defaultValue="overview" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects">Open Projects</TabsTrigger>
            <TabsTrigger value="communications" data-testid="tab-communications">Communications</TabsTrigger>
            <TabsTrigger value="chronology" data-testid="tab-chronology">Chronology</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Company Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Company Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  // Create formatted address string for the map
                  const addressParts = [
                    client.registeredAddress1,
                    client.registeredAddress2,
                    client.registeredAddress3,
                    client.registeredPostcode,
                    client.registeredCountry
                  ].filter(Boolean);
                  const fullAddress = addressParts.join(', ');
                  const hasAddress = addressParts.length > 0;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Registered Office Address */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-semibold">Registered Office</h3>
                        </div>
                        
                        {hasAddress ? (
                          <div className="p-4 rounded-lg bg-muted/30 border">
                            <div className="space-y-1" data-testid="text-company-address">
                              {client.registeredAddress1 && <p className="font-medium">{client.registeredAddress1}</p>}
                              {client.registeredAddress2 && <p>{client.registeredAddress2}</p>}
                              {client.registeredAddress3 && <p>{client.registeredAddress3}</p>}
                              {client.registeredPostcode && <p className="font-medium">{client.registeredPostcode}</p>}
                              {client.registeredCountry && <p className="text-muted-foreground">{client.registeredCountry}</p>}
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground italic p-4 border rounded-lg bg-muted/30">
                            No registered address available
                          </p>
                        )}

                        {client.email && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              Company Email
                            </label>
                            <p className="font-medium" data-testid="text-company-email">
                              {client.email}
                            </p>
                          </div>
                        )}

                        {client.companyType && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-4 h-4" />
                              Company Type
                            </label>
                            <p className="font-medium" data-testid="text-company-type">
                              {client.companyType}
                            </p>
                          </div>
                        )}

                        {/* Client Tags */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            Client Tags
                          </label>
                          <TagManager 
                            entityId={client.id} 
                            entityType="client" 
                            className="mt-2"
                          />
                        </div>
                      </div>

                      {/* Google Maps */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-semibold">Location</h3>
                        </div>
                        
                        {hasAddress ? (
                          <AddressMap 
                            address={fullAddress}
                            className="h-[300px]"
                          />
                        ) : (
                          <div className="h-[300px] rounded-lg border bg-muted/30 flex items-center justify-center">
                            <p className="text-muted-foreground">No address available for map display</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {client.companyNumber && (
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`https://find-and-update.company-information.service.gov.uk/company/${client.companyNumber}`, '_blank')}
                      data-testid="button-view-companies-house"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View on Companies House
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Related People Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Related People</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    data-testid="button-add-person"
                    onClick={() => setIsAddPersonModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div data-testid="section-related-people">
                  {peopleLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : peopleError ? (
                    <div className="text-center py-8">
                      <p className="text-destructive mb-2">
                        Failed to load related people
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Please try refreshing the page or contact support if the issue persists.
                      </p>
                    </div>
                  ) : relatedPeople && relatedPeople.length > 0 ? (
                    <div className="bg-background space-y-4">
                      <Accordion
                        type="single"
                        collapsible
                        value={expandedPersonId ?? undefined}
                        onValueChange={(value) => setExpandedPersonId(value ?? null)}
                        className="space-y-4"
                      >
                        {relatedPeople.map((clientPerson) => (
                          <AccordionItem key={clientPerson.person.id} value={clientPerson.person.id} className="border rounded-lg bg-card">
                          <AccordionTrigger 
                            className="text-left hover:no-underline p-4"
                            data-testid={`person-row-${clientPerson.person.id}`}
                          >
                            <div className="flex items-start justify-between w-full mr-4">
                              <div className="flex-1 space-y-3">
                                {/* Header with name and role */}
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-medium text-lg" data-testid={`text-person-name-${clientPerson.person.id}`}>
                                      {formatPersonName(clientPerson.person.fullName)}
                                    </h4>
                                    {clientPerson.officerRole && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {clientPerson.officerRole}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    {clientPerson.isPrimaryContact && (
                                      <Badge variant="default" data-testid={`badge-primary-contact-${clientPerson.person.id}`}>
                                        Primary Contact
                                      </Badge>
                                    )}
                                    
                                    {clientPerson.person.isMainContact && (
                                      <Badge variant="outline" data-testid={`badge-main-contact-${clientPerson.person.id}`}>
                                        Main Contact
                                      </Badge>
                                    )}
                                    
                                    <WouterLink href={`/people/${clientPerson.person.id}`}>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        data-testid={`button-view-person-${clientPerson.person.id}`}
                                        onClick={(e) => e.stopPropagation()} // Prevent accordion toggle
                                      >
                                        <UserIcon className="h-3 w-3 mr-1" />
                                        View Details
                                      </Button>
                                    </WouterLink>
                                  </div>
                                </div>

                                {/* Contact Information - Prominently displayed */}
                                <div className="flex items-center space-x-6">
                                  {clientPerson.person.email && (
                                    <div className="flex items-center space-x-2">
                                      <Mail className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium" data-testid={`text-person-email-preview-${clientPerson.person.id}`}>
                                        {clientPerson.person.email}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {clientPerson.person.telephone && (
                                    <div className="flex items-center space-x-2">
                                      <Phone className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium" data-testid={`text-person-phone-preview-${clientPerson.person.id}`}>
                                        {clientPerson.person.telephone}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {!clientPerson.person.email && !clientPerson.person.telephone && (
                                    <div className="flex items-center space-x-2 text-muted-foreground">
                                      <UserIcon className="h-4 w-4" />
                                      <span className="text-sm italic">No contact info available</span>
                                    </div>
                                  )}
                                  
                                  {clientPerson.person.dateOfBirth && (
                                    <div className="flex items-center space-x-2 text-muted-foreground ml-auto">
                                      <Calendar className="h-4 w-4" />
                                      <div className="text-right">
                                        <div className="text-xs">Date of Birth</div>
                                        <div className="text-sm font-medium" data-testid={`text-dob-${clientPerson.person.id}`}>
                                          {formatBirthDate(clientPerson.person.dateOfBirth)}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          
                          <AccordionContent className="px-4 pb-4 border-t bg-gradient-to-r from-muted/30 to-muted/10 dark:from-muted/40 dark:to-muted/20" data-testid={`section-person-details-${clientPerson.id}`}>
                            {editingPersonId === clientPerson.person.id ? (
                              <PersonEditForm 
                                clientPerson={clientPerson}
                                onSave={(data) => updatePersonMutation.mutate({ personId: clientPerson.person.id, data })}
                                onCancel={() => setEditingPersonId(null)}
                                isSaving={updatePersonMutation.isPending}
                              />
                            ) : (
                              <PersonViewMode 
                                clientPerson={clientPerson}
                                revealedIdentifiers={revealedIdentifiers}
                                setRevealedIdentifiers={setRevealedIdentifiers}
                                onEdit={() => setEditingPersonId(clientPerson.person.id)}
                                peopleServices={peopleServices}
                              />
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                      </Accordion>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No directors or related people found for this client.
                      </p>
                      <p className="text-muted-foreground text-sm mt-2">
                        Directors will be automatically added when creating clients from Companies House data.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Company Connections Section - Only show for individual clients */}
            {client.clientType === 'individual' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Company Connections
                      {companyConnections.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {companyConnections.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        data-testid="button-add-company-connection"
                        onClick={() => setShowCompanySelection(true)}
                        disabled={linkToCompanyMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {linkToCompanyMutation.isPending ? "Connecting..." : "Add Company"}
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        data-testid="button-create-company"
                        onClick={() => setShowCompanyCreation(true)}
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        Create Company
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div data-testid="section-company-connections">
                    {connectionsLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : companyConnections.length > 0 ? (
                      <div className="space-y-3">
                        {companyConnections.map((connection, index) => (
                          <div key={connection.client.id} className="p-4 rounded-lg border bg-card" data-testid={`company-connection-${connection.client.id}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                                  <Building2 className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-lg" data-testid={`text-company-name-${connection.client.id}`}>
                                    {connection.client.name}
                                  </h4>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {connection.officerRole && (
                                      <Badge variant="outline" className="text-xs">
                                        {connection.officerRole}
                                      </Badge>
                                    )}
                                    {connection.isPrimaryContact && (
                                      <Badge variant="secondary" className="text-xs">
                                        Primary Contact
                                      </Badge>
                                    )}
                                    {!connection.officerRole && !connection.isPrimaryContact && "Company connection"}
                                  </div>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                data-testid={`button-remove-company-connection-${connection.client.id}`}
                                onClick={() => unlinkFromCompanyMutation.mutate(connection.client.id)}
                                disabled={unlinkFromCompanyMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground mb-4">
                          No companies connected to this individual client.
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Connect this person to companies they are associated with as directors, shareholders, or contacts.
                        </p>
                        <Button 
                          variant="outline"
                          data-testid="button-add-first-company-connection"
                          onClick={() => setShowCompanySelection(true)}
                          disabled={linkToCompanyMutation.isPending}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {linkToCompanyMutation.isPending ? "Connecting..." : "Add Company Connection"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-6 mt-6">
            {/* Client Services Section - Show for company clients OR individual clients with company connections */}
            {(() => {
              // Handle legacy data where clientType might be null for companies
              const isCompany = client?.clientType === 'company' || 
                                (client?.clientType === null && client?.companyNumber); // Legacy companies have null clientType but have companyNumber
              const isIndividualWithConnections = client?.clientType === 'individual' && (companyConnections?.length ?? 0) > 0;
              
              return (isCompany || isIndividualWithConnections);
            })() && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Client Services</CardTitle>
                    <AddServiceModal 
                      clientId={client.id} 
                      clientType={
                        client.clientType === null && client.companyNumber 
                          ? 'company' 
                          : (client.clientType as 'company' | 'individual' | undefined)
                      } 
                      onSuccess={refetchServices} 
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div data-testid="section-client-services">
                    {(() => {
                      // Simple conditional logic for data source
                      const isIndividualWithConnections = client.clientType === 'individual' && (companyConnections?.length ?? 0) > 0;
                      const displayServices = isIndividualWithConnections ? companyServicesQueries.data : clientServices;
                      const loading = isIndividualWithConnections ? companyServicesQueries.isLoading : servicesLoading;
                      const error = isIndividualWithConnections ? companyServicesQueries.isError : servicesError;
                      
                      if (loading) {
                        return (
                          <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                          </div>
                        );
                      }
                      
                      if (error) {
                        return (
                          <div className="text-center py-8">
                            <p className="text-destructive mb-2">Failed to load services</p>
                            <p className="text-muted-foreground text-sm">Please try refreshing the page or contact support if the issue persists.</p>
                          </div>
                        );
                      }
                      
                      if (displayServices && displayServices.length > 0) {
                        return (
                          <div className="space-y-3">
                            {displayServices.map((clientService) => (
                              <div key={clientService.id} className="p-4 border rounded-lg">
                                <h4 className="font-medium">{clientService.service?.name || 'Service'}</h4>
                                <p className="text-sm text-muted-foreground">{clientService.service?.description || 'No description'}</p>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      
                      return (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4">No client services have been added yet.</p>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Personal Services Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={client.clientType === 'individual' ? '' : 'text-red-500'}>
                    {client.clientType === 'individual' ? 'Services' : 'Personal Services'}
                  </CardTitle>
                  {client.clientType === 'individual' && (
                    <AddServiceModal clientId={client.id} clientType={client.clientType} onSuccess={() => { refetchServices(); refetchPeopleServices(); }} />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div data-testid="section-personal-services">
                  {peopleServicesLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : peopleServicesError ? (
                    <div className="text-center py-8">
                      <p className="text-destructive mb-2">Failed to load personal services</p>
                      <p className="text-muted-foreground text-sm">Please try refreshing the page or contact support if the issue persists.</p>
                    </div>
                  ) : peopleServices && peopleServices.length > 0 ? (
                    <div className="space-y-3">
                      {peopleServices.map((peopleService) => (
                        <div key={peopleService.id} className="p-4 border rounded-lg">
                          <h4 className="font-medium">{peopleService.service?.name || 'Service'}</h4>
                          <p className="text-sm text-muted-foreground">{peopleService.service?.description || 'No description'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No personal services have been added yet.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Open Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Projects management coming soon.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
