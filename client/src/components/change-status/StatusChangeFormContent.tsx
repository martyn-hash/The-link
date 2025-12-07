import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TiptapEditor } from "@/components/TiptapEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, HelpCircle, ArrowRight } from "lucide-react";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { AttachmentsSection } from "./AttachmentsSection";
import type { ReasonCustomField, ChangeReason } from "@shared/schema";

interface StatusOption {
  value: string;
  label: string;
}

interface StatusChangeFormContentProps {
  newStatus: string;
  changeReason: string;
  notesHtml: string;
  onStatusChange: (status: string) => void;
  onReasonChange: (reason: string) => void;
  onNotesChange: (html: string) => void;
  availableStatuses: StatusOption[];
  filteredReasons: ChangeReason[];
  stagesLoading: boolean;
  reasonsLoading: boolean;
  customFields: ReasonCustomField[];
  customFieldResponses: Record<string, any>;
  onCustomFieldChange: (fieldId: string, value: any) => void;
  onMultiSelectChange: (fieldId: string, option: string, checked: boolean) => void;
  selectedFiles: File[];
  isUploadingFiles: boolean;
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  showApprovalForm: boolean;
  showQueriesForm: boolean;
  pendingQueriesCount: number;
  onToggleQueriesForm: () => void;
  formatChangeReason: (reason: string) => string;
  isPreselectedStage?: boolean;
  preselectedStageLabel?: string;
}

export function StatusChangeFormContent({
  newStatus,
  changeReason,
  notesHtml,
  onStatusChange,
  onReasonChange,
  onNotesChange,
  availableStatuses,
  filteredReasons,
  stagesLoading,
  reasonsLoading,
  customFields,
  customFieldResponses,
  onCustomFieldChange,
  onMultiSelectChange,
  selectedFiles,
  isUploadingFiles,
  onFilesSelected,
  onRemoveFile,
  showApprovalForm,
  showQueriesForm,
  pendingQueriesCount,
  onToggleQueriesForm,
  formatChangeReason,
  isPreselectedStage,
  preselectedStageLabel,
}: StatusChangeFormContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Status Change Details</h3>
        {!showApprovalForm && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onToggleQueriesForm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            data-testid="button-toggle-queries"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            {showQueriesForm ? "Hide Queries" : "Add Queries"}
            {pendingQueriesCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
                {pendingQueriesCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {isPreselectedStage && preselectedStageLabel ? (
        <div className="space-y-2">
          <Label>Move to Stage</Label>
          <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-md">
            <ArrowRight className="w-4 h-4 text-primary" />
            <span className="font-medium text-primary" data-testid="text-preselected-stage">
              {preselectedStageLabel}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="status-select">Move to Stage *</Label>
          {stagesLoading ? (
            <div className="h-10 bg-muted animate-pulse rounded" />
          ) : (
            <Select value={newStatus} onValueChange={onStatusChange}>
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
      )}

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
            <Select value={changeReason} onValueChange={onReasonChange}>
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

      {changeReason && customFields.length > 0 && (
        <CustomFieldsSection
          customFields={customFields}
          customFieldResponses={customFieldResponses}
          onFieldChange={onCustomFieldChange}
          onMultiSelectChange={onMultiSelectChange}
        />
      )}

      <div className="space-y-2">
        <Label>Notes</Label>
        <TiptapEditor
          content={notesHtml}
          onChange={onNotesChange}
          placeholder="Add notes explaining the status change..."
        />
      </div>

      <AttachmentsSection
        selectedFiles={selectedFiles}
        isUploadingFiles={isUploadingFiles}
        onFilesSelected={onFilesSelected}
        onRemoveFile={onRemoveFile}
      />
    </div>
  );
}
