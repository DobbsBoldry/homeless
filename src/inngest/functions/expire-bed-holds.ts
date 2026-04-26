import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { bedHolds } from '@/db/schema/shelters';
import { inngest } from '../client';

/**
 * Auto-expires soft bed holds whose `expires_at` has passed (COOR-005
 * AC: "Expires, releases automatically"). Runs every minute so a hold
 * never lingers visibly past its 90-minute window.
 *
 * The board already filters by `expires_at > now()` when computing
 * effective free beds, so the cron is a tidiness step — it normalizes
 * the row to status='expired' so the audit trail reflects what
 * actually happened, and so an admin browsing the table doesn't see
 * lingering 'active' rows that are functionally dead.
 */
export const expireBedHolds = inngest.createFunction(
  {
    id: 'expire-bed-holds',
    retries: 1,
    triggers: [{ cron: '* * * * *' }], // every minute
  },
  async ({ step }) => {
    const result = await step.run('flip-expired', async () => {
      const now = new Date();
      const expired = await db
        .update(bedHolds)
        .set({ status: 'expired', updatedAt: now })
        .where(and(eq(bedHolds.status, 'active'), lt(bedHolds.expiresAt, now)))
        .returning({ id: bedHolds.id });
      return { count: expired.length };
    });
    return { ok: true, expired: result.count };
  },
);
