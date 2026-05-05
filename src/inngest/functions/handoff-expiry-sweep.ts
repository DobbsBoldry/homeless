/**
 * COOR-012 — daily handoff-expiry sweep.
 *
 * Pre-acceptance handoffs (status `pending_consent` or `pending_acceptance`)
 * whose `expires_at` has passed are flipped to `expired`. Terminal-state
 * rows are kept untouched for audit.
 *
 * Idempotent — replays only flip rows that are still in pre-acceptance.
 * Per-row failures are captured and don't tank the sweep.
 */
import * as Sentry from '@sentry/nextjs';
import { listExpiringPreAcceptanceHandoffs } from '@/db/queries/case-handoffs';
import { expireHandoff } from '@/lib/coor';
import { inngest } from '../client';

interface SweepSummary {
  scanned: number;
  expired: number;
}

/**
 * Cron: 45 6 * * * — daily at 6:45 UTC (after foster-aging-out 6:00 and
 * pre-release window sweep 6:30 to avoid contention).
 */
export const handoffExpirySweep = inngest.createFunction(
  {
    id: 'handoff-expiry-sweep',
    retries: 2,
    triggers: [{ cron: '45 6 * * *' }],
  },
  async ({ step }) => {
    const summary: SweepSummary = { scanned: 0, expired: 0 };
    const now = new Date();

    const candidates = await step.run('list-candidates', async () => {
      return listExpiringPreAcceptanceHandoffs(now);
    });

    summary.scanned = candidates.length;

    for (const handoff of candidates) {
      try {
        const result = await step.run(`expire:${handoff.id}`, async () => {
          return expireHandoff(handoff.id);
        });
        if (result) summary.expired += 1;
      } catch (err) {
        Sentry.captureException(err, {
          tags: { source: 'handoff-expiry-sweep', handoffId: handoff.id },
        });
      }
    }

    return summary;
  },
);
