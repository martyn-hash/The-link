import { useState } from "react";
import { TiptapEditor } from '@/components/TiptapEditor';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { NotificationVariableGuide } from "@/components/NotificationVariableGuide";
import { CharacterCounter } from "../../utils/helpers";
import { Info } from "lucide-react";
import type { ClientRequestTemplate, KanbanStage, ClientProjectTaskTemplate } from "@shared/schema";

interface ProjectNotificationFormProps {
  onCancel: () => void;
  createMutation: any;
  clientRequestTemplates: ClientRequestTemplate[];
  taskTemplates: ClientProjectTaskTemplate[];
  stages?: KanbanStage[];
}

export function ProjectNotificationForm({ 
  onCancel, 
  createMutation,
  clientRequestTemplates,
  taskTemplates,
  stages = []
}: ProjectNotificationFormProps) {
  const [notificationType, setNotificationType] = useState<"email" | "sms" | "push">("email");
  const [dateReference, setDateReference] = useState<"start_date" | "due_date">("due_date");
  const [offsetType, setOffsetType] = useState<"before" | "on" | "after">("before");
  const [offsetDays, setOffsetDays] = useState(7);
  const [emailTitle, setEmailTitle] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsContent, setSmsContent] = useState("");
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [clientRequestTemplateId, setClientRequestTemplateId] = useState<string>("");
  const [taskTemplateId, setTaskTemplateId] = useState<string>("");
  const [eligibleStageIds, setEligibleStageIds] = useState<string[]>([]);
  
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  
  const toggleStage = (stageId: string) => {
    setEligibleStageIds(prev => 
      prev.includes(stageId) 
        ? prev.filter(id => id !== stageId)
        : [...prev, stageId]
    );
  };
  
  const selectAllStages = () => {
    setEligibleStageIds(sortedStages.map(s => s.id));
  };
  
  const clearAllStages = () => {
    setEligibleStageIds([]);
  };

  const handleSubmit = () => {
    const data: any = {
      category: 'project',
      notificationType,
      dateReference,
      offsetType,
      offsetDays,
      clientRequestTemplateId: clientRequestTemplateId || null,
      taskTemplateId: taskTemplateId || null,
      eligibleStageIds: dateReference === 'due_date' && eligibleStageIds.length > 0 
        ? eligibleStageIds 
        : null,
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
    if (notificationType === 'email') return emailTitle && emailBody;
    if (notificationType === 'sms') return smsContent && smsContent.length <= 160;
    if (notificationType === 'push') return pushTitle && pushTitle.length <= 50 && pushBody && pushBody.length <= 120;
    return false;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Project Notification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Notification Type</Label>
            <Select value={notificationType} onValueChange={(v: any) => setNotificationType(v)}>
              <SelectTrigger data-testid="select-notification-type">
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
            <Label>Date Reference</Label>
            <Select value={dateReference} onValueChange={(v: any) => setDateReference(v)}>
              <SelectTrigger data-testid="select-date-reference">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="start_date">Project Start Date</SelectItem>
                <SelectItem value="due_date">Project Due Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Timing</Label>
            <Select value={offsetType} onValueChange={(v: any) => setOffsetType(v)}>
              <SelectTrigger data-testid="select-offset-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before</SelectItem>
                <SelectItem value="on">On</SelectItem>
                <SelectItem value="after">After</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {offsetType !== 'on' && (
            <div className="space-y-2">
              <Label>Days</Label>
              <Input
                type="number"
                value={offsetDays}
                onChange={(e) => setOffsetDays(parseInt(e.target.value) || 0)}
                min={0}
                data-testid="input-offset-days"
              />
            </div>
          )}
        </div>

        {dateReference === 'due_date' && sortedStages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Active in Stages (Optional)</Label>
                <div className="group relative">
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-popover border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <p className="text-xs text-muted-foreground">
                      If you select stages here, this notification will only be sent when the project is in one of these stages. If the project moves to a different stage, the notification will be suppressed. This is useful for "chase" reminders that should stop once the client has provided what you need.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllStages} data-testid="button-select-all-stages">
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAllStages} data-testid="button-clear-all-stages">
                  Clear
                </Button>
              </div>
            </div>
            {eligibleStageIds.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No stages selected - notification will be sent regardless of project stage
              </p>
            )}
            {eligibleStageIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Notification will only be sent when project is in: {eligibleStageIds.length} stage{eligibleStageIds.length !== 1 ? 's' : ''}
              </p>
            )}
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30 max-h-48 overflow-y-auto">
              {sortedStages.map((stage) => (
                <label
                  key={stage.id}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${
                    eligibleStageIds.includes(stage.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'
                  }`}
                  data-testid={`stage-checkbox-${stage.id}`}
                >
                  <Checkbox
                    checked={eligibleStageIds.includes(stage.id)}
                    onCheckedChange={() => toggleStage(stage.id)}
                    className="sr-only"
                  />
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color || '#6b7280' }}
                  />
                  <span className="text-sm font-medium">{stage.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {(notificationType === 'email' || notificationType === 'push') && (
          <div className="space-y-2">
            <Label>Link to Client Request Template (Optional)</Label>
            <Select value={clientRequestTemplateId || 'none'} onValueChange={(value) => setClientRequestTemplateId(value === 'none' ? '' : value)}>
              <SelectTrigger data-testid="select-client-request-template">
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

        {(notificationType === 'email' || notificationType === 'push') && taskTemplates.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Attach Client Task (Optional)</Label>
              <div className="group relative">
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-popover border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <p className="text-xs text-muted-foreground">
                    When this notification fires, a task form will be created for the client to complete. 
                    The task link will be included in the notification automatically.
                  </p>
                </div>
              </div>
            </div>
            <Select value={taskTemplateId || 'none'} onValueChange={(value) => setTaskTemplateId(value === 'none' ? '' : value)}>
              <SelectTrigger data-testid="select-task-template">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {taskTemplates.filter(t => t.isActive).map(template => (
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
                data-testid="input-email-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Body</Label>
              <div data-testid="richtext-email-body">
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
              data-testid="textarea-sms-content"
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
                data-testid="input-push-title"
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
                data-testid="textarea-push-body"
              />
            </div>
          </>
        )}

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-notification">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit()} data-testid="button-save-date-notification">
            Create Notification
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
