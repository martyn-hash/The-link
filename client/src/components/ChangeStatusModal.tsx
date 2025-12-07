import { useState, useEffect, useMemo } from "react";
import { useStageChangeConfig } from "@/hooks/change-status/useStageChangeConfig";
import { useStatusChangeMutations } from "@/hooks/change-status/useStatusChangeMutations";
import { useApprovalFormSchema } from "@/hooks/change-status/useApprovalFormSchema";
import { useCustomFields } from "@/hooks/change-status/useCustomFields";
import { useFileUpload } from "@/hooks/change-status/useFileUpload";
import { useQueriesManagement } from "@/hooks/change-status/useQueriesManagement";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { formatStageName, formatChangeReason, getSenderName } from "@/lib/changeStatusUtils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { QueriesForm } from "@/components/change-status/QueriesForm";
import { StageApprovalForm } from "@/components/change-status/StageApprovalForm";
import { StatusChangeFormContent } from "@/components/change-status/StatusChangeFormContent";
import { StageNotificationAudioRecorder } from "./StageNotificationAudioRecorder";
import type {
  ProjectWithRelations,
  User,
  InsertStageApprovalResponse,
  StageChangeNotificationPreview,
  ClientValueNotificationPreview,
} from "@shared/schema";
import { ClientValueNotificationContent } from "./ClientValueNotificationContent";
import { StaffNotificationContent } from "./change-status/StaffNotificationContent";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectWithRelations;
  user: User;
  onStatusUpdated?: () => void;
  initialNewStatus?: string;
}

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
          <StatusChangeFormContent
            newStatus={newStatus}
            changeReason={changeReason}
            notesHtml={notesHtml}
            onStatusChange={setNewStatus}
            onReasonChange={setChangeReason}
            onNotesChange={setNotesHtml}
            availableStatuses={availableStatuses}
            filteredReasons={filteredReasons}
            stagesLoading={stagesLoading}
            reasonsLoading={reasonsLoading}
            customFields={customFields}
            customFieldResponses={customFieldResponses}
            onCustomFieldChange={handleCustomFieldChange}
            onMultiSelectChange={handleMultiSelectChange}
            selectedFiles={selectedFiles}
            isUploadingFiles={isUploadingFiles}
            onFilesSelected={handleFilesSelected}
            onRemoveFile={handleRemoveFile}
            showApprovalForm={showApprovalForm}
            showQueriesForm={showQueriesForm}
            pendingQueriesCount={pendingQueries.length}
            onToggleQueriesForm={handleToggleQueriesForm}
            formatChangeReason={formatChangeReason}
            isPreselectedStage={!!initialNewStatus}
            preselectedStageLabel={initialNewStatus ? formatStageName(initialNewStatus) : undefined}
          />

          {/* Right column: Stage approval form (conditional) */}
          {showApprovalForm && (
            <StageApprovalForm
              approvalForm={approvalForm}
              targetStageApprovalFields={targetStageApprovalFields}
            />
          )}

          {/* Right column: Add Queries form (conditional, mutually exclusive with approval) */}
          {showQueriesForm && !showApprovalForm && (
            <QueriesForm
              pendingQueries={pendingQueries}
              onAddQueryRow={handleAddQueryRow}
              onUpdateQuery={handleUpdateQuery}
              onRemoveQuery={handleRemoveQuery}
              onBulkImport={handleBulkImportQueries}
              onClose={() => handleToggleQueriesForm()}
            />
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
