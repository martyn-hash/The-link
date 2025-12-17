import { UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { 
  AlertCircle, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  Equal,
  Calendar as CalendarIcon,
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
import { cn } from "@/lib/utils";
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

const formatDateComparisonType = (
  comparisonType: "before" | "after" | "between" | "exact"
): string => {
  switch (comparisonType) {
    case "before":
      return "before";
    case "after":
      return "after";
    case "between":
      return "between";
    case "exact":
      return "exactly on";
    default:
      return comparisonType;
  }
};

const formatFieldTypeBadge = (fieldType: string): string => {
  switch (fieldType) {
    case "boolean":
      return "Yes/No";
    case "number":
      return "Number";
    case "short_text":
      return "Short Text";
    case "long_text":
      return "Long Text";
    case "single_select":
      return "Single Select";
    case "multi_select":
      return "Multi Select";
    case "date":
      return "Date";
    default:
      return fieldType;
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
                          {formatFieldTypeBadge(field.fieldType)}
                        </Badge>
                      </div>

                      {field.fieldType === "boolean" && (
                        <div className="space-y-3">
                          {field.expectedValueBoolean !== null && field.expectedValueBoolean !== undefined ? (
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
                          ) : (
                            <FormDescription className="text-muted-foreground">
                              Any value is accepted
                            </FormDescription>
                          )}
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

                      {field.fieldType === "short_text" && (
                        <div className="space-y-3">
                          <FormControl>
                            <Input
                              {...formField}
                              maxLength={255}
                              placeholder={field.placeholder || "Enter text..."}
                              data-testid={`input-short-text-approval-${field.id}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </div>
                      )}

                      {field.fieldType === "single_select" &&
                        field.options &&
                        field.options.length > 0 && (
                          <div className="space-y-3">
                            <FormControl>
                              <Select
                                onValueChange={formField.onChange}
                                value={formField.value || ""}
                              >
                                <SelectTrigger data-testid={`select-approval-${field.id}`}>
                                  <SelectValue placeholder={field.placeholder || "Select an option..."} />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.options.map((option: string) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </div>
                        )}

                      {field.fieldType === "date" && (
                        <div className="space-y-3">
                          {field.dateComparisonType && field.expectedDate && (
                            <FormDescription className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4" />
                              Date must be {formatDateComparisonType(field.dateComparisonType)}{" "}
                              <strong>{format(new Date(field.expectedDate), "PP")}</strong>
                              {field.dateComparisonType === "between" && field.expectedDateEnd && (
                                <> and <strong>{format(new Date(field.expectedDateEnd), "PP")}</strong></>
                              )}
                            </FormDescription>
                          )}
                          <FormControl>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !formField.value && "text-muted-foreground"
                                  )}
                                  data-testid={`date-approval-${field.id}`}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {formField.value ? (
                                    format(new Date(formField.value), "PPP")
                                  ) : (
                                    <span>{field.placeholder || "Pick a date"}</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={formField.value ? new Date(formField.value) : undefined}
                                  onSelect={(date) => formField.onChange(date?.toISOString())}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
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
