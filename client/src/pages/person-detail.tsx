import { useParams } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, Plus, X, Phone, Mail, UserIcon, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import TopNavigation from "@/components/top-navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { Person, Client, ClientPerson } from "@shared/schema";

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

// Type for client-person relationship with client details
type ClientPersonWithClient = ClientPerson & { client: Client };

// Form schema for linking to a new company
const linkCompanySchema = z.object({
  clientId: z.string().min(1, "Company is required"),
  officerRole: z.string().optional(),
  isPrimaryContact: z.boolean().optional()
});

type LinkCompanyData = z.infer<typeof linkCompanySchema>;

function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const { toast } = useToast();

  // Form for linking to new company
  const form = useForm<LinkCompanyData>({
    resolver: zodResolver(linkCompanySchema),
    defaultValues: {
      officerRole: "",
      isPrimaryContact: false,
    },
  });

  // Fetch person details
  const { data: person, isLoading: personLoading, error: personError } = useQuery<Person>({
    queryKey: [`/api/people/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(id && isAuthenticated),
  });

  // Fetch all companies this person is connected to
  const { data: personCompanies, isLoading: companiesLoading, error: companiesError } = useQuery<ClientPersonWithClient[]>({
    queryKey: [`/api/people/${id}/companies`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(id && isAuthenticated),
  });

  // Fetch all available companies for linking (only company type clients)
  const { data: availableCompanies, isLoading: availableCompaniesLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(isLinkModalOpen && isAuthenticated),
    select: (clients) => clients?.filter(client => 
      client.clientType === 'company' && 
      !personCompanies?.some(pc => pc.client.id === client.id)
    ) || [],
  });

  // Link person to company mutation
  const linkToCompanyMutation = useMutation({
    mutationFn: async (data: LinkCompanyData) => {
      const response = await apiRequest("POST", `/api/people/${id}/companies`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connection Added",
        description: "Person has been successfully connected to the company.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/people/${id}/companies`] });
      form.reset();
      setIsLinkModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to connect person to company. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Unlink person from company mutation
  const unlinkFromCompanyMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await apiRequest("DELETE", `/api/people/${id}/companies/${clientId}`);
    },
    onSuccess: () => {
      toast({
        title: "Connection Removed",
        description: "Person has been disconnected from the company.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/people/${id}/companies`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove connection. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleLinkCompany = (data: LinkCompanyData) => {
    linkToCompanyMutation.mutate(data);
  };

  // Handle unlinking
  const handleUnlinkCompany = (clientId: string, companyName: string) => {
    if (confirm(`Are you sure you want to remove the connection between ${formatPersonName(person?.fullName || "")} and ${companyName}?`)) {
      unlinkFromCompanyMutation.mutate(clientId);
    }
  };

  if (authLoading || personLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation user={user!} />
        <div className="container mx-auto px-6 py-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h1>
          <p className="text-gray-600">Please log in to view person details.</p>
        </div>
      </div>
    );
  }

  if (personError || !person) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation user={user!} />
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Person Not Found</h1>
            <p className="text-gray-600">The person you're looking for doesn't exist or you don't have permission to view it.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation user={user!} />
      
      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <UserIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="person-name">
                {formatPersonName(person.fullName)}
              </h1>
              {person.title && (
                <p className="text-gray-600">{person.title}</p>
              )}
            </div>
          </div>
          <Button
            onClick={() => setIsLinkModalOpen(true)}
            className="flex items-center gap-2"
            data-testid="button-add-company-connection"
          >
            <Plus className="h-4 w-4" />
            Connect to Company
          </Button>
        </div>

        {/* Person Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Basic Information */}
              <div className="space-y-2">
                <h4 className="font-medium">Basic Information</h4>
                <div className="space-y-1 text-sm">
                  {person.firstName && person.lastName && (
                    <p><span className="text-gray-600">Name:</span> {person.firstName} {person.lastName}</p>
                  )}
                  {person.dateOfBirth && (
                    <p><span className="text-gray-600">Date of Birth:</span> {person.dateOfBirth}</p>
                  )}
                  {person.nationality && (
                    <p><span className="text-gray-600">Nationality:</span> {person.nationality}</p>
                  )}
                  {person.occupation && (
                    <p><span className="text-gray-600">Occupation:</span> {person.occupation}</p>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-2">
                <h4 className="font-medium">Contact Information</h4>
                <div className="space-y-1 text-sm">
                  {person.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-gray-400" />
                      <span>{person.email}</span>
                    </div>
                  )}
                  {person.telephone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-gray-400" />
                      <span>{person.telephone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Address */}
            {(person.addressLine1 || person.locality || person.postalCode) && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </h4>
                <div className="text-sm text-gray-600">
                  <p>
                    {[person.addressLine1, person.addressLine2, person.locality, person.region, person.postalCode, person.country]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Connections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Connections
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLinkModalOpen(true)}
                data-testid="button-add-connection"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="company-connections">
              {companiesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : companiesError ? (
                <div className="text-center py-8">
                  <p className="text-red-600">Failed to load company connections</p>
                </div>
              ) : !personCompanies || personCompanies.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Company Connections</h3>
                  <p className="text-gray-500 mb-4">
                    This person is not connected to any companies yet.
                  </p>
                  <Button onClick={() => setIsLinkModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Connect to Company
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {personCompanies.map((connection) => (
                    <div key={connection.id} className="border rounded-lg p-4 bg-white" data-testid={`company-connection-${connection.client.id}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Building2 className="h-5 w-5 text-blue-600" />
                            <h4 className="font-medium text-gray-900">
                              {connection.client.name}
                            </h4>
                            {connection.officerRole && (
                              <Badge variant="outline">{connection.officerRole}</Badge>
                            )}
                            {connection.isPrimaryContact && (
                              <Badge className="bg-green-100 text-green-800">Primary Contact</Badge>
                            )}
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            {connection.client.companyNumber && (
                              <p><span className="font-medium">Company Number:</span> {connection.client.companyNumber}</p>
                            )}
                            {connection.client.companyStatus && (
                              <p><span className="font-medium">Status:</span> {connection.client.companyStatus}</p>
                            )}
                            {connection.createdAt && (
                              <p><span className="font-medium">Connected:</span> {new Date(connection.createdAt).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnlinkCompany(connection.client.id, connection.client.name)}
                          disabled={unlinkFromCompanyMutation.isPending}
                          data-testid={`button-remove-connection-${connection.client.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Link to Company Modal */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect to Company</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLinkCompany)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-company">
                          <SelectValue placeholder="Select a company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCompaniesLoading ? (
                          <div className="p-2 text-sm text-gray-500">Loading companies...</div>
                        ) : availableCompanies && availableCompanies.length > 0 ? (
                          availableCompanies.map((company) => (
                            <SelectItem key={company.id} value={company.id} data-testid={`company-option-${company.id}`}>
                              {company.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-gray-500">No available companies</div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="officerRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., Director, Secretary" 
                        data-testid="input-officer-role"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPrimaryContact"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-primary-contact"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Primary Contact</FormLabel>
                      <p className="text-sm text-gray-600">
                        Mark this person as the primary contact for the company
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLinkModalOpen(false)}
                  data-testid="button-cancel-link"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={linkToCompanyMutation.isPending}
                  data-testid="button-confirm-link"
                >
                  {linkToCompanyMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PersonDetail;