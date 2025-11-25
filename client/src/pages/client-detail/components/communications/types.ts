import type { Communication, Person, User } from "@shared/schema";

export type CommunicationFilterType = 'all' | 'phone_call' | 'sms' | 'email' | 'message_thread' | 'note' | 'email_thread';

export interface CommunicationWithRelations extends Communication {
  user: User;
  person?: Person | null;
}

export interface TimelineItem {
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
  };
}

export interface DialogBaseProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface SMSDialogProps extends DialogBaseProps {
  clientPeople: PersonOption[];
}

export interface EmailDialogProps extends DialogBaseProps {
  clientPeople: PersonOption[];
  user: User | null;
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
  clientId: string;
  personId?: string;
  phoneNumber?: string;
  isOpen: boolean;
  onClose: () => void;
}

export interface CreateMessageDialogProps extends DialogBaseProps {}

export interface CommunicationFiltersProps {
  filter: CommunicationFilterType;
  onFilterChange: (filter: CommunicationFilterType) => void;
  items: TimelineItem[];
}

export interface CommunicationListProps {
  items: TimelineItem[];
  projectCache: Record<string, any>;
  onViewCommunication: (item: CommunicationWithRelations) => void;
  onViewMessageThread: (threadId: string) => void;
  onViewEmailThread: (threadId: string) => void;
}
