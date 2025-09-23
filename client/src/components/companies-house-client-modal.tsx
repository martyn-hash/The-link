import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Client, type Service, type WorkRole, type User, type ClientService, type ClientServiceRoleAssignment } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Building2, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  X, 
  Loader2,
  UserCheck,
  UserX,
  Search,
  Building,
  ArrowLeft,
  ArrowRight,
  User as PersonIcon
} from "lucide-react";

// Companies House data types
interface CompanySearchResult {
  company_number: string;
  title: string;
  company_status: string;
  company_type: string;
  address_snippet: string;
  date_of_creation: string;
}

interface CompanySearchResponse {
  items: CompanySearchResult[];
  total_results: number;
  items_per_page: number;
}

interface CompanyProfile {
  company_number: string;
  company_name: string;
  company_status: string;
  company_type: string;
  date_of_creation: string;
  registered_office_address: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  sic_codes?: string[];
}

interface CompanyOfficer {
  name: string;
  officer_role: string;
  date_of_birth?: {
    month: number;
    year: number;
  };
  nationality?: string;
  country_of_residence?: string;
  occupation?: string;
  address: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
}

interface CompanyOfficersResponse {
  officers: CompanyOfficer[];
  total_results: number;
}

// Form schemas
const companySearchSchema = z.object({
  companyNumber: z.string().min(1, "Company number is required").regex(/^[A-Z0-9]{6,8}$/i, "Invalid UK company number format"),
});

const individualClientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email address is required"),
});

type CompanySearchData = z.infer<typeof companySearchSchema>;
type IndividualClientData = z.infer<typeof individualClientSchema>;

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

interface CompaniesHouseClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSuccess?: () => void;
}

export function CompaniesHouseClientModal({
  open,
  onOpenChange,
  client,
  onSuccess,
}: CompaniesHouseClientModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [clientType, setClientType] = useState<'company' | 'individual'>('company');
  const [step, setStep] = useState<'ch-search' | 'ch-confirm' | 'individual-details' | 'services'>('ch-search');
  const [selectedCompany, setSelectedCompany] = useState<CompanyProfile | null>(null);
  const [selectedOfficers, setSelectedOfficers] = useState<number[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, Record<string, string>>>({});
  const [serviceOwnerAssignments, setServiceOwnerAssignments] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ServiceRoleCompleteness[]>([]);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  const isEditing = !!client;
  const effectiveClientId = client?.id || createdClientId;

  // Company search form
  const searchForm = useForm<CompanySearchData>({
    resolver: zodResolver(companySearchSchema),
    defaultValues: {
      companyNumber: "",
    },
  });

  // Individual client form
  const individualForm = useForm<IndividualClientData>({
    resolver: zodResolver(individualClientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
    },
  });

  // Reset state when modal opens/closes or client changes
  useEffect(() => {
    if (client) {
      setStep('services'); // Start on services step for editing
    } else {
      setClientType('company'); // Default to company mode
      setStep('ch-search'); // Start on CH search for creation
      setSelectedCompany(null);
      setSelectedOfficers([]);
      setSelectedServices([]);
      setRoleAssignments({});
      setServiceOwnerAssignments({});
      setValidationErrors([]);
      setCreatedClientId(null);
      searchForm.reset();
      individualForm.reset();
    }
  }, [client, searchForm, individualForm, open]);

  // Fetch services (excluding personal services for client assignment)
  const { data: services, isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services/client-assignable"],
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
    queryKey: ["/api/client-services/client", effectiveClientId],
    enabled: open && !!effectiveClientId,
    retry: false,
  });

  // Fetch service role completeness for existing client
  const { data: roleCompleteness, refetch: refetchCompleteness } = useQuery<ServiceRoleCompletenessResponse>({
    queryKey: ["/api/clients", effectiveClientId, "service-role-completeness"],
    enabled: open && !!effectiveClientId,
    retry: false,
  });

  // Search for company using Companies House API
  const [searchQuery, setSearchQuery] = useState("");
  const [companySearchResults, setCompanySearchResults] = useState<CompanySearchResult[]>([]);
  
  // Individual client creation mutation
  const createIndividualClientMutation = useMutation({
    mutationFn: async (data: IndividualClientData) => {
      const response = await apiRequest("POST", "/api/clients/individual", data);
      const result = await response.json() as { client: Client; person: any };
      return result;
    },
    onSuccess: (result) => {
      setCreatedClientId(result.client.id);
      setStep('services'); // Move to services assignment step
      toast({ 
        title: "Success", 
        description: "Individual client created successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create individual client",
        variant: "destructive",
      });
    },
  });

  const [isSearching, setIsSearching] = useState(false);

  const searchCompanies = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await apiRequest("GET", `/api/companies-house/search?q=${encodeURIComponent(query)}&itemsPerPage=10`);
      const data = await response.json() as CompanySearchResponse;
      setCompanySearchResults(data.items || []);
    } catch (error) {
      console.error("Error searching companies:", error);
      toast({
        title: "Search Error",
        description: "Failed to search companies. Please try again.",
        variant: "destructive",
      });
      setCompanySearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Get company profile and officers
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [companyOfficers, setCompanyOfficers] = useState<CompanyOfficer[]>([]);

  const loadCompanyDetails = async (companyNumber: string) => {
    setIsLoadingCompany(true);
    try {
      // Fetch company profile
      const profileResponse = await apiRequest("GET", `/api/companies-house/company/${companyNumber}`);
      const companyProfile = await profileResponse.json() as CompanyProfile;
      
      // Fetch company officers
      const officersResponse = await apiRequest("GET", `/api/companies-house/company/${companyNumber}/officers`);
      const officersData = await officersResponse.json() as CompanyOfficersResponse;
      
      setSelectedCompany(companyProfile);
      setCompanyOfficers(officersData.officers || []);
      setStep('ch-confirm');
    } catch (error) {
      console.error("Error loading company details:", error);
      toast({
        title: "Load Error",
        description: "Failed to load company details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCompany(false);
    }
  };

  // Create client from Companies House data
  const createClientFromCHMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany) throw new Error("No company selected");
      
      const response = await apiRequest("POST", "/api/clients/from-companies-house", {
        companyNumber: selectedCompany.company_number,
        selectedOfficers,
      });
      
      return await response.json() as { client: Client & { people: any[] }, message: string };
    },
    onSuccess: (data) => {
      setCreatedClientId(data.client.id);
      setStep('services'); // Move to services assignment step
      toast({
        title: "Success",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (error: any) => {
      console.error("Error creating client:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create client from Companies House data",
        variant: "destructive",
      });
    },
  });

  // Handle officer selection
  const toggleOfficerSelection = (index: number) => {
    setSelectedOfficers(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  // Set existing services, role assignments, and validation errors when data loads
  useEffect(() => {
    if (existingClientServices && !selectedServices.length) {
      setSelectedServices(existingClientServices.map(cs => cs.serviceId));
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

  // Search companies when search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchCompanies(searchQuery);
      } else {
        setCompanySearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const renderCompanySearchStep = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Find Company</h3>
        </div>
        <p className="text-sm text-gray-600">
          Search for a company using its company number or name to automatically populate client details.
        </p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            data-testid="input-company-search"
            placeholder="Enter company number (e.g. 13606514) or company name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-sm text-gray-600">Searching companies...</span>
          </div>
        )}

        {companySearchResults.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <h4 className="text-sm font-medium text-gray-700">Search Results</h4>
            {companySearchResults.map((company) => (
              <Card 
                key={company.company_number} 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => loadCompanyDetails(company.company_number)}
                data-testid={`card-company-${company.company_number}`}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium">{company.title}</h5>
                        <Badge variant={company.company_status === 'active' ? 'default' : 'secondary'}>
                          {company.company_status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Company No: {company.company_number}
                      </p>
                      <p className="text-sm text-gray-600">
                        {company.address_snippet}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Incorporated: {new Date(company.date_of_creation).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {searchQuery.trim().length >= 2 && !isSearching && companySearchResults.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No companies found for "{searchQuery}"</p>
            <p className="text-sm">Try a different search term or company number</p>
          </div>
        )}
      </div>

      {isLoadingCompany && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm text-gray-600">Loading company details...</span>
        </div>
      )}
    </div>
  );

  const renderCompanyConfirmStep = () => {
    if (!selectedCompany) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Confirm Company Details</h3>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setStep('ch-search')}
            data-testid="button-back-search"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedCompany.company_name}
            </CardTitle>
            <CardDescription>
              Company No: {selectedCompany.company_number} | Status: {selectedCompany.company_status}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">Registered Address</h4>
              <div className="text-sm text-gray-600">
                {selectedCompany.registered_office_address.address_line_1}<br />
                {selectedCompany.registered_office_address.address_line_2 && (
                  <>{selectedCompany.registered_office_address.address_line_2}<br /></>
                )}
                {selectedCompany.registered_office_address.locality}<br />
                {selectedCompany.registered_office_address.region && (
                  <>{selectedCompany.registered_office_address.region}<br /></>
                )}
                {selectedCompany.registered_office_address.postal_code}<br />
                {selectedCompany.registered_office_address.country}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">Company Type</h4>
              <p className="text-sm text-gray-600">{selectedCompany.company_type}</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">Date of Incorporation</h4>
              <p className="text-sm text-gray-600">
                {new Date(selectedCompany.date_of_creation).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Officers Selection */}
        {companyOfficers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Company Officers
              </CardTitle>
              <CardDescription>
                Select officers to add as related people for this client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {companyOfficers.map((officer, index) => (
                <div 
                  key={index} 
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                  data-testid={`officer-item-${index}`}
                >
                  <Checkbox
                    checked={selectedOfficers.includes(index)}
                    onCheckedChange={() => toggleOfficerSelection(index)}
                    data-testid={`checkbox-officer-${index}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium">{officer.name}</h5>
                      <Badge variant="outline">{officer.officer_role}</Badge>
                    </div>
                    {officer.nationality && (
                      <p className="text-sm text-gray-600">Nationality: {officer.nationality}</p>
                    )}
                    {officer.occupation && (
                      <p className="text-sm text-gray-600">Occupation: {officer.occupation}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => setStep('ch-search')}
            data-testid="button-back-to-search"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
          <Button 
            onClick={() => createClientFromCHMutation.mutate()}
            disabled={createClientFromCHMutation.isPending}
            data-testid="button-create-client"
          >
            {createClientFromCHMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Create Client
          </Button>
        </div>
      </div>
    );
  };

  // Individual client details step
  const renderIndividualDetailsStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PersonIcon className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Individual Client Details</h3>
      </div>
      
      <Form {...individualForm}>
        <form onSubmit={individualForm.handleSubmit((data) => {
          createIndividualClientMutation.mutate(data);
        })} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={individualForm.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter first name"
                      data-testid="input-first-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={individualForm.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter last name"
                      data-testid="input-last-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={individualForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="Enter email address"
                    data-testid="input-email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={createIndividualClientMutation.isPending}
              data-testid="button-create-individual-client"
            >
              {createIndividualClientMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Individual Client
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );

  // Service assignment mutation for created clients
  const assignServicesMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveClientId || selectedServices.length === 0) {
        throw new Error("No client ID or services selected");
      }

      // Create all client-service mappings in parallel
      const clientServicePromises = selectedServices.map(serviceId => {
        const payload: any = {
          clientId: effectiveClientId,
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
      const clientServicesResponse = await apiRequest("GET", `/api/client-services/client/${effectiveClientId}`);
      const clientServices = await clientServicesResponse.json() as (ClientService & { service: ServiceWithDetails })[];
      
      // Create all role assignments in parallel
      const roleAssignmentPromises: Promise<any>[] = [];
      
      for (const clientService of clientServices) {
        if (selectedServices.includes(clientService.serviceId)) {
          // Get service roles from the services data instead of clientService.service
          const service = services?.find(s => s.id === clientService.serviceId);
          if (!service || !service.roles) {
            console.warn(`Service ${clientService.serviceId} not found or has no roles`);
            continue;
          }
          
          for (const role of service.roles) {
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
      
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Services and role assignments completed successfully!",
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-services/client", effectiveClientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", effectiveClientId, "service-role-completeness"] });
      
      onSuccess?.();
      onOpenChange(false);
      
      // Navigate to the client detail page
      if (effectiveClientId) {
        setLocation(`/clients/${effectiveClientId}`);
      }
    },
    onError: (error: any) => {
      console.error("Error assigning services:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign services and roles",
        variant: "destructive",
      });
    },
  });

  // Service handling functions
  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleRoleAssignmentChange = (serviceId: string, roleId: string, userId: string) => {
    setRoleAssignments(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [roleId]: userId,
      }
    }));
  };

  // Validate role completeness
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
            clientServiceId: serviceId,
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

  const renderServicesStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Service Assignment</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Select services to assign to this client and assign users to required roles.
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
                        Service Owner Assignment
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
                          <SelectValue placeholder="Choose service owner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" key="none">No service owner assigned</SelectItem>
                          {users?.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

          {/* Validation errors display */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive" data-testid="alert-validation-errors">
              <AlertTriangle className="w-4 w-4" />
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
                  <p className="text-sm">Please assign users to all required roles before finishing.</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {selectedServices.map((serviceId) => {
            const service = services?.find(s => s.id === serviceId);
            if (!service) return null;

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
      
      <div className="flex justify-end">
        <Button 
          onClick={() => { 
            // If no services selected, just finish without assignments
            if (selectedServices.length === 0) {
              onSuccess?.();
              onOpenChange(false);
              if (effectiveClientId) {
                setLocation(`/clients/${effectiveClientId}`);
              }
              return;
            }

            // Validate role completeness before assigning
            const validation = validateRoleCompleteness();
            if (!validation.isValid) {
              setValidationErrors(validation.errors);
              toast({
                title: "Incomplete Role Assignments",
                description: `${validation.errors.length} service(s) have incomplete role assignments.`,
                variant: "destructive",
              });
              return;
            }
            
            // Assign services and roles
            assignServicesMutation.mutate();
          }} 
          disabled={assignServicesMutation.isPending}
          data-testid="button-finish"
        >
          {assignServicesMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Assigning Services...
            </>
          ) : (
            "Finish"
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Client" : "Create New Client"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update client details and manage service assignments"
              : step === 'ch-search' 
                ? "Search for a company using Companies House data"
                : step === 'ch-confirm'
                  ? "Confirm company details and select officers"
                  : step === 'individual-details'
                    ? "Enter individual client details"
                    : "Assign services and roles to the client"
            }
          </DialogDescription>
        </DialogHeader>

        {!isEditing && (
          <Tabs value={clientType} onValueChange={(value) => {
            setClientType(value as 'company' | 'individual');
            // Reset to appropriate first step based on selection
            if (value === 'company') {
              setStep('ch-search');
            } else {
              setStep('individual-details');
            }
            // Reset any previous state
            setSelectedCompany(null);
            setSelectedOfficers([]);
            searchForm.reset();
            individualForm.reset();
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="company" data-testid="tab-company">
                <Building className="w-4 h-4 mr-2" />
                Company
              </TabsTrigger>
              <TabsTrigger value="individual" data-testid="tab-individual">
                <PersonIcon className="w-4 h-4 mr-2" />
                Individual
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="company" className="mt-6">
              {step === 'ch-search' && renderCompanySearchStep()}
              {step === 'ch-confirm' && renderCompanyConfirmStep()}
            </TabsContent>
            
            <TabsContent value="individual" className="mt-6">
              {step === 'individual-details' && renderIndividualDetailsStep()}
            </TabsContent>
          </Tabs>
        )}

        {step === 'services' && renderServicesStep()}
      </DialogContent>
    </Dialog>
  );
}