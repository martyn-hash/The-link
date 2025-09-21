import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SimpleClientCreationProps {
  open: boolean;
  onClose: () => void;
  onClientCreated: (clientId: string) => void;
}

// Form schemas
const clientTypeSchema = z.object({
  clientType: z.enum(["company", "individual"]),
});

const companyDetailsSchema = z.object({
  companyNumber: z.string().min(1, "Company number is required"),
});

const individualDetailsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
});

type ClientTypeForm = z.infer<typeof clientTypeSchema>;
type CompanyDetailsForm = z.infer<typeof companyDetailsSchema>;
type IndividualDetailsForm = z.infer<typeof individualDetailsSchema>;

export function SimpleClientCreation({ open, onClose, onClientCreated }: SimpleClientCreationProps) {
  const [step, setStep] = useState<"type" | "details">("type");
  const [selectedType, setSelectedType] = useState<"company" | "individual">("company");
  const [lookupData, setLookupData] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step 1: Client type selection
  const typeForm = useForm<ClientTypeForm>({
    resolver: zodResolver(clientTypeSchema),
    defaultValues: { clientType: "company" },
  });

  // Step 2: Details forms
  const companyForm = useForm<CompanyDetailsForm>({
    resolver: zodResolver(companyDetailsSchema),
    defaultValues: { companyNumber: "" },
  });

  const individualForm = useForm<IndividualDetailsForm>({
    resolver: zodResolver(individualDetailsSchema),
    defaultValues: { name: "", email: "" },
  });

  // Company lookup mutation
  const lookupCompanyMutation = useMutation({
    mutationFn: async (companyNumber: string) => {
      const response = await apiRequest("GET", `/api/companies-house/company/${companyNumber}`);
      return await response.json();
    },
    onSuccess: (data) => {
      setLookupData(data.data);
      toast({
        title: "Company found",
        description: `Found: ${data.data.companyData.company_name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Company lookup failed", 
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Client creation mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const response = await apiRequest("POST", "/api/clients", clientData);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Client created successfully",
        description: `${selectedType === "company" ? lookupData?.companyData.company_name : individualForm.getValues().name} has been added`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onClientCreated(data.client.id);
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create client",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTypeNext = (data: ClientTypeForm) => {
    setSelectedType(data.clientType);
    setStep("details");
  };

  const handleCompanySubmit = async (data: CompanyDetailsForm) => {
    // First lookup the company
    try {
      await lookupCompanyMutation.mutateAsync(data.companyNumber);
      // If lookup succeeds, create the client with company data
      const clientData = {
        clientType: "company",
        companyNumber: data.companyNumber,
        companiesHouseData: lookupData,
      };
      await createClientMutation.mutateAsync(clientData);
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handleIndividualSubmit = async (data: IndividualDetailsForm) => {
    const clientData = {
      clientType: "individual",
      name: data.name,
      email: data.email || undefined,
    };
    await createClientMutation.mutateAsync(clientData);
  };

  const handleClose = () => {
    setStep("type");
    setSelectedType("company");
    setLookupData(null);
    typeForm.reset();
    companyForm.reset();
    individualForm.reset();
    onClose();
  };

  const isLoading = lookupCompanyMutation.isPending || createClientMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>

        {step === "type" && (
          <Form {...typeForm}>
            <form onSubmit={typeForm.handleSubmit(handleTypeNext)} className="space-y-6">
              <FormField
                control={typeForm.control}
                name="clientType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-client-type">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="company" data-testid="option-company">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Company
                          </div>
                        </SelectItem>
                        <SelectItem value="individual" data-testid="option-individual">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Individual
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-next">
                  Next
                </Button>
              </div>
            </form>
          </Form>
        )}

        {step === "details" && selectedType === "company" && (
          <div className="space-y-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4" />
                <span className="font-medium">Company Client</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter the Companies House number to lookup company details automatically.
              </p>
            </Card>

            <Form {...companyForm}>
              <form onSubmit={companyForm.handleSubmit(handleCompanySubmit)} className="space-y-4">
                <FormField
                  control={companyForm.control}
                  name="companyNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Companies House Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 12345678"
                          {...field}
                          data-testid="input-company-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {lookupData && (
                  <Card className="p-4 bg-green-50 dark:bg-green-900/10">
                    <div className="space-y-2">
                      <div className="font-medium">✓ Company Found</div>
                      <div className="text-sm">
                        <div><strong>Name:</strong> {lookupData.companyData?.company_name}</div>
                        <div><strong>Status:</strong> {lookupData.companyData?.company_status}</div>
                        <div><strong>Type:</strong> {lookupData.companyData?.company_type}</div>
                      </div>
                    </div>
                  </Card>
                )}

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setStep("type")}
                    disabled={isLoading}
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isLoading || !companyForm.formState.isValid} 
                    data-testid="button-create-company"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Client
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        {step === "details" && selectedType === "individual" && (
          <div className="space-y-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4" />
                <span className="font-medium">Individual Client</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter the individual's basic details.
              </p>
            </Card>

            <Form {...individualForm}>
              <form onSubmit={individualForm.handleSubmit(handleIndividualSubmit)} className="space-y-4">
                <FormField
                  control={individualForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter full name"
                          {...field}
                          data-testid="input-individual-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={individualForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter email address"
                          {...field}
                          data-testid="input-individual-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setStep("type")}
                    disabled={isLoading}
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isLoading || !individualForm.formState.isValid} 
                    data-testid="button-create-individual"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Client
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}