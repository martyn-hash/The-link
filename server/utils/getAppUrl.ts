/**
 * Get the production application URL for use in emails and external links.
 * 
 * This ensures all outbound emails contain working production URLs,
 * not development or localhost URLs.
 * 
 * Priority:
 * 1. APP_URL environment variable (explicitly set production URL)
 * 2. Hardcoded fallback to production domain
 */
export function getAppUrl(): string {
  return process.env.APP_URL || 'https://flow.growth.accountants';
}
