/**
 * Get the application URL for use in emails and external links.
 * 
 * Priority:
 * 1. DEV_APP_URL - For testing in development (set in Secrets to get dev URLs in emails)
 * 2. APP_URL environment variable (production URL)
 * 3. Hardcoded fallback to production domain
 * 
 * To receive development URLs in emails during testing:
 * - Set DEV_APP_URL secret to your Replit dev URL (e.g., https://your-repl.replit.dev)
 * - Remove or unset DEV_APP_URL when done testing
 */
export function getAppUrl(): string {
  // DEV_APP_URL takes precedence when set - useful for testing email links locally
  if (process.env.DEV_APP_URL) {
    return process.env.DEV_APP_URL;
  }
  return process.env.APP_URL || 'https://flow.growth.accountants';
}
