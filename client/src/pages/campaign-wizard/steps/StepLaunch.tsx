import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { 
  Rocket, 
  Calendar, 
  Clock, 
  Mail, 
  MessageSquare, 
  Phone,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Send
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { WizardState } from '../CampaignWizard';

interface StepLaunchProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>)) => void;
  campaignId: string | null;
}

export function StepLaunch({ state, updateState, campaignId }: StepLaunchProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!campaignId) return;
      
      const endpoint = state.launch.mode === 'now' 
        ? `/api/campaigns/${campaignId}/send`
        : `/api/campaigns/${campaignId}/schedule`;
      
      const body = state.launch.mode === 'scheduled' 
        ? { scheduledFor: state.launch.scheduledDate?.toISOString() }
        : {};
      
      return apiRequest('POST', endpoint, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ 
        title: state.launch.mode === 'now' ? 'Campaign Launched!' : 'Campaign Scheduled!',
        description: state.launch.mode === 'now' 
          ? 'Your campaign is now being sent to recipients'
          : 'Your campaign will be sent at the scheduled time',
      });
      setLocation(`/super-admin/campaigns/${campaignId}`);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to launch campaign', description: error.message, variant: 'destructive' });
    },
  });

  const handleModeChange = (mode: 'now' | 'scheduled') => {
    updateState(prev => ({
      launch: { ...prev.launch, mode },
    }));
  };

  const handleDateChange = (dateStr: string) => {
    const date = dateStr ? new Date(dateStr) : null;
    updateState(prev => ({
      launch: { ...prev.launch, scheduledDate: date },
    }));
  };

  const handleLaunchClick = () => {
    setShowConfirmDialog(true);
    setConfirmText('');
  };

  const handleConfirmLaunch = () => {
    if (confirmText.toUpperCase() !== 'SEND') return;
    setShowConfirmDialog(false);
    launchMutation.mutate();
  };

  const emailCount = state.recipients.channels.email ? (state.recipients.recipientCount || 0) : 0;
  const smsCount = state.recipients.channels.sms ? (state.recipients.recipientCount || 0) : 0;
  const voiceCount = state.recipients.channels.voice ? (state.recipients.recipientCount || 0) : 0;

  const canLaunch = state.testing.checklistComplete && 
    (state.launch.mode === 'now' || (state.launch.mode === 'scheduled' && state.launch.scheduledDate));

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-6" data-testid="step-launch">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-step-title">
          Schedule & Launch
        </h2>
        <p className="text-muted-foreground mt-1">
          Review your campaign summary and choose when to send.
        </p>
      </div>

      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Campaign Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{state.overview.name}</h3>
              <Badge variant="outline" className="capitalize mt-1">
                {state.overview.category} Campaign
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{state.recipients.recipientCount?.toLocaleString() || 0}</div>
                <div className="text-sm text-muted-foreground">
                  recipients from {state.targeting.matchedClientCount?.toLocaleString() || 0} clients
                </div>
              </div>
            </div>

            {state.page.pageId && (
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Page Attached</div>
                  <div className="text-sm text-muted-foreground">Landing page included</div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Messages to be sent:</div>
            <div className="flex flex-wrap gap-3">
              {state.recipients.channels.email && (
                <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full">
                  <Mail className="h-4 w-4" />
                  <span className="font-medium">{emailCount.toLocaleString()} emails</span>
                </div>
              )}
              {state.recipients.channels.sms && (
                <div className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1.5 rounded-full">
                  <MessageSquare className="h-4 w-4" />
                  <span className="font-medium">{smsCount.toLocaleString()} SMS</span>
                </div>
              )}
              {state.recipients.channels.voice && (
                <div className="flex items-center gap-2 bg-purple-100 text-purple-800 px-3 py-1.5 rounded-full">
                  <Phone className="h-4 w-4" />
                  <span className="font-medium">{voiceCount.toLocaleString()} calls</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            When should we send?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={state.launch.mode}
            onValueChange={(value) => handleModeChange(value as 'now' | 'scheduled')}
            className="space-y-4"
          >
            <div className={cn(
              "flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors",
              state.launch.mode === 'now' ? "border-primary bg-primary/5" : "border-muted"
            )}>
              <RadioGroupItem value="now" id="launch-now" className="mt-1" data-testid="radio-send-now" />
              <div className="flex-1">
                <Label htmlFor="launch-now" className="font-medium cursor-pointer flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Send Now
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Campaign will begin sending immediately after confirmation
                </p>
              </div>
            </div>

            <div className={cn(
              "flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors",
              state.launch.mode === 'scheduled' ? "border-primary bg-primary/5" : "border-muted"
            )}>
              <RadioGroupItem value="scheduled" id="launch-scheduled" className="mt-1" data-testid="radio-schedule" />
              <div className="flex-1">
                <Label htmlFor="launch-scheduled" className="font-medium cursor-pointer flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule for Later
                </Label>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Choose a specific date and time to send
                </p>

                {state.launch.mode === 'scheduled' && (
                  <div className="space-y-3">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label htmlFor="schedule-datetime" className="text-sm">Date & Time</Label>
                        <Input
                          id="schedule-datetime"
                          type="datetime-local"
                          value={formatDate(state.launch.scheduledDate)}
                          onChange={(e) => handleDateChange(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                          className="mt-1"
                          data-testid="input-schedule-datetime"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Times are in your local timezone. Best send times: 9-10am or 2-3pm on weekdays.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Important</AlertTitle>
        <AlertDescription className="text-amber-700">
          <p>Once launched, recipients will receive your campaign {state.launch.mode === 'now' ? 'immediately' : 'at the scheduled time'}. Make sure you've:</p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Reviewed all message content</li>
            <li>Tested with at least one preview</li>
            <li>Verified the recipient list is correct</li>
          </ul>
        </AlertDescription>
      </Alert>

      {!state.testing.checklistComplete && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cannot launch yet</AlertTitle>
          <AlertDescription>
            Please complete the testing checklist on the previous step before launching.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-2 border-green-200 bg-green-50">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <div className="font-semibold text-green-800">Ready to Launch</div>
                <div className="text-sm text-green-600">
                  {state.launch.mode === 'now' 
                    ? 'Your campaign will start sending immediately'
                    : state.launch.scheduledDate 
                      ? `Scheduled for ${state.launch.scheduledDate.toLocaleString()}`
                      : 'Select a date and time above'}
                </div>
              </div>
            </div>
            <Button
              size="lg"
              onClick={handleLaunchClick}
              disabled={!canLaunch || launchMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-launch-campaign"
            >
              {launchMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Rocket className="h-5 w-5 mr-2" />
              )}
              {state.launch.mode === 'now' ? 'Launch Campaign' : 'Schedule Campaign'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Confirm Campaign Launch
            </DialogTitle>
            <DialogDescription>
              You are about to send:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex flex-wrap gap-3">
              {state.recipients.channels.email && emailCount > 0 && (
                <Badge variant="secondary" className="text-sm">
                  <Mail className="h-4 w-4 mr-1" />
                  {emailCount.toLocaleString()} emails
                </Badge>
              )}
              {state.recipients.channels.sms && smsCount > 0 && (
                <Badge variant="secondary" className="text-sm">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  {smsCount.toLocaleString()} SMS
                </Badge>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              To {state.recipients.recipientCount?.toLocaleString()} recipients at{' '}
              {state.targeting.matchedClientCount?.toLocaleString()} clients
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="confirm-input" className="text-sm font-medium">
                Type "SEND" to confirm:
              </Label>
              <Input
                id="confirm-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type SEND"
                className="text-center font-mono text-lg"
                data-testid="input-confirm-send"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              This action cannot be undone once sending begins.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmLaunch}
              disabled={confirmText.toUpperCase() !== 'SEND' || launchMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-launch"
            >
              {launchMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              Launch Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
