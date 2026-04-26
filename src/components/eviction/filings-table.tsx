'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { EvictionFiling } from '@/db/schema/eviction-filings';

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(d));

const fmtMoney = (cents: number | null) => {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
};

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

export function FilingsTable({ filings }: { filings: EvictionFiling[] }) {
  const [showFullNames, setShowFullNames] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFullNames((v) => !v)}
          aria-pressed={showFullNames}
        >
          {showFullNames ? 'Hide full names' : 'Show full names'}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2">
                Case #
              </th>
              <th scope="col" className="px-3 py-2">
                Filed
              </th>
              <th scope="col" className="px-3 py-2">
                Plaintiff
              </th>
              <th scope="col" className="px-3 py-2">
                Defendant
              </th>
              <th scope="col" className="px-3 py-2">
                Cause
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Amount
              </th>
              <th scope="col" className="px-3 py-2">
                Status
              </th>
              <th scope="col" className="px-3 py-2">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {filings.map((f) => (
              <tr key={f.id} className="border-t border-border align-top">
                <td className="px-3 py-2 font-mono text-xs">{f.caseNumber}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(f.filedAt)}</td>
                <td className="px-3 py-2">{f.plaintiff}</td>
                <td className="px-3 py-2">
                  {showFullNames
                    ? `${f.defendantFirstName} ${f.defendantLastName}`
                    : initials(f.defendantFirstName, f.defendantLastName)}
                </td>
                <td className="px-3 py-2">{causeLabel[f.causeType]}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(f.amountClaimedCents)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${statusClass[f.status]}`}>
                    {f.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{f.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
