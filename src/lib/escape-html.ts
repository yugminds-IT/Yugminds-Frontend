/**
 * Escapes a value for interpolation into an HTML string (element text AND
 * quoted attribute values). Use for any data placed into HTML that is built as
 * a string and then written to a document (e.g. print-to-PDF exports); React
 * escapes JSX automatically, string templates do not.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
