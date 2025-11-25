import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FileText, Pencil } from "lucide-react";
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
              <Input
                type="text"
                value={udfValues[field.id] ?? ''}
                onChange={(e) => setUdfValues({ ...udfValues, [field.id]: e.target.value })}
                placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
                disabled={!isEditing}
                data-testid={`input-service-detail-${field.id}`}
              />
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
