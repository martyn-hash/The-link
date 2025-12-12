import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Mail, HelpCircle, StickyNote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import ProjectMessaging from "@/components/ProjectMessaging";
import ClientCommsPanel from "@/components/ClientCommsPanel";
import { QueriesTab } from "@/components/queries/QueriesTab";
import { NotesTab } from "@/pages/client-detail/components/tabs";

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
  const { user } = useAuth();
  
  // Fetch client people for email composition in QueriesTab
  const { data: clientPeople } = useQuery<any[]>({
    queryKey: [`/api/clients/${project?.clientId}/people`],
    enabled: !!project?.clientId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[80vw] h-[80vh] max-w-none overflow-hidden flex flex-col p-0"
        aria-label="Project Messages"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="border-b px-6 pt-6 pb-0">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
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
              <TabsTrigger value="notes" className="gap-2" data-testid="tab-notes">
                <StickyNote className="w-4 h-4" />
                Notes
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
              <QueriesTab 
                projectId={projectId} 
                clientId={project?.clientId}
                clientPeople={clientPeople}
                user={user}
                clientName={project?.client?.name}
              />
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

          <TabsContent value="notes" className="flex-1 overflow-hidden m-0 p-6">
            {open && activeTab === "notes" && project?.clientId && (
              <NotesTab 
                clientId={project.clientId}
                projectId={projectId}
                projectTypeId={project?.projectTypeId}
                mode="project"
              />
            )}
            {open && activeTab === "notes" && !project?.clientId && (
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
