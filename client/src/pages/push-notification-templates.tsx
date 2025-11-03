import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Bell, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NotificationTemplate {
  id: string;
  templateType: string;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
  iconUrl: string | null;
  badgeUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATE_INFO: Record<string, { 
  label: string; 
  description: string;
  sampleData: Record<string, string>;
  variables: string[];
}> = {
  new_message_staff: {
    label: "New Message (Staff to Staff)",
    description: "Sent when a staff member receives a new message from another staff member",
    sampleData: { staffName: "John Smith", message: "Hello, this is a test message..." },
    variables: ["staffName", "message"]
  },
  new_message_client: {
    label: "New Message (Client to Staff)",
    description: "Sent when a staff member receives a new message from a client",
    sampleData: { clientName: "Acme Corp", message: "Hello, this is a test message..." },
    variables: ["clientName", "message"]
  },
  document_request: {
    label: "Document Request",
    description: "Sent when a document is requested from a user",
    sampleData: { documentName: "Tax Return 2024", clientName: "Acme Corp", staffName: "Jane Doe" },
    variables: ["documentName", "clientName", "staffName"]
  },
  task_assigned: {
    label: "Task Assigned",
    description: "Sent when a task is assigned to a user",
    sampleData: { taskTitle: "Review Financial Statement", staffName: "John Smith", dueDate: "March 15, 2025" },
    variables: ["taskTitle", "staffName", "dueDate"]
  },
  project_stage_change: {
    label: "Project Stage Change",
    description: "Sent when a project moves to a new stage",
    sampleData: { 
      projectName: "Monthly Bookkeeping", 
      clientName: "Acme Corp", 
      fromStage: "In Review", 
      toStage: "Client Approval", 
      assigneeName: "Jane Doe" 
    },
    variables: ["projectName", "clientName", "fromStage", "toStage", "assigneeName"]
  },
  status_update: {
    label: "Status Update",
    description: "Sent when there's an important status update for a user",
    sampleData: { message: "Your tax return has been filed successfully" },
    variables: ["message"]
  },
  reminder: {
    label: "Reminder",
    description: "Sent as reminders for upcoming or overdue tasks",
    sampleData: { taskTitle: "Complete Quarterly Review", dueDate: "Tomorrow" },
    variables: ["taskTitle", "dueDate"]
  },
};

export default function PushNotificationTemplates() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [testingTemplateId, setTestingTemplateId] = useState<string | null>(null);

  const { data: templates, isLoading: templatesLoading } = useQuery<NotificationTemplate[]>({
    queryKey: ["/api/push/templates"],
    enabled: isAuthenticated && !!user?.isAdmin,
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<NotificationTemplate> }) => {
      return await apiRequest("PATCH", `/api/push/templates/${data.id}`, data.updates);
    },
    onSuccess: () => {
      toast({
        title: "Template Updated",
        description: "The notification template has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/push/templates"] });
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update template.",
        variant: "destructive",
      });
    },
  });

  const testTemplateMutation = useMutation({
    mutationFn: async (data: { templateId: string; sampleData: Record<string, string> }) => {
      return await apiRequest("POST", "/api/push/templates/test", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Test Notification Sent",
        description: `Successfully sent ${data.successful} notification(s). Check your device!`,
      });
      setTestingTemplateId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test notification.",
        variant: "destructive",
      });
      setTestingTemplateId(null);
    },
  });

  const handleToggle = (template: NotificationTemplate) => {
    updateTemplateMutation.mutate({
      id: template.id,
      updates: { isActive: !template.isActive }
    });
  };

  const handleSave = (template: NotificationTemplate) => {
    updateTemplateMutation.mutate({
      id: template.id,
      updates: {
        titleTemplate: template.titleTemplate,
        bodyTemplate: template.bodyTemplate,
        iconUrl: template.iconUrl,
        badgeUrl: template.badgeUrl,
      }
    });
  };

  const handleTest = (template: NotificationTemplate) => {
    const info = TEMPLATE_INFO[template.templateType];
    setTestingTemplateId(template.id);
    testTemplateMutation.mutate({
      templateId: template.id,
      sampleData: info?.sampleData || {}
    });
  };

  if (isLoading || templatesLoading) {
    return (
      <div className="flex flex-col h-screen bg-background dark:bg-background">
        <TopNavigation />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="flex flex-col h-screen bg-background dark:bg-background">
        <TopNavigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Only administrators can access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background dark:bg-background">
      <TopNavigation />
      
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Push Notification Templates</h1>
            <p className="text-muted-foreground">
              Customize how push notifications appear for different events in the system
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {templates?.map((template) => {
            const info = TEMPLATE_INFO[template.templateType];
            const isEditing = editingTemplate?.id === template.id;
            const currentTemplate = isEditing ? editingTemplate : template;

            return (
              <Card key={template.id} data-testid={`card-template-${template.templateType}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">{info?.label || template.name}</CardTitle>
                        <Badge variant={template.isActive ? "default" : "secondary"} data-testid={`badge-status-${template.templateType}`}>
                          {template.isActive ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <CardDescription className="mt-2">{info?.description}</CardDescription>
                      {info?.variables && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {info.variables.map((variable) => (
                            <Badge key={variable} variant="outline" className="font-mono text-xs">
                              {`{${variable}}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(template)}
                        disabled={!template.isActive || testingTemplateId === template.id}
                        data-testid={`button-test-${template.templateType}`}
                      >
                        {testingTemplateId === template.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        <span className="ml-2">Test</span>
                      </Button>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.isActive}
                          onCheckedChange={() => handleToggle(template)}
                          data-testid={`switch-enable-${template.templateType}`}
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`title-${template.id}`}>Title Template</Label>
                      <Input
                        id={`title-${template.id}`}
                        value={currentTemplate.titleTemplate}
                        onChange={(e) => {
                          if (isEditing) {
                            setEditingTemplate({ ...editingTemplate, titleTemplate: e.target.value });
                          } else {
                            setEditingTemplate({ ...template, titleTemplate: e.target.value });
                          }
                        }}
                        placeholder="e.g., New message from {staffName}"
                        data-testid={`input-title-${template.templateType}`}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`body-${template.id}`}>Body Template</Label>
                      <Textarea
                        id={`body-${template.id}`}
                        value={currentTemplate.bodyTemplate}
                        onChange={(e) => {
                          if (isEditing) {
                            setEditingTemplate({ ...editingTemplate, bodyTemplate: e.target.value });
                          } else {
                            setEditingTemplate({ ...template, bodyTemplate: e.target.value });
                          }
                        }}
                        placeholder="e.g., {message}"
                        rows={3}
                        data-testid={`textarea-body-${template.templateType}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`icon-${template.id}`}>Icon URL (optional)</Label>
                        <Input
                          id={`icon-${template.id}`}
                          value={currentTemplate.iconUrl || ''}
                          onChange={(e) => {
                            if (isEditing) {
                              setEditingTemplate({ ...editingTemplate, iconUrl: e.target.value || null });
                            } else {
                              setEditingTemplate({ ...template, iconUrl: e.target.value || null });
                            }
                          }}
                          placeholder="/pwa-icon-192.png"
                          data-testid={`input-icon-${template.templateType}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`badge-${template.id}`}>Badge URL (optional)</Label>
                        <Input
                          id={`badge-${template.id}`}
                          value={currentTemplate.badgeUrl || ''}
                          onChange={(e) => {
                            if (isEditing) {
                              setEditingTemplate({ ...editingTemplate, badgeUrl: e.target.value || null });
                            } else {
                              setEditingTemplate({ ...template, badgeUrl: e.target.value || null });
                            }
                          }}
                          placeholder="/badge-icon.png"
                          data-testid={`input-badge-${template.templateType}`}
                        />
                      </div>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        onClick={() => handleSave(currentTemplate)}
                        disabled={updateTemplateMutation.isPending}
                        data-testid={`button-save-${template.templateType}`}
                      >
                        {updateTemplateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditingTemplate(null)}
                        data-testid={`button-cancel-${template.templateType}`}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
