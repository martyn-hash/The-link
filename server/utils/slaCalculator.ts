export interface SlaSettings {
  slaResponseDays: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  workingDaysOnly: boolean;
}

const DEFAULT_SLA_SETTINGS: SlaSettings = {
  slaResponseDays: 2,
  workingHoursStart: '09:00',
  workingHoursEnd: '17:30',
  workingDays: [1, 2, 3, 4, 5],
  workingDaysOnly: true,
};

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

function isWorkingDay(date: Date, workingDays: number[]): boolean {
  const dayOfWeek = date.getDay();
  return workingDays.includes(dayOfWeek);
}

function isWithinWorkingHours(
  date: Date, 
  workingHoursStart: string, 
  workingHoursEnd: string
): boolean {
  const start = parseTime(workingHoursStart);
  const end = parseTime(workingHoursEnd);
  
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentMinutes = hours * 60 + minutes;
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function getNextWorkingDayStart(
  date: Date, 
  workingDays: number[], 
  workingHoursStart: string
): Date {
  const result = new Date(date);
  const start = parseTime(workingHoursStart);
  
  result.setDate(result.getDate() + 1);
  
  while (!isWorkingDay(result, workingDays)) {
    result.setDate(result.getDate() + 1);
  }
  
  result.setHours(start.hours, start.minutes, 0, 0);
  return result;
}

function getWorkingDayEnd(date: Date, workingHoursEnd: string): Date {
  const result = new Date(date);
  const end = parseTime(workingHoursEnd);
  result.setHours(end.hours, end.minutes, 0, 0);
  return result;
}

export function calculateSlaDeadline(
  receivedAt: Date,
  settings: Partial<SlaSettings> = {}
): Date {
  const config: SlaSettings = { ...DEFAULT_SLA_SETTINGS, ...settings };
  
  if (!config.workingDaysOnly) {
    const deadline = new Date(receivedAt);
    deadline.setDate(deadline.getDate() + config.slaResponseDays);
    return deadline;
  }
  
  let currentDate = new Date(receivedAt);
  let workingDaysRemaining = config.slaResponseDays;
  
  if (!isWorkingDay(currentDate, config.workingDays)) {
    currentDate = getNextWorkingDayStart(currentDate, config.workingDays, config.workingHoursStart);
  } else if (!isWithinWorkingHours(currentDate, config.workingHoursStart, config.workingHoursEnd)) {
    const end = parseTime(config.workingHoursEnd);
    const currentHours = currentDate.getHours();
    const currentMinutes = currentDate.getMinutes();
    const endMinutes = end.hours * 60 + end.minutes;
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    
    if (currentTotalMinutes > endMinutes) {
      currentDate = getNextWorkingDayStart(currentDate, config.workingDays, config.workingHoursStart);
    } else {
      const start = parseTime(config.workingHoursStart);
      currentDate.setHours(start.hours, start.minutes, 0, 0);
    }
  }
  
  while (workingDaysRemaining > 0) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    while (!isWorkingDay(currentDate, config.workingDays)) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    workingDaysRemaining--;
  }
  
  return getWorkingDayEnd(currentDate, config.workingHoursEnd);
}

export function getSlaStatus(
  slaDeadline: Date | null,
  repliedAt: Date | null
): 'replied' | 'overdue' | 'due_today' | 'on_track' | 'no_sla' {
  if (repliedAt) {
    return 'replied';
  }
  
  if (!slaDeadline) {
    return 'no_sla';
  }
  
  const now = new Date();
  const deadlineDate = new Date(slaDeadline);
  
  if (now > deadlineDate) {
    return 'overdue';
  }
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  
  if (deadlineDate >= todayStart && deadlineDate <= todayEnd) {
    return 'due_today';
  }
  
  return 'on_track';
}

export function formatTimeRemaining(slaDeadline: Date | null): string {
  if (!slaDeadline) {
    return 'No SLA';
  }
  
  const now = new Date();
  const deadline = new Date(slaDeadline);
  const diffMs = deadline.getTime() - now.getTime();
  
  if (diffMs < 0) {
    const overdueMins = Math.abs(Math.floor(diffMs / (1000 * 60)));
    if (overdueMins < 60) {
      return `${overdueMins}m overdue`;
    }
    const overdueHours = Math.floor(overdueMins / 60);
    if (overdueHours < 24) {
      return `${overdueHours}h overdue`;
    }
    const overdueDays = Math.floor(overdueHours / 24);
    return `${overdueDays}d overdue`;
  }
  
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 60) {
    return `${mins}m left`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h left`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

export { DEFAULT_SLA_SETTINGS };
