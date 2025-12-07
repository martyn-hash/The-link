import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStageChangeConfig } from "@/hooks/change-status/useStageChangeConfig";
import { useStatusChangeMutations } from "@/hooks/change-status/useStatusChangeMutations";
import { useApprovalFormSchema } from "@/hooks/change-status/useApprovalFormSchema";
import { useCustomFields } from "@/hooks/change-status/useCustomFields";
import { useFileUpload } from "@/hooks/change-status/useFileUpload";
import { useQueriesManagement } from "@/hooks/change-status/useQueriesManagement";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TiptapEditor } from "@/components/TiptapEditor";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  AlertCircle, 
  Loader2, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  Equal,
  X,
  FileText,
  Paperclip,
  Mail,
  Bell,
  Users,
  Mic,
  MessageSquare,
  HelpCircle,
  Plus,
  CalendarIcon,
  Trash2,
  Upload
} from "lucide-react";
import { QueryBulkImport } from "@/components/queries/QueryBulkImport";
import { format } from "date-fns";
import { StageNotificationAudioRecorder } from "./StageNotificationAudioRecorder";
import type {
  ProjectWithRelations,
  User,
  KanbanStage,
  ChangeReason,
  ReasonCustomField,
  StageApproval,
  StageApprovalField,
  InsertStageApprovalResponse,
  StageChangeNotificationPreview,
  ClientValueNotificationPreview,
} from "@shared/schema";
import { ClientValueNotificationContent } from "./ClientValueNotificationContent";
import { StaffNotificationContent } from "./change-status/StaffNotificationContent";
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
  initialNewStatus?: string; // Pre-select a status (for drag-and-drop from kanban)
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

// Helper function to extract first name from various formats
const extractFirstName = (fullName: string): string => {
  if (!fullName) return "";
  
  // Handle "LASTNAME, Firstname" format (common in UK/formal systems)
  if (fullName.includes(",")) {
    const parts = fullName.split(",");
    if (parts.length >= 2) {
      const afterComma = parts[1].trim();
      return afterComma.split(/\s+/)[0] || "";
    }
  }
  
  // Handle "Firstname Lastname" format
  return fullName.split(/\s+/)[0] || "";
};

// Helper function to get sender name with robust fallbacks
const getSenderName = (user: User | null | undefined): string | undefined => {
  if (!user) return undefined;
  
  // Try firstName first
  if (user.firstName && user.firstName.trim()) {
    return user.firstName.trim();
  }
  
  // Try lastName if firstName empty
  if (user.lastName && user.lastName.trim()) {
    return extractFirstName(user.lastName);
  }
  
  // Fallback to email username (before the @)
  if (user.email) {
    const emailUsername = user.email.split('@')[0];
    // Capitalize first letter and handle common patterns like john.doe
    const namePart = emailUsername.split(/[._-]/)[0];
    if (namePart) {
      return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
    }
  }
  
  return undefined;
};

export default function ChangeStatusModal({
  isOpen,
  onClose,
  project,
  user,
  onStatusUpdated,
  initialNewStatus,
}: ChangeStatusModalProps) {
  const [newStatus, setNewStatus] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [notesHtml, setNotesHtml] = useState("");
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [notificationPreview, setNotificationPreview] = useState<StageChangeNotificationPreview | null>(null);
  const [clientNotificationPreview, setClientNotificationPreview] = useState<ClientValueNotificationPreview | null>(null);
  const [notificationType, setNotificationType] = useState<'staff' | 'client' | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // File upload management from custom hook
  const {
    selectedFiles,
    uploadedAttachments,
    isUploadingFiles,
    handleFilesSelected,
    handleRemoveFile,
    resetFileUpload,
  } = useFileUpload({ projectId: project.id });

  // Query management from custom hook
  const {
    showQueriesForm,
    pendingQueries,
    handleToggleQueriesForm,
    handleAddQueryRow,
    handleUpdateQuery,
    handleRemoveQuery,
    handleBulkImportQueries,
    resetQueries,
  } = useQueriesManagement();

  // Set initial new status when modal opens (for drag-and-drop)
  useEffect(() => {
    if (isOpen && initialNewStatus) {
      setNewStatus(initialNewStatus);
    }
  }, [isOpen, initialNewStatus]);

  // Stage change configuration from custom hook
  const {
    isLoading: configLoading,
    stages,
    getFilteredReasons,
    getSelectedStage,
    getSelectedReason,
    getCustomFields,
    getEffectiveApprovalId,
    getTargetStageApproval,
    getTargetStageApprovalFields,
  } = useStageChangeConfig({
    projectId: project.id,
    isOpen,
  });

  // Derive data using hook functions
  const selectedStage = getSelectedStage(newStatus);
  const filteredReasons = useMemo(() => getFilteredReasons(selectedStage), [selectedStage, getFilteredReasons]);
  const selectedReasonObj = getSelectedReason(filteredReasons, changeReason);
  const customFields = getCustomFields(selectedReasonObj);

  // Custom field state management from custom hook
  const {
    customFieldResponses,
    validateCustomFields,
    handleCustomFieldChange,
    handleMultiSelectChange,
    formatFieldResponses,
    resetCustomFields,
  } = useCustomFields({ customFields });

  // Loading states for backward compatibility
  const stagesLoading = configLoading;
  const reasonsLoading = configLoading;
  const customFieldsLoading = configLoading;
  const stageApprovalsLoading = configLoading;
  const stageApprovalFieldsLoading = configLoading;

  // Determine effective approval ID (reason-level takes precedence over stage-level)
  const effectiveApprovalId = useMemo(
    () => getEffectiveApprovalId(selectedReasonObj, selectedStage),
    [selectedReasonObj, selectedStage, getEffectiveApprovalId]
  );

  // Get target stage approval and fields using effective approval ID
  const targetStageApproval = useMemo(
    () => getTargetStageApproval(effectiveApprovalId),
    [effectiveApprovalId, getTargetStageApproval]
  );

  const targetStageApprovalFields = useMemo(
    () => getTargetStageApprovalFields(targetStageApproval),
    [targetStageApproval, getTargetStageApprovalFields]
  );

  // Dynamic Zod schema for stage approval form from custom hook
  const { schema: approvalFormSchema } = useApprovalFormSchema({
    targetStageApprovalFields,
  });

  // Stage approval form
  const approvalForm = useForm<Record<string, any>>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: {},
  });

  // Determine if we should show approval form (using effective approval ID)
  useEffect(() => {
    const shouldShow =
      !!effectiveApprovalId &&
      !!newStatus &&
      !!changeReason &&
      !stageApprovalsLoading &&
      !stageApprovalFieldsLoading &&
      !!targetStageApproval &&
      targetStageApprovalFields.length > 0;

    setShowApprovalForm(shouldShow);
  }, [
    effectiveApprovalId,
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
      setNotesHtml("");
      resetCustomFields();
      setShowApprovalForm(false);
      resetQueries();
      approvalForm.reset();
      resetFileUpload();
    }
  }, [isOpen, approvalForm, resetCustomFields, resetFileUpload, resetQueries]);

  // Reset change reason and custom field responses when stage changes
  useEffect(() => {
    if (newStatus && selectedStage) {
      setChangeReason("");
      resetCustomFields();
    }
  }, [newStatus, selectedStage, resetCustomFields]);

  // Reset custom field responses when reason changes
  useEffect(() => {
    if (changeReason && selectedReasonObj) {
      resetCustomFields();
    }
  }, [changeReason, selectedReasonObj, resetCustomFields]);

  // Status change mutations from custom hook
  const mutations = useStatusChangeMutations({
    projectId: project.id,
    onStatusUpdateSuccess: (context) => {
      onStatusUpdated?.();
      if (context.clientNotificationPreview && context.notificationType === 'client') {
        setClientNotificationPreview(context.clientNotificationPreview);
        setNotificationType('client');
        setShowNotificationModal(true);
      } else if (context.staffNotificationPreview && context.notificationType === 'staff') {
        setNotificationPreview(context.staffNotificationPreview);
        setNotificationType('staff');
        setShowNotificationModal(true);
      } else {
        onClose();
      }
    },
    onClientNotificationSuccess: () => {
      setShowNotificationModal(false);
      setClientNotificationPreview(null);
      setNotificationType(null);
      onClose();
    },
    onStaffNotificationSuccess: () => {
      setShowNotificationModal(false);
      setNotificationPreview(null);
      setNotificationType(null);
      onClose();
    },
    getPendingQueries: () => pendingQueries,
    resetFormState: () => {
      setNewStatus("");
      setChangeReason("");
      setNotesHtml("");
      resetCustomFields();
      setShowApprovalForm(false);
      resetQueries();
      resetFileUpload();
    },
    notificationPreview,
    clientNotificationPreview,
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

  const handleSubmit = async () => {
    if (!newStatus || !changeReason) {
      showFriendlyError({ error: "Please select both a new stage and change reason" });
      return;
    }

    // Validate custom fields if they exist
    if (customFields.length > 0) {
      const fieldValidation = validateCustomFields();
      if (!fieldValidation.isValid) {
        showFriendlyError({ error: fieldValidation.errors.join(", ") });
        return;
      }
    }

    // If stage approval is required
    if (showApprovalForm && targetStageApproval && targetStageApprovalFields.length > 0) {
      // Validate approval form
      const isValid = await approvalForm.trigger();
      if (!isValid) {
        showFriendlyError({ error: "Please complete all required approval fields correctly" });
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

      mutations.submitApprovalResponses.mutate({
        responses,
        statusData: {
          newStatus,
          changeReason,
          stageId: selectedStage?.id,
          reasonId: selectedReasonObj?.id,
          notesHtml: notesHtml.trim() || undefined,
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
          fieldResponses: formatFieldResponses(),
        },
      });
    } else {
      // No stage approval required, proceed with normal status change
      mutations.updateStatus.mutate({
        newStatus,
        changeReason,
        stageId: selectedStage?.id,
        reasonId: selectedReasonObj?.id,
        notesHtml: notesHtml.trim() || undefined,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        fieldResponses: formatFieldResponses(),
      });
    }
  };

  const availableStatuses = getAvailableStatuses();
  const isSubmitting =
    mutations.updateStatus.isPending || mutations.submitApprovalResponses.isPending || isUploadingFiles;

  // Handle closing the entire modal (both stage change and notification)
  const handleFullClose = () => {
    setShowNotificationModal(false);
    setNotificationPreview(null);
    setClientNotificationPreview(null);
    setNotificationType(null);
    onClose();
  };

  // Determine modal size based on current view
  const getModalClassName = () => {
    if (showNotificationModal) return "max-w-4xl";
    if (showApprovalForm || showQueriesForm) return "max-w-6xl";
    return "max-w-2xl";
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleFullClose}>
      <DialogContent 
        className={getModalClassName()} 
        data-testid="dialog-change-status"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Show client notification content if stage change succeeded and there's a client preview */}
        {showNotificationModal && clientNotificationPreview && notificationType === 'client' ? (
          <>
            <DialogHeader>
              <DialogTitle data-testid="text-notification-title">Notify Client of Stage Change?</DialogTitle>
              <DialogDescription data-testid="text-notification-description">
                The stage has been updated successfully. Would you like to notify the client contacts?
              </DialogDescription>
            </DialogHeader>

            <ClientValueNotificationContent
              preview={clientNotificationPreview}
              projectId={project.id}
              onSend={async (editedData) => {
                await mutations.sendClientNotification.mutateAsync(editedData);
              }}
              onClose={handleFullClose}
              isSending={mutations.sendClientNotification.isPending}
              senderName={getSenderName(user)}
              onAiRefine={async (prompt, currentSubject, currentBody, context) => {
                const response = await fetch("/api/ai/refine-email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    projectId: project.id,
                    prompt,
                    currentSubject,
                    currentBody,
                    ...(context || {}),
                  }),
                  credentials: "include",
                });
                if (!response.ok) {
                  throw new Error("Failed to refine email");
                }
                const result = await response.json();
                return { subject: result.subject, body: result.body };
              }}
            />
          </>
        ) : showNotificationModal && notificationPreview && notificationType === 'staff' ? (
          <>
            <DialogHeader>
              <DialogTitle data-testid="text-notification-title">Send Stage Change Notification?</DialogTitle>
              <DialogDescription data-testid="text-notification-description">
                The stage has been updated successfully. Would you like to notify the assignees?
              </DialogDescription>
            </DialogHeader>

            <StaffNotificationContent
              preview={notificationPreview}
              projectId={project.id}
              onSend={async (editedData) => {
                await mutations.sendStaffNotification.mutateAsync(editedData);
              }}
              onClose={handleFullClose}
              isSending={mutations.sendStaffNotification.isPending}
              senderName={getSenderName(user)}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Change Project Status</DialogTitle>
              <DialogDescription>
                Move this project to a different stage in the workflow
              </DialogDescription>
            </DialogHeader>

        <div className={`max-h-[70vh] overflow-y-auto ${(showApprovalForm || showQueriesForm) ? "grid grid-cols-2 gap-6" : ""}`}>
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
                      <div>
                        <Label htmlFor={`custom-field-${field.id}`}>
                          {field.fieldName}
                          {field.isRequired && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                        {field.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {field.description}
                          </p>
                        )}
                      </div>

                      {field.fieldType === "boolean" && (
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`custom-field-${field.id}`}
                            checked={customFieldResponses[field.id] || false}
                            onCheckedChange={(checked) =>
                              handleCustomFieldChange(field.id, checked)
                            }
                            data-testid={`checkbox-custom-field-${field.id}`}
                          />
                          <Label htmlFor={`custom-field-${field.id}`} className="font-normal">
                            {customFieldResponses[field.id] ? "Yes" : "No"}
                          </Label>
                        </div>
                      )}

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
              <Label>Notes</Label>
              <TiptapEditor
                content={notesHtml}
                onChange={setNotesHtml}
                placeholder="Add notes explaining the status change..."
              />
            </div>

            {/* File Attachments - Compact Button */}
            <div className="flex items-center gap-3">
              <input
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    handleFilesSelected(files);
                  }
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
                id="stage-change-file-upload"
                data-testid="input-stage-change-file"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isUploadingFiles}
                onClick={() => document.getElementById('stage-change-file-upload')?.click()}
                data-testid="button-attach-file"
              >
                <Paperclip className="w-4 h-4 mr-2" />
                Attach
              </Button>
              {selectedFiles.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                </span>
              )}
              {isUploadingFiles && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Uploading...
                </span>
              )}
            </div>
            {selectedFiles.length > 0 && (
              <div className="space-y-1 mt-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm"
                    data-testid={`selected-file-${index}`}
                  >
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 truncate max-w-[200px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      onClick={() => handleRemoveFile(index)}
                      data-testid={`btn-remove-file-${index}`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Queries Button - only show when approval form is NOT shown */}
            {!showApprovalForm && (
              <div className="pt-2">
                <Separator className="mb-4" />
                <Button
                  type="button"
                  variant={showQueriesForm ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleToggleQueriesForm}
                  className="w-full"
                  data-testid="button-toggle-queries"
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  {showQueriesForm ? "Hide Queries" : "Add Queries"}
                  {pendingQueries.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {pendingQueries.length}
                    </Badge>
                  )}
                </Button>
              </div>
            )}
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

          {/* Right column: Add Queries form (conditional, mutually exclusive with approval) */}
          {showQueriesForm && !showApprovalForm && (
            <div className="space-y-4 border-l pl-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Add Queries</h3>
                  {pendingQueries.length > 0 && (
                    <Badge variant="secondary">{pendingQueries.length}</Badge>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowQueriesForm(false)}
                  className="h-6 w-6"
                  data-testid="button-close-queries"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Add transaction queries to be resolved. These will be saved with this stage change.
              </p>

              {/* Query Entry Table */}
              <div className="space-y-2">
                {pendingQueries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                    <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No queries added yet</p>
                    <p className="text-xs">Click the button below to add a query</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {pendingQueries.map((query, index) => (
                      <div 
                        key={query.id} 
                        className="p-3 bg-muted/30 rounded-lg space-y-3 relative"
                        data-testid={`query-row-${index}`}
                      >
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => handleRemoveQuery(query.id)}
                          data-testid={`button-remove-query-${index}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                          {/* Date Picker */}
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start text-left font-normal h-8 text-xs"
                                  data-testid={`button-date-${index}`}
                                >
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {query.date ? format(query.date, "dd MMM yy") : "Select"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={query.date || undefined}
                                  onSelect={(date) => handleUpdateQuery(query.id, "date", date)}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Amount (Money Out by default) */}
                          <div className="space-y-1">
                            <Label className="text-xs">Amount (£)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={query.moneyOut}
                              onChange={(e) => handleUpdateQuery(query.id, "moneyOut", e.target.value)}
                              className="h-8 text-xs"
                              data-testid={`input-amount-${index}`}
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input
                            placeholder="Transaction description..."
                            value={query.description}
                            onChange={(e) => handleUpdateQuery(query.id, "description", e.target.value)}
                            className="h-8 text-xs"
                            data-testid={`input-description-${index}`}
                          />
                        </div>

                        {/* Query */}
                        <div className="space-y-1">
                          <Label className="text-xs">Query</Label>
                          <Textarea
                            placeholder="What do you need to ask about this transaction?"
                            value={query.ourQuery}
                            onChange={(e) => handleUpdateQuery(query.id, "ourQuery", e.target.value)}
                            className="text-xs min-h-[60px]"
                            rows={2}
                            data-testid={`input-query-${index}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddQueryRow}
                    className="flex-1"
                    data-testid="button-add-query-row"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Row
                  </Button>
                  <QueryBulkImport
                    onImport={handleBulkImportQueries}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        data-testid="button-import-queries"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Import File
                      </Button>
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleFullClose}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
