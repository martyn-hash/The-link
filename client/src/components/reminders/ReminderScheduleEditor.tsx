import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Phone, X, Clock, Calendar, ChevronDown, ChevronUp, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { isWeekend, addDays, setHours, setMinutes, format } from 'date-fns';
import { generateReminderSchedule, formatReminderDate } from '@/lib/reminderScheduleGenerator';
import type { ReminderScheduleItem } from '@/pages/client-detail/components/communications/types';
import { cn } from '@/lib/utils';

interface ChannelAvailability {
  totalSelected: number;
  email: { count: number; available: boolean };
  sms: { count: number; available: boolean };
  voice: { count: number; available: boolean };
}

interface ReminderScheduleEditorProps {
  expiryDays: number;
  recipientPhone?: string;
  recipientEmail?: string;
  channelAvailability?: ChannelAvailability;
  expiryDate?: string;
  schedule: ReminderScheduleItem[];
  onScheduleChange: (schedule: ReminderScheduleItem[]) => void;
  disabled?: boolean;
  /** Whether Voice AI is available (based on project type settings + active webhooks) */
  voiceAiAvailable?: boolean;
}

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'voice', label: 'Voice Call', icon: Phone },
] as const;

const TIME_OPTIONS = [
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '13:30', label: '1:30 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '14:30', label: '2:30 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '15:30', label: '3:30 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:30', label: '4:30 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '17:30', label: '5:30 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '19:30', label: '7:30 PM' },
];

export function ReminderScheduleEditor({
  expiryDays,
  recipientPhone,
  recipientEmail,
  channelAvailability,
  expiryDate,
  schedule,
  onScheduleChange,
  disabled = false,
  voiceAiAvailable = false,
}: ReminderScheduleEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReminderDate, setNewReminderDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [newReminderTime, setNewReminderTime] = useState('10:00');
  const [newReminderChannel, setNewReminderChannel] = useState<'email' | 'sms' | 'voice'>('email');

  // Use channel availability if provided AND has selected recipients, otherwise fall back to legacy props
  // This ensures that when channelAvailability is passed but no recipients are selected yet,
  // we still use the legacy fallback (which may have recipientEmail/recipientPhone from query options)
  const useChannelAvailability = channelAvailability && channelAvailability.totalSelected > 0;
  const hasPhone = useChannelAvailability ? channelAvailability.sms.available : Boolean(recipientPhone);
  const hasEmail = useChannelAvailability ? channelAvailability.email.available : Boolean(recipientEmail);
  const totalRecipients = useChannelAvailability ? channelAvailability.totalSelected : (recipientEmail ? 1 : 0);
  const phoneCount = useChannelAvailability ? channelAvailability.sms.count : (hasPhone ? 1 : 0);
  const emailCount = useChannelAvailability ? channelAvailability.email.count : (hasEmail ? 1 : 0);

  // Generate default schedule when component mounts
  useEffect(() => {
    if (schedule.length === 0 && expiryDays > 0) {
      const generated = generateReminderSchedule(expiryDays);
      // Convert unavailable channels to email:
      // - Voice → Email if Voice AI is not available
      // - SMS → Email if no phone number is available
      const filteredSchedule = generated.map(reminder => {
        if (reminder.channel === 'voice' && !voiceAiAvailable) {
          return { ...reminder, channel: 'email' as const };
        }
        if (reminder.channel === 'sms' && !hasPhone) {
          return { ...reminder, channel: 'email' as const };
        }
        return reminder;
      });
      onScheduleChange(filteredSchedule);
    }
  }, [expiryDays, schedule.length, onScheduleChange, voiceAiAvailable, hasPhone]);
  
  // Also convert unavailable channels to email when availability changes
  useEffect(() => {
    const needsUpdate = schedule.some(r => 
      (r.channel === 'voice' && !voiceAiAvailable) ||
      (r.channel === 'sms' && !hasPhone)
    );
    if (needsUpdate) {
      const updatedSchedule = schedule.map(reminder => {
        if (reminder.channel === 'voice' && !voiceAiAvailable) {
          return { ...reminder, channel: 'email' as const };
        }
        if (reminder.channel === 'sms' && !hasPhone) {
          return { ...reminder, channel: 'email' as const };
        }
        return reminder;
      });
      onScheduleChange(updatedSchedule);
    }
  }, [voiceAiAvailable, hasPhone, schedule, onScheduleChange]);

  const enabledCount = schedule.filter((r) => r.enabled).length;

  const toggleReminder = (id: string) => {
    onScheduleChange(
      schedule.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const updateChannel = (id: string, channel: 'email' | 'sms' | 'voice') => {
    onScheduleChange(
      schedule.map((r) => (r.id === id ? { ...r, channel } : r))
    );
  };

  const updateTime = (id: string, timeValue: string) => {
    const reminder = schedule.find((r) => r.id === id);
    if (!reminder) return;

    const [hours, minutes] = timeValue.split(':').map(Number);
    const date = new Date(reminder.scheduledAt);
    const newDate = setMinutes(setHours(date, hours), minutes);

    const updatedSchedule = schedule
      .map((r) => r.id === id ? { ...r, scheduledAt: newDate.toISOString() } : r)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    onScheduleChange(updatedSchedule);
  };

  const removeReminder = (id: string) => {
    onScheduleChange(schedule.filter((r) => r.id !== id));
  };

  const addReminder = () => {
    if (!newReminderDate) return;
    
    const [hours, minutes] = newReminderTime.split(':').map(Number);
    const newDate = setMinutes(setHours(newReminderDate, hours), minutes);

    const newSchedule = [
      ...schedule,
      {
        id: `reminder-new-${Date.now()}`,
        scheduledAt: newDate.toISOString(),
        channel: newReminderChannel,
        enabled: true,
      },
    ].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    onScheduleChange(newSchedule);
    
    // Reset form and hide it
    setShowAddForm(false);
    setNewReminderDate(addDays(new Date(), 1));
    setNewReminderTime('10:00');
    setNewReminderChannel('email');
  };
  
  const openAddForm = () => {
    // Set default date to tomorrow or day after last reminder
    const lastReminder = schedule[schedule.length - 1];
    const defaultDate = lastReminder
      ? addDays(new Date(lastReminder.scheduledAt), 1)
      : addDays(new Date(), 1);
    setNewReminderDate(defaultDate);
    setNewReminderTime('10:00');
    setNewReminderChannel('email');
    setShowAddForm(true);
  };

  const cancelAll = () => {
    onScheduleChange(schedule.map((r) => ({ ...r, enabled: false })));
  };

  const enableAll = () => {
    onScheduleChange(schedule.map((r) => ({ ...r, enabled: true })));
  };

  const getTimeValue = (isoString: string): string => {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const isChannelDisabled = (channel: 'email' | 'sms' | 'voice', isWeekendDay: boolean): boolean => {
    if (channel === 'voice') {
      // Voice is disabled if: Voice AI not enabled for project type, OR it's a weekend
      if (!voiceAiAvailable || isWeekendDay) return true;
    }
    if (channel === 'sms' && !hasPhone) return true;
    if (channel === 'email' && !hasEmail) return true;
    return false;
  };
  
  // Filter channel options to only show available channels
  const availableChannelOptions = CHANNEL_OPTIONS.filter(option => {
    // Always show email
    if (option.value === 'email') return true;
    // Only show SMS if phone is available
    if (option.value === 'sms') return hasPhone;
    // Only show Voice if Voice AI is enabled for the project type
    if (option.value === 'voice') return voiceAiAvailable;
    return true;
  });

  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-3">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 -ml-2 h-7">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Reminders</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {enabledCount}/{schedule.length}
              </Badge>
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={enableAll}
              disabled={disabled}
              data-testid="button-enable-all-reminders"
            >
              All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={cancelAll}
              disabled={disabled}
              data-testid="button-cancel-all-reminders"
            >
              None
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-3 space-y-2">
            {!hasPhone && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No phone numbers available - SMS and Voice disabled
              </p>
            )}

            <ScrollArea className="h-[280px] pr-2">
              <div className="space-y-2">
                {schedule.map((reminder, index) => {
                  const date = new Date(reminder.scheduledAt);
                  const isWeekendDay = isWeekend(date);

                  return (
                    <div
                      key={reminder.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-md border transition-all',
                        reminder.enabled
                          ? 'bg-background border-border'
                          : 'bg-muted/50 border-muted opacity-60'
                      )}
                      data-testid={`reminder-item-${index}`}
                    >
                      <Switch
                        checked={reminder.enabled}
                        onCheckedChange={() => toggleReminder(reminder.id)}
                        disabled={disabled}
                        className="scale-75"
                        data-testid={`switch-reminder-${index}`}
                      />

                      <div className="flex-1 min-w-0 grid grid-cols-[1fr_80px_90px] gap-2 items-center">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate font-medium">
                            {formatReminderDate(reminder.scheduledAt)}
                          </span>
                          {isWeekendDay && (
                            <Badge variant="outline" className="text-[10px] px-1 h-4">
                              Weekend
                            </Badge>
                          )}
                        </div>

                        <Select
                          value={getTimeValue(reminder.scheduledAt)}
                          onValueChange={(v) => updateTime(reminder.id, v)}
                          disabled={disabled || !reminder.enabled}
                        >
                          <SelectTrigger className="h-7 text-xs px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={reminder.channel}
                          onValueChange={(v) =>
                            updateChannel(reminder.id, v as 'email' | 'sms' | 'voice')
                          }
                          disabled={disabled || !reminder.enabled}
                        >
                          <SelectTrigger className="h-7 text-xs px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableChannelOptions.map((opt) => {
                              const isDisabled = isChannelDisabled(opt.value, isWeekendDay);
                              const channelCount = opt.value === 'email' ? emailCount : phoneCount;
                              const showPartialCoverage = totalRecipients > 0 && channelCount < totalRecipients && channelCount > 0;
                              return (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  disabled={isDisabled}
                                  className="text-xs"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <opt.icon className="h-3 w-3" />
                                    {opt.label}
                                    {showPartialCoverage && (
                                      <span className="text-amber-600">({channelCount}/{totalRecipients})</span>
                                    )}
                                    {opt.value === 'voice' && isWeekendDay && (
                                      <span className="text-muted-foreground">(No weekends)</span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => removeReminder(reminder.id)}
                        disabled={disabled}
                        data-testid={`button-remove-reminder-${index}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {showAddForm ? (
              <div className="p-3 bg-background rounded-md border border-primary/20 space-y-3" data-testid="add-reminder-form">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Plus className="h-3.5 w-3.5" />
                  Add Custom Reminder
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {/* Date Picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs justify-start font-normal"
                        data-testid="picker-reminder-date"
                      >
                        <Calendar className="h-3 w-3 mr-1.5" />
                        {newReminderDate ? format(newReminderDate, 'dd MMM') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={newReminderDate}
                        onSelect={setNewReminderDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  {/* Time Picker */}
                  <Select value={newReminderTime} onValueChange={setNewReminderTime}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-reminder-time">
                      <Clock className="h-3 w-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Channel Picker */}
                  <Select 
                    value={newReminderChannel} 
                    onValueChange={(v) => setNewReminderChannel(v as 'email' | 'sms' | 'voice')}
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid="select-reminder-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableChannelOptions.map((opt) => {
                        const isWeekendDay = newReminderDate ? isWeekend(newReminderDate) : false;
                        const isDisabled = isChannelDisabled(opt.value, isWeekendDay);
                        return (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            disabled={isDisabled}
                            className="text-xs"
                          >
                            <div className="flex items-center gap-1.5">
                              <opt.icon className="h-3 w-3" />
                              {opt.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={addReminder}
                    disabled={!newReminderDate}
                    data-testid="button-confirm-add-reminder"
                  >
                    <Check className="h-3 w-3" />
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowAddForm(false)}
                    data-testid="button-cancel-add-reminder"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5 h-8 text-xs"
                onClick={openAddForm}
                disabled={disabled}
                data-testid="button-add-reminder"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Reminder
              </Button>
            )}

            <p className="text-[11px] text-muted-foreground leading-tight">
              Reminders auto-stop when all queries are answered. Voice calls are disabled on weekends.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
