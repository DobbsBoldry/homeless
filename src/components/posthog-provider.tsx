'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { Suspense, useEffect } from 'react';

function PageviewTracker() {
  const pathname = usePathname();
  // Subscribe to searchParams so client-side nav between query-string variants
  // re-fires the effect (e.g. /app/cases?tab=open -> /app/cases?tab=closed).
  // We deliberately do NOT include them in the captured event — query strings
  // can carry tokens / PHI / arbitrary data that doesn't belong in analytics.
  const params = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    posthog.capture('$pageview', { $current_url: pathname, $has_query: params.size > 0 });
  }, [pathname, params]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
    if (!key) return;
    // Guard against double-init from React strict mode + dev hot reload.
    if ((posthog as unknown as { __loaded?: boolean }).__loaded) return;
    posthog.init(key, {
      api_host: host,
      capture_pageview: false, // we capture manually via PageviewTracker (path-only)
      capture_pageleave: true,
      // Privacy-first defaults — no IP collection, no autocapture (turn back on
      // selectively when we know what we want to measure).
      ip: false,
      autocapture: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
