import { db } from '@/db/client';
import { healthCheck } from '@/db/schema/health-check';
import { inngest } from '../client';

/**
 * Scheduled smoke test: writes a row to health_check every morning so we
 * can confirm both Inngest and the DB pooler are reachable. If this stops
 * firing, the production health dashboard (FND-006) will alert.
 */
export const dailyHealthPing = inngest.createFunction(
  {
    id: 'daily-health-ping',
    retries: 2,
    triggers: [{ cron: '0 9 * * *' }], // 09:00 UTC daily
  },
  async ({ step }) => {
    const row = await step.run('write-health-row', async () => {
      const [created] = await db.insert(healthCheck).values({}).returning();
      return created;
    });
    return { ok: true, healthCheckId: row.id, at: row.createdAt };
  },
);
