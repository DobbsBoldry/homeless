import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sample 10% of transactions in prod, 100% in dev for visibility.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Strip query strings + bodies from request data — we may pass PHI through
  // server actions post-BAA and don't want it in error reports.
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      event.request.query_string = undefined;
      event.request.data = undefined;
      event.request.cookies = undefined;
      if (event.request.headers) {
        // Drop auth + cookie headers; Sentry already strips some, be explicit.
        for (const k of Object.keys(event.request.headers)) {
          if (/^(authorization|cookie|x-clerk|svix-)/i.test(k)) {
            delete event.request.headers[k];
          }
        }
      }
    }
    if (event.user) {
      event.user.email = undefined;
      event.user.username = undefined;
      event.user.ip_address = undefined;
    }
    return event;
  },
});
