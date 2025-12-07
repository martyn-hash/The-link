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
import { Mail, Bell, Mic, MessageSquare } from "lucide-react";
import { StageNotificationAudioRecorder } from "../StageNotificationAudioRecorder";
import type { StageChangeNotificationPreview } from "@shared/schema";
import type { StaffNotificationSendData, VoiceResultData, NotificationChannel } from "@/types/changeStatus";
import { extractFirstName } from "@/lib/changeStatusUtils";

interface StaffNotificationContentProps {
  preview: StageChangeNotificationPreview;
  projectId: string;
  onSend: (data: StaffNotificationSendData) => Promise<void>;
  onClose: () => void;
  isSending: boolean;
  senderName?: string;
}

export function StaffNotificationContent({
  preview,
  projectId,
  onSend,
  onClose,
  isSending,
  senderName,
}: StaffNotificationContentProps) {
  const [emailSubject, setEmailSubject] = useState(preview.emailSubject);
  const [emailBody, setEmailBody] = useState(preview.emailBody);
  const [pushTitle, setPushTitle] = useState(preview.pushTitle || "");
  const [pushBody, setPushBody] = useState(preview.pushBody || "");
  
  const [sendEmail, setSendEmail] = useState(true);
  const [sendPush, setSendPush] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  
  const [emailRecipients, setEmailRecipients] = useState<Set<string>>(
    new Set(preview.recipients.filter(r => r.email).map(r => r.userId))
  );
  const [pushRecipients, setPushRecipients] = useState<Set<string>>(
    new Set(preview.recipients.filter(r => r.hasPushSubscription).map(r => r.userId))
  );
  const [smsRecipients, setSmsRecipients] = useState<Set<string>>(
    new Set(preview.recipients.filter(r => r.mobile).map(r => r.userId))
  );
  
  const emailEligibleRecipients = preview.recipients.filter(r => r.email);
  const pushEligibleRecipients = preview.recipients.filter(r => r.hasPushSubscription);
  const smsEligibleRecipients = preview.recipients.filter(r => r.mobile);
  
  const formatRecipientFirstNames = (recipientIds: Set<string>): string => {
    const recipientsToUse = recipientIds.size > 0 
      ? preview.recipients.filter(r => recipientIds.has(r.userId))
      : emailEligibleRecipients;
    
    const names = recipientsToUse
      .map(r => extractFirstName(r.name || ""))
      .filter(name => name.length > 0);
    
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    
    const lastTwo = names.slice(-2).join(" and ");
    const rest = names.slice(0, -2);
    return [...rest, lastTwo].join(", ");
  };
  
  const getAiContext = () => ({
    recipientNames: formatRecipientFirstNames(emailRecipients) || undefined,
    senderName: senderName || undefined,
  });
  
  const toggleRecipient = (
    recipientId: string, 
    channel: NotificationChannel
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
  
  const toggleAllRecipients = (
    channel: NotificationChannel,
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

  const handleVoiceResult = (result: VoiceResultData) => {
    if (result.subject) setEmailSubject(result.subject);
    if (result.body) setEmailBody(result.body);
    if (result.pushTitle) setPushTitle(result.pushTitle);
    if (result.pushBody) setPushBody(result.pushBody);
  };

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
              disabled
            />
          </div>

          {sendSms && (
            <>
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
