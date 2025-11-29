import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Webhook, Plus, Edit, Trash2, History, ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";
import { Link } from "wouter";
import type { WebhookConfig, WebhookLogWithDetails } from "@shared/schema";

const CLIENT_FIELDS = [
  { value: "companiesHouseAuthCode", label: "Companies House Auth Code" },
  { value: "companyNumber", label: "Company Number" },
  { value: "companyUtr", label: "Company UTR" },
  { value: "email", label: "Email" },
  { value: "companyTelephone", label: "Company Telephone" },
];

const PERSON_FIELDS = [
  { value: "email", label: "Email" },
  { value: "telephone", label: "Telephone" },
  { value: "niNumber", label: "NI Number" },
  { value: "personalUtrNumber", label: "Personal UTR" },
];

export default function AdminWebhooks() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    webhookUrl: "",
    updateWebhookUrl: "",
    isEnabled: true,
    requiredClientFields: [] as string[],
    requiredPersonFields: [] as string[],
  });

  const { data: webhooks = [], isLoading: webhooksLoading } = useQuery<WebhookConfig[]>({
    queryKey: ["/api/super-admin/webhooks"],
    enabled: isAuthenticated && !!user?.superAdmin,
  });

  const { data: webhookLogs = [], isLoading: logsLoading } = useQuery<WebhookLogWithDetails[]>({
    queryKey: ["/api/super-admin/webhooks", selectedWebhook?.id, "logs"],
    enabled: showLogsDialog && !!selectedWebhook,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/super-admin/webhooks", data);
    },
    onSuccess: () => {
      toast({ title: "Webhook created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/webhooks"] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("PATCH", `/api/super-admin/webhooks/${selectedWebhook?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Webhook updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/webhooks"] });
      setShowEditDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/super-admin/webhooks/${selectedWebhook?.id}`);
    },
    onSuccess: () => {
      toast({ title: "Webhook deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/webhooks"] });
      setShowDeleteDialog(false);
      setSelectedWebhook(null);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      webhookUrl: "",
      updateWebhookUrl: "",
      isEnabled: true,
      requiredClientFields: [],
      requiredPersonFields: [],
    });
    setSelectedWebhook(null);
  };

  const handleEdit = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    setFormData({
      name: webhook.name,
      description: webhook.description || "",
      webhookUrl: webhook.webhookUrl,
      updateWebhookUrl: webhook.updateWebhookUrl || "",
      isEnabled: webhook.isEnabled,
      requiredClientFields: webhook.requiredClientFields || [],
      requiredPersonFields: webhook.requiredPersonFields || [],
    });
    setShowEditDialog(true);
  };

  const handleViewLogs = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    setShowLogsDialog(true);
  };

  const toggleField = (field: string, type: "client" | "person") => {
    const key = type === "client" ? "requiredClientFields" : "requiredPersonFields";
    setFormData(prev => ({
      ...prev,
      [key]: prev[key].includes(field)
        ? prev[key].filter(f => f !== field)
        : [...prev[key], field]
    }));
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user.superAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive text-lg mb-4">Access Denied</p>
          <p className="text-muted-foreground">Super Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <main className="flex-1 page-container py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="sm" data-testid="btn-back-admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Webhook className="h-6 w-6" />
              Webhook Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure webhooks to share client data with external systems like Zapier
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="btn-create-webhook">
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        </div>

        {webhooksLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        ) : webhooks.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No webhooks configured</h3>
              <p className="text-muted-foreground mb-4">
                Add webhooks to share client data with external systems via Zapier
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Webhook
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <Card key={webhook.id} data-testid={`webhook-card-${webhook.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{webhook.name}</CardTitle>
                      <Badge variant={webhook.isEnabled ? "default" : "secondary"}>
                        {webhook.isEnabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleViewLogs(webhook)}
                        data-testid={`btn-logs-${webhook.id}`}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEdit(webhook)}
                        data-testid={`btn-edit-${webhook.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setSelectedWebhook(webhook); setShowDeleteDialog(true); }}
                        data-testid={`btn-delete-${webhook.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {webhook.description && (
                    <p className="text-sm text-muted-foreground mb-3">{webhook.description}</p>
                  )}
                  <div className="text-sm space-y-2">
                    <div>
                      <span className="font-medium">Create URL:</span>{" "}
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {webhook.webhookUrl.substring(0, 50)}...
                      </code>
                    </div>
                    {webhook.updateWebhookUrl && (
                      <div>
                        <span className="font-medium">Update URL:</span>{" "}
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {webhook.updateWebhookUrl.substring(0, 50)}...
                        </code>
                      </div>
                    )}
                    {((webhook.requiredClientFields?.length ?? 0) > 0 || (webhook.requiredPersonFields?.length ?? 0) > 0) && (
                      <div>
                        <span className="font-medium">Required Fields:</span>{" "}
                        <span className="text-muted-foreground">
                          {[
                            ...(webhook.requiredClientFields || []).map(f => `Client: ${f}`),
                            ...(webhook.requiredPersonFields || []).map(f => `Person: ${f}`)
                          ].join(", ") || "None"}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Add a new webhook to share client data with external systems
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., BrightManager, TaxDome"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-webhook-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What this webhook is used for..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-webhook-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL (from Zapier)</Label>
              <Input
                id="webhookUrl"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                data-testid="input-webhook-url"
              />
              <p className="text-xs text-muted-foreground">
                This URL is used when first sharing data for a client
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="updateWebhookUrl">Update Webhook URL (optional)</Label>
              <Input
                id="updateWebhookUrl"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={formData.updateWebhookUrl}
                onChange={(e) => setFormData({ ...formData, updateWebhookUrl: e.target.value })}
                data-testid="input-update-webhook-url"
              />
              <p className="text-xs text-muted-foreground">
                If set, this URL is used for subsequent shares after the first successful send
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isEnabled">Enabled</Label>
              <Switch
                id="isEnabled"
                checked={formData.isEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                data-testid="switch-webhook-enabled"
              />
            </div>
            <div className="space-y-2">
              <Label>Required Client Fields</Label>
              <p className="text-xs text-muted-foreground">
                Webhook will only be available if these fields are filled in
              </p>
              <div className="flex flex-wrap gap-2">
                {CLIENT_FIELDS.map((field) => (
                  <Badge
                    key={field.value}
                    variant={formData.requiredClientFields.includes(field.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleField(field.value, "client")}
                    data-testid={`badge-client-${field.value}`}
                  >
                    {field.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Required Person Fields</Label>
              <p className="text-xs text-muted-foreground">
                At least one person must have these fields
              </p>
              <div className="flex flex-wrap gap-2">
                {PERSON_FIELDS.map((field) => (
                  <Badge
                    key={field.value}
                    variant={formData.requiredPersonFields.includes(field.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleField(field.value, "person")}
                    data-testid={`badge-person-${field.value}`}
                  >
                    {field.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)} 
              disabled={!formData.name || !formData.webhookUrl || createMutation.isPending}
              data-testid="btn-save-webhook"
            >
              {createMutation.isPending ? "Creating..." : "Create Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>
              Update webhook configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-webhookUrl">Webhook URL</Label>
              <Input
                id="edit-webhookUrl"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                This URL is used when first sharing data for a client
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-updateWebhookUrl">Update Webhook URL (optional)</Label>
              <Input
                id="edit-updateWebhookUrl"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={formData.updateWebhookUrl}
                onChange={(e) => setFormData({ ...formData, updateWebhookUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                If set, this URL is used for subsequent shares after the first successful send
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isEnabled">Enabled</Label>
              <Switch
                id="edit-isEnabled"
                checked={formData.isEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label>Required Client Fields</Label>
              <div className="flex flex-wrap gap-2">
                {CLIENT_FIELDS.map((field) => (
                  <Badge
                    key={field.value}
                    variant={formData.requiredClientFields.includes(field.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleField(field.value, "client")}
                  >
                    {field.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Required Person Fields</Label>
              <div className="flex flex-wrap gap-2">
                {PERSON_FIELDS.map((field) => (
                  <Badge
                    key={field.value}
                    variant={formData.requiredPersonFields.includes(field.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleField(field.value, "person")}
                  >
                    {field.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => updateMutation.mutate(formData)} 
              disabled={!formData.name || !formData.webhookUrl || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedWebhook?.name}"? This action cannot be undone.
              All logs for this webhook will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Webhook Logs - {selectedWebhook?.name}</DialogTitle>
            <DialogDescription>
              Recent webhook send history
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : webhookLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No logs yet for this webhook
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Sent By</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {log.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {log.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                        {log.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                      </TableCell>
                      <TableCell>{(log as any).clientName || 'Unknown'}</TableCell>
                      <TableCell>{log.triggeredByName}</TableCell>
                      <TableCell>
                        {log.status === 'success' ? (
                          <span className="text-green-600">{log.responseCode}</span>
                        ) : (
                          <span className="text-red-600 text-sm">{log.errorMessage || 'Failed'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.sentAt && new Date(log.sentAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
