import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface StepItem {
  id: string;
  label: string;
  description?: string;
  status: "completed" | "current" | "pending" | "error";
  icon?: ReactNode;
}

interface StepProgressProps {
  steps: StepItem[];
  orientation?: "horizontal" | "vertical";
  onStepClick?: (stepId: string) => void;
  className?: string;
}

export function StepProgress({
  steps,
  orientation = "horizontal",
  onStepClick,
  className,
}: StepProgressProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <nav
      aria-label="Progress"
      className={cn(
        isHorizontal ? "w-full" : "min-h-full",
        className
      )}
    >
      <ol
        className={cn(
          "flex",
          isHorizontal
            ? "flex-row items-center justify-between"
            : "flex-col gap-0"
        )}
      >
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isClickable = onStepClick && step.status !== "pending";

          return (
            <li
              key={step.id}
              className={cn(
                "relative",
                isHorizontal ? "flex-1" : "pb-8 last:pb-0"
              )}
            >
              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute",
                    isHorizontal
                      ? "top-4 left-1/2 w-full h-0.5 -translate-y-1/2"
                      : "top-8 left-4 w-0.5 h-full -translate-x-1/2"
                  )}
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      "h-full w-full",
                      step.status === "completed"
                        ? "bg-primary"
                        : "bg-muted"
                    )}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.id)}
                disabled={!isClickable}
                className={cn(
                  "relative flex items-center group",
                  isHorizontal
                    ? "flex-col gap-2"
                    : "flex-row gap-4",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-default"
                )}
                data-testid={`step-${step.id}`}
              >
                {/* Step circle */}
                <span
                  className={cn(
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200",
                    step.status === "completed" && "bg-primary border-primary text-primary-foreground",
                    step.status === "current" && "bg-background border-primary text-primary ring-4 ring-primary/20",
                    step.status === "pending" && "bg-muted border-muted-foreground/30 text-muted-foreground",
                    step.status === "error" && "bg-destructive border-destructive text-destructive-foreground",
                    isClickable && step.status !== "current" && "group-hover:ring-2 group-hover:ring-primary/30"
                  )}
                >
                  {step.status === "completed" ? (
                    <Check className="h-4 w-4" />
                  ) : step.icon ? (
                    step.icon
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </span>

                {/* Step label */}
                <span
                  className={cn(
                    "text-sm font-medium transition-colors",
                    step.status === "completed" && "text-primary",
                    step.status === "current" && "text-foreground",
                    step.status === "pending" && "text-muted-foreground",
                    step.status === "error" && "text-destructive",
                    isHorizontal && "text-center max-w-[120px]",
                    !isHorizontal && "flex-1"
                  )}
                >
                  {step.label}
                  {step.description && !isHorizontal && (
                    <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                      {step.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface StepProgressCompactProps {
  current: number;
  total: number;
  labels?: string[];
  className?: string;
}

export function StepProgressCompact({
  current,
  total,
  labels,
  className,
}: StepProgressCompactProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              index < current
                ? "w-6 bg-primary"
                : index === current
                ? "w-8 bg-primary"
                : "w-2 bg-muted"
            )}
          />
        ))}
      </div>
      {labels && labels[current] && (
        <span className="text-sm text-muted-foreground ml-2">
          {labels[current]}
        </span>
      )}
    </div>
  );
}
