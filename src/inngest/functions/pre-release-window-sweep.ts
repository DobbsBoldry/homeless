/**
 * SUBP-005 — daily pre-release window-expiration sweep.
 *
 * Per ADR 0009 § 5.1: subjects whose projected release date is more than
 * 7 days in the past AND who have not been handed off are deleted from
 * Coalition systems. This is the contract-level enforcement of bounded
 * data flow — the agreement promises KY DOC that the Coalition will
 * not retain pre-release records past the operational window.
 *
 * Subjects with a non-null `handed_off_at` are kept under the agreement's
 * data destruction policy (managed via the OPRT-002 expiration watcher
 * + an admin-driven termination flow) and are exempt from this sweep.
 *
 * Idempotent — replays delete only what's still past the tail. Per-subject
 * failures are captured and don't tank the whole sweep.
 */
import * as Sentry from '@sentry/nextjs';
import {
  deletePreReleaseSubjectForExpiry,
  listSubjectsPastReleaseWithoutHandoff,
} from '@/db/queries/pre-release-subjects';
import {
  computeDaysUntilRelease,
  POST_RELEASE_TAIL_DAYS_DEFAULT,
  shouldDeleteForWindowExpiry,
} from '@/lib/subp';
import { inngest } from '../client';

interface SweepSummary {
  scanned: number;
  deleted: number;
}

/**
 * Cron: 30 6 * * * — daily at 6:30am UTC (1:30am Central, after the
 * foster aging-out scan at 6:00 to avoid contention).
 */
export const preReleaseWindowSweep = inngest.createFunction(
  {
    id: 'pre-release-window-sweep',
    retries: 2,
    triggers: [{ cron: '30 6 * * *' }],
  },
  async ({ step }) => {
    const summary: SweepSummary = { scanned: 0, deleted: 0 };
    const asOf = new Date();
    // Cutoff for the DB pre-filter: any subject with projected release
    // before today + 1d is potentially in scope (fast filter; the
    // engine's per-subject decision is the source of truth).
    const cutoff = new Date(asOf);
    cutoff.setUTCDate(cutoff.getUTCDate() + 1);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const candidates = await step.run('list-candidates', async () => {
      return listSubjectsPastReleaseWithoutHandoff(cutoffDate);
    });

    summary.scanned = candidates.length;

    for (const subject of candidates) {
      try {
        const days = computeDaysUntilRelease(subject.projectedReleaseDate, asOf);
        if (
          !shouldDeleteForWindowExpiry(days, subject.handedOffAt, POST_RELEASE_TAIL_DAYS_DEFAULT)
        ) {
          continue;
        }
        await step.run(`delete:${subject.id}`, async () => {
          await deletePreReleaseSubjectForExpiry(subject.id, null);
        });
        summary.deleted += 1;
      } catch (err) {
        // Per-subject failure shouldn't tank the whole sweep. Capture and
        // continue; the next run picks up missed deletions.
        Sentry.captureException(err, {
          tags: { source: 'pre-release-window-sweep', subjectId: subject.id },
        });
      }
    }

    return summary;
  },
);
