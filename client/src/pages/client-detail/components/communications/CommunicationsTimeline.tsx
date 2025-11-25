import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageSquare, PhoneCall, Send, Mail, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { EmailThreadViewer } from "@/components/EmailThreadViewer";
import { CommunicationFilters } from "./CommunicationFilters";
import { CommunicationList } from "./CommunicationList";
import {
  CreateMessageDialog,
  ViewCommunicationDialog,
  AddCommunicationDialog,
  SMSDialog,
  CallDialog,
  EmailDialog,
} from "./dialogs";
import type { 
  CommunicationWithRelations, 
  CommunicationFilterType, 
  TimelineItem, 
  EmailThread,
  MessageThread,
  PersonOption 
} from "./types";

interface CommunicationsTimelineProps {
  clientId: string;
  user: any;
}

export function CommunicationsTimeline({ clientId, user }: CommunicationsTimelineProps) {
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  
  const [isAddingCommunication, setIsAddingCommunication] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isCreatingMessage, setIsCreatingMessage] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<CommunicationWithRelations | null>(null);
  const [isViewingCommunication, setIsViewingCommunication] = useState(false);
  const [isCallingPerson, setIsCallingPerson] = useState(false);
  const [callPersonId, setCallPersonId] = useState<string | undefined>();
  const [callPhoneNumber, setCallPhoneNumber] = useState<string | undefined>();
  const [emailThreadViewerOpen, setEmailThreadViewerOpen] = useState(false);
  const [selectedEmailThreadId, setSelectedEmailThreadId] = useState<string | null>(null);
  const [commTypeFilter, setCommTypeFilter] = useState<CommunicationFilterType>('all');
  const [projectCache, setProjectCache] = useState<Record<string, any>>({});

  const { data: communications, isLoading } = useQuery<CommunicationWithRelations[]>({
    queryKey: ['/api/communications/client', clientId],
    enabled: !!clientId,
  });

  const { data: messageThreads, isLoading: isLoadingThreads } = useQuery<MessageThread[]>({
    queryKey: ['/api/internal/messages/threads/client', clientId],
    enabled: !!clientId,
  });

  const { data: emailThreadsData, isLoading: isLoadingEmailThreads } = useQuery<{
    threads: EmailThread[];
  }>({
    queryKey: ['/api/emails/client', clientId],
    enabled: !!clientId,
  });

  const { data: clientPeople } = useQuery<PersonOption[]>({
    queryKey: ['/api/clients', clientId, 'people'],
    enabled: !!clientId,
  });

  const emailThreads = emailThreadsData?.threads || [];
  const allItems: TimelineItem[] = [
    ...(communications || []).map(comm => ({
      id: comm.id,
      type: comm.type,
      loggedAt: comm.loggedAt,
      createdAt: comm.createdAt,
      subject: comm.subject,
      content: comm.content,
      user: comm.user ? { firstName: comm.user.firstName || '', lastName: comm.user.lastName || '' } : null,
      createdBy: comm.userId,
      projectId: comm.projectId,
      person: comm.person,
    })),
    ...(messageThreads || []).map(thread => ({
      id: thread.id,
      type: 'message_thread' as const,
      loggedAt: thread.createdAt,
      createdAt: thread.createdAt,
      subject: thread.subject,
      content: thread.lastMessage?.content || '',
      messageCount: thread.messageCount,
      unreadCount: thread.unreadCount,
      attachmentCount: thread.attachmentCount,
    })),
    ...emailThreads.map(thread => ({
      id: thread.canonicalConversationId,
      type: 'email_thread' as const,
      loggedAt: thread.lastMessageAt,
      createdAt: thread.firstMessageAt,
      subject: thread.subject || 'No Subject',
      content: thread.latestPreview || thread.subject || '',
      user: null,
      createdBy: null,
      projectId: null,
      messageCount: thread.messageCount,
      participants: thread.participants,
    }))
  ].sort((a, b) => 
    new Date((b.loggedAt || b.createdAt || 0) as string | number | Date).getTime() - 
    new Date((a.loggedAt || a.createdAt || 0) as string | number | Date).getTime()
  );

  const filteredItems = allItems.filter(item => {
    if (commTypeFilter === 'all') return true;
    if (commTypeFilter === 'sms') return item.type === 'sms_sent' || item.type === 'sms_received';
    if (commTypeFilter === 'email') return item.type === 'email_sent' || item.type === 'email_received';
    return item.type === commTypeFilter;
  });

  const handleViewCommunication = (communication: CommunicationWithRelations) => {
    setSelectedCommunication(communication);
    setIsViewingCommunication(true);
  };

  const handleViewMessageThread = (threadId: string) => {
    setLocation(`/messages?thread=${threadId}`);
  };

  const handleViewEmailThread = (threadId: string) => {
    setSelectedEmailThreadId(threadId);
    setEmailThreadViewerOpen(true);
  };

  const handleProjectClick = (projectId: string) => {
    setLocation(`/projects/${projectId}`);
  };

  if (isLoading || isLoadingThreads || isLoadingEmailThreads) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Communications Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <span className="hidden md:inline">Communications Timeline</span>
            <span className="md:hidden">Comms</span>
          </CardTitle>
          
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" data-testid="button-mobile-actions-menu">
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setIsCallingPerson(true)} data-testid="menu-make-call">
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Make Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsSendingSMS(true)} data-testid="menu-send-sms">
                  <Send className="h-4 w-4 mr-2" />
                  Send SMS
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsSendingEmail(true)} data-testid="menu-send-email">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsCreatingMessage(true)} data-testid="menu-instant-message">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Instant Message
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsAddingCommunication(true)} data-testid="menu-add-communication">
                  <FileText className="h-4 w-4 mr-2" />
                  Add Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={() => setIsCallingPerson(true)}
                size="sm"
                variant="outline"
                data-testid="button-make-call"
              >
                <PhoneCall className="h-4 w-4 mr-2" />
                Make Call
              </Button>
              <Button
                onClick={() => setIsSendingSMS(true)}
                size="sm"
                variant="outline"
                data-testid="button-send-sms"
              >
                <Send className="h-4 w-4 mr-2" />
                Send SMS
              </Button>
              <Button
                onClick={() => setIsSendingEmail(true)}
                size="sm"
                variant="outline"
                data-testid="button-send-email"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              <Button
                onClick={() => setIsCreatingMessage(true)}
                size="sm"
                variant="default"
                data-testid="button-instant-message"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Instant Message
              </Button>
              <Button
                onClick={() => setIsAddingCommunication(true)}
                size="sm"
                data-testid="button-add-communication"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Communication
              </Button>
            </div>
          )}
        </div>
        
        <CommunicationFilters
          filter={commTypeFilter}
          onFilterChange={setCommTypeFilter}
          items={allItems}
        />
      </CardHeader>
      
      <CardContent>
        <CommunicationList
          items={filteredItems}
          projectCache={projectCache}
          onViewCommunication={handleViewCommunication}
          onViewMessageThread={handleViewMessageThread}
          onViewEmailThread={handleViewEmailThread}
          onProjectClick={handleProjectClick}
        />
      </CardContent>

      <AddCommunicationDialog
        clientId={clientId}
        clientPeople={clientPeople || []}
        isOpen={isAddingCommunication}
        onClose={() => setIsAddingCommunication(false)}
      />

      <SMSDialog
        clientId={clientId}
        clientPeople={clientPeople || []}
        isOpen={isSendingSMS}
        onClose={() => setIsSendingSMS(false)}
      />

      <EmailDialog
        clientId={clientId}
        clientPeople={clientPeople || []}
        user={user}
        isOpen={isSendingEmail}
        onClose={() => setIsSendingEmail(false)}
      />

      <ViewCommunicationDialog
        communication={selectedCommunication}
        isOpen={isViewingCommunication}
        onClose={() => setIsViewingCommunication(false)}
      />

      <CreateMessageDialog
        clientId={clientId}
        isOpen={isCreatingMessage}
        onClose={() => setIsCreatingMessage(false)}
      />

      <CallDialog
        clientId={clientId}
        personId={callPersonId}
        phoneNumber={callPhoneNumber}
        isOpen={isCallingPerson}
        onClose={() => {
          setIsCallingPerson(false);
          setCallPersonId(undefined);
          setCallPhoneNumber(undefined);
        }}
      />

      <EmailThreadViewer
        threadId={selectedEmailThreadId}
        open={emailThreadViewerOpen}
        onOpenChange={setEmailThreadViewerOpen}
      />
    </Card>
  );
}
