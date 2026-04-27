/**
 * In-memory token-bucket rate limiter for the public consent surface
 * and inbound SMS pipeline.
 *
 * ## Deployment matrix (#270)
 *
 * | Target                   | Behavior                                  |
 * |--------------------------|-------------------------------------------|
 * | Local dev (single proc)  | ✓ works                                   |
 * | Railway staging          | ✓ works, bucket lost on every redeploy    |
 * | Vercel serverless        | ✗ BROKEN — per-invocation memory          |
 * | Vercel + edge functions  | ✗ BROKEN                                  |
 * | Multi-worker / horiz.    | ✗ BROKEN — buckets are per-process        |
 *
 * Phase 1 lives on Railway, where the bucket-loss-on-redeploy is
 * acceptable: deploys are infrequent and the bucket is per-subject,
 * so the worst case is "an attacker gets one extra batch of tries
 * around the moment of deploy." Documented and accepted.
 *
 * **Do not promote this surface to Vercel without swapping the
 * backend first.** The serverless-function model gives each
 * invocation a fresh module-scope, so this Map is effectively empty
 * on every request and the limiter degrades to no-op.
 *
 * ## Future Redis swap
 *
 * The public API (`rateLimit(key, limit, windowMs) → RateLimitResult`)
 * is the contract; the Map is the implementation. A Redis/Upstash
 * backend implements the same signature using Lua scripts or
 * atomic INCR + TTL, no callsite changes:
 *
 *   - `RATE_LIMIT_BACKEND=memory` (default) — current code
 *   - `RATE_LIMIT_BACKEND=upstash`           — future: Lua-script bucket
 *
 * The swap-trigger is whichever lands first: Vercel promotion,
 * multi-worker scale-out, or edge caching in front of a consent
 * surface. None of those are in flight today.
 *
 * ## Keying convention
 *
 * The keying is intentional: a `synthetic_person_ref` IS the auth
 * boundary in Phase 1, so the bucket is per-ref. Once token auth is
 * required, we also key on token to make brute-force exponentially
 * harder.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Loud warning at module load if we're running in an environment where
// the in-memory backend is silently broken. Better a deploy-time noise
// than a quietly-disabled rate limit.
if (process.env.VERCEL === '1' && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[rate-limit] WARNING: in-memory token bucket is non-functional on ' +
      'Vercel serverless (per-invocation memory). Rate limiting is effectively ' +
      'disabled until the Redis/Upstash backend swap (#270 plan). Do not rely ' +
      'on rateLimit() for security on this deployment.',
  );
}

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterMs: number };

/**
 * Allow up to `limit` operations per `windowMs` for a given `key`.
 * Returns the result and decrements the bucket atomically (single-
 * threaded JS — Node event loop guarantees the read-modify-write
 * doesn't tear).
 *
 * **Backend (#270):** in-memory Map. Keep the signature stable; the
 * Redis swap when it lands replaces the body, not the contract.
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
