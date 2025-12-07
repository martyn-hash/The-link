import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Dashboard, ProjectView } from "@/types/projects-page";

interface DeleteViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewToDelete: ProjectView | null;
  onConfirmDelete: (viewId: string) => void;
}

export function DeleteViewDialog({
  open,
  onOpenChange,
  viewToDelete,
  onConfirmDelete,
}: DeleteViewDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="alert-delete-view">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete View</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this view? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete-view">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (viewToDelete) {
                onConfirmDelete(viewToDelete.id);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete-view"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardToDelete: Dashboard | null;
  onConfirmDelete: (dashboardId: string) => void;
}

export function DeleteDashboardDialog({
  open,
  onOpenChange,
  dashboardToDelete,
  onConfirmDelete,
}: DeleteDashboardDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="alert-delete-dashboard">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{dashboardToDelete?.name}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete-dashboard">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (dashboardToDelete) {
                onConfirmDelete(dashboardToDelete.id);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete-dashboard"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
