import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, Equal, ChevronUp, ChevronDown } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { 
  StageApproval, 
  StageApprovalField, 
  InsertStageApprovalResponse
} from "@shared/schema";

interface StageApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  stageApproval: StageApproval;
  stageApprovalFields: StageApprovalField[];
  projectId: string;
  onSubmit: (responses: InsertStageApprovalResponse[]) => Promise<void>;
}

// Helper function to format comparison types for display
const formatComparisonType = (comparisonType: 'equal_to' | 'less_than' | 'greater_than'): string => {
  switch (comparisonType) {
    case 'equal_to':
      return 'equal to';
    case 'less_than':
      return 'less than';
    case 'greater_than':
      return 'greater than';
    default:
      return comparisonType;
  }
};

// Helper function to get comparison icon
const getComparisonIcon = (comparisonType: 'equal_to' | 'less_than' | 'greater_than') => {
  switch (comparisonType) {
    case 'equal_to':
      return <Equal className="h-4 w-4" />;
    case 'less_than':
      return <ChevronDown className="h-4 w-4" />;
    case 'greater_than':
      return <ChevronUp className="h-4 w-4" />;
    default:
      return null;
  }
};

export default function StageApprovalModal({
  isOpen,
  onClose,
  stageApproval,
  stageApprovalFields,
  projectId,
  onSubmit,
}: StageApprovalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Sort fields by order
  const sortedFields = useMemo(() => {
    return [...stageApprovalFields].sort((a, b) => a.order - b.order);
  }, [stageApprovalFields]);

  // Create dynamic Zod schema based on fields
  const formSchema = useMemo(() => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    sortedFields.forEach((field) => {
      if (field.fieldType === 'boolean') {
        // Boolean fields must match expected value exactly
        schemaFields[field.id] = z.boolean().refine(
          (value) => value === field.expectedValueBoolean,
          {
            message: `This field must be set to ${field.expectedValueBoolean ? 'Yes' : 'No'}`,
          }
        );
      } else if (field.fieldType === 'number') {
        // Number fields with comparison validation
        const baseNumberSchema = z.number({ 
          required_error: field.isRequired ? `${field.fieldName} is required` : undefined,
          invalid_type_error: "Must be a valid number" 
        });

        if (field.comparisonType && field.expectedValueNumber !== null && field.expectedValueNumber !== undefined) {
          const validatedSchema = baseNumberSchema.refine(
            (value) => {
              switch (field.comparisonType) {
                case 'equal_to':
                  return value === field.expectedValueNumber;
                case 'less_than':
                  return value < field.expectedValueNumber!;
                case 'greater_than':
                  return value > field.expectedValueNumber!;
                default:
                  return true;
              }
            },
            {
              message: `Must be ${formatComparisonType(field.comparisonType!)} ${field.expectedValueNumber}`,
            }
          );
          
          schemaFields[field.id] = field.isRequired ? validatedSchema : validatedSchema.optional();
        } else {
          schemaFields[field.id] = field.isRequired ? baseNumberSchema : baseNumberSchema.optional();
        }
      } else if (field.fieldType === 'long_text') {
        // Long text fields with required validation
        if (field.isRequired) {
          schemaFields[field.id] = z.string().min(1, `${field.fieldName} is required`);
        } else {
          schemaFields[field.id] = z.string().optional();
        }
      } else if (field.fieldType === 'multi_select') {
        // Multi-select fields with required validation
        if (field.isRequired) {
          schemaFields[field.id] = z.array(z.string()).min(1, `${field.fieldName} requires at least one selection`);
        } else {
          schemaFields[field.id] = z.array(z.string()).optional();
        }
      }
    });

    return z.object(schemaFields);
  }, [sortedFields]);

  // Set up default values
  const defaultValues = useMemo(() => {
    const values: Record<string, any> = {};
    sortedFields.forEach((field) => {
      if (field.fieldType === 'boolean') {
        values[field.id] = false; // Start with false, user needs to set to expected value
      } else if (field.fieldType === 'number') {
        values[field.id] = undefined;
      } else if (field.fieldType === 'long_text') {
        values[field.id] = '';
      } else if (field.fieldType === 'multi_select') {
        values[field.id] = []; // Start with empty array
      }
    });
    return values;
  }, [sortedFields]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onChange", // Validate on change for better UX
  });

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      // Convert form data to StageApprovalResponse format
      const responses: InsertStageApprovalResponse[] = sortedFields.map((field) => {
        const value = data[field.id];
        const baseResponse = {
          projectId: projectId,
          fieldId: field.id,
        };

        if (field.fieldType === 'boolean') {
          return {
            ...baseResponse,
            valueBoolean: value as boolean,
            valueNumber: null,
            valueLongText: null,
            valueMultiSelect: null,
          };
        } else if (field.fieldType === 'number') {
          return {
            ...baseResponse,
            valueBoolean: null,
            valueNumber: value !== undefined ? (value as number) : null,
            valueLongText: null,
            valueMultiSelect: null,
          };
        } else if (field.fieldType === 'long_text') {
          return {
            ...baseResponse,
            valueBoolean: null,
            valueNumber: null,
            valueLongText: value ? (value as string) : null,
            valueMultiSelect: null,
          };
        } else if (field.fieldType === 'multi_select') {
          return {
            ...baseResponse,
            valueBoolean: null,
            valueNumber: null,
            valueLongText: null,
            valueMultiSelect: Array.isArray(value) && value.length > 0 ? (value as string[]) : null,
          };
        }

        return {
          ...baseResponse,
          valueBoolean: null,
          valueNumber: null,
          valueLongText: null,
          valueMultiSelect: null,
        };
      }).filter((response) => {
        // Only include responses that have actual values
        return response.valueBoolean !== null || 
               response.valueNumber !== null || 
               response.valueLongText !== null ||
               response.valueMultiSelect !== null;
      });

      await onSubmit(responses);
      
      toast({
        title: "Success",
        description: "Stage approval completed successfully",
      });

      // Reset form and close modal
      form.reset();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit stage approval",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-hidden" 
        data-testid="modal-stage-approval"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {stageApproval.name}
          </DialogTitle>
          {stageApproval.description && (
            <DialogDescription className="text-base">
              {stageApproval.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {sortedFields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No approval fields configured for this stage.
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  {sortedFields.map((field, index) => (
                    <div key={field.id}>
                      {index > 0 && <Separator className="my-6" />}
                      
                      <FormField
                        control={form.control}
                        name={field.id}
                        render={({ field: formField }) => (
                          <FormItem>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-base font-medium">
                                  {field.fieldName}
                                  {field.isRequired && (
                                    <span className="text-destructive ml-1">*</span>
                                  )}
                                </FormLabel>
                                <Badge variant="outline" className="text-xs">
                                  {field.fieldType}
                                </Badge>
                              </div>

                              {/* Boolean Field */}
                              {field.fieldType === 'boolean' && (
                                <div className="space-y-3">
                                  <FormDescription className="flex items-center gap-2">
                                    {field.expectedValueBoolean ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-red-500" />
                                    )}
                                    This field must be set to: <strong>{field.expectedValueBoolean ? 'Yes' : 'No'}</strong>
                                  </FormDescription>
                                  <FormControl>
                                    <div className="flex items-center space-x-3">
                                      <Switch
                                        checked={formField.value || false}
                                        onCheckedChange={formField.onChange}
                                        data-testid={`switch-field-${field.id}`}
                                      />
                                      <Label className="text-sm">
                                        {formField.value ? 'Yes' : 'No'}
                                      </Label>
                                    </div>
                                  </FormControl>
                                </div>
                              )}

                              {/* Number Field */}
                              {field.fieldType === 'number' && (
                                <div className="space-y-3">
                                  {field.comparisonType && field.expectedValueNumber !== null && (
                                    <FormDescription className="flex items-center gap-2">
                                      {getComparisonIcon(field.comparisonType)}
                                      Must be {formatComparisonType(field.comparisonType)} <strong>{field.expectedValueNumber}</strong>
                                    </FormDescription>
                                  )}
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                                      value={formField.value ?? ''}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        formField.onChange(value === '' ? undefined : Number(value));
                                      }}
                                      data-testid={`input-field-${field.id}`}
                                    />
                                  </FormControl>
                                </div>
                              )}

                              {/* Long Text Field */}
                              {field.fieldType === 'long_text' && (
                                <div className="space-y-3">
                                  {field.isRequired && (
                                    <FormDescription>
                                      This field is required and cannot be empty.
                                    </FormDescription>
                                  )}
                                  <FormControl>
                                    <Textarea
                                      placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                                      value={formField.value ?? ''}
                                      onChange={formField.onChange}
                                      className="min-h-[100px]"
                                      data-testid={`textarea-field-${field.id}`}
                                    />
                                  </FormControl>
                                </div>
                              )}

                              {/* Multi-Select Field */}
                              {field.fieldType === 'multi_select' && (
                                <div className="space-y-3">
                                  {field.isRequired && (
                                    <FormDescription>
                                      Please select at least one option.
                                    </FormDescription>
                                  )}
                                  <FormControl>
                                    <div className="space-y-3 p-3 border rounded-md">
                                      {field.options && field.options.length > 0 ? (
                                        field.options.map((option, optionIndex) => {
                                          const currentValues = formField.value || [];
                                          const isChecked = currentValues.includes(option);
                                          
                                          return (
                                            <div key={`${field.id}-option-${optionIndex}`} className="flex items-center space-x-2">
                                              <Checkbox
                                                id={`${field.id}-option-${optionIndex}`}
                                                checked={isChecked}
                                                onCheckedChange={(checked) => {
                                                  const currentValues = formField.value || [];
                                                  const updatedValues = checked
                                                    ? [...currentValues, option]
                                                    : currentValues.filter((item: string) => item !== option);
                                                  formField.onChange(updatedValues);
                                                }}
                                                data-testid={`checkbox-field-${field.id}-option-${optionIndex}`}
                                              />
                                              <Label
                                                htmlFor={`${field.id}-option-${optionIndex}`}
                                                className="text-sm font-normal cursor-pointer"
                                              >
                                                {option}
                                              </Label>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="text-sm text-muted-foreground">
                                          No options available for this field.
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                </div>
                              )}

                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </form>
              </Form>
            )}
          </div>
        </ScrollArea>

        {sortedFields.length > 0 && (
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              data-testid="button-cancel-approval"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={form.handleSubmit(handleSubmit)}
              disabled={isSubmitting || !form.formState.isValid}
              data-testid="button-submit-approval"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Approval'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}