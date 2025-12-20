import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, FileText, Building2, User, Users } from "lucide-react";
import type { ServiceWizardFormData } from "../types";
import type { ServiceClientType } from "@shared/schema";

interface BasicDetailsStepProps {
  formData: ServiceWizardFormData;
  updateFormData: (updates: Partial<ServiceWizardFormData>) => void;
  errors: string[];
}

const CLIENT_TYPE_OPTIONS: { value: ServiceClientType; label: string; description: string; icon: typeof Building2 }[] = [
  { 
    value: "company", 
    label: "Company Only", 
    description: "Service applies to company clients only",
    icon: Building2
  },
  { 
    value: "individual", 
    label: "Individual Only", 
    description: "Service applies to individual clients only",
    icon: User
  },
  { 
    value: "both", 
    label: "Both", 
    description: "Service applies to both company and individual clients",
    icon: Users
  },
];

export function BasicDetailsStep({ formData, updateFormData, errors }: BasicDetailsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Basic Details</h2>
        <p className="text-muted-foreground mt-1">
          Enter the fundamental information about this service
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
            <FileText className="w-5 h-5" />
            Service Information
          </CardTitle>
          <CardDescription>
            Provide a name and description for the service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-name">
              Service Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="service-name"
              placeholder="e.g., Annual Accounts, VAT Returns, Payroll"
              value={formData.name}
              onChange={(e) => updateFormData({ name: e.target.value })}
              data-testid="input-service-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-description">Description</Label>
            <Textarea
              id="service-description"
              placeholder="Describe what this service includes..."
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              rows={3}
              data-testid="input-service-description"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Applicable Client Types
          </CardTitle>
          <CardDescription>
            Choose which type of clients can use this service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={formData.applicableClientTypes}
            onValueChange={(value: ServiceClientType) => 
              updateFormData({ applicableClientTypes: value })
            }
            className="space-y-3"
          >
            {CLIENT_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <label
                  key={option.value}
                  className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.applicableClientTypes === option.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  data-testid={`radio-client-type-${option.value}`}
                >
                  <RadioGroupItem value={option.value} />
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {option.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
