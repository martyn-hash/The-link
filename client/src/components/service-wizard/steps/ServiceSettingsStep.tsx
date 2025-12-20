import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Settings, Building, Receipt, Pause } from "lucide-react";
import type { ServiceWizardFormData } from "../types";
import { CH_DATE_FIELD_OPTIONS } from "../types";

interface ServiceSettingsStepProps {
  formData: ServiceWizardFormData;
  updateFormData: (updates: Partial<ServiceWizardFormData>) => void;
  errors: string[];
}

export function ServiceSettingsStep({ formData, updateFormData, errors }: ServiceSettingsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Service Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure special features and integrations for this service
        </p>
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pause className="w-5 h-5" />
            Static Service
          </CardTitle>
          <CardDescription>
            Static services are display-only and don't have scheduling or deadlines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="static-service">Enable Static Service</Label>
              <p className="text-sm text-muted-foreground">
                Use for services like "Registered Office" that don't require recurring work
              </p>
            </div>
            <Switch
              id="static-service"
              checked={formData.isStaticService}
              onCheckedChange={(checked) => updateFormData({ isStaticService: checked })}
              data-testid="switch-static-service"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Companies House Integration
          </CardTitle>
          <CardDescription>
            Auto-populate dates from Companies House data when adding this service to a client
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ch-connected">Enable Companies House Integration</Label>
              <p className="text-sm text-muted-foreground">
                Automatically sync deadline dates from Companies House
              </p>
            </div>
            <Switch
              id="ch-connected"
              checked={formData.isCompaniesHouseConnected}
              onCheckedChange={(checked) => {
                updateFormData({ 
                  isCompaniesHouseConnected: checked,
                  ...(checked ? {} : { 
                    chStartDateField: "", 
                    chDueDateField: "", 
                    chTargetDeliveryDaysOffset: null 
                  })
                });
              }}
              data-testid="switch-ch-connected"
            />
          </div>

          {formData.isCompaniesHouseConnected && (
            <div className="pt-4 border-t space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ch-start-date">
                    Start Date Field <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.chStartDateField}
                    onValueChange={(value) => updateFormData({ chStartDateField: value })}
                  >
                    <SelectTrigger id="ch-start-date" data-testid="select-ch-start-date">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CH_DATE_FIELD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ch-due-date">
                    Due Date Field <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.chDueDateField}
                    onValueChange={(value) => updateFormData({ chDueDateField: value })}
                  >
                    <SelectTrigger id="ch-due-date" data-testid="select-ch-due-date">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CH_DATE_FIELD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ch-offset">Target Delivery Offset (days)</Label>
                <Input
                  id="ch-offset"
                  type="number"
                  min={0}
                  placeholder="e.g., 14"
                  value={formData.chTargetDeliveryDaysOffset ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateFormData({ 
                      chTargetDeliveryDaysOffset: value ? parseInt(value, 10) : null 
                    });
                  }}
                  data-testid="input-ch-offset"
                />
                <p className="text-xs text-muted-foreground">
                  How many days before the due date should work be completed?
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            VAT Integration
          </CardTitle>
          <CardDescription>
            Enable HMRC VAT number validation when adding this service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="vat-service">Enable VAT Integration</Label>
              <p className="text-sm text-muted-foreground">
                Validate VAT numbers against HMRC when clients are added to this service
              </p>
            </div>
            <Switch
              id="vat-service"
              checked={formData.isVatService}
              onCheckedChange={(checked) => updateFormData({ isVatService: checked })}
              data-testid="switch-vat-service"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
