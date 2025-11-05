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

/**
 * Calculate current instance time for a project in a specific stage (hours)
 * @param chronology - Project chronology entries (will be sorted internally by timestamp DESC)
 * @param currentStage - Current stage name 
 * @param projectCreatedAt - Project creation timestamp (fallback if no chronology)
 * @returns Current instance time in hours
 */
export function calculateCurrentInstanceTime(
  chronology: Array<{ toStatus: string; timestamp: string }>, 
  currentStage: string,
  projectCreatedAt?: string
): number {
  // Sort chronology by timestamp DESC to ensure we get the most recent entries first
  const sortedChronology = [...chronology].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Find the most recent entry that moved TO the current stage
  const lastEntry = sortedChronology.find(entry => entry.toStatus === currentStage);
  
  let startTime: string;
  if (lastEntry) {
    startTime = lastEntry.timestamp;
  } else if (projectCreatedAt) {
    // If no chronology entry exists for this stage, use project creation time
    startTime = projectCreatedAt;
  } else {
    return 0;
  }
  
  try {
    return calculateBusinessHours(startTime, new Date().toISOString());
  } catch (error) {
    console.error("Error calculating current instance time:", error);
    return 0;
  }
}

/**
 * Calculate total time spent in a specific stage across all visits (hours)
 * @param chronology - Project chronology entries (will be sorted internally by timestamp DESC)
 * @param stageName - Stage name to calculate total time for
 * @param projectCreatedAt - Project creation timestamp
 * @param currentStage - Current stage name (to handle ongoing time)
 * @returns Total time spent in the stage across all visits in hours
 */
export function calculateTotalTimeInStage(
  chronology: Array<{ fromStatus: string | null; toStatus: string; timestamp: string; businessHoursInPreviousStage?: number }>,
  stageName: string,
  projectCreatedAt?: string,
  currentStage?: string
): number {
  // Sort chronology by timestamp DESC to ensure consistent processing
  const sortedChronology = [...chronology].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  let totalHours = 0;
  
  // If currently in the target stage, add current instance time
  if (currentStage === stageName) {
    totalHours += calculateCurrentInstanceTime(sortedChronology, stageName, projectCreatedAt);
  }
  
  // Add time from completed visits to this stage
  // Look for entries where the project moved FROM the target stage (completed visits)
  sortedChronology.forEach(entry => {
    if (entry.fromStatus === stageName && entry.businessHoursInPreviousStage) {
      // Convert from business minutes to hours
      totalHours += entry.businessHoursInPreviousStage / 60;
    }
  });
  
  return Math.round(totalHours * 100) / 100; // Round to 2 decimal places
}

/**
 * Adds business hours to a start date, skipping weekends
 * @param startDate - Starting date (Date object or ISO string)
 * @param businessHoursToAdd - Number of business hours to add
 * @returns The deadline date after adding business hours
 */
export function addBusinessHours(startDate: Date | string, businessHoursToAdd: number): Date {
  const start = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);
  
  if (isNaN(start.getTime())) {
    throw new Error('Invalid start date');
  }
  
  if (businessHoursToAdd <= 0) {
    return start;
  }
  
  let remainingHours = businessHoursToAdd;
  const current = new Date(start);
  
  // If starting on a weekend, move to next Monday
  while (isWeekend(current)) {
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }
  
  // Process day by day
  while (remainingHours > 0) {
    const dayOfWeek = current.getDay();
    
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }
    
    // Calculate hours available in the current day
    const hoursRemainingInDay = 24 - current.getHours() - (current.getMinutes() / 60) - (current.getSeconds() / 3600);
    
    if (remainingHours <= hoursRemainingInDay) {
      // Can finish within this day
      const millisToAdd = remainingHours * 60 * 60 * 1000;
      current.setTime(current.getTime() + millisToAdd);
      remainingHours = 0;
    } else {
      // Use up rest of this day and continue to next
      remainingHours -= hoursRemainingInDay;
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }
  }
  
  return current;
}