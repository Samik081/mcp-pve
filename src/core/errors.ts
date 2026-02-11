/**
 * Error sanitization layer.
 *
 * Strips sensitive credentials from error messages before they reach
 * the LLM context. All PVE API errors should go through sanitizeMessage()
 * to produce safe error strings.
 */

/** Mutable array of sensitive strings to redact from error messages. */
const SENSITIVE_PATTERNS: string[] = [];

/**
 * Register a string that should be redacted from all error messages.
 * Called at startup with token ID and secret before any API calls.
 */
export function registerSensitivePattern(pattern: string): void {
  if (pattern && pattern.length > 0) {
    SENSITIVE_PATTERNS.push(pattern);
  }
}

/**
 * Replace all registered sensitive patterns and common auth header
 * patterns with [REDACTED].
 */
export function sanitizeMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replaceAll(pattern, "[REDACTED]");
  }
  // Strip PVE API token patterns
  sanitized = sanitized.replace(
    /PVEAPIToken=\S+/gi,
    "PVEAPIToken=[REDACTED]",
  );
  sanitized = sanitized.replace(
    /authorization:\s*\S+/gi,
    "authorization: [REDACTED]",
  );
  return sanitized;
}

/**
 * Custom error class for PVE API errors with optional HTTP status code.
 */
export class PveError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "PveError";
    this.statusCode = statusCode;
  }
}
