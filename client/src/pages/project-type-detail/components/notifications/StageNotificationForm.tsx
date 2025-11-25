import { useState } from "react";
import { TiptapEditor } from '@/components/TiptapEditor';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { NotificationVariableGuide } from "@/components/NotificationVariableGuide";
import { CharacterCounter } from "../../utils/helpers";
import type { KanbanStage, ClientRequestTemplate } from "@shared/schema";

interface StageNotificationFormProps {
  onCancel: () => void;
  createMutation: any;
  stages: KanbanStage[];
  clientRequestTemplates: ClientRequestTemplate[];
}

export function StageNotificationForm({ 
  onCancel, 
  createMutation,
  stages,
  clientRequestTemplates
}: StageNotificationFormProps) {
  const [notificationType, setNotificationType] = useState<"email" | "sms" | "push">("email");
  const [stageId, setStageId] = useState("");
  const [stageTrigger, setStageTrigger] = useState<"entry" | "exit">("entry");
  const [emailTitle, setEmailTitle] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsContent, setSmsContent] = useState("");
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [clientRequestTemplateId, setClientRequestTemplateId] = useState<string>("");

  const handleSubmit = () => {
    const data: any = {
      category: 'stage',
      notificationType,
      stageId,
      stageTrigger,
      clientRequestTemplateId: clientRequestTemplateId || null,
    };

    if (notificationType === 'email') {
      data.emailTitle = emailTitle;
      data.emailBody = emailBody;
    } else if (notificationType === 'sms') {
      data.smsContent = smsContent;
    } else if (notificationType === 'push') {
      data.pushTitle = pushTitle;
      data.pushBody = pushBody;
    }

    createMutation.mutate(data);
  };

  const canSubmit = () => {
    if (!stageId) return false;
    if (notificationType === 'email') return emailTitle && emailBody;
    if (notificationType === 'sms') return smsContent && smsContent.length <= 160;
    if (notificationType === 'push') return pushTitle && pushTitle.length <= 50 && pushBody && pushBody.length <= 120;
    return false;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Stage Notification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Notification Type</Label>
            <Select value={notificationType} onValueChange={(v: any) => setNotificationType(v)}>
              <SelectTrigger data-testid="select-stage-notification-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="push">Push Notification</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Stage</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger data-testid="select-stage">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Trigger</Label>
          <Select value={stageTrigger} onValueChange={(v: any) => setStageTrigger(v)}>
            <SelectTrigger data-testid="select-stage-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entry">When project enters this stage</SelectItem>
              <SelectItem value="exit">When project exits this stage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(notificationType === 'email' || notificationType === 'push') && (
          <div className="space-y-2">
            <Label>Link to Client Request Template (Optional)</Label>
            <Select value={clientRequestTemplateId || 'none'} onValueChange={(value) => setClientRequestTemplateId(value === 'none' ? '' : value)}>
              <SelectTrigger data-testid="select-stage-client-request-template">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {clientRequestTemplates.filter(t => t.status === 'active').map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground mb-2">
            You can personalize your notification using dynamic variables that will be automatically replaced with real data.
          </p>
          <NotificationVariableGuide channel={notificationType} />
        </div>

        {notificationType === 'email' && (
          <>
            <div className="space-y-2">
              <Label>Email Subject</Label>
              <Input
                value={emailTitle}
                onChange={(e) => setEmailTitle(e.target.value)}
                placeholder="Enter email subject"
                data-testid="input-stage-email-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Body</Label>
              <div data-testid="richtext-stage-email-body">
                <TiptapEditor
                  content={emailBody}
                  onChange={setEmailBody}
                  placeholder="Enter email body"
                  editorHeight="250px"
                />
              </div>
            </div>
          </>
        )}

        {notificationType === 'sms' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>SMS Content</Label>
              <CharacterCounter current={smsContent.length} max={160} />
            </div>
            <Textarea
              value={smsContent}
              onChange={(e) => setSmsContent(e.target.value)}
              placeholder="Enter SMS message (max 160 characters)"
              rows={4}
              data-testid="textarea-stage-sms-content"
            />
          </div>
        )}

        {notificationType === 'push' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Push Notification Title</Label>
                <CharacterCounter current={pushTitle.length} max={50} />
              </div>
              <Input
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="Enter push notification title (max 50 characters)"
                data-testid="input-stage-push-title"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Push Notification Body</Label>
                <CharacterCounter current={pushBody.length} max={120} />
              </div>
              <Textarea
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                placeholder="Enter push notification body (max 120 characters)"
                rows={3}
                data-testid="textarea-stage-push-body"
              />
            </div>
          </>
        )}

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-stage-notification">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit()} data-testid="button-save-stage-notification">
            Create Notification
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
