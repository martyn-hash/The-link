import { SQL, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

export function lower(column: PgColumn): SQL {
  return sql`lower(${column})`;
}

/**
 * Normalize a date to the first day of its month for filtering purposes.
 * Accepts Date objects or DD/MM/YYYY formatted strings.
 */
export function normalizeMonthForFiltering(input?: string | Date): string {
  let date: Date;
  
  if (!input) {
    // Default to current month
    date = new Date();
  } else if (typeof input === 'string') {
    // Parse DD/MM/YYYY format
    const cleaned = input.trim();
    const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      throw new Error(`Invalid date format: ${cleaned}. Expected DD/MM/YYYY format.`);
    }
  } else {
    date = input;
  }
  
  // Always use the first day of the month for filtering
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const day = '01';
  const month = String(firstDay.getMonth() + 1).padStart(2, '0');
  const year = firstDay.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Get current month normalized for filtering (first day of current month)
 */
export function getCurrentMonthForFiltering(): string {
  return normalizeMonthForFiltering();
}
