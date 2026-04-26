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
 *
 * In serverless environments the runtime may freeze before the queue flushes;
 * await `flushServerEvents()` from the same request handler if you need
 * delivery guarantees (e.g. before responding to a webhook).
 */
export function captureServerEvent(input: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): void {
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

/**
 * Force-flush queued server events. Call before returning from a serverless
 * handler to ensure delivery (the queue is dropped when the function freezes).
 */
export async function flushServerEvents(): Promise<void> {
  const client = posthogServer();
  if (!client) return;
  try {
    await client.flush();
  } catch (err) {
    console.error('[posthog] flush failed', err);
  }
}
