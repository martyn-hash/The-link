import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StageChangeContent } from "./stage-change-content";

interface StageChangeModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StageChangeModal({
  projectId,
  open,
  onOpenChange,
}: StageChangeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Stage Change Details</DialogTitle>
        </DialogHeader>
        
        <StageChangeContent projectId={projectId} compact={false} />

        {/* Close Button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={() => onOpenChange(false)}
            data-testid="button-close-stage-change-detail"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
