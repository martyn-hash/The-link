/**
 * Text utility functions for processing and converting text formats.
 */

/**
 * Convert HTML content to plain text for email notifications.
 * Handles common HTML elements and entities.
 */
export const htmlToPlainText = (html: string): string => {
  return html
    // Add line breaks for block elements
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Convert lists to bullet points
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/[uo]l>/gi, '\n')
    // Convert table rows to lines
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<\/th>/gi, ' | ')
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    // Clean up excessive whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};
