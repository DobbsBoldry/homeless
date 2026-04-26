import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

/**
 * Server-side PostHog client (singleton). Use for capturing events from
 * server actions, route handlers, and webhooks.
 *
 * Returns null when NEXT_PUBLIC_POSTHOG_KEY isn't set so callers can no-op
 * cleanly in environments without analytics (CI, local-no-keys).
 */
export function posthogServer(): PostHog | null {
  if (_client) return _client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
  if (!key) return null;
  _client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  return _client;
}

/**
 * Fire-and-forget event capture from the server. Swallows errors so analytics
 * never breaks the user-facing action.
 */
export async function captureServerEvent(input: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const client = posthogServer();
  if (!client) return;
  try {
    client.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.properties,
    });
  } catch (err) {
    console.error('[posthog] server capture failed', { input, err });
  }
}
