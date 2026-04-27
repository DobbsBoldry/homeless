import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { PrintButton } from '@/components/coordination/print-button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getCoalitionAggregate,
  getGovernanceCountsForQuarter,
  listQuarterlyEvictionAggregates,
  type Quarter,
} from '@/db/queries/public-outcomes';
import { renderFiscalCourtBrief } from '@/lib/dtrs/fiscal-court-brief';

export const dynamic = 'force-dynamic';

function parseQuarter(yearRaw: string, quarterRaw: string): Quarter | null {
  const year = Number.parseInt(yearRaw, 10);
  const quarterNum = Number.parseInt(quarterRaw.replace(/^q/i, ''), 10);
  if (!Number.isInteger(year) || year < 2024 || year > 2100) return null;
  if (![1, 2, 3, 4].includes(quarterNum)) return null;
  return { year, quarter: quarterNum as 1 | 2 | 3 | 4, label: `${year} Q${quarterNum}` };
}

export const metadata = {
  title: 'Fiscal Court brief — Daviess Coalition',
};

export default async function FiscalCourtBriefPage({
  params,
}: {
  params: Promise<{ year: string; quarter: string }>;
}) {
  const { year, quarter: q } = await params;
  const quarter = parseQuarter(year, q);
  if (!quarter) notFound();

  const [eviction, coalitionSnapshot, governanceForQuarter] = await Promise.all([
    listQuarterlyEvictionAggregates([quarter]),
    getCoalitionAggregate(90),
    getGovernanceCountsForQuarter(quarter),
  ]);

  const markdown = renderFiscalCourtBrief({
    quarter,
    evictionForQuarter: eviction[0],
    coalitionSnapshot,
    governanceForQuarter,
    generatedAt: new Date(),
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6 md:p-8 print:max-w-none print:p-0">
      <div className="text-xs print:hidden">
        <Link href="/outcomes" className="text-muted-foreground hover:underline">
          ← Back to outcomes
        </Link>
      </div>

      <article className="prose prose-sm max-w-none dark:prose-invert print:prose-xs">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </article>

      <section className="space-y-3 rounded-md border border-border bg-muted/20 p-4 text-xs print:hidden">
        <h2 className="font-serif text-base font-semibold">Share this brief</h2>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton />
          <Link
            href={`/outcomes/fiscal-court/${quarter.year}/${quarter.quarter}/markdown`}
            className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted"
          >
            View as Markdown
          </Link>
          <Link
            href={`/outcomes/fiscal-court/${quarter.year}/${quarter.quarter}/markdown?download=1`}
            className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted"
          >
            Download .md
          </Link>
        </div>
        <p className="text-muted-foreground">
          The Markdown form fits in a county-meeting handout or a coalition newsletter. Print
          renders to a single sheet of letter paper at default browser settings.
        </p>
      </section>

      <Card className="border-amber-500/40 bg-amber-500/5 print:hidden">
        <CardContent className="text-xs text-muted-foreground">
          Built per PCYI-001. Pairs with the public transparency report (DTRS-013, at{' '}
          <code className="font-mono">/outcomes/q/[year]/[quarter]</code>) — same data, different
          framing for a different audience.
        </CardContent>
      </Card>
    </main>
  );
}
