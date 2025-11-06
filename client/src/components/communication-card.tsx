import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, PhoneCall, FileText, Send, Inbox, Mail, MessageSquare, UserIcon, Eye } from "lucide-react";

interface CommunicationCardProps {
  id: string;
  type: string;
  loggedAt: string | Date;
  createdAt?: string | Date;
  subject?: string | null;
  content?: string | null;
  user?: {
    firstName: string;
    lastName: string;
  } | null;
  createdBy?: string | null;
  projectId?: string | null;
  projectName?: string;
  messageCount?: number;
  unreadCount?: number;
  attachmentCount?: number;
  participants?: string[] | null;
  onView: () => void;
  onProjectClick?: () => void;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'phone_call':
      return <PhoneCall className="h-5 w-5" />;
    case 'note':
      return <FileText className="h-5 w-5" />;
    case 'sms_sent':
      return <Send className="h-5 w-5" />;
    case 'sms_received':
      return <Inbox className="h-5 w-5" />;
    case 'email_sent':
      return <Mail className="h-5 w-5" />;
    case 'email_received':
      return <Inbox className="h-5 w-5" />;
    case 'message_thread':
      return <MessageSquare className="h-5 w-5" />;
    case 'email_thread':
      return <Mail className="h-5 w-5" />;
    default:
      return <MessageSquare className="h-5 w-5" />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'phone_call':
      return 'Phone Call';
    case 'note':
      return 'Note';
    case 'sms_sent':
      return 'SMS Sent';
    case 'sms_received':
      return 'SMS Received';
    case 'email_sent':
      return 'Email Sent';
    case 'email_received':
      return 'Email Received';
    case 'message_thread':
      return 'Instant Message';
    case 'email_thread':
      return 'Email Thread';
    default:
      return 'Communication';
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'phone_call':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'note':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    case 'sms_sent':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'sms_received':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'email_sent':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'email_received':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
    case 'message_thread':
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
    case 'email_thread':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
};

export function CommunicationCard({
  id,
  type,
  loggedAt,
  createdAt,
  subject,
  content,
  user,
  createdBy,
  projectId,
  projectName,
  messageCount,
  unreadCount,
  attachmentCount,
  participants,
  onView,
  onProjectClick,
}: CommunicationCardProps) {
  const date = loggedAt ? new Date(loggedAt) : createdAt ? new Date(createdAt) : null;

  return (
    <Card className="w-full" data-testid={`communication-card-${id}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Icon, Badge, and Date */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                {getIcon(type)}
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <Badge 
                  variant="secondary" 
                  className={`${getTypeColor(type)} w-fit`}
                  data-testid={`badge-type-${id}`}
                >
                  {getTypeLabel(type)}
                </Badge>
                {date && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className="truncate">{date.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            {type === 'message_thread' ? (
              <>
                {subject && (
                  <div className="font-medium text-sm flex items-center gap-2">
                    {subject}
                    {attachmentCount && attachmentCount > 0 && (
                      <span className="inline-flex items-center text-xs text-muted-foreground">
                        📎 {attachmentCount}
                      </span>
                    )}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {messageCount || 0} message{(messageCount || 0) !== 1 ? 's' : ''}
                  {unreadCount && unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {unreadCount} unread
                    </Badge>
                  )}
                </div>
              </>
            ) : type === 'email_thread' ? (
              <>
                <div className="font-medium text-sm">
                  {subject || 'No Subject'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {messageCount || 0} message{(messageCount || 0) !== 1 ? 's' : ''}
                  {participants && participants.length > 0 && (
                    <span className="ml-2">• {participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </>
            ) : (
              <>
                {subject && <div className="font-medium text-sm">{subject}</div>}
                {content && (
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {content}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer: User and Project */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0 flex-1">
              <UserIcon className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {type === 'email_thread' ? (
                  participants && participants.length > 0 
                    ? `${participants.length} participant${participants.length !== 1 ? 's' : ''}`
                    : 'Email'
                ) : user ? (
                  `${user.firstName} ${user.lastName}`
                ) : createdBy ? (
                  `User ${createdBy}`
                ) : (
                  'System'
                )}
              </span>
            </div>

            {projectId && projectName ? (
              <button
                onClick={onProjectClick}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[40%]"
                data-testid={`link-project-${projectId}`}
              >
                {projectName}
              </button>
            ) : projectId ? (
              <span className="text-xs text-muted-foreground">Project</span>
            ) : null}
          </div>

          {/* Action Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            className="w-full"
            data-testid={`button-view-${id}`}
          >
            <Eye className="h-4 w-4 mr-2" />
            {type === 'message_thread' || type === 'email_thread' ? 'View Thread' : 'View Details'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
