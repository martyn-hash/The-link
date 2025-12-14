import { storage } from "../storage";
import { addDays, addHours, addMinutes, isWeekend, setHours, setMinutes, differenceInMinutes, startOfDay, isBefore, isAfter, getDay, format } from "date-fns";

interface SlaSettings {
  slaResponseDays: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  slaTimezone: string;
}

interface SlaCalculationResult {
  deadline: Date;
  businessHoursUsed: number;
}

interface TimeRemainingResult {
  totalMinutes: number;
  businessMinutes: number;
  displayText: string;
  isBreached: boolean;
  urgencyLevel: "critical" | "high" | "normal" | "low";
}

async function getSlaSettings(): Promise<SlaSettings> {
  const settings = await storage.getCompanySettings();
  return {
    slaResponseDays: settings?.slaResponseDays ?? 2,
    workingHoursStart: settings?.workingHoursStart ?? "09:00",
    workingHoursEnd: settings?.workingHoursEnd ?? "17:00",
    workingDays: (settings?.workingDays as number[]) ?? [1, 2, 3, 4, 5],
    slaTimezone: settings?.slaTimezone ?? "Europe/London",
  };
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

function isBusinessDay(date: Date, workingDays: number[]): boolean {
  const dayOfWeek = getDay(date);
  return workingDays.includes(dayOfWeek);
}

function getBusinessStartTime(date: Date, startTime: { hours: number; minutes: number }): Date {
  return setMinutes(setHours(startOfDay(date), startTime.hours), startTime.minutes);
}

function getBusinessEndTime(date: Date, endTime: { hours: number; minutes: number }): Date {
  return setMinutes(setHours(startOfDay(date), endTime.hours), endTime.minutes);
}

function getBusinessMinutesInDay(startTimeStr: string, endTimeStr: string): number {
  const start = parseTime(startTimeStr);
  const end = parseTime(endTimeStr);
  return (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
}

export async function calculateSlaDeadline(receivedAt: Date): Promise<Date> {
  const settings = await getSlaSettings();
  const startTime = parseTime(settings.workingHoursStart);
  const endTime = parseTime(settings.workingHoursEnd);
  const minutesPerDay = getBusinessMinutesInDay(settings.workingHoursStart, settings.workingHoursEnd);
  const totalBusinessMinutesNeeded = settings.slaResponseDays * minutesPerDay;
  
  let remainingMinutes = totalBusinessMinutesNeeded;
  let currentDate = new Date(receivedAt);
  
  while (remainingMinutes > 0) {
    if (isBusinessDay(currentDate, settings.workingDays)) {
      const dayStart = getBusinessStartTime(currentDate, startTime);
      const dayEnd = getBusinessEndTime(currentDate, endTime);
      
      let effectiveStart = currentDate;
      if (isBefore(currentDate, dayStart)) {
        effectiveStart = dayStart;
      }
      
      if (isBefore(effectiveStart, dayEnd)) {
        const minutesAvailableToday = differenceInMinutes(dayEnd, effectiveStart);
        
        if (minutesAvailableToday >= remainingMinutes) {
          return addMinutes(effectiveStart, remainingMinutes);
        }
        
        remainingMinutes -= minutesAvailableToday;
      }
    }
    
    currentDate = addDays(startOfDay(currentDate), 1);
    const nextDayStart = getBusinessStartTime(currentDate, startTime);
    currentDate = nextDayStart;
  }
  
  return currentDate;
}

export async function getTimeRemaining(deadline: Date | null): Promise<TimeRemainingResult | null> {
  if (!deadline) {
    return null;
  }
  
  const now = new Date();
  const settings = await getSlaSettings();
  const startTime = parseTime(settings.workingHoursStart);
  const endTime = parseTime(settings.workingHoursEnd);
  
  const totalMinutes = differenceInMinutes(deadline, now);
  const isBreached = totalMinutes <= 0;
  
  let businessMinutes = 0;
  let currentDate = new Date(now);
  
  if (!isBreached) {
    while (isBefore(currentDate, deadline)) {
      if (isBusinessDay(currentDate, settings.workingDays)) {
        const dayStart = getBusinessStartTime(currentDate, startTime);
        const dayEnd = getBusinessEndTime(currentDate, endTime);
        
        let effectiveStart = currentDate;
        if (isBefore(currentDate, dayStart)) {
          effectiveStart = dayStart;
        }
        
        let effectiveEnd = deadline;
        if (isAfter(deadline, dayEnd)) {
          effectiveEnd = dayEnd;
        }
        
        if (isBefore(effectiveStart, effectiveEnd) && isBefore(effectiveStart, dayEnd) && isAfter(effectiveEnd, dayStart)) {
          if (isBefore(effectiveStart, dayStart)) {
            effectiveStart = dayStart;
          }
          if (isAfter(effectiveEnd, dayEnd)) {
            effectiveEnd = dayEnd;
          }
          businessMinutes += Math.max(0, differenceInMinutes(effectiveEnd, effectiveStart));
        }
      }
      
      currentDate = addDays(startOfDay(currentDate), 1);
      currentDate = getBusinessStartTime(currentDate, startTime);
    }
  }
  
  const urgencyLevel = getUrgencyFromTimeRemaining(businessMinutes, isBreached);
  const displayText = formatTimeRemaining(businessMinutes, isBreached);
  
  return {
    totalMinutes,
    businessMinutes,
    displayText,
    isBreached,
    urgencyLevel,
  };
}

function getUrgencyFromTimeRemaining(businessMinutes: number, isBreached: boolean): "critical" | "high" | "normal" | "low" {
  if (isBreached) {
    return "critical";
  }
  
  const hours = businessMinutes / 60;
  
  if (hours <= 2) {
    return "critical";
  } else if (hours <= 4) {
    return "high";
  } else if (hours <= 8) {
    return "normal";
  }
  
  return "low";
}

function formatTimeRemaining(businessMinutes: number, isBreached: boolean): string {
  if (isBreached) {
    return "Overdue";
  }
  
  if (businessMinutes < 60) {
    return `${businessMinutes}m remaining`;
  }
  
  const hours = Math.floor(businessMinutes / 60);
  const minutes = businessMinutes % 60;
  
  if (hours < 8) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${hours}h remaining`;
  }
  
  const days = Math.floor(hours / 8);
  const remainingHours = hours % 8;
  
  if (days === 1) {
    if (remainingHours > 0) {
      return `1 day ${remainingHours}h remaining`;
    }
    return "1 day remaining";
  }
  
  if (remainingHours > 0) {
    return `${days} days ${remainingHours}h remaining`;
  }
  return `${days} days remaining`;
}

export async function checkForSlaBreaches(): Promise<{ emailId: string; deadline: Date }[]> {
  const now = new Date();
  const breaches: { emailId: string; deadline: Date }[] = [];
  
  const pendingEmails = await storage.getEmailsRequiringReplyWithDeadlines();
  
  for (const email of pendingEmails) {
    if (email.slaDeadline && isBefore(email.slaDeadline, now) && !email.slaBreach) {
      breaches.push({
        emailId: email.emailId,
        deadline: email.slaDeadline,
      });
    }
  }
  
  return breaches;
}

export async function markEmailsAsBreached(emailIds: string[]): Promise<void> {
  const now = new Date();
  for (const emailId of emailIds) {
    await storage.updateSlaBreach(emailId, true, now);
  }
}
