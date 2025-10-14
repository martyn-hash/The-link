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
      nextStartDate.setUTCMonth(nextStartDate.getUTCMonth() + 1);
      nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + 1);
      // Handle end-of-month edge cases
      handleEndOfMonthEdgeCases(nextStartDate, currentStartDate);
      handleEndOfMonthEdgeCases(nextDueDate, currentDueDate);
      break;

    case "quarterly":
      nextStartDate.setUTCMonth(nextStartDate.getUTCMonth() + 3);
      nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + 3);
      // Handle end-of-month edge cases
      handleEndOfMonthEdgeCases(nextStartDate, currentStartDate);
      handleEndOfMonthEdgeCases(nextDueDate, currentDueDate);
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
 * Handle end-of-month edge cases for monthly/quarterly frequencies
 * If the original date was the last day of a month, keep it as the last day
 */
function handleEndOfMonthEdgeCases(dateToAdjust: Date, originalDate: Date): void {
  const originalDay = originalDate.getUTCDate();
  const originalMonth = originalDate.getUTCMonth();
  const originalYear = originalDate.getUTCFullYear();
  
  // Check if original date was the last day of its month
  const lastDayOfOriginalMonth = new Date(originalYear, originalMonth + 1, 0).getUTCDate();
  
  if (originalDay === lastDayOfOriginalMonth) {
    // Set to last day of the new month
    const newMonth = dateToAdjust.getUTCMonth();
    const newYear = dateToAdjust.getUTCFullYear();
    const lastDayOfNewMonth = new Date(newYear, newMonth + 1, 0).getUTCDate();
    dateToAdjust.setUTCDate(lastDayOfNewMonth);
  }
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