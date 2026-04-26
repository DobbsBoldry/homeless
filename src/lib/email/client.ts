import { Resend } from 'resend';

let _client: Resend | null = null;

/**
 * Lazy Resend client. Construction is deferred until first use so importing
 * this module in tests/dev doesn't require RESEND_API_KEY to be set.
 */
export function resendClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    _client = new Resend(key);
  }
  return _client;
}

/**
 * Default sender. Resend lets you send from `onboarding@resend.dev` without
 * domain verification; use that until DNS for a custom domain is configured.
 */
export const DEFAULT_FROM = process.env.RESEND_FROM ?? 'Daviess Coalition <onboarding@resend.dev>';
