import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TiptapEditor } from "@/components/TiptapEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Mail, 
  MessageSquare, 
  Check,
  AlertCircle,
  User,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Mic,
  Send
} from "lucide-react";
import { StageNotificationAudioRecorder } from "./StageNotificationAudioRecorder";
import { useToast } from "@/hooks/use-toast";
import type { ClientValueNotificationPreview } from "@shared/schema";

interface EmailContext {
  recipientNames?: string;
  senderName?: string;
  clientCompany?: string;
}

interface ClientValueNotificationContentProps {
  preview: ClientValueNotificationPreview;
  projectId: string;
  onSend: (data: {
    emailSubject: string;
    emailBody: string;
    suppress: boolean;
    sendEmail: boolean;
    sendSms: boolean;
    smsBody: string | null;
    emailRecipientIds: string[];
    smsRecipientIds: string[];
  }) => Promise<void>;
  onClose: () => void;
  isSending: boolean;
  onAiRefine?: (prompt: string, currentSubject: string, currentBody: string, context?: EmailContext) => Promise<{ subject: string; body: string }>;
  senderName?: string;
}

export function ClientValueNotificationContent({
  preview,
  projectId,
  onSend,
  onClose,
  isSending,
  onAiRefine,
  senderName,
}: ClientValueNotificationContentProps) {
  const { toast } = useToast();
  const [emailSubject, setEmailSubject] = useState(preview.emailSubject);
  const [emailBody, setEmailBody] = useState(preview.emailBody);
  
  // Store the original template to allow re-resolving when recipients change
  const emailBodyTemplateRef = useRef(preview.emailBody);
  const emailSubjectTemplateRef = useRef(preview.emailSubject);
  
  // Track the last resolved names to enable smart replacement
  const lastResolvedNamesRef = useRef<string>("");
  
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [smsOpen, setSmsOpen] = useState(false);
  
  const [aiPrompt, setAiPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [showPromptField, setShowPromptField] = useState(false);
  
  // Start with zero recipients selected by default
  const [emailRecipients, setEmailRecipients] = useState<Set<string>>(new Set());
  const [smsRecipients, setSmsRecipients] = useState<Set<string>>(new Set());
  
  const emailEligibleRecipients = preview.recipients.filter(r => r.email);
  const smsEligibleRecipients = preview.recipients.filter(r => r.mobile);
  
  // Helper function to extract first name from various formats
  const extractFirstName = (fullName: string): string => {
    if (!fullName) return "";
    
    // Handle "LASTNAME, Firstname" format (common in UK/formal systems)
    if (fullName.includes(",")) {
      const parts = fullName.split(",");
      if (parts.length >= 2) {
        // Take the part after the comma, trim whitespace, and get first word
        const afterComma = parts[1].trim();
        return afterComma.split(/\s+/)[0] || "";
      }
    }
    
    // Handle "Firstname Lastname" format
    return fullName.split(/\s+/)[0] || "";
  };
  
  // Helper function to format recipient first names for personalization
  // If no recipients selected, uses all email-eligible recipients for context
  const formatRecipientFirstNames = (recipientIds: Set<string>): string => {
    // Use selected recipients if any, otherwise all email-eligible recipients
    const recipientsToUse = recipientIds.size > 0 
      ? preview.recipients.filter(r => recipientIds.has(r.personId))
      : emailEligibleRecipients;
    
    const names = recipientsToUse
      .map(r => extractFirstName(r.fullName || ""))
      .filter(name => name.length > 0);
    
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    
    // For 3+ names: "John, Sarah and Mike"
    const lastTwo = names.slice(-2).join(" and ");
    const rest = names.slice(0, -2);
    return [...rest, lastTwo].join(", ");
  };
  
  // Get current recipient names
  const recipientNames = formatRecipientFirstNames(emailRecipients);
  
  // Build AI context for personalization
  const getAiContext = (): EmailContext => ({
    recipientNames: recipientNames || undefined,
    senderName: senderName || undefined,
    clientCompany: preview.metadata.clientName || undefined,
  });
  
  // Effect to update email content when recipients change
  useEffect(() => {
    const newNames = recipientNames;
    const oldNames = lastResolvedNamesRef.current;
    const template = emailBodyTemplateRef.current;
    const subjectTemplate = emailSubjectTemplateRef.current;
    
    // Only update if names have changed
    if (newNames === oldNames) return;
    
    // Update email body
    if (template.includes("{recipient_first_names}")) {
      if (oldNames && emailBody.includes(oldNames)) {
        // Replace old names with new names
        setEmailBody(prev => prev.replace(oldNames, newNames || "{recipient_first_names}"));
      } else if (emailBody.includes("{recipient_first_names}")) {
        // Variable is still in content, replace it
        setEmailBody(prev => prev.replace(/\{recipient_first_names\}/g, newNames || "{recipient_first_names}"));
      }
    }
    
    // Update email subject
    if (subjectTemplate.includes("{recipient_first_names}")) {
      if (oldNames && emailSubject.includes(oldNames)) {
        setEmailSubject(prev => prev.replace(oldNames, newNames || "{recipient_first_names}"));
      } else if (emailSubject.includes("{recipient_first_names}")) {
        setEmailSubject(prev => prev.replace(/\{recipient_first_names\}/g, newNames || "{recipient_first_names}"));
      }
    }
    
    lastResolvedNamesRef.current = newNames;
  }, [recipientNames, emailBody, emailSubject]);
  
  const toggleRecipient = (
    personId: string, 
    channel: 'email' | 'sms'
  ) => {
    const setFn = channel === 'email' ? setEmailRecipients : setSmsRecipients;
    const current = channel === 'email' ? emailRecipients : smsRecipients;
    
    const newSet = new Set(current);
    if (newSet.has(personId)) {
      newSet.delete(personId);
    } else {
      newSet.add(personId);
    }
    setFn(newSet);
  };
  
  const toggleAllRecipients = (
    channel: 'email' | 'sms',
    eligible: typeof preview.recipients,
    selected: Set<string>,
    setSelected: (s: Set<string>) => void
  ) => {
    if (selected.size === eligible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map(r => r.personId)));
    }
  };

  const handleVoiceResult = (result: {
    subject: string;
    body: string;
    pushTitle: string;
    pushBody: string;
    transcription: string;
  }) => {
    if (result.subject) setEmailSubject(result.subject);
    if (result.body) setEmailBody(result.body);
  };

  const handleAiRefine = async () => {
    if (!aiPrompt.trim() || !onAiRefine) return;
    
    setIsRefining(true);
    try {
      const context = getAiContext();
      const result = await onAiRefine(aiPrompt, emailSubject, emailBody, context);
      if (result.subject) setEmailSubject(result.subject);
      if (result.body) setEmailBody(result.body);
      setAiPrompt("");
      setShowPromptField(false);
      toast({
        title: "Email refined",
        description: "The AI has updated your email content.",
      });
    } catch (error) {
      console.error("AI refinement failed:", error);
      toast({
        title: "Refinement failed",
        description: "Unable to refine email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefining(false);
    }
  };

  const hasEnabledChannel = 
    (sendEmail && emailRecipients.size > 0) || 
    (sendSms && smsRecipients.size > 0);

  const handleSend = async (suppress: boolean) => {
    // Send the current email state (recipient names already resolved by useEffect)
    await onSend({
      emailSubject,
      emailBody,
      suppress,
      sendEmail: sendEmail && emailRecipients.size > 0,
      sendSms: sendSms && smsRecipients.size > 0,
      smsBody: smsBody || null,
      emailRecipientIds: Array.from(emailRecipients),
      smsRecipientIds: Array.from(smsRecipients),
    });
  };

  const formatRole = (role: string | null): string => {
    if (!role) return "";
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Compact Sender Status */}
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${preview.senderHasOutlook ? 'bg-green-50 dark:bg-green-950/30' : 'bg-amber-50 dark:bg-amber-950/30'}`}>
          {preview.senderHasOutlook ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              <span className="text-green-700 dark:text-green-300">
                Sending from Microsoft 365 {preview.senderEmail && <span className="text-green-600 dark:text-green-400">({preview.senderEmail})</span>}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-700 dark:text-amber-300">Email access not enabled - using system mailer</span>
            </>
          )}
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          {/* Left Column: Recipients & AI */}
          <div className="space-y-4">
            {/* Email Toggle & Recipients */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Email</Label>
                </div>
                <Switch
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                  data-testid="switch-send-email"
                />
              </div>

              {sendEmail && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Recipients</Label>
                    {emailEligibleRecipients.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-xs px-1"
                        onClick={() => toggleAllRecipients('email', emailEligibleRecipients, emailRecipients, setEmailRecipients)}
                        data-testid="button-toggle-all-email"
                      >
                        {emailRecipients.size === emailEligibleRecipients.length ? 'None' : 'All'}
                      </Button>
                    )}
                  </div>
                  {emailEligibleRecipients.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No contacts with email</p>
                  ) : (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {emailEligibleRecipients.map((recipient) => (
                        <div key={recipient.personId} className="flex items-center gap-2">
                          <Checkbox
                            id={`email-${recipient.personId}`}
                            checked={emailRecipients.has(recipient.personId)}
                            onCheckedChange={() => toggleRecipient(recipient.personId, 'email')}
                            data-testid={`checkbox-email-${recipient.personId}`}
                            className="h-3.5 w-3.5"
                          />
                          <label
                            htmlFor={`email-${recipient.personId}`}
                            className="text-xs cursor-pointer flex-1 flex items-center gap-1 truncate"
                          >
                            <span className="font-medium truncate">{recipient.fullName}</span>
                            {recipient.role && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {formatRole(recipient.role)}
                              </Badge>
                            )}
                            {!recipient.receiveNotifications && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Opted out</Badge>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                  {emailRecipients.size > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {emailRecipients.size} selected
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Assistance Section */}
            <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <Label className="text-sm font-medium">AI Assist</Label>
              </div>
              
              {/* Two-button row: Record and Prompt - equal width */}
              <div className="grid grid-cols-2 gap-2">
                {/* Voice Recording */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Record</Label>
                  <StageNotificationAudioRecorder
                    projectId={projectId}
                    onResult={handleVoiceResult}
                    disabled={isSending}
                    existingSubject={emailSubject}
                    existingBody={emailBody}
                    compact
                    context={getAiContext()}
                  />
                </div>

                {/* Prompt Button - opens modal */}
                {onAiRefine && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Refine</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs px-2 gap-1"
                      onClick={() => setShowPromptField(true)}
                      disabled={isSending}
                      data-testid="button-toggle-prompt"
                    >
                      <Sparkles className="h-3 w-3" />
                      Prompt
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* AI Prompt Modal */}
            <Dialog open={showPromptField} onOpenChange={setShowPromptField}>
              <DialogContent className="sm:max-w-md" data-testid="dialog-ai-prompt">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    AI Email Assistant
                  </DialogTitle>
                  <DialogDescription>
                    Describe what you'd like your email to say. The AI will refine the current content based on your direction.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Provide direction about what you want your email to say. It will also include any information currently in the body of the email."
                    className="min-h-[120px] resize-none"
                    data-testid="input-ai-prompt"
                    disabled={isRefining}
                    autoFocus
                  />
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowPromptField(false)}
                    disabled={isRefining}
                    data-testid="button-ai-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAiRefine}
                    disabled={!aiPrompt.trim() || isRefining}
                    data-testid="button-ai-refine"
                    className="gap-1"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isRefining ? "Refining..." : "Apply"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Context Info */}
            <div className="text-xs text-muted-foreground space-y-0.5 px-1">
              <div className="truncate" data-testid="text-project-name">
                <span className="font-medium">Project:</span> {preview.metadata.projectName}
              </div>
              <div className="truncate" data-testid="text-client-name">
                <span className="font-medium">Client:</span> {preview.metadata.clientName}
              </div>
              <div data-testid="text-stage-change">
                <span className="font-medium">Stage:</span>{" "}
                {preview.oldStageName ? `${preview.oldStageName} → ` : ""}
                {preview.newStageName}
              </div>
            </div>
          </div>

          {/* Right Column: Subject & Body */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email-subject" className="text-sm">Subject</Label>
              <Input
                id="email-subject"
                data-testid="input-email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-body" className="text-sm">Message</Label>
              <div data-testid="editor-email-body" className="border rounded-md">
                <TiptapEditor
                  content={emailBody}
                  onChange={setEmailBody}
                  placeholder="Email body content..."
                  editorHeight="250px"
                />
              </div>
              {/* Show hint when template has variable but no recipients selected */}
              {emailBodyTemplateRef.current.includes("{recipient_first_names}") && emailRecipients.size === 0 && (
                <div className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-2 py-1.5 rounded border border-amber-200 dark:border-amber-800" data-testid="preview-recipient-names">
                  <span className="font-medium">Tip:</span>
                  {" Select recipients above to personalize the greeting with their names."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SMS Section (Collapsible) */}
        <Collapsible open={smsOpen} onOpenChange={setSmsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-muted-foreground">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-xs">SMS Notification</span>
              </div>
              {smsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Enable SMS</Label>
                <Switch
                  checked={sendSms}
                  onCheckedChange={setSendSms}
                  data-testid="switch-send-sms"
                />
              </div>

              {sendSms && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Recipients (with mobile)</Label>
                      {smsEligibleRecipients.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-xs px-1"
                          onClick={() => toggleAllRecipients('sms', smsEligibleRecipients, smsRecipients, setSmsRecipients)}
                          data-testid="button-toggle-all-sms"
                        >
                          {smsRecipients.size === smsEligibleRecipients.length ? 'None' : 'All'}
                        </Button>
                      )}
                    </div>
                    {smsEligibleRecipients.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No contacts with mobile</p>
                    ) : (
                      <div className="space-y-1">
                        {smsEligibleRecipients.map((recipient) => (
                          <div key={recipient.personId} className="flex items-center gap-2">
                            <Checkbox
                              id={`sms-${recipient.personId}`}
                              checked={smsRecipients.has(recipient.personId)}
                              onCheckedChange={() => toggleRecipient(recipient.personId, 'sms')}
                              data-testid={`checkbox-sms-${recipient.personId}`}
                              className="h-3.5 w-3.5"
                            />
                            <label
                              htmlFor={`sms-${recipient.personId}`}
                              className="text-xs cursor-pointer flex-1 flex items-center gap-1"
                            >
                              <span className="font-medium">{recipient.fullName}</span>
                              {recipient.role && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                  {formatRole(recipient.role)}
                                </Badge>
                              )}
                              <span className="text-muted-foreground">({recipient.mobile})</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="sms-body" className="text-xs">Message (max 160)</Label>
                    <Textarea
                      id="sms-body"
                      data-testid="input-sms-body"
                      value={smsBody}
                      onChange={(e) => setSmsBody(e.target.value.slice(0, 160))}
                      placeholder="SMS message..."
                      maxLength={160}
                      rows={2}
                      className="text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">{smsBody.length}/160</p>
                  </div>
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <DialogFooter className="flex gap-2 sm:gap-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => handleSend(true)}
          disabled={isSending}
          data-testid="button-dont-notify"
          size="sm"
        >
          Don't Notify
        </Button>
        <Button
          onClick={() => handleSend(false)}
          disabled={isSending || !hasEnabledChannel}
          data-testid="button-send"
          size="sm"
          className="gap-1"
        >
          <Send className="h-3.5 w-3.5" />
          {isSending ? "Sending..." : hasEnabledChannel ? "Send" : "Select Recipients"}
        </Button>
      </DialogFooter>
    </>
  );
}
