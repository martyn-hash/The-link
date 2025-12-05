import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Mail, HelpCircle } from "lucide-react";
import ProjectMessaging from "@/components/ProjectMessaging";
import ClientCommsPanel from "@/components/ClientCommsPanel";
import { QueriesTab } from "@/components/queries/QueriesTab";

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
  const [activeTab, setActiveTab] = useState<string>("internal");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[80vw] h-[80vh] max-w-none overflow-hidden flex flex-col p-0"
        aria-label="Project Messages"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="border-b px-6 pt-6 pb-0">
            <TabsList className="grid w-full max-w-xl grid-cols-3">
              <TabsTrigger value="internal" className="gap-2" data-testid="tab-internal-messages">
                <MessageSquare className="w-4 h-4" />
                Internal Messages
              </TabsTrigger>
              <TabsTrigger value="queries" className="gap-2" data-testid="tab-queries">
                <HelpCircle className="w-4 h-4" />
                Queries
              </TabsTrigger>
              <TabsTrigger value="client" className="gap-2" data-testid="tab-client-comms">
                <Mail className="w-4 h-4" />
                Client Comms
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="internal" className="flex-1 overflow-hidden m-0 p-6">
            {open && activeTab === "internal" && (
              <ProjectMessaging projectId={projectId} project={project} />
            )}
          </TabsContent>

          <TabsContent value="queries" className="flex-1 overflow-hidden m-0 p-6">
            {open && activeTab === "queries" && (
              <QueriesTab projectId={projectId} clientId={project?.clientId} />
            )}
          </TabsContent>
          
          <TabsContent value="client" className="flex-1 overflow-hidden m-0">
            {open && activeTab === "client" && project?.clientId && (
              <ClientCommsPanel projectId={projectId} clientId={project.clientId} />
            )}
            {open && activeTab === "client" && !project?.clientId && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No client associated with this project
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
