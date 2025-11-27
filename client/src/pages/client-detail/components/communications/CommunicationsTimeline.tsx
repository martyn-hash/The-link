import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageSquare, PhoneCall, Send, Mail, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  CommunicationFilterSelection, 
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
  const [selectedFilters, setSelectedFilters] = useState<CommunicationFilterSelection>(['all']);
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

  const { data: featureFlags } = useQuery<{ ringCentralLive: boolean; appIsLive: boolean }>({
    queryKey: ['/api/feature-flags'],
  });

  const emailThreads = emailThreadsData?.threads || [];
  const showMakeCall = featureFlags?.ringCentralLive ?? false;
  const showInstantMessage = featureFlags?.appIsLive ?? false;
  
  // Check if any contacts have actionable contact details
  const peopleWithMobile = useMemo(() => 
    (clientPeople || []).filter((cp: any) => 
      cp.person?.primaryPhone && cp.person.primaryPhone.trim() !== ''
    ), [clientPeople]
  );
  
  const peopleWithEmail = useMemo(() => 
    (clientPeople || []).filter((cp: any) => 
      cp.person?.primaryEmail && cp.person.primaryEmail.trim() !== ''
    ), [clientPeople]
  );
  
  const hasMobileContacts = peopleWithMobile.length > 0;
  const hasEmailContacts = peopleWithEmail.length > 0;
  
  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return '';
    return new Date(date as string | number | Date).toLocaleString();
  };
  
  const allItems: TimelineItem[] = [
    ...(communications || []).map((comm): TimelineItem => {
      const date = comm.loggedAt || comm.createdAt;
      return {
        kind: 'communication',
        id: comm.id,
        type: comm.type,
        sortDate: new Date(date as string | number | Date),
        displayDate: formatDate(date),
        subject: comm.subject,
        content: comm.content,
        projectId: comm.projectId,
        data: comm,
      };
    }),
    ...(messageThreads || []).map((thread): TimelineItem => {
      const date = thread.createdAt;
      return {
        kind: 'message_thread',
        id: thread.id,
        type: 'message_thread',
        sortDate: new Date(date),
        displayDate: formatDate(date),
        subject: thread.subject,
        content: thread.lastMessage?.content || '',
        projectId: undefined,
        messageCount: thread.messageCount,
        unreadCount: thread.unreadCount,
        attachmentCount: thread.attachmentCount,
        data: thread,
      };
    }),
    ...emailThreads.map((thread): TimelineItem => {
      const date = thread.lastMessageAt;
      return {
        kind: 'email_thread',
        id: thread.canonicalConversationId,
        type: 'email_thread',
        sortDate: new Date(date),
        displayDate: formatDate(date),
        subject: thread.subject || 'No Subject',
        content: thread.latestPreview || thread.subject || '',
        projectId: undefined,
        messageCount: thread.messageCount,
        participants: thread.participants,
        data: thread,
      };
    })
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  const filteredItems = allItems.filter(item => {
    if (selectedFilters.includes('all') || selectedFilters.length === 0) return true;
    
    return selectedFilters.some(filter => {
      if (filter === 'sms') return item.type === 'sms_sent' || item.type === 'sms_received';
      if (filter === 'email') return item.type === 'email_sent' || item.type === 'email_received';
      return item.type === filter;
    });
  });

  const handleViewCommunication = (communication: CommunicationWithRelations) => {
    setSelectedCommunication(communication);
    setIsViewingCommunication(true);
  };

  const handleViewMessageThread = (thread: MessageThread) => {
    setLocation(`/messages?thread=${thread.id}`);
  };

  const handleViewEmailThread = (thread: EmailThread) => {
    setSelectedEmailThreadId(thread.canonicalConversationId);
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
                {showMakeCall && (
                  <DropdownMenuItem onClick={() => setIsCallingPerson(true)} data-testid="menu-make-call">
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Make Call
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => setIsSendingSMS(true)} 
                  disabled={!hasMobileContacts}
                  data-testid="menu-send-sms"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send SMS
                  {!hasMobileContacts && <span className="ml-auto text-xs text-muted-foreground">(No mobiles)</span>}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setIsSendingEmail(true)} 
                  disabled={!hasEmailContacts}
                  data-testid="menu-send-email"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                  {!hasEmailContacts && <span className="ml-auto text-xs text-muted-foreground">(No emails)</span>}
                </DropdownMenuItem>
                {showInstantMessage && (
                  <DropdownMenuItem onClick={() => setIsCreatingMessage(true)} data-testid="menu-instant-message">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Instant Message
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setIsAddingCommunication(true)} data-testid="menu-add-communication">
                  <FileText className="h-4 w-4 mr-2" />
                  Add Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex gap-2">
              {showMakeCall && (
                <Button
                  onClick={() => setIsCallingPerson(true)}
                  size="sm"
                  variant="outline"
                  data-testid="button-make-call"
                >
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Make Call
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={() => setIsSendingSMS(true)}
                      size="sm"
                      variant="outline"
                      disabled={!hasMobileContacts}
                      data-testid="button-send-sms"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send SMS
                    </Button>
                  </span>
                </TooltipTrigger>
                {!hasMobileContacts && (
                  <TooltipContent>
                    <p>No contacts have a mobile phone number on their profile</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={() => setIsSendingEmail(true)}
                      size="sm"
                      variant="outline"
                      disabled={!hasEmailContacts}
                      data-testid="button-send-email"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                  </span>
                </TooltipTrigger>
                {!hasEmailContacts && (
                  <TooltipContent>
                    <p>No contacts have an email address on their profile</p>
                  </TooltipContent>
                )}
              </Tooltip>
              {showInstantMessage && (
                <Button
                  onClick={() => setIsCreatingMessage(true)}
                  size="sm"
                  variant="default"
                  data-testid="button-instant-message"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Instant Message
                </Button>
              )}
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
          selectedFilters={selectedFilters}
          onFilterChange={setSelectedFilters}
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
