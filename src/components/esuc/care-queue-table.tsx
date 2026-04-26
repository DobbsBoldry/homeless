import Link from 'next/link';
import type { HousingStatus } from '@/db/schema/enums';
import type { SuperUtilizerRow } from '@/lib/esuc/super-utilizer-ranking';

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(d));

const housingBadge: Record<HousingStatus, string> = {
  shelter: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  unsheltered: 'bg-destructive/15 text-destructive',
  doubled_up: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  housed: 'bg-secondary text-secondary-foreground',
  unknown: 'bg-muted text-muted-foreground',
};

export function CareQueueTable({ rows }: { rows: SuperUtilizerRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-right">
              #
            </th>
            <th scope="col" className="px-3 py-2">
              Patient
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Visits
            </th>
            <th scope="col" className="px-3 py-2 whitespace-nowrap">
              Latest visit
            </th>
            <th scope="col" className="px-3 py-2">
              Housing
            </th>
            <th scope="col" className="px-3 py-2">
              Last chief complaint
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.patientId} className="border-t border-border align-top">
              <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                {idx + 1}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                <Link href={`/app/care/patients/${row.patientId}`} className="hover:underline">
                  {row.patientId}
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                {row.visitCount}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{fmtDate(row.latestVisitAt)}</td>
              <td className="px-3 py-2">
                <span className={`rounded px-2 py-0.5 text-xs ${housingBadge[row.housingStatus]}`}>
                  {row.housingStatus}
                </span>
              </td>
              <td className="px-3 py-2 text-sm">{row.lastChiefComplaint}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
