import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, Clock, UserIcon } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StageChangeModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper function to format stage names for display (snake_case to Title Case)
const formatStageName = (stageName: string): string => {
  if (!stageName) return '';
  return stageName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to format change reason for display (snake_case to Title Case)
const formatChangeReason = (reason: string): string => {
  if (!reason) return '';
  return reason
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to format duration
const formatDuration = (totalMinutes: number | null) => {
  if (!totalMinutes || totalMinutes === 0) return "0m";
  
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ');
};

export function StageChangeModal({
  projectId,
  open,
  onOpenChange,
}: StageChangeModalProps) {
  // Fetch the most recent stage change
  const { data, isLoading } = useQuery<{
    entry: any;
    stageApprovalResponses: any[];
    projectTypeId: string;
  }>({
    queryKey: ['/api/projects', projectId, 'most-recent-stage-change'],
    enabled: open && !!projectId,
  });

  // Fetch config data for formatting and filtering
  const { data: stageApprovalFields, isLoading: isLoadingApprovalFields } = useQuery<any[]>({
    queryKey: ['/api/config/stage-approval-fields'],
    enabled: open,
  });

  const { data: changeReasons, isLoading: isLoadingReasons } = useQuery<any[]>({
    queryKey: ['/api/config/reasons'],
    enabled: open,
  });

  const { data: stages, isLoading: isLoadingStages } = useQuery<any[]>({
    queryKey: [`/api/config/project-types/${data?.projectTypeId}/stages`],
    enabled: open && !!data?.projectTypeId,
  });

  // Filter stage approval responses based on the change reason or stage
  // This matches the exact logic from project-chronology.tsx lines 140-186
  const filteredStageApprovalResponses = useMemo(() => {
    // Return null if data is still loading
    if (isLoadingApprovalFields || isLoadingReasons || isLoadingStages) {
      return null;
    }

    // Return empty array if no stage change is selected or required data is missing
    if (!data?.entry || !data.stageApprovalResponses || !stageApprovalFields || !stages || !changeReasons) {
      return [];
    }

    const entry = data.entry;

    // Determine which stage approval was required for this stage change
    let effectiveApprovalId: string | null = null;

    // First check if the change reason has an associated approval
    // Note: changeReason is stored as a string (e.g., "client_request"), not a UUID
    if (entry.changeReason) {
      const reason = changeReasons.find((r: any) => r.reason === entry.changeReason);
      if (reason?.stageApprovalId) {
        effectiveApprovalId = reason.stageApprovalId;
      }
    }

    // If no reason-level approval, check the stage itself
    // Note: toStatus is stored as a string (e.g., "in_progress"), not a UUID
    if (!effectiveApprovalId && entry.toStatus) {
      const stage = stages.find((s: any) => s.name === entry.toStatus);
      if (stage?.stageApprovalId) {
        effectiveApprovalId = stage.stageApprovalId;
      }
    }

    // If no approval was required, return empty array
    if (!effectiveApprovalId) {
      return [];
    }

    // Get the field IDs for this approval
    const approvalFieldIds = new Set(
      stageApprovalFields
        .filter((f: any) => f.stageApprovalId === effectiveApprovalId)
        .map((f: any) => f.id)
    );

    // Filter responses to only include those for this approval's fields
    return data.stageApprovalResponses.filter((r: any) => 
      approvalFieldIds.has(r.fieldId)
    );
  }, [data, stageApprovalFields, changeReasons, stages, isLoadingApprovalFields, isLoadingReasons, isLoadingStages]);

  const selectedStageChange = data?.entry;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stage Change Details</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading stage change details...
          </div>
        ) : !selectedStageChange ? (
          <div className="p-8 text-center text-muted-foreground">
            No stage changes found for this project
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header Information */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">Stage Transition</span>
                <div className="mt-2 flex items-center gap-3">
                  {selectedStageChange.fromStatus ? (
                    <>
                      <Badge variant="outline" className="text-sm" data-testid="modal-badge-from-stage">
                        {formatStageName(selectedStageChange.fromStatus)}
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="default" className="text-sm" data-testid="modal-badge-to-stage">
                        {formatStageName(selectedStageChange.toStatus)}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="default" className="text-sm" data-testid="modal-badge-created-stage">
                      Project created in {formatStageName(selectedStageChange.toStatus)}
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Timestamp</span>
                <div className="mt-1 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm" data-testid="text-modal-timestamp">
                    {selectedStageChange.timestamp 
                      ? format(new Date(selectedStageChange.timestamp), 'MMM d, yyyy h:mm a')
                      : 'Unknown time'}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Changed By</span>
                <div className="mt-1">
                  {selectedStageChange.changedBy ? (
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm" data-testid="text-modal-changed-by">
                        {selectedStageChange.changedBy.firstName} {selectedStageChange.changedBy.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground" data-testid="text-modal-system">System</span>
                  )}
                </div>
              </div>
              {selectedStageChange.assignee && (
                <div>
                  <span className="text-xs text-muted-foreground">Assigned To</span>
                  <div className="mt-1">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm" data-testid="text-modal-assignee">
                        {selectedStageChange.assignee.firstName} {selectedStageChange.assignee.lastName}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {selectedStageChange.timeInPreviousStage && (
                <div>
                  <span className="text-xs text-muted-foreground">Time in Previous Stage</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="text-modal-time">
                      {formatDuration(selectedStageChange.timeInPreviousStage)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Change Reason */}
            {selectedStageChange.changeReason && (
              <div>
                <span className="text-xs text-muted-foreground font-medium">Change Reason</span>
                <p className="text-sm font-medium mt-2" data-testid="text-modal-change-reason">
                  {formatChangeReason(selectedStageChange.changeReason)}
                </p>
              </div>
            )}

            {/* Notes */}
            {selectedStageChange.notes && (
              <div>
                <span className="text-xs text-muted-foreground font-medium">Notes</span>
                <div className="mt-2 p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-modal-notes">{selectedStageChange.notes}</p>
                </div>
              </div>
            )}

            {/* Change Reason Custom Field Responses */}
            {selectedStageChange.fieldResponses && selectedStageChange.fieldResponses.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Change Reason Questions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 p-4 bg-muted/30 rounded-lg">
                  {selectedStageChange.fieldResponses.map((response: any, index: number) => (
                    <div 
                      key={response.id || index} 
                      className={`space-y-1 ${index % 2 === 0 ? 'md:pr-6 md:border-r md:border-border' : 'md:pl-6'}`}
                      data-testid={`change-reason-response-${index}`}
                    >
                      <span className="text-xs text-muted-foreground font-medium">
                        {response.customField?.fieldName || 'Question'}
                      </span>
                      <div className="text-sm">
                        {response.fieldType === 'boolean' && (
                          <span>{response.valueBoolean ? 'Yes' : 'No'}</span>
                        )}
                        {response.fieldType === 'number' && (
                          <span>{response.valueNumber}</span>
                        )}
                        {response.fieldType === 'short_text' && (
                          <span>{response.valueShortText}</span>
                        )}
                        {response.fieldType === 'long_text' && (
                          <p className="whitespace-pre-wrap">{response.valueLongText}</p>
                        )}
                        {response.fieldType === 'multi_select' && (
                          <div className="flex flex-wrap gap-1">
                            {(response.valueMultiSelect || []).map((option: string, optIdx: number) => (
                              <Badge key={optIdx} variant="secondary" className="text-xs">
                                {option}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stage Approval Responses */}
            {filteredStageApprovalResponses === null ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Stage Approval Questions</h4>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading approval data...</p>
                </div>
              </div>
            ) : filteredStageApprovalResponses.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Stage Approval Questions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 p-4 bg-muted/30 rounded-lg">
                  {filteredStageApprovalResponses.map((response: any, index: number) => (
                    <div 
                      key={response.id || index} 
                      className={`space-y-1 ${index % 2 === 0 ? 'md:pr-6 md:border-r md:border-border' : 'md:pl-6'}`}
                      data-testid={`stage-approval-response-${index}`}
                    >
                      <span className="text-xs text-muted-foreground font-medium">
                        {response.field?.fieldName || 'Question'}
                      </span>
                      <div className="text-sm">
                        {response.field?.fieldType === 'boolean' && (
                          <span>{response.valueBoolean ? 'Yes' : 'No'}</span>
                        )}
                        {response.field?.fieldType === 'number' && (
                          <span>{response.valueNumber}</span>
                        )}
                        {response.field?.fieldType === 'long_text' && (
                          <p className="whitespace-pre-wrap">{response.valueLongText}</p>
                        )}
                        {response.field?.fieldType === 'multi_select' && (
                          <div className="flex flex-wrap gap-1">
                            {(response.valueMultiSelect || []).map((option: string, optIdx: number) => (
                              <Badge key={optIdx} variant="secondary" className="text-xs">
                                {option}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Stage Approval Questions</h4>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground" data-testid="text-no-approval-required">No stage approval required for this change</p>
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => onOpenChange(false)}
                data-testid="button-close-stage-change-detail"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
