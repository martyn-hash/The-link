/**
 * Frequency Calculator Service
 * Handles date calculations for different service frequencies
 */

export type ServiceFrequency = "daily" | "weekly" | "fortnightly" | "monthly" | "quarterly" | "annually";

interface NextDateResult {
  nextStartDate: Date;
  nextDueDate: Date;
}

/**
 * Safely increment a date by N months, handling month-end edge cases correctly.
 * This prevents overflow issues where incrementing "31 Oct" by 1 month would
 * overflow to "1 Dec" instead of "30 Nov".
 * 
 * Strategy: Always attempt to preserve the day-of-month (29, 30, or 31) across
 * months. If that day doesn't exist in the target month, use the last available
 * day, but remember the intended day for future months.
 * - 31 Oct → 30 Nov (31 doesn't exist) → 31 Dec (revert to 31)
 * - 30 Jan → 28 Feb (30 doesn't exist) → 30 Mar (revert to 30)
 * 
 * @param date The date to increment (modified in place)
 * @param monthsToAdd Number of months to add
 * @param intendedDay Optional: The day-of-month the service was originally scheduled for
 */
function incrementMonthSafely(date: Date, monthsToAdd: number, intendedDay?: number): void {
  const originalDay = date.getUTCDate();
  const originalMonth = date.getUTCMonth();
  const originalYear = date.getUTCFullYear();
  
  // Use the intended day if provided (for tracking across truncations),
  // otherwise use the current day
  const targetDay = intendedDay || originalDay;
  
  const targetMonth = originalMonth + monthsToAdd;
  const targetYear = originalYear + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  
  // Set to day 1 first to prevent overflow
  date.setUTCDate(1);
  date.setUTCFullYear(targetYear);
  date.setUTCMonth(normalizedMonth);
  
  // Get the last day of the target month
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  
  // Use the target day if it exists in the target month, otherwise use the last day
  const finalDay = Math.min(targetDay, lastDayOfTargetMonth);
  date.setUTCDate(finalDay);
}

/**
 * Calculate the next service dates based on frequency
 */
export function calculateNextServiceDates(
  currentStartDate: Date,
  currentDueDate: Date,
  frequency: ServiceFrequency
): NextDateResult {
  const nextStartDate = new Date(currentStartDate);
  const nextDueDate = new Date(currentDueDate);
  
  // Ensure we're working with UTC times to avoid timezone issues
  nextStartDate.setUTCHours(0, 0, 0, 0);
  nextDueDate.setUTCHours(0, 0, 0, 0);

  switch (frequency) {
    case "daily":
      nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 1);
      nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 1);
      break;

    case "weekly":
      nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 7);
      nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 7);
      break;

    case "fortnightly":
      nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 14);
      nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 14);
      break;

    case "monthly":
      // Preserve intended day for end-of-month dates (29, 30, 31)
      const startIntendedDay = currentStartDate.getUTCDate() >= 29 ? currentStartDate.getUTCDate() : undefined;
      const dueIntendedDay = currentDueDate.getUTCDate() >= 29 ? currentDueDate.getUTCDate() : undefined;
      incrementMonthSafely(nextStartDate, 1, startIntendedDay);
      incrementMonthSafely(nextDueDate, 1, dueIntendedDay);
      break;

    case "quarterly":
      // Preserve intended day for end-of-month dates (29, 30, 31)
      const qStartIntendedDay = currentStartDate.getUTCDate() >= 29 ? currentStartDate.getUTCDate() : undefined;
      const qDueIntendedDay = currentDueDate.getUTCDate() >= 29 ? currentDueDate.getUTCDate() : undefined;
      incrementMonthSafely(nextStartDate, 3, qStartIntendedDay);
      incrementMonthSafely(nextDueDate, 3, qDueIntendedDay);
      break;

    case "annually":
      nextStartDate.setUTCFullYear(nextStartDate.getUTCFullYear() + 1);
      nextDueDate.setUTCFullYear(nextDueDate.getUTCFullYear() + 1);
      // Handle leap year edge cases for Feb 29
      handleLeapYearEdgeCases(nextStartDate, currentStartDate);
      handleLeapYearEdgeCases(nextDueDate, currentDueDate);
      break;

    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }

  return { nextStartDate, nextDueDate };
}

/**
 * Handle leap year edge cases for annual frequencies
 * If the original date was Feb 29, and the next year isn't a leap year, use Feb 28
 */
function handleLeapYearEdgeCases(dateToAdjust: Date, originalDate: Date): void {
  const originalMonth = originalDate.getUTCMonth();
  const originalDay = originalDate.getUTCDate();
  
  // Only handle Feb 29 case
  if (originalMonth === 1 && originalDay === 29) {
    const newYear = dateToAdjust.getUTCFullYear();
    if (!isLeapYear(newYear)) {
      dateToAdjust.setUTCDate(28); // Use Feb 28 in non-leap years
    }
  }
}

/**
 * Check if a year is a leap year
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Compare two dates by calendar date only (YYYY-MM-DD) regardless of timezone
 */
function compareDateOnly(date1: Date, date2: Date): boolean {
  const date1Str = date1.toISOString().slice(0, 10);
  const date2Str = date2.toISOString().slice(0, 10);
  return date1Str === date2Str;
}

/**
 * Check if a service is due today or overdue
 * Returns true for services scheduled for today OR any past date
 */
export function isServiceDueToday(nextStartDate: Date, targetDate: Date = new Date()): boolean {
  const serviceDateStr = nextStartDate.toISOString().slice(0, 10);
  const targetDateStr = targetDate.toISOString().slice(0, 10);
  return serviceDateStr <= targetDateStr; // On or before target date
}

/**
 * Check if a service is overdue (start date is in the past)
 */
export function isServiceOverdue(nextStartDate: Date, targetDate: Date = new Date()): boolean {
  const serviceDateStr = nextStartDate.toISOString().slice(0, 10);
  const targetDateStr = targetDate.toISOString().slice(0, 10);
  return serviceDateStr < targetDateStr;
}

/**
 * Get all services that are due for a specific date
 * This is the main function used by the scheduling service
 */
export function getServicesDueForDate(
  services: Array<{
    id: string;
    nextStartDate: Date | null;
    frequency: ServiceFrequency;
  }>,
  targetDate: Date = new Date()
): Array<{ id: string; nextStartDate: Date; frequency: ServiceFrequency }> {
  return services
    .filter(service => 
      service.nextStartDate && 
      isServiceDueToday(service.nextStartDate, targetDate)
    )
    .map(service => ({
      id: service.id,
      nextStartDate: service.nextStartDate!,
      frequency: service.frequency
    }));
}

/**
 * Get all overdue services
 * Used for reporting and failure analysis
 */
export function getOverdueServices(
  services: Array<{
    id: string;
    nextStartDate: Date | null;
    frequency: ServiceFrequency;
  }>,
  targetDate: Date = new Date()
): Array<{ id: string; nextStartDate: Date; frequency: ServiceFrequency; daysPastDue: number }> {
  const startOfToday = new Date(targetDate);
  startOfToday.setUTCHours(0, 0, 0, 0);
  
  return services
    .filter(service => 
      service.nextStartDate && 
      isServiceOverdue(service.nextStartDate, targetDate)
    )
    .map(service => {
      const startOfServiceDate = new Date(service.nextStartDate!);
      startOfServiceDate.setUTCHours(0, 0, 0, 0);
      
      const daysPastDue = Math.ceil(
        (startOfToday.getTime() - startOfServiceDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      return {
        id: service.id,
        nextStartDate: service.nextStartDate!,
        frequency: service.frequency,
        daysPastDue
      };
    });
}

/**
 * Format frequency for display
 */
export function formatFrequency(frequency: ServiceFrequency): string {
  const frequencyLabels: Record<ServiceFrequency, string> = {
    daily: "Daily",
    weekly: "Weekly", 
    fortnightly: "Fortnightly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    annually: "Annually"
  };
  
  return frequencyLabels[frequency] || frequency;
}