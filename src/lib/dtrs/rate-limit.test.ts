import { afterEach, describe, expect, it } from 'vitest';
import { _resetRateLimitBucketsForTests, rateLimit } from './rate-limit';

afterEach(() => {
  _resetRateLimitBucketsForTests();
});

describe('rateLimit', () => {
  it('allows up to `limit` operations within the window', () => {
    expect(rateLimit('a', 3, 60_000)).toEqual({ ok: true, remaining: 2 });
    expect(rateLimit('a', 3, 60_000)).toEqual({ ok: true, remaining: 1 });
    expect(rateLimit('a', 3, 60_000)).toEqual({ ok: true, remaining: 0 });
  });

  it('rejects beyond the limit and reports retryAfter', () => {
    rateLimit('b', 1, 60_000);
    const r = rateLimit('b', 1, 60_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it('keys are independent', () => {
    rateLimit('c', 1, 60_000);
    expect(rateLimit('d', 1, 60_000).ok).toBe(true);
  });
});
