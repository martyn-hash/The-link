import {
  Dialog,
  DialogContent,
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
      <DialogContent 
        className="w-[80vw] h-[80vh] max-w-none overflow-hidden flex flex-col p-6"
        aria-label="Project Messages"
      >
        <div className="flex-1 overflow-y-auto">
          {open && <ProjectMessaging projectId={projectId} project={project} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
