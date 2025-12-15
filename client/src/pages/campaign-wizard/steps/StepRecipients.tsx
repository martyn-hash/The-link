import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { 
  Users, 
  Mail, 
  MessageSquare, 
  Phone, 
  AlertTriangle, 
  Check, 
  X as XIcon,
  Minus,
  Loader2,
  ChevronDown,
  RefreshCw,
  UserCheck,
  UserX,
  Clock
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { WizardState, ContactStrategy } from '../CampaignWizard';

interface StepRecipientsProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>)) => void;
  campaignId: string | null;
}

const CONTACT_STRATEGIES: { value: ContactStrategy; label: string; description: string }[] = [
  {
    value: 'primary_only',
    label: 'Primary Contact Only',
    description: 'Send to the main contact at each client',
  },
  {
    value: 'all_contacts',
    label: 'All Contacts',
    description: 'Send to every person linked to matching clients',
  },
  {
    value: 'role_based',
    label: 'Role-Based Selection',
    description: 'Select contacts by their role',
  },
];

const AVAILABLE_ROLES = [
  { value: 'director', label: 'Directors' },
  { value: 'finance', label: 'Finance Contacts' },
  { value: 'payroll', label: 'Payroll Contacts' },
  { value: 'admin', label: 'Admin Contacts' },
];

export function StepRecipients({ state, updateState, campaignId }: StepRecipientsProps) {
  const [warningsExpanded, setWarningsExpanded] = useState(false);

  const { data: recipientData, isLoading: loadingRecipients, refetch: refetchRecipients } = useQuery<any[]>({
    queryKey: ['/api/campaigns', campaignId, 'recipients'],
    enabled: !!campaignId && state.recipients.resolved,
  });

  const { data: recipientStats } = useQuery<{ total?: number; optedOut?: number; byStatus?: Record<string, number> }>({
    queryKey: ['/api/campaigns', campaignId, 'recipient-stats'],
    enabled: !!campaignId && state.recipients.resolved,
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!campaignId) return;
      return apiRequest('POST', `/api/campaigns/${campaignId}/recipients/resolve`, {});
    },
    onSuccess: (data: any) => {
      updateState(prev => ({
        recipients: {
          ...prev.recipients,
          resolved: true,
          recipientCount: data?.totalResolved || data?.recipients?.length || 0,
        },
      }));
      refetchRecipients();
    },
  });

  const updateRecipientRulesMutation = useMutation({
    mutationFn: async () => {
      if (!campaignId) return;
      return apiRequest('PATCH', `/api/campaigns/${campaignId}`, {
        recipientRules: {
          strategy: state.recipients.strategy,
          channels: state.recipients.channels,
          roles: state.recipients.roles,
        },
      });
    },
  });

  useEffect(() => {
    if (campaignId) {
      const timer = setTimeout(() => {
        updateRecipientRulesMutation.mutate();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state.recipients.strategy, state.recipients.channels, state.recipients.roles, campaignId]);

  const handleStrategyChange = (strategy: ContactStrategy) => {
    updateState(prev => ({
      recipients: { ...prev.recipients, strategy, resolved: false },
    }));
  };

  const handleChannelChange = (channel: 'email' | 'sms' | 'voice', checked: boolean) => {
    updateState(prev => ({
      recipients: {
        ...prev.recipients,
        channels: { ...prev.recipients.channels, [channel]: checked },
        resolved: false,
      },
    }));
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    updateState(prev => ({
      recipients: {
        ...prev.recipients,
        roles: checked
          ? [...prev.recipients.roles, role]
          : prev.recipients.roles.filter(r => r !== role),
        resolved: false,
      },
    }));
  };

  const handleResolveRecipients = () => {
    resolveMutation.mutate();
  };

  const channelStats = {
    email: recipientData?.filter((r: any) => r.channel === 'email')?.length || 0,
    sms: recipientData?.filter((r: any) => r.channel === 'sms')?.length || 0,
    voice: recipientData?.filter((r: any) => r.channel === 'voice')?.length || 0,
  };

  const hasOptedOut = (recipientStats?.optedOut || 0) > 0;
  const hasRecentCampaign = false;

  return (
    <div className="space-y-6" data-testid="step-recipients">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-step-title">
          Who should we contact at each client?
        </h2>
        <p className="text-muted-foreground mt-1">
          Define which contacts to reach and via which channels.
        </p>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">
                    {state.recipients.recipientCount !== null
                      ? state.recipients.recipientCount.toLocaleString()
                      : '—'}
                  </span>
                  <span className="text-muted-foreground">
                    recipients from {state.targeting.matchedClientCount?.toLocaleString() || '—'} clients
                  </span>
                </div>
                {!state.recipients.resolved && (
                  <span className="text-sm text-amber-600">Click "Resolve Recipients" to calculate</span>
                )}
              </div>
            </div>
            <Button
              onClick={handleResolveRecipients}
              disabled={resolveMutation.isPending}
              data-testid="button-resolve-recipients"
            >
              {resolveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Resolve Recipients
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Selection</CardTitle>
          <CardDescription>
            Choose how to select contacts from each matched client
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={state.recipients.strategy}
            onValueChange={(value) => handleStrategyChange(value as ContactStrategy)}
            className="space-y-3"
          >
            {CONTACT_STRATEGIES.map((strategy) => (
              <div key={strategy.value} className="flex items-start space-x-3">
                <RadioGroupItem
                  value={strategy.value}
                  id={`strategy-${strategy.value}`}
                  className="mt-1"
                  data-testid={`radio-strategy-${strategy.value}`}
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`strategy-${strategy.value}`}
                    className="font-medium cursor-pointer"
                  >
                    {strategy.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{strategy.description}</p>

                  {strategy.value === 'role_based' && state.recipients.strategy === 'role_based' && (
                    <div className="mt-3 pl-4 border-l-2 space-y-2">
                      {AVAILABLE_ROLES.map((role) => (
                        <div key={role.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`role-${role.value}`}
                            checked={state.recipients.roles.includes(role.value)}
                            onCheckedChange={(checked) => handleRoleChange(role.value, !!checked)}
                            data-testid={`checkbox-role-${role.value}`}
                          />
                          <Label
                            htmlFor={`role-${role.value}`}
                            className="text-sm cursor-pointer"
                          >
                            {role.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Communication Channels</CardTitle>
          <CardDescription>
            Select how you want to reach your recipients
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChannelCard
              channel="email"
              label="Email"
              icon={Mail}
              checked={state.recipients.channels.email}
              onChange={(checked) => handleChannelChange('email', checked)}
              count={channelStats.email}
              description="Most reliable for business communication"
            />
            <ChannelCard
              channel="sms"
              label="SMS"
              icon={MessageSquare}
              checked={state.recipients.channels.sms}
              onChange={(checked) => handleChannelChange('sms', checked)}
              count={channelStats.sms}
              description="Great for urgent messages"
            />
            <ChannelCard
              channel="voice"
              label="Voice"
              icon={Phone}
              checked={state.recipients.channels.voice}
              onChange={(checked) => handleChannelChange('voice', checked)}
              count={channelStats.voice}
              description="AI-powered calls"
            />
          </div>

          {state.recipients.resolved && recipientStats && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Channel Availability</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  {channelStats.email} have valid email addresses
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  {channelStats.sms} have mobile numbers (SMS)
                </li>
                {(recipientStats.optedOut || 0) > 0 && (
                  <li className="flex items-center gap-2">
                    <XIcon className="h-4 w-4 text-red-600" />
                    {recipientStats.optedOut} contacts have opted out
                  </li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {(hasOptedOut || hasRecentCampaign) && (
        <Collapsible open={warningsExpanded} onOpenChange={setWarningsExpanded}>
          <Alert variant="default" className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Warnings</AlertTitle>
            <AlertDescription className="text-amber-700">
              <CollapsibleTrigger asChild>
                <Button variant="link" className="p-0 h-auto text-amber-700 hover:text-amber-900">
                  {warningsExpanded ? 'Hide details' : 'View details'}
                  <ChevronDown className={cn("h-4 w-4 ml-1 transition-transform", warningsExpanded && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {hasOptedOut && (
                  <div className="flex items-start gap-2">
                    <UserX className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{recipientStats?.optedOut} recipients have opted out of this campaign type</span>
                  </div>
                )}
                {hasRecentCampaign && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Some recipients received a similar campaign recently</span>
                  </div>
                )}
              </CollapsibleContent>
            </AlertDescription>
          </Alert>
        </Collapsible>
      )}

      {state.recipients.resolved && recipientData && recipientData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Recipient List
                </CardTitle>
                <CardDescription>
                  Showing {Math.min(recipientData.length, 20)} of {state.recipients.recipientCount} recipients
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="w-[80px]">Email</TableHead>
                    <TableHead className="w-[80px]">SMS</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipientData.slice(0, 20).map((recipient: any) => (
                    <TableRow key={recipient.id} data-testid={`recipient-row-${recipient.id}`}>
                      <TableCell>
                        <RecipientStatusBadge status={recipient.status} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {recipient.personName || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recipient.clientName || '—'}
                      </TableCell>
                      <TableCell>
                        {recipient.channel === 'email' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        {recipient.channel === 'sms' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {recipient.inclusionReason || 'Primary contact'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ChannelCardProps {
  channel: string;
  label: string;
  icon: any;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count: number;
  description: string;
}

function ChannelCard({ channel, label, icon: Icon, checked, onChange, count, description }: ChannelCardProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border-2 transition-colors cursor-pointer",
        checked ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"
      )}
      onClick={() => onChange(!checked)}
      data-testid={`channel-card-${channel}`}
    >
      <Checkbox
        id={`channel-${channel}`}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-1"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <Label htmlFor={`channel-${channel}`} className="font-medium cursor-pointer">
            {label}
          </Label>
          {count > 0 && (
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}

function RecipientStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">Ready</Badge>;
    case 'opted_out':
      return <Badge variant="destructive">Opted Out</Badge>;
    case 'excluded':
      return <Badge variant="outline">Excluded</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
