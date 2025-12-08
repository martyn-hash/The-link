import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import AddressLookup from "@/components/address-lookup";
import { 
  Building2, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Loader2,
  Search,
  Building,
  ArrowLeft,
  ArrowRight,
  User as PersonIcon,
  Phone,
  MapPin,
  ShieldCheck,
  Check,
  Circle,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  Mail
} from "lucide-react";

// Fixed list of titles
const TITLES = [
  { value: "Mr", label: "Mr" },
  { value: "Mrs", label: "Mrs" },
  { value: "Ms", label: "Ms" },
  { value: "Miss", label: "Miss" },
  { value: "Dr", label: "Dr" },
  { value: "Prof", label: "Prof" },
  { value: "Rev", label: "Rev" },
  { value: "Sir", label: "Sir" },
  { value: "Dame", label: "Dame" },
  { value: "Lord", label: "Lord" },
  { value: "Lady", label: "Lady" },
  { value: "Mx", label: "Mx" },
];

// Fixed list of occupations
const OCCUPATIONS = [
  { value: "Director", label: "Director" },
  { value: "Manager", label: "Manager" },
  { value: "Advisor", label: "Advisor" },
  { value: "Consultant", label: "Consultant" },
  { value: "Employee", label: "Employee" },
  { value: "Contractor", label: "Contractor" },
  { value: "Supplier", label: "Supplier" },
  { value: "Family Member", label: "Family Member" },
  { value: "Billing Contact", label: "Billing Contact" },
  { value: "Decision Maker", label: "Decision Maker" },
  { value: "Technical Contact", label: "Technical Contact" },
  { value: "Legal Representative", label: "Legal Representative" },
  { value: "Accountant / Bookkeeper", label: "Accountant / Bookkeeper" },
  { value: "Auditor", label: "Auditor" },
  { value: "Trustee", label: "Trustee" },
  { value: "Beneficiary", label: "Beneficiary" },
  { value: "Other", label: "Other" },
];

const NATIONALITIES = [
  { value: "afghan", label: "Afghan" },
  { value: "albanian", label: "Albanian" },
  { value: "algerian", label: "Algerian" },
  { value: "american", label: "American" },
  { value: "andorran", label: "Andorran" },
  { value: "angolan", label: "Angolan" },
  { value: "antiguans", label: "Antiguans" },
  { value: "argentinean", label: "Argentinean" },
  { value: "armenian", label: "Armenian" },
  { value: "australian", label: "Australian" },
  { value: "austrian", label: "Austrian" },
  { value: "azerbaijani", label: "Azerbaijani" },
  { value: "bahamian", label: "Bahamian" },
  { value: "bahraini", label: "Bahraini" },
  { value: "bangladeshi", label: "Bangladeshi" },
  { value: "barbadian", label: "Barbadian" },
  { value: "barbudans", label: "Barbudans" },
  { value: "batswana", label: "Batswana" },
  { value: "belarusian", label: "Belarusian" },
  { value: "belgian", label: "Belgian" },
  { value: "belizean", label: "Belizean" },
  { value: "beninese", label: "Beninese" },
  { value: "bhutanese", label: "Bhutanese" },
  { value: "bolivian", label: "Bolivian" },
  { value: "bosnian", label: "Bosnian" },
  { value: "brazilian", label: "Brazilian" },
  { value: "british", label: "British" },
  { value: "bruneian", label: "Bruneian" },
  { value: "bulgarian", label: "Bulgarian" },
  { value: "burkinabe", label: "Burkinabe" },
  { value: "burmese", label: "Burmese" },
  { value: "burundian", label: "Burundian" },
  { value: "cambodian", label: "Cambodian" },
  { value: "cameroonian", label: "Cameroonian" },
  { value: "canadian", label: "Canadian" },
  { value: "cape_verdean", label: "Cape Verdean" },
  { value: "central_african", label: "Central African" },
  { value: "chadian", label: "Chadian" },
  { value: "chilean", label: "Chilean" },
  { value: "chinese", label: "Chinese" },
  { value: "colombian", label: "Colombian" },
  { value: "comoran", label: "Comoran" },
  { value: "congolese", label: "Congolese" },
  { value: "costa_rican", label: "Costa Rican" },
  { value: "croatian", label: "Croatian" },
  { value: "cuban", label: "Cuban" },
  { value: "cypriot", label: "Cypriot" },
  { value: "czech", label: "Czech" },
  { value: "danish", label: "Danish" },
  { value: "djibouti", label: "Djibouti" },
  { value: "dominican", label: "Dominican" },
  { value: "dutch", label: "Dutch" },
  { value: "east_timorese", label: "East Timorese" },
  { value: "ecuadorean", label: "Ecuadorean" },
  { value: "egyptian", label: "Egyptian" },
  { value: "emirian", label: "Emirian" },
  { value: "equatorial_guinean", label: "Equatorial Guinean" },
  { value: "eritrean", label: "Eritrean" },
  { value: "estonian", label: "Estonian" },
  { value: "ethiopian", label: "Ethiopian" },
  { value: "fijian", label: "Fijian" },
  { value: "filipino", label: "Filipino" },
  { value: "finnish", label: "Finnish" },
  { value: "french", label: "French" },
  { value: "gabonese", label: "Gabonese" },
  { value: "gambian", label: "Gambian" },
  { value: "georgian", label: "Georgian" },
  { value: "german", label: "German" },
  { value: "ghanaian", label: "Ghanaian" },
  { value: "greek", label: "Greek" },
  { value: "grenadian", label: "Grenadian" },
  { value: "guatemalan", label: "Guatemalan" },
  { value: "guinea_bissauan", label: "Guinea-Bissauan" },
  { value: "guinean", label: "Guinean" },
  { value: "guyanese", label: "Guyanese" },
  { value: "haitian", label: "Haitian" },
  { value: "herzegovinian", label: "Herzegovinian" },
  { value: "honduran", label: "Honduran" },
  { value: "hungarian", label: "Hungarian" },
  { value: "icelander", label: "Icelander" },
  { value: "indian", label: "Indian" },
  { value: "indonesian", label: "Indonesian" },
  { value: "iranian", label: "Iranian" },
  { value: "iraqi", label: "Iraqi" },
  { value: "irish", label: "Irish" },
  { value: "israeli", label: "Israeli" },
  { value: "italian", label: "Italian" },
  { value: "ivorian", label: "Ivorian" },
  { value: "jamaican", label: "Jamaican" },
  { value: "japanese", label: "Japanese" },
  { value: "jordanian", label: "Jordanian" },
  { value: "kazakhstani", label: "Kazakhstani" },
  { value: "kenyan", label: "Kenyan" },
  { value: "kittian_and_nevisian", label: "Kittian and Nevisian" },
  { value: "kuwaiti", label: "Kuwaiti" },
  { value: "kyrgyz", label: "Kyrgyz" },
  { value: "laotian", label: "Laotian" },
  { value: "latvian", label: "Latvian" },
  { value: "lebanese", label: "Lebanese" },
  { value: "liberian", label: "Liberian" },
  { value: "libyan", label: "Libyan" },
  { value: "liechtensteiner", label: "Liechtensteiner" },
  { value: "lithuanian", label: "Lithuanian" },
  { value: "luxembourger", label: "Luxembourger" },
  { value: "macedonian", label: "Macedonian" },
  { value: "malagasy", label: "Malagasy" },
  { value: "malawian", label: "Malawian" },
  { value: "malaysian", label: "Malaysian" },
  { value: "maldivan", label: "Maldivan" },
  { value: "malian", label: "Malian" },
  { value: "maltese", label: "Maltese" },
  { value: "marshallese", label: "Marshallese" },
  { value: "mauritanian", label: "Mauritanian" },
  { value: "mauritian", label: "Mauritian" },
  { value: "mexican", label: "Mexican" },
  { value: "micronesian", label: "Micronesian" },
  { value: "moldovan", label: "Moldovan" },
  { value: "monacan", label: "Monacan" },
  { value: "mongolian", label: "Mongolian" },
  { value: "moroccan", label: "Moroccan" },
  { value: "mosotho", label: "Mosotho" },
  { value: "motswana", label: "Motswana" },
  { value: "mozambican", label: "Mozambican" },
  { value: "namibian", label: "Namibian" },
  { value: "nauruan", label: "Nauruan" },
  { value: "nepalese", label: "Nepalese" },
  { value: "new_zealander", label: "New Zealander" },
  { value: "ni_vanuatu", label: "Ni-Vanuatu" },
  { value: "nicaraguan", label: "Nicaraguan" },
  { value: "nigerien", label: "Nigerien" },
  { value: "north_korean", label: "North Korean" },
  { value: "northern_irish", label: "Northern Irish" },
  { value: "norwegian", label: "Norwegian" },
  { value: "omani", label: "Omani" },
  { value: "pakistani", label: "Pakistani" },
  { value: "palauan", label: "Palauan" },
  { value: "panamanian", label: "Panamanian" },
  { value: "papua_new_guinean", label: "Papua New Guinean" },
  { value: "paraguayan", label: "Paraguayan" },
  { value: "peruvian", label: "Peruvian" },
  { value: "polish", label: "Polish" },
  { value: "portuguese", label: "Portuguese" },
  { value: "qatari", label: "Qatari" },
  { value: "romanian", label: "Romanian" },
  { value: "russian", label: "Russian" },
  { value: "rwandan", label: "Rwandan" },
  { value: "saint_lucian", label: "Saint Lucian" },
  { value: "salvadoran", label: "Salvadoran" },
  { value: "samoan", label: "Samoan" },
  { value: "san_marinese", label: "San Marinese" },
  { value: "sao_tomean", label: "Sao Tomean" },
  { value: "saudi", label: "Saudi" },
  { value: "scottish", label: "Scottish" },
  { value: "senegalese", label: "Senegalese" },
  { value: "serbian", label: "Serbian" },
  { value: "seychellois", label: "Seychellois" },
  { value: "sierra_leonean", label: "Sierra Leonean" },
  { value: "singaporean", label: "Singaporean" },
  { value: "slovakian", label: "Slovakian" },
  { value: "slovenian", label: "Slovenian" },
  { value: "solomon_islander", label: "Solomon Islander" },
  { value: "somali", label: "Somali" },
  { value: "south_african", label: "South African" },
  { value: "south_korean", label: "South Korean" },
  { value: "spanish", label: "Spanish" },
  { value: "sri_lankan", label: "Sri Lankan" },
  { value: "sudanese", label: "Sudanese" },
  { value: "surinamer", label: "Surinamer" },
  { value: "swazi", label: "Swazi" },
  { value: "swedish", label: "Swedish" },
  { value: "swiss", label: "Swiss" },
  { value: "syrian", label: "Syrian" },
  { value: "taiwanese", label: "Taiwanese" },
  { value: "tajik", label: "Tajik" },
  { value: "tanzanian", label: "Tanzanian" },
  { value: "thai", label: "Thai" },
  { value: "togolese", label: "Togolese" },
  { value: "tongan", label: "Tongan" },
  { value: "trinidadian_or_tobagonian", label: "Trinidadian or Tobagonian" },
  { value: "tunisian", label: "Tunisian" },
  { value: "turkish", label: "Turkish" },
  { value: "tuvaluan", label: "Tuvaluan" },
  { value: "ugandan", label: "Ugandan" },
  { value: "ukrainian", label: "Ukrainian" },
  { value: "uruguayan", label: "Uruguayan" },
  { value: "uzbekistani", label: "Uzbekistani" },
  { value: "venezuelan", label: "Venezuelan" },
  { value: "vietnamese", label: "Vietnamese" },
  { value: "welsh", label: "Welsh" },
  { value: "yemenite", label: "Yemenite" },
  { value: "zambian", label: "Zambian" },
  { value: "zimbabwean", label: "Zimbabwean" },
];

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

// Form schemas
const companySearchSchema = z.object({
  companyNumber: z.string().min(1, "Company number is required").regex(/^[A-Z0-9]{6,8}$/i, "Invalid UK company number format"),
});

const individualClientSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  title: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  occupation: z.string().optional(),
  primaryEmail: z.string().min(1, "Email is required").email("Valid email required"),
  primaryPhone: z.string().optional(),
  email2: z.string().email("Valid email format").optional().or(z.literal("")),
  telephone2: z.string().optional(),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  locality: z.string().min(1, "Town/City is required"),
  region: z.string().optional(),
  postalCode: z.string().min(1, "Postcode is required"),
  country: z.string().default("United Kingdom"),
  niNumber: z.string().optional(),
  personalUtrNumber: z.string().optional(),
  photoIdVerified: z.boolean().optional(),
  addressVerified: z.boolean().optional(),
  isMainContact: z.boolean().default(true),
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

  // Individual form tab state
  const [individualTab, setIndividualTab] = useState("personal");
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [occupationOpen, setOccupationOpen] = useState(false);

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
      fullName: "",
      title: "",
      dateOfBirth: "",
      nationality: "",
      occupation: "",
      primaryEmail: "",
      primaryPhone: "",
      email2: "",
      telephone2: "",
      addressLine1: "",
      addressLine2: "",
      locality: "",
      region: "",
      postalCode: "",
      country: "United Kingdom",
      niNumber: "",
      personalUtrNumber: "",
      photoIdVerified: false,
      addressVerified: false,
      isMainContact: true,
    },
  });

  // Reset state when modal opens/closes or client changes
  useEffect(() => {
    if (!client) {
      setClientType('company');
      setStep('ch-search');
      setSelectedCompany(null);
      setIndividualTab("personal");
      setNationalityOpen(false);
      setOccupationOpen(false);
      searchForm.reset();
      individualForm.reset();
    }
  }, [client, searchForm, individualForm, open]);


  // Search for company using Companies House API
  const [searchQuery, setSearchQuery] = useState("");
  const [companySearchResults, setCompanySearchResults] = useState<CompanySearchResult[]>([]);
  
  // Individual client creation mutation
  const createIndividualClientMutation = useMutation({
    mutationFn: async (data: IndividualClientData) => {
      const result = await apiRequest("POST", "/api/clients/individual", data) as { client: Client; person: any };
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
      showFriendlyError({ error });
    },
  });

  const [isSearching, setIsSearching] = useState(false);

  const searchCompanies = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const data = await apiRequest("GET", `/api/companies-house/search?q=${encodeURIComponent(query)}&itemsPerPage=10`) as CompanySearchResponse;
      setCompanySearchResults(data.items || []);
    } catch (error) {
      console.error("Error searching companies:", error);
      showFriendlyError({ error: "Failed to search companies. Please try again." });
      setCompanySearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Get company profile
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);

  const loadCompanyDetails = async (companyNumber: string) => {
    setIsLoadingCompany(true);
    try {
      // Fetch company profile
      const companyProfile = await apiRequest("GET", `/api/companies-house/company/${companyNumber}`) as CompanyProfile;
      
      setSelectedCompany(companyProfile);
      setStep('ch-confirm');
    } catch (error) {
      console.error("Error loading company details:", error);
      showFriendlyError({ error: "Failed to load company details. Please try again." });
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
        primaryContactIndex: null,
      });
      
      return response as { client: Client & { people: any[] }, message: string };
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
      showFriendlyError({ error });
    },
  });


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
            onClick={() => {
              createClientFromCHMutation.mutate();
            }}
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

  // Address lookup handler
  const handleAddressSelect = (addressData: {
    addressLine1: string;
    addressLine2?: string;
    locality: string;
    region: string;
    postalCode: string;
    country: string;
  }) => {
    individualForm.setValue("addressLine1", addressData.addressLine1 || "");
    individualForm.setValue("addressLine2", addressData.addressLine2 || "");
    individualForm.setValue("locality", addressData.locality || "");
    individualForm.setValue("region", addressData.region || "");
    individualForm.setValue("postalCode", addressData.postalCode || "");
    individualForm.setValue("country", addressData.country || "United Kingdom");
  };

  // Check if each tab has data
  const hasPersonalData = individualForm.watch("fullName");
  const hasContactData = individualForm.watch("primaryEmail") || individualForm.watch("primaryPhone");
  const hasAddressData = individualForm.watch("addressLine1") || individualForm.watch("postalCode");

  // Individual client details step with 3-tab layout
  const renderIndividualDetailsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PersonIcon className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Individual Client Details</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Enter the details for the individual client. Review each tab to ensure all information is captured.
      </p>
      
      <Form {...individualForm}>
        <form onSubmit={individualForm.handleSubmit((data) => {
          createIndividualClientMutation.mutate(data);
        })} className="space-y-4">
          <Tabs value={individualTab} onValueChange={setIndividualTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger 
                value="personal" 
                className="flex items-center gap-2"
                data-testid="tab-individual-personal"
              >
                <PersonIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Personal</span>
                {hasPersonalData && (
                  <Check className="h-3 w-3 text-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="contact" 
                className="flex items-center gap-2"
                data-testid="tab-individual-contact"
              >
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">Contact</span>
                {hasContactData && (
                  <Check className="h-3 w-3 text-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="address" 
                className="flex items-center gap-2"
                data-testid="tab-individual-address"
              >
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Address</span>
                {hasAddressData && (
                  <Check className="h-3 w-3 text-green-500" />
                )}
              </TabsTrigger>
            </TabsList>

            {/* Personal Tab */}
            <TabsContent value="personal" className="space-y-4 min-h-[380px] max-h-[50vh] overflow-y-auto pr-2">
              <FormField
                control={individualForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter full name"
                        data-testid="input-full-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={individualForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-title">
                            <SelectValue placeholder="Select title" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TITLES.map((title) => (
                            <SelectItem key={title.value} value={title.value}>
                              {title.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={individualForm.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          data-testid="input-date-of-birth"
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
                  name="nationality"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Nationality</FormLabel>
                      <Popover open={nationalityOpen} onOpenChange={setNationalityOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={nationalityOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="combobox-nationality"
                            >
                              {field.value
                                ? NATIONALITIES.find((n) => n.value === field.value)?.label
                                : "Select nationality"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search nationality..." />
                            <CommandList>
                              <CommandEmpty>No nationality found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {NATIONALITIES.map((nationality) => (
                                  <CommandItem
                                    key={nationality.value}
                                    value={nationality.label}
                                    onSelect={() => {
                                      field.onChange(nationality.value);
                                      setNationalityOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === nationality.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {nationality.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={individualForm.control}
                  name="occupation"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Occupation</FormLabel>
                      <Popover open={occupationOpen} onOpenChange={setOccupationOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={occupationOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="combobox-occupation"
                            >
                              {field.value
                                ? OCCUPATIONS.find((o) => o.value === field.value)?.label
                                : "Select occupation"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search occupation..." />
                            <CommandList>
                              <CommandEmpty>No occupation found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {OCCUPATIONS.map((occupation) => (
                                  <CommandItem
                                    key={occupation.value}
                                    value={occupation.label}
                                    onSelect={() => {
                                      field.onChange(occupation.value);
                                      setOccupationOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === occupation.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {occupation.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Compliance Section - Always visible */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Compliance Information</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={individualForm.control}
                    name="niNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NI Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="AB123456C"
                            data-testid="input-ni-number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={individualForm.control}
                    name="personalUtrNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal UTR Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="1234567890"
                            data-testid="input-personal-utr"
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
                    name="photoIdVerified"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-photo-id-verified"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Photo ID Verified</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={individualForm.control}
                    name="addressVerified"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-address-verified"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Address Verified</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" className="space-y-4 min-h-[380px] max-h-[50vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={individualForm.control}
                  name="primaryEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Email *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="email@example.com"
                            className="pl-10"
                            data-testid="input-primary-email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={individualForm.control}
                  name="primaryPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Phone</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            placeholder="07XXX XXXXXX"
                            className="pl-10"
                            data-testid="input-primary-phone"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Secondary Contacts - Always visible */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Secondary Contact Details</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={individualForm.control}
                    name="email2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="secondary@example.com"
                              className="pl-10"
                              data-testid="input-email-2"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={individualForm.control}
                    name="telephone2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Phone</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="07XXX XXXXXX"
                              className="pl-10"
                              data-testid="input-telephone-2"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="address" className="space-y-4 min-h-[380px] max-h-[50vh] overflow-y-auto pr-2">
              <AddressLookup
                onAddressSelect={handleAddressSelect}
                value={{
                  addressLine1: individualForm.watch("addressLine1"),
                  addressLine2: individualForm.watch("addressLine2"),
                  locality: individualForm.watch("locality"),
                  region: individualForm.watch("region"),
                  postalCode: individualForm.watch("postalCode"),
                  country: individualForm.watch("country"),
                }}
              />

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Address Details</h4>
                
                <FormField
                  control={individualForm.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1 *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Street address"
                          data-testid="input-address-line-1"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={individualForm.control}
                  name="addressLine2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Apartment, suite, etc. (optional)"
                          data-testid="input-address-line-2"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={individualForm.control}
                    name="locality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Town/City *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Town or city"
                            data-testid="input-locality"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={individualForm.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County/Region</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="County or region"
                            data-testid="input-region"
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
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postcode *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="SW1A 1AA"
                            data-testid="input-postal-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={individualForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="United Kingdom"
                            data-testid="input-country"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end pt-4 border-t">
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
                  ? "Confirm company details to create client"
                  : "Enter individual client details"
            }
          </DialogDescription>
        </DialogHeader>

        {!isEditing && (
          <Tabs value={clientType} onValueChange={(value) => {
            setClientType(value as 'company' | 'individual');
            if (value === 'company') {
              setStep('ch-search');
            } else {
              setStep('individual-details');
            }
            setSelectedCompany(null);
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
