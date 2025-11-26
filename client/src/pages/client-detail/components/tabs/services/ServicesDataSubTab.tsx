import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Save, Pencil, X, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UDFDefinition, Service, ClientService } from "@shared/schema";
import type { EnhancedClientService } from "../../../utils/types";

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
}

function ServiceDataCard({ clientService, onSave, isSaving }: ServiceDataCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const udfDefinitions = (clientService.service.udfDefinitions as UDFDefinition[] | null) || [];
  const currentValues = (clientService.udfValues as Record<string, any>) || {};

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
    
    await onSave(clientService.id, editedValues);
    setIsEditing(false);
    setEditedValues({});
  };

  const handleValueChange = (fieldId: string, value: any) => {
    setEditedValues((prev) => ({ ...prev, [fieldId]: value }));
    
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
            
            return (
              <div key={def.id} className="space-y-1.5">
                <Label className="text-sm font-medium">
                  {def.name}
                  {def.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {isEditing ? (
                  <UdfField
                    definition={def}
                    value={displayValue}
                    onChange={(value) => handleValueChange(def.id, value)}
                    disabled={isSaving}
                    error={errors[def.id]}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground p-2 bg-muted/30 rounded-md min-h-[2.5rem] flex items-center">
                    {def.type === "boolean" ? (
                      displayValue ? "Yes" : "No"
                    ) : def.type === "date" && displayValue ? (
                      new Date(displayValue).toLocaleDateString('en-GB')
                    ) : (
                      displayValue || <span className="text-muted-foreground/50 italic">Not set</span>
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
        />
      ))}
    </div>
  );
}
