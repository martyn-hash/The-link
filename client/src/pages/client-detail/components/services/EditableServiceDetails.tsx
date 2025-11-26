import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Pencil, CheckCircle2, AlertCircle, HelpCircle, Loader2 } from "lucide-react";
import { EnhancedClientService } from "../../utils/types";

interface EditableServiceDetailsProps {
  clientService: EnhancedClientService;
  onUpdate: () => void;
}

export function EditableServiceDetails({
  clientService,
  onUpdate
}: EditableServiceDetailsProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [udfValues, setUdfValues] = useState<Record<string, any>>(() => {
    const values = (clientService.udfValues as Record<string, any>) || {};
    const formattedValues: Record<string, any> = {};
    
    // Format date values for HTML date inputs
    if (clientService.service?.udfDefinitions && Array.isArray(clientService.service.udfDefinitions)) {
      clientService.service.udfDefinitions.forEach((field: any) => {
        if (field.type === 'date' && values[field.id]) {
          const date = new Date(values[field.id]);
          formattedValues[field.id] = date.toISOString().split('T')[0];
        } else {
          formattedValues[field.id] = values[field.id];
        }
      });
    }
    
    return formattedValues;
  });

  const [vatValidationStatus, setVatValidationStatus] = useState<Record<string, {
    status: 'validated' | 'invalid' | 'unvalidated' | 'validating';
    companyName?: string;
    validatedAt?: string;
    error?: string;
  }>>(() => {
    const initialStatus: Record<string, any> = {};
    const udfMeta = (clientService.udfValues as Record<string, any>)?._meta || {};
    
    if (clientService.service?.udfDefinitions && Array.isArray(clientService.service.udfDefinitions)) {
      clientService.service.udfDefinitions.forEach((field: any) => {
        if (field.id === 'vat_number_auto') {
          const meta = udfMeta[field.id];
          if (meta?.vatValidationStatus) {
            initialStatus[field.id] = {
              status: meta.vatValidationStatus,
              companyName: meta.vatCompanyName,
              validatedAt: meta.vatValidatedAt,
            };
          } else {
            initialStatus[field.id] = { status: 'unvalidated' };
          }
        }
      });
    }
    
    return initialStatus;
  });

  const validateVatMutation = useMutation({
    mutationFn: async (vatNumber: string) => {
      const response = await apiRequest("POST", "/api/vat/validate", { vatNumber });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.isValid) {
        setVatValidationStatus(prev => ({
          ...prev,
          vat_number_auto: {
            status: 'validated',
            companyName: data.companyName,
            validatedAt: new Date().toISOString(),
          }
        }));
        toast({
          title: "VAT Number Validated",
          description: data.companyName ? `Registered to: ${data.companyName}` : "VAT number is valid",
        });
      } else {
        setVatValidationStatus(prev => ({
          ...prev,
          vat_number_auto: {
            status: 'invalid',
            error: data.error || 'Invalid VAT number',
          }
        }));
        toast({
          title: "Invalid VAT Number",
          description: data.error || "The VAT number could not be validated with HMRC",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setVatValidationStatus(prev => ({
        ...prev,
        vat_number_auto: {
          status: 'unvalidated',
          error: error instanceof Error ? error.message : 'Validation failed',
        }
      }));
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Could not connect to HMRC API",
        variant: "destructive",
      });
    },
  });

  const handleValidateVat = (fieldId: string) => {
    const vatNumber = udfValues[fieldId];
    if (!vatNumber) {
      toast({
        title: "No VAT Number",
        description: "Please enter a VAT number first",
        variant: "destructive",
      });
      return;
    }
    setVatValidationStatus(prev => ({
      ...prev,
      [fieldId]: { status: 'validating' }
    }));
    validateVatMutation.mutate(vatNumber);
  };

  const updateServiceMutation = useMutation({
    mutationFn: async (data: { udfValues: Record<string, any> }) => {
      const processedUdfValues: Record<string, any> = {};
      
      // Convert date values from YYYY-MM-DD to ISO format for backend storage
      if (clientService.service?.udfDefinitions && Array.isArray(clientService.service.udfDefinitions)) {
        clientService.service.udfDefinitions.forEach((field: any) => {
          const value = data.udfValues[field.id];
          
          if (field.type === 'date' && value) {
            processedUdfValues[field.id] = new Date(value).toISOString();
          } else {
            processedUdfValues[field.id] = value;
          }
        });
      }
      
      // Add VAT validation metadata
      const vatStatus = vatValidationStatus.vat_number_auto;
      if (vatStatus && vatStatus.status !== 'unvalidated') {
        processedUdfValues._meta = {
          ...(processedUdfValues._meta || {}),
          vat_number_auto: {
            vatValidationStatus: vatStatus.status,
            vatCompanyName: vatStatus.companyName,
            vatValidatedAt: vatStatus.validatedAt,
          }
        };
      }

      return apiRequest("PUT", `/api/client-services/${clientService.id}`, {
        nextStartDate: clientService.nextStartDate,
        nextDueDate: clientService.nextDueDate,
        serviceOwnerId: clientService.serviceOwnerId,
        frequency: clientService.frequency,
        isActive: clientService.isActive,
        roleAssignments: clientService.roleAssignments?.map(ra => ({
          workRoleId: ra.workRole.id,
          userId: ra.user.id,
        })) || [],
        udfValues: processedUdfValues,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service details updated successfully",
      });
      setIsEditing(false);
      onUpdate();
      queryClient.invalidateQueries({ queryKey: [`/api/client-services/client/${clientService.clientId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update service details",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateServiceMutation.mutate({ udfValues });
  };

  const handleCancel = () => {
    // Reset to original values
    const values = (clientService.udfValues as Record<string, any>) || {};
    const formattedValues: Record<string, any> = {};
    
    if (clientService.service?.udfDefinitions && Array.isArray(clientService.service.udfDefinitions)) {
      clientService.service.udfDefinitions.forEach((field: any) => {
        if (field.type === 'date' && values[field.id]) {
          const date = new Date(values[field.id]);
          formattedValues[field.id] = date.toISOString().split('T')[0];
        } else {
          formattedValues[field.id] = values[field.id];
        }
      });
    }
    
    setUdfValues(formattedValues);
    setIsEditing(false);
  };

  if (!clientService.service?.udfDefinitions || !Array.isArray(clientService.service.udfDefinitions) || clientService.service.udfDefinitions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No service details defined for this service.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="font-medium text-sm flex items-center">
          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
          Service Details
        </h5>
        {!isEditing && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setIsEditing(true)}
            data-testid="button-edit-service-details"
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clientService.service.udfDefinitions.map((field: any) => (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              {field.name}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            
            {field.type === 'number' && (
              <Input
                type="number"
                value={udfValues[field.id] ?? ''}
                onChange={(e) => setUdfValues({ ...udfValues, [field.id]: e.target.value ? Number(e.target.value) : null })}
                placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
                disabled={!isEditing}
                data-testid={`input-service-detail-${field.id}`}
              />
            )}
            
            {field.type === 'date' && (
              <Input
                type="date"
                value={udfValues[field.id] ?? ''}
                onChange={(e) => setUdfValues({ ...udfValues, [field.id]: e.target.value })}
                disabled={!isEditing}
                data-testid={`input-service-detail-${field.id}`}
              />
            )}
            
            {field.type === 'boolean' && (
              <div className="flex items-center space-x-2 h-10">
                <Switch
                  checked={udfValues[field.id] ?? false}
                  onCheckedChange={(checked) => setUdfValues({ ...udfValues, [field.id]: checked })}
                  disabled={!isEditing}
                  data-testid={`switch-service-detail-${field.id}`}
                />
                <span className="text-sm text-muted-foreground">
                  {udfValues[field.id] ? 'Yes' : 'No'}
                </span>
              </div>
            )}
            
            {field.type === 'short_text' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={udfValues[field.id] ?? ''}
                    onChange={(e) => {
                      setUdfValues({ ...udfValues, [field.id]: e.target.value });
                      if (field.id === 'vat_number_auto') {
                        setVatValidationStatus(prev => ({
                          ...prev,
                          [field.id]: { status: 'unvalidated' }
                        }));
                      }
                    }}
                    placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
                    disabled={!isEditing}
                    className={field.id === 'vat_number_auto' && vatValidationStatus[field.id]?.status === 'invalid' ? 'border-red-500' : ''}
                    data-testid={`input-service-detail-${field.id}`}
                  />
                  
                  {field.id === 'vat_number_auto' && (
                    <>
                      {vatValidationStatus[field.id]?.status === 'validated' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" data-testid="icon-vat-validated" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>VAT Validated</p>
                            {vatValidationStatus[field.id]?.companyName && (
                              <p className="text-xs text-muted-foreground">{vatValidationStatus[field.id]?.companyName}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {vatValidationStatus[field.id]?.status === 'invalid' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" data-testid="icon-vat-invalid" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>VAT Number Invalid</p>
                            {vatValidationStatus[field.id]?.error && (
                              <p className="text-xs text-muted-foreground">{vatValidationStatus[field.id]?.error}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {vatValidationStatus[field.id]?.status === 'unvalidated' && udfValues[field.id] && (
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
                      
                      {vatValidationStatus[field.id]?.status === 'validating' && (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" data-testid="icon-vat-validating" />
                      )}
                      
                      {isEditing && udfValues[field.id] && vatValidationStatus[field.id]?.status !== 'validated' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleValidateVat(field.id)}
                          disabled={vatValidationStatus[field.id]?.status === 'validating'}
                          data-testid="button-validate-vat"
                        >
                          {vatValidationStatus[field.id]?.status === 'validating' ? 'Validating...' : 'Validate'}
                        </Button>
                      )}
                    </>
                  )}
                </div>
                
                {field.id === 'vat_number_auto' && vatValidationStatus[field.id]?.status === 'validated' && vatValidationStatus[field.id]?.companyName && (
                  <p className="text-xs text-green-600" data-testid="text-vat-company-name">
                    Registered to: {vatValidationStatus[field.id]?.companyName}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={updateServiceMutation.isPending}
            data-testid="button-cancel-service-details"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateServiceMutation.isPending}
            data-testid="button-save-service-details"
          >
            {updateServiceMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}
