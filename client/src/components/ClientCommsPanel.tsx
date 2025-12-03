import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail,
  MessageCircle,
  Phone,
  User,
  Send,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SMSDialog } from '@/pages/client-detail/components/communications/dialogs/SMSDialog';
import { EmailDialog } from '@/pages/client-detail/components/communications/dialogs/EmailDialog';
import type { PersonOption } from '@/pages/client-detail/components/communications/types';

interface ClientCommsPanelProps {
  projectId: string;
  clientId: string;
}

interface Communication {
  id: string;
  type: string;
  subject: string | null;
  content: string;
  actualContactTime: string;
  loggedAt: string;
  user: {
    firstName: string | null;
    lastName: string | null;
  };
  person?: {
    fullName: string | null;
  } | null;
}

export default function ClientCommsPanel({ projectId, clientId }: ClientCommsPanelProps) {
  const { user } = useAuth();
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data: clientPeople, isLoading: isLoadingPeople } = useQuery<PersonOption[]>({
    queryKey: ['/api/clients', clientId, 'people'],
    enabled: !!clientId,
  });

  const { data: communications, isLoading: isLoadingComms } = useQuery<Communication[]>({
    queryKey: [`/api/projects/${projectId}/communications`],
    enabled: !!projectId,
  });

  const peopleWithMobile = useMemo(() => 
    (clientPeople || []).filter((cp: any) => {
      const phone = cp.person?.primaryPhone || cp.person?.telephone;
      return phone && phone.trim() !== '';
    }), [clientPeople]
  );

  const peopleWithEmail = useMemo(() => 
    (clientPeople || []).filter((cp: any) => {
      const email = cp.person?.primaryEmail || cp.person?.email;
      return email && email.trim() !== '';
    }), [clientPeople]
  );

  const hasMobileContacts = peopleWithMobile.length > 0;
  const hasEmailContacts = peopleWithEmail.length > 0;

  const getUserDisplayName = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return 'Unknown User';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email_sent':
      case 'email_received':
        return <Mail className="w-4 h-4" />;
      case 'sms_sent':
      case 'sms_received':
        return <MessageCircle className="w-4 h-4" />;
      case 'phone_call':
        return <Phone className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      email_sent: 'Email Sent',
      email_received: 'Email Received',
      sms_sent: 'SMS Sent',
      sms_received: 'SMS Received',
      phone_call: 'Phone Call',
      note: 'Note',
    };
    return labels[type] || type;
  };

  const isLoading = isLoadingPeople || isLoadingComms;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Client Communications</h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsSendingSMS(true)}
              disabled={!hasMobileContacts}
              data-testid="button-send-sms-project"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              SMS
            </Button>
            <Button
              size="sm"
              onClick={() => setIsSendingEmail(true)}
              disabled={!hasEmailContacts}
              data-testid="button-send-email-project"
            >
              <Mail className="w-4 h-4 mr-1" />
              Email
            </Button>
          </div>
        </div>

        {!hasMobileContacts && !hasEmailContacts && !isLoadingPeople && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <User className="w-4 h-4 inline mr-2" />
            No contacts with email or mobile numbers found for this client.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !communications || communications.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Send className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No communications yet for this project</p>
            <p className="text-sm mt-1">Send an email or SMS to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {communications.map((comm) => (
              <Card key={comm.id} className="overflow-hidden" data-testid={`comm-item-${comm.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(comm.type)}
                      <Badge variant="outline" className="text-xs">
                        {getTypeBadge(comm.type)}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comm.actualContactTime || comm.loggedAt), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {comm.subject && (
                    <h4 className="font-medium text-sm mb-1">{comm.subject}</h4>
                  )}
                  
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {comm.content?.replace(/<[^>]*>/g, '').substring(0, 150)}
                    {comm.content && comm.content.length > 150 ? '...' : ''}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>{getUserDisplayName(comm.user)}</span>
                    {comm.person?.fullName && (
                      <>
                        <span>→</span>
                        <span>{comm.person.fullName}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <SMSDialog
        clientId={clientId}
        projectId={projectId}
        clientPeople={clientPeople || []}
        isOpen={isSendingSMS}
        onClose={() => setIsSendingSMS(false)}
      />

      <EmailDialog
        clientId={clientId}
        projectId={projectId}
        clientPeople={clientPeople || []}
        user={user || null}
        isOpen={isSendingEmail}
        onClose={() => setIsSendingEmail(false)}
      />
    </div>
  );
}
