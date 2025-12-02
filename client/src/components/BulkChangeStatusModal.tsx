import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  CheckCircle,
  AlertTriangle,
  Users
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  ProjectWithRelations,
  User,
} from "@shared/schema";

interface BulkChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectIds: string[];
  projects: ProjectWithRelations[];
  targetStatus: string;
  user: User;
  onStatusUpdated?: () => void;
  preValidatedReasons?: Array<{ id: string; reason: string }>;
}

const formatStageName = (stageName: string): string => {
  return stageName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const formatChangeReason = (reason: string): string => {
  return reason
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function BulkChangeStatusModal({
  isOpen,
  onClose,
  projectIds,
  projects,
  targetStatus,
  user,
  onStatusUpdated,
  preValidatedReasons = [],
}: BulkChangeStatusModalProps) {
  const [changeReason, setChangeReason] = useState("");
  const [notesHtml, setNotesHtml] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sourceStatus = projects[0]?.currentStatus;

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setChangeReason("");
      setNotesHtml("");
    }
  }, [isOpen]);

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: {
      projectIds: string[];
      newStatus: string;
      changeReason: string;
      notesHtml?: string;
    }) => {
      return await apiRequest("POST", `/api/projects/bulk-status`, data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: `${projectIds.length} project${projectIds.length !== 1 ? 's' : ''} moved to ${formatStageName(targetStatus)}`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onStatusUpdated?.();
      onClose();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleSubmit = () => {
    if (!changeReason) {
      return;
    }

    bulkUpdateMutation.mutate({
      projectIds,
      newStatus: targetStatus,
      changeReason,
      notesHtml: notesHtml.trim() || undefined,
    });
  };

  const canSubmit = changeReason && !bulkUpdateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" data-testid="bulk-change-status-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Move {projectIds.length} Project{projectIds.length !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            Moving from <span className="font-medium">{formatStageName(sourceStatus || "")}</span> to{" "}
            <span className="font-medium">{formatStageName(targetStatus)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <Label className="text-xs text-muted-foreground">Projects being moved:</Label>
            <div className="flex flex-wrap gap-1">
              {projects.slice(0, 5).map((project) => (
                <Badge key={project.id} variant="secondary" className="text-xs">
                  {project.client.name}
                </Badge>
              ))}
              {projects.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{projects.length - 5} more
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-reason">Change Reason</Label>
            <Select
              value={changeReason}
              onValueChange={setChangeReason}
            >
              <SelectTrigger id="change-reason" data-testid="select-change-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {preValidatedReasons.map((reason) => (
                  <SelectItem 
                    key={reason.id} 
                    value={reason.reason}
                    data-testid={`reason-option-${reason.reason}`}
                  >
                    {formatChangeReason(reason.reason)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (applied to all projects)</Label>
            <div className="border rounded-md" data-testid="editor-notes">
              <TiptapEditor
                content={notesHtml}
                onChange={setNotesHtml}
                placeholder="Add notes for this stage change..."
                editorHeight="100px"
              />
            </div>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Bulk Action</AlertTitle>
            <AlertDescription>
              This will move all {projectIds.length} selected projects to the same stage 
              with the same reason and notes. This action cannot be undone.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={bulkUpdateMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="button-confirm-bulk-move"
          >
            {bulkUpdateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Move {projectIds.length} Project{projectIds.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
