import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  PhoneCall,
  XCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Ban,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ScheduledQueryReminder } from '@shared/schema';

interface ScheduledRemindersPanelProps {
  projectId: string;
}

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  sms: Phone,
  voice: PhoneCall,
};

const channelLabels: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  voice: 'Voice Call',
};

const statusBadgeVariants: Record<string, { variant: 'default' | 'outline' | 'secondary' | 'destructive'; label: string }> = {
  pending: { variant: 'outline', label: 'Pending' },
  sent: { variant: 'default', label: 'Sent' },
  failed: { variant: 'destructive', label: 'Failed' },
  cancelled: { variant: 'secondary', label: 'Cancelled' },
  skipped: { variant: 'secondary', label: 'Skipped' },
};

export function ScheduledRemindersPanel({ projectId }: ScheduledRemindersPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const { data: reminders, isLoading } = useQuery<ScheduledQueryReminder[]>({
    queryKey: ['/api/projects', projectId, 'query-reminders'],
  });

  const cancelReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      return apiRequest('POST', `/api/query-reminders/${reminderId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'query-reminders'] });
      toast({
        title: 'Reminder cancelled',
        description: 'The reminder has been cancelled successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to cancel the reminder.',
        variant: 'destructive',
      });
    },
  });

  const cancelAllMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      return apiRequest('POST', `/api/query-tokens/${tokenId}/cancel-reminders`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'query-reminders'] });
      toast({
        title: 'All reminders cancelled',
        description: 'All pending reminders have been cancelled.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to cancel reminders.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!reminders || reminders.length === 0) {
    return null;
  }

  const pendingReminders = reminders.filter(r => r.status === 'pending');
  const sentReminders = reminders.filter(r => r.status === 'sent');
  const otherReminders = reminders.filter(r => !['pending', 'sent'].includes(r.status));

  const tokenIds = Array.from(new Set(reminders.map(r => r.tokenId)));
  const hasMultipleTokens = tokenIds.length > 1;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-4" data-testid="scheduled-reminders-panel">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Scheduled Reminders
                <Badge variant="outline" className="ml-1 text-xs">
                  {pendingReminders.length} pending
                </Badge>
                {sentReminders.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {sentReminders.length} sent
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {!hasMultipleTokens && pendingReminders.length > 0 && (
              <div className="flex justify-end mb-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      data-testid="button-cancel-all-reminders"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel All Pending
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel All Reminders?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will cancel all {pendingReminders.length} pending reminders for this query link.
                        The client will no longer receive automated follow-ups.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Reminders</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelAllMutation.mutate(tokenIds[0])}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Cancel All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            <div className="space-y-2">
              {reminders
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .map((reminder) => {
                  const ChannelIcon = channelIcons[reminder.channel] || Mail;
                  const statusInfo = statusBadgeVariants[reminder.status] || statusBadgeVariants.pending;
                  const scheduledDate = new Date(reminder.scheduledAt);
                  const isOverdue = reminder.status === 'pending' && isPast(scheduledDate);

                  return (
                    <div
                      key={reminder.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        reminder.status === 'pending' 
                          ? isOverdue 
                            ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900'
                            : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                          : reminder.status === 'sent'
                          ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                          : 'bg-muted/30 border-muted'
                      }`}
                      data-testid={`reminder-item-${reminder.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          reminder.status === 'pending'
                            ? isOverdue
                              ? 'bg-yellow-100 dark:bg-yellow-900/40'
                              : 'bg-blue-100 dark:bg-blue-900/40'
                            : reminder.status === 'sent'
                            ? 'bg-green-100 dark:bg-green-900/40'
                            : 'bg-muted'
                        }`}>
                          <ChannelIcon className={`h-4 w-4 ${
                            reminder.status === 'pending'
                              ? isOverdue
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-blue-600 dark:text-blue-400'
                              : reminder.status === 'sent'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {channelLabels[reminder.channel]}
                            </span>
                            <Badge variant={statusInfo.variant} className="text-xs">
                              {reminder.status === 'pending' && isOverdue ? 'Due' : statusInfo.label}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Clock className="h-3 w-3" />
                            {reminder.status === 'pending' ? (
                              <>
                                <span>Scheduled for </span>
                                <span className="font-medium">
                                  {format(scheduledDate, 'EEE d MMM, HH:mm')}
                                </span>
                                <span>({formatDistanceToNow(scheduledDate, { addSuffix: true })})</span>
                              </>
                            ) : reminder.status === 'sent' && reminder.sentAt ? (
                              <>
                                <span>Sent </span>
                                <span className="font-medium">
                                  {format(new Date(reminder.sentAt), 'EEE d MMM, HH:mm')}
                                </span>
                              </>
                            ) : reminder.status === 'cancelled' && reminder.cancelledAt ? (
                              <>
                                <span>Cancelled </span>
                                <span>{format(new Date(reminder.cancelledAt), 'EEE d MMM, HH:mm')}</span>
                              </>
                            ) : (
                              <span>{format(scheduledDate, 'EEE d MMM, HH:mm')}</span>
                            )}
                          </div>

                          {reminder.recipientName && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              To: {reminder.recipientName}
                            </div>
                          )}

                          {reminder.errorMessage && reminder.status === 'failed' && (
                            <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                              <AlertCircle className="h-3 w-3" />
                              {reminder.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>

                      {reminder.status === 'pending' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              disabled={cancelReminderMutation.isPending}
                              data-testid={`button-cancel-reminder-${reminder.id}`}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Reminder?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will cancel the {channelLabels[reminder.channel].toLowerCase()} reminder 
                                scheduled for {format(scheduledDate, 'EEEE d MMMM at HH:mm')}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Reminder</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelReminderMutation.mutate(reminder.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Cancel Reminder
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {reminder.status === 'sent' && (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      )}

                      {reminder.status === 'cancelled' && (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
            </div>

            {pendingReminders.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Reminders will stop automatically when all queries are answered.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
