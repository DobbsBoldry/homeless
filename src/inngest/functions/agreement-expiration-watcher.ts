/**
 * OPRT-002 — daily expiration watcher for partner_agreements (any kind).
 *
 * Two passes per run:
 *
 *   1. `expireOverdueAgreements` flips status='active' → 'expired' for
 *      any agreement whose end_date has passed. Audit-logged per row
 *      inside one transaction. Idempotent (already-expired rows skipped).
 *
 *   2. `listExpiringAgreements({ daysAhead: 60 })` — surface agreements
 *      due to expire within 60 days for ops visibility. Today this fires
 *      a Sentry warning per row; full notification piping (admin email,
 *      Slack, etc.) is a follow-up.
 *
 * Cron: 0 7 * * * (07:00 UTC daily, 02:00 Central — runs after the
 * foster-aging-out scan).
 */
import * as Sentry from '@sentry/nextjs';
import { expireOverdueAgreements, listExpiringAgreements } from '@/db/queries/partner-agreements';
import { inngest } from '../client';

interface WatcherSummary {
  expiredFlipped: number;
  expiringSoon: number;
}

export const agreementExpirationWatcher = inngest.createFunction(
  {
    id: 'agreement-expiration-watcher',
    retries: 2,
    triggers: [{ cron: '0 7 * * *' }],
  },
  async ({ step }) => {
    const summary: WatcherSummary = { expiredFlipped: 0, expiringSoon: 0 };
    const asOf = new Date();

    const flipped = await step.run('expire-overdue', async () => {
      return expireOverdueAgreements({ actorUserId: null, asOf });
    });
    summary.expiredFlipped = flipped.length;

    if (flipped.length > 0) {
      Sentry.captureMessage('[agreement-expiration-watcher] flipped overdue agreements', {
        level: 'info',
        tags: { source: 'agreement-expiration-watcher' },
        extra: {
          count: flipped.length,
          ids: flipped.map((r) => r.id),
        },
      });
    }

    const expiring = await step.run('list-expiring-soon', async () => {
      return listExpiringAgreements({ daysAhead: 60, asOf });
    });
    // Filter out the ones we just flipped (their end_date is past, so
    // they're in this list too — but we already handled them).
    const expiringNotYet = expiring.filter((a) => a.status === 'active');
    summary.expiringSoon = expiringNotYet.length;

    for (const a of expiringNotYet) {
      Sentry.captureMessage('[agreement-expiration-watcher] agreement expiring soon', {
        level: 'warning',
        tags: {
          source: 'agreement-expiration-watcher',
          kind: a.kind,
          partnerOrgId: a.partnerOrgId,
        },
        extra: {
          agreementId: a.id,
          endDate: a.endDate,
        },
      });
    }

    return summary;
  },
);
