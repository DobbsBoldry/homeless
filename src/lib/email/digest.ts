import type { RankedDocketRow } from '@/lib/eviction/docket-ranking';
import { riskBandLabel } from '@/lib/eviction/risk-band';

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(d));

const fmtMoney = (cents: number | null) =>
  cents == null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(cents / 100);

const initials = (first: string, last: string) =>
  `${first.charAt(0).toUpperCase()}.${last.charAt(0).toUpperCase()}.`;

const causeLabel: Record<string, string> = {
  non_payment: 'Non-payment',
  lease_violation: 'Lease violation',
  holdover: 'Holdover',
  other: 'Other',
};

export interface DigestPayload {
  date: Date;
  rows: RankedDocketRow[];
  appUrl: string;
}

export function digestSubject(date: Date, count: number): string {
  return `[Daviess Daily] ${count} high-risk eviction case${count === 1 ? '' : 's'} for ${fmtDate(date)}`;
}

/**
 * Markdown body for the email. Resend renders markdown if you pass it in the
 * `text` field as plain text — but since we want HTML and a plaintext alt,
 * we render both ourselves: the HTML is a basic styled table, the text is
 * the markdown source.
 */
export function digestMarkdown(payload: DigestPayload): string {
  const { date, rows, appUrl } = payload;
  if (rows.length === 0) {
    return [
      `# Daviess Daily — ${fmtDate(date)}`,
      '',
      'No new high-risk eviction filings to review today.',
      '',
      `Open the queue: ${appUrl}/app/cases/queue`,
    ].join('\n');
  }

  const header = '| # | Score | Band | Case # | Defendant | Plaintiff | Cause | Amount | Filed |';
  const sep = '|---:|---:|---|---|---|---|---|---:|---|';
  const lines = rows.map((row, idx) => {
    const f = row.filing;
    return [
      `| ${idx + 1}`,
      ` | ${row.score ?? '—'}`,
      ` | ${row.score == null ? '—' : riskBandLabel(row.score)}`,
      ` | [${f.caseNumber}](${appUrl}/app/cases/filings/${f.id})`,
      ` | ${initials(f.defendantFirstName, f.defendantLastName)}`,
      ` | ${f.plaintiff}`,
      ` | ${causeLabel[f.causeType] ?? f.causeType}`,
      ` | ${fmtMoney(f.amountClaimedCents)}`,
      ` | ${fmtDate(f.filedAt)} |`,
    ].join('');
  });

  return [
    `# Daviess Daily — ${fmtDate(date)}`,
    '',
    `Top ${rows.length} eviction cases by risk score. Defendant initials only — open a case for the full record.`,
    '',
    header,
    sep,
    ...lines,
    '',
    `Open the full ranked queue: ${appUrl}/app/cases/queue`,
  ].join('\n');
}

/**
 * Lightweight HTML rendering (no template engine) — table mirrors the
 * markdown so the email reads the same in HTML or text-only clients.
 */
export function digestHtml(payload: DigestPayload): string {
  const { date, rows, appUrl } = payload;
  const queueLink = `${appUrl}/app/cases/queue`;

  if (rows.length === 0) {
    return wrap(
      `<h1>Daviess Daily — ${fmtDate(date)}</h1>
       <p>No new high-risk eviction filings to review today.</p>
       <p><a href="${queueLink}">Open the queue</a></p>`,
    );
  }

  const trs = rows
    .map((row, idx) => {
      const f = row.filing;
      const score = row.score == null ? '—' : String(row.score);
      const band = row.score == null ? '—' : riskBandLabel(row.score);
      const url = `${appUrl}/app/cases/filings/${f.id}`;
      return `<tr>
        <td style="text-align:right;padding:6px 10px;">${idx + 1}</td>
        <td style="text-align:right;padding:6px 10px;font-weight:600;">${score}</td>
        <td style="padding:6px 10px;">${band}</td>
        <td style="padding:6px 10px;font-family:ui-monospace,monospace;font-size:13px;"><a href="${url}">${escapeHtml(f.caseNumber)}</a></td>
        <td style="padding:6px 10px;">${initials(f.defendantFirstName, f.defendantLastName)}</td>
        <td style="padding:6px 10px;">${escapeHtml(f.plaintiff)}</td>
        <td style="padding:6px 10px;">${escapeHtml(causeLabel[f.causeType] ?? f.causeType)}</td>
        <td style="text-align:right;padding:6px 10px;font-family:ui-monospace,monospace;">${fmtMoney(f.amountClaimedCents)}</td>
        <td style="padding:6px 10px;white-space:nowrap;">${fmtDate(f.filedAt)}</td>
      </tr>`;
    })
    .join('');

  return wrap(
    `<h1>Daviess Daily — ${fmtDate(date)}</h1>
     <p>Top ${rows.length} eviction cases by risk score. Defendant initials only — open a case for the full record.</p>
     <table style="border-collapse:collapse;width:100%;font-size:14px;">
       <thead>
         <tr style="text-align:left;background:#f5f5f5;">
           <th style="padding:6px 10px;text-align:right;">#</th>
           <th style="padding:6px 10px;text-align:right;">Score</th>
           <th style="padding:6px 10px;">Band</th>
           <th style="padding:6px 10px;">Case #</th>
           <th style="padding:6px 10px;">Defendant</th>
           <th style="padding:6px 10px;">Plaintiff</th>
           <th style="padding:6px 10px;">Cause</th>
           <th style="padding:6px 10px;text-align:right;">Amount</th>
           <th style="padding:6px 10px;">Filed</th>
         </tr>
       </thead>
       <tbody>${trs}</tbody>
     </table>
     <p style="margin-top:18px;"><a href="${queueLink}">Open the full ranked queue</a></p>`,
  );
}

function wrap(inner: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:900px;margin:0 auto;padding:18px;">${inner}</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
