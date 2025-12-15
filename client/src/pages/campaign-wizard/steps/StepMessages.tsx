import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Sparkles, 
  Send,
  Loader2,
  Eye,
  User,
  Building2,
  Briefcase,
  Link2,
  FileText,
  Plus,
  X as XIcon,
  Code
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { WizardState } from '../CampaignWizard';

interface StepMessagesProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>)) => void;
  campaignId: string | null;
}

const MERGE_FIELD_CATEGORIES = [
  {
    label: 'Person',
    icon: User,
    fields: [
      { key: 'person.firstName', label: 'First Name' },
      { key: 'person.lastName', label: 'Last Name' },
      { key: 'person.fullName', label: 'Full Name' },
      { key: 'person.email', label: 'Email' },
      { key: 'person.title', label: 'Title' },
    ],
  },
  {
    label: 'Client',
    icon: Building2,
    fields: [
      { key: 'client.name', label: 'Client Name' },
      { key: 'client.tradingAs', label: 'Trading As' },
      { key: 'client.companyNumber', label: 'Company Number' },
      { key: 'client.nextAccountsDue', label: 'Next Accounts Due' },
      { key: 'client.monthlyFee', label: 'Monthly Fee' },
      { key: 'client.manager.firstName', label: 'Manager First Name' },
      { key: 'client.manager.fullName', label: 'Manager Full Name' },
    ],
  },
  {
    label: 'Project',
    icon: Briefcase,
    fields: [
      { key: 'project.name', label: 'Project Name' },
      { key: 'project.dueDate', label: 'Due Date' },
      { key: 'project.stage', label: 'Current Stage' },
    ],
  },
  {
    label: 'Links',
    icon: Link2,
    fields: [
      { key: 'links.portal', label: 'Portal Link' },
      { key: 'links.page', label: 'Campaign Page Link' },
      { key: 'links.unsubscribe', label: 'Unsubscribe Link' },
    ],
  },
];

export function StepMessages({ state, updateState, campaignId }: StepMessagesProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('email');
  const [previewRecipient, setPreviewRecipient] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: recipients } = useQuery<any[]>({
    queryKey: ['/api/campaigns', campaignId, 'recipients'],
    enabled: !!campaignId,
  });

  const { data: previewData, isLoading: loadingPreview, refetch: refetchPreview } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'preview-message', activeTab, previewRecipient?.id],
    queryFn: async () => {
      if (!campaignId || !previewRecipient) return null;
      const res = await fetch(`/api/campaigns/${campaignId}/preview-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          channel: activeTab,
          clientId: previewRecipient.clientId,
          personId: previewRecipient.personId,
        }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!campaignId && !!previewRecipient && showPreview,
  });

  const saveMessageMutation = useMutation({
    mutationFn: async ({ channel, data }: { channel: string; data: any }) => {
      if (!campaignId) return;
      return apiRequest('POST', `/api/campaigns/${campaignId}/messages`, {
        channel,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId] });
    },
  });

  const autoSaveMessage = useCallback((channel: string) => {
    if (!campaignId) return;
    
    const messageData = channel === 'email'
      ? { subject: state.messages.email?.subject, body: state.messages.email?.body }
      : channel === 'sms'
      ? { body: state.messages.sms?.body }
      : { body: state.messages.voice?.script };

    if (messageData.body || (channel === 'email' && messageData.subject)) {
      saveMessageMutation.mutate({ channel, data: messageData });
    }
  }, [campaignId, state.messages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      autoSaveMessage(activeTab);
    }, 1000);
    return () => clearTimeout(timer);
  }, [state.messages, activeTab]);

  useEffect(() => {
    if (recipients && recipients.length > 0 && !previewRecipient) {
      setPreviewRecipient(recipients[0]);
    }
  }, [recipients]);

  const updateEmailMessage = (updates: Partial<NonNullable<WizardState['messages']['email']>>) => {
    updateState(prev => ({
      messages: {
        ...prev.messages,
        email: {
          subject: prev.messages.email?.subject || '',
          body: prev.messages.email?.body || '',
          attachments: prev.messages.email?.attachments || [],
          ...updates,
        },
      },
    }));
  };

  const updateSmsMessage = (body: string) => {
    updateState(prev => ({
      messages: {
        ...prev.messages,
        sms: { body },
      },
    }));
  };

  const updateVoiceMessage = (script: string) => {
    updateState(prev => ({
      messages: {
        ...prev.messages,
        voice: { script },
      },
    }));
  };

  const insertMergeField = (field: string, target: 'subject' | 'body' | 'sms' | 'voice') => {
    const mergeTag = `{{${field}}}`;
    
    if (target === 'subject') {
      updateEmailMessage({ subject: (state.messages.email?.subject || '') + mergeTag });
    } else if (target === 'body') {
      updateEmailMessage({ body: (state.messages.email?.body || '') + mergeTag });
    } else if (target === 'sms') {
      updateSmsMessage((state.messages.sms?.body || '') + mergeTag);
    } else if (target === 'voice') {
      updateVoiceMessage((state.messages.voice?.script || '') + mergeTag);
    }
  };

  const emailCharCount = state.messages.email?.subject?.length || 0;
  const smsCharCount = state.messages.sms?.body?.length || 0;
  const smsSegments = Math.ceil(smsCharCount / 160);

  return (
    <div className="space-y-6" data-testid="step-messages">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-step-title">
          Compose Your Message
        </h2>
        <p className="text-muted-foreground mt-1">
          Create personalized messages for each channel. Use merge fields to personalize.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger
            value="email"
            disabled={!state.recipients.channels.email}
            className="flex items-center gap-2"
            data-testid="tab-email"
          >
            <Mail className="h-4 w-4" />
            Email
            {state.messages.email?.body && <Badge variant="secondary" className="ml-1">✓</Badge>}
          </TabsTrigger>
          <TabsTrigger
            value="sms"
            disabled={!state.recipients.channels.sms}
            className="flex items-center gap-2"
            data-testid="tab-sms"
          >
            <MessageSquare className="h-4 w-4" />
            SMS
            {state.messages.sms?.body && <Badge variant="secondary" className="ml-1">✓</Badge>}
          </TabsTrigger>
          <TabsTrigger
            value="voice"
            disabled={!state.recipients.channels.voice}
            className="flex items-center gap-2"
            data-testid="tab-voice"
          >
            <Phone className="h-4 w-4" />
            Voice
            {state.messages.voice?.script && <Badge variant="secondary" className="ml-1">✓</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subject Line</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={state.messages.email?.subject || ''}
                  onChange={(e) => updateEmailMessage({ subject: e.target.value })}
                  placeholder="e.g., {{client.name}} - Your tax documents are needed"
                  className="flex-1"
                  data-testid="input-email-subject"
                />
                <MergeFieldPicker onSelect={(field) => insertMergeField(field, 'subject')} />
              </div>
              <p className={cn(
                "text-sm",
                emailCharCount > 60 ? "text-amber-600" : "text-muted-foreground"
              )}>
                {emailCharCount} characters • Aim for under 60 for best visibility
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Message Body</CardTitle>
                <MergeFieldPicker onSelect={(field) => insertMergeField(field, 'body')} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={state.messages.email?.body || ''}
                onChange={(e) => updateEmailMessage({ body: e.target.value })}
                placeholder="Dear {{person.firstName}},

Write your email content here. Use merge fields to personalize your message.

Kind regards,
{{client.manager.firstName}}"
                rows={12}
                className="font-mono text-sm"
                data-testid="input-email-body"
              />

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI: Make Shorter
                </Button>
                <Button variant="outline" size="sm" disabled>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI: Make Friendlier
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">SMS Message</CardTitle>
                <MergeFieldPicker onSelect={(field) => insertMergeField(field, 'sms')} />
              </div>
              <CardDescription>
                Keep it short and include a clear call to action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={state.messages.sms?.body || ''}
                onChange={(e) => updateSmsMessage(e.target.value)}
                placeholder="Hi {{person.firstName}}, your accounts deadline is approaching. Please upload your documents via the portal: {{links.portal}} Reply STOP to opt out."
                rows={4}
                data-testid="input-sms-body"
              />

              <div className="flex items-center justify-between">
                <div className={cn(
                  "text-sm",
                  smsCharCount > 160 ? "text-amber-600" : "text-muted-foreground"
                )}>
                  {smsCharCount} / 160 characters
                  {smsSegments > 1 && ` • ${smsSegments} SMS segments`}
                </div>
                <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      smsCharCount <= 160 ? "bg-green-500" : "bg-amber-500"
                    )}
                    style={{ width: `${Math.min((smsCharCount / 160) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {smsCharCount > 160 && (
                <p className="text-sm text-amber-600">
                  Messages over 160 characters will be sent as multiple SMS parts.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Voice Script</CardTitle>
                <MergeFieldPicker onSelect={(field) => insertMergeField(field, 'voice')} />
              </div>
              <CardDescription>
                Write a conversational script for the AI voice agent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={state.messages.voice?.script || ''}
                onChange={(e) => updateVoiceMessage(e.target.value)}
                placeholder="Hello, this is a call from {{firm.name}} regarding {{client.name}}. 

We wanted to remind you that your accounts deadline is approaching on {{client.nextAccountsDue}}. 

If you could please upload your documents to your client portal, that would be greatly appreciated.

If you have any questions, please call us back at {{firm.phone}}.

Thank you and have a great day."
                rows={10}
                data-testid="input-voice-script"
              />

              <Button variant="outline" size="sm" disabled>
                <Sparkles className="h-4 w-4 mr-2" />
                AI: Make More Conversational
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {recipients && recipients.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Preview as:</Label>
                <Select
                  value={previewRecipient?.id || ''}
                  onValueChange={(id) => setPreviewRecipient(recipients.find((r: any) => r.id === id))}
                >
                  <SelectTrigger className="w-[250px]" data-testid="select-preview-recipient">
                    <SelectValue placeholder="Select recipient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.slice(0, 20).map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.personName || 'Unknown'} - {r.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPreview(true);
                    refetchPreview();
                  }}
                  disabled={!previewRecipient || loadingPreview}
                  data-testid="button-load-preview"
                >
                  {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load Preview'}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showPreview && previewData && (
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4">
                {activeTab === 'email' && previewData.rendered && (
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Subject: </span>
                      <span className="font-medium">{previewData.rendered.subject}</span>
                    </div>
                    <Separator />
                    <div className="whitespace-pre-wrap text-sm">{previewData.rendered.body}</div>
                  </div>
                )}
                {activeTab === 'sms' && previewData.rendered && (
                  <div className="text-sm whitespace-pre-wrap">{previewData.rendered.body}</div>
                )}
                {activeTab === 'voice' && previewData.rendered && (
                  <div className="text-sm whitespace-pre-wrap">{previewData.rendered.body}</div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button variant="outline" size="sm" disabled data-testid="button-send-test">
                  <Send className="h-4 w-4 mr-2" />
                  Send Test {activeTab === 'email' ? 'Email' : activeTab === 'sms' ? 'SMS' : 'Call'} to Me
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function MergeFieldPicker({ onSelect }: { onSelect: (field: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-merge-fields">
          <Code className="h-4 w-4 mr-2" />
          Merge Fields
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="font-medium">Insert Merge Field</div>
          <ScrollArea className="h-[300px]">
            {MERGE_FIELD_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.label} className="mb-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                    <Icon className="h-4 w-4" />
                    {category.label}
                  </div>
                  <div className="space-y-1">
                    {category.fields.map((field) => (
                      <button
                        key={field.key}
                        onClick={() => onSelect(field.key)}
                        className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
                      >
                        <span className="font-mono text-xs text-primary">{`{{${field.key}}}`}</span>
                        <span className="text-muted-foreground ml-2">— {field.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
