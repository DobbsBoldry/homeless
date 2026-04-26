import * as Sentry from '@sentry/nextjs';
import { sentryScrub } from './src/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sample 10% of transactions in prod, 100% in dev for visibility.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  sendDefaultPii: false,
  beforeSend: sentryScrub,
});
