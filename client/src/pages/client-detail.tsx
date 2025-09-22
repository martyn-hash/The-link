import { useParams } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, ExternalLink, Plus, ChevronDown, ChevronRight, ChevronUp, Phone, Mail, UserIcon, Clock, Settings, Users, Briefcase } from "lucide-react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { Client, Person, ClientPerson, Service, ClientService, User, WorkRole, ClientServiceRoleAssignment } from "@shared/schema";

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

// Form schema for adding services
const addServiceSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]),
  nextStartDate: z.string().min(1, "Next start date is required"),
  nextDueDate: z.string().min(1, "Next due date is required"),
  serviceOwnerId: z.string().min(1, "Service owner is required"),
});

type AddServiceData = z.infer<typeof addServiceSchema>;

// Validation schema for updating person data
const updatePersonSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  title: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  occupation: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  locality: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  isMainContact: z.boolean().optional(),
  niNumber: z.string().regex(/^[A-Z]{2}[0-9]{6}[A-Z]$/, "Invalid NI Number format (e.g., AB123456C)").optional().or(z.literal("")),
  personalUtrNumber: z.string().regex(/^[0-9]{10}$/, "UTR must be 10 digits").optional().or(z.literal("")),
  photoIdVerified: z.boolean().optional(),
  addressVerified: z.boolean().optional(),
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
  onSuccess: () => void;
}

function AddServiceModal({ clientId, onSuccess }: AddServiceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
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

  // Fetch available services with roles
  const { data: services, isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ['/api/services'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });

  // Fetch users for role assignments and service owner selection
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });

  // Service selection change handler with Companies House auto-population
  const handleServiceChange = (serviceId: string) => {
    const service = services?.find(s => s.id === serviceId);
    if (!service) return;
    
    setSelectedService(service);
    
    // Reset role assignments when service changes
    setRoleAssignments({});
    
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
  
  // Check if service has roles that need assignment
  const hasRolesToAssign = () => {
    return selectedService?.roles && selectedService.roles.length > 0;
  };

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
      if (selectedService?.roles && Object.keys(roleAssignments).length > 0) {
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
    // Validate role assignments before submission
    if (!areAllRolesAssigned()) {
      toast({
        title: "Incomplete Role Assignments",
        description: "Please assign users to all required roles before saving.",
        variant: "destructive",
      });
      return;
    }
    
    createClientServiceMutation.mutate(data);
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
                      {hasRolesToAssign() && !areAllRolesAssigned() && (
                        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Please assign users to all roles before saving the service.
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
                disabled={createClientServiceMutation.isPending || !areAllRolesAssigned()}
                data-testid="button-save-service"
              >
                {createClientServiceMutation.isPending ? "Adding..." : "Add Service"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// PersonCard component removed - using Accordion pattern

// Component for viewing person details (read-only mode)
function PersonViewMode({ 
  clientPerson, 
  revealedIdentifiers, 
  setRevealedIdentifiers, 
  onEdit 
}: {
  clientPerson: ClientPersonWithPerson;
  revealedIdentifiers: Set<string>;
  setRevealedIdentifiers: (fn: (prev: Set<string>) => Set<string>) => void;
  onEdit: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
      {/* Contact Information Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          <h5 className="font-medium text-sm">Contact Information</h5>
        </div>
        <div className="space-y-2">
          {clientPerson.person.email && (
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-background border shadow-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-sm" data-testid={`text-person-email-${clientPerson.id}`}>
                  {clientPerson.person.email}
                </p>
              </div>
            </div>
          )}
          {clientPerson.person.telephone && (
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-background border shadow-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium text-sm" data-testid={`text-person-phone-${clientPerson.id}`}>
                  {clientPerson.person.telephone}
                </p>
              </div>
            </div>
          )}
          {!clientPerson.person.email && !clientPerson.person.telephone && (
            <p className="text-sm text-muted-foreground italic">No contact information available</p>
          )}
        </div>
      </div>
      
      {/* Address Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h5 className="font-medium text-sm">Address</h5>
        </div>
        {clientPerson.person.addressLine1 ? (
          <div className="p-3 rounded-lg bg-background border shadow-sm">
            <div className="space-y-1 text-sm">
              <div>{clientPerson.person.addressLine1}</div>
              {clientPerson.person.addressLine2 && <div>{clientPerson.person.addressLine2}</div>}
              <div>
                {[clientPerson.person.locality, clientPerson.person.region, clientPerson.person.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </div>
              {clientPerson.person.country && <div>{clientPerson.person.country}</div>}
            </div>
            {clientPerson.person.addressVerified && (
              <div className="flex items-center space-x-1 mt-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs text-green-600 font-medium">Address Verified</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No address information available</p>
        )}
      </div>
      
      {/* Verification & Details Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h5 className="font-medium text-sm">Verification & Details</h5>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                clientPerson.person.photoIdVerified ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className={clientPerson.person.photoIdVerified ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                Photo ID
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                clientPerson.person.addressVerified ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className={clientPerson.person.addressVerified ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                Address
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                clientPerson.person.isMainContact ? 'bg-blue-500' : 'bg-gray-300'
              }`}></div>
              <span className={clientPerson.person.isMainContact ? 'text-blue-600 font-medium' : 'text-muted-foreground'}>
                Main Contact
              </span>
            </div>
          </div>
          
          {(clientPerson.person.niNumber || clientPerson.person.personalUtrNumber) && (
            <div className="mt-3 p-3 rounded-lg bg-background border border-dashed">
              <div className="space-y-2 text-xs">
                {clientPerson.person.niNumber && (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground">NI Number: </span>
                      <span className="font-mono" data-testid={`text-ni-number-${clientPerson.id}`}>
                        {revealedIdentifiers.has(`ni-${clientPerson.person.id}`) 
                          ? clientPerson.person.niNumber 
                          : maskIdentifier(clientPerson.person.niNumber, 2)}
                      </span>
                    </div>
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
                )}
                {clientPerson.person.personalUtrNumber && (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground">UTR: </span>
                      <span className="font-mono" data-testid={`text-utr-number-${clientPerson.id}`}>
                        {revealedIdentifiers.has(`utr-${clientPerson.person.id}`) 
                          ? clientPerson.person.personalUtrNumber 
                          : maskIdentifier(clientPerson.person.personalUtrNumber, 2)}
                      </span>
                    </div>
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
                )}
              </div>
            </div>
          )}
          
          <div className="mt-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
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
      isMainContact: clientPerson.person.isMainContact || false,
      niNumber: clientPerson.person.niNumber || "",
      personalUtrNumber: clientPerson.person.personalUtrNumber || "",
      photoIdVerified: clientPerson.person.photoIdVerified || false,
      addressVerified: clientPerson.person.addressVerified || false,
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
                    <Input {...field} data-testid={`input-title-${clientPerson.id}`} />
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
                    <Input {...field} type="date" data-testid={`input-dateOfBirth-${clientPerson.id}`} />
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
                    <Input {...field} data-testid={`input-occupation-${clientPerson.id}`} />
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
                    <Input {...field} data-testid={`input-telephone-${clientPerson.id}`} />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" data-testid={`input-email-${clientPerson.id}`} />
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
            
            <AddressLookup
              onAddressSelected={(address) => {
                form.setValue("addressLine1", address.line1);
                form.setValue("addressLine2", address.line2 || "");
                form.setValue("locality", address.city);
                form.setValue("region", address.county || address.region || "");
                form.setValue("postalCode", address.postcode);
                form.setValue("country", address.country);
              }}
            />
            
            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid={`input-addressLine1-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid={`input-addressLine2-${clientPerson.id}`} />
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
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid={`input-locality-${clientPerson.id}`} />
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
                    <Input {...field} data-testid={`input-region-${clientPerson.id}`} />
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
                    <Input {...field} data-testid={`input-postalCode-${clientPerson.id}`} />
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
                    <Input {...field} data-testid={`input-country-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      checked={field.value}
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
                      checked={field.value}
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
                      checked={field.value}
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

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [revealedIdentifiers, setRevealedIdentifiers] = useState<Set<string>>(new Set());
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);

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
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects">Open Projects</TabsTrigger>
            <TabsTrigger value="communications" data-testid="tab-communications">Communications</TabsTrigger>
            <TabsTrigger value="chronology" data-testid="tab-chronology">Chronology</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Company Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Company Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Basic Information */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                      <p className="font-medium" data-testid="text-company-name">
                        {client.companiesHouseName || client.name}
                      </p>
                    </div>
                    
                    {client.companyNumber && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Company Number</label>
                        <p className="font-medium" data-testid="text-company-number">
                          {client.companyNumber}
                        </p>
                      </div>
                    )}
                    
                    {client.companyType && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Company Type</label>
                        <p className="font-medium" data-testid="text-company-type">
                          {client.companyType}
                        </p>
                      </div>
                    )}
                    
                    {client.dateOfCreation && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Date of Creation</label>
                        <p className="font-medium flex items-center gap-1" data-testid="text-date-creation">
                          <Calendar className="w-4 h-4" />
                          {new Date(client.dateOfCreation).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Address Information */}
                  <div className="space-y-3">
                    {(client.registeredAddress1 || client.registeredPostcode) && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Registered Address
                        </label>
                        <div className="space-y-1" data-testid="text-company-address">
                          {client.registeredAddress1 && <p>{client.registeredAddress1}</p>}
                          {client.registeredAddress2 && <p>{client.registeredAddress2}</p>}
                          {client.registeredAddress3 && <p>{client.registeredAddress3}</p>}
                          {client.registeredPostcode && <p>{client.registeredPostcode}</p>}
                          {client.registeredCountry && <p>{client.registeredCountry}</p>}
                        </div>
                      </div>
                    )}

                    {client.email && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <p className="font-medium" data-testid="text-company-email">
                          {client.email}
                        </p>
                      </div>
                    )}

                  </div>
                </div>

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
                    onClick={() => {
                      // TODO: Implement add person modal/form
                      alert('Add person functionality coming soon!');
                    }}
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
                    <Accordion
                      type="single"
                      collapsible
                      value={expandedPersonId ?? undefined}
                      onValueChange={(value) => setExpandedPersonId(value ?? null)}
                    >
                      {relatedPeople.map((clientPerson) => (
                        <AccordionItem key={clientPerson.person.id} value={clientPerson.person.id}>
                          <AccordionTrigger 
                            className="text-left hover:no-underline p-4"
                            data-testid={`person-row-${clientPerson.person.id}`}
                          >
                            <div className="flex items-center justify-between w-full mr-4">
                              <div className="flex items-center space-x-4">
                                <div>
                                  <h4 className="font-medium" data-testid={`text-person-name-${clientPerson.person.id}`}>
                                    {clientPerson.person.fullName}
                                  </h4>
                                  <div className="flex items-center space-x-2 mt-1">
                                    {clientPerson.officerRole && (
                                      <p className="text-sm text-muted-foreground">
                                        {clientPerson.officerRole}
                                      </p>
                                    )}
                                    {clientPerson.person.nationality && clientPerson.person.occupation && (
                                      <p className="text-sm text-muted-foreground">
                                        • {clientPerson.person.nationality.charAt(0).toUpperCase() + clientPerson.person.nationality.slice(1).replace('_', ' ')} • {clientPerson.person.occupation}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-3 text-sm">
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
                                
                                {clientPerson.person.dateOfBirth && (
                                  <div className="text-muted-foreground">
                                    <span className="text-xs block">Date of Birth:</span>
                                    <span data-testid={`text-dob-${clientPerson.person.id}`}>
                                      {new Date(clientPerson.person.dateOfBirth).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
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
                              />
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
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
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Services</CardTitle>
                  <AddServiceModal clientId={client.id} onSuccess={refetchServices} />
                </div>
              </CardHeader>
              <CardContent>
                <div data-testid="section-client-services">
                  {servicesLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : servicesError ? (
                    <div className="text-center py-8">
                      <p className="text-destructive mb-2">
                        Failed to load services
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Please try refreshing the page or contact support if the issue persists.
                      </p>
                    </div>
                  ) : clientServices && clientServices.length > 0 ? (
                    <div className="space-y-3">
                      {clientServices.map((clientService) => {
                        const isExpanded = expandedServiceId === clientService.id;
                        return (
                          <Collapsible key={clientService.id} open={isExpanded} onOpenChange={() => 
                            setExpandedServiceId(isExpanded ? null : clientService.id)
                          }>
                            <div className="rounded-lg border bg-card transition-all duration-200 hover:shadow-md">
                              <CollapsibleTrigger asChild>
                                <div 
                                  className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer w-full"
                                  data-testid={`service-row-${clientService.service.id}`}
                                  role="button"
                                  aria-expanded={isExpanded}
                                  data-accordion-trigger={`button-toggle-service-${clientService.id}`}
                                >
                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                      <ChevronRight 
                                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 motion-safe:transition-all ${
                                          isExpanded ? 'rotate-90' : ''
                                        }`}
                                      />
                                      <div>
                                        <h4 className="font-medium" data-testid={`text-service-name-${clientService.service.id}`}>
                                          {clientService.service.name}
                                        </h4>
                                        {clientService.service.description && (
                                          <p className="text-sm text-muted-foreground">
                                            {clientService.service.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-6 text-sm">
                                    <div className="flex items-center space-x-1">
                                      <Clock className="h-4 w-4 text-muted-foreground" />
                                      <Badge variant="secondary" data-testid={`badge-frequency-${clientService.service.id}`}>
                                        {clientService.frequency.charAt(0).toUpperCase() + clientService.frequency.slice(1)}
                                      </Badge>
                                    </div>
                                    
                                    {clientService.nextStartDate && (
                                      <div className="text-muted-foreground">
                                        <span className="text-xs block">Next Start:</span>
                                        <span data-testid={`text-next-start-${clientService.service.id}`}>
                                          {new Date(clientService.nextStartDate).toLocaleDateString()}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {clientService.nextDueDate && (
                                      <div className="text-muted-foreground">
                                        <span className="text-xs block">Next Due:</span>
                                        <span data-testid={`text-next-due-${clientService.service.id}`}>
                                          {new Date(clientService.nextDueDate).toLocaleDateString()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              
                              <CollapsibleContent className="overflow-hidden motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=closed]:slide-up-1 motion-safe:data-[state=open]:slide-down-1">
                                <div className="px-4 pb-4 border-t bg-gradient-to-r from-muted/30 to-muted/10 dark:from-muted/40 dark:to-muted/20" data-testid={`section-service-details-${clientService.id}`}>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                                    {/* Service Owner Section */}
                                    <div className="space-y-3">
                                      <div className="flex items-center space-x-2">
                                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                                        <h5 className="font-medium text-sm">Service Owner</h5>
                                      </div>
                                      {clientService.serviceOwner ? (
                                        <div className="flex items-center space-x-3 p-3 rounded-lg bg-background border shadow-sm hover:shadow-md transition-shadow duration-200">
                                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                                            <UserIcon className="h-4 w-4 text-primary" />
                                          </div>
                                          <div>
                                            <p className="font-medium text-sm" data-testid={`text-service-owner-${clientService.id}`}>
                                              {clientService.serviceOwner.firstName} {clientService.serviceOwner.lastName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{clientService.serviceOwner.email}</p>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground italic">No service owner assigned</p>
                                      )}
                                    </div>
                                    
                                    {/* Role Assignments Section */}
                                    <div className="space-y-3">
                                      <div className="flex items-center space-x-2">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <h5 className="font-medium text-sm">Role Assignments</h5>
                                      </div>
                                      {clientService.roleAssignments && clientService.roleAssignments.length > 0 ? (
                                        <div className="space-y-2">
                                          {clientService.roleAssignments.map((assignment) => (
                                            <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg bg-background border shadow-sm hover:shadow-md transition-all duration-200 hover:border-primary/20">
                                              <div className="flex items-center space-x-3">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-secondary/30 to-secondary/10 flex items-center justify-center">
                                                  <UserIcon className="h-3 w-3 text-secondary-foreground" />
                                                </div>
                                                <div>
                                                  <p className="font-medium text-sm">{assignment.workRole.name}</p>
                                                  <p className="text-xs text-muted-foreground">{assignment.user.firstName} {assignment.user.lastName}</p>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground italic">No role assignments</p>
                                      )}
                                    </div>
                                    
                                    {/* Projects Section (Placeholder) */}
                                    <div className="space-y-3">
                                      <div className="flex items-center space-x-2">
                                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                                        <h5 className="font-medium text-sm">Projects</h5>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="p-4 rounded-lg bg-gradient-to-br from-background to-muted/20 border border-dashed border-muted/50 hover:border-muted transition-colors duration-200">
                                          <div className="flex items-center justify-center space-x-2 mb-2">
                                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground text-center font-medium">
                                              Project details coming soon
                                            </p>
                                          </div>
                                          <div className="flex justify-center space-x-4 text-xs">
                                            <div className="flex items-center space-x-1">
                                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                              <span className="text-blue-600 font-medium">2 Open</span>
                                            </div>
                                            <span className="text-muted-foreground">•</span>
                                            <div className="flex items-center space-x-1">
                                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                              <span className="text-green-600 font-medium">5 Completed</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        No services have been added to this client yet.
                      </p>
                      <AddServiceModal clientId={client.id} onSuccess={refetchServices} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Open Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Open projects will be displayed here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Communications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Communication history will be shown here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chronology" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Chronology</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Timeline of events will be displayed here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Client documents will be managed here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Task management will be available here.
                  </p>
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