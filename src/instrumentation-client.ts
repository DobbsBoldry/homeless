// Client-side Sentry init. Loaded automatically by Next.js when present.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // No session replay yet — adds weight + privacy concerns. Re-evaluate post-BAA.
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.user) {
      event.user.email = undefined;
      event.user.username = undefined;
      event.user.ip_address = undefined;
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
