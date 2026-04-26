import type { ErrorEvent, EventHint } from '@sentry/nextjs';

// Allowlist of request headers Sentry may keep. Anything else is dropped.
// Goal: zero PHI / IP / session data leaks pre-BAA.
const ALLOWED_HEADERS = new Set<string>([
  'content-type',
  'content-length',
  'accept',
  'accept-encoding',
  'accept-language',
  'user-agent',
  'host',
  'referer',
]);

// Patterns to redact from any free-form text (error messages, breadcrumbs).
// We can't introspect server-action arguments after the fact, so redact at
// emit time. Keep these tight — false positives are fine, leaks are not.
const REDACTORS: Array<[RegExp, string]> = [
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED-SSN]'],
  [/\b\d{16}\b/g, '[REDACTED-CARDNUM]'],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[REDACTED-EMAIL]'],
  // Phone numbers (US-ish): 10-11 digits possibly with separators.
  [/\b\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED-PHONE]'],
];

function redact(text: string): string {
  return REDACTORS.reduce((out, [re, sub]) => out.replace(re, sub), text);
}

/**
 * Sentry `beforeSend` hook used by both server and edge runtimes.
 *
 * Redacts request data (allowlist headers, drop body/cookies/query),
 * user PII, and pattern-matches PHI-shaped strings out of error messages
 * and breadcrumbs.
 *
 * Pre-BAA HIPAA fence: this is convention + defense-in-depth. Real
 * protection is "don't interpolate user data into error messages."
 */
export function sentryScrub(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.request) {
    event.request.query_string = undefined;
    event.request.data = undefined;
    event.request.cookies = undefined;
    if (event.request.headers) {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(event.request.headers)) {
        if (ALLOWED_HEADERS.has(k.toLowerCase())) next[k] = String(v);
      }
      event.request.headers = next;
    }
  }
  if (event.user) {
    event.user.email = undefined;
    event.user.username = undefined;
    event.user.ip_address = undefined;
  }

  // Scrub free-form text fields.
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = redact(ex.value);
    }
  }
  if (event.breadcrumbs) {
    for (const bc of event.breadcrumbs) {
      if (bc.message) bc.message = redact(bc.message);
      if (bc.data) {
        for (const k of Object.keys(bc.data)) {
          const v = bc.data[k];
          if (typeof v === 'string') bc.data[k] = redact(v);
        }
      }
    }
  }
  if (event.message) event.message = redact(event.message);

  return event;
}
