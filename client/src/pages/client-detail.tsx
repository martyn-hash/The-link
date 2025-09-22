import { useParams } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, ExternalLink, Plus, ChevronDown, ChevronUp, Phone, Mail, User, Clock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import TopNavigation from "@/components/top-navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { Client, Person, ClientPerson, Service, ClientService } from "@shared/schema";

type ClientPersonWithPerson = ClientPerson & { person: Person };
type ClientServiceWithService = ClientService & { 
  service: Service & { 
    projectType: { id: string; name: string; description: string | null; serviceId: string | null; active: boolean | null; order: number; createdAt: Date | null } 
  } 
};

// Form schema for adding services
const addServiceSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]),
  nextStartDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  serviceOwnerId: z.string().optional(),
});

type AddServiceData = z.infer<typeof addServiceSchema>;

interface PersonCardProps {
  clientPerson: ClientPersonWithPerson;
  expandedPersonId: string | null;
  onToggleExpand: () => void;
}

interface AddServiceModalProps {
  clientId: string;
  onSuccess: () => void;
}

function AddServiceModal({ clientId, onSuccess }: AddServiceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  // Fetch available services
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['/api/services/active'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Create client service mutation
  const createClientServiceMutation = useMutation({
    mutationFn: (data: AddServiceData) => 
      apiRequest("POST", "/api/client-services", {
        clientId,
        serviceId: data.serviceId,
        frequency: data.frequency,
        nextStartDate: data.nextStartDate && data.nextStartDate.trim() ? new Date(data.nextStartDate).toISOString() : null,
        nextDueDate: data.nextDueDate && data.nextDueDate.trim() ? new Date(data.nextDueDate).toISOString() : null,
        serviceOwnerId: data.serviceOwnerId || null,
      }),
    onSuccess: () => {
      toast({
        title: "Service Added",
        description: "Service has been successfully added to the client.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/client-services/client', clientId] });
      form.reset();
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
    createClientServiceMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-service">
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-frequency">
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nextStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Start Date (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                      data-testid="input-next-start-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nextDueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Due Date (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                      data-testid="input-next-due-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                disabled={createClientServiceMutation.isPending}
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

function PersonCard({ clientPerson, expandedPersonId, onToggleExpand }: PersonCardProps) {
  const isExpanded = expandedPersonId === clientPerson.person.id;
  
  return (
    <div className="relative">
      <div 
        className="cursor-pointer p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
        onClick={onToggleExpand}
        data-testid={`person-${clientPerson.person.id}`}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-medium text-foreground truncate" data-testid={`text-person-name-${clientPerson.person.id}`}>
                  {clientPerson.person.fullName}
                </h4>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {clientPerson.officerRole && (
                  <Badge variant="secondary" className="text-xs" data-testid={`badge-role-${clientPerson.person.id}`}>
                    {clientPerson.officerRole}
                  </Badge>
                )}
                {clientPerson.isPrimaryContact && (
                  <Badge variant="default" className="text-xs" data-testid={`badge-primary-${clientPerson.person.id}`}>
                    Primary Contact
                  </Badge>
                )}
              </div>
              {(clientPerson.person.nationality || clientPerson.person.occupation) && (
                <p className="text-sm text-muted-foreground truncate">
                  {[clientPerson.person.nationality, clientPerson.person.occupation]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-2 p-4 rounded-lg border bg-muted/50 space-y-3">
          {clientPerson.person.addressLine1 && (
            <div className="flex items-start space-x-2">
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                {[
                  clientPerson.person.addressLine1,
                  clientPerson.person.addressLine2,
                  clientPerson.person.locality,
                  clientPerson.person.postalCode
                ].filter(Boolean).join(', ')}
              </div>
            </div>
          )}
          
          {/* Placeholder for phone - extend person schema later */}
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>Phone number not available</span>
          </div>
          
          {/* Placeholder for email - extend person schema later */}
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span>Email not available</span>
          </div>
          
          {clientPerson.person.dateOfBirth && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Born: {new Date(clientPerson.person.dateOfBirth).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  const { data: client, isLoading, error } = useQuery<Client>({
    queryKey: [`/api/clients/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  // Fetch related people/directors
  const { data: relatedPeople, isLoading: peopleLoading, error: peopleError } = useQuery<ClientPersonWithPerson[]>({
    queryKey: [`/api/clients/${id}/people`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
    retry: 1, // Retry once on failure
  });

  // Fetch client services
  const { data: clientServices, isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useQuery<ClientServiceWithService[]>({
    queryKey: [`/api/client-services/client/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {relatedPeople.map((clientPerson) => (
                        <PersonCard 
                          key={clientPerson.id}
                          clientPerson={clientPerson}
                          expandedPersonId={expandedPersonId}
                          onToggleExpand={() => setExpandedPersonId(
                            expandedPersonId === clientPerson.person.id ? null : clientPerson.person.id
                          )}
                        />
                      ))}
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
                      {clientServices.map((clientService) => (
                        <div 
                          key={clientService.id} 
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                          data-testid={`service-row-${clientService.service.id}`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Settings className="h-4 w-4 text-muted-foreground" />
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
                      ))}
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