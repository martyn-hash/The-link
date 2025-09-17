import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import type { ProjectWithRelations, User, KanbanStage, ChangeReason } from "@shared/schema";

interface ProjectModalProps {
  project: ProjectWithRelations;
  user: User;
  isOpen: boolean;
  onClose: () => void;
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

export default function ProjectModal({ project, user, isOpen, onClose }: ProjectModalProps) {
  const [newStatus, setNewStatus] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch kanban stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<KanbanStage[]>({
    queryKey: ['/api/config/stages'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch change reasons
  const { data: changeReasons = [], isLoading: reasonsLoading } = useQuery<ChangeReason[]>({
    queryKey: ['/api/config/reasons'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { newStatus: string; changeReason: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/projects/${project.id}/status`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onClose();
      // Reset form
      setNewStatus("");
      setChangeReason("");
      setNotes("");
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

  const handleUpdateStatus = () => {
    if (!newStatus || !changeReason) {
      toast({
        title: "Validation Error",
        description: "Please select both a new stage and change reason",
        variant: "destructive",
      });
      return;
    }

    updateStatusMutation.mutate({
      newStatus,
      changeReason,
      notes: notes.trim() || undefined,
    });
  };

  const getTotalTimeInStage = (status: string) => {
    const entries = project.chronology?.filter(entry => entry.toStatus === status) || [];
    const totalMinutes = entries.reduce((sum, entry) => sum + (entry.timeInPreviousStage || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h`;
  };

  const getCurrentTimeInStage = () => {
    const lastEntry = project.chronology?.[0];
    if (!lastEntry || !lastEntry.timestamp) return "0h";
    
    const timeDiff = Date.now() - new Date(lastEntry.timestamp).getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" data-testid="project-modal">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {project.client.name} - {project.description}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Project Details */}
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-foreground mb-4">Project Details</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-medium" data-testid="text-client-name">{project.client.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bookkeeper:</span>
                  <span className="font-medium">
                    {project.bookkeeper.firstName} {project.bookkeeper.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client Manager:</span>
                  <span className="font-medium">
                    {project.clientManager.firstName} {project.clientManager.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Status:</span>
                  <Badge variant="outline" data-testid="text-current-status">
                    {formatStageName(project.currentStatus)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time in Current Stage:</span>
                  <span className="font-medium" data-testid="text-time-in-stage">
                    {getCurrentTimeInStage()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority:</span>
                  <Badge variant={project.priority === "urgent" ? "destructive" : "secondary"}>
                    {project.priority?.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Change Status */}
            {canUpdateStatus() && (
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
                    <Select value={changeReason} onValueChange={setChangeReason}>
                      <SelectTrigger data-testid="select-change-reason">
                        <SelectValue placeholder="Select reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        {changeReasons.map((reason) => (
                          <SelectItem key={reason.reason} value={reason.reason}>
                            {formatChangeReason(reason.reason)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
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
            )}
          </div>

          {/* Project Chronology */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Project Chronology</h4>
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {project.chronology?.map((entry, index) => {
                  // Helper function to format time duration
                  const formatDuration = (minutes: number | null) => {
                    if (!minutes || minutes === 0) return "0 days, 0 hours";
                    const days = Math.floor(minutes / (60 * 24));
                    const hours = Math.floor((minutes % (60 * 24)) / 60);
                    return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
                  };

                  return (
                    <div key={entry.id} className="border-l-2 border-primary pl-4 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {entry.fromStatus ? (
                            <div className="flex items-center space-x-2 text-sm">
                              <Badge variant="outline" className="text-xs">
                                {formatStageName(entry.fromStatus || '')}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge variant="default" className="text-xs">
                                {formatStageName(entry.toStatus)}
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="default" className="text-xs">
                              {formatStageName(entry.toStatus)}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {entry.timestamp ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true }) : 'Unknown'}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {/* Change Reason */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground font-medium">Reason:</span>
                          <Badge variant="secondary" className="text-xs">
                            {entry.changeReason ? formatChangeReason(entry.changeReason) : 'Not specified'}
                          </Badge>
                        </div>
                        
                        {/* Time in Previous Stage */}
                        {entry.fromStatus && entry.timeInPreviousStage !== null && (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-muted-foreground font-medium">Duration in previous stage:</span>
                            <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                              {formatDuration(entry.timeInPreviousStage)}
                            </span>
                          </div>
                        )}
                        
                        {/* Assignee Information */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground font-medium">
                            {entry.fromStatus ? "Assigned to:" : "Project created - Assigned to:"}
                          </span>
                          <span className="text-xs text-foreground">
                            {entry.assignee 
                              ? `${entry.assignee.firstName} ${entry.assignee.lastName}`
                              : "System"}
                          </span>
                        </div>
                      </div>

                      {entry.notes && (
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-xs text-muted-foreground italic">
                          "{entry.notes}"
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {!project.chronology?.length && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No chronology available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
