import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RentalAssistanceProgram } from '@/db/schema/rental-assistance-programs';

const fmtMoney = (cents: number | null) =>
  cents == null
    ? null
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(cents / 100);

export function RentalAssistancePanel({ programs }: { programs: RentalAssistanceProgram[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rental-assistance programs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <strong>Eligibility caveat:</strong> these summaries are illustrative. Eligibility depends
          on household specifics (income, composition, documentation) that aren't in the filing.
          Verify with the agency before referring.
        </p>
        {programs.length === 0 ? (
          <p className="text-muted-foreground">No active programs in the catalog.</p>
        ) : (
          <ul className="space-y-2">
            {programs.map((p) => {
              const max = fmtMoney(p.maxAwardCents);
              return (
                <li key={p.id} className="rounded-md border border-border bg-card p-3">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.agency}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {p.phone ? (
                        <a className="font-mono hover:underline" href={`tel:${p.phone}`}>
                          {p.phone}
                        </a>
                      ) : null}
                      {p.website ? (
                        <a
                          className="hover:underline"
                          href={p.website}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          website ↗
                        </a>
                      ) : null}
                      {max ? (
                        <span className="font-mono text-muted-foreground">up to {max}</span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm">{p.eligibilitySummary}</p>
                  {p.sourceNote ? (
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {p.sourceNote}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
