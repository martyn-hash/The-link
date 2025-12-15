import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  TestTube, 
  Check, 
  X as XIcon, 
  AlertTriangle,
  Mail,
  MessageSquare,
  Phone,
  Eye,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Link2,
  FileText,
  User
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { WizardState } from '../CampaignWizard';

interface StepTestingProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>)) => void;
  campaignId: string | null;
}

interface ChecklistItem {
  id: string;
  label: string;
  check: (state: WizardState) => 'pass' | 'fail' | 'warning';
  message: (state: WizardState) => string;
  severity: 'error' | 'warning';
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'has_name',
    label: 'Campaign has a name',
    check: (state) => state.overview.name ? 'pass' : 'fail',
    message: (state) => state.overview.name ? 'Campaign name is set' : 'Campaign name is required',
    severity: 'error',
  },
  {
    id: 'has_recipients',
    label: 'Recipients are resolved',
    check: (state) => (state.recipients.recipientCount || 0) > 0 ? 'pass' : 'fail',
    message: (state) => (state.recipients.recipientCount || 0) > 0 
      ? `${state.recipients.recipientCount} recipients ready` 
      : 'No recipients - resolve recipients first',
    severity: 'error',
  },
  {
    id: 'has_message',
    label: 'At least one message is composed',
    check: (state) => (state.messages.email?.body || state.messages.sms?.body || state.messages.voice?.script) ? 'pass' : 'fail',
    message: (state) => {
      const channels = [];
      if (state.messages.email?.body) channels.push('Email');
      if (state.messages.sms?.body) channels.push('SMS');
      if (state.messages.voice?.script) channels.push('Voice');
      return channels.length > 0 ? `${channels.join(', ')} message ready` : 'No message content - compose at least one message';
    },
    severity: 'error',
  },
  {
    id: 'email_subject',
    label: 'Email has subject line',
    check: (state) => {
      if (!state.recipients.channels.email) return 'pass';
      return state.messages.email?.subject ? 'pass' : 'fail';
    },
    message: (state) => {
      if (!state.recipients.channels.email) return 'Email channel not enabled';
      return state.messages.email?.subject ? 'Email subject is set' : 'Email subject is required';
    },
    severity: 'error',
  },
  {
    id: 'email_subject_length',
    label: 'Email subject under 60 characters',
    check: (state) => {
      if (!state.recipients.channels.email || !state.messages.email?.subject) return 'pass';
      return (state.messages.email.subject.length || 0) <= 60 ? 'pass' : 'warning';
    },
    message: (state) => {
      const len = state.messages.email?.subject?.length || 0;
      return len <= 60 ? `${len} characters - good length` : `${len} characters - may be truncated in inbox`;
    },
    severity: 'warning',
  },
  {
    id: 'sms_length',
    label: 'SMS under 160 characters',
    check: (state) => {
      if (!state.recipients.channels.sms || !state.messages.sms?.body) return 'pass';
      return (state.messages.sms.body.length || 0) <= 160 ? 'pass' : 'warning';
    },
    message: (state) => {
      const len = state.messages.sms?.body?.length || 0;
      const segments = Math.ceil(len / 160);
      return len <= 160 ? `${len} characters - single SMS` : `${len} characters - will be ${segments} SMS segments`;
    },
    severity: 'warning',
  },
];

export function StepTesting({ state, updateState, campaignId }: StepTestingProps) {
  const { toast } = useToast();
  const [previewTab, setPreviewTab] = useState('email');
  const [previewRecipient, setPreviewRecipient] = useState<any>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const { data: recipients } = useQuery<any[]>({
    queryKey: ['/api/campaigns', campaignId, 'recipients'],
    enabled: !!campaignId,
  });

  const { data: previewData, isLoading: loadingPreview, refetch: refetchPreview } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'preview-message', previewTab, previewRecipient?.id],
    queryFn: async () => {
      if (!campaignId || !previewRecipient) return null;
      const res = await fetch(`/api/campaigns/${campaignId}/preview-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          channel: previewTab,
          clientId: previewRecipient.clientId,
          personId: previewRecipient.personId,
        }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!campaignId && !!previewRecipient,
  });

  const sendTestMutation = useMutation({
    mutationFn: async (channel: string) => {
      if (!campaignId) return;
      return apiRequest('POST', `/api/campaigns/${campaignId}/send-test`, { channel });
    },
    onSuccess: (_, channel) => {
      toast({ title: 'Test sent!', description: `Test ${channel} sent to your email/phone` });
      updateState(prev => ({
        testing: {
          ...prev.testing,
          testsSent: { ...prev.testing.testsSent, [channel]: true },
        },
      }));
    },
    onError: (error: any) => {
      toast({ title: 'Failed to send test', description: error.message, variant: 'destructive' });
    },
  });

  const checklistResults = CHECKLIST_ITEMS.map(item => ({
    ...item,
    result: item.check(state),
    resultMessage: item.message(state),
  }));

  const hasErrors = checklistResults.some(r => r.result === 'fail' && r.severity === 'error');
  const hasWarnings = checklistResults.some(r => r.result === 'warning' || (r.result === 'fail' && r.severity === 'warning'));
  const allPassed = !hasErrors;

  const handleConfirmChange = (checked: boolean) => {
    setConfirmChecked(checked);
    updateState(prev => ({
      testing: { ...prev.testing, checklistComplete: checked && allPassed },
    }));
  };

  return (
    <div className="space-y-6" data-testid="step-testing">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-step-title">
          Test Your Campaign
        </h2>
        <p className="text-muted-foreground mt-1">
          Before sending, make sure everything looks right. Review the checklist and send test messages.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Deliverability Checklist
          </CardTitle>
          <CardDescription>
            Review these items to ensure your campaign is ready to send
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checklistResults.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg",
                  item.result === 'pass' && "bg-green-50",
                  item.result === 'warning' && "bg-amber-50",
                  item.result === 'fail' && item.severity === 'error' && "bg-red-50",
                  item.result === 'fail' && item.severity === 'warning' && "bg-amber-50"
                )}
                data-testid={`checklist-${item.id}`}
              >
                {item.result === 'pass' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : item.result === 'warning' || (item.result === 'fail' && item.severity === 'warning') ? (
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                )}
                <div className="flex-1">
                  <div className={cn(
                    "font-medium text-sm",
                    item.result === 'pass' && "text-green-800",
                    item.result === 'warning' && "text-amber-800",
                    item.result === 'fail' && item.severity === 'error' && "text-red-800",
                    item.result === 'fail' && item.severity === 'warning' && "text-amber-800"
                  )}>
                    {item.label}
                  </div>
                  <div className={cn(
                    "text-sm",
                    item.result === 'pass' && "text-green-600",
                    item.result === 'warning' && "text-amber-600",
                    item.result === 'fail' && item.severity === 'error' && "text-red-600",
                    item.result === 'fail' && item.severity === 'warning' && "text-amber-600"
                  )}>
                    {item.resultMessage}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasErrors && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Cannot proceed</AlertTitle>
              <AlertDescription>
                Please fix the errors above before launching your campaign.
              </AlertDescription>
            </Alert>
          )}

          {!hasErrors && hasWarnings && (
            <Alert className="mt-4 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Warnings</AlertTitle>
              <AlertDescription className="text-amber-700">
                Your campaign can be sent, but consider reviewing the warnings above.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Test Messages
          </CardTitle>
          <CardDescription>
            Send a test message to yourself to verify everything looks correct
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Preview as recipient:</Label>
            <Select
              value={previewRecipient?.id || ''}
              onValueChange={(id) => setPreviewRecipient(recipients?.find((r: any) => r.id === id))}
            >
              <SelectTrigger className="w-[280px]" data-testid="select-test-recipient">
                <SelectValue placeholder="Select recipient..." />
              </SelectTrigger>
              <SelectContent>
                {recipients?.slice(0, 20).map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.personName || 'Unknown'} - {r.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {state.recipients.channels.email && (
              <Card className="border-2">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Email</span>
                    {state.testing.testsSent.email && (
                      <Badge variant="secondary" className="ml-auto">Sent</Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => sendTestMutation.mutate('email')}
                    disabled={sendTestMutation.isPending || !state.messages.email?.body}
                    data-testid="button-send-test-email"
                  >
                    {sendTestMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Test Email
                  </Button>
                </CardContent>
              </Card>
            )}

            {state.recipients.channels.sms && (
              <Card className="border-2">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                    <span className="font-medium">SMS</span>
                    {state.testing.testsSent.sms && (
                      <Badge variant="secondary" className="ml-auto">Sent</Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => sendTestMutation.mutate('sms')}
                    disabled={sendTestMutation.isPending || !state.messages.sms?.body}
                    data-testid="button-send-test-sms"
                  >
                    {sendTestMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Test SMS
                  </Button>
                </CardContent>
              </Card>
            )}

            {state.page.pageId && (
              <Card className="border-2">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Page</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(`/campaign-page/${state.page.pageId}/preview`, '_blank')}
                    data-testid="button-preview-page"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Page
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview All Channels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={previewTab} onValueChange={setPreviewTab}>
            <TabsList>
              {state.recipients.channels.email && (
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
              )}
              {state.recipients.channels.sms && (
                <TabsTrigger value="sms" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS
                </TabsTrigger>
              )}
              {state.recipients.channels.voice && (
                <TabsTrigger value="voice" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Voice
                </TabsTrigger>
              )}
            </TabsList>

            <div className="mt-4">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : previewData?.rendered ? (
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  {previewTab === 'email' && (
                    <>
                      <div className="text-sm space-y-1">
                        <div><span className="text-muted-foreground">From:</span> Your Company</div>
                        <div><span className="text-muted-foreground">To:</span> {previewRecipient?.email || 'recipient@example.com'}</div>
                        <div><span className="text-muted-foreground">Subject:</span> <strong>{previewData.rendered.subject}</strong></div>
                      </div>
                      <Separator />
                      <div className="whitespace-pre-wrap text-sm">{previewData.rendered.body}</div>
                    </>
                  )}
                  {previewTab === 'sms' && (
                    <div className="whitespace-pre-wrap text-sm">{previewData.rendered.body}</div>
                  )}
                  {previewTab === 'voice' && (
                    <div className="whitespace-pre-wrap text-sm italic">{previewData.rendered.body}</div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Select a recipient above to see a preview</p>
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <Card className={cn(
        "border-2 transition-colors",
        confirmChecked && allPassed ? "border-green-500 bg-green-50" : ""
      )}>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="confirm-ready"
              checked={confirmChecked}
              onCheckedChange={(checked) => handleConfirmChange(!!checked)}
              disabled={hasErrors}
              className="mt-0.5"
              data-testid="checkbox-confirm-ready"
            />
            <Label htmlFor="confirm-ready" className={cn("cursor-pointer", hasErrors && "opacity-50")}>
              <span className="font-medium">I have reviewed the content and am ready to proceed</span>
              <p className="text-sm text-muted-foreground mt-1">
                {hasErrors 
                  ? "Please fix the errors above before confirming"
                  : "By checking this, you confirm you've tested your campaign and it's ready to launch"}
              </p>
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
