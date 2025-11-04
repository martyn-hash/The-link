/**
 * Shared utility for normalizing project chronology data
 * Provides consistent, error-safe transformation of chronology entries
 * for use with calculateCurrentInstanceTime
 */

export interface ChronologyEntry {
  toStatus: string;
  timestamp: string; // ISO 8601 string
}

export interface RawChronologyEntry {
  toStatus?: string | null;
  timestamp?: string | Date | number | null;
  [key: string]: any;
}

/**
 * Safely converts a timestamp value to ISO 8601 string format
 * Handles Date objects, ISO strings, unix timestamps (ms), and invalid values
 * 
 * @param timestamp - The timestamp to convert (Date, string, or number)
 * @returns ISO 8601 string or null if conversion fails
 */
function safeTimestampToISO(timestamp: string | Date | number | null | undefined): string | null {
  if (timestamp === null || timestamp === undefined) {
    return null;
  }

  try {
    // Already an ISO string - validate it's parseable
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.warn('[chronology] Invalid ISO string timestamp:', timestamp);
        return null;
      }
      return date.toISOString();
    }

    // Date object
    if (timestamp instanceof Date) {
      if (isNaN(timestamp.getTime())) {
        console.warn('[chronology] Invalid Date object');
        return null;
      }
      return timestamp.toISOString();
    }

    // Numeric timestamp (assume milliseconds)
    if (typeof timestamp === 'number') {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.warn('[chronology] Failed to convert numeric timestamp:', timestamp);
        return null;
      }
      return date.toISOString();
    }

    console.warn('[chronology] Unsupported timestamp type:', typeof timestamp);
    return null;
  } catch (error) {
    console.error('[chronology] Error converting timestamp:', error);
    return null;
  }
}

/**
 * Normalizes raw chronology entries for use with calculateCurrentInstanceTime
 * Filters out invalid entries and converts timestamps to ISO 8601 strings
 * 
 * @param chronology - Array of raw chronology entries from the database
 * @returns Array of normalized chronology entries with ISO timestamps
 */
export function normalizeChronology(chronology: RawChronologyEntry[] | null | undefined): ChronologyEntry[] {
  if (!chronology || chronology.length === 0) {
    return [];
  }

  return chronology
    .map((entry): ChronologyEntry | null => {
      // Convert timestamp safely
      const isoTimestamp = safeTimestampToISO(entry.timestamp);
      
      // Skip entries with invalid timestamps
      if (!isoTimestamp) {
        return null;
      }

      return {
        toStatus: entry.toStatus || '', // Allow empty toStatus (matches existing behavior)
        timestamp: isoTimestamp,
      };
    })
    .filter((entry): entry is ChronologyEntry => entry !== null);
}

/**
 * Normalizes a created/updated timestamp to ISO 8601 string
 * Used for consistent date handling in business time calculations
 * 
 * @param date - The date to normalize (Date, string, or undefined)
 * @returns ISO 8601 string or undefined if conversion fails
 */
export function normalizeDate(date: string | Date | null | undefined): string | undefined {
  if (!date) {
    return undefined;
  }

  const isoString = safeTimestampToISO(date);
  return isoString || undefined;
}
