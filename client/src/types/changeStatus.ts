import type {
  ProjectWithRelations,
  User,
  KanbanStage,
  ChangeReason,
  ReasonCustomField,
  StageApproval,
  StageApprovalField,
  StageChangeNotificationPreview,
  ClientValueNotificationPreview,
} from "@shared/schema";

export interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectWithRelations;
  user: User;
  onStatusUpdated?: () => void;
  initialNewStatus?: string;
}

export interface StageChangeConfig {
  projectTypeId: string;
  currentStatus: string;
  stages: (KanbanStage & { validReasonIds: string[] })[];
  reasons: (ChangeReason & { customFields: ReasonCustomField[] })[];
  stageApprovals: StageApproval[];
  stageApprovalFields: StageApprovalField[];
}

export interface StaffNotificationContentProps {
  preview: StageChangeNotificationPreview;
  projectId: string;
  onSend: (data: StaffNotificationSendData) => Promise<void>;
  onClose: () => void;
  isSending: boolean;
  senderName?: string;
}

export interface StaffNotificationSendData {
  emailSubject: string;
  emailBody: string;
  pushTitle: string | null;
  pushBody: string | null;
  suppress: boolean;
  sendEmail: boolean;
  sendPush: boolean;
  sendSms: boolean;
  smsBody: string | null;
  emailRecipientIds: string[];
  pushRecipientIds: string[];
  smsRecipientIds: string[];
}

export interface ClientNotificationSendData {
  emailSubject: string;
  emailBody: string;
  suppress: boolean;
  sendEmail: boolean;
  sendSms: boolean;
  smsBody: string | null;
  emailRecipientIds: string[];
  smsRecipientIds: string[];
}

export interface PendingQuery {
  id: string;
  date: Date | null;
  description: string;
  moneyIn: string;
  moneyOut: string;
  ourQuery: string;
}

export interface UploadedAttachment {
  fileName: string;
  fileSize: number;
  fileType: string;
  objectPath: string;
}

export interface CustomFieldResponse {
  customFieldId: string;
  fieldType: "number" | "short_text" | "long_text" | "multi_select";
  valueNumber?: number;
  valueShortText?: string;
  valueLongText?: string;
  valueMultiSelect?: string[];
}

export interface StatusChangeData {
  newStatus: string;
  changeReason: string;
  stageId?: string;
  reasonId?: string;
  notesHtml?: string;
  attachments?: UploadedAttachment[];
  fieldResponses?: CustomFieldResponse[];
}

export type NotificationType = 'staff' | 'client' | null;

export type NotificationChannel = 'email' | 'push' | 'sms';

export interface VoiceResultData {
  subject: string;
  body: string;
  pushTitle: string;
  pushBody: string;
  transcription: string;
}

export interface AiContext {
  recipientNames?: string;
  senderName?: string;
}
