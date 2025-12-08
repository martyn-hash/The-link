import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Plus, Trash2, Edit, Loader2, AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const AVAILABLE_VARIABLES = [
  { name: "firstName", description: "Recipient's first name" },
  { name: "userFirstName", description: "Your first name (the sender)" },
  { name: "calendlyLink", description: "Your Calendly booking link" },
];

export default function SmsTemplates() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  const { data: templates, isLoading: templatesLoading } = useQuery<SmsTemplate[]>({
    queryKey: ["/api/sms/templates"],
    enabled: isAuthenticated && !!user?.isAdmin,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; content: string; isActive: boolean }) => {
      return await apiRequest("POST", "/api/sms/templates", data);
    },
    onSuccess: () => {
      toast({
        title: "Template Created",
        description: "The SMS template has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sms/templates"] });
      setIsCreating(false);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<SmsTemplate> }) => {
      return await apiRequest("PATCH", `/api/sms/templates/${data.id}`, data.updates);
    },
    onSuccess: () => {
      toast({
        title: "Template Updated",
        description: "The SMS template has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sms/templates"] });
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/sms/templates/${id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Template Deleted",
        description: "The SMS template has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sms/templates"] });
      setDeletingTemplateId(null);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
      setDeletingTemplateId(null);
    },
  });

  const handleToggle = (template: SmsTemplate) => {
    updateTemplateMutation.mutate({
      id: template.id,
      updates: { isActive: !template.isActive }
    });
  };

  const handleDelete = (id: string) => {
    deleteTemplateMutation.mutate(id);
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
      
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="text-page-title">SMS Templates</h1>
              <p className="text-meta mt-1">
                Create reusable SMS message templates for quick sending. Use variables for personalization.
              </p>
            </div>
            <Button onClick={() => setIsCreating(true)} data-testid="button-create-template">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 w-full px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-6 max-w-7xl mx-auto">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Available variables:</strong>{" "}
            {AVAILABLE_VARIABLES.map((v, i) => (
              <span key={v.name}>
                <code className="bg-muted px-1 py-0.5 rounded text-sm">{`{${v.name}}`}</code>
                {" "}({v.description}){i < AVAILABLE_VARIABLES.length - 1 ? ", " : ""}
              </span>
            ))}
          </AlertDescription>
        </Alert>

        <Card data-testid="card-templates-list">
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Templates</CardTitle>
              <Badge variant="outline" data-testid="badge-template-count">
                {templates?.length || 0} template{(templates?.length || 0) !== 1 ? "s" : ""}
              </Badge>
            </div>
            <CardDescription>
              Manage your SMS message templates. Toggle templates on/off to control availability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!templates || templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No SMS templates created yet.</p>
                <p className="text-sm mt-1">Click "Create Template" to add your first template.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Message Preview</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-muted-foreground truncate">{template.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.content.length} characters
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={template.isActive}
                          onCheckedChange={() => handleToggle(template)}
                          data-testid={`switch-active-${template.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
      </main>

      <TemplateFormDialog
        template={editingTemplate}
        isCreating={isCreating}
        onClose={() => {
          setEditingTemplate(null);
          setIsCreating(false);
        }}
        onSave={(data) => {
          if (editingTemplate) {
            updateTemplateMutation.mutate({
              id: editingTemplate.id,
              updates: data
            });
          } else {
            createTemplateMutation.mutate(data as any);
          }
        }}
        isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
      />

      <Dialog open={!!deletingTemplateId} onOpenChange={() => setDeletingTemplateId(null)}>
        <DialogContent data-testid="dialog-delete-confirmation">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this SMS template? This action cannot be undone.
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
  template: SmsTemplate | null;
  isCreating: boolean;
  onClose: () => void;
  onSave: (data: Partial<SmsTemplate>) => void;
  isLoading: boolean;
}

function TemplateFormDialog({ template, isCreating, onClose, onSave, isLoading }: TemplateFormDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    isActive: true,
  });

  const isOpen = !!(template || isCreating);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        content: template.content,
        isActive: template.isActive,
      });
    } else if (isCreating) {
      setFormData({
        name: "",
        content: "",
        isActive: true,
      });
    }
  }, [template, isCreating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setFormData({
        name: "",
        content: "",
        isActive: true,
      });
    }
  };

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      content: prev.content + `{${variable}}`
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-template-form">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {template ? "Edit SMS Template" : "Create SMS Template"}
            </DialogTitle>
            <DialogDescription>
              {template 
                ? "Update the template details below." 
                : "Create a new SMS template for quick messaging."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Appointment Reminder"
                required
                data-testid="input-template-name"
              />
            </div>

            <div>
              <Label htmlFor="content">Message Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="e.g., Hi {firstName}, just a reminder about your upcoming appointment..."
                rows={4}
                required
                data-testid="textarea-template-content"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  {formData.content.length} / 160 characters (1 SMS)
                </p>
                <div className="flex gap-1">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <Button
                      key={v.name}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(v.name)}
                      data-testid={`button-insert-${v.name}`}
                    >
                      {`{${v.name}}`}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {formData.content && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Preview:</p>
                <p className="text-sm text-muted-foreground">
                  {formData.content
                    .replace(/\{firstName\}/g, "John")
                    .replace(/\{userFirstName\}/g, "Sarah")
                    .replace(/\{calendlyLink\}/g, "calendly.com/sarah")}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isActive">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Only active templates appear in the template picker
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-form-active"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} data-testid="button-save-template">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {template ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
