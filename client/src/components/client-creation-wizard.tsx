import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  type Client, 
  type People,
  type Service, 
  type WorkRole, 
  type User,
  insertClientSchema,
  insertPeopleSchema
} from "@shared/schema";
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
  FormDescription,
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { 
  Building2, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  X, 
  Loader2,
  UserCheck,
  ArrowLeft,
  ArrowRight,
  Search,
  Building,
  FileText,
  Settings,
  Send
} from "lucide-react";

// TypeScript interfaces for the wizard state management

// Step 1: Client type and Companies House lookup
interface Step1FormData {
  clientType: "company" | "individual";
  companyNumber?: string;
  individualName?: string;
  individualEmail?: string;
}

// Step 2: People selection from Companies House officers
interface Step2FormData {
  selectedPeopleIds: string[];
}

// Step 3: Additional person details
interface Step3FormData {
  additionalPeopleDetails: Record<string, {
    telephone?: string;
    email?: string;
    notes?: string;
  }>;
}

// Step 4: Services selection
interface Step4FormData {
  selectedServiceIds: string[];
}

// Step 5: Service configuration and role assignments
interface Step5FormData {
  serviceConfigurations: Record<string, {
    roleAssignments: Record<string, string>; // roleId -> userId
    customSettings?: Record<string, any>;
  }>;
}

// Combined wizard state
interface WizardFormData {
  step1: Step1FormData;
  step2: Step2FormData;
  step3: Step3FormData;
  step4: Step4FormData;
  step5: Step5FormData;
}

// Companies House company data structure
interface CompaniesHouseCompany {
  companyNumber: string;
  companyName: string;
  companyStatus: string;
  companyType: string;
  dateOfCreation?: string;
  jurisdiction: string;
  sicCodes: string[];
  registeredOfficeAddress: {
    addressLine1?: string;
    addressLine2?: string;
    locality?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  };
  accountingReferenceDate: {
    day?: number;
    month?: number;
  };
  accounts: {
    lastMadeUpTo?: string;
    type?: string;
    nextDue?: string;
    periodEndOn?: string;
    overdue?: boolean;
  };
  confirmationStatement: {
    lastMadeUpTo?: string;
    nextDue?: string;
    nextMadeUpTo?: string;
    overdue?: boolean;
  };
}

// Companies House officer data
interface CompaniesHouseOfficer extends People {
  officerRole: string;
  appointedOn?: string;
  resignedOn?: string;
  isPre1992Appointment?: boolean;
}

// Service with details for wizard
interface ServiceWithDetails extends Service {
  projectType: {
    id: string;
    name: string;
  };
  roles: WorkRole[];
}

// Form validation schemas for each step
const step1Schema = z.object({
  clientType: z.enum(["company", "individual"]),
  companyNumber: z.string().optional(),
  individualName: z.string().optional(),
  individualEmail: z.string().email().optional().or(z.literal("")),
}).refine((data) => {
  if (data.clientType === "company") {
    return data.companyNumber && data.companyNumber.length > 0;
  }
  if (data.clientType === "individual") {
    return data.individualName && data.individualName.length > 0;
  }
  return false;
}, {
  message: "Please provide required information for the selected client type",
});

// Dynamic step2Schema based on client type
const createStep2Schema = (clientType: "company" | "individual") => {
  return z.object({
    selectedPeopleIds: clientType === "individual" 
      ? z.array(z.string()) // Allow empty array for individuals
      : z.array(z.string()).min(1, "Please select at least one person"), // Require selection for companies
  });
};

const step2Schema = z.object({
  selectedPeopleIds: z.array(z.string()),
});

const step3Schema = z.object({
  additionalPeopleDetails: z.record(z.string(), z.object({
    telephone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    notes: z.string().optional(),
  })),
});

const step4Schema = z.object({
  selectedServiceIds: z.array(z.string()).min(1, "Please select at least one service"),
});

// Enhanced step5Schema with role assignment validation
const createStep5Schema = (services: ServiceWithDetails[] | undefined, selectedServiceIds: string[]) => {
  return z.object({
    serviceConfigurations: z.record(z.string(), z.object({
      roleAssignments: z.record(z.string(), z.string()),
      customSettings: z.record(z.string(), z.any()).optional(),
    })).refine((serviceConfigurations) => {
      // Validate each selected service's role assignments
      for (const serviceId of selectedServiceIds) {
        const service = services?.find(s => s.id === serviceId);
        const serviceConfig = serviceConfigurations[serviceId];
        
        if (service && serviceConfig) {
          // Check if all required roles have non-empty user assignments
          const requiredRoles = service.roles; // All roles are required by default
          const emptyRequiredRoles = requiredRoles.filter(role => 
            !serviceConfig.roleAssignments[role.id] || 
            serviceConfig.roleAssignments[role.id].trim() === ''
          );
          
          if (emptyRequiredRoles.length > 0) {
            return false; // Validation fails if required roles are empty
          }
        }
      }
      return true;
    }, {
      message: "All required roles must be assigned to team members for each selected service",
    }),
  });
};

const step5Schema = z.object({
  serviceConfigurations: z.record(z.string(), z.object({
    roleAssignments: z.record(z.string(), z.string()),
    customSettings: z.record(z.string(), z.any()).optional(),
  })),
});

// Company number validation schema
const companyNumberSchema = z.string().min(1).max(8).regex(/^[A-Z0-9]+$/, "Invalid company number format");

interface ClientCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (client: Client) => void;
}

export function ClientCreationWizard({
  open,
  onOpenChange,
  onSuccess,
}: ClientCreationWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Wizard state management
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [wizardData, setWizardData] = useState<WizardFormData>({
    step1: { clientType: "company" },
    step2: { selectedPeopleIds: [] },
    step3: { additionalPeopleDetails: {} },
    step4: { selectedServiceIds: [] },
    step5: { serviceConfigurations: {} },
  });

  // UI state for form watchers (prevents infinite re-renders)
  const [currentClientType, setCurrentClientType] = useState<"company" | "individual">("company");
  const [selectedPeopleCount, setSelectedPeopleCount] = useState(0);
  const [selectedServicesCount, setSelectedServicesCount] = useState(0);

  // API data state
  const [companiesHouseCompany, setCompaniesHouseCompany] = useState<any>(null);
  const [companiesHouseOfficers, setCompaniesHouseOfficers] = useState<CompaniesHouseOfficer[]>([]);
  const [isLoadingCompanyData, setIsLoadingCompanyData] = useState(false);
  const [companyLookupError, setCompanyLookupError] = useState<string | null>(null);

  // Debug modal state for tracing directors data
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);

  // Fetch services for step 4 and 5 (moved up for resolver dependencies)
  const { data: services, isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services"],
    enabled: open && currentStep >= 4,
    retry: false,
  });

  // Static resolvers for basic validation (programmatic validation added via useEffect below)

  // Form instances for each step
  const step1Form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: wizardData.step1,
  });

  const step2Form = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues: wizardData.step2,
    mode: "onChange", // Enable real-time validation
  });

  const step3Form = useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
    defaultValues: wizardData.step3,
  });

  const step4Form = useForm<Step4FormData>({
    resolver: zodResolver(step4Schema),
    defaultValues: wizardData.step4,
  });

  const step5Form = useForm<Step5FormData>({
    resolver: zodResolver(step5Schema),
    defaultValues: wizardData.step5,
    mode: "onChange", // Enable real-time validation
  });

  // Get current step form (memoized to prevent re-computation)
  const currentStepForm = useMemo(() => {
    switch (currentStep) {
      case 1: return step1Form;
      case 2: return step2Form;
      case 3: return step3Form;
      case 4: return step4Form;
      case 5: return step5Form;
      default: return step1Form;
    }
  }, [currentStep, step1Form, step2Form, step3Form, step4Form, step5Form]);

  // Fetch users for role assignments in step 5
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: open && currentStep === 5,
    retry: false,
  });

  // Reset wizard when modal opens/closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      const initialWizardData = {
        step1: { clientType: "company" as const },
        step2: { selectedPeopleIds: [] },
        step3: { additionalPeopleDetails: {} },
        step4: { selectedServiceIds: [] },
        step5: { serviceConfigurations: {} },
      };
      setWizardData(initialWizardData);
      setCompaniesHouseCompany(null);
      setCompaniesHouseOfficers([]);
      setCompanyLookupError(null);
      
      // Reset UI state
      setCurrentClientType("company");
      setSelectedPeopleCount(0);
      setSelectedServicesCount(0);
      
      // Reset all forms
      step1Form.reset(initialWizardData.step1);
      step2Form.reset(initialWizardData.step2);
      step3Form.reset(initialWizardData.step3);
      step4Form.reset(initialWizardData.step4);
      step5Form.reset(initialWizardData.step5);
    }
  }, [open]);

  // Track Step 1 form changes for UI state
  useEffect(() => {
    const subscription = step1Form.watch((value) => {
      if (value.clientType && value.clientType !== currentClientType) {
        setCurrentClientType(value.clientType);
      }
    });
    return () => subscription.unsubscribe();
  }, [currentClientType]);

  // Track Step 4 form changes for UI state
  useEffect(() => {
    const subscription = step4Form.watch((value) => {
      const selectedCount = value.selectedServiceIds?.length || 0;
      if (selectedCount !== selectedServicesCount) {
        setSelectedServicesCount(selectedCount);
      }
    });
    return () => subscription.unsubscribe();
  }, [selectedServicesCount]);

  // Programmatic validation for Step 2: selectedPeopleIds based on clientType
  useEffect(() => {
    // Only perform validation if we're on step 2 to avoid unnecessary processing
    if (currentStep !== 2) return;
    
    const subscription = step2Form.watch((value, { name }) => {
      const selectedPeopleIds = value.selectedPeopleIds || [];
      const clientType = wizardData.step1.clientType;
      
      // Update UI state
      setSelectedPeopleCount(selectedPeopleIds.length);
      
      // Use timeout to prevent immediate re-render cycles
      setTimeout(() => {
        step2Form.clearErrors('selectedPeopleIds');
        
        if (clientType === 'company' && selectedPeopleIds.length === 0) {
          step2Form.setError('selectedPeopleIds', {
            message: 'Please select at least one director'
          });
        }
      }, 0);
    });
    
    return () => subscription.unsubscribe();
  }, [currentStep]); // Removed wizardData.step1.clientType to prevent circular dependency

  // Programmatic validation for Step 5: roleAssignments for each service
  useEffect(() => {
    // Only perform validation if we're on step 5 and have services data
    if (currentStep !== 5 || !services) return;
    
    let isProcessing = false; // Prevent recursive calls
    
    const subscription = step5Form.watch((value, { name, type }) => {
      // Skip if we're already processing to prevent recursion
      if (isProcessing) return;
      
      // Only process actual user changes, not programmatic setValue calls
      if (type !== 'change') return;
      
      const serviceConfigurations = value.serviceConfigurations || {};
      const selectedServiceIds = wizardData.step4.selectedServiceIds || [];
      
      isProcessing = true;
      
      // Use requestAnimationFrame to prevent immediate re-render cycles
      requestAnimationFrame(() => {
        try {
          // Clear all role assignment errors first
          selectedServiceIds.forEach(serviceId => {
            const service = services?.find(s => s.id === serviceId);
            if (service) {
              service.roles.forEach(role => {
                step5Form.clearErrors(`serviceConfigurations.${serviceId}.roleAssignments.${role.id}`);
              });
            }
          });
          
          // Apply validation for each selected service and required role
          selectedServiceIds.forEach(serviceId => {
            const service = services?.find(s => s.id === serviceId);
            const serviceConfig = serviceConfigurations[serviceId];
            
            if (service && serviceConfig) {
              service.roles.forEach(role => {
                const roleAssignment = serviceConfig.roleAssignments?.[role.id];
                
                // If role assignment is empty, set error
                if (!roleAssignment || roleAssignment.trim() === '') {
                  step5Form.setError(`serviceConfigurations.${serviceId}.roleAssignments.${role.id}`, {
                    message: 'This role is required'
                  });
                }
              });
            }
          });
        } finally {
          isProcessing = false;
        }
      });
    });
    
    return () => subscription.unsubscribe();
  }, [currentStep, services]); // Removed wizardData.step4.selectedServiceIds to prevent circular dependency

  // Companies House company lookup
  const lookupCompanyMutation = useMutation({
    mutationFn: async (companyNumber: string) => {
      console.log('🏢 [DEBUG] Starting company lookup API call for:', companyNumber);
      console.log('🌐 [DEBUG] Company lookup endpoint:', `/api/companies-house/company/${companyNumber}`);
      const response = await apiRequest("GET", `/api/companies-house/company/${companyNumber}`);
      const result = await response.json();
      console.log('📡 [DEBUG] Raw company lookup API response:', result);
      return result;
    },
    onSuccess: (data: any) => {
      console.log('✅ [DEBUG] Company lookup mutation onSuccess called with data:', data);
      
      // Extract the company data from the API response structure
      const companyData = data.data.companyData;
      console.log('🏢 [DEBUG] Extracted company data:', companyData);
      console.log('💾 [DEBUG] Setting companiesHouseCompany state...');
      
      setCompaniesHouseCompany(companyData);
      setCompanyLookupError(null);
      
      console.log('🎉 [DEBUG] Company lookup completed successfully');
      toast({
        title: "Company found",
        description: `Successfully loaded data for ${companyData.company_name}`,
      });
    },
    onError: (error: Error) => {
      console.error('❌ [DEBUG] Company lookup mutation onError called:', error.message);
      setCompanyLookupError(error.message);
      setCompaniesHouseCompany(null);
      toast({
        title: "Company lookup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Companies House officers lookup
  const lookupOfficersMutation = useMutation({
    mutationFn: async (companyNumber: string) => {
      console.log('🔍 [DEBUG] Starting officers lookup for company:', companyNumber);
      const response = await apiRequest("GET", `/api/companies-house/officers/${companyNumber}`);
      const result = await response.json();
      console.log('📡 [DEBUG] Raw API response for officers:', result);
      return result;
    },
    onSuccess: (data: any) => {
      console.log('✅ [DEBUG] Officers mutation onSuccess called with data:', data);
      
      // Extract the officers data from the API response structure
      // Backend returns: { data: { transformedPeopleData: [{ person: {...}, clientPeopleData: {...} }] } }
      const rawOfficersData = data.data?.transformedPeopleData || data.transformedPeopleData || [];
      console.log('📊 [DEBUG] Extracted rawOfficersData:', rawOfficersData);
      
      // Extract and merge person + clientPeopleData into flat structure for frontend
      const officersData = rawOfficersData.map((item: any) => {
        const person = item.person || item;
        const clientPeopleData = item.clientPeopleData || {};
        
        return {
          // Use personNumber as ID if available, otherwise create one from fullName
          id: person.personNumber || person.fullName?.replace(/\s+/g, '_').toLowerCase() || 'unknown',
          fullName: person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim(),
          firstName: person.firstName,
          lastName: person.lastName,
          officerRole: clientPeopleData.officerRole || 'Unknown Role',
          appointedOn: clientPeopleData.appointedOn,
          resignedOn: clientPeopleData.resignedOn,
          nationality: person.nationality,
          email: person.email,
          telephone: person.telephone,
          // Include other fields that might be useful
          ...person
        };
      }).filter((officer: any) => officer.fullName && officer.fullName.trim() !== '');
      
      console.log('👥 [DEBUG] Processed officers data:', officersData);
      console.log('📈 [DEBUG] Setting companiesHouseOfficers state with', officersData.length, 'officers');
      
      // CRITICAL DEBUG: Log state before and after update
      console.log('🔄 [DEBUG] Current companiesHouseOfficers state before update:', companiesHouseOfficers);
      setCompaniesHouseOfficers(officersData);
      console.log('✨ [DEBUG] companiesHouseOfficers state update triggered with:', officersData);
      
      // Store debug data for modal
      setDebugData({
        timestamp: new Date().toISOString(),
        companyLookupData: companiesHouseCompany,
        officersLookupData: data,
        processedOfficers: officersData,
        currentState: {
          companiesHouseOfficers: officersData,
          wizardData: wizardData
        }
      });
      
      // Trigger debug modal to show for company clients
      console.log('🚨 [DEBUG] Triggering debug modal after officers lookup success');
      setShowDebugModal(true);
      
      toast({
        title: "Officers loaded",
        description: `Found ${officersData.length} officer(s) for this company`,
      });
    },
    onError: (error: Error) => {
      console.error('❌ [DEBUG] Officers mutation onError called:', error.message);
      setCompaniesHouseOfficers([]);
      toast({
        title: "Officers lookup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Final client creation mutation
  const createClientMutation = useMutation({
    mutationFn: async (wizardData: WizardFormData) => {
      const payload = {
        // Client type and basic information
        clientType: wizardData.step1.clientType,
        
        // Company data (for company clients)
        companyData: wizardData.step1.clientType === "company" ? {
          companyNumber: wizardData.step1.companyNumber || "",
        } : undefined,
        
        // Individual client data (for individual clients)
        individualData: wizardData.step1.clientType === "individual" ? {
          name: wizardData.step1.individualName || "",
          email: wizardData.step1.individualEmail || "",
        } : undefined,
        
        // People selection (from Companies House for companies, empty for individuals)
        selectedPeopleIds: wizardData.step2.selectedPeopleIds,
        
        // Additional people details from Step 3
        additionalPeopleDetails: wizardData.step3.additionalPeopleDetails || {},
        
        // Services and role assignments
        services: wizardData.step4.selectedServiceIds.map(serviceId => ({
          serviceId,
          roleAssignments: Object.entries(wizardData.step5.serviceConfigurations[serviceId]?.roleAssignments || {}).map(([roleId, userId]) => ({
            roleId,
            userId,
          })),
        })),
      };
      
      const response = await apiRequest("POST", "/api/clients/create-with-companies-house", payload);
      return await response.json();
    },
    onSuccess: (newClient: Client) => {
      toast({
        title: "Success",
        description: "Client created successfully with all associated data",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onSuccess?.(newClient);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      });
    },
  });

  // Navigation handlers
  const handleNext = async () => {
    console.log('🎯 [DEBUG] handleNext called for step:', currentStep);
    
    switch (currentStep) {
      case 1: {
        console.log('📝 [DEBUG] Processing Step 1 navigation...');
        
        const isValid = await step1Form.trigger();
        console.log('✅ [DEBUG] Step 1 form validation result:', isValid);
        
        if (!isValid) {
          console.log('❌ [DEBUG] Step 1 validation failed, blocking navigation');
          toast({
            title: "Validation Error",
            description: "Please complete all required fields before continuing",
            variant: "destructive",
          });
          return;
        }

        const step1Data = step1Form.getValues();
        console.log('📊 [DEBUG] Step 1 form data:', step1Data);
        
        // For company type, ensure company lookup is successful before proceeding
        if (step1Data.clientType === "company" && step1Data.companyNumber) {
          console.log('🏢 [DEBUG] Company client detected, processing company lookup...');
          
          // Validate company number format
          const companyNumberValidation = companyNumberSchema.safeParse(step1Data.companyNumber);
          console.log('🔍 [DEBUG] Company number validation result:', companyNumberValidation);
          
          if (!companyNumberValidation.success) {
            console.log('❌ [DEBUG] Invalid company number format:', step1Data.companyNumber);
            toast({
              title: "Invalid Company Number",
              description: "Please enter a valid company number (up to 8 alphanumeric characters)",
              variant: "destructive",
            });
            return;
          }

          // Lookup company data before proceeding - use return values directly
          const needsLookup = !companiesHouseCompany || companiesHouseCompany.company_number !== step1Data.companyNumber;
          console.log('🔍 [DEBUG] Needs company lookup:', needsLookup);
          console.log('🏢 [DEBUG] Current companiesHouseCompany state:', companiesHouseCompany);
          console.log('👥 [DEBUG] Current companiesHouseOfficers state before lookup:', companiesHouseOfficers);
          
          if (needsLookup) {
            console.log('🚀 [DEBUG] Starting company and officers lookup for:', step1Data.companyNumber);
            setIsLoadingCompanyData(true);
            
            try {
              console.log('📞 [DEBUG] Calling company lookup mutation...');
              const companyResult = await lookupCompanyMutation.mutateAsync(step1Data.companyNumber);
              console.log('✅ [DEBUG] Company lookup completed, result:', companyResult);
              
              console.log('📞 [DEBUG] Calling officers lookup mutation...');
              const officersResult = await lookupOfficersMutation.mutateAsync(step1Data.companyNumber);
              console.log('✅ [DEBUG] Officers lookup completed, result:', officersResult);
              
              console.log('🎉 [DEBUG] Both lookups completed successfully');
              
              // Wait a bit for state updates to complete
              await new Promise(resolve => setTimeout(resolve, 100));
              
              console.log('🔄 [DEBUG] Final state after lookups:');
              console.log('   - companiesHouseCompany:', companiesHouseCompany);
              console.log('   - companiesHouseOfficers:', companiesHouseOfficers);
              
            } catch (error) {
              console.error('❌ [DEBUG] Lookup failed with error:', error);
              // Block advancement if lookup fails
              toast({
                title: "Company Lookup Required",
                description: "Please successfully lookup company data before proceeding",
                variant: "destructive",
              });
              return;
            } finally {
              setIsLoadingCompanyData(false);
            }
          } else {
            console.log('⏩ [DEBUG] Company data already loaded, skipping lookup');
          }
        } else {
          console.log('👤 [DEBUG] Individual client or no company number, skipping lookup');
        }

        // Save step 1 data
        console.log('💾 [DEBUG] Saving step 1 data to wizard state:', step1Data);
        setWizardData(prev => {
          const newData = { ...prev, step1: step1Data };
          console.log('📊 [DEBUG] Updated wizard data:', newData);
          return newData;
        });
        
        console.log('🎯 [DEBUG] Step 1 processing complete, ready to advance to Step 2');
        break;
      }

      case 2: {
        const step2Data = step2Form.getValues();
        const clientType = wizardData.step1.clientType;
        
        // Validate using dynamic schema based on client type
        const dynamicStep2Schema = createStep2Schema(clientType);
        const validation = dynamicStep2Schema.safeParse(step2Data);
        
        if (!validation.success) {
          const errorMessage = clientType === "company" 
            ? "Please select at least one director/officer before continuing"
            : "Validation error occurred";
          toast({
            title: "Validation Error",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }

        setWizardData(prev => ({ ...prev, step2: step2Data }));
        break;
      }

      case 3: {
        const isValid = await step3Form.trigger();
        if (!isValid) {
          toast({
            title: "Validation Error",
            description: "Please complete person details before continuing",
            variant: "destructive",
          });
          return;
        }

        const step3Data = step3Form.getValues();
        setWizardData(prev => ({ ...prev, step3: step3Data }));
        break;
      }

      case 4: {
        const isValid = await step4Form.trigger();
        if (!isValid) {
          toast({
            title: "Validation Error",
            description: "Please select at least one service before continuing",
            variant: "destructive",
          });
          return;
        }

        const step4Data = step4Form.getValues();
        setWizardData(prev => ({ ...prev, step4: step4Data }));

        // CRITICAL FIX: Preserve actual Step 5 form state to prevent data loss on navigation
        // Check for data readiness before proceeding - only check services (users not needed at step 4)
        if (servicesLoading) {
          toast({
            title: "Loading Data",
            description: "Please wait while we load the services data...",
            variant: "default",
          });
          return;
        }
        
        // Ensure services are present before building configurations
        if (!services) {
          toast({
            title: "Services Unavailable",
            description: "Unable to load services. Please try again.",
            variant: "destructive",
          });
          return;
        }
        
        const updatedServiceConfigs: Record<string, { roleAssignments: Record<string, string>; customSettings?: Record<string, any> }> = {};
        
        if (services) {
          // CRITICAL FIX: Get existing configurations from current step5Form state first, fallback to wizardData
          const currentStep5Values = step5Form.getValues();
          const existingConfigs = currentStep5Values.serviceConfigurations || wizardData.step5.serviceConfigurations || {};
          
          step4Data.selectedServiceIds.forEach(serviceId => {
            const service = services.find(s => s.id === serviceId);
            if (service) {
              // Check if we have existing configuration for this service
              const existingConfig = existingConfigs[serviceId];
              
              if (existingConfig) {
                // PRESERVE EXISTING STATE: Keep existing role assignments and custom settings
                updatedServiceConfigs[serviceId] = {
                  roleAssignments: { ...existingConfig.roleAssignments },
                  customSettings: { ...existingConfig.customSettings },
                };
                
                // Add any new roles that might have been added to the service (edge case)
                service.roles.forEach(role => {
                  if (!(role.id in updatedServiceConfigs[serviceId].roleAssignments)) {
                    updatedServiceConfigs[serviceId].roleAssignments[role.id] = '';
                  }
                });
              } else {
                // ONLY INITIALIZE NEW SERVICES: Create empty config for newly selected services
                updatedServiceConfigs[serviceId] = {
                  roleAssignments: service.roles.reduce((acc, role) => {
                    acc[role.id] = ''; // Empty user assignment for new services only
                    return acc;
                  }, {} as Record<string, string>),
                  customSettings: {},
                };
              }
            }
          });
          
          // PRUNE REMOVED SERVICES: Configs for services no longer selected are automatically excluded
          // since we only iterate over step4Data.selectedServiceIds
        }
        
        // Update step5 form with updated configurations (preserving existing data)
        // Use shouldValidate: false to prevent triggering watchers and validation
        step5Form.setValue('serviceConfigurations', updatedServiceConfigs, { 
          shouldValidate: false, 
          shouldTouch: false, 
          shouldDirty: false 
        });
        setWizardData(prev => ({ ...prev, step5: { serviceConfigurations: updatedServiceConfigs } }));
        break;
      }

      default:
        return;
    }

    // Advance to next step
    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as typeof currentStep);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      // CRITICAL FIX: Persist Step 5 data when leaving to prevent data loss
      if (currentStep === 5) {
        const step5Data = step5Form.getValues();
        setWizardData(prev => ({ ...prev, step5: step5Data }));
      }
      
      setCurrentStep((prev) => (prev - 1) as typeof currentStep);
    }
  };

  const handleSubmit = async () => {
    // Get current Step 5 form values to ensure latest user input is included
    const step5Data = step5Form.getValues();
    
    // Use enhanced schema for final validation
    const enhancedStep5Schema = createStep5Schema(services, wizardData.step4.selectedServiceIds);
    const validation = enhancedStep5Schema.safeParse(step5Data);
    
    if (!validation.success) {
      // Show detailed validation errors for better UX
      const errors = validation.error.errors;
      const roleErrors = errors.filter(err => err.message.includes("role"));
      
      if (roleErrors.length > 0) {
        toast({
          title: "Role Assignment Required",
          description: "All required roles must be assigned to team members. Please check the fields marked with errors.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Validation Error",
          description: "Please complete all required fields before submitting",
          variant: "destructive",
        });
      }
      return;
    }

    // CRITICAL FIX: Merge current Step 5 form values with wizardData to ensure latest user input is submitted
    const finalWizardData = {
      ...wizardData,
      step5: step5Data
    };

    createClientMutation.mutate(finalWizardData);
  };

  // Calculate progress percentage
  const progressPercentage = (currentStep / 5) * 100;

  // Get step icon
  const getStepIcon = (step: number) => {
    const iconProps = { className: "w-5 h-5" };
    switch (step) {
      case 1: return <Building {...iconProps} />;
      case 2: return <Users {...iconProps} />;
      case 3: return <FileText {...iconProps} />;
      case 4: return <Settings {...iconProps} />;
      case 5: return <Send {...iconProps} />;
      default: return <Building {...iconProps} />;
    }
  };

  // Get step title
  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return "Client Type & Company Lookup";
      case 2: return "Director/People Selection";
      case 3: return "Person Details";
      case 4: return "Services Selection";
      case 5: return "Service Configuration";
      default: return "Unknown Step";
    }
  };

  const isSubmitting = createClientMutation.isPending;
  const isLoading = isLoadingCompanyData || lookupCompanyMutation.isPending || lookupOfficersMutation.isPending;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title-client-wizard">
            Create New Client
          </DialogTitle>
          <DialogDescription>
            Follow the steps below to create a new client with complete information
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Step {currentStep} of 5</span>
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progressPercentage} className="w-full" data-testid="progress-wizard" />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between items-center">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`flex flex-col items-center gap-2 ${
                step === currentStep
                  ? "text-primary"
                  : step < currentStep
                  ? "text-green-600"
                  : "text-muted-foreground"
              }`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  step === currentStep
                    ? "border-primary bg-primary/10"
                    : step < currentStep
                    ? "border-green-600 bg-green-600/10"
                    : "border-muted bg-muted/10"
                }`}
                data-testid={`step-indicator-${step}`}
              >
                {step < currentStep ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  getStepIcon(step)
                )}
              </div>
              <span className="text-xs font-medium text-center max-w-20">
                {getStepTitle(step)}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Step Content */}
        <div className="min-h-[400px]">
          <div className="space-y-6">
              {/* Step 1: Client Type & Companies House Lookup */}
              {currentStep === 1 && (
                <Form {...step1Form}>
                  <div className="space-y-6" data-testid="step-1-content">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      <h3 className="text-lg font-semibold">Client Type & Company Information</h3>
                    </div>

                    <FormField
                      control={step1Form.control}
                      name="clientType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} data-testid="select-client-type">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select client type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="company">Company</SelectItem>
                            <SelectItem value="individual">Individual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                    {step1Form.watch("clientType") === "company" && (
                    <div className="space-y-4">
                        <FormField
                          control={step1Form.control}
                          name="companyNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Companies House Number</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="e.g., 12345678"
                                  data-testid="input-company-number"
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => field.value && lookupCompanyMutation.mutate(field.value)}
                                disabled={!field.value || lookupCompanyMutation.isPending}
                                data-testid="button-lookup-company"
                              >
                                {lookupCompanyMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Search className="w-4 h-4" />
                                )}
                                Lookup
                              </Button>
                            </div>
                            <FormDescription>
                              Enter the company registration number to fetch official data
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {companyLookupError && (
                        <Alert variant="destructive" data-testid="alert-company-error">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{companyLookupError}</AlertDescription>
                        </Alert>
                      )}

                      {companiesHouseCompany && (
                        <Card data-testid="card-company-details">
                          <CardHeader>
                            <CardTitle className="text-base">Company Information</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div><strong>Name:</strong> {companiesHouseCompany.company_name}</div>
                            <div><strong>Status:</strong> {companiesHouseCompany.company_status}</div>
                            <div><strong>Registered Office:</strong> {
                              [
                                companiesHouseCompany.registered_office_address?.premises,
                                companiesHouseCompany.registered_office_address?.address_line_1,
                                companiesHouseCompany.registered_office_address?.address_line_2,
                                companiesHouseCompany.registered_office_address?.locality,
                                companiesHouseCompany.registered_office_address?.postal_code
                              ].filter(Boolean).join(', ')
                            }</div>
                            {companiesHouseCompany.date_of_creation && (
                              <div><strong>Incorporated:</strong> {new Date(companiesHouseCompany.date_of_creation).toLocaleDateString()}</div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                    {currentClientType === "individual" && (
                    <div className="space-y-4">
                        <FormField
                          control={step1Form.control}
                          name="individualName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Enter individual's full name"
                                data-testid="input-individual-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                        <FormField
                          control={step1Form.control}
                          name="individualEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                placeholder="email@example.com"
                                data-testid="input-individual-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      </div>
                    )}
                  </div>
                </Form>
              )}

              {/* Step 2: Director/People Selection */}
              {currentStep === 2 && (
                <Form {...step2Form}>
                  <div className="space-y-6" data-testid="step-2-content">
                  {/* DEBUG: Enhanced logging when Step 2 renders */}
                  {(() => {
                    console.log('🎬 [DEBUG] ===== STEP 2 RENDERING =====');
                    console.log('🎬 [DEBUG] Current timestamp:', new Date().toISOString());
                    console.log('🎬 [DEBUG] companiesHouseOfficers length:', companiesHouseOfficers.length);
                    console.log('🎬 [DEBUG] companiesHouseOfficers data:', companiesHouseOfficers);
                    console.log('🎬 [DEBUG] wizardData.step1:', wizardData.step1);
                    console.log('🎬 [DEBUG] wizardData.step2:', wizardData.step2);
                    console.log('🎬 [DEBUG] companiesHouseCompany:', companiesHouseCompany);
                    console.log('🎬 [DEBUG] currentClientType:', currentClientType);
                    console.log('🎬 [DEBUG] selectedPeopleCount:', selectedPeopleCount);
                    console.log('🎬 [DEBUG] debugData:', debugData);
                    console.log('🎬 [DEBUG] ===== END STEP 2 RENDERING =====');
                    
                    // Debug modal is now triggered directly in the officers lookup success handler
                    
                    return null;
                  })()}
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">
                      {wizardData.step1.clientType === "company" ? "Director/People Selection" : "Individual Client Setup"}
                    </h3>
                  </div>
                  
                  {wizardData.step1.clientType === "company" ? (
                    <FormField
                      control={step2Form.control}
                      name="selectedPeopleIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Directors and Officers</FormLabel>
                          <FormDescription>
                            Choose the directors and officers from Companies House that you want to associate with this client.
                          </FormDescription>
                          <div className="space-y-2">
                            {companiesHouseOfficers.length > 0 ? (
                              companiesHouseOfficers.map((officer) => (
                                <div key={officer.id} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`officer-${officer.id}`}
                                    checked={field.value.includes(officer.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        field.onChange([...field.value, officer.id]);
                                      } else {
                                        field.onChange(field.value.filter(id => id !== officer.id));
                                      }
                                    }}
                                    className="rounded border-gray-300"
                                    data-testid={`checkbox-officer-${officer.id}`}
                                  />
                                  <label htmlFor={`officer-${officer.id}`} className="flex-1">
                                    <Card className="p-3 cursor-pointer hover:bg-gray-50">
                                      <div className="font-medium">{officer.fullName}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {officer.officerRole}
                                        {officer.appointedOn && ` • Appointed: ${new Date(officer.appointedOn).toLocaleDateString()}`}
                                      </div>
                                      {officer.nationality && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Nationality: {officer.nationality}
                                        </div>
                                      )}
                                    </Card>
                                  </label>
                                </div>
                              ))
                            ) : (
                              <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                  No officers found. Please ensure company lookup was successful in Step 1.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    /* Individual Client Path */
                    <div className="space-y-4">
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          For individual clients, we'll use the information you provided in Step 1. 
                          You can add additional contact details in the next step.
                        </AlertDescription>
                      </Alert>
                      
                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <UserCheck className="w-4 h-4" />
                          <span className="font-medium">Individual Client</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <strong>Name:</strong> {wizardData.step1.individualName}
                        </div>
                        {wizardData.step1.individualEmail && (
                          <div className="text-sm text-muted-foreground">
                            <strong>Email:</strong> {wizardData.step1.individualEmail}
                          </div>
                        )}
                      </Card>
                    </div>
                  )}
                  
                  {wizardData.step1.clientType === "company" && selectedPeopleCount > 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        {selectedPeopleCount} person(s) selected for this client.
                      </AlertDescription>
                    </Alert>
                  )}
                  </div>
                </Form>
              )}

              {/* Step 3: Person Details */}
              {currentStep === 3 && (
                <Form {...step3Form}>
                  <div className="space-y-6" data-testid="step-3-content">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Person Details</h3>
                  </div>
                  
                  <div className="text-sm text-muted-foreground mb-4">
                    Add additional contact details for the selected people.
                  </div>
                  
                  {wizardData.step2.selectedPeopleIds.length > 0 ? (
                    <div className="space-y-6">
                      {wizardData.step2.selectedPeopleIds.map(personId => {
                        const person = companiesHouseOfficers.find(o => o.id === personId);
                        if (!person) return null;
                        
                        return (
                          <Card key={personId} className="p-4">
                            <div className="flex items-center gap-2 mb-4">
                              <UserCheck className="w-4 h-4" />
                              <h4 className="font-medium">{person.fullName}</h4>
                              <Badge variant="secondary">{person.officerRole}</Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={step3Form.control}
                                name={`additionalPeopleDetails.${personId}.telephone`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Phone Number</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="+44 123 456 7890"
                                        data-testid={`input-person-${personId}-phone`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={step3Form.control}
                                name={`additionalPeopleDetails.${personId}.email`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="email"
                                        placeholder="email@example.com"
                                        data-testid={`input-person-${personId}-email`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <FormField
                              control={step3Form.control}
                              name={`additionalPeopleDetails.${personId}.notes`}
                              render={({ field }) => (
                                <FormItem className="mt-4">
                                  <FormLabel>Notes</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      {...field}
                                      placeholder="Additional notes about this person..."
                                      data-testid={`textarea-person-${personId}-notes`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        No people selected. Please go back to Step 2 and select people first.
                      </AlertDescription>
                    </Alert>
                    )}
                  </div>
                </Form>
              )}

              {/* Step 4: Services Selection */}
              {currentStep === 4 && (
                <Form {...step4Form}>
                  <div className="space-y-6" data-testid="step-4-content">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Services Selection</h3>
                  </div>
                  
                  {servicesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : (
                    <FormField
                      control={step4Form.control}
                      name="selectedServiceIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Services</FormLabel>
                          <FormDescription>
                            Choose the services that this client will require.
                          </FormDescription>
                          <div className="space-y-3">
                            {services && services.length > 0 ? (
                              services.map((service) => (
                                <div key={service.id} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`service-${service.id}`}
                                    checked={field.value.includes(service.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        field.onChange([...field.value, service.id]);
                                      } else {
                                        field.onChange(field.value.filter(id => id !== service.id));
                                      }
                                    }}
                                    className="rounded border-gray-300"
                                    data-testid={`checkbox-service-${service.id}`}
                                  />
                                  <label htmlFor={`service-${service.id}`} className="flex-1">
                                    <Card className="p-4 cursor-pointer hover:bg-gray-50">
                                      <div className="font-medium mb-2">{service.name}</div>
                                      {service.description && (
                                        <div className="text-sm text-muted-foreground mb-3">
                                          {service.description}
                                        </div>
                                      )}
                                      <div className="flex gap-1 flex-wrap">
                                        <Badge variant="outline" className="text-xs">
                                          {service.projectType.name}
                                        </Badge>
                                        {service.roles.map((role) => (
                                          <Badge key={role.id} variant="secondary" className="text-xs">
                                            {role.name}
                                          </Badge>
                                        ))}
                                      </div>
                                    </Card>
                                  </label>
                                </div>
                              ))
                            ) : (
                              <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                  No services available. Please contact your administrator to set up services.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {selectedServicesCount > 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        {selectedServicesCount} service(s) selected for this client.
                      </AlertDescription>
                    </Alert>
                    )}
                  </div>
                </Form>
              )}

              {/* Step 5: Service Configuration */}
              {currentStep === 5 && (
                <Form {...step5Form}>
                  <div className="space-y-6" data-testid="step-5-content">
                  <div className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Service Configuration</h3>
                  </div>
                  
                  <div className="text-sm text-muted-foreground mb-4">
                    Assign team members to roles for each selected service.
                  </div>
                  
                  {usersLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : wizardData.step4.selectedServiceIds.length > 0 ? (
                    <div className="space-y-6">
                      {wizardData.step4.selectedServiceIds.map(serviceId => {
                        const service = services?.find(s => s.id === serviceId);
                        if (!service) return null;
                        
                        return (
                          <Card key={serviceId} className="p-4">
                            <div className="flex items-center gap-2 mb-4">
                              <Settings className="w-4 h-4" />
                              <h4 className="font-medium">{service.name}</h4>
                              <Badge variant="outline">{service.projectType.name}</Badge>
                            </div>
                            
                            {service.description && (
                              <p className="text-sm text-muted-foreground mb-4">{service.description}</p>
                            )}
                            
                            <div className="space-y-4">
                              <h5 className="font-medium text-sm">Role Assignments</h5>
                              {service.roles.map(role => (
                                <FormField
                                  key={role.id}
                                  control={step5Form.control}
                                  name={`serviceConfigurations.${serviceId}.roleAssignments.${role.id}`}
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base font-medium">
                                          {role.name}
                                          <span className="text-red-500 ml-1">*</span>
                                        </FormLabel>
                                        {role.description && (
                                          <div className="text-sm text-muted-foreground">
                                            {role.description}
                                          </div>
                                        )}
                                        {!field.value && (
                                          <div className="text-xs text-red-500">
                                            This role is required
                                          </div>
                                        )}
                                      </div>
                                      <FormControl>
                                        <Select value={field.value} onValueChange={field.onChange} data-testid={`select-role-${role.id}-${serviceId}`}>
                                          <SelectTrigger className="w-48">
                                            <SelectValue placeholder="Select user" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="">No assignment</SelectItem>
                                            {users?.map(user => (
                                              <SelectItem key={user.id} value={user.id}>
                                                {user.firstName} {user.lastName} ({user.role})
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </Card>
                        );
                      })}
                      
                      {/* Validation Summary */}
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Required roles are marked with an asterisk (*)</strong>. All required roles must be assigned to team members before you can create the client. Optional roles can be assigned later.
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        No services selected. Please go back to Step 4 and select services first.
                      </AlertDescription>
                    </Alert>
                    )}
                  </div>
                </Form>
              )}
          </div>
        </div>

        <Separator />

        {/* Navigation Footer */}
        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1 || isLoading}
            data-testid="button-previous"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading || isSubmitting}
              data-testid="button-cancel"
            >
              Cancel
            </Button>

            {currentStep < 5 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isLoading}
                data-testid="button-next"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                data-testid="button-submit"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Create Client
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Debug Modal - Shows when advancing to Step 2 (separate from main wizard) */}
    <Dialog open={showDebugModal} onOpenChange={setShowDebugModal}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="debug-modal-title">
            🐛 Debug Information - Directors Data Flow
          </DialogTitle>
          <DialogDescription>
            This debug modal shows exactly what data was loaded and processed when advancing to Step 2.
          </DialogDescription>
        </DialogHeader>
        
        {debugData && (
          <div className="space-y-6">
            {/* Summary Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📊 Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong>Timestamp:</strong><br />
                    <code className="text-xs">{debugData.timestamp}</code>
                  </div>
                  <div>
                    <strong>Directors Found:</strong><br />
                    <span className="text-2xl font-bold text-green-600" data-testid="debug-directors-count">
                      {debugData.processedOfficers?.length || 0}
                    </span>
                  </div>
                </div>
                
                {debugData.processedOfficers?.length > 0 && (
                  <div className="mt-4">
                    <strong>Directors Summary:</strong>
                    <ul className="list-disc list-inside mt-2" data-testid="debug-directors-list">
                      {debugData.processedOfficers.map((officer: any, index: number) => (
                        <li key={index} className="text-sm">
                          {officer.fullName} - {officer.officerRole}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Raw API Response */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📡 Raw Officers API Response</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto" data-testid="debug-raw-api-data">
                  {JSON.stringify(debugData.officersLookupData, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* Processed Officers Data */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">⚙️ Processed Officers Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto" data-testid="debug-processed-officers">
                  {JSON.stringify(debugData.processedOfficers, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* Current Component State */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔄 Current Component State</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <strong>companiesHouseOfficers State:</strong>
                    <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto mt-2" data-testid="debug-current-officers-state">
                      {JSON.stringify(companiesHouseOfficers, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <strong>wizardData State:</strong>
                    <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto mt-2" data-testid="debug-wizard-data-state">
                      {JSON.stringify(wizardData, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Data */}
            {debugData.companyLookupData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🏢 Company Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto" data-testid="debug-company-data">
                    {JSON.stringify(debugData.companyLookupData, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        <div className="flex justify-end gap-2 mt-6">
          <Button 
            variant="outline" 
            onClick={() => setShowDebugModal(false)}
            data-testid="button-close-debug-modal"
          >
            Close Debug Modal
          </Button>
          <Button 
            onClick={() => {
              console.log('🚨 [DEBUG] Manual debug data dump:', {
                companiesHouseOfficers,
                wizardData,
                debugData,
                timestamp: new Date().toISOString()
              });
              setShowDebugModal(false);
            }}
            data-testid="button-log-and-close-debug"
          >
            Log to Console & Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}