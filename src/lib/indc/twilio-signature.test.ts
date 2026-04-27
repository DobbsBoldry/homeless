import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  identifierForPhone,
  twimlEmpty,
  twimlMessage,
  verifyTwilioSignature,
} from './twilio-signature';

const sign = (token: string, url: string, params: Record<string, string>) => {
  const sortedKeys = Object.keys(params).sort();
  let canonical = url;
  for (const k of sortedKeys) canonical += k + params[k];
  return createHmac('sha1', token).update(canonical, 'utf-8').digest('base64');
};

describe('verifyTwilioSignature', () => {
  const token = 'test_auth_token';
  const url = 'https://example.test/api/webhooks/twilio/sms';
  const params = { From: '+15551234567', To: '+15557654321', Body: 'BED FAMILY' };

  it('accepts a valid signature', () => {
    const sig = sign(token, url, params);
    expect(verifyTwilioSignature(token, url, params, sig)).toBe(true);
  });

  it('rejects when the body has been tampered with', () => {
    const sig = sign(token, url, params);
    expect(verifyTwilioSignature(token, url, { ...params, Body: 'BED PET' }, sig)).toBe(false);
  });

  it('rejects when the signature header is empty', () => {
    expect(verifyTwilioSignature(token, url, params, '')).toBe(false);
  });

  it('rejects when the auth token is empty', () => {
    const sig = sign(token, url, params);
    expect(verifyTwilioSignature('', url, params, sig)).toBe(false);
  });

  it('is param-order independent', () => {
    const reordered = { Body: params.Body, To: params.To, From: params.From };
    const sig = sign(token, url, reordered);
    expect(verifyTwilioSignature(token, url, params, sig)).toBe(true);
  });

  // #269 fix — repeated form-keys per Twilio's spec.
  it('accepts URLSearchParams and concatenates repeated values in body order', () => {
    // Build a body with a repeated MediaUrl key. Twilio doesn't use
    // repeated keys in the standard SMS payload, but the spec says
    // the canonical form is "key + value1 + value2 + ..." for any
    // repeated key. Simulate it and verify.
    const sp = new URLSearchParams();
    sp.append('From', '+15551234567');
    sp.append('To', '+15557654321');
    sp.append('Body', 'BED');
    sp.append('MediaUrl', 'https://media.example/1.jpg');
    sp.append('MediaUrl', 'https://media.example/2.jpg');

    // Hand-compute the canonical form: alpha-sorted unique keys, with
    // each repeated key's values concatenated in body insertion order.
    let canonical = url;
    canonical += 'Body' + 'BED';
    canonical += 'From' + '+15551234567';
    canonical += 'MediaUrl' + 'https://media.example/1.jpg';
    canonical += 'MediaUrl' + 'https://media.example/2.jpg';
    canonical += 'To' + '+15557654321';
    const sig = createHmac('sha1', token).update(canonical, 'utf-8').digest('base64');

    expect(verifyTwilioSignature(token, url, sp, sig)).toBe(true);
  });

  it('rejects when only the first occurrence of a repeated key was signed', () => {
    // Old buggy behavior: Record<> overwrote with the LAST value, so
    // signing only the first would have passed. With the URLSearchParams
    // path concatenating both, that signature must now be rejected.
    const sp = new URLSearchParams();
    sp.append('Body', 'BED');
    sp.append('Body', 'TAMPERED');
    sp.append('From', '+15550000000');

    // Sign as if Body had only the first value (attacker's hope).
    let canonical = url;
    canonical += 'Body' + 'BED';
    canonical += 'From' + '+15550000000';
    const wrongSig = createHmac('sha1', token).update(canonical, 'utf-8').digest('base64');

    expect(verifyTwilioSignature(token, url, sp, wrongSig)).toBe(false);
  });
});

describe('twimlMessage', () => {
  it('XML-escapes the body', () => {
    const xml = twimlMessage('Bed at <St. Mary\'s> & "Boulware"');
    expect(xml).toContain('&lt;St. Mary');
    expect(xml).toContain('&apos;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;Boulware&quot;');
  });

  it('twimlEmpty is a valid empty Response', () => {
    expect(twimlEmpty()).toMatch(/<Response\s*\/>/);
  });

  // #269 fix — strip C0 control chars that XML 1.0 disallows.
  it('strips C0 control chars that would make Twilio drop the reply', () => {
    // Pick a sample of the disallowed range: NUL, BEL, VT, FF, ESC.
    const dirty = `Hello\x00world\x07\x0B\x0C\x1Bend`;
    const xml = twimlMessage(dirty);
    // None of the stripped chars survive in the output. (biome flags
    // control chars in regex; matching them is exactly the assertion.)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: matching control chars is the intent
    expect(xml).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F]/);
    // The visible text survives.
    expect(xml).toContain('Helloworldend');
  });

  it('preserves XML-legal control chars (TAB, LF, CR)', () => {
    const xml = twimlMessage('line1\nline2\tcol2\r\nline3');
    expect(xml).toContain('\n');
    expect(xml).toContain('\t');
    expect(xml).toContain('\r');
  });
});

describe('identifierForPhone', () => {
  const PHONE = '+15551234567';
  let originalFlag: string | undefined;

  beforeEach(() => {
    originalFlag = process.env.INDC_SMS_HASH_PHONES;
  });
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.INDC_SMS_HASH_PHONES;
    else process.env.INDC_SMS_HASH_PHONES = originalFlag;
  });

  it('returns the raw E.164 by default (flag unset)', () => {
    delete process.env.INDC_SMS_HASH_PHONES;
    expect(identifierForPhone(PHONE)).toBe(PHONE);
  });

  it('returns the raw E.164 when flag is "0"', () => {
    process.env.INDC_SMS_HASH_PHONES = '0';
    expect(identifierForPhone(PHONE)).toBe(PHONE);
  });

  it('returns SHA-256 hex digest when flag is "1"', () => {
    process.env.INDC_SMS_HASH_PHONES = '1';
    const expected = createHash('sha256').update(PHONE, 'utf-8').digest('hex');
    expect(identifierForPhone(PHONE)).toBe(expected);
    expect(identifierForPhone(PHONE)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash is deterministic — same phone in, same hash out', () => {
    process.env.INDC_SMS_HASH_PHONES = '1';
    expect(identifierForPhone(PHONE)).toBe(identifierForPhone(PHONE));
  });

  it('passes through empty string regardless of flag', () => {
    process.env.INDC_SMS_HASH_PHONES = '1';
    expect(identifierForPhone('')).toBe('');
  });
});
