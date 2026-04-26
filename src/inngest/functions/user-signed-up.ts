import { inngest } from '../client';

/**
 * Reacts to user.signed_up events emitted by the Clerk webhook. Phase 0:
 * just logs the payload. Phase 1+ will: send a welcome email, drop a
 * Slack notification to the coalition admin channel, etc.
 */
export const userSignedUp = inngest.createFunction(
  {
    id: 'user-signed-up',
    retries: 3,
    triggers: [{ event: 'user.signed_up' }],
  },
  async ({ event }) => {
    console.log('[inngest] user.signed_up', event.data);
    return { ok: true, data: event.data };
  },
);
