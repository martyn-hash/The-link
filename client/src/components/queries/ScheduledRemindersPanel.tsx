import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import DOMPurify from 'isomorphic-dompurify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TiptapEditor } from '@/components/TiptapEditor';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Mail,
  Phone,
  PhoneCall,
  XCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Ban,
  Pencil,
  Calendar as CalendarIcon,
  RefreshCw,
  Lock,
  Eye,
  FileEdit,
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
  const { toast } = useToast();
  const [editingReminder, setEditingReminder] = useState<ScheduledQueryReminder | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editChannel, setEditChannel] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editIntro, setEditIntro] = useState('');
  const [editSignoff, setEditSignoff] = useState('');
  const [editViewMode, setEditViewMode] = useState<'edit' | 'preview'>('edit');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: reminders, isLoading, refetch } = useQuery<ScheduledQueryReminder[]>({
    queryKey: ['/api/projects', projectId, 'query-reminders'],
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast({
      title: 'Refreshed',
      description: 'Reminder list has been updated.',
    });
  };

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

  const updateReminderMutation = useMutation({
    mutationFn: async ({ reminderId, scheduledAt, channel, message, messageIntro, messageSignoff }: { 
      reminderId: string; 
      scheduledAt?: string; 
      channel?: string; 
      message?: string;
      messageIntro?: string;
      messageSignoff?: string;
    }) => {
      const updateData: { scheduledAt?: string; channel?: string; message?: string; messageIntro?: string; messageSignoff?: string } = {};
      if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt;
      if (channel !== undefined) updateData.channel = channel;
      if (message !== undefined) updateData.message = message;
      if (messageIntro !== undefined) updateData.messageIntro = messageIntro;
      if (messageSignoff !== undefined) updateData.messageSignoff = messageSignoff;
      return apiRequest('PATCH', `/api/query-reminders/${reminderId}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'query-reminders'] });
      toast({
        title: 'Reminder updated',
        description: 'The reminder has been updated successfully.',
      });
      setEditingReminder(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update the reminder.',
        variant: 'destructive',
      });
    },
  });

  const handleEditClick = (reminder: ScheduledQueryReminder) => {
    const scheduledDate = new Date(reminder.scheduledAt);
    setEditDate(format(scheduledDate, 'yyyy-MM-dd'));
    setEditTime(format(scheduledDate, 'HH:mm'));
    setEditChannel(reminder.channel);
    setEditMessage((reminder as any).message || '');
    setEditIntro((reminder as any).messageIntro || '');
    setEditSignoff((reminder as any).messageSignoff || '');
    setEditViewMode('edit');
    setEditingReminder(reminder);
  };

  const handleSaveEdit = () => {
    if (!editingReminder) return;
    
    // Build update payload with only changed fields
    const updatePayload: { 
      reminderId: string; 
      scheduledAt?: string; 
      channel?: string; 
      message?: string;
      messageIntro?: string;
      messageSignoff?: string;
    } = {
      reminderId: editingReminder.id,
    };
    
    // Only include scheduledAt if date/time changed
    const originalDate = new Date(editingReminder.scheduledAt);
    const originalDateStr = format(originalDate, 'yyyy-MM-dd');
    const originalTimeStr = format(originalDate, 'HH:mm');
    
    if (editDate !== originalDateStr || editTime !== originalTimeStr) {
      if (editDate && editTime) {
        updatePayload.scheduledAt = new Date(`${editDate}T${editTime}:00`).toISOString();
      }
    }
    
    // Only include channel if changed
    if (editChannel !== editingReminder.channel) {
      updatePayload.channel = editChannel;
    }
    
    // Only include message if changed (for SMS/Voice)
    const originalMessage = (editingReminder as any).message || '';
    const messageChanged = editMessage !== originalMessage;
    if (messageChanged) {
      updatePayload.message = editMessage;
    }
    
    // Only include intro if changed (for Email)
    const originalIntro = (editingReminder as any).messageIntro || '';
    const introChanged = editIntro !== originalIntro;
    if (introChanged) {
      updatePayload.messageIntro = editIntro;
    }
    
    // Only include signoff if changed (for Email)
    const originalSignoff = (editingReminder as any).messageSignoff || '';
    const signoffChanged = editSignoff !== originalSignoff;
    if (signoffChanged) {
      updatePayload.messageSignoff = editSignoff;
    }
    
    // Only update if something actually changed
    if (!updatePayload.scheduledAt && !updatePayload.channel && !messageChanged && !introChanged && !signoffChanged) {
      setEditingReminder(null);
      return;
    }
    
    updateReminderMutation.mutate(updatePayload);
  };

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="scheduled-reminders-loading">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!reminders || reminders.length === 0) {
    return (
      <div className="text-center py-8" data-testid="scheduled-reminders-empty">
        <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground mb-2">No scheduled reminders</p>
        <p className="text-sm text-muted-foreground mb-4">
          Reminders will appear here when you send queries to clients with automated follow-ups enabled.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="button-refresh-reminders"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    );
  }

  const pendingReminders = reminders.filter(r => r.status === 'pending');
  const sentReminders = reminders.filter(r => r.status === 'sent');

  const tokenIds = Array.from(new Set(reminders.map(r => r.tokenId)));
  const hasMultipleTokens = tokenIds.length > 1;

  return (
    <div data-testid="scheduled-reminders-panel">
      {/* Summary header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {pendingReminders.length} pending
          </span>
          {sentReminders.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {sentReminders.length} sent
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh reminders"
            data-testid="button-refresh-reminders"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {!hasMultipleTokens && pendingReminders.length > 0 && (
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
        )}
      </div>

      {/* Reminders table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reminders
              .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
              .map((reminder) => {
                const ChannelIcon = channelIcons[reminder.channel] || Mail;
                const statusInfo = statusBadgeVariants[reminder.status] || statusBadgeVariants.pending;
                const scheduledDate = new Date(reminder.scheduledAt);
                const isOverdue = reminder.status === 'pending' && isPast(scheduledDate);

                return (
                  <TableRow key={reminder.id} data-testid={`row-reminder-${reminder.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                        <span data-testid={`text-channel-${reminder.id}`}>
                          {channelLabels[reminder.channel]}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm" data-testid={`text-scheduled-${reminder.id}`}>
                        {reminder.status === 'pending' ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{format(scheduledDate, 'EEE d MMM, HH:mm')}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(scheduledDate, { addSuffix: true })}
                            </span>
                          </div>
                        ) : reminder.status === 'sent' && reminder.sentAt ? (
                          <span>{format(new Date(reminder.sentAt), 'EEE d MMM, HH:mm')}</span>
                        ) : reminder.status === 'cancelled' && reminder.cancelledAt ? (
                          <span className="text-muted-foreground">{format(new Date(reminder.cancelledAt), 'EEE d MMM, HH:mm')}</span>
                        ) : (
                          <span>{format(scheduledDate, 'EEE d MMM, HH:mm')}</span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm" data-testid={`text-recipient-${reminder.id}`}>
                        {reminder.recipientName || '-'}
                      </span>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={statusInfo.variant} className="text-xs w-fit">
                          {reminder.status === 'pending' && isOverdue ? 'Due' : statusInfo.label}
                        </Badge>
                        {reminder.errorMessage && reminder.status === 'failed' && (
                          <div className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            <span className="line-clamp-1">{reminder.errorMessage}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {reminder.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleEditClick(reminder)}
                              data-testid={`button-edit-reminder-${reminder.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
                          </>
                        )}

                        {reminder.status === 'sent' && (
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        )}

                        {reminder.status === 'cancelled' && (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {pendingReminders.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          Reminders will stop automatically when all queries are answered.
        </p>
      )}

      {/* Edit Reminder Dialog */}
      <Dialog open={!!editingReminder} onOpenChange={(open) => !open && setEditingReminder(null)}>
        <DialogContent className={editChannel === 'email' ? "sm:max-w-2xl max-h-[90vh] overflow-hidden" : "sm:max-w-md"} data-testid="dialog-edit-reminder">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Edit Reminder
            </DialogTitle>
            <DialogDescription>
              Modify the reminder schedule, channel, or message content.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Date</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="mt-1"
                  data-testid="input-edit-reminder-date"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Time</Label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="mt-1"
                  data-testid="input-edit-reminder-time"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Channel</Label>
              <Select value={editChannel} onValueChange={setEditChannel}>
                <SelectTrigger className="w-full mt-1" data-testid="select-edit-reminder-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      SMS
                    </div>
                  </SelectItem>
                  <SelectItem value="voice">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      Voice Call
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Email channel: Three-section layout with Edit/Preview toggle */}
            {editChannel === 'email' ? (
              <div className="space-y-3">
                {/* Toggle between Edit and Preview */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Message <span className="text-destructive">*</span></Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={editViewMode === 'edit' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditViewMode('edit')}
                      className="gap-1 h-7 text-xs"
                      data-testid="button-edit-mode"
                    >
                      <FileEdit className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant={editViewMode === 'preview' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditViewMode('preview')}
                      className="gap-1 h-7 text-xs"
                      data-testid="button-preview-mode"
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </Button>
                  </div>
                </div>

                {editViewMode === 'preview' ? (
                  /* Full Preview Mode - matches server-side generateReminderEmailBody */
                  <ScrollArea className="h-[300px] border rounded-md">
                    <div 
                      className="prose prose-sm max-w-none dark:prose-invert"
                      style={{ fontFamily: "'DM Sans', Arial, sans-serif", maxWidth: '600px', margin: '0 auto', padding: '20px' }}
                      data-testid="email-preview-content"
                    >
                      {/* Intro section - custom or default (sanitized for security) */}
                      <div dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(editIntro || `<p>Dear ${editingReminder?.recipientName || 'Client'},</p>`) 
                      }} />
                      
                      {/* Protected reminder content - matches server template */}
                      <p>This is a friendly reminder regarding the bookkeeping queries for <strong>your account</strong>.</p>
                      
                      <p>
                        {editingReminder?.queriesRemaining === editingReminder?.queriesTotal
                          ? `We have ${editingReminder?.queriesRemaining || 'outstanding'} bookkeeping ${(editingReminder?.queriesRemaining || 0) === 1 ? 'query' : 'queries'} that ${(editingReminder?.queriesRemaining || 0) === 1 ? 'requires' : 'require'} your attention.`
                          : `Thank you for your responses so far. We still have ${editingReminder?.queriesRemaining || 0} of ${editingReminder?.queriesTotal || 0} queries remaining that need your input.`
                        }
                      </p>
                      
                      <p>Please click the button below to view and respond to the outstanding queries:</p>
                      
                      <div style={{ textAlign: 'center', margin: '30px 0' }}>
                        <span style={{ 
                          display: 'inline-block',
                          backgroundColor: '#2563eb', 
                          color: 'white', 
                          padding: '12px 24px', 
                          borderRadius: '6px', 
                          fontWeight: 500,
                          textDecoration: 'none'
                        }}>
                          View Queries
                        </span>
                      </div>
                      
                      {/* Sign-off section - custom or default (sanitized for security) */}
                      <div dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(editSignoff || `<p style="color: #666; font-size: 14px;">If you have any questions, please don't hesitate to get in touch with us.</p><p>Best regards,<br/>The Link</p>`) 
                      }} />
                    </div>
                  </ScrollArea>
                ) : (
                  /* Edit Mode - Three sections */
                  <div className="space-y-3">
                    {/* Intro Section (Editable) */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Introduction</Label>
                      <div data-testid="input-edit-reminder-intro" className="border rounded-md">
                        <TiptapEditor
                          content={editIntro}
                          onChange={setEditIntro}
                          placeholder="Hello, ..."
                          editorHeight="80px"
                        />
                      </div>
                    </div>

                    {/* Protected Section (Read-only preview) */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        <Label className="text-xs text-muted-foreground">Reminder Content (Auto-generated)</Label>
                      </div>
                      <div className="border rounded-md bg-muted/30 overflow-hidden">
                        <div 
                          className="p-3 prose prose-sm max-w-none dark:prose-invert text-muted-foreground"
                          data-testid="protected-reminder-content"
                        >
                          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
                            This is a friendly reminder regarding the bookkeeping queries for your account.
                            {editingReminder?.queriesRemaining && (
                              <span> You have <strong>{editingReminder.queriesRemaining}</strong> of <strong>{editingReminder.queriesTotal}</strong> queries remaining.</span>
                            )}
                          </p>
                          <div style={{ textAlign: 'center', marginTop: '12px' }}>
                            <span style={{ 
                              display: 'inline-block', 
                              background: '#2563eb', 
                              color: 'white', 
                              padding: '8px 16px', 
                              borderRadius: '6px', 
                              fontSize: '13px',
                              fontWeight: 500 
                            }}>
                              View Queries
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sign-off Section (Editable) */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Sign-off</Label>
                      <div data-testid="input-edit-reminder-signoff" className="border rounded-md">
                        <TiptapEditor
                          content={editSignoff}
                          onChange={setEditSignoff}
                          placeholder="Best regards, ..."
                          editorHeight="80px"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* SMS/Voice channel: Preview and optional custom message */
              <div className="space-y-3">
                {/* SMS Message Preview */}
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Message Preview</Label>
                  <div className="border rounded-md bg-muted/30 p-3" data-testid="sms-message-preview">
                    <p className="text-sm">
                      {(() => {
                        const firstName = editingReminder?.recipientName?.split(' ')[0] || '';
                        const namePrefix = firstName ? ` ${firstName}` : '';
                        const pendingCount = editingReminder?.queriesRemaining || 1;
                        
                        if (editMessage && editMessage.trim()) {
                          return editMessage;
                        }
                        
                        return pendingCount === 1
                          ? `Hi${namePrefix}, you have 1 bookkeeping query awaiting your response. Please click here to respond: [link]`
                          : `Hi${namePrefix}, you have ${pendingCount} bookkeeping queries awaiting your response. Please click here to respond: [link]`;
                      })()}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {editChannel === 'sms' 
                      ? 'This is the SMS message that will be sent. The link will be automatically included.'
                      : 'This is the voice call script that will be read to the client.'}
                  </p>
                </div>

                {/* Custom Message Override */}
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Custom Message (Optional)</Label>
                  <Textarea
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    placeholder="Leave empty to use the default message above, or enter a custom message..."
                    className="mt-1 min-h-[80px]"
                    data-testid="input-edit-reminder-message"
                  />
                  <p className="text-xs text-muted-foreground">
                    If left empty, the default message shown above will be used.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReminder(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateReminderMutation.isPending || !editDate || !editTime}
              data-testid="button-save-reminder"
            >
              {updateReminderMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
