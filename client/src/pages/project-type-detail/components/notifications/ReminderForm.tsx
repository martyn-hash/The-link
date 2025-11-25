import { useState } from "react";
import { TiptapEditor } from '@/components/TiptapEditor';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CharacterCounter } from "../../utils/helpers";

interface ReminderFormProps {
  notificationId: string;
  onCancel: () => void;
  createMutation: any;
}

export function ReminderForm({
  notificationId,
  onCancel,
  createMutation
}: ReminderFormProps) {
  const [notificationType, setNotificationType] = useState<"email" | "push">("email");
  const [daysAfter, setDaysAfter] = useState(7);
  const [emailTitle, setEmailTitle] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");

  const handleSubmit = () => {
    const data: any = {
      notificationId,
      notificationType,
      daysAfterCreation: daysAfter,
    };

    if (notificationType === 'email') {
      data.emailTitle = emailTitle;
      data.emailBody = emailBody;
    } else {
      data.pushTitle = pushTitle;
      data.pushBody = pushBody;
    }

    createMutation.mutate(data);
  };

  const canSubmit = () => {
    if (notificationType === 'email') return emailTitle && emailBody;
    if (notificationType === 'push') return pushTitle && pushTitle.length <= 50 && pushBody && pushBody.length <= 120;
    return false;
  };

  return (
    <Card className="mt-2">
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Notification Type</Label>
            <Select value={notificationType} onValueChange={(v: any) => setNotificationType(v)}>
              <SelectTrigger data-testid="select-reminder-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="push">Push Notification</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Days After Request Created</Label>
            <Input
              type="number"
              value={daysAfter}
              onChange={(e) => setDaysAfter(parseInt(e.target.value) || 0)}
              min={1}
              data-testid="input-reminder-days-after"
            />
          </div>
        </div>

        {notificationType === 'email' && (
          <>
            <div className="space-y-2">
              <Label>Email Subject</Label>
              <Input
                value={emailTitle}
                onChange={(e) => setEmailTitle(e.target.value)}
                placeholder="Enter email subject"
                data-testid="input-reminder-email-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Body</Label>
              <div data-testid="richtext-reminder-email-body">
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
                data-testid="input-reminder-push-title"
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
                data-testid="textarea-reminder-push-body"
              />
            </div>
          </>
        )}

        <div className="flex justify-end space-x-2">
          <Button variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel-reminder">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit()} data-testid="button-save-reminder">
            Add Reminder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
