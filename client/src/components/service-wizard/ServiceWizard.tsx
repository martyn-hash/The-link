import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, Save, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";
import type { WorkRole, Service, UdfDefinition } from "@shared/schema";
import { 
  ServiceWizardProps, 
  ServiceWizardFormData, 
  WIZARD_STEPS, 
  WizardStepId,
  DEFAULT_WIZARD_FORM_DATA,
  ServiceWithDetails,
} from "./types";
import { BasicDetailsStep } from "./steps/BasicDetailsStep";
import { ServiceSettingsStep } from "./steps/ServiceSettingsStep";
import { WorkRolesStep } from "./steps/WorkRolesStep";
import { DisplaySettingsStep } from "./steps/DisplaySettingsStep";
import { CustomFieldsStep } from "./steps/CustomFieldsStep";

function StepIndicator({ 
  step, 
  isActive, 
  isComplete,
  onClick,
  isClickable
}: { 
  step: typeof WIZARD_STEPS[number];
  isActive: boolean;
  isComplete: boolean;
  onClick: () => void;
  isClickable: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm",
        isActive && "bg-primary text-primary-foreground",
        isComplete && !isActive && "bg-primary/10 text-primary",
        !isActive && !isComplete && "text-muted-foreground",
        isClickable && !isActive && "hover:bg-muted cursor-pointer",
        !isClickable && "cursor-default"
      )}
      data-testid={`step-indicator-${step.id}`}
    >
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border",
        isActive && "bg-primary-foreground text-primary border-primary-foreground",
        isComplete && !isActive && "bg-primary text-primary-foreground border-primary",
        !isActive && !isComplete && "border-muted-foreground/50"
      )}>
        {isComplete && !isActive ? <Check className="w-3 h-3" /> : step.id}
      </div>
      <span className="hidden md:inline font-medium">{step.name}</span>
    </button>
  );
}

export function ServiceWizard({
  mode,
  initialData,
  onSave,
  onCancel,
  isSaving = false,
}: ServiceWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStepId>(1);
  const [formData, setFormData] = useState<ServiceWizardFormData>(() => {
    if (initialData) {
      return {
        id: initialData.id,
        name: initialData.name,
        description: initialData.description || "",
        applicableClientTypes: initialData.applicableClientTypes || "company",
        isStaticService: initialData.isStaticService || false,
        isCompaniesHouseConnected: initialData.isCompaniesHouseConnected || false,
        chStartDateField: initialData.chStartDateField || "",
        chDueDateField: initialData.chDueDateField || "",
        chTargetDeliveryDaysOffset: initialData.chTargetDeliveryDaysOffset ?? null,
        isVatService: initialData.isVatService || false,
        roleIds: initialData.roles?.map(r => r.id) || [],
        priorityIndicatorTargets: [],
        udfDefinitions: (initialData.udfDefinitions as UdfDefinition[]) || [],
        isActive: initialData.isActive !== false,
      };
    }
    return { ...DEFAULT_WIZARD_FORM_DATA };
  });

  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});

  const { data: workRoles = [], isLoading: rolesLoading } = useQuery<WorkRole[]>({
    queryKey: ["/api/work-roles"],
  });

  const { data: allServices = [], isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services"],
  });

  const { data: priorityIndicators = [] } = useQuery<{ targetServiceId: string }[]>({
    queryKey: [`/api/services/${initialData?.id}/priority-indicator-targets`],
    enabled: !!initialData?.id,
  });

  useEffect(() => {
    if (priorityIndicators.length > 0 && initialData?.id) {
      setFormData(prev => ({
        ...prev,
        priorityIndicatorTargets: priorityIndicators.map(p => p.targetServiceId),
      }));
    }
  }, [priorityIndicators, initialData?.id]);

  const otherServices = useMemo(() => 
    allServices.filter(s => s.id !== initialData?.id),
    [allServices, initialData?.id]
  );

  const updateFormData = useCallback((updates: Partial<ServiceWizardFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const validateStep = useCallback((step: WizardStepId): string[] => {
    const errors: string[] = [];
    
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          errors.push("Service name is required");
        }
        break;
      case 2:
        if (formData.isCompaniesHouseConnected) {
          if (!formData.chStartDateField) {
            errors.push("Start date field is required for Companies House integration");
          }
          if (!formData.chDueDateField) {
            errors.push("Due date field is required for Companies House integration");
          }
        }
        break;
    }
    
    return errors;
  }, [formData]);

  const canProceed = useMemo(() => {
    const errors = validateStep(currentStep);
    return errors.length === 0;
  }, [currentStep, validateStep]);

  const handleNext = useCallback(() => {
    const errors = validateStep(currentStep);
    if (errors.length > 0) {
      setStepErrors(prev => ({ ...prev, [currentStep]: errors }));
      return;
    }
    setStepErrors(prev => ({ ...prev, [currentStep]: [] }));
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as WizardStepId);
    }
  }, [currentStep, validateStep]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStepId);
    }
  }, [currentStep]);

  const handleStepClick = useCallback((stepId: WizardStepId) => {
    if (stepId < currentStep) {
      setCurrentStep(stepId);
    } else if (stepId === currentStep + 1 && canProceed) {
      handleNext();
    }
  }, [currentStep, canProceed, handleNext]);

  const handleSave = useCallback(() => {
    const allErrors: string[] = [];
    for (let step = 1; step <= 5; step++) {
      const errors = validateStep(step as WizardStepId);
      allErrors.push(...errors);
    }
    
    if (allErrors.length > 0) {
      setStepErrors({ 1: allErrors });
      return;
    }
    
    onSave(formData);
  }, [formData, onSave, validateStep]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <BasicDetailsStep
            formData={formData}
            updateFormData={updateFormData}
            errors={stepErrors[1] || []}
          />
        );
      case 2:
        return (
          <ServiceSettingsStep
            formData={formData}
            updateFormData={updateFormData}
            errors={stepErrors[2] || []}
          />
        );
      case 3:
        return (
          <WorkRolesStep
            formData={formData}
            updateFormData={updateFormData}
            workRoles={workRoles}
            isLoading={rolesLoading}
          />
        );
      case 4:
        return (
          <DisplaySettingsStep
            formData={formData}
            updateFormData={updateFormData}
            services={otherServices}
            isLoading={servicesLoading}
          />
        );
      case 5:
        return (
          <CustomFieldsStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="service-wizard">
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onCancel}
            data-testid="button-cancel-wizard"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-lg font-semibold">
              {mode === "create" ? "Create Service" : "Edit Service"}
            </h1>
            {formData.name && (
              <p className="text-sm text-muted-foreground">{formData.name}</p>
            )}
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-1">
          {WIZARD_STEPS.map((step) => (
            <StepIndicator
              key={step.id}
              step={step}
              isActive={currentStep === step.id}
              isComplete={currentStep > step.id}
              onClick={() => handleStepClick(step.id)}
              isClickable={step.id <= currentStep || (step.id === currentStep + 1 && canProceed)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:flex">
            Step {currentStep} of {WIZARD_STEPS.length}
          </Badge>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-service"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {mode === "create" ? "Create Service" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {renderStepContent()}
        </div>
      </div>

      <div className="border-t border-border bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            data-testid="button-previous-step"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex lg:hidden items-center gap-2">
            {WIZARD_STEPS.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  currentStep === step.id && "bg-primary",
                  currentStep > step.id && "bg-primary/50",
                  currentStep < step.id && "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          <Button
            onClick={handleNext}
            disabled={currentStep === 5}
            data-testid="button-next-step"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
