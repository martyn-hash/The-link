import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Layers } from "lucide-react";
import type { ServiceWizardFormData, ServiceWithDetails } from "../types";

interface DisplaySettingsStepProps {
  formData: ServiceWizardFormData;
  updateFormData: (updates: Partial<ServiceWizardFormData>) => void;
  services: ServiceWithDetails[];
  isLoading: boolean;
}

export function DisplaySettingsStep({ formData, updateFormData, services, isLoading }: DisplaySettingsStepProps) {
  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    if (checked) {
      updateFormData({ priorityIndicatorTargets: [...formData.priorityIndicatorTargets, serviceId] });
    } else {
      updateFormData({ 
        priorityIndicatorTargets: formData.priorityIndicatorTargets.filter(id => id !== serviceId) 
      });
    }
  };

  const selectedCount = formData.priorityIndicatorTargets.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Display Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure how this service appears alongside other services
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Show in Other Services
              </CardTitle>
              <CardDescription>
                Display this service as a priority indicator on the selected services' project views
              </CardDescription>
            </div>
            {selectedCount > 0 && (
              <Badge variant="secondary" data-testid="badge-selected-indicators">
                {selectedCount} selected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No other services available.</p>
              <p className="text-sm">Create other services first to set up priority indicators.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((service) => {
                const isChecked = formData.priorityIndicatorTargets.includes(service.id);
                return (
                  <label
                    key={service.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                      isChecked
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    data-testid={`checkbox-indicator-${service.id}`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => handleServiceToggle(service.id, checked as boolean)}
                    />
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Layers className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{service.name}</div>
                      {service.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {service.description}
                        </div>
                      )}
                    </div>
                    {!service.isActive && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">What are priority indicators?</h4>
        <p className="text-sm text-muted-foreground">
          Priority indicators show the status of related services on project views. For example, if you're 
          viewing a "Annual Accounts" project, you might want to see if the client also has "VAT Returns" 
          due soon. Select which services should display this service as an indicator.
        </p>
      </div>
    </div>
  );
}
