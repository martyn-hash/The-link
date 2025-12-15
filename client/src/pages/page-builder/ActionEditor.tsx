import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { X, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { PageAction } from '@shared/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ActionEditorProps {
  action: PageAction;
  pageId: string;
  onClose: () => void;
}

const ACTION_TYPES = [
  { value: 'interested', label: 'Interested', description: 'Express interest in the offer' },
  { value: 'not_interested', label: 'Not Interested', description: 'Decline the offer' },
  { value: 'request_callback', label: 'Request Callback', description: 'Request a phone call' },
  { value: 'book_call', label: 'Book Call', description: 'Schedule a meeting' },
  { value: 'confirm_details', label: 'Confirm Details', description: 'Confirm shown information' },
  { value: 'documents_uploaded', label: 'Documents Uploaded', description: 'Mark documents as submitted' },
  { value: 'request_extension', label: 'Request Extension', description: 'Request deadline extension' },
  { value: 'custom_form', label: 'Custom Form', description: 'Submit a custom form' },
  { value: 'custom_webhook', label: 'Custom Webhook', description: 'Trigger external webhook' },
];

export function ActionEditor({ action, pageId, onClose }: ActionEditorProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    label: action.label,
    description: action.description || '',
    actionType: action.actionType,
    requiresOtp: action.requiresOtp ?? false,
    successMessage: action.successMessage || '',
    config: (action.config || {}) as any,
  });

  useEffect(() => {
    setFormData({
      label: action.label,
      description: action.description || '',
      actionType: action.actionType,
      requiresOtp: action.requiresOtp ?? false,
      successMessage: action.successMessage || '',
      config: (action.config || {}) as any,
    });
  }, [action.id]);

  const updateActionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/pages/${pageId}/actions/${action.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pages', pageId] });
      toast({ title: 'Action updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error updating action', description: error.message, variant: 'destructive' });
    },
  });

  const deleteActionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/pages/${pageId}/actions/${action.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pages', pageId] });
      toast({ title: 'Action deleted' });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error deleting action', description: error.message, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    updateActionMutation.mutate(formData);
  };

  const updateConfig = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Edit Action</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-action-editor">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="action-type">Action Type</Label>
          <Select
            value={formData.actionType}
            onValueChange={(v) => setFormData(prev => ({ ...prev, actionType: v as any }))}
          >
            <SelectTrigger data-testid="select-action-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {ACTION_TYPES.find(t => t.value === formData.actionType)?.description}
          </p>
        </div>

        <div>
          <Label htmlFor="action-label">Button Label</Label>
          <Input
            id="action-label"
            value={formData.label}
            onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
            data-testid="input-action-label"
          />
        </div>

        <div>
          <Label htmlFor="action-description">Description (optional)</Label>
          <Textarea
            id="action-description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            data-testid="input-action-description"
          />
        </div>

        <div>
          <Label htmlFor="success-message">Success Message</Label>
          <Textarea
            id="success-message"
            value={formData.successMessage}
            onChange={(e) => setFormData(prev => ({ ...prev, successMessage: e.target.value }))}
            placeholder="Thank you for your response!"
            rows={2}
            data-testid="input-success-message"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="requires-otp">Require OTP Verification</Label>
            <p className="text-xs text-muted-foreground">User must verify email before action</p>
          </div>
          <Switch
            id="requires-otp"
            checked={formData.requiresOtp}
            onCheckedChange={(v) => setFormData(prev => ({ ...prev, requiresOtp: v }))}
            data-testid="switch-requires-otp"
          />
        </div>

        {(formData.actionType === 'interested' || 
          formData.actionType === 'request_callback' || 
          formData.actionType === 'documents_uploaded' ||
          formData.actionType === 'request_extension') && (
          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-sm font-medium">Task Creation</p>
            <div className="flex items-center justify-between">
              <Label htmlFor="create-task">Create Follow-up Task</Label>
              <Switch
                id="create-task"
                checked={formData.config.createTask?.enabled ?? true}
                onCheckedChange={(v) => updateConfig('createTask', { ...formData.config.createTask, enabled: v })}
                data-testid="switch-create-task"
              />
            </div>
            {formData.config.createTask?.enabled !== false && (
              <>
                <div>
                  <Label htmlFor="task-title">Task Title</Label>
                  <Input
                    id="task-title"
                    value={formData.config.createTask?.title || ''}
                    onChange={(e) => updateConfig('createTask', { ...formData.config.createTask, title: e.target.value })}
                    placeholder="Follow up with {{person.firstName}}"
                    data-testid="input-task-title"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="assign-manager">Assign to Client Manager</Label>
                  <Switch
                    id="assign-manager"
                    checked={formData.config.createTask?.assignToManager ?? true}
                    onCheckedChange={(v) => updateConfig('createTask', { ...formData.config.createTask, assignToManager: v })}
                    data-testid="switch-assign-manager"
                  />
                </div>
                <div>
                  <Label htmlFor="due-days">Due in (days)</Label>
                  <Input
                    id="due-days"
                    type="number"
                    value={formData.config.createTask?.dueInDays || 2}
                    onChange={(e) => updateConfig('createTask', { ...formData.config.createTask, dueInDays: parseInt(e.target.value) || 2 })}
                    data-testid="input-due-days"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {formData.actionType === 'book_call' && (
          <div>
            <Label htmlFor="calendly-link">Calendly/Booking Link</Label>
            <Input
              id="calendly-link"
              value={formData.config.calendlyLink || ''}
              onChange={(e) => updateConfig('calendlyLink', e.target.value)}
              placeholder="https://calendly.com/..."
              data-testid="input-calendly-link"
            />
          </div>
        )}

        {formData.actionType === 'custom_webhook' && (
          <div>
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              value={formData.config.webhookUrl || ''}
              onChange={(e) => updateConfig('webhookUrl', e.target.value)}
              placeholder="https://..."
              data-testid="input-webhook-url"
            />
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSave} disabled={updateActionMutation.isPending} className="flex-1" data-testid="button-save-action">
            Save Changes
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" data-testid="button-delete-action">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Action</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this action? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteActionMutation.mutate()} data-testid="button-confirm-delete">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
