import { useState, useEffect } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Send, CheckCircle2, AlertCircle, Loader2, Plus, Trash2, Edit, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaLibrary } from "@/components/MediaLibrary";

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
      assigneeName: "Jane Doe",
      dueDate: "Fri, 15 Mar 2025, 14:30 GMT"
    },
    variables: ["projectName", "clientName", "fromStage", "toStage", "assigneeName", "dueDate"]
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

const TEMPLATE_TYPES = Object.keys(TEMPLATE_INFO);

export default function PushNotificationTemplates() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [creatingTemplateType, setCreatingTemplateType] = useState<string | null>(null);
  const [testingTemplateId, setTestingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  const { data: templates, isLoading: templatesLoading } = useQuery<NotificationTemplate[]>({
    queryKey: ["/api/push/templates"],
    enabled: isAuthenticated && !!user?.isAdmin,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
      return await apiRequest("POST", "/api/push/templates", data);
    },
    onSuccess: () => {
      toast({
        title: "Template Created",
        description: "The notification template has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/push/templates"] });
      setCreatingTemplateType(null);
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create template.",
        variant: "destructive",
      });
    },
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

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/push/templates/${id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Template Deleted",
        description: "The notification template has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/push/templates"] });
      setDeletingTemplateId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete template.",
        variant: "destructive",
      });
      setDeletingTemplateId(null);
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

  const handleTest = (template: NotificationTemplate) => {
    const info = TEMPLATE_INFO[template.templateType];
    setTestingTemplateId(template.id);
    testTemplateMutation.mutate({
      templateId: template.id,
      sampleData: info?.sampleData || {}
    });
  };

  const handleDelete = (id: string) => {
    deleteTemplateMutation.mutate(id);
  };

  const groupedTemplates = templates?.reduce((acc, template) => {
    if (!acc[template.templateType]) {
      acc[template.templateType] = [];
    }
    acc[template.templateType].push(template);
    return acc;
  }, {} as Record<string, NotificationTemplate[]>) || {};

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
              Customize how push notifications appear for different events. Multiple templates per type are randomly selected for variety.
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {TEMPLATE_TYPES.map((templateType) => {
            const info = TEMPLATE_INFO[templateType];
            const typeTemplates = groupedTemplates[templateType] || [];
            
            return (
              <Card key={templateType} data-testid={`card-template-group-${templateType}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">{info.label}</CardTitle>
                        <Badge variant="outline" data-testid={`badge-count-${templateType}`}>
                          {typeTemplates.length} template{typeTemplates.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <CardDescription className="mt-2">{info.description}</CardDescription>
                      {info.variables && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-sm text-muted-foreground mr-2">Available variables:</span>
                          {info.variables.map((variable) => (
                            <Badge key={variable} variant="outline" className="font-mono text-xs">
                              {`{${variable}}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => setCreatingTemplateType(templateType)}
                      size="sm"
                      data-testid={`button-add-template-${templateType}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Template
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {typeTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No templates created yet for this notification type.</p>
                      <p className="text-sm mt-1">Click "Add Template" to create one.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Body Preview</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {typeTemplates.map((template) => (
                          <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                            <TableCell className="font-medium">{template.name}</TableCell>
                            <TableCell className="max-w-xs truncate">{template.titleTemplate}</TableCell>
                            <TableCell className="max-w-xs truncate text-muted-foreground">{template.bodyTemplate}</TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={template.isActive}
                                onCheckedChange={() => handleToggle(template)}
                                data-testid={`switch-enable-${template.id}`}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTest(template)}
                                  disabled={!template.isActive || testingTemplateId === template.id}
                                  data-testid={`button-test-${template.id}`}
                                >
                                  {testingTemplateId === template.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingTemplate(template)}
                                  data-testid={`button-edit-${template.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingTemplateId(template.id)}
                                  data-testid={`button-delete-${template.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Create/Edit Template Dialog */}
      <TemplateFormDialog
        template={editingTemplate}
        templateType={creatingTemplateType}
        onClose={() => {
          setEditingTemplate(null);
          setCreatingTemplateType(null);
        }}
        onSave={(data) => {
          if (editingTemplate) {
            updateTemplateMutation.mutate({
              id: editingTemplate.id,
              updates: data
            });
          } else if (creatingTemplateType) {
            createTemplateMutation.mutate({
              ...data,
              templateType: creatingTemplateType,
              isActive: true
            } as any);
          }
        }}
        isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingTemplateId} onOpenChange={() => setDeletingTemplateId(null)}>
        <DialogContent data-testid="dialog-delete-confirmation">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingTemplateId(null)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingTemplateId && handleDelete(deletingTemplateId)}
              disabled={deleteTemplateMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteTemplateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TemplateFormDialogProps {
  template: NotificationTemplate | null;
  templateType: string | null;
  onClose: () => void;
  onSave: (data: Partial<NotificationTemplate>) => void;
  isLoading: boolean;
}

function TemplateFormDialog({ template, templateType, onClose, onSave, isLoading }: TemplateFormDialogProps) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    titleTemplate: template?.titleTemplate || '',
    bodyTemplate: template?.bodyTemplate || '',
    iconUrl: template?.iconUrl || '',
    badgeUrl: template?.badgeUrl || '',
  });
  const [activeTab, setActiveTab] = useState("details");
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const [iconPickerMode, setIconPickerMode] = useState<"icon" | "badge" | null>(null);

  const isOpen = !!(template || templateType);
  const info = template ? TEMPLATE_INFO[template.templateType] : (templateType ? TEMPLATE_INFO[templateType] : null);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        titleTemplate: template.titleTemplate,
        bodyTemplate: template.bodyTemplate,
        iconUrl: template.iconUrl || '',
        badgeUrl: template.badgeUrl || '',
      });
    } else if (templateType) {
      setFormData({
        name: '',
        titleTemplate: '',
        bodyTemplate: '',
        iconUrl: '',
        badgeUrl: '',
      });
    }
    setActiveTab("details");
    setSelectedIconId(null);
    setSelectedBadgeId(null);
    setIconPickerMode(null);
  }, [template, templateType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      titleTemplate: formData.titleTemplate,
      bodyTemplate: formData.bodyTemplate,
      iconUrl: formData.iconUrl || null,
      badgeUrl: formData.badgeUrl || null,
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setFormData({
        name: '',
        titleTemplate: '',
        bodyTemplate: '',
        iconUrl: '',
        badgeUrl: '',
      });
    }
  };

  const handleSelectIcon = (iconId: string, downloadUrl: string) => {
    if (iconPickerMode === "icon") {
      setFormData({ ...formData, iconUrl: downloadUrl });
      setSelectedIconId(iconId);
    } else if (iconPickerMode === "badge") {
      setFormData({ ...formData, badgeUrl: downloadUrl });
      setSelectedBadgeId(iconId);
    }
    setActiveTab("details");
    setIconPickerMode(null);
  };

  const handleBrowseIcons = (mode: "icon" | "badge") => {
    setIconPickerMode(mode);
    setActiveTab("icons");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-template-form">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {template ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              {info?.label} - {info?.description}
            </DialogDescription>
            {info?.variables && (
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-sm text-muted-foreground mr-2">Available variables:</span>
                {info.variables.map((variable) => (
                  <Badge key={variable} variant="outline" className="font-mono text-xs">
                    {`{${variable}}`}
                  </Badge>
                ))}
              </div>
            )}
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Template Details</TabsTrigger>
              <TabsTrigger value="icons">
                <ImageIcon className="h-4 w-4 mr-2" />
                Icon Library
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Default Staff Message"
                required
                data-testid="input-template-name"
              />
            </div>

            <div>
              <Label htmlFor="titleTemplate">Title Template</Label>
              <Input
                id="titleTemplate"
                value={formData.titleTemplate}
                onChange={(e) => setFormData({ ...formData, titleTemplate: e.target.value })}
                placeholder={`e.g., New message from {${info?.variables[0] || 'variable'}}`}
                required
                data-testid="input-template-title"
              />
            </div>

            <div>
              <Label htmlFor="bodyTemplate">Body Template</Label>
              <Textarea
                id="bodyTemplate"
                value={formData.bodyTemplate}
                onChange={(e) => setFormData({ ...formData, bodyTemplate: e.target.value })}
                placeholder="e.g., {message}"
                rows={3}
                required
                data-testid="input-template-body"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="iconUrl">Icon URL (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="iconUrl"
                    value={formData.iconUrl}
                    onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                    placeholder="/pwa-icon-192.png"
                    data-testid="input-template-icon"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleBrowseIcons("icon")}
                    data-testid="button-browse-icon"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="badgeUrl">Badge URL (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="badgeUrl"
                    value={formData.badgeUrl}
                    onChange={(e) => setFormData({ ...formData, badgeUrl: e.target.value })}
                    placeholder="/badge-icon.png"
                    data-testid="input-template-badge"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleBrowseIcons("badge")}
                    data-testid="button-browse-badge"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            </TabsContent>

            <TabsContent value="icons" className="py-4">
              {iconPickerMode && (
                <div className="mb-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    {iconPickerMode === "icon" ? "Select an icon" : "Select a badge"} from the library below
                  </p>
                </div>
              )}
              <MediaLibrary
                mode="picker"
                selectedIconId={iconPickerMode === "icon" ? selectedIconId : selectedBadgeId}
                onSelectIcon={handleSelectIcon}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              data-testid="button-cancel-form"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              data-testid="button-save-form"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {template ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
