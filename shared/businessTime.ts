/**
 * Calculates business hours between two timestamps, excluding weekends.
 * Business hours = Monday 00:00 to Friday 23:59 (weekdays only)
 * Weekends (Saturday/Sunday) don't count at all.
 * 
 * @param startTimestamp - ISO string timestamp for start time
 * @param endTimestamp - ISO string timestamp for end time  
 * @returns Number of business hours (excluding weekends)
 */
export function calculateBusinessHours(startTimestamp: string, endTimestamp: string): number {
  const start = new Date(startTimestamp);
  const end = new Date(endTimestamp);
  
  // Validate input dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid timestamp format');
  }
  
  if (start >= end) {
    return 0; // No business hours if start is after or equal to end
  }
  
  // Calculate total hours between timestamps
  const totalMilliseconds = end.getTime() - start.getTime();
  const totalHours = totalMilliseconds / (1000 * 60 * 60);
  
  // Count weekend hours to subtract
  let weekendHours = 0;
  
  // Create date objects for iteration (reset to start of day)
  const currentDate = new Date(start);
  currentDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  
  // Iterate through each day in the range
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend day
      // Calculate how many hours of this weekend day are in our range
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Find the overlap between this weekend day and our time range
      const rangeStart = dayStart < start ? start : dayStart;
      const rangeEnd = dayEnd > end ? end : dayEnd;
      
      if (rangeStart < rangeEnd) {
        const weekendMilliseconds = rangeEnd.getTime() - rangeStart.getTime();
        weekendHours += weekendMilliseconds / (1000 * 60 * 60);
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Subtract weekend hours from total hours
  const businessHours = totalHours - weekendHours;
  
  // Return result rounded to 2 decimal places for precision
  return Math.round(businessHours * 100) / 100;
}

/**
 * Helper function to check if a date is a weekend (Saturday or Sunday)
 * @param date - Date to check
 * @returns true if weekend, false if weekday
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
}

/**
 * Helper function to get the next business day (Monday-Friday)
 * @param date - Starting date
 * @returns Next business day
 */
export function getNextBusinessDay(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  // Skip weekends
  while (isWeekend(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}