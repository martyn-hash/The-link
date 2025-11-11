import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProjectMessaging from "@/components/ProjectMessaging";

interface MessagesModalProps {
  projectId: string;
  project: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MessagesModal({
  projectId,
  project,
  open,
  onOpenChange,
}: MessagesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Project Messages</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden px-6 pb-6">
          {open && <ProjectMessaging projectId={projectId} project={project} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
