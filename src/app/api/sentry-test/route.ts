import { notFound } from 'next/navigation';

/**
 * Verification route for Sentry server-error reporting.
 * Hit GET /api/sentry-test — throws, returns 500, error appears in the
 * Sentry dashboard within ~1 minute.
 *
 * Disabled in production by returning 404, so prod traffic can't DoS the
 * Sentry quota by hitting this. To verify in prod, deploy with
 * SENTRY_TEST_ENABLED=true set transiently.
 */
export const dynamic = 'force-dynamic';

export function GET(): never {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_TEST_ENABLED !== 'true') {
    notFound();
  }
  throw new Error('[sentry-test] intentional error to verify reporting');
}
