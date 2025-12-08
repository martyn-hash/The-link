import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ViewMode } from "@/types/projects-page";

const MAX_VIEW_NAME_LENGTH = 50;

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newViewName: string;
  setNewViewName: (value: string) => void;
  viewMode: ViewMode;
  onSave: () => void;
  isSaving: boolean;
}

export function SaveViewDialog({
  open,
  onOpenChange,
  newViewName,
  setNewViewName,
  viewMode,
  onSave,
  isSaving,
}: SaveViewDialogProps) {
  const viewModeLabel = viewMode === "list" ? "List" : viewMode === "calendar" ? "Calendar" : viewMode === "kanban" ? "Kanban" : "Dashboard";

  const handleClose = (openState: boolean) => {
    if (!openState) {
      setNewViewName("");
    }
    onOpenChange(openState);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="dialog-save-view">
        <DialogHeader>
          <DialogTitle>Save Current View</DialogTitle>
          <DialogDescription>
            Save your current filters and view mode for quick access later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="view-name">View Name</Label>
            <Input
              id="view-name"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value.slice(0, MAX_VIEW_NAME_LENGTH))}
              placeholder="e.g., My Active Projects"
              maxLength={MAX_VIEW_NAME_LENGTH}
              data-testid="input-view-name"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {newViewName.length}/{MAX_VIEW_NAME_LENGTH} characters
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Current view mode: <strong>{viewModeLabel}</strong></p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            data-testid="button-cancel-save-view"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving}
            data-testid="button-confirm-save-view"
          >
            {isSaving ? "Saving..." : "Save View"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
