import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the X-Twilio-Signature header against the documented algorithm:
 *
 *   base64(HMAC-SHA1(authToken, fullUrl + sortedParams))
 *
 * `fullUrl` must include the protocol, host, and path (no query). Param
 * canonicalization: collect unique keys, sort alphabetically, then for
 * each key append `key + value` for every value (in body order — Twilio
 * concatenates ALL values for a repeated key, preserving order).
 *
 * Accepts either a `Record<string, string>` (single-value-per-key, the
 * common case) OR `URLSearchParams` (faithful to repeated keys per Twilio
 * spec — #269 fix). Internally normalized to a unique-keys-with-ordered-
 * values shape.
 *
 * See https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * Clean-room implementation so we don't take a dependency on the full
 * `twilio` SDK just to verify a signature.
 */
export function verifyTwilioSignature(
  authToken: string,
  fullUrl: string,
  params: Record<string, string> | URLSearchParams,
  signatureHeader: string,
): boolean {
  if (!authToken || !signatureHeader) return false;

  // Normalize to (key → ordered values) so the canonical string handles
  // repeated keys per Twilio's spec, while still accepting the common
  // single-value-per-key shape used by 99% of callsites and tests.
  const grouped: Record<string, string[]> = {};
  if (params instanceof URLSearchParams) {
    // URLSearchParams iteration preserves insertion order; collect each
    // unique key with all of its values in that order.
    for (const k of new Set(params.keys())) grouped[k] = params.getAll(k);
  } else {
    for (const [k, v] of Object.entries(params)) grouped[k] = [v];
  }

  let canonical = fullUrl;
  for (const k of Object.keys(grouped).sort()) {
    for (const v of grouped[k]) canonical += k + v;
  }

  const expected = createHmac('sha1', authToken).update(canonical, 'utf-8').digest('base64');

  // timingSafeEqual requires equal-length buffers — guard explicitly.
  if (expected.length !== signatureHeader.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

// XML 1.0 disallows characters in C0 except TAB (\x09), LF (\x0A), CR
// (\x0D). If a user typo or paste sneaks one in, Twilio drops the reply
// silently. Strip them before assembling TwiML (#269 fix). The whole
// point of this regex is to MATCH control chars, so biome's lint is
// inverted here.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control chars is the intent
const C0_INVALID_XML = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

/**
 * TwiML <Response><Message> wrapper. Twilio expects an XML body when
 * replying inline to an inbound webhook, OR a 204 with an out-of-band
 * SMS sent via the REST API. We use the inline TwiML form — simplest,
 * no API calls, signed by the request itself.
 */
export function twimlMessage(body: string): string {
  const escaped = body
    .replace(C0_INVALID_XML, '')
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

/**
 * Phone-identifier helper (#269 fix). Returns either the raw E.164 phone
 * (when `INDC_SMS_HASH_PHONES` is unset or `0`) or a deterministic SHA-256
 * hex digest (when `INDC_SMS_HASH_PHONES=1`). Deterministic so conversation
 * state lookups across messages still resolve to the same identifier.
 *
 * Phase 1 staff-only traffic runs unhashed; this scaffolding lets the
 * unhoused-companion launch flip the flag without a migration scramble.
 * Operational caveat at flip time: outbound replies still need the raw
 * E.164 (Twilio's `to` field). The bed-hold contact path will need to
 * either preserve the raw phone in a separate, more-protected column or
 * route replies through stored conversation state.
 */
export function identifierForPhone(phone: string): string {
  if (process.env.INDC_SMS_HASH_PHONES !== '1') return phone;
  if (!phone) return phone;
  return createHash('sha256').update(phone, 'utf-8').digest('hex');
}
