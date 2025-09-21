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
  ArrowRight
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

type CompanySearchData = z.infer<typeof companySearchSchema>;

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
  const [step, setStep] = useState<'ch-search' | 'ch-confirm' | 'services'>('ch-search');
  const [selectedCompany, setSelectedCompany] = useState<CompanyProfile | null>(null);
  const [selectedOfficers, setSelectedOfficers] = useState<number[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, Record<string, string>>>({});
  const [validationErrors, setValidationErrors] = useState<ServiceRoleCompleteness[]>([]);

  const isEditing = !!client;

  // Company search form
  const searchForm = useForm<CompanySearchData>({
    resolver: zodResolver(companySearchSchema),
    defaultValues: {
      companyNumber: "",
    },
  });

  // Reset state when modal opens/closes or client changes
  useEffect(() => {
    if (client) {
      setStep('services'); // Start on services step for editing
    } else {
      setStep('ch-search'); // Start on CH search for creation
      setSelectedCompany(null);
      setSelectedOfficers([]);
      setSelectedServices([]);
      setRoleAssignments({});
      setValidationErrors([]);
      searchForm.reset();
    }
  }, [client, searchForm, open]);

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

  // Search for company using Companies House API
  const [searchQuery, setSearchQuery] = useState("");
  const [companySearchResults, setCompanySearchResults] = useState<CompanySearchResult[]>([]);
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
      toast({
        title: "Success",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      // Close the modal and navigate to client detail view
      onSuccess?.();
      onOpenChange(false);
      
      // Navigate to the client detail page
      setLocation(`/clients/${data.client.id}`);
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

  // For now, we'll show a placeholder for services step since it's complex
  const renderServicesStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Service Assignment</h3>
      </div>
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Service assignment functionality will be implemented in the next phase.
          For now, the client has been created successfully.
        </AlertDescription>
      </Alert>
      <div className="flex justify-end">
        <Button onClick={() => { onSuccess?.(); onOpenChange(false); }} data-testid="button-finish">
          Finish
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Client" : "Create Client from Companies House"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update client details and manage service assignments"
              : step === 'ch-search' 
                ? "Search for a company using Companies House data"
                : step === 'ch-confirm'
                  ? "Confirm company details and select officers"
                  : "Assign services and roles to the client"
            }
          </DialogDescription>
        </DialogHeader>

        {!isEditing && step === 'ch-search' && renderCompanySearchStep()}
        {!isEditing && step === 'ch-confirm' && renderCompanyConfirmStep()}
        {step === 'services' && renderServicesStep()}
      </DialogContent>
    </Dialog>
  );
}