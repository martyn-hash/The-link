/**
 * Shared utility functions for data import operations
 * Used by: excelImport.ts, clientsImport.ts, peopleImport.ts, serviceImport.ts
 */

/**
 * Converts Excel serial date to DD/MM/YYYY format
 */
export function excelSerialToDate(serial: number): string | null {
  if (!serial || typeof serial !== "number") return null;
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + serial * 86400000);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Converts Excel serial date to ISO 8601 format
 */
export function excelSerialToISO(serial: number): string | null {
  if (!serial || typeof serial !== "number") return null;
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + serial * 86400000);
  return date.toISOString();
}

/**
 * Formats phone numbers to UK format
 * Handles: +44, 44, 07xxx, etc.
 * Output: 07xxx xxx xxx (mobile), 01xxx xxxxxx (landline), 02x xxxx xxxx (London)
 */
export function formatUKPhoneNumber(phone: string | number | null | undefined): string {
  if (!phone) return "";
  
  let cleaned = String(phone).replace(/[^\d+]/g, "");
  
  // Convert international format to local
  if (cleaned.startsWith("44")) {
    cleaned = "0" + cleaned.substring(2);
  } else if (cleaned.startsWith("+44")) {
    cleaned = "0" + cleaned.substring(3);
  }
  
  // Add leading 0 if missing and number is 10 digits
  if (!cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "0" + cleaned;
  }
  
  // Format UK mobile: 07xxx xxx xxx
  if (cleaned.length === 11 && cleaned.startsWith("07")) {
    return `${cleaned.substring(0, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`;
  }
  
  // Format UK landline 01xxx: 01xxx xxxxxx
  if (cleaned.length === 11 && cleaned.startsWith("01")) {
    return `${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
  }
  
  // Format London 02x: 02x xxxx xxxx
  if (cleaned.length === 11 && cleaned.startsWith("02")) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 7)} ${cleaned.substring(7)}`;
  }
  
  // Handle 10-digit numbers missing leading 0
  if (cleaned.length === 10 && !cleaned.startsWith("0")) {
    cleaned = "0" + cleaned;
    if (cleaned.startsWith("07")) {
      return `${cleaned.substring(0, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`;
    }
  }
  
  return cleaned;
}

/**
 * Parses multi-line address string into structured address components
 * Extracts postcode from anywhere in the address
 */
export function parseAddress(addressString: string | null | undefined): {
  line1: string;
  line2: string;
  line3: string;
  postcode: string;
  country: string;
} {
  if (!addressString) {
    return { line1: "", line2: "", line3: "", postcode: "", country: "" };
  }
  
  const lines = addressString.split(/[\n\r]+/).map(l => l.trim()).filter(l => l);
  
  // UK postcode regex
  const postcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;
  let postcode = "";
  let postcodeIndex = -1;
  
  // Look for standalone postcode line (from end)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (postcodeRegex.test(lines[i])) {
      postcode = lines[i].toUpperCase();
      postcodeIndex = i;
      break;
    }
  }
  
  // If not found as standalone, look for postcode at end of last line
  if (postcodeIndex === -1) {
    const lastLine = lines[lines.length - 1] || "";
    const parts = lastLine.split(/\s+/);
    for (let i = parts.length - 1; i >= 0; i--) {
      const potentialPostcode = parts.slice(i).join(" ");
      if (postcodeRegex.test(potentialPostcode)) {
        postcode = potentialPostcode.toUpperCase();
        lines[lines.length - 1] = parts.slice(0, i).join(" ");
        break;
      }
    }
  } else {
    lines.splice(postcodeIndex, 1);
  }
  
  return {
    line1: lines[0] || "",
    line2: lines[1] || "",
    line3: lines.slice(2).join(", "),
    postcode: postcode,
    country: "United Kingdom",
  };
}

/**
 * Validates UK National Insurance number format
 * Format: AA 99 99 99 A (with or without spaces)
 * Returns true if valid, false if invalid or empty
 */
export function validateNINumber(niNumber: string | null | undefined): { valid: boolean; warning?: string } {
  if (!niNumber) return { valid: true };
  
  const cleaned = niNumber.trim();
  if (!cleaned) return { valid: true };
  
  // NI Number format: 2 letters, 6 digits, 1 letter (optional final letter)
  // Examples: AB123456C, AB 12 34 56 C
  const niRegex = /^[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]?$/i;
  
  if (!niRegex.test(cleaned)) {
    return { valid: false, warning: `NI Number "${niNumber}" may be invalid format` };
  }
  
  return { valid: true };
}

/**
 * Pads company number to 8 digits (UK standard)
 */
export function padCompanyNumber(companyNumber: string | number | null | undefined): string {
  if (!companyNumber) return "";
  const str = String(companyNumber).trim();
  if (!str) return "";
  
  // If already 8+ chars or contains letters (Scottish/NI companies), return as-is
  if (str.length >= 8 || /[A-Za-z]/.test(str)) {
    return str.toUpperCase();
  }
  
  return str.padStart(8, "0");
}

/**
 * Parses date from various formats to ISO string
 * Handles: Excel serial, DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY (American)
 */
export function parseDateToISO(value: string | number | null | undefined): string | null {
  if (!value) return null;
  
  // Handle Excel serial dates
  if (typeof value === "number") {
    return excelSerialToISO(value);
  }
  
  const str = String(value).trim();
  if (!str) return null;
  
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return new Date(str).toISOString();
  }
  
  // DD/MM/YYYY format (UK)
  const ukMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  
  // Try native Date parsing as fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  
  return null;
}

/**
 * Validates email format
 */
export function validateEmail(email: string | null | undefined): { valid: boolean; warning?: string } {
  if (!email) return { valid: true };
  
  const cleaned = String(email).trim();
  if (!cleaned) return { valid: true };
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return { valid: false, warning: `Email "${email}" appears to be invalid format` };
  }
  
  return { valid: true };
}

/**
 * Normalizes boolean-like values from import data
 */
export function parseBoolean(value: string | number | boolean | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  
  const str = String(value).toLowerCase().trim();
  return ["true", "yes", "1", "y", "on"].includes(str);
}
