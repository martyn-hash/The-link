import type { Communication, Person, User } from "@shared/schema";

export type CommunicationFilterType = 'all' | 'phone_call' | 'sms' | 'email' | 'message_thread' | 'note' | 'email_thread';

export type CommunicationFilterSelection = CommunicationFilterType[];

export interface CommunicationWithRelations extends Communication {
  user: User;
  person?: Person | null;
  project?: { id: string; description: string | null } | null;
}

interface BaseTimelineDisplay {
  id: string;
  sortDate: Date;
  displayDate: string;
  subject?: string | null;
  content?: string | null;
  projectId?: string | null;
}

export interface CommunicationTimelineItem extends BaseTimelineDisplay {
  kind: 'communication';
  data: CommunicationWithRelations;
  type: string;
}

export interface MessageThreadTimelineItem extends BaseTimelineDisplay {
  kind: 'message_thread';
  data: MessageThread;
  type: 'message_thread';
  messageCount?: number;
  unreadCount?: number;
  attachmentCount?: number;
}

export interface EmailThreadTimelineItem extends BaseTimelineDisplay {
  kind: 'email_thread';
  data: EmailThread;
  type: 'email_thread';
  messageCount?: number;
  participants?: string[] | null;
}

export type TimelineItem = CommunicationTimelineItem | MessageThreadTimelineItem | EmailThreadTimelineItem;

export interface LegacyTimelineItem {
  id: string;
  type: string;
  loggedAt?: string | Date | null;
  createdAt?: string | Date | null;
  subject?: string | null;
  content?: string | null;
  user?: { firstName: string; lastName: string } | null;
  createdBy?: string | null;
  projectId?: string | null;
  messageCount?: number;
  unreadCount?: number;
  attachmentCount?: number;
  participants?: string[] | null;
  person?: Person | null;
}

export interface EmailThread {
  canonicalConversationId: string;
  subject: string | null;
  participants: string[] | null;
  firstMessageAt: string;
  lastMessageAt: string;
  messageCount: number;
  latestPreview: string | null;
  latestDirection: 'inbound' | 'outbound' | 'internal' | 'external' | null;
}

export interface MessageThread {
  id: string;
  subject: string;
  createdAt: string;
  lastMessage?: {
    content: string;
  };
  messageCount?: number;
  unreadCount?: number;
  attachmentCount?: number;
}

export interface PersonOption {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    primaryPhone?: string;
    primaryEmail?: string;
    telephone?: string;  // Fallback phone field
    email?: string;      // Fallback email field
  };
}

export interface DialogBaseProps {
  clientId: string;
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface SMSDialogProps extends DialogBaseProps {
  clientPeople: PersonOption[];
  /** Optional initial values for AI Magic integration */
  initialValues?: {
    personId?: string;
    message?: string;
  };
}

export interface ReminderScheduleItem {
  id: string;
  scheduledAt: string;
  channel: 'email' | 'sms' | 'voice';
  enabled: boolean;
}

export interface QueryEmailOptions {
  tokenId: string;
  queryIds: string[];
  queryCount: number;
  expiryDays: number;
  expiryDate?: string;
  recipientPhone?: string;
  /** Whether Voice AI is available for this project (based on project type settings + active webhooks) */
  voiceAiAvailable?: boolean;
}

export interface EmailDialogProps extends DialogBaseProps {
  clientPeople: PersonOption[];
  user: User | null;
  clientCompany?: string;
  /** Optional initial values for AI Magic integration */
  initialValues?: {
    recipientIds?: string[];
    subject?: string;
    content?: string;
    /** Structured content for protected HTML handling (query emails) */
    emailIntro?: string;
    protectedHtml?: string;
    emailSignoff?: string;
  };
  /** Query email mode - enables the 3-column layout with reminders */
  queryEmailOptions?: QueryEmailOptions;
  /** Callback when reminders are configured */
  onRemindersConfigured?: (reminders: ReminderScheduleItem[]) => void;
}

export interface AddCommunicationDialogProps extends DialogBaseProps {
  clientPeople: PersonOption[];
}

export interface ViewCommunicationDialogProps {
  communication: CommunicationWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface CallDialogProps {
  clientId?: string;
  projectId?: string;
  personId?: string;
  phoneNumber?: string;
  personName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export interface CreateMessageDialogProps extends DialogBaseProps {}

export interface CommunicationFiltersProps {
  selectedFilters: CommunicationFilterSelection;
  onFilterChange: (filters: CommunicationFilterSelection) => void;
  items: TimelineItem[];
}

export interface CommunicationListProps {
  items: TimelineItem[];
  projectCache: Record<string, any>;
  onViewCommunication: (communication: CommunicationWithRelations) => void;
  onViewMessageThread: (thread: MessageThread) => void;
  onViewEmailThread: (thread: EmailThread) => void;
  onProjectClick?: (projectId: string) => void;
}
