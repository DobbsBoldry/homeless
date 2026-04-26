import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { twimlEmpty, twimlMessage, verifyTwilioSignature } from './twilio-signature';

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
});
