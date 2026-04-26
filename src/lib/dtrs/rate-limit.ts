/**
 * In-memory token-bucket rate limiter for the public consent surface.
 *
 * The Phase-1 deployment is a single Next.js process behind Vercel /
 * Railway, so an in-process Map is sufficient. When the surface
 * scales out (multiple workers, edge caching), this module gets
 * swapped for a Redis / Upstash backend. Until then the same shape
 * means the swap is a one-line change.
 *
 * The keying is intentional: a `synthetic_person_ref` IS the auth
 * boundary in Phase 1, so the bucket is per-ref. Once token auth is
 * required (this PR), we can also key on token to make brute-force
 * exponentially harder.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterMs: number };

/**
 * Allow up to `limit` operations per `windowMs` for a given `key`.
 * Returns the result and decrements the bucket atomically (single-
 * threaded JS — Node event loop guarantees the read-modify-write
 * doesn't tear).
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: Math.max(0, existing.resetAt - now) };
  }
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}

/** Test/dev hook — only for vitest. */
export function _resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
