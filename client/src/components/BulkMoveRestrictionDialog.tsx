import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Bell, ClipboardCheck, FileText, Users } from "lucide-react";

interface BulkMoveRestrictionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetStageName: string;
  restrictions: string[];
  projectCount: number;
}

const formatStageName = (stageName: string): string => {
  return stageName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getRestrictionDetails = (restriction: string) => {
  switch (restriction) {
    case "stage_approval":
      return {
        icon: ClipboardCheck,
        title: "Stage Requires Approval",
        description: "This stage has approval requirements that need individual review for each project. Approvals ensure work quality and cannot be bypassed in bulk moves.",
      };
    case "client_notifications":
      return {
        icon: Bell,
        title: "Client Notifications Required",
        description: "This stage is configured to send notifications to clients. To ensure each client receives the appropriate personalised message, projects must be moved individually.",
      };
    case "all_reasons_have_requirements":
      return {
        icon: FileText,
        title: "All Reasons Require Custom Fields",
        description: "Every change reason for this stage requires additional information to be filled in. Projects must be moved individually to capture this data.",
      };
    default:
      return {
        icon: AlertCircle,
        title: "Bulk Move Not Available",
        description: "This stage has requirements that prevent bulk moves.",
      };
  }
};

export function BulkMoveRestrictionDialog({
  isOpen,
  onClose,
  targetStageName,
  restrictions,
  projectCount,
}: BulkMoveRestrictionDialogProps) {
  const primaryRestriction = restrictions[0];
  const details = getRestrictionDetails(primaryRestriction);
  const Icon = details.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid="bulk-move-restriction-dialog">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <Icon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center">
            Bulk Move Not Available
          </DialogTitle>
          <DialogDescription className="text-center">
            Moving to <span className="font-medium">{formatStageName(targetStageName)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h4 className="font-medium text-foreground">{details.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {details.description}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {projectCount} project{projectCount !== 1 ? "s" : ""} selected
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Please move each project individually by dragging them one at a time, or clear your selection and drag a single project.
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={onClose}
            className="w-full"
            data-testid="button-understood"
          >
            Understood
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
