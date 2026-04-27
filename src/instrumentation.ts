// Next.js instrumentation entrypoint. Loaded once per server runtime.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.E2E_MOCK_OUTBOUND === '1') {
      const { installE2EInterceptor } = await import('@/lib/e2e/intercept');
      installE2EInterceptor();
    }
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
