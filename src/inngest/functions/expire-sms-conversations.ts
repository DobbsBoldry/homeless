import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { smsConversations } from '@/db/schema/sms-conversations';
import { inngest } from '../client';

/**
 * Sweeps awaiting_location conversations whose TTL has passed back to
 * idle. Pipeline lazy-expires on read too, so this is a tidiness step
 * — it keeps the table clean for analytics and prevents a stale
 * pending_filter from being replayed if a user comes back days later.
 */
export const expireSmsConversations = inngest.createFunction(
  {
    id: 'expire-sms-conversations',
    retries: 1,
    triggers: [{ cron: '*/5 * * * *' }], // every 5 minutes
  },
  async ({ step }) => {
    const result = await step.run('reset-stale', async () => {
      const now = new Date();
      const reset = await db
        .update(smsConversations)
        .set({ state: 'idle', pendingFilter: null, updatedAt: now })
        .where(
          and(eq(smsConversations.state, 'awaiting_location'), lt(smsConversations.expiresAt, now)),
        )
        .returning({ id: smsConversations.id });
      return { count: reset.length };
    });
    return { ok: true, reset: result.count };
  },
);
