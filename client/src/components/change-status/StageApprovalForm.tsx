import { UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlertCircle, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  Equal 
} from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { StageApprovalField } from "@shared/schema";

interface StageApprovalFormProps {
  approvalForm: UseFormReturn<Record<string, any>>;
  targetStageApprovalFields: StageApprovalField[];
}

const formatComparisonType = (
  comparisonType: "equal_to" | "less_than" | "greater_than"
): string => {
  switch (comparisonType) {
    case "equal_to":
      return "equal to";
    case "less_than":
      return "less than";
    case "greater_than":
      return "greater than";
    default:
      return comparisonType;
  }
};

const getComparisonIcon = (
  comparisonType: "equal_to" | "less_than" | "greater_than"
) => {
  switch (comparisonType) {
    case "equal_to":
      return <Equal className="h-4 w-4" />;
    case "less_than":
      return <ChevronDown className="h-4 w-4" />;
    case "greater_than":
      return <ChevronUp className="h-4 w-4" />;
    default:
      return null;
  }
};

export function StageApprovalForm({
  approvalForm,
  targetStageApprovalFields,
}: StageApprovalFormProps) {
  return (
    <div className="space-y-4 border-l pl-6">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-sm">Stage Approval Required</h3>
        <Badge variant="secondary">Required</Badge>
      </div>

      <Form {...approvalForm}>
        <form className="space-y-6">
          {targetStageApprovalFields.map((field, index) => (
            <div key={field.id}>
              {index > 0 && <Separator className="my-4" />}

              <FormField
                control={approvalForm.control}
                name={field.id}
                render={({ field: formField }) => (
                  <FormItem>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <FormLabel className="text-base font-medium">
                            {field.fieldName}
                            {field.isRequired && (
                              <span className="text-destructive ml-1">*</span>
                            )}
                          </FormLabel>
                          {field.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {field.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {field.fieldType}
                        </Badge>
                      </div>

                      {field.fieldType === "boolean" && (
                        <div className="space-y-3">
                          <FormDescription className="flex items-center gap-2">
                            {field.expectedValueBoolean ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            This field must be set to:{" "}
                            <strong>
                              {field.expectedValueBoolean ? "Yes" : "No"}
                            </strong>
                          </FormDescription>
                          <FormControl>
                            <div className="flex items-center space-x-3">
                              <Switch
                                checked={formField.value || false}
                                onCheckedChange={formField.onChange}
                                data-testid={`switch-approval-${field.id}`}
                              />
                              <Label className="font-normal">
                                {formField.value ? "Yes" : "No"}
                              </Label>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </div>
                      )}

                      {field.fieldType === "number" && (
                        <div className="space-y-3">
                          {field.comparisonType &&
                            field.expectedValueNumber !== null && (
                              <FormDescription className="flex items-center gap-2">
                                {getComparisonIcon(field.comparisonType)}
                                Value must be{" "}
                                {formatComparisonType(field.comparisonType)}{" "}
                                <strong>{field.expectedValueNumber}</strong>
                              </FormDescription>
                            )}
                          <FormControl>
                            <Input
                              type="number"
                              {...formField}
                              onChange={(e) =>
                                formField.onChange(Number(e.target.value))
                              }
                              data-testid={`input-approval-${field.id}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </div>
                      )}

                      {field.fieldType === "long_text" && (
                        <div className="space-y-3">
                          <FormControl>
                            <Textarea
                              {...formField}
                              rows={4}
                              data-testid={`textarea-approval-${field.id}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </div>
                      )}

                      {field.fieldType === "multi_select" &&
                        field.options &&
                        field.options.length > 0 && (
                          <div className="space-y-3">
                            <FormControl>
                              <div className="space-y-2">
                                {field.options.map((option: string) => (
                                  <div
                                    key={option}
                                    className="flex items-center space-x-2"
                                  >
                                    <Checkbox
                                      checked={
                                        (formField.value as string[] | undefined)?.includes(option) ||
                                        false
                                      }
                                      onCheckedChange={(checked) => {
                                        const currentValue =
                                          (formField.value as string[]) || [];
                                        const updatedValue = checked
                                          ? [...currentValue, option]
                                          : currentValue.filter(
                                              (v: string) => v !== option
                                            );
                                        formField.onChange(updatedValue);
                                      }}
                                      data-testid={`checkbox-approval-${field.id}-${option}`}
                                    />
                                    <label className="text-sm font-normal">
                                      {option}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </div>
                        )}
                    </div>
                  </FormItem>
                )}
              />
            </div>
          ))}
        </form>
      </Form>
    </div>
  );
}
