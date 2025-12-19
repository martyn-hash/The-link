import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Save, X, Check, Loader2 } from "lucide-react";

interface WizardStep {
  id: number;
  name: string;
  icon: React.ElementType;
  shortName?: string;
}

interface WizardLayoutProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  title: string;
  subtitle?: string;
  mode: "create" | "edit" | "view";
  onSave?: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  canProceed?: boolean;
  canSave?: boolean;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

export function WizardLayout({
  steps,
  currentStep,
  onStepChange,
  title,
  subtitle,
  mode,
  onSave,
  onCancel,
  isSaving = false,
  canProceed = true,
  canSave = true,
  children,
  headerActions
}: WizardLayoutProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === steps.length;
  const isViewOnly = mode === "view";

  const handleNext = () => {
    if (currentStep < steps.length && canProceed) {
      onStepChange(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      onStepChange(currentStep - 1);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              data-testid="button-close-wizard"
            >
              <X className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {headerActions}
            
            <div className="hidden sm:flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = step.id === currentStep;
                const isCompleted = step.id < currentStep;
                
                return (
                  <div key={step.id} className="flex items-center">
                    {index > 0 && (
                      <div className={cn(
                        "w-8 h-0.5 mx-1",
                        isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                      )} />
                    )}
                    <button
                      onClick={() => onStepChange(step.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md transition-all",
                        isActive && "bg-primary text-primary-foreground shadow-sm",
                        !isActive && isCompleted && "text-primary hover:bg-primary/10",
                        !isActive && !isCompleted && "text-muted-foreground hover:bg-muted"
                      )}
                      data-testid={`wizard-step-${step.id}`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium hidden lg:inline">
                        {step.shortName || step.name}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex sm:hidden items-center gap-2 text-sm">
              <span className="font-medium">Step {currentStep}</span>
              <span className="text-muted-foreground">of {steps.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      <div className="border-t bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={isFirstStep}
            data-testid="button-prev-step"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              data-testid="button-cancel"
            >
              {isViewOnly ? "Close" : "Cancel"}
            </Button>

            {isLastStep ? (
              !isViewOnly && onSave && (
                <Button
                  onClick={onSave}
                  disabled={isSaving || !canSave}
                  data-testid="button-save"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {mode === "create" ? "Create" : "Save Changes"}
                    </>
                  )}
                </Button>
              )
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                data-testid="button-next-step"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
