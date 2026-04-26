import * as Sentry from '@sentry/nextjs';
import { sentryScrub } from './src/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  sendDefaultPii: false,
  beforeSend: sentryScrub,
});
