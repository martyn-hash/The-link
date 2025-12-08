/**
 * SLA Calculation Service
 * 
 * Handles SLA deadline calculation and thread state transitions for the email dashboard.
 * Features:
 * - Working days/hours-aware deadline calculation
 * - Automatic state transitions on email sync (active ↔ complete)
 * - SLA breach detection with urgency levels
 */

import { storage } from '../storage/index';
import type { EmailThread, CompanySettings } from '@shared/schema';

type WorkingDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type SlaStatus = 'active' | 'complete' | 'snoozed';

interface SlaCalculationResult {
  deadline: Date;
  isBreached: boolean;
  urgencyLevel: 'ok' | 'warning' | 'danger' | 'breached';
  hoursRemaining: number;
  workingHoursRemaining: number;
}

interface SlaSettings {
  slaResponseDays: number;
  slaWorkingDaysOnly: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: WorkingDay[];
}

const DAY_MAP: Record<number, WorkingDay> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat'
};

export class SlaCalculationService {
  private defaultSettings: SlaSettings = {
    slaResponseDays: 2,
    slaWorkingDaysOnly: true,
    workingHoursStart: '09:00',
    workingHoursEnd: '17:30',
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri']
  };

  /**
   * Get SLA settings from company settings, falling back to defaults
   */
  async getSlaSettings(): Promise<SlaSettings> {
    const companySettings = await storage.getCompanySettings();
    
    return {
      slaResponseDays: companySettings?.slaResponseDays ?? this.defaultSettings.slaResponseDays,
      slaWorkingDaysOnly: companySettings?.slaWorkingDaysOnly ?? this.defaultSettings.slaWorkingDaysOnly,
      workingHoursStart: companySettings?.workingHoursStart ?? this.defaultSettings.workingHoursStart,
      workingHoursEnd: companySettings?.workingHoursEnd ?? this.defaultSettings.workingHoursEnd,
      workingDays: (companySettings?.workingDays as WorkingDay[] | null) ?? this.defaultSettings.workingDays
    };
  }

  /**
   * Parse time string (HH:MM) to hours and minutes
   */
  private parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours: hours || 0, minutes: minutes || 0 };
  }

  /**
   * Check if a date is a working day based on settings
   */
  private isWorkingDay(date: Date, workingDays: WorkingDay[]): boolean {
    const dayOfWeek = date.getDay();
    return workingDays.includes(DAY_MAP[dayOfWeek]);
  }

  /**
   * Check if current time is within working hours
   */
  private isWithinWorkingHours(date: Date, settings: SlaSettings): boolean {
    if (!settings.slaWorkingDaysOnly) return true;
    if (!this.isWorkingDay(date, settings.workingDays)) return false;

    const startTime = this.parseTime(settings.workingHoursStart);
    const endTime = this.parseTime(settings.workingHoursEnd);
    
    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const startMinutes = startTime.hours * 60 + startTime.minutes;
    const endMinutes = endTime.hours * 60 + endTime.minutes;
    
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Calculate working hours between two dates
   */
  calculateWorkingHoursBetween(startDate: Date, endDate: Date, settings: SlaSettings): number {
    if (!settings.slaWorkingDaysOnly) {
      return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    }

    const startTime = this.parseTime(settings.workingHoursStart);
    const endTime = this.parseTime(settings.workingHoursEnd);
    const workingHoursPerDay = (endTime.hours * 60 + endTime.minutes - startTime.hours * 60 - startTime.minutes) / 60;

    let totalWorkingHours = 0;
    const current = new Date(startDate);
    
    while (current < endDate) {
      if (this.isWorkingDay(current, settings.workingDays)) {
        const dayStart = new Date(current);
        dayStart.setHours(startTime.hours, startTime.minutes, 0, 0);
        
        const dayEnd = new Date(current);
        dayEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
        
        const effectiveStart = current > dayStart ? current : dayStart;
        const effectiveEnd = endDate < dayEnd ? endDate : dayEnd;
        
        if (effectiveEnd > effectiveStart) {
          totalWorkingHours += (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
        }
      }
      
      current.setDate(current.getDate() + 1);
      current.setHours(startTime.hours, startTime.minutes, 0, 0);
    }

    return totalWorkingHours;
  }

  /**
   * Add working days to a date, respecting working days configuration
   */
  addWorkingDays(startDate: Date, days: number, settings: SlaSettings): Date {
    if (!settings.slaWorkingDaysOnly) {
      const result = new Date(startDate);
      result.setDate(result.getDate() + days);
      return result;
    }

    let result = new Date(startDate);
    let daysAdded = 0;
    
    while (daysAdded < days) {
      result.setDate(result.getDate() + 1);
      if (this.isWorkingDay(result, settings.workingDays)) {
        daysAdded++;
      }
    }

    const endTime = this.parseTime(settings.workingHoursEnd);
    result.setHours(endTime.hours, endTime.minutes, 0, 0);
    
    return result;
  }

  /**
   * Calculate SLA deadline and urgency for a thread
   */
  async calculateSla(thread: EmailThread): Promise<SlaCalculationResult | null> {
    if (!thread.slaStatus || thread.slaStatus === 'complete') {
      return null;
    }

    const activeAt = thread.slaBecameActiveAt;
    if (!activeAt) {
      return null;
    }

    const settings = await this.getSlaSettings();
    const now = new Date();
    
    const deadline = this.addWorkingDays(new Date(activeAt), settings.slaResponseDays, settings);
    const isBreached = now > deadline;
    
    const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    const workingHoursRemaining = isBreached 
      ? -this.calculateWorkingHoursBetween(deadline, now, settings)
      : this.calculateWorkingHoursBetween(now, deadline, settings);

    const totalWorkingHours = settings.slaResponseDays * 
      ((this.parseTime(settings.workingHoursEnd).hours * 60 + this.parseTime(settings.workingHoursEnd).minutes) -
       (this.parseTime(settings.workingHoursStart).hours * 60 + this.parseTime(settings.workingHoursStart).minutes)) / 60;

    let urgencyLevel: 'ok' | 'warning' | 'danger' | 'breached';
    if (isBreached) {
      urgencyLevel = 'breached';
    } else if (workingHoursRemaining <= totalWorkingHours * 0.25) {
      urgencyLevel = 'danger';
    } else if (workingHoursRemaining <= totalWorkingHours * 0.5) {
      urgencyLevel = 'warning';
    } else {
      urgencyLevel = 'ok';
    }

    return {
      deadline,
      isBreached,
      urgencyLevel,
      hoursRemaining,
      workingHoursRemaining
    };
  }

  /**
   * Transition thread to active state when inbound email received
   * Called by email ingestion when a client sends a message
   */
  async transitionToActive(
    threadId: string, 
    messageReceivedAt: Date
  ): Promise<EmailThread | null> {
    const thread = await storage.getEmailThreadById(threadId);
    if (!thread) {
      console.error(`[SLA] Thread ${threadId} not found`);
      return null;
    }

    if (thread.slaStatus === 'active' && thread.slaBecameActiveAt) {
      return thread;
    }

    const updated = await storage.updateEmailThread(threadId, {
      slaStatus: 'active' as const,
      slaBecameActiveAt: messageReceivedAt,
      slaCompletedAt: null,
      slaCompletedBy: null,
      slaSnoozeUntil: null
    });

    console.log(`[SLA] Thread ${threadId} transitioned to active at ${messageReceivedAt.toISOString()}`);
    return updated;
  }

  /**
   * Transition thread to complete state when outbound email sent
   * Called by email ingestion when staff sends a reply
   */
  async transitionToComplete(
    threadId: string,
    completedByUserId?: string
  ): Promise<EmailThread | null> {
    const thread = await storage.getEmailThreadById(threadId);
    if (!thread) {
      console.error(`[SLA] Thread ${threadId} not found`);
      return null;
    }

    if (thread.slaStatus === 'complete') {
      return thread;
    }

    const updated = await storage.updateEmailThread(threadId, {
      slaStatus: 'complete' as const,
      slaCompletedAt: new Date(),
      slaCompletedBy: completedByUserId || null,
      slaSnoozeUntil: null
    });

    console.log(`[SLA] Thread ${threadId} transitioned to complete by ${completedByUserId || 'system'}`);
    return updated;
  }

  /**
   * Manually mark a thread as complete (zero-inbox workflow)
   */
  async markComplete(threadId: string, userId: string): Promise<EmailThread | null> {
    return this.transitionToComplete(threadId, userId);
  }

  /**
   * Snooze a thread until a specified date
   */
  async snoozeThread(
    threadId: string,
    snoozeUntil: Date
  ): Promise<EmailThread | null> {
    const thread = await storage.getEmailThreadById(threadId);
    if (!thread) {
      console.error(`[SLA] Thread ${threadId} not found`);
      return null;
    }

    const updated = await storage.updateEmailThread(threadId, {
      slaStatus: 'snoozed' as const,
      slaSnoozeUntil: snoozeUntil
    });

    console.log(`[SLA] Thread ${threadId} snoozed until ${snoozeUntil.toISOString()}`);
    return updated;
  }

  /**
   * Unsnooze threads that have passed their snooze time
   * Called by scheduled job
   */
  async unsnoozeExpiredThreads(): Promise<number> {
    const now = new Date();
    const snoozedThreads = await storage.getEmailThreadsBySlaStatus('snoozed');
    
    let unsnoozedCount = 0;
    for (const thread of snoozedThreads) {
      if (thread.slaSnoozeUntil && new Date(thread.slaSnoozeUntil) <= now) {
        await storage.updateEmailThread(thread.canonicalConversationId, {
          slaStatus: 'active' as const,
          slaSnoozeUntil: null,
          slaBecameActiveAt: now
        });
        unsnoozedCount++;
        console.log(`[SLA] Thread ${thread.canonicalConversationId} unsnoozed`);
      }
    }

    return unsnoozedCount;
  }

  /**
   * Get aggregated SLA statistics for the dashboard
   */
  async getSlaStats(): Promise<{
    activeCount: number;
    breachedCount: number;
    completeToday: number;
    avgResponseTime: number | null;
  }> {
    const settings = await this.getSlaSettings();
    const now = new Date();
    
    const activeThreads = await storage.getEmailThreadsBySlaStatus('active');
    const completedThreads = await storage.getEmailThreadsBySlaStatus('complete');
    
    let breachedCount = 0;
    for (const thread of activeThreads) {
      if (thread.slaBecameActiveAt) {
        const deadline = this.addWorkingDays(new Date(thread.slaBecameActiveAt), settings.slaResponseDays, settings);
        if (now > deadline) {
          breachedCount++;
        }
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const completeToday = completedThreads.filter(t => 
      t.slaCompletedAt && new Date(t.slaCompletedAt) >= todayStart
    ).length;

    let totalResponseHours = 0;
    let responseCount = 0;
    for (const thread of completedThreads) {
      if (thread.slaBecameActiveAt && thread.slaCompletedAt) {
        const hours = this.calculateWorkingHoursBetween(
          new Date(thread.slaBecameActiveAt),
          new Date(thread.slaCompletedAt),
          settings
        );
        totalResponseHours += hours;
        responseCount++;
      }
    }

    return {
      activeCount: activeThreads.length,
      breachedCount,
      completeToday,
      avgResponseTime: responseCount > 0 ? totalResponseHours / responseCount : null
    };
  }

  /**
   * Process email direction and update SLA status accordingly
   * Called after email is ingested and threaded
   */
  async processEmailForSla(
    threadId: string,
    direction: 'inbound' | 'outbound' | 'internal' | 'external',
    emailDateTime: Date,
    senderUserId?: string
  ): Promise<void> {
    switch (direction) {
      case 'inbound':
        await this.transitionToActive(threadId, emailDateTime);
        break;
      case 'outbound':
        await this.transitionToComplete(threadId, senderUserId);
        break;
    }
  }
}

export const slaCalculationService = new SlaCalculationService();
