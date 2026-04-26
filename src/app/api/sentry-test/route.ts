/**
 * One-shot route to verify Sentry is reporting server errors.
 * Hit GET /api/_sentry-test — should throw, return 500, and the error
 * should appear in the Sentry dashboard within ~1 minute.
 *
 * Safe to leave deployed; the path is underscored to discourage discovery
 * and the payload is benign.
 */
export const dynamic = 'force-dynamic';

export function GET(): never {
  throw new Error('[sentry-test] intentional error to verify reporting');
}
