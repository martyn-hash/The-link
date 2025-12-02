import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface BulkMoveStageConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stageNames: string[];
}

export function BulkMoveStageConflictDialog({ 
  isOpen, 
  onClose,
  stageNames 
}: BulkMoveStageConflictDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md" data-testid="bulk-move-stage-conflict-dialog">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-lg font-semibold">
              Cannot Bulk Move
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        
        <AlertDialogDescription className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            The selected projects are currently in different stages. Bulk moves only work when all 
            selected projects are in the same column.
          </p>
          
          {stageNames.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Selected projects are in:
              </p>
              <div className="flex flex-wrap gap-2">
                {stageNames.map((stage, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center rounded-md bg-background px-2 py-1 text-xs font-medium text-foreground border"
                  >
                    {stage}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            To bulk move projects, select only projects from a single column, then drag them together.
          </p>
        </AlertDialogDescription>
        
        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={onClose}
            data-testid="button-understood-stage-conflict"
          >
            Understood
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
