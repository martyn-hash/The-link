import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import type { ProjectWithRelations, User } from "@shared/schema";

interface ProjectModalProps {
  project: ProjectWithRelations;
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: "no_latest_action", label: "No Latest Action", assignedTo: "Client Manager" },
  { value: "bookkeeping_work_required", label: "Bookkeeping Work Required", assignedTo: "Bookkeeper" },
  { value: "in_review", label: "In Review", assignedTo: "Client Manager" },
  { value: "needs_client_input", label: "Needs Input from Client", assignedTo: "Client Manager" },
  { value: "completed", label: "Completed", assignedTo: "Project Status" },
];

const CHANGE_REASONS = [
  { value: "first_allocation_of_work", label: "First Allocation of Work" },
  { value: "errors_identified_from_bookkeeper", label: "Errors identified from Bookkeeper" },
  { value: "queries_answered", label: "Queries Answered" },
  { value: "work_completed_successfully", label: "Work Completed Successfully" },
  { value: "clarifications_needed", label: "Clarifications Needed" },
];

export default function ProjectModal({ project, user, isOpen, onClose }: ProjectModalProps) {
  const [newStatus, setNewStatus] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    // Filter statuses based on current status and user role
    const currentStatus = project.currentStatus;
    
    if (user.role === 'admin' || user.role === 'manager') {
      return STATUS_OPTIONS.filter(option => option.value !== currentStatus);
    }
    
    // Regular users can only move between certain statuses
    const allowedTransitions: Record<string, string[]> = {
      no_latest_action: ["bookkeeping_work_required", "in_review", "needs_client_input"],
      bookkeeping_work_required: ["in_review", "needs_client_input"],
      in_review: ["bookkeeping_work_required", "needs_client_input", "completed"],
      needs_client_input: ["bookkeeping_work_required", "in_review"],
      completed: [], // Can't move from completed
    };
    
    const allowed = allowedTransitions[currentStatus] || [];
    return STATUS_OPTIONS.filter(option => allowed.includes(option.value));
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
                    {STATUS_OPTIONS.find(s => s.value === project.currentStatus)?.label}
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
                        {CHANGE_REASONS.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
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
              <div className="space-y-3">
                {project.chronology?.map((entry, index) => (
                  <div key={entry.id} className="border-l-2 border-primary pl-4 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {STATUS_OPTIONS.find(s => s.value === entry.toStatus)?.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.timestamp ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true }) : 'Unknown'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {entry.fromStatus ? "Status changed" : "Project created"} - Assigned to{" "}
                      {entry.assignee 
                        ? `${entry.assignee.firstName} ${entry.assignee.lastName}`
                        : "System"}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>
                        {CHANGE_REASONS.find(r => r.value === entry.changeReason)?.label || entry.changeReason}
                      </span>
                      {entry.timeInPreviousStage !== null && (
                        <span>
                          {Math.floor((entry.timeInPreviousStage || 0) / 60)}h in previous stage
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        "{entry.notes}"
                      </p>
                    )}
                  </div>
                ))}
                
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
