import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Save, Pencil, X, Check, CheckCircle2, HelpCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UDFDefinition, Service, ClientService } from "@shared/schema";
import type { EnhancedClientService } from "../../../utils/types";

const VAT_UDF_FIELD_ID = 'vat_number_auto';
const VAT_ADDRESS_UDF_FIELD_ID = 'vat_address_auto';

interface VatValidationStatus {
  status: 'validated' | 'invalid' | 'unvalidated' | 'validating';
  companyName?: string;
  validatedAt?: string;
  error?: string;
}

interface ServicesDataSubTabProps {
  clientId: string;
  clientServices: EnhancedClientService[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
}

interface UdfFieldProps {
  definition: UDFDefinition;
  value: any;
  onChange: (value: any) => void;
  disabled: boolean;
  error?: string;
}

function UdfField({ definition, value, onChange, disabled, error }: UdfFieldProps) {
  const validateValue = (val: string): string | undefined => {
    if (definition.regex && val) {
      try {
        const regex = new RegExp(definition.regex);
        if (!regex.test(val)) {
          return definition.regexError || `Invalid format for ${definition.name}`;
        }
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  switch (definition.type) {
    case "short_text":
    case "number":
      return (
        <div className="space-y-1">
          <Input
            type={definition.type === "number" ? "number" : "text"}
            value={value ?? ""}
            onChange={(e) => onChange(definition.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)}
            placeholder={definition.placeholder || `Enter ${definition.name}`}
            disabled={disabled}
            className={error ? "border-red-500" : ""}
            data-testid={`input-udf-${definition.id}`}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "date":
      return (
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          data-testid={`input-udf-${definition.id}`}
        />
      );

    case "boolean":
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`udf-${definition.id}`}
            checked={value === true || value === "true"}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
            data-testid={`checkbox-udf-${definition.id}`}
          />
          <label htmlFor={`udf-${definition.id}`} className="text-sm text-muted-foreground">
            {value === undefined || value === null ? "Not set" : value ? "Yes" : "No"}
          </label>
        </div>
      );

    case "dropdown":
      return (
        <Select
          value={value ?? ""}
          onValueChange={onChange}
          disabled={disabled}
          data-testid={`select-udf-${definition.id}`}
        >
          <SelectTrigger>
            <SelectValue placeholder={definition.placeholder || `Select ${definition.name}`} />
          </SelectTrigger>
          <SelectContent>
            {(definition.options || []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "long_text":
      return (
        <div className="space-y-1">
          <textarea
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={definition.placeholder || `Enter ${definition.name}`}
            disabled={disabled}
            className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500' : ''}`}
            data-testid={`textarea-udf-${definition.id}`}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    default:
      return (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          data-testid={`input-udf-${definition.id}`}
        />
      );
  }
}

interface ServiceDataCardProps {
  clientService: EnhancedClientService;
  onSave: (clientServiceId: string, udfValues: Record<string, any>) => Promise<void>;
  isSaving: boolean;
  onRefetch: () => void;
}

function ServiceDataCard({ clientService, onSave, isSaving, onRefetch }: ServiceDataCardProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const udfDefinitions = (clientService.service.udfDefinitions as UDFDefinition[] | null) || [];
  const currentValues = (clientService.udfValues as Record<string, any>) || {};

  // Initialize VAT validation status from stored metadata
  const getInitialVatStatus = (): VatValidationStatus => {
    const validationKey = `${VAT_UDF_FIELD_ID}_validation`;
    const validationData = currentValues[validationKey];
    
    if (validationData?.isValid !== undefined) {
      return {
        status: validationData.isValid ? 'validated' : 'invalid',
        companyName: validationData.companyName,
        validatedAt: validationData.validatedAt,
        error: validationData.error,
      };
    }
    
    return { status: 'unvalidated' };
  };

  const [vatStatus, setVatStatus] = useState<VatValidationStatus>(getInitialVatStatus);

  // Sync VAT status when clientService.udfValues changes (e.g., after refetch)
  useEffect(() => {
    if (!isEditing) {
      setVatStatus(getInitialVatStatus());
    }
  }, [clientService.udfValues]);

  // Check if this service has a VAT field
  const hasVatField = udfDefinitions.some(def => def.id === VAT_UDF_FIELD_ID);
  const isVatService = (clientService.service as any).isVatService === true;

  // VAT validation mutation
  const validateVatMutation = useMutation({
    mutationFn: async () => {
      // First save current values if editing
      if (isEditing && Object.keys(editedValues).length > 0) {
        await onSave(clientService.id, editedValues);
      }
      
      return await apiRequest("POST", `/api/client-services/${clientService.id}/validate-vat`, {});
    },
    onSuccess: (data: any) => {
      if (data.isValid) {
        setVatStatus({
          status: 'validated',
          companyName: data.companyName,
          validatedAt: data.validatedAt,
        });
        toast({
          title: "VAT Validated",
          description: `VAT number is registered to ${data.companyName}`,
        });
      } else {
        setVatStatus({
          status: 'invalid',
          error: data.error,
        });
        toast({
          title: "VAT Invalid",
          description: data.error || "VAT number not found in HMRC records",
          variant: "destructive",
        });
      }
      onRefetch();
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientService.clientId, "services"] });
    },
    onError: (error: any) => {
      setVatStatus({
        status: 'unvalidated',
        error: error instanceof Error ? error.message : 'Validation failed',
      });
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Could not connect to HMRC API",
        variant: "destructive",
      });
    },
  });

  if (udfDefinitions.length === 0) {
    return null;
  }

  const handleEdit = () => {
    setEditedValues({ ...currentValues });
    setErrors({});
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedValues({});
    setErrors({});
    // Reset VAT status to stored value
    setVatStatus(getInitialVatStatus());
  };

  const isEmptyValue = (value: any, type: string): boolean => {
    if (value === undefined || value === null) return true;
    if (type === "boolean") return false;
    if (type === "number") return value === "" || (typeof value === "string" && value.trim() === "");
    return value === "" || (typeof value === "string" && value.trim() === "");
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    udfDefinitions.forEach((def) => {
      const value = editedValues[def.id];
      
      if (def.required && isEmptyValue(value, def.type)) {
        newErrors[def.id] = `${def.name} is required`;
      } else if (def.regex && value !== undefined && value !== null && value !== "") {
        try {
          const regex = new RegExp(def.regex);
          if (!regex.test(String(value))) {
            newErrors[def.id] = def.regexError || `Invalid format for ${def.name}`;
          }
        } catch {
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateAll()) return;
    
    // When saving, if VAT value changed, mark as unvalidated
    const originalVat = currentValues[VAT_UDF_FIELD_ID];
    const newVat = editedValues[VAT_UDF_FIELD_ID];
    if (originalVat !== newVat && hasVatField) {
      // Clear validation metadata when VAT number changes
      const updatedValues = { ...editedValues };
      delete updatedValues[`${VAT_UDF_FIELD_ID}_validation`];
      await onSave(clientService.id, updatedValues);
      setVatStatus({ status: 'unvalidated' });
    } else {
      await onSave(clientService.id, editedValues);
    }
    
    setIsEditing(false);
    setEditedValues({});
  };

  const handleValueChange = (fieldId: string, value: any) => {
    setEditedValues((prev) => ({ ...prev, [fieldId]: value }));
    
    // If VAT field changed, mark as unvalidated
    if (fieldId === VAT_UDF_FIELD_ID) {
      setVatStatus({ status: 'unvalidated' });
    }
    
    const def = udfDefinitions.find((d) => d.id === fieldId);
    if (!def) return;

    let fieldError: string | undefined = undefined;

    if (def.required && isEmptyValue(value, def.type)) {
      fieldError = `${def.name} is required`;
    } else if (def.regex && value !== undefined && value !== null && value !== "") {
      try {
        const regex = new RegExp(def.regex);
        if (!regex.test(String(value))) {
          fieldError = def.regexError || `Invalid format for ${def.name}`;
        }
      } catch {
      }
    }

    setErrors((prev) => {
      const newErrors = { ...prev };
      if (fieldError) {
        newErrors[fieldId] = fieldError;
      } else {
        delete newErrors[fieldId];
      }
      return newErrors;
    });
  };

  const handleValidateVat = () => {
    const vatNumber = isEditing ? editedValues[VAT_UDF_FIELD_ID] : currentValues[VAT_UDF_FIELD_ID];
    if (!vatNumber) {
      toast({
        title: "No VAT Number",
        description: "Please enter a VAT number first",
        variant: "destructive",
      });
      return;
    }
    setVatStatus({ status: 'validating' });
    validateVatMutation.mutate();
  };

  return (
    <Card className="mb-4" data-testid={`card-service-data-${clientService.id}`}>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">{clientService.service.name}</CardTitle>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
              data-testid={`button-cancel-${clientService.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || Object.keys(errors).length > 0}
              data-testid={`button-save-${clientService.id}`}
            >
              <Check className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            data-testid={`button-edit-${clientService.id}`}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="py-3 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {udfDefinitions.map((def) => {
            const displayValue = isEditing ? editedValues[def.id] : currentValues[def.id];
            const isVatField = def.id === VAT_UDF_FIELD_ID;
            const isVatAddressField = def.id === VAT_ADDRESS_UDF_FIELD_ID;
            
            return (
              <div key={def.id} className="space-y-1.5">
                <Label className="text-sm font-medium">
                  {def.name}
                  {def.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <UdfField
                          definition={def}
                          value={displayValue}
                          onChange={(value) => handleValueChange(def.id, value)}
                          disabled={isSaving || validateVatMutation.isPending}
                          error={errors[def.id]}
                        />
                      </div>
                      
                      {/* VAT validation icons and button */}
                      {isVatField && (
                        <>
                          {vatStatus.status === 'validated' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" data-testid="icon-vat-validated" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>VAT Validated</p>
                                {vatStatus.companyName && (
                                  <p className="text-xs text-muted-foreground">{vatStatus.companyName}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {vatStatus.status === 'invalid' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" data-testid="icon-vat-invalid" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>VAT Number Invalid</p>
                                {vatStatus.error && (
                                  <p className="text-xs text-muted-foreground">{vatStatus.error}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {vatStatus.status === 'unvalidated' && displayValue && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-5 w-5 text-orange-400 flex-shrink-0" data-testid="icon-vat-unvalidated" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>VAT Not Validated</p>
                                <p className="text-xs text-muted-foreground">Click Validate to check with HMRC</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {vatStatus.status === 'validating' && (
                            <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" data-testid="icon-vat-validating" />
                          )}
                          
                          {displayValue && vatStatus.status !== 'validated' && vatStatus.status !== 'validating' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleValidateVat}
                              disabled={validateVatMutation.isPending || isSaving}
                              data-testid="button-validate-vat"
                            >
                              Validate
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* VAT company name display when validated */}
                    {isVatField && vatStatus.status === 'validated' && vatStatus.companyName && (
                      <p className="text-xs text-green-600" data-testid="text-vat-company-name">
                        Registered to: {vatStatus.companyName}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`text-sm text-muted-foreground p-2 rounded-md min-h-[2.5rem] flex items-center flex-1 ${isVatAddressField && vatStatus.status === 'validated' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-muted/30'}`}>
                        {def.type === "boolean" ? (
                          displayValue ? "Yes" : "No"
                        ) : def.type === "date" && displayValue ? (
                          new Date(displayValue).toLocaleDateString('en-GB')
                        ) : isVatAddressField && displayValue ? (
                          <span className="whitespace-pre-line">{displayValue}</span>
                        ) : (
                          displayValue || <span className="text-muted-foreground/50 italic">Not set</span>
                        )}
                      </div>
                      
                      {/* VAT validation icons in read mode */}
                      {isVatField && displayValue && (
                        <>
                          {vatStatus.status === 'validated' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" data-testid="icon-vat-validated" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>VAT Validated</p>
                                {vatStatus.companyName && (
                                  <p className="text-xs text-muted-foreground">{vatStatus.companyName}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {vatStatus.status === 'invalid' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" data-testid="icon-vat-invalid" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>VAT Number Invalid</p>
                                {vatStatus.error && (
                                  <p className="text-xs text-muted-foreground">{vatStatus.error}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {vatStatus.status === 'unvalidated' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-5 w-5 text-orange-400 flex-shrink-0" data-testid="icon-vat-unvalidated" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>VAT Not Validated</p>
                                <p className="text-xs text-muted-foreground">Edit to validate with HMRC</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* VAT company name display when validated */}
                    {isVatField && vatStatus.status === 'validated' && vatStatus.companyName && (
                      <p className="text-xs text-green-600" data-testid="text-vat-company-name">
                        Registered to: {vatStatus.companyName}
                      </p>
                    )}
                    
                    {/* VAT address auto-populated note */}
                    {isVatAddressField && vatStatus.status === 'validated' && displayValue && (
                      <p className="text-xs text-muted-foreground" data-testid="text-vat-address-note">
                        Address from HMRC VAT records
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function ServicesDataSubTab({
  clientId,
  clientServices,
  isLoading,
  isError,
  onRefetch,
}: ServicesDataSubTabProps) {
  const { toast } = useToast();

  const updateUdfMutation = useMutation({
    mutationFn: async ({ clientServiceId, udfValues }: { clientServiceId: string; udfValues: Record<string, any> }) => {
      return apiRequest("PATCH", `/api/client-services/${clientServiceId}`, { udfValues });
    },
    onSuccess: () => {
      toast({
        title: "Saved",
        description: "Service data has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "services"] });
      onRefetch();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save service data",
        variant: "destructive",
      });
    },
  });

  const handleSave = async (clientServiceId: string, udfValues: Record<string, any>) => {
    await updateUdfMutation.mutateAsync({ clientServiceId, udfValues });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load service data. Please try again.</AlertDescription>
      </Alert>
    );
  }

  const servicesWithUdfs = (clientServices || []).filter(
    (cs) => ((cs.service.udfDefinitions as UDFDefinition[] | null) || []).length > 0
  );

  if (servicesWithUdfs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="no-service-data">
        <p>No service data fields configured.</p>
        <p className="text-sm mt-1">
          Custom fields can be added to services in Settings → Services.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="services-data-list">
      {servicesWithUdfs.map((cs) => (
        <ServiceDataCard
          key={cs.id}
          clientService={cs}
          onSave={handleSave}
          isSaving={updateUdfMutation.isPending}
          onRefetch={onRefetch}
        />
      ))}
    </div>
  );
}
