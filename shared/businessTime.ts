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
  
  let totalBusinessHours = 0;
  
  // Create date objects for iteration - work with the actual timestamps, not day boundaries
  const current = new Date(start);
  const endTime = new Date(end);
  
  // If the entire period is within the same day
  if (current.getDate() === endTime.getDate() && 
      current.getMonth() === endTime.getMonth() && 
      current.getFullYear() === endTime.getFullYear()) {
    
    // Check if it's a weekday
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // It's a weekday, calculate hours
      const milliseconds = endTime.getTime() - current.getTime();
      totalBusinessHours = milliseconds / (1000 * 60 * 60);
    }
    // If it's a weekend day, totalBusinessHours remains 0
  } else {
    // Multiple days involved - process day by day
    while (current < endTime) {
      const dayOfWeek = current.getDay();
      
      // Only count weekdays (Monday = 1, Tuesday = 2, ..., Friday = 5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Calculate start and end times for this day
        const dayStart = new Date(current);
        const dayEnd = new Date(current);
        dayEnd.setHours(23, 59, 59, 999);
        
        // Determine actual start time for this day
        const actualStart = current.getDate() === start.getDate() && 
                           current.getMonth() === start.getMonth() && 
                           current.getFullYear() === start.getFullYear() ? start : dayStart;
        
        // Determine actual end time for this day
        const actualEnd = dayEnd > endTime ? endTime : dayEnd;
        
        // Only add hours if there's actual overlap on this day
        if (actualStart < actualEnd) {
          const dayHours = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60);
          totalBusinessHours += dayHours;
        }
      }
      
      // Move to next day
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0); // Reset to start of next day
    }
  }
  
  // Return result rounded to 2 decimal places for precision
  return Math.round(totalBusinessHours * 100) / 100;
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