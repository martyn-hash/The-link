import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProjectTypeNotification, KanbanStage, ClientRequestTemplate, ProjectType } from "@shared/schema";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { NotificationVariableGuide } from "@/components/NotificationVariableGuide";

// Character counter component
function CharacterCounter({ current, max }: { current: number; max: number }) {
  const percentage = (current / max) * 100;
  const colorClass = percentage > 100 ? "text-destructive" : percentage > 80 ? "text-yellow-600" : "text-muted-foreground";
  
  return (
    <span className={`text-xs ${colorClass}`}>
      {current}/{max}
    </span>
  );
}

export default function NotificationEditPage() {
  const params = useParams<{ projectTypeId: string; notificationId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const projectTypeId = params.projectTypeId!;
  const notificationId = params.notificationId!;
  
  // Fetch notification data
  const { data: notification, isLoading: notificationLoading } = useQuery<ProjectTypeNotification>({
    queryKey: [`/api/project-types/${projectTypeId}/notifications/${notificationId}`],
  });
  
  // Fetch project type data for stages
  const { data: projectType, isLoading: projectTypeLoading } = useQuery<ProjectType>({
    queryKey: [`/api/project-types/${projectTypeId}`],
  });
  
  // Fetch client request templates
  const { data: clientRequestTemplates = [], isLoading: templatesLoading } = useQuery<ClientRequestTemplate[]>({
    queryKey: ['/api/client-request-templates'],
  });
  
  // Form state
  const [notificationType, setNotificationType] = useState<"email" | "sms" | "push">("email");
  const [dateReference, setDateReference] = useState<"start_date" | "due_date">("due_date");
  const [offsetType, setOffsetType] = useState<"before" | "on" | "after">("before");
  const [offsetDays, setOffsetDays] = useState(7);
  const [stageId, setStageId] = useState("");
  const [stageTrigger, setStageTrigger] = useState<"entry" | "exit">("entry");
  const [emailTitle, setEmailTitle] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsContent, setSmsContent] = useState("");
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [clientRequestTemplateId, setClientRequestTemplateId] = useState<string>("");
  
  // Initialize form when notification loads
  useEffect(() => {
    if (notification) {
      setNotificationType(notification.notificationType);
      setEmailTitle(notification.emailTitle || "");
      setEmailBody(notification.emailBody || "");
      setSmsContent(notification.smsContent || "");
      setPushTitle(notification.pushTitle || "");
      setPushBody(notification.pushBody || "");
      setClientRequestTemplateId(notification.clientRequestTemplateId || "");
      
      if (notification.category === 'project') {
        setDateReference(notification.dateReference || "due_date");
        setOffsetType(notification.offsetType || "before");
        setOffsetDays(notification.offsetDays || 7);
      } else {
        setStageId(notification.stageId || "");
        setStageTrigger(notification.stageTrigger || "entry");
      }
    }
  }, [notification]);
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', `/api/notifications/${notificationId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Notification updated",
        description: "The notification has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/project-types', projectTypeId] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-types', projectTypeId, 'notifications'] });
      navigate(`/settings/project-types/${projectTypeId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update notification",
        variant: "destructive",
      });
    },
  });
  
  const handleSubmit = () => {
    if (!notification) return;
    
    const data: any = {
      notificationType,
      clientRequestTemplateId: clientRequestTemplateId || null,
    };
    
    if (notification.category === 'project') {
      data.dateReference = dateReference;
      data.offsetType = offsetType;
      data.offsetDays = offsetDays;
    } else {
      data.stageId = stageId;
      data.stageTrigger = stageTrigger;
    }
    
    if (notificationType === 'email') {
      data.emailTitle = emailTitle;
      data.emailBody = emailBody;
    } else if (notificationType === 'sms') {
      data.smsContent = smsContent;
    } else if (notificationType === 'push') {
      data.pushTitle = pushTitle;
      data.pushBody = pushBody;
    }
    
    updateMutation.mutate(data);
  };
  
  const canSubmit = () => {
    if (!notification) return false;
    if (notification.category === 'stage' && !stageId) return false;
    if (notificationType === 'email') return emailTitle && emailBody;
    if (notificationType === 'sms') return smsContent && smsContent.length <= 160;
    if (notificationType === 'push') return pushTitle && pushTitle.length <= 50 && pushBody && pushBody.length <= 120;
    return false;
  };
  
  const handleCancel = () => {
    navigate(`/settings/project-types/${projectTypeId}`);
  };
  
  const isLoading = notificationLoading || projectTypeLoading || templatesLoading;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!notification) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Notification not found</p>
            <div className="flex justify-center mt-4">
              <Button onClick={handleCancel} data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project Type
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const stages = projectType?.stages || [];
  
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={handleCancel}
          className="mb-4"
          data-testid="button-back-header"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project Type
        </Button>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Edit {notification.category === 'project' ? 'Project' : 'Stage'} Notification
        </h1>
      </div>
      
      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            
            {notification.category === 'project' ? (
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
            ) : (
              <div className="space-y-2">
                <Label>Stage</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger data-testid="select-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage: KanbanStage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {notification.category === 'project' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          ) : (
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={stageTrigger} onValueChange={(v: any) => setStageTrigger(v)}>
                <SelectTrigger data-testid="select-stage-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry (when project enters stage)</SelectItem>
                  <SelectItem value="exit">Exit (when project exits stage)</SelectItem>
                </SelectContent>
              </Select>
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
                  <ReactQuill
                    value={emailBody}
                    onChange={setEmailBody}
                    theme="snow"
                    placeholder="Enter email body"
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link'],
                        ['clean']
                      ]
                    }}
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
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={updateMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit() || updateMutation.isPending}
              data-testid="button-save"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
