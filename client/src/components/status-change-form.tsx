import { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ProjectWithRelations, User, KanbanStage, ChangeReason, ReasonCustomField } from "@shared/schema";

interface StatusChangeFormProps {
  project: ProjectWithRelations;
  user: User;
  onStatusUpdated?: () => void;
}

// Helper function to format stage names for display
const formatStageName = (stageName: string): string => {
  return stageName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to format role names for display
const formatRoleName = (roleName: string | null): string => {
  if (!roleName) return "System";
  return roleName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to format change reason for display
const formatChangeReason = (reason: string): string => {
  return reason
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function StatusChangeForm({ project, user, onStatusUpdated }: StatusChangeFormProps) {
  const [newStatus, setNewStatus] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [notes, setNotes] = useState("");
  const [customFieldResponses, setCustomFieldResponses] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch kanban stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<KanbanStage[]>({
    queryKey: ['/api/config/stages'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Find the selected stage to get its ID
  const selectedStage = stages.find(stage => stage.name === newStatus);

  // Fetch filtered change reasons for the selected stage
  const { data: filteredReasons = [], isLoading: reasonsLoading, error: reasonsError } = useQuery<ChangeReason[]>({
    queryKey: [`/api/config/stages/${selectedStage?.id}/reasons`],
    enabled: !!selectedStage?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Find the selected reason to get its ID
  const selectedReasonObj = filteredReasons.find(reason => reason.reason === changeReason);

  // Fetch custom fields for the selected reason
  const { data: customFields = [], isLoading: customFieldsLoading, error: customFieldsError } = useQuery<ReasonCustomField[]>({
    queryKey: [`/api/config/reasons/${selectedReasonObj?.id}/custom-fields`],
    enabled: !!selectedReasonObj?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { 
      newStatus: string; 
      changeReason: string; 
      notes?: string;
      fieldResponses?: Array<{
        customFieldId: string;
        fieldType: 'number' | 'short_text' | 'long_text';
        valueNumber?: number;
        valueShortText?: string;
        valueLongText?: string;
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
      // Reset form
      setNewStatus("");
      setChangeReason("");
      setNotes("");
      setCustomFieldResponses({});
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project status",
        variant: "destructive",
      });
    },
  });

  const canUpdateStatus = () => {
    // Check if user has permission to update this project
    return (
      user.role === 'admin' ||
      user.role === 'manager' ||
      project.currentAssigneeId === user.id ||
      (user.role === 'client_manager' && project.clientManagerId === user.id) ||
      (user.role === 'bookkeeper' && project.bookkeeperId === user.id)
    );
  };

  const getAvailableStatuses = () => {
    if (stagesLoading || stages.length === 0) {
      return [];
    }
    
    // Filter statuses based on current status and user role
    const currentStatus = project.currentStatus;
    const currentStage = stages.find((s: KanbanStage) => s.name === currentStatus);
    
    // Convert stages to status options format
    const statusOptions = stages.map((stage) => ({
      value: stage.name,
      label: formatStageName(stage.name),
      assignedTo: formatRoleName(stage.assignedRole),
      stage: stage
    }));
    
    if (user.role === 'admin' || user.role === 'manager') {
      return statusOptions.filter(option => option.value !== currentStatus);
    }
    
    // Terminal stages - can't move from these
    const terminalStages = ['completed', 'not_completed_in_time'];
    if (terminalStages.includes(currentStatus)) {
      return []; // Can't move from terminal stages
    }
    
    // Regular users can only move between certain statuses
    const allowedTransitions: Record<string, string[]> = {
      no_latest_action: ["bookkeeping_work_required", "in_review", "needs_client_input"],
      bookkeeping_work_required: ["in_review", "needs_client_input"],
      in_review: ["bookkeeping_work_required", "needs_client_input", "completed", "not_completed_in_time"],
      needs_client_input: ["bookkeeping_work_required", "in_review"],
    };
    
    const allowed = allowedTransitions[currentStatus] || [];
    return statusOptions.filter(option => allowed.includes(option.value));
  };

  // Helper function to validate required custom fields
  const validateCustomFields = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const requiredFields = customFields.filter(field => field.isRequired);
    
    for (const field of requiredFields) {
      const response = customFieldResponses[field.id];
      if (!response || response === '' || response === null || response === undefined) {
        errors.push(`${field.fieldName} is required`);
      } else if (field.fieldType === 'number' && isNaN(Number(response))) {
        errors.push(`${field.fieldName} must be a valid number`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Helper function to handle custom field value changes
  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFieldResponses(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  // Convert custom field responses to API format
  const formatFieldResponses = () => {
    return customFields.map(field => {
      const value = customFieldResponses[field.id];
      const baseResponse = {
        customFieldId: field.id,
        fieldType: field.fieldType as 'number' | 'short_text' | 'long_text',
      };

      if (field.fieldType === 'number') {
        return { ...baseResponse, valueNumber: value ? Number(value) : undefined };
      } else if (field.fieldType === 'short_text') {
        return { ...baseResponse, valueShortText: value || undefined };
      } else if (field.fieldType === 'long_text') {
        return { ...baseResponse, valueLongText: value || undefined };
      }

      return baseResponse;
    }).filter(response => {
      // Type guard to check if response has any value field populated
      if ('valueNumber' in response && response.valueNumber !== undefined) return true;
      if ('valueShortText' in response && response.valueShortText !== undefined) return true;
      if ('valueLongText' in response && response.valueLongText !== undefined) return true;
      return false;
    });
  };

  const handleUpdateStatus = () => {
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
          description: fieldValidation.errors.join(', '),
          variant: "destructive",
        });
        return;
      }
    }

    // Prepare field responses
    const fieldResponses = customFields.length > 0 ? formatFieldResponses() : undefined;

    updateStatusMutation.mutate({
      newStatus,
      changeReason,
      notes: notes.trim() || undefined,
      fieldResponses,
    });
  };

  if (!canUpdateStatus()) {
    return (
      <div className="space-y-6">
        <div>
          <h4 className="font-semibold text-foreground mb-4">Status Controls</h4>
          <div className="text-sm text-muted-foreground p-4 bg-muted rounded">
            You don't have permission to update this project's status.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold text-foreground mb-4">Change Status</h4>
        <div className="space-y-4">
          <div>
            <Label htmlFor="new-status">Move to Stage:</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger data-testid="select-new-status">
                <SelectValue placeholder="Select new stage..." />
              </SelectTrigger>
              <SelectContent>
                {getAvailableStatuses().map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="change-reason">Change Reason:</Label>
            {!selectedStage ? (
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                Please select a stage first
              </div>
            ) : reasonsLoading ? (
              <div className="flex items-center gap-2 p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading reasons...</span>
              </div>
            ) : reasonsError ? (
              <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Failed to load reasons</span>
              </div>
            ) : filteredReasons.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                No change reasons available for this stage
              </div>
            ) : (
              <Select value={changeReason} onValueChange={setChangeReason}>
                <SelectTrigger data-testid="select-change-reason">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredReasons.map((reason) => (
                    <SelectItem key={reason.reason} value={reason.reason}>
                      {formatChangeReason(reason.reason)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Dynamic Custom Fields Form */}
          {selectedReasonObj && (
            <div className="space-y-4">
              {customFieldsLoading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading custom fields...</span>
                  </div>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ) : customFieldsError ? (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Failed to load custom fields</span>
                </div>
              ) : customFields.length > 0 ? (
                <div className="space-y-4">
                  <Separator />
                  <h5 className="font-medium text-foreground">Additional Information</h5>
                  {customFields
                    .sort((a, b) => a.order - b.order)
                    .map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={`custom-field-${field.id}`}>
                          {field.fieldName}
                          {field.isRequired && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                        {field.fieldType === 'number' ? (
                          <Input
                            id={`custom-field-${field.id}`}
                            type="number"
                            placeholder={field.placeholder || `Enter ${field.fieldName.toLowerCase()}`}
                            value={customFieldResponses[field.id] || ''}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                            data-testid={`input-custom-field-${field.id}`}
                            className={field.isRequired && (!customFieldResponses[field.id] || customFieldResponses[field.id] === '') 
                              ? 'border-destructive' : ''}
                          />
                        ) : field.fieldType === 'short_text' ? (
                          <Input
                            id={`custom-field-${field.id}`}
                            type="text"
                            placeholder={field.placeholder || `Enter ${field.fieldName.toLowerCase()}`}
                            value={customFieldResponses[field.id] || ''}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                            data-testid={`input-custom-field-${field.id}`}
                            className={field.isRequired && (!customFieldResponses[field.id] || customFieldResponses[field.id] === '') 
                              ? 'border-destructive' : ''}
                          />
                        ) : field.fieldType === 'long_text' ? (
                          <Textarea
                            id={`custom-field-${field.id}`}
                            placeholder={field.placeholder || `Enter ${field.fieldName.toLowerCase()}`}
                            value={customFieldResponses[field.id] || ''}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                            data-testid={`textarea-custom-field-${field.id}`}
                            className={`h-20 ${field.isRequired && (!customFieldResponses[field.id] || customFieldResponses[field.id] === '') 
                              ? 'border-destructive' : ''}`}
                          />
                        ) : null}
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          )}
          
          <div>
            <Label htmlFor="notes">Notes:</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes explaining the status change..."
              className="h-20"
              data-testid="textarea-notes"
            />
          </div>
          
          <Button
            onClick={handleUpdateStatus}
            disabled={updateStatusMutation.isPending || !newStatus || !changeReason}
            className="w-full"
            data-testid="button-update-status"
          >
            {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
          </Button>
        </div>
      </div>
    </div>
  );
}