import * as Sentry from '@sentry/nextjs';
import { listRankedDocket } from '@/db/queries/eviction-filings';
import { listKlaAttorneys } from '@/db/queries/users';
import type { User } from '@/db/schema/users';
import { DEFAULT_FROM, resendClient } from '@/lib/email/client';
import { type DigestPayload, digestHtml, digestMarkdown, digestSubject } from '@/lib/email/digest';
import { inngest } from '../client';

const TOP_N = 10;

const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://homeless-production.up.railway.app';

interface SendOutcome {
  to: string;
  ok: boolean;
  error?: string;
}

async function sendDigestTo(recipient: string, payload: DigestPayload): Promise<SendOutcome> {
  try {
    const result = await resendClient().emails.send({
      from: DEFAULT_FROM,
      to: recipient,
      subject: digestSubject(payload.date, payload.rows.length),
      html: digestHtml(payload),
      text: digestMarkdown(payload),
    });
    if (result.error) {
      Sentry.captureMessage('[digest] resend returned error', {
        level: 'warning',
        tags: { recipient },
        extra: { resendError: result.error },
      });
      return { to: recipient, ok: false, error: result.error.message };
    }
    return { to: recipient, ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { recipient, source: 'daily-attorney-digest' } });
    return { to: recipient, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Daily 6am Central (12:00 UTC) cron, weekdays only — sends each KLA
 * attorney the top-10 ranked eviction filings as an email digest.
 *
 * EVDT_DIGEST_TEST_EMAIL overrides the recipient list with a single address
 * for development before real attorneys are seeded — the cron still runs the
 * query, just sends to one place.
 */
export const dailyAttorneyDigest = inngest.createFunction(
  {
    id: 'daily-attorney-digest',
    retries: 0,
    triggers: [{ cron: '0 12 * * 1-5' }],
  },
  async ({ step }) => {
    const recipients = await step.run('resolve-recipients', async (): Promise<string[]> => {
      const override = process.env.EVDT_DIGEST_TEST_EMAIL?.trim();
      if (override) return [override];
      const attorneys: User[] = await listKlaAttorneys();
      return attorneys.map((a) => a.email).filter((e) => e.length > 0);
    });

    if (recipients.length === 0) {
      return {
        skipped: true,
        reason: 'no recipients (no KLA attorneys seeded and no EVDT_DIGEST_TEST_EMAIL override)',
      };
    }

    // Single step that does fetch + render + send so Date doesn't have to
    // round-trip across an Inngest step boundary (Inngest JSON-serializes
    // each step's return). Send failures are captured per-recipient and
    // summarized in the return — not re-thrown — so one bad address
    // doesn't fail the whole cron.
    const result = await step.run('compose-and-send', async () => {
      const date = new Date();
      const rows = await listRankedDocket({ limit: TOP_N });
      const payload: DigestPayload = { date, rows, appUrl: appUrl() };
      const outcomes = await Promise.all(recipients.map((to) => sendDigestTo(to, payload)));
      const sent = outcomes.filter((o) => o.ok).length;
      return { sent, failed: outcomes.length - sent, rows: rows.length, outcomes };
    });

    Sentry.addBreadcrumb({
      category: 'digest',
      level: result.failed > 0 ? 'warning' : 'info',
      message: `attorney digest: sent=${result.sent} failed=${result.failed} rows=${result.rows}`,
    });

    return result;
  },
);
