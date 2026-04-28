/**
 * SUBP-004 — weekly stale-safety-plan scan.
 *
 * Surfaces active DV survivors whose safety plan is on file but has not
 * been reviewed in the configured staleness window (default 90 days).
 * Per ADR 0007 § 6.1, OASIS and the coalition coordinate at a regular
 * cadence; a stale plan is a process gap that the assigned advocate
 * needs to close.
 *
 * Today this fires a Sentry warning per stale survivor; full advocate
 * notification piping (email / dashboard) is a follow-up. The metadata
 * is id-only — never names, never addresses, never the plan content.
 *
 * Cron: 0 13 * * 1 (Monday 13:00 UTC, 08:00 Central — start-of-week
 * triage cadence).
 */
import * as Sentry from '@sentry/nextjs';
import { listStaleSafetyPlans } from '@/lib/subp';
import { inngest } from '../client';

interface ScanSummary {
  staleCount: number;
}

export const dvSafetyPlanStaleScan = inngest.createFunction(
  {
    id: 'dv-safety-plan-stale-scan',
    retries: 2,
    triggers: [{ cron: '0 13 * * 1' }],
  },
  async ({ step }) => {
    const summary: ScanSummary = { staleCount: 0 };
    const asOf = new Date();

    const stale = await step.run('list-stale-plans', async () => {
      return listStaleSafetyPlans({ staleAfterDays: 90, asOf });
    });
    summary.staleCount = stale.length;

    for (const s of stale) {
      Sentry.captureMessage('[dv-safety-plan-stale-scan] survivor safety plan stale', {
        level: 'warning',
        tags: {
          source: 'dv-safety-plan-stale-scan',
          assigned: s.assignedAdvocateUserId ? 'yes' : 'unassigned',
        },
        extra: {
          // ID-only metadata. No names, no addresses, no plan content.
          // ADR 0007 § Decision rule 5.
          survivorId: s.id,
          oasisPartnerOrgId: s.oasisPartnerOrgId,
          assignedAdvocateUserId: s.assignedAdvocateUserId,
        },
      });
    }

    return summary;
  },
);
