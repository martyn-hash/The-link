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
  address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    line2: z.string().optional(),
    city: z.string().min(1, "Town/City is required"),
    county: z.string().optional(),
    postcode: z.string().min(1, "Postcode is required").regex(/^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i, "Invalid UK postcode format"),
    country: z.string().default("United Kingdom"),
  }),
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
  const [step, setStep] = useState<'ch-search' | 'ch-confirm' | 'individual-details'>('ch-search');
  const [selectedCompany, setSelectedCompany] = useState<CompanyProfile | null>(null);
  const [selectedOfficers, setSelectedOfficers] = useState<number[]>([]);

  const isEditing = !!client;

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
      address: {
        line1: "",
        line2: "",
        city: "",
        county: "",
        postcode: "",
        country: "United Kingdom",
      },
    },
  });

  // Reset state when modal opens/closes or client changes
  useEffect(() => {
    if (!client) {
      setClientType('company'); // Default to company mode
      setStep('ch-search'); // Start on CH search for creation
      setSelectedCompany(null);
      setSelectedOfficers([]);
      searchForm.reset();
      individualForm.reset();
    }
  }, [client, searchForm, individualForm, open]);


  // Search for company using Companies House API
  const [searchQuery, setSearchQuery] = useState("");
  const [companySearchResults, setCompanySearchResults] = useState<CompanySearchResult[]>([]);
  
  // Address auto-complete state
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // Debounced address lookup
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (addressQuery.trim().length >= 3) {
        setIsLoadingAddresses(true);
        try {
          const response = await apiRequest("GET", `/api/address-lookup/${encodeURIComponent(addressQuery)}`);
          const data = await response.json();
          setAddressSuggestions(data.suggestions || []);
        } catch (error) {
          console.log("Address lookup failed - user can enter manually");
          setAddressSuggestions([]);
        }
        setIsLoadingAddresses(false);
      } else {
        setAddressSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [addressQuery]);

  // Select address from suggestions and populate form fields
  const selectAddress = (suggestion: any) => {
    // Parse the suggestion address into components
    const addressParts = suggestion.address.split(', ');
    
    // Extract and decode postcode from URL if available
    let postcode = "";
    if (suggestion.url) {
      const urlParts = suggestion.url.split('/');
      const rawPostcode = urlParts[urlParts.length - 1];
      // Decode URL-encoded postcode
      postcode = decodeURIComponent(rawPostcode);
    }
    
    // Populate form fields with parsed address data
    individualForm.setValue("address.line1", addressParts[0] || "");
    individualForm.setValue("address.line2", "");
    individualForm.setValue("address.city", addressParts[1] || "");
    individualForm.setValue("address.county", addressParts[2] || "");
    individualForm.setValue("address.postcode", postcode);
    individualForm.setValue("address.country", "United Kingdom");
    
    // Update the address query field with the selected address
    setAddressQuery(suggestion.address);
    setAddressSuggestions([]);
  };
  
  // Individual client creation mutation
  const createIndividualClientMutation = useMutation({
    mutationFn: async (data: IndividualClientData) => {
      const response = await apiRequest("POST", "/api/clients/individual", data);
      const result = await response.json() as { client: Client; person: any };
      return result;
    },
    onSuccess: (result) => {
      toast({ 
        title: "Success", 
        description: "Individual client created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      onSuccess?.();
      onOpenChange(false);
      
      // Navigate to the client detail page
      setLocation(`/clients/${result.client.id}`);
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
      toast({
        title: "Success",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
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
          
          {/* Address Fields with GetAddress Auto-complete */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-gray-900">Address</h4>
            <p className="text-sm text-gray-600">Start typing your address and select from the suggestions</p>
            
            <FormField
              control={individualForm.control}
              name="address.line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      id="individual-address-line1"
                      placeholder="Start typing your address..."
                      data-testid="input-address-line1"
                      onChange={(e) => {
                        field.onChange(e);
                        setAddressQuery(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  {isLoadingAddresses && (
                    <p className="text-sm text-gray-500">Looking up addresses...</p>
                  )}
                </FormItem>
              )}
            />

            {addressSuggestions.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Select Address:
                </label>
                <div className="space-y-1 max-h-32 overflow-y-auto border rounded-md bg-white shadow-sm">
                  {addressSuggestions.map((address, index) => (
                    <button
                      key={index}
                      type="button"
                      className="w-full text-left p-3 text-sm hover:bg-gray-50 focus:bg-gray-50 first:rounded-t-md last:rounded-b-md border-b last:border-b-0"
                      onClick={() => selectAddress(address)}
                      data-testid={`button-select-address-${index}`}
                    >
                      <div className="font-medium">{address.address}</div>
                      {address.url && (
                        <div className="text-gray-500 text-xs">
                          {address.url}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={individualForm.control}
                name="address.line2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2 (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Apartment, suite, etc."
                        data-testid="input-address-line2"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={individualForm.control}
                  name="address.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Town/City</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Auto-populated"
                          data-testid="input-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={individualForm.control}
                  name="address.county"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>County</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Auto-populated"
                          data-testid="input-county"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={individualForm.control}
                  name="address.postcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Auto-populated"
                          data-testid="input-postcode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={individualForm.control}
                  name="address.country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Auto-populated"
                          data-testid="input-country"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
          
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
                  : "Enter individual client details"
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

      </DialogContent>
    </Dialog>
  );
}