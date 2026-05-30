/**
 * HTML Sanitization Utility
 * 
 * SECURITY: Sanitizes user-generated HTML content to prevent XSS attacks.
 * Uses DOMPurify to strip dangerous elements and attributes while preserving safe formatting.
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * 
 * @param dirty - The potentially unsafe HTML string
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  
  // Configure DOMPurify to allow common formatting tags but strip scripts
  const config = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  };
  
  return DOMPurify.sanitize(dirty, config);
}

/**
 * Sanitize HTML with stricter rules (for user comments, descriptions, etc.)
 * 
 * @param dirty - The potentially unsafe HTML string
 * @returns Sanitized HTML with minimal formatting
 */
export function sanitizeHtmlStrict(dirty: string | null | undefined): string {
  if (!dirty) return '';
  
  const config = {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  };
  
  return DOMPurify.sanitize(dirty, config);
}
