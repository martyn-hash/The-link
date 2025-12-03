import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Mail,
  MessageCircle,
  Phone,
  User,
  Send,
  Eye,
  Clock,
  FileText,
} from 'lucide-react';
import { SMSDialog } from '@/pages/client-detail/components/communications/dialogs/SMSDialog';
import { EmailDialog } from '@/pages/client-detail/components/communications/dialogs/EmailDialog';
import { ViewCommunicationDialog } from '@/pages/client-detail/components/communications/dialogs/ViewCommunicationDialog';
import type { PersonOption, CommunicationWithRelations } from '@/pages/client-detail/components/communications/types';
import type { User as UserType } from '@shared/schema';

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
  createdAt?: string;
  user: {
    id?: string;
    firstName: string | null;
    lastName: string | null;
  };
  person?: {
    id?: string;
    fullName: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  clientId?: string;
  projectId?: string;
  userId?: string;
}

export default function ClientCommsPanel({ projectId, clientId }: ClientCommsPanelProps) {
  const { user } = useAuth();
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<CommunicationWithRelations | null>(null);
  const [isViewingCommunication, setIsViewingCommunication] = useState(false);

  const { data: clientData } = useQuery<{ name: string }>({
    queryKey: ['/api/clients', clientId],
    enabled: !!clientId,
  });

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

  const getUserDisplayName = (commUser: any) => {
    if (commUser?.firstName && commUser?.lastName) {
      return `${commUser.firstName} ${commUser.lastName}`;
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
      case 'note':
        return <FileText className="w-4 h-4" />;
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

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      email_sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      email_received: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      sms_sent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      sms_received: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      phone_call: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      note: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const formatDateTime = (dateStr: string | undefined): string => {
    if (!dateStr) return 'No date';
    try {
      return new Date(dateStr).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const handleViewCommunication = (comm: Communication) => {
    // Create a communication object compatible with ViewCommunicationDialog
    // The dialog only needs: type, loggedAt, user.firstName/lastName, person.fullName, subject, content
    const commWithRelations = {
      id: comm.id,
      type: comm.type as 'email_sent' | 'email_received' | 'sms_sent' | 'sms_received' | 'phone_call' | 'note',
      subject: comm.subject,
      content: comm.content,
      actualContactTime: comm.actualContactTime ? new Date(comm.actualContactTime) : null,
      loggedAt: comm.loggedAt ? new Date(comm.loggedAt) : new Date(),
      createdAt: comm.createdAt ? new Date(comm.createdAt) : new Date(),
      clientId: comm.clientId || clientId,
      projectId: comm.projectId || projectId,
      personId: comm.person?.id || null,
      userId: comm.userId || '',
      updatedAt: null,
      user: {
        id: comm.user?.id || '',
        firstName: comm.user?.firstName || null,
        lastName: comm.user?.lastName || null,
      },
      person: comm.person ? {
        id: comm.person.id || '',
        fullName: comm.person.fullName || `${comm.person.firstName || ''} ${comm.person.lastName || ''}`.trim() || null,
      } : null,
    } as CommunicationWithRelations;
    setSelectedCommunication(commWithRelations);
    setIsViewingCommunication(true);
  };

  const isLoading = isLoadingPeople || isLoadingComms;

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
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
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md mt-4">
            <User className="w-4 h-4 inline mr-2" />
            No contacts with email or mobile numbers found for this client.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : !communications || communications.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Send className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No communications yet for this project</p>
            <p className="text-sm mt-1">Send an email or SMS to get started</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Subject/Content</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Connected To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {communications.map((comm) => (
                  <TableRow key={comm.id} data-testid={`comm-row-${comm.id}`}>
                    <TableCell data-testid={`cell-type-${comm.id}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          {getTypeIcon(comm.type)}
                        </div>
                        <Badge variant="secondary" className={getTypeColor(comm.type)} data-testid={`badge-type-${comm.id}`}>
                          {getTypeBadge(comm.type)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-date-${comm.id}`}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid={`text-date-${comm.id}`}>
                          {formatDateTime(comm.actualContactTime || comm.loggedAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-content-${comm.id}`}>
                      <div className="max-w-md">
                        {comm.subject && <div className="font-medium text-sm">{comm.subject}</div>}
                        <div className="text-xs text-muted-foreground truncate">
                          {comm.content?.replace(/<[^>]*>/g, '').substring(0, 50)}
                          {comm.content && comm.content.length > 50 ? '...' : ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-user-${comm.id}`}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid={`text-user-${comm.id}`}>
                          {getUserDisplayName(comm.user)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-connected-${comm.id}`}>
                      {comm.person?.fullName ? (
                        <span className="text-sm">{comm.person.fullName}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewCommunication(comm)}
                        data-testid={`button-view-${comm.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        clientCompany={clientData?.name}
      />

      <ViewCommunicationDialog
        communication={selectedCommunication}
        isOpen={isViewingCommunication}
        onClose={() => {
          setIsViewingCommunication(false);
          setSelectedCommunication(null);
        }}
      />
    </div>
  );
}
