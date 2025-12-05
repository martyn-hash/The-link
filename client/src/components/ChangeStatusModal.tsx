import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TiptapEditor } from "@/components/TiptapEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  AlertCircle, 
  Loader2, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  Equal,
  X,
  FileText,
  Paperclip,
  Mail,
  Bell,
  Users,
  Mic,
  MessageSquare,
  HelpCircle,
  Plus,
  CalendarIcon,
  Trash2,
  Upload
} from "lucide-react";
import { QueryBulkImport, ParsedQuery } from "@/components/queries/QueryBulkImport";
import { format } from "date-fns";
import { StageNotificationAudioRecorder } from "./StageNotificationAudioRecorder";
import type {
  ProjectWithRelations,
  User,
  KanbanStage,
  ChangeReason,
  ReasonCustomField,
  StageApproval,
  StageApprovalField,
  InsertStageApprovalResponse,
  StageChangeNotificationPreview,
  ClientValueNotificationPreview,
} from "@shared/schema";
import { ClientValueNotificationContent } from "./ClientValueNotificationContent";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectWithRelations;
  user: User;
  onStatusUpdated?: () => void;
  initialNewStatus?: string; // Pre-select a status (for drag-and-drop from kanban)
}

interface StageChangeConfig {
  projectTypeId: string;
  currentStatus: string;
  stages: (KanbanStage & { validReasonIds: string[] })[];
  reasons: (ChangeReason & { customFields: ReasonCustomField[] })[];
  stageApprovals: StageApproval[];
  stageApprovalFields: StageApprovalField[];
}

// Helper function to format stage names for display
const formatStageName = (stageName: string): string => {
  return stageName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to format role names for display
const formatRoleName = (roleName: string | null): string => {
  if (!roleName) return "System";
  return roleName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to format change reason for display
const formatChangeReason = (reason: string): string => {
  return reason
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to format comparison types for display
const formatComparisonType = (
  comparisonType: "equal_to" | "less_than" | "greater_than"
): string => {
  switch (comparisonType) {
    case "equal_to":
      return "equal to";
    case "less_than":
      return "less than";
    case "greater_than":
      return "greater than";
    default:
      return comparisonType;
  }
};

// Helper function to get comparison icon
const getComparisonIcon = (
  comparisonType: "equal_to" | "less_than" | "greater_than"
) => {
  switch (comparisonType) {
    case "equal_to":
      return <Equal className="h-4 w-4" />;
    case "less_than":
      return <ChevronDown className="h-4 w-4" />;
    case "greater_than":
      return <ChevronUp className="h-4 w-4" />;
    default:
      return null;
  }
};

// Helper function to extract first name from various formats
const extractFirstName = (fullName: string): string => {
  if (!fullName) return "";
  
  // Handle "LASTNAME, Firstname" format (common in UK/formal systems)
  if (fullName.includes(",")) {
    const parts = fullName.split(",");
    if (parts.length >= 2) {
      const afterComma = parts[1].trim();
      return afterComma.split(/\s+/)[0] || "";
    }
  }
  
  // Handle "Firstname Lastname" format
  return fullName.split(/\s+/)[0] || "";
};

// Helper function to get sender name with robust fallbacks
const getSenderName = (user: User | null | undefined): string | undefined => {
  if (!user) return undefined;
  
  // Try firstName first
  if (user.firstName && user.firstName.trim()) {
    return user.firstName.trim();
  }
  
  // Try lastName if firstName empty
  if (user.lastName && user.lastName.trim()) {
    return extractFirstName(user.lastName);
  }
  
  // Fallback to email username (before the @)
  if (user.email) {
    const emailUsername = user.email.split('@')[0];
    // Capitalize first letter and handle common patterns like john.doe
    const namePart = emailUsername.split(/[._-]/)[0];
    if (namePart) {
      return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
    }
  }
  
  return undefined;
};

// Inline notification content component (used when stage change succeeds with notification preview)
function NotificationContent({
  preview,
  projectId,
  onSend,
  onClose,
  isSending,
  senderName,
}: {
  preview: StageChangeNotificationPreview;
  projectId: string;
  onSend: (data: {
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
  }) => Promise<void>;
  onClose: () => void;
  isSending: boolean;
  senderName?: string;
}) {
  const [emailSubject, setEmailSubject] = useState(preview.emailSubject);
  const [emailBody, setEmailBody] = useState(preview.emailBody);
  const [pushTitle, setPushTitle] = useState(preview.pushTitle || "");
  const [pushBody, setPushBody] = useState(preview.pushBody || "");
  
  // Per-channel send controls
  const [sendEmail, setSendEmail] = useState(true);
  const [sendPush, setSendPush] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  
  // Per-channel recipient selection (default to all recipients with valid contact info)
  const [emailRecipients, setEmailRecipients] = useState<Set<string>>(
    new Set(preview.recipients.filter(r => r.email).map(r => r.userId))
  );
  const [pushRecipients, setPushRecipients] = useState<Set<string>>(
    new Set(preview.recipients.filter(r => r.hasPushSubscription).map(r => r.userId))
  );
  const [smsRecipients, setSmsRecipients] = useState<Set<string>>(
    new Set(preview.recipients.filter(r => r.mobile).map(r => r.userId))
  );
  
  // Recipients filtered by available contact method
  const emailEligibleRecipients = preview.recipients.filter(r => r.email);
  const pushEligibleRecipients = preview.recipients.filter(r => r.hasPushSubscription);
  const smsEligibleRecipients = preview.recipients.filter(r => r.mobile);
  
  // Helper function to format recipient first names for personalization
  // If no recipients selected, uses all email-eligible recipients for context
  const formatRecipientFirstNames = (recipientIds: Set<string>): string => {
    // Use selected recipients if any, otherwise all email-eligible recipients
    const recipientsToUse = recipientIds.size > 0 
      ? preview.recipients.filter(r => recipientIds.has(r.userId))
      : emailEligibleRecipients;
    
    const names = recipientsToUse
      .map(r => extractFirstName(r.name || ""))
      .filter(name => name.length > 0);
    
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    
    // For 3+ names: "John, Sarah and Mike"
    const lastTwo = names.slice(-2).join(" and ");
    const rest = names.slice(0, -2);
    return [...rest, lastTwo].join(", ");
  };
  
  // Build AI context for personalization (for staff notifications)
  const getAiContext = () => ({
    recipientNames: formatRecipientFirstNames(emailRecipients) || undefined,
    senderName: senderName || undefined,
    // Staff notifications don't have client company context
  });
  
  // Toggle a recipient for a channel
  const toggleRecipient = (
    recipientId: string, 
    channel: 'email' | 'push' | 'sms'
  ) => {
    const setFn = channel === 'email' ? setEmailRecipients : 
                  channel === 'push' ? setPushRecipients : setSmsRecipients;
    const current = channel === 'email' ? emailRecipients : 
                    channel === 'push' ? pushRecipients : smsRecipients;
    
    const newSet = new Set(current);
    if (newSet.has(recipientId)) {
      newSet.delete(recipientId);
    } else {
      newSet.add(recipientId);
    }
    setFn(newSet);
  };
  
  // Toggle all recipients for a channel
  const toggleAllRecipients = (
    channel: 'email' | 'push' | 'sms',
    eligible: typeof preview.recipients,
    selected: Set<string>,
    setSelected: (s: Set<string>) => void
  ) => {
    if (selected.size === eligible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map(r => r.userId)));
    }
  };

  // Handle AI-generated content from voice recording
  const handleVoiceResult = (result: {
    subject: string;
    body: string;
    pushTitle: string;
    pushBody: string;
    transcription: string;
  }) => {
    if (result.subject) setEmailSubject(result.subject);
    if (result.body) setEmailBody(result.body);
    if (result.pushTitle) setPushTitle(result.pushTitle);
    if (result.pushBody) setPushBody(result.pushBody);
  };

  // Check if at least one channel is enabled with recipients
  const hasEnabledChannel = 
    (sendEmail && emailRecipients.size > 0) || 
    (sendPush && pushRecipients.size > 0) || 
    (sendSms && smsRecipients.size > 0);

  const handleSend = async (suppress: boolean) => {
    await onSend({
      emailSubject,
      emailBody,
      pushTitle: pushTitle || null,
      pushBody: pushBody || null,
      suppress,
      sendEmail: sendEmail && emailRecipients.size > 0,
      sendPush: sendPush && pushRecipients.size > 0,
      sendSms: sendSms && smsRecipients.size > 0,
      smsBody: smsBody || null,
      emailRecipientIds: Array.from(emailRecipients),
      pushRecipientIds: Array.from(pushRecipients),
      smsRecipientIds: Array.from(smsRecipients),
    });
  };

  return (
    <>
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {/* Voice Recording for AI-assisted drafting */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium mb-1">AI-Assisted Message Drafting</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Record a voice message and let AI draft your notification. Your completed work items will be automatically included.
              </p>
              <StageNotificationAudioRecorder
                projectId={projectId}
                onResult={handleVoiceResult}
                disabled={isSending}
                context={getAiContext()}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Email Notification */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Email Notification</Label>
              {sendEmail && emailRecipients.size > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {emailRecipients.size} recipient{emailRecipients.size !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <Switch
              checked={sendEmail}
              onCheckedChange={setSendEmail}
              data-testid="switch-send-email"
            />
          </div>

          {sendEmail && (
            <>
              {/* Email Recipients */}
              <div className="bg-muted/30 p-3 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Select Recipients</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => toggleAllRecipients('email', emailEligibleRecipients, emailRecipients, setEmailRecipients)}
                    data-testid="button-toggle-all-email"
                  >
                    {emailRecipients.size === emailEligibleRecipients.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                {emailEligibleRecipients.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No recipients with email addresses</p>
                ) : (
                  <div className="space-y-1">
                    {emailEligibleRecipients.map((recipient) => (
                      <div key={recipient.userId} className="flex items-center gap-2">
                        <Checkbox
                          id={`email-${recipient.userId}`}
                          checked={emailRecipients.has(recipient.userId)}
                          onCheckedChange={() => toggleRecipient(recipient.userId, 'email')}
                          data-testid={`checkbox-email-${recipient.userId}`}
                        />
                        <label
                          htmlFor={`email-${recipient.userId}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          <span className="font-medium">{recipient.name}</span>
                          <span className="text-muted-foreground ml-2">({recipient.email})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-subject">Subject</Label>
                <Input
                  id="email-subject"
                  data-testid="input-email-subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-body">Body</Label>
                <div data-testid="editor-email-body" className="border rounded-md">
                  <TiptapEditor
                    content={emailBody}
                    onChange={setEmailBody}
                    placeholder="Email body content..."
                    editorHeight="200px"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Push Notification */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Push Notification</Label>
              {sendPush && pushRecipients.size > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {pushRecipients.size} recipient{pushRecipients.size !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <Switch
              checked={sendPush}
              onCheckedChange={setSendPush}
              data-testid="switch-send-push"
            />
          </div>

          {sendPush && (
            <>
              {/* Push Recipients */}
              <div className="bg-muted/30 p-3 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Select Recipients (with push enabled)</Label>
                  {pushEligibleRecipients.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => toggleAllRecipients('push', pushEligibleRecipients, pushRecipients, setPushRecipients)}
                      data-testid="button-toggle-all-push"
                    >
                      {pushRecipients.size === pushEligibleRecipients.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                </div>
                {pushEligibleRecipients.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No recipients with push notifications enabled</p>
                ) : (
                  <div className="space-y-1">
                    {pushEligibleRecipients.map((recipient) => (
                      <div key={recipient.userId} className="flex items-center gap-2">
                        <Checkbox
                          id={`push-${recipient.userId}`}
                          checked={pushRecipients.has(recipient.userId)}
                          onCheckedChange={() => toggleRecipient(recipient.userId, 'push')}
                          data-testid={`checkbox-push-${recipient.userId}`}
                        />
                        <label
                          htmlFor={`push-${recipient.userId}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          <span className="font-medium">{recipient.name}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="push-title">Title</Label>
                <Input
                  id="push-title"
                  data-testid="input-push-title"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="Push notification title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="push-body">Body</Label>
                <Input
                  id="push-body"
                  data-testid="input-push-body"
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  placeholder="Push notification body"
                />
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* SMS Notification */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">SMS Notification</Label>
              <Badge variant="outline" className="text-xs">Coming Soon</Badge>
              {sendSms && smsRecipients.size > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {smsRecipients.size} recipient{smsRecipients.size !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <Switch
              checked={sendSms}
              onCheckedChange={setSendSms}
              data-testid="switch-send-sms"
              disabled // Disabled until SMS is configured
            />
          </div>

          {sendSms && (
            <>
              {/* SMS Recipients */}
              <div className="bg-muted/30 p-3 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Select Recipients (with mobile number)</Label>
                  {smsEligibleRecipients.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => toggleAllRecipients('sms', smsEligibleRecipients, smsRecipients, setSmsRecipients)}
                      data-testid="button-toggle-all-sms"
                    >
                      {smsRecipients.size === smsEligibleRecipients.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                </div>
                {smsEligibleRecipients.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No recipients with mobile numbers</p>
                ) : (
                  <div className="space-y-1">
                    {smsEligibleRecipients.map((recipient) => (
                      <div key={recipient.userId} className="flex items-center gap-2">
                        <Checkbox
                          id={`sms-${recipient.userId}`}
                          checked={smsRecipients.has(recipient.userId)}
                          onCheckedChange={() => toggleRecipient(recipient.userId, 'sms')}
                          data-testid={`checkbox-sms-${recipient.userId}`}
                        />
                        <label
                          htmlFor={`sms-${recipient.userId}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          <span className="font-medium">{recipient.name}</span>
                          <span className="text-muted-foreground ml-2">({recipient.mobile})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sms-body">Message (max 160 chars)</Label>
                <Textarea
                  id="sms-body"
                  data-testid="input-sms-body"
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value.slice(0, 160))}
                  placeholder="SMS message content..."
                  maxLength={160}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">{smsBody.length}/160 characters</p>
              </div>
            </>
          )}
        </div>

        {/* Metadata Info */}
        <div className="bg-muted/20 p-4 rounded-md">
          <h4 className="text-sm font-medium mb-2">Notification Details</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div data-testid="text-project-name">
              <span className="font-medium">Project:</span> {preview.metadata.projectName}
            </div>
            <div data-testid="text-client-name">
              <span className="font-medium">Client:</span> {preview.metadata.clientName}
            </div>
            <div data-testid="text-stage-change">
              <span className="font-medium">Stage Change:</span>{" "}
              {preview.oldStageName ? `${preview.oldStageName} → ` : ""}
              {preview.newStageName}
            </div>
            {preview.metadata.dueDate && (
              <div data-testid="text-due-date">
                <span className="font-medium">Due Date:</span> {preview.metadata.dueDate}
              </div>
            )}
            {preview.metadata.changeReason && (
              <div data-testid="text-change-reason">
                <span className="font-medium">Reason:</span> {preview.metadata.changeReason}
              </div>
            )}
          </div>
        </div>
      </div>

      <DialogFooter className="flex gap-2 sm:gap-2">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={isSending}
          data-testid="button-skip"
        >
          Skip
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSend(true)}
          disabled={isSending}
          data-testid="button-dont-send"
        >
          Don't Send (Log as Suppressed)
        </Button>
        <Button
          onClick={() => handleSend(false)}
          disabled={isSending || !hasEnabledChannel}
          data-testid="button-send"
        >
          {isSending ? "Sending..." : hasEnabledChannel ? "Send Notification" : "Select a Channel"}
        </Button>
      </DialogFooter>
    </>
  );
}

export default function ChangeStatusModal({
  isOpen,
  onClose,
  project,
  user,
  onStatusUpdated,
  initialNewStatus,
}: ChangeStatusModalProps) {
  const [newStatus, setNewStatus] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [notesHtml, setNotesHtml] = useState("");
  const [customFieldResponses, setCustomFieldResponses] = useState<Record<string, any>>({});
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showQueriesForm, setShowQueriesForm] = useState(false);
  const [pendingQueries, setPendingQueries] = useState<Array<{
    id: string;
    date: Date | null;
    description: string;
    moneyIn: string;
    moneyOut: string;
    ourQuery: string;
  }>>([]);
  const [notificationPreview, setNotificationPreview] = useState<StageChangeNotificationPreview | null>(null);
  const [clientNotificationPreview, setClientNotificationPreview] = useState<ClientValueNotificationPreview | null>(null);
  const [notificationType, setNotificationType] = useState<'staff' | 'client' | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<Array<{
    fileName: string;
    fileSize: number;
    fileType: string;
    objectPath: string;
  }>>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set initial new status when modal opens (for drag-and-drop)
  useEffect(() => {
    if (isOpen && initialNewStatus) {
      setNewStatus(initialNewStatus);
    }
  }, [isOpen, initialNewStatus]);

  // Fetch all stage change configuration in a single request (eliminates 6+ cascading queries)
  const { data: stageChangeConfig, isLoading: configLoading } = useQuery<StageChangeConfig>({
    queryKey: ["/api/projects", project.id, "stage-change-config"],
    enabled: !!project.id && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Derive data from combined config (no additional network requests needed)
  const stages = stageChangeConfig?.stages ?? [];
  const stageApprovals = stageChangeConfig?.stageApprovals ?? [];
  const stageApprovalFields = stageChangeConfig?.stageApprovalFields ?? [];
  const allReasons = stageChangeConfig?.reasons ?? [];

  // Find the selected stage to get its ID
  const selectedStage = stages.find((stage) => stage.name === newStatus);

  // Filter to valid reasons for the selected stage (uses pre-computed validReasonIds)
  const filteredReasons = useMemo(() => {
    if (!selectedStage) return [];
    const validIds = new Set(selectedStage.validReasonIds);
    return allReasons.filter((r) => validIds.has(r.id));
  }, [selectedStage, allReasons]);

  // Find the selected reason to get its ID
  const selectedReasonObj = filteredReasons.find(
    (reason) => reason.reason === changeReason
  );

  // Get custom fields from the pre-loaded reason object (no network request needed)
  const customFields = selectedReasonObj?.customFields ?? [];

  // Loading states for backward compatibility
  const stagesLoading = configLoading;
  const reasonsLoading = configLoading;
  const customFieldsLoading = configLoading;
  const stageApprovalsLoading = configLoading;
  const stageApprovalFieldsLoading = configLoading;

  // Determine effective approval ID (reason-level takes precedence over stage-level)
  const effectiveApprovalId = useMemo(() => {
    return selectedReasonObj?.stageApprovalId || selectedStage?.stageApprovalId || null;
  }, [selectedReasonObj, selectedStage]);

  // Get target stage approval and fields using effective approval ID
  const targetStageApproval = useMemo(() => {
    if (!effectiveApprovalId) return null;
    return stageApprovals.find((a) => a.id === effectiveApprovalId) || null;
  }, [effectiveApprovalId, stageApprovals]);

  const targetStageApprovalFields = useMemo(() => {
    if (!targetStageApproval) return [];
    return stageApprovalFields
      .filter((field) => field.stageApprovalId === targetStageApproval.id)
      .sort((a, b) => a.order - b.order);
  }, [targetStageApproval, stageApprovalFields]);

  // Create dynamic Zod schema for stage approval form
  const approvalFormSchema = useMemo(() => {
    if (!targetStageApprovalFields.length) return z.object({});

    const schemaFields: Record<string, z.ZodTypeAny> = {};

    targetStageApprovalFields.forEach((field) => {
      if (field.fieldType === "boolean") {
        schemaFields[field.id] = z.boolean().refine(
          (value) => value === field.expectedValueBoolean,
          {
            message: `This field must be set to ${
              field.expectedValueBoolean ? "Yes" : "No"
            }`,
          }
        );
      } else if (field.fieldType === "number") {
        const baseNumberSchema = z.number({
          required_error: field.isRequired ? "This field is required" : undefined,
          invalid_type_error: "Please enter a valid number",
        });

        if (field.comparisonType && field.expectedValueNumber !== null) {
          schemaFields[field.id] = baseNumberSchema.refine(
            (value) => {
              switch (field.comparisonType) {
                case "equal_to":
                  return value === field.expectedValueNumber;
                case "less_than":
                  return value < field.expectedValueNumber!;
                case "greater_than":
                  return value > field.expectedValueNumber!;
                default:
                  return true;
              }
            },
            {
              message: `Value must be ${formatComparisonType(
                field.comparisonType
              )} ${field.expectedValueNumber}`,
            }
          );
        } else {
          schemaFields[field.id] = field.isRequired
            ? baseNumberSchema
            : baseNumberSchema.optional();
        }
      } else if (field.fieldType === "long_text") {
        schemaFields[field.id] = field.isRequired
          ? z.string().min(1, "This field is required")
          : z.string().optional();
      } else if (field.fieldType === "multi_select") {
        schemaFields[field.id] = field.isRequired
          ? z
              .array(z.string())
              .min(1, "Please select at least one option")
          : z.array(z.string()).optional();
      }
    });

    return z.object(schemaFields);
  }, [targetStageApprovalFields]);

  // Stage approval form
  const approvalForm = useForm<Record<string, any>>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: {},
  });

  // Determine if we should show approval form (using effective approval ID)
  useEffect(() => {
    const shouldShow =
      !!effectiveApprovalId &&
      !!newStatus &&
      !!changeReason &&
      !stageApprovalsLoading &&
      !stageApprovalFieldsLoading &&
      !!targetStageApproval &&
      targetStageApprovalFields.length > 0;

    setShowApprovalForm(shouldShow);
  }, [
    effectiveApprovalId,
    newStatus,
    changeReason,
    stageApprovalsLoading,
    stageApprovalFieldsLoading,
    targetStageApproval,
    targetStageApprovalFields,
  ]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNewStatus("");
      setChangeReason("");
      setNotesHtml("");
      setCustomFieldResponses({});
      setShowApprovalForm(false);
      setShowQueriesForm(false);
      setPendingQueries([]);
      approvalForm.reset();
      setSelectedFiles([]);
      setUploadedAttachments([]);
      setIsUploadingFiles(false);
    }
  }, [isOpen, approvalForm]);

  // Reset change reason and custom field responses when stage changes
  useEffect(() => {
    if (newStatus && selectedStage) {
      setChangeReason("");
      setCustomFieldResponses({});
    }
  }, [newStatus, selectedStage]);

  // Reset custom field responses when reason changes
  useEffect(() => {
    if (changeReason && selectedReasonObj) {
      setCustomFieldResponses({});
    }
  }, [changeReason, selectedReasonObj]);

  // Mutation for submitting stage approval responses
  const submitApprovalResponsesMutation = useMutation({
    mutationFn: async (responses: InsertStageApprovalResponse[]) => {
      return await apiRequest("POST", `/api/projects/${project.id}/stage-approval-responses`, {
        responses,
      });
    },
    onSuccess: () => {
      // After successful approval submission, proceed with status change
      updateStatusMutation.mutate({
        newStatus,
        changeReason,
        stageId: selectedStage?.id,
        reasonId: selectedReasonObj?.id,
        notesHtml: notesHtml.trim() || undefined,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        fieldResponses: formatFieldResponses(),
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: {
      newStatus: string;
      changeReason: string;
      stageId?: string;
      reasonId?: string;
      notesHtml?: string;
      attachments?: Array<{
        fileName: string;
        fileSize: number;
        fileType: string;
        objectPath: string;
      }>;
      fieldResponses?: Array<{
        customFieldId: string;
        fieldType: "number" | "short_text" | "long_text" | "multi_select";
        valueNumber?: number;
        valueShortText?: string;
        valueLongText?: string;
        valueMultiSelect?: string[];
      }>;
    }) => {
      return await apiRequest("PATCH", `/api/projects/${project.id}/status`, data);
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/projects"] });

      // Snapshot the previous value
      const previousProjects = queryClient.getQueryData(["/api/projects"]);

      // Optimistically update the project status in cache
      queryClient.setQueryData(["/api/projects"], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        
        return old.map((p: any) => 
          p.id === project.id 
            ? { ...p, currentStatus: data.newStatus }
            : p
        );
      });

      // Return context with previous data for rollback
      return { previousProjects };
    },
    onSuccess: async (data: any) => {
      // Handle response format: { project, clientNotificationPreview, notificationType }
      const updatedProject = data.project || data;
      const clientPreview = data.clientNotificationPreview;
      const type = data.notificationType;

      // If there are pending queries, create them
      if (pendingQueries.length > 0) {
        try {
          // Create each query
          for (const query of pendingQueries) {
            if (query.description || query.ourQuery) {
              await apiRequest("POST", `/api/projects/${project.id}/queries`, {
                projectId: project.id,
                date: query.date?.toISOString() || null,
                description: query.description || null,
                moneyIn: query.moneyIn ? query.moneyIn : null,
                moneyOut: query.moneyOut ? query.moneyOut : null,
                ourQuery: query.ourQuery || "",
                status: "open",
              });
            }
          }
          toast({
            title: "Success",
            description: `Stage updated and ${pendingQueries.length} ${pendingQueries.length === 1 ? 'query' : 'queries'} created`,
          });
        } catch (error) {
          console.error("Failed to create queries:", error);
          toast({
            title: "Stage Updated",
            description: "Stage was updated but some queries failed to create",
            variant: "destructive",
          });
        }
      } else {
        // ALWAYS show success immediately - stage change is committed
        toast({
          title: "Success",
          description: "Stage updated successfully",
        });
      }
      
      // Refresh data immediately so user sees the change
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "queries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/queries/counts"] });
      onStatusUpdated?.();
      
      // Reset form state - stage change is complete
      setNewStatus("");
      setChangeReason("");
      setNotesHtml("");
      setCustomFieldResponses({});
      setShowApprovalForm(false);
      setShowQueriesForm(false);
      setPendingQueries([]);
      setSelectedFiles([]);
      setUploadedAttachments([]);

      if (clientPreview && type === 'client') {
        // Show client notification approval modal AFTER confirming stage change
        // Closing this modal will NOT affect the stage change
        setClientNotificationPreview(clientPreview);
        setNotificationType('client');
        setShowNotificationModal(true);
      } else {
        // No notification to send, close the modal
        onClose();
      }
    },
    onError: (error: any, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousProjects) {
        queryClient.setQueryData(["/api/projects"], context.previousProjects);
      }
      showFriendlyError({ error });
    },
  });

  // Mutation for sending client value notification after user approval
  const sendClientNotificationMutation = useMutation({
    mutationFn: async (data: {
      emailSubject: string;
      emailBody: string;
      suppress: boolean;
      sendEmail: boolean;
      sendSms: boolean;
      smsBody: string | null;
      emailRecipientIds: string[];
      smsRecipientIds: string[];
    }) => {
      if (!clientNotificationPreview) throw new Error("No client notification preview available");
      
      return await apiRequest("POST", `/api/projects/${project.id}/send-client-value-notification`, {
        projectId: project.id,
        dedupeKey: clientNotificationPreview.dedupeKey,
        ...data,
      });
    },
    onSuccess: (data: any) => {
      const wasSent = !data.suppress && data.sent;
      
      if (wasSent) {
        toast({
          title: "Notification sent",
          description: "Client contacts have been notified of the stage change",
        });
      }
      // If suppressed, no need for another toast - stage success was already shown
      
      // Close notification modal and main modal
      setShowNotificationModal(false);
      setClientNotificationPreview(null);
      setNotificationType(null);
      onClose();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Legacy mutation for sending internal staff stage change notification (kept for compatibility)
  const sendNotificationMutation = useMutation({
    mutationFn: async (data: {
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
    }) => {
      if (!notificationPreview) throw new Error("No notification preview available");
      
      return await apiRequest("POST", `/api/projects/${project.id}/send-stage-change-notification`, {
        projectId: project.id,
        dedupeKey: notificationPreview.dedupeKey,
        ...data,
      });
    },
    onSuccess: (data: any) => {
      const wasSent = !data.suppress && data.sent;
      
      if (wasSent) {
        toast({
          title: "Notification sent",
          description: "Staff has been notified of the stage change",
        });
      }
      // If suppressed, no need for another toast - stage success was already shown
      
      // Close notification modal and main modal
      setShowNotificationModal(false);
      setNotificationPreview(null);
      onClose();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const getAvailableStatuses = () => {
    if (stagesLoading || stages.length === 0) {
      return [];
    }

    const currentStatus = project.currentStatus;

    const statusOptions = stages.map((stage) => ({
      value: stage.name,
      label: formatStageName(stage.name),
      stage: stage,
    }));

    return statusOptions.filter((option) => option.value !== currentStatus);
  };

  // Helper function to validate required custom fields
  const validateCustomFields = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const requiredFields = customFields.filter((field) => field.isRequired);

    for (const field of requiredFields) {
      const response = customFieldResponses[field.id];
      if (field.fieldType === "multi_select") {
        if (!response || !Array.isArray(response) || response.length === 0) {
          errors.push(
            `${field.fieldName} is required - please select at least one option`
          );
        }
      } else if (
        !response ||
        response === "" ||
        response === null ||
        response === undefined
      ) {
        errors.push(`${field.fieldName} is required`);
      } else if (field.fieldType === "number" && isNaN(Number(response))) {
        errors.push(`${field.fieldName} must be a valid number`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  // Helper function to handle custom field value changes
  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFieldResponses((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // Helper function to handle multi-select changes
  const handleMultiSelectChange = (
    fieldId: string,
    option: string,
    checked: boolean
  ) => {
    setCustomFieldResponses((prev) => {
      const currentValues = prev[fieldId] || [];
      const updatedValues = checked
        ? [...currentValues, option]
        : currentValues.filter((item: string) => item !== option);
      return {
        ...prev,
        [fieldId]: updatedValues,
      };
    });
  };

  // Convert custom field responses to API format
  const formatFieldResponses = () => {
    return customFields
      .map((field) => {
        const value = customFieldResponses[field.id];
        const baseResponse = {
          customFieldId: field.id,
          fieldType: field.fieldType as
            | "number"
            | "short_text"
            | "long_text"
            | "multi_select",
        };

        if (field.fieldType === "number") {
          return { ...baseResponse, valueNumber: value ? Number(value) : undefined };
        } else if (field.fieldType === "short_text") {
          return { ...baseResponse, valueShortText: value || undefined };
        } else if (field.fieldType === "long_text") {
          return { ...baseResponse, valueLongText: value || undefined };
        } else if (field.fieldType === "multi_select") {
          return {
            ...baseResponse,
            valueMultiSelect:
              Array.isArray(value) && value.length > 0 ? value : undefined,
          };
        }

        return baseResponse;
      })
      .filter((response) => {
        // Type guard to check if response has any value field populated
        if ("valueNumber" in response && response.valueNumber !== undefined) return true;
        if ("valueShortText" in response && response.valueShortText !== undefined)
          return true;
        if ("valueLongText" in response && response.valueLongText !== undefined)
          return true;
        if ("valueMultiSelect" in response && response.valueMultiSelect !== undefined)
          return true;
        return false;
      });
  };

  const handleSubmit = async () => {
    if (!newStatus || !changeReason) {
      showFriendlyError({ error: "Please select both a new stage and change reason" });
      return;
    }

    // Validate custom fields if they exist
    if (customFields.length > 0) {
      const fieldValidation = validateCustomFields();
      if (!fieldValidation.isValid) {
        showFriendlyError({ error: fieldValidation.errors.join(", ") });
        return;
      }
    }

    // If stage approval is required
    if (showApprovalForm && targetStageApproval && targetStageApprovalFields.length > 0) {
      // Validate approval form
      const isValid = await approvalForm.trigger();
      if (!isValid) {
        showFriendlyError({ error: "Please complete all required approval fields correctly" });
        return;
      }

      // Submit approval responses first
      const approvalData = approvalForm.getValues();
      const responses: InsertStageApprovalResponse[] = targetStageApprovalFields
        .map((field) => {
          const value = approvalData[field.id];
          const baseResponse = {
            projectId: project.id,
            fieldId: field.id,
          };

          if (field.fieldType === "boolean") {
            return { ...baseResponse, valueBoolean: value as boolean };
          } else if (field.fieldType === "number") {
            return { ...baseResponse, valueNumber: value as number };
          } else if (field.fieldType === "long_text") {
            return { ...baseResponse, valueLongText: value as string };
          } else if (field.fieldType === "multi_select") {
            return {
              ...baseResponse,
              valueMultiSelect: Array.isArray(value) && value.length > 0 ? value as string[] : undefined,
            };
          }

          return baseResponse;
        })
        .filter((response) => {
          // Filter out responses with no populated value field
          if ("valueBoolean" in response && response.valueBoolean !== undefined) return true;
          if ("valueNumber" in response && response.valueNumber !== undefined) return true;
          if ("valueLongText" in response && response.valueLongText !== undefined && response.valueLongText !== "") return true;
          if ("valueMultiSelect" in response && response.valueMultiSelect !== undefined && response.valueMultiSelect.length > 0) return true;
          return false;
        });

      submitApprovalResponsesMutation.mutate(responses);
    } else {
      // No stage approval required, proceed with normal status change
      updateStatusMutation.mutate({
        newStatus,
        changeReason,
        stageId: selectedStage?.id,
        reasonId: selectedReasonObj?.id,
        notesHtml: notesHtml.trim() || undefined,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        fieldResponses: formatFieldResponses(),
      });
    }
  };

  // File upload helper function
  const uploadFilesToObjectStorage = async (files: File[]): Promise<Array<{
    fileName: string;
    fileSize: number;
    fileType: string;
    objectPath: string;
  }>> => {
    const uploadedFiles: Array<{
      fileName: string;
      fileSize: number;
      fileType: string;
      objectPath: string;
    }> = [];

    for (const file of files) {
      // Get signed URL for uploading
      const urlResponse = await apiRequest(
        "POST",
        `/api/projects/${project.id}/stage-change-attachments/upload-url`,
        {
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
        }
      );

      const { url: uploadUrl, objectPath } = urlResponse;

      // Upload to object storage
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${file.name}`);
      }

      uploadedFiles.push({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        objectPath,
      });
    }

    return uploadedFiles;
  };

  // Handle file selection and upload
  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    setSelectedFiles((prev) => [...prev, ...files]);
    setIsUploadingFiles(true);

    try {
      const uploaded = await uploadFilesToObjectStorage(files);
      setUploadedAttachments((prev) => [...prev, ...uploaded]);
      toast({
        title: "Files Uploaded",
        description: `${files.length} file(s) uploaded successfully`,
      });
    } catch (error: any) {
      // Remove the files from selected since upload failed
      setSelectedFiles((prev) =>
        prev.filter((f) => !files.some((newFile) => newFile.name === f.name))
      );
      showFriendlyError({ error });
    } finally {
      setIsUploadingFiles(false);
    }
  };

  // Handle file removal
  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const availableStatuses = getAvailableStatuses();
  const isSubmitting =
    updateStatusMutation.isPending || submitApprovalResponsesMutation.isPending || isUploadingFiles;

  // Handle closing the entire modal (both stage change and notification)
  const handleFullClose = () => {
    setShowNotificationModal(false);
    setNotificationPreview(null);
    setClientNotificationPreview(null);
    setNotificationType(null);
    onClose();
  };

  // Determine modal size based on current view
  const getModalClassName = () => {
    if (showNotificationModal) return "max-w-4xl";
    if (showApprovalForm || showQueriesForm) return "max-w-6xl";
    return "max-w-2xl";
  };

  // Toggle queries form (mutually exclusive with approval form)
  const handleToggleQueriesForm = useCallback(() => {
    setShowQueriesForm(prev => !prev);
    // Queries form is user-triggered, approval form is automatic based on stage
    // They can coexist visually but we only show one right column at a time
  }, []);

  // Add a new empty query row
  const handleAddQueryRow = useCallback(() => {
    setPendingQueries(prev => [...prev, {
      id: crypto.randomUUID(),
      date: null,
      description: "",
      moneyIn: "",
      moneyOut: "",
      ourQuery: "",
    }]);
  }, []);

  // Update a query field
  const handleUpdateQuery = useCallback((id: string, field: string, value: any) => {
    setPendingQueries(prev => prev.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  }, []);

  // Remove a query row
  const handleRemoveQuery = useCallback((id: string) => {
    setPendingQueries(prev => prev.filter(q => q.id !== id));
  }, []);

  // Handle bulk import of queries
  const handleBulkImportQueries = useCallback((importedQueries: ParsedQuery[]) => {
    const newQueries = importedQueries.map(q => ({
      id: crypto.randomUUID(),
      date: q.date,
      description: q.description,
      moneyIn: q.moneyIn,
      moneyOut: q.moneyOut,
      ourQuery: q.ourQuery,
    }));
    setPendingQueries(prev => [...prev, ...newQueries]);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleFullClose}>
      <DialogContent 
        className={getModalClassName()} 
        data-testid="dialog-change-status"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Show client notification content if stage change succeeded and there's a client preview */}
        {showNotificationModal && clientNotificationPreview && notificationType === 'client' ? (
          <>
            <DialogHeader>
              <DialogTitle data-testid="text-notification-title">Notify Client of Stage Change?</DialogTitle>
              <DialogDescription data-testid="text-notification-description">
                The stage has been updated successfully. Would you like to notify the client contacts?
              </DialogDescription>
            </DialogHeader>

            <ClientValueNotificationContent
              preview={clientNotificationPreview}
              projectId={project.id}
              onSend={async (editedData) => {
                await sendClientNotificationMutation.mutateAsync(editedData);
              }}
              onClose={handleFullClose}
              isSending={sendClientNotificationMutation.isPending}
              senderName={getSenderName(user)}
              onAiRefine={async (prompt, currentSubject, currentBody, context) => {
                const response = await fetch("/api/ai/refine-email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    projectId: project.id,
                    prompt,
                    currentSubject,
                    currentBody,
                    ...(context || {}),
                  }),
                  credentials: "include",
                });
                if (!response.ok) {
                  throw new Error("Failed to refine email");
                }
                const result = await response.json();
                return { subject: result.subject, body: result.body };
              }}
            />
          </>
        ) : showNotificationModal && notificationPreview && notificationType === 'staff' ? (
          <>
            <DialogHeader>
              <DialogTitle data-testid="text-notification-title">Send Stage Change Notification?</DialogTitle>
              <DialogDescription data-testid="text-notification-description">
                The stage has been updated successfully. Would you like to notify the assignees?
              </DialogDescription>
            </DialogHeader>

            <NotificationContent
              preview={notificationPreview}
              projectId={project.id}
              onSend={async (editedData) => {
                await sendNotificationMutation.mutateAsync(editedData);
              }}
              onClose={handleFullClose}
              isSending={sendNotificationMutation.isPending}
              senderName={getSenderName(user)}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Change Project Status</DialogTitle>
              <DialogDescription>
                Move this project to a different stage in the workflow
              </DialogDescription>
            </DialogHeader>

        <div className={`max-h-[70vh] overflow-y-auto ${(showApprovalForm || showQueriesForm) ? "grid grid-cols-2 gap-6" : ""}`}>
          {/* Left column: Status change form */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Status Change Details</h3>

            {/* Stage Selector */}
            <div className="space-y-2">
              <Label htmlFor="status-select">Move to Stage *</Label>
              {stagesLoading ? (
                <div className="h-10 bg-muted animate-pulse rounded" />
              ) : (
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger id="status-select" data-testid="select-stage">
                    <SelectValue placeholder="Select new stage..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Change Reason */}
            {newStatus && (
              <div className="space-y-2">
                <Label htmlFor="reason-select">Change Reason *</Label>
                {reasonsLoading ? (
                  <div className="h-10 bg-muted animate-pulse rounded" />
                ) : filteredReasons.length === 0 ? (
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    No change reasons configured for this stage
                  </div>
                ) : (
                  <Select value={changeReason} onValueChange={setChangeReason}>
                    <SelectTrigger id="reason-select" data-testid="select-reason">
                      <SelectValue placeholder="Please select a stage first" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredReasons.map((reason) => (
                        <SelectItem key={reason.id} value={reason.reason}>
                          {formatChangeReason(reason.reason)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Custom Fields for Change Reason */}
            {changeReason && customFields.length > 0 && (
              <div className="space-y-4">
                <Separator />
                <div className="space-y-4">
                  {customFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <div>
                        <Label htmlFor={`custom-field-${field.id}`}>
                          {field.fieldName}
                          {field.isRequired && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                        {field.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {field.description}
                          </p>
                        )}
                      </div>

                      {field.fieldType === "boolean" && (
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`custom-field-${field.id}`}
                            checked={customFieldResponses[field.id] || false}
                            onCheckedChange={(checked) =>
                              handleCustomFieldChange(field.id, checked)
                            }
                            data-testid={`checkbox-custom-field-${field.id}`}
                          />
                          <Label htmlFor={`custom-field-${field.id}`} className="font-normal">
                            {customFieldResponses[field.id] ? "Yes" : "No"}
                          </Label>
                        </div>
                      )}

                      {field.fieldType === "number" && (
                        <Input
                          id={`custom-field-${field.id}`}
                          type="number"
                          value={customFieldResponses[field.id] || ""}
                          onChange={(e) =>
                            handleCustomFieldChange(field.id, e.target.value)
                          }
                          placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                          data-testid={`input-custom-field-${field.id}`}
                        />
                      )}

                      {field.fieldType === "short_text" && (
                        <Input
                          id={`custom-field-${field.id}`}
                          type="text"
                          value={customFieldResponses[field.id] || ""}
                          onChange={(e) =>
                            handleCustomFieldChange(field.id, e.target.value)
                          }
                          placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                          data-testid={`input-custom-field-${field.id}`}
                        />
                      )}

                      {field.fieldType === "long_text" && (
                        <Textarea
                          id={`custom-field-${field.id}`}
                          value={customFieldResponses[field.id] || ""}
                          onChange={(e) =>
                            handleCustomFieldChange(field.id, e.target.value)
                          }
                          placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                          rows={3}
                          data-testid={`textarea-custom-field-${field.id}`}
                        />
                      )}

                      {field.fieldType === "multi_select" &&
                        field.options &&
                        field.options.length > 0 && (
                          <div className="space-y-2">
                            {field.options.map((option: string) => (
                              <div
                                key={option}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`${field.id}-${option}`}
                                  checked={
                                    customFieldResponses[field.id]?.includes(
                                      option
                                    ) || false
                                  }
                                  onCheckedChange={(checked) =>
                                    handleMultiSelectChange(
                                      field.id,
                                      option,
                                      checked as boolean
                                    )
                                  }
                                  data-testid={`checkbox-${field.id}-${option}`}
                                />
                                <label
                                  htmlFor={`${field.id}-${option}`}
                                  className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {option}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <TiptapEditor
                content={notesHtml}
                onChange={setNotesHtml}
                placeholder="Add notes explaining the status change..."
              />
            </div>

            {/* File Attachments - Compact Button */}
            <div className="flex items-center gap-3">
              <input
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    handleFilesSelected(files);
                  }
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
                id="stage-change-file-upload"
                data-testid="input-stage-change-file"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isUploadingFiles}
                onClick={() => document.getElementById('stage-change-file-upload')?.click()}
                data-testid="button-attach-file"
              >
                <Paperclip className="w-4 h-4 mr-2" />
                Attach
              </Button>
              {selectedFiles.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                </span>
              )}
              {isUploadingFiles && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Uploading...
                </span>
              )}
            </div>
            {selectedFiles.length > 0 && (
              <div className="space-y-1 mt-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm"
                    data-testid={`selected-file-${index}`}
                  >
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 truncate max-w-[200px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      onClick={() => handleRemoveFile(index)}
                      data-testid={`btn-remove-file-${index}`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Queries Button - only show when approval form is NOT shown */}
            {!showApprovalForm && (
              <div className="pt-2">
                <Separator className="mb-4" />
                <Button
                  type="button"
                  variant={showQueriesForm ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleToggleQueriesForm}
                  className="w-full"
                  data-testid="button-toggle-queries"
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  {showQueriesForm ? "Hide Queries" : "Add Queries"}
                  {pendingQueries.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {pendingQueries.length}
                    </Badge>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Right column: Stage approval form (conditional) */}
          {showApprovalForm && (
            <div className="space-y-4 border-l pl-6">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Stage Approval Required</h3>
                <Badge variant="secondary">Required</Badge>
              </div>

              <Form {...approvalForm}>
                <form className="space-y-6">
                  {targetStageApprovalFields.map((field, index) => (
                    <div key={field.id}>
                      {index > 0 && <Separator className="my-4" />}

                      <FormField
                        control={approvalForm.control}
                        name={field.id}
                        render={({ field: formField }) => (
                          <FormItem>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <FormLabel className="text-base font-medium">
                                    {field.fieldName}
                                    {field.isRequired && (
                                      <span className="text-destructive ml-1">*</span>
                                    )}
                                  </FormLabel>
                                  {field.description && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {field.description}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {field.fieldType}
                                </Badge>
                              </div>

                              {/* Boolean Field */}
                              {field.fieldType === "boolean" && (
                                <div className="space-y-3">
                                  <FormDescription className="flex items-center gap-2">
                                    {field.expectedValueBoolean ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-red-500" />
                                    )}
                                    This field must be set to:{" "}
                                    <strong>
                                      {field.expectedValueBoolean ? "Yes" : "No"}
                                    </strong>
                                  </FormDescription>
                                  <FormControl>
                                    <div className="flex items-center space-x-3">
                                      <Switch
                                        checked={formField.value || false}
                                        onCheckedChange={formField.onChange}
                                        data-testid={`switch-approval-${field.id}`}
                                      />
                                      <Label className="font-normal">
                                        {formField.value ? "Yes" : "No"}
                                      </Label>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </div>
                              )}

                              {/* Number Field */}
                              {field.fieldType === "number" && (
                                <div className="space-y-3">
                                  {field.comparisonType &&
                                    field.expectedValueNumber !== null && (
                                      <FormDescription className="flex items-center gap-2">
                                        {getComparisonIcon(field.comparisonType)}
                                        Value must be{" "}
                                        {formatComparisonType(field.comparisonType)}{" "}
                                        <strong>{field.expectedValueNumber}</strong>
                                      </FormDescription>
                                    )}
                                  <FormControl>
                                    <Input
                                      type="number"
                                      {...formField}
                                      onChange={(e) =>
                                        formField.onChange(Number(e.target.value))
                                      }
                                      data-testid={`input-approval-${field.id}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </div>
                              )}

                              {/* Long Text Field */}
                              {field.fieldType === "long_text" && (
                                <div className="space-y-3">
                                  <FormControl>
                                    <Textarea
                                      {...formField}
                                      rows={4}
                                      data-testid={`textarea-approval-${field.id}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </div>
                              )}

                              {/* Multi-Select Field */}
                              {field.fieldType === "multi_select" &&
                                field.options &&
                                field.options.length > 0 && (
                                  <div className="space-y-3">
                                    <FormControl>
                                      <div className="space-y-2">
                                        {field.options.map((option: string) => (
                                          <div
                                            key={option}
                                            className="flex items-center space-x-2"
                                          >
                                            <Checkbox
                                              checked={
                                                (formField.value as string[] | undefined)?.includes(option) ||
                                                false
                                              }
                                              onCheckedChange={(checked) => {
                                                const currentValue =
                                                  (formField.value as string[]) || [];
                                                const updatedValue = checked
                                                  ? [...currentValue, option]
                                                  : currentValue.filter(
                                                      (v: string) => v !== option
                                                    );
                                                formField.onChange(updatedValue);
                                              }}
                                              data-testid={`checkbox-approval-${field.id}-${option}`}
                                            />
                                            <label className="text-sm font-normal">
                                              {option}
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </div>
                                )}
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </form>
              </Form>
            </div>
          )}

          {/* Right column: Add Queries form (conditional, mutually exclusive with approval) */}
          {showQueriesForm && !showApprovalForm && (
            <div className="space-y-4 border-l pl-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Add Queries</h3>
                  {pendingQueries.length > 0 && (
                    <Badge variant="secondary">{pendingQueries.length}</Badge>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowQueriesForm(false)}
                  className="h-6 w-6"
                  data-testid="button-close-queries"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Add transaction queries to be resolved. These will be saved with this stage change.
              </p>

              {/* Query Entry Table */}
              <div className="space-y-2">
                {pendingQueries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                    <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No queries added yet</p>
                    <p className="text-xs">Click the button below to add a query</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {pendingQueries.map((query, index) => (
                      <div 
                        key={query.id} 
                        className="p-3 bg-muted/30 rounded-lg space-y-3 relative"
                        data-testid={`query-row-${index}`}
                      >
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => handleRemoveQuery(query.id)}
                          data-testid={`button-remove-query-${index}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                          {/* Date Picker */}
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start text-left font-normal h-8 text-xs"
                                  data-testid={`button-date-${index}`}
                                >
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {query.date ? format(query.date, "dd MMM yy") : "Select"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={query.date || undefined}
                                  onSelect={(date) => handleUpdateQuery(query.id, "date", date)}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Amount (Money Out by default) */}
                          <div className="space-y-1">
                            <Label className="text-xs">Amount (£)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={query.moneyOut}
                              onChange={(e) => handleUpdateQuery(query.id, "moneyOut", e.target.value)}
                              className="h-8 text-xs"
                              data-testid={`input-amount-${index}`}
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input
                            placeholder="Transaction description..."
                            value={query.description}
                            onChange={(e) => handleUpdateQuery(query.id, "description", e.target.value)}
                            className="h-8 text-xs"
                            data-testid={`input-description-${index}`}
                          />
                        </div>

                        {/* Query */}
                        <div className="space-y-1">
                          <Label className="text-xs">Query</Label>
                          <Textarea
                            placeholder="What do you need to ask about this transaction?"
                            value={query.ourQuery}
                            onChange={(e) => handleUpdateQuery(query.id, "ourQuery", e.target.value)}
                            className="text-xs min-h-[60px]"
                            rows={2}
                            data-testid={`input-query-${index}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddQueryRow}
                    className="flex-1"
                    data-testid="button-add-query-row"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Row
                  </Button>
                  <QueryBulkImport
                    onImport={handleBulkImportQueries}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        data-testid="button-import-queries"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Import File
                      </Button>
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleFullClose}
                disabled={isSubmitting}
                data-testid="button-cancel-status-change"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !newStatus || !changeReason}
                data-testid="button-submit-status-change"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
