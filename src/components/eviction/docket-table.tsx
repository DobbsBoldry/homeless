import Link from 'next/link';
import type { EvictionFiling } from '@/db/schema/eviction-filings';
import type { RankedDocketRow } from '@/lib/eviction';
import { riskBandClass } from '@/lib/eviction';

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(d));

const initials = (first: string, last: string) =>
  `${first.charAt(0).toUpperCase()}.${last.charAt(0).toUpperCase()}.`;

const causeLabel: Record<EvictionFiling['causeType'], string> = {
  non_payment: 'Non-payment',
  lease_violation: 'Lease violation',
  holdover: 'Holdover',
  other: 'Other',
};

const statusClass: Record<EvictionFiling['status'], string> = {
  filed: 'bg-secondary text-secondary-foreground',
  served: 'bg-accent text-accent-foreground',
  judgment: 'bg-destructive/15 text-destructive',
  dismissed: 'bg-muted text-muted-foreground',
  sealed: 'bg-muted text-muted-foreground italic',
};

export function DocketTable({ rows }: { rows: RankedDocketRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-right">
              #
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Score
            </th>
            <th scope="col" className="px-3 py-2">
              Case #
            </th>
            <th scope="col" className="px-3 py-2">
              Defendant
            </th>
            <th scope="col" className="px-3 py-2">
              Plaintiff
            </th>
            <th scope="col" className="px-3 py-2">
              Cause
            </th>
            <th scope="col" className="px-3 py-2">
              Status
            </th>
            <th scope="col" className="px-3 py-2 whitespace-nowrap">
              Filed
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const f = row.filing;
            return (
              <tr key={f.id} className="border-t border-border align-top">
                <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                  {idx + 1}
                </td>
                <td className="px-3 py-2 text-right">
                  {row.score == null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={`font-mono font-semibold tabular-nums ${riskBandClass(row.score)}`}
                    >
                      {row.score}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/app/cases/filings/${f.id}`} className="hover:underline">
                    {f.caseNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">{initials(f.defendantFirstName, f.defendantLastName)}</td>
                <td className="px-3 py-2">{f.plaintiff}</td>
                <td className="px-3 py-2">{causeLabel[f.causeType]}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${statusClass[f.status]}`}>
                    {f.status}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(f.filedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
