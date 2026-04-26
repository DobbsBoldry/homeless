import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the X-Twilio-Signature header against the documented algorithm:
 *
 *   base64(HMAC-SHA1(authToken, fullUrl + sortedParams))
 *
 * `fullUrl` must include the protocol, host, and path (no query). The
 * `params` map is the form-encoded body keys, sorted alphabetically and
 * concatenated as `key + value` pairs (no separators). See
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * This is a clean-room implementation so we don't take a dependency on
 * the full `twilio` SDK just to verify a signature.
 */
export function verifyTwilioSignature(
  authToken: string,
  fullUrl: string,
  params: Record<string, string>,
  signatureHeader: string,
): boolean {
  if (!authToken || !signatureHeader) return false;

  const sortedKeys = Object.keys(params).sort();
  let canonical = fullUrl;
  for (const k of sortedKeys) canonical += k + params[k];

  const expected = createHmac('sha1', authToken).update(canonical, 'utf-8').digest('base64');

  // timingSafeEqual requires equal-length buffers — guard explicitly.
  if (expected.length !== signatureHeader.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

/**
 * TwiML <Response><Message> wrapper. Twilio expects an XML body when
 * replying inline to an inbound webhook, OR a 204 with an out-of-band
 * SMS sent via the REST API. We use the inline TwiML form — simplest,
 * no API calls, signed by the request itself.
 */
export function twimlMessage(body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Message>${escaped}</Message></Response>`;
}

export function twimlEmpty(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<Response/>';
}
