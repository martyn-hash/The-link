import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Loader2, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  Equal 
} from "lucide-react";
import type {
  ProjectWithRelations,
  User,
  KanbanStage,
  ChangeReason,
  ReasonCustomField,
  StageApproval,
  StageApprovalField,
  InsertStageApprovalResponse,
} from "@shared/schema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectWithRelations;
  user: User;
  onStatusUpdated?: () => void;
}

// Helper function to format stage names for display
const formatStageName = (stageName: string): string => {
  return stageName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to format role names for display
const formatRoleName = (roleName: string | null): string => {
  if (!roleName) return "System";
  return roleName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to format change reason for display
const formatChangeReason = (reason: string): string => {
  return reason
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to format comparison types for display
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

// Helper function to get comparison icon
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

export default function ChangeStatusModal({
  isOpen,
  onClose,
  project,
  user,
  onStatusUpdated,
}: ChangeStatusModalProps) {
  const [newStatus, setNewStatus] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [notes, setNotes] = useState("");
  const [customFieldResponses, setCustomFieldResponses] = useState<Record<string, any>>({});
  const [showApprovalForm, setShowApprovalForm] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch kanban stages for this project's project type
  const { data: stages = [], isLoading: stagesLoading } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/project-types", project.projectTypeId, "stages"],
    enabled: !!project.projectTypeId && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Find the selected stage to get its ID
  const selectedStage = stages.find((stage) => stage.name === newStatus);

  // Fetch valid change reasons for the selected stage
  const { data: validStageReasons = [], isLoading: reasonsLoading } = useQuery<ChangeReason[]>({
    queryKey: ["/api/config/stages", selectedStage?.id, "reasons"],
    enabled: !!selectedStage?.id && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use the valid reasons directly from the API
  const filteredReasons = selectedStage ? validStageReasons : [];

  // Find the selected reason to get its ID
  const selectedReasonObj = filteredReasons.find(
    (reason) => reason.reason === changeReason
  );

  // Fetch custom fields for the selected reason
  const { data: customFields = [], isLoading: customFieldsLoading } = useQuery<
    ReasonCustomField[]
  >({
    queryKey: [`/api/config/reasons/${selectedReasonObj?.id}/custom-fields`],
    enabled: !!selectedReasonObj?.id && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch stage approvals for this project's project type
  const { data: stageApprovals = [], isLoading: stageApprovalsLoading } = useQuery<
    StageApproval[]
  >({
    queryKey: ["/api/config/project-types", project.projectTypeId, "stage-approvals"],
    enabled: !!project.projectTypeId && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch stage approval fields for the target stage's approval
  const { data: stageApprovalFields = [], isLoading: stageApprovalFieldsLoading } =
    useQuery<StageApprovalField[]>({
      queryKey: [`/api/config/stage-approval-fields`],
      enabled: !!selectedStage?.stageApprovalId && isOpen,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

  // Get target stage approval and fields
  const targetStageApproval = useMemo(() => {
    if (!selectedStage?.stageApprovalId) return null;
    return stageApprovals.find((a) => a.id === selectedStage.stageApprovalId) || null;
  }, [selectedStage, stageApprovals]);

  const targetStageApprovalFields = useMemo(() => {
    if (!targetStageApproval) return [];
    return stageApprovalFields
      .filter((field) => field.stageApprovalId === targetStageApproval.id)
      .sort((a, b) => a.order - b.order);
  }, [targetStageApproval, stageApprovalFields]);

  // Create dynamic Zod schema for stage approval form
  const approvalFormSchema = useMemo(() => {
    if (!targetStageApprovalFields.length) return z.object({});

    const schemaFields: Record<string, z.ZodTypeAny> = {};

    targetStageApprovalFields.forEach((field) => {
      if (field.fieldType === "boolean") {
        schemaFields[field.id] = z.boolean().refine(
          (value) => value === field.expectedValueBoolean,
          {
            message: `This field must be set to ${
              field.expectedValueBoolean ? "Yes" : "No"
            }`,
          }
        );
      } else if (field.fieldType === "number") {
        const baseNumberSchema = z.number({
          required_error: field.isRequired ? "This field is required" : undefined,
          invalid_type_error: "Please enter a valid number",
        });

        if (field.comparisonType && field.expectedValueNumber !== null) {
          schemaFields[field.id] = baseNumberSchema.refine(
            (value) => {
              switch (field.comparisonType) {
                case "equal_to":
                  return value === field.expectedValueNumber;
                case "less_than":
                  return value < field.expectedValueNumber!;
                case "greater_than":
                  return value > field.expectedValueNumber!;
                default:
                  return true;
              }
            },
            {
              message: `Value must be ${formatComparisonType(
                field.comparisonType
              )} ${field.expectedValueNumber}`,
            }
          );
        } else {
          schemaFields[field.id] = field.isRequired
            ? baseNumberSchema
            : baseNumberSchema.optional();
        }
      } else if (field.fieldType === "long_text") {
        schemaFields[field.id] = field.isRequired
          ? z.string().min(1, "This field is required")
          : z.string().optional();
      } else if (field.fieldType === "multi_select") {
        schemaFields[field.id] = field.isRequired
          ? z
              .array(z.string())
              .min(1, "Please select at least one option")
          : z.array(z.string()).optional();
      }
    });

    return z.object(schemaFields);
  }, [targetStageApprovalFields]);

  // Stage approval form
  const approvalForm = useForm<Record<string, any>>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: {},
  });

  // Determine if we should show approval form
  useEffect(() => {
    const shouldShow =
      !!selectedStage?.stageApprovalId &&
      !!newStatus &&
      !!changeReason &&
      !stageApprovalsLoading &&
      !stageApprovalFieldsLoading &&
      !!targetStageApproval &&
      targetStageApprovalFields.length > 0;

    setShowApprovalForm(shouldShow);
  }, [
    selectedStage,
    newStatus,
    changeReason,
    stageApprovalsLoading,
    stageApprovalFieldsLoading,
    targetStageApproval,
    targetStageApprovalFields,
  ]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNewStatus("");
      setChangeReason("");
      setNotes("");
      setCustomFieldResponses({});
      setShowApprovalForm(false);
      approvalForm.reset();
    }
  }, [isOpen, approvalForm]);

  // Reset change reason and custom field responses when stage changes
  useEffect(() => {
    if (newStatus && selectedStage) {
      setChangeReason("");
      setCustomFieldResponses({});
    }
  }, [newStatus, selectedStage]);

  // Reset custom field responses when reason changes
  useEffect(() => {
    if (changeReason && selectedReasonObj) {
      setCustomFieldResponses({});
    }
  }, [changeReason, selectedReasonObj]);

  // Mutation for submitting stage approval responses
  const submitApprovalResponsesMutation = useMutation({
    mutationFn: async (responses: InsertStageApprovalResponse[]) => {
      return await apiRequest("POST", `/api/projects/${project.id}/stage-approval-responses`, {
        responses,
      });
    },
    onSuccess: () => {
      // After successful approval submission, proceed with status change
      updateStatusMutation.mutate({
        newStatus,
        changeReason,
        notes: notes.trim() || undefined,
        fieldResponses: formatFieldResponses(),
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit stage approval",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: {
      newStatus: string;
      changeReason: string;
      notes?: string;
      fieldResponses?: Array<{
        customFieldId: string;
        fieldType: "number" | "short_text" | "long_text" | "multi_select";
        valueNumber?: number;
        valueShortText?: string;
        valueLongText?: string;
        valueMultiSelect?: string[];
      }>;
    }) => {
      return await apiRequest("PATCH", `/api/projects/${project.id}/status`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onStatusUpdated?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project status",
        variant: "destructive",
      });
    },
  });

  const getAvailableStatuses = () => {
    if (stagesLoading || stages.length === 0) {
      return [];
    }

    const currentStatus = project.currentStatus;

    const statusOptions = stages.map((stage) => ({
      value: stage.name,
      label: formatStageName(stage.name),
      stage: stage,
    }));

    return statusOptions.filter((option) => option.value !== currentStatus);
  };

  // Helper function to validate required custom fields
  const validateCustomFields = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const requiredFields = customFields.filter((field) => field.isRequired);

    for (const field of requiredFields) {
      const response = customFieldResponses[field.id];
      if (field.fieldType === "multi_select") {
        if (!response || !Array.isArray(response) || response.length === 0) {
          errors.push(
            `${field.fieldName} is required - please select at least one option`
          );
        }
      } else if (
        !response ||
        response === "" ||
        response === null ||
        response === undefined
      ) {
        errors.push(`${field.fieldName} is required`);
      } else if (field.fieldType === "number" && isNaN(Number(response))) {
        errors.push(`${field.fieldName} must be a valid number`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  // Helper function to handle custom field value changes
  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFieldResponses((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // Helper function to handle multi-select changes
  const handleMultiSelectChange = (
    fieldId: string,
    option: string,
    checked: boolean
  ) => {
    setCustomFieldResponses((prev) => {
      const currentValues = prev[fieldId] || [];
      const updatedValues = checked
        ? [...currentValues, option]
        : currentValues.filter((item: string) => item !== option);
      return {
        ...prev,
        [fieldId]: updatedValues,
      };
    });
  };

  // Convert custom field responses to API format
  const formatFieldResponses = () => {
    return customFields
      .map((field) => {
        const value = customFieldResponses[field.id];
        const baseResponse = {
          customFieldId: field.id,
          fieldType: field.fieldType as
            | "number"
            | "short_text"
            | "long_text"
            | "multi_select",
        };

        if (field.fieldType === "number") {
          return { ...baseResponse, valueNumber: value ? Number(value) : undefined };
        } else if (field.fieldType === "short_text") {
          return { ...baseResponse, valueShortText: value || undefined };
        } else if (field.fieldType === "long_text") {
          return { ...baseResponse, valueLongText: value || undefined };
        } else if (field.fieldType === "multi_select") {
          return {
            ...baseResponse,
            valueMultiSelect:
              Array.isArray(value) && value.length > 0 ? value : undefined,
          };
        }

        return baseResponse;
      })
      .filter((response) => {
        // Type guard to check if response has any value field populated
        if ("valueNumber" in response && response.valueNumber !== undefined) return true;
        if ("valueShortText" in response && response.valueShortText !== undefined)
          return true;
        if ("valueLongText" in response && response.valueLongText !== undefined)
          return true;
        if ("valueMultiSelect" in response && response.valueMultiSelect !== undefined)
          return true;
        return false;
      });
  };

  const handleSubmit = async () => {
    if (!newStatus || !changeReason) {
      toast({
        title: "Validation Error",
        description: "Please select both a new stage and change reason",
        variant: "destructive",
      });
      return;
    }

    // Validate custom fields if they exist
    if (customFields.length > 0) {
      const fieldValidation = validateCustomFields();
      if (!fieldValidation.isValid) {
        toast({
          title: "Validation Error",
          description: fieldValidation.errors.join(", "),
          variant: "destructive",
        });
        return;
      }
    }

    // If stage approval is required
    if (showApprovalForm && targetStageApproval && targetStageApprovalFields.length > 0) {
      // Validate approval form
      const isValid = await approvalForm.trigger();
      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please complete all required approval fields correctly",
          variant: "destructive",
        });
        return;
      }

      // Submit approval responses first
      const approvalData = approvalForm.getValues();
      const responses: InsertStageApprovalResponse[] = targetStageApprovalFields
        .map((field) => {
          const value = approvalData[field.id];
          const baseResponse = {
            projectId: project.id,
            fieldId: field.id,
          };

          if (field.fieldType === "boolean") {
            return { ...baseResponse, valueBoolean: value as boolean };
          } else if (field.fieldType === "number") {
            return { ...baseResponse, valueNumber: value as number };
          } else if (field.fieldType === "long_text") {
            return { ...baseResponse, valueLongText: value as string };
          } else if (field.fieldType === "multi_select") {
            return {
              ...baseResponse,
              valueMultiSelect: Array.isArray(value) && value.length > 0 ? value as string[] : undefined,
            };
          }

          return baseResponse;
        })
        .filter((response) => {
          // Filter out responses with no populated value field
          if ("valueBoolean" in response && response.valueBoolean !== undefined) return true;
          if ("valueNumber" in response && response.valueNumber !== undefined) return true;
          if ("valueLongText" in response && response.valueLongText !== undefined && response.valueLongText !== "") return true;
          if ("valueMultiSelect" in response && response.valueMultiSelect !== undefined && response.valueMultiSelect.length > 0) return true;
          return false;
        });

      submitApprovalResponsesMutation.mutate(responses);
    } else {
      // No stage approval required, proceed with normal status change
      updateStatusMutation.mutate({
        newStatus,
        changeReason,
        notes: notes.trim() || undefined,
        fieldResponses: formatFieldResponses(),
      });
    }
  };

  const availableStatuses = getAvailableStatuses();
  const isSubmitting =
    updateStatusMutation.isPending || submitApprovalResponsesMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={showApprovalForm ? "max-w-6xl" : "max-w-2xl"} data-testid="dialog-change-status">
        <DialogHeader>
          <DialogTitle>Change Project Status</DialogTitle>
          <DialogDescription>
            Move this project to a different stage in the workflow
          </DialogDescription>
        </DialogHeader>

        <div className={showApprovalForm ? "grid grid-cols-2 gap-6" : ""}>
          {/* Left column: Status change form */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Status Change Details</h3>

            {/* Stage Selector */}
            <div className="space-y-2">
              <Label htmlFor="status-select">Move to Stage *</Label>
              {stagesLoading ? (
                <div className="h-10 bg-muted animate-pulse rounded" />
              ) : (
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger id="status-select" data-testid="select-stage">
                    <SelectValue placeholder="Select new stage..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Change Reason */}
            {newStatus && (
              <div className="space-y-2">
                <Label htmlFor="reason-select">Change Reason *</Label>
                {reasonsLoading ? (
                  <div className="h-10 bg-muted animate-pulse rounded" />
                ) : filteredReasons.length === 0 ? (
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    No change reasons configured for this stage
                  </div>
                ) : (
                  <Select value={changeReason} onValueChange={setChangeReason}>
                    <SelectTrigger id="reason-select" data-testid="select-reason">
                      <SelectValue placeholder="Please select a stage first" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredReasons.map((reason) => (
                        <SelectItem key={reason.id} value={reason.reason}>
                          {formatChangeReason(reason.reason)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Custom Fields for Change Reason */}
            {changeReason && customFields.length > 0 && (
              <div className="space-y-4">
                <Separator />
                <div className="space-y-4">
                  {customFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={`custom-field-${field.id}`}>
                        {field.fieldName}
                        {field.isRequired && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>

                      {field.fieldType === "number" && (
                        <Input
                          id={`custom-field-${field.id}`}
                          type="number"
                          value={customFieldResponses[field.id] || ""}
                          onChange={(e) =>
                            handleCustomFieldChange(field.id, e.target.value)
                          }
                          placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                          data-testid={`input-custom-field-${field.id}`}
                        />
                      )}

                      {field.fieldType === "short_text" && (
                        <Input
                          id={`custom-field-${field.id}`}
                          type="text"
                          value={customFieldResponses[field.id] || ""}
                          onChange={(e) =>
                            handleCustomFieldChange(field.id, e.target.value)
                          }
                          placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                          data-testid={`input-custom-field-${field.id}`}
                        />
                      )}

                      {field.fieldType === "long_text" && (
                        <Textarea
                          id={`custom-field-${field.id}`}
                          value={customFieldResponses[field.id] || ""}
                          onChange={(e) =>
                            handleCustomFieldChange(field.id, e.target.value)
                          }
                          placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                          rows={3}
                          data-testid={`textarea-custom-field-${field.id}`}
                        />
                      )}

                      {field.fieldType === "multi_select" &&
                        field.options &&
                        field.options.length > 0 && (
                          <div className="space-y-2">
                            {field.options.map((option: string) => (
                              <div
                                key={option}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`${field.id}-${option}`}
                                  checked={
                                    customFieldResponses[field.id]?.includes(
                                      option
                                    ) || false
                                  }
                                  onCheckedChange={(checked) =>
                                    handleMultiSelectChange(
                                      field.id,
                                      option,
                                      checked as boolean
                                    )
                                  }
                                  data-testid={`checkbox-${field.id}-${option}`}
                                />
                                <label
                                  htmlFor={`${field.id}-${option}`}
                                  className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {option}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes-textarea">Notes</Label>
              <Textarea
                id="notes-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes explaining the status change..."
                rows={4}
                data-testid="textarea-notes"
              />
            </div>
          </div>

          {/* Right column: Stage approval form (conditional) */}
          {showApprovalForm && (
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

                              {/* Number Field */}
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

                              {/* Long Text Field */}
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

                              {/* Multi-Select Field */}
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
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="button-cancel-status-change"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !newStatus || !changeReason}
            data-testid="button-submit-status-change"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Status"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
