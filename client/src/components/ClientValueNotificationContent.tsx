import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TiptapEditor } from "@/components/TiptapEditor";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DialogFooter } from "@/components/ui/dialog";
import { 
  Mail, 
  MessageSquare, 
  Mic,
  Check,
  AlertCircle,
  User
} from "lucide-react";
import { StageNotificationAudioRecorder } from "./StageNotificationAudioRecorder";
import type { ClientValueNotificationPreview } from "@shared/schema";

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
}

export function ClientValueNotificationContent({
  preview,
  projectId,
  onSend,
  onClose,
  isSending,
}: ClientValueNotificationContentProps) {
  const [emailSubject, setEmailSubject] = useState(preview.emailSubject);
  const [emailBody, setEmailBody] = useState(preview.emailBody);
  
  // Per-channel send controls
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  
  // Per-channel recipient selection (default to all recipients with valid contact info who accept notifications)
  const [emailRecipients, setEmailRecipients] = useState<Set<string>>(
    new Set(preview.recipients.filter(r => r.email && r.receiveNotifications).map(r => r.personId))
  );
  const [smsRecipients, setSmsRecipients] = useState<Set<string>>(
    new Set(preview.recipients.filter(r => r.mobile && r.receiveNotifications).map(r => r.personId))
  );
  
  // Recipients filtered by available contact method
  const emailEligibleRecipients = preview.recipients.filter(r => r.email);
  const smsEligibleRecipients = preview.recipients.filter(r => r.mobile);
  
  // Toggle a recipient for a channel
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
  
  // Toggle all recipients for a channel
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
    // Push fields ignored for client notifications
  };

  // Check if at least one channel is enabled with recipients
  const hasEnabledChannel = 
    (sendEmail && emailRecipients.size > 0) || 
    (sendSms && smsRecipients.size > 0);

  const handleSend = async (suppress: boolean) => {
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

  // Format role for display
  const formatRole = (role: string | null): string => {
    if (!role) return "";
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <>
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {/* Sender Status */}
        <div className={`p-3 rounded-lg border ${preview.senderHasOutlook ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'}`}>
          <div className="flex items-center gap-2">
            {preview.senderHasOutlook ? (
              <>
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Email will be sent from your Outlook account
                </span>
                {preview.senderEmail && (
                  <span className="text-sm text-green-600 dark:text-green-400">({preview.senderEmail})</span>
                )}
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Outlook not connected - email will be sent via system mailer
                </span>
              </>
            )}
          </div>
        </div>

        {/* Voice Recording for AI-assisted drafting */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium mb-1">AI-Assisted Message Drafting</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Record a voice message and let AI draft your client notification. Your completed work items will be automatically included.
              </p>
              <StageNotificationAudioRecorder
                projectId={projectId}
                onResult={handleVoiceResult}
                disabled={isSending}
                existingSubject={emailSubject}
                existingBody={emailBody}
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
                  <Label className="text-xs text-muted-foreground">Select Client Contacts</Label>
                  {emailEligibleRecipients.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => toggleAllRecipients('email', emailEligibleRecipients, emailRecipients, setEmailRecipients)}
                      data-testid="button-toggle-all-email"
                    >
                      {emailRecipients.size === emailEligibleRecipients.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                </div>
                {emailEligibleRecipients.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No client contacts with email addresses</p>
                ) : (
                  <div className="space-y-1">
                    {emailEligibleRecipients.map((recipient) => (
                      <div key={recipient.personId} className="flex items-center gap-2">
                        <Checkbox
                          id={`email-${recipient.personId}`}
                          checked={emailRecipients.has(recipient.personId)}
                          onCheckedChange={() => toggleRecipient(recipient.personId, 'email')}
                          data-testid={`checkbox-email-${recipient.personId}`}
                        />
                        <label
                          htmlFor={`email-${recipient.personId}`}
                          className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                        >
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{recipient.fullName}</span>
                          {recipient.role && (
                            <Badge variant="outline" className="text-xs">
                              {formatRole(recipient.role)}
                            </Badge>
                          )}
                          {recipient.isPrimaryContact && (
                            <Badge variant="secondary" className="text-xs">Primary</Badge>
                          )}
                          <span className="text-muted-foreground">({recipient.email})</span>
                          {!recipient.receiveNotifications && (
                            <Badge variant="destructive" className="text-xs">Opted out</Badge>
                          )}
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
                  <Label className="text-xs text-muted-foreground">Select Client Contacts (with mobile number)</Label>
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
                  <p className="text-xs text-muted-foreground italic">No client contacts with mobile numbers</p>
                ) : (
                  <div className="space-y-1">
                    {smsEligibleRecipients.map((recipient) => (
                      <div key={recipient.personId} className="flex items-center gap-2">
                        <Checkbox
                          id={`sms-${recipient.personId}`}
                          checked={smsRecipients.has(recipient.personId)}
                          onCheckedChange={() => toggleRecipient(recipient.personId, 'sms')}
                          data-testid={`checkbox-sms-${recipient.personId}`}
                        />
                        <label
                          htmlFor={`sms-${recipient.personId}`}
                          className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                        >
                          <span className="font-medium">{recipient.fullName}</span>
                          {recipient.role && (
                            <Badge variant="outline" className="text-xs">
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
              <span className="font-medium">Stage Update:</span>{" "}
              {preview.oldStageName ? `${preview.oldStageName} → ` : ""}
              {preview.newStageName}
            </div>
            {preview.metadata.dueDate && (
              <div data-testid="text-due-date">
                <span className="font-medium">Due Date:</span> {preview.metadata.dueDate}
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
          {isSending ? "Sending..." : hasEnabledChannel ? "Send to Client" : "Select a Channel"}
        </Button>
      </DialogFooter>
    </>
  );
}
