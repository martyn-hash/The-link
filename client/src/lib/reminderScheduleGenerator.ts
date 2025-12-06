import { addDays, setHours, setMinutes, format, isWeekend } from 'date-fns';
import type { ReminderScheduleItem } from '@/pages/client-detail/components/communications/types';

type ReminderChannel = 'email' | 'sms' | 'voice';

interface TimeSlot {
  hour: number;
  minute: number;
  period: 'morning' | 'afternoon' | 'evening';
}

const TIME_SLOTS: TimeSlot[] = [
  { hour: 9, minute: 30, period: 'morning' },
  { hour: 10, minute: 0, period: 'morning' },
  { hour: 11, minute: 0, period: 'morning' },
  { hour: 14, minute: 0, period: 'afternoon' },
  { hour: 14, minute: 30, period: 'afternoon' },
  { hour: 15, minute: 30, period: 'afternoon' },
  { hour: 17, minute: 0, period: 'evening' },
  { hour: 18, minute: 0, period: 'evening' },
  { hour: 19, minute: 0, period: 'evening' },
  { hour: 19, minute: 30, period: 'evening' },
];

const CHANNEL_ROTATION: ReminderChannel[] = ['email', 'sms', 'voice'];

function getChannelForIndex(index: number, isWeekendDay: boolean): ReminderChannel {
  if (isWeekendDay) {
    return index % 2 === 0 ? 'email' : 'sms';
  }
  return CHANNEL_ROTATION[index % CHANNEL_ROTATION.length];
}

function getTimeSlotForIndex(index: number, isWeekendDay: boolean): TimeSlot {
  const periodIndex = index % 3;
  const periods: ('morning' | 'afternoon' | 'evening')[] = isWeekendDay 
    ? ['morning', 'afternoon'] 
    : ['morning', 'afternoon', 'evening'];
  const targetPeriod = periods[periodIndex % periods.length];
  
  const slotsForPeriod = TIME_SLOTS.filter(s => s.period === targetPeriod);
  const slotIndex = Math.floor(index / 3) % slotsForPeriod.length;
  return slotsForPeriod[slotIndex] || TIME_SLOTS[0];
}

export function generateReminderSchedule(expiryDays: number, startDate: Date = new Date()): ReminderScheduleItem[] {
  const reminders: ReminderScheduleItem[] = [];
  
  for (let day = 0; day < expiryDays; day++) {
    const targetDate = addDays(startDate, day + 1);
    const isWeekendDay = isWeekend(targetDate);
    
    const timeSlot = getTimeSlotForIndex(day, isWeekendDay);
    const channel = getChannelForIndex(day, isWeekendDay);
    
    if (isWeekendDay && channel === 'voice') {
      continue;
    }
    
    const scheduledAt = setMinutes(setHours(targetDate, timeSlot.hour), timeSlot.minute);
    
    reminders.push({
      id: `reminder-${day}-${Date.now()}`,
      scheduledAt: scheduledAt.toISOString(),
      channel,
      enabled: true,
    });
  }
  
  return reminders;
}

export function formatReminderTime(isoString: string): string {
  const date = new Date(isoString);
  return format(date, 'EEE d MMM, h:mm a');
}

export function formatReminderDate(isoString: string): string {
  const date = new Date(isoString);
  return format(date, 'EEE d MMM');
}

export function formatReminderTimeOnly(isoString: string): string {
  const date = new Date(isoString);
  return format(date, 'h:mm a');
}

export function getChannelLabel(channel: ReminderChannel): string {
  switch (channel) {
    case 'email':
      return 'Email';
    case 'sms':
      return 'SMS';
    case 'voice':
      return 'Voice Call';
    default:
      return channel;
  }
}

export function getChannelIcon(channel: ReminderChannel): string {
  switch (channel) {
    case 'email':
      return 'Mail';
    case 'sms':
      return 'MessageSquare';
    case 'voice':
      return 'Phone';
    default:
      return 'Bell';
  }
}
