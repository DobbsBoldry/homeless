/**
 * SUBP-001 — nightly milestone scan for foster aging-out.
 *
 * Runs daily, computes days-until-18 for every active foster youth,
 * and fires alerts at the configured milestones. Idempotent at the
 * (youth, milestone) UNIQUE level — replays are safe.
 *
 * Side effect: when a youth crosses the `aged_out` milestone, their
 * `status` is flipped from 'active' to 'aged_out'. The alert row itself
 * is the durable record; the status flip just keeps the active list
 * focused on pre-18 youth.
 */
import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { recordAlertsForYouth } from '@/db/queries/foster-youth';
import { fosterYouth } from '@/db/schema/foster-youth';
import { computeDaysUntilEighteen, milestonesReachedBy } from '@/lib/subp';
import { inngest } from '../client';

interface ScanSummary {
  scannedYouth: number;
  alertsInserted: number;
  agedOutFlipped: number;
}

/**
 * Cron: 0 6 * * * — daily at 6am UTC (1am Central).
 */
export const fosterAgingOutScan = inngest.createFunction(
  {
    id: 'foster-aging-out-scan',
    retries: 2,
    triggers: [{ cron: '0 6 * * *' }],
  },
  async ({ step }) => {
    const summary: ScanSummary = {
      scannedYouth: 0,
      alertsInserted: 0,
      agedOutFlipped: 0,
    };

    const asOf = new Date();

    const youthRows = await step.run('list-active-youth', async () => {
      return db.select().from(fosterYouth).where(eq(fosterYouth.status, 'active'));
    });

    summary.scannedYouth = youthRows.length;

    for (const youth of youthRows) {
      try {
        const days = computeDaysUntilEighteen(youth.dateOfBirth, asOf);
        const milestones = milestonesReachedBy(days);
        if (milestones.length === 0) continue;

        const inserted = await step.run(`fire-alerts:${youth.id}`, async () => {
          return recordAlertsForYouth(youth.id, milestones);
        });
        summary.alertsInserted += inserted.length;

        // If aged_out fired, flip status — keeps the active list focused.
        if (milestones.includes('aged_out') && youth.status === 'active') {
          await step.run(`flip-aged-out:${youth.id}`, async () => {
            await db
              .update(fosterYouth)
              .set({ status: 'aged_out', updatedAt: new Date() })
              .where(eq(fosterYouth.id, youth.id));
          });
          summary.agedOutFlipped += 1;
        }
      } catch (err) {
        // Per-youth failure shouldn't tank the whole scan. Capture and
        // continue; the next run picks up missed alerts.
        Sentry.captureException(err, {
          tags: { source: 'foster-aging-out-scan', youthId: youth.id },
        });
      }
    }

    return summary;
  },
);
