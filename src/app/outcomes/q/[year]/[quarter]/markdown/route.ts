import { notFound } from 'next/navigation';
import {
  getCoalitionAggregate,
  getGovernanceCountsForQuarter,
  listQuarterlyEvictionAggregates,
  type Quarter,
} from '@/db/queries/public-outcomes';
import { renderTransparencyReport } from '@/lib/dtrs';

export const dynamic = 'force-dynamic';

function parseQuarter(yearRaw: string, quarterRaw: string): Quarter | null {
  const year = Number.parseInt(yearRaw, 10);
  const quarterNum = Number.parseInt(quarterRaw.replace(/^q/i, ''), 10);
  if (!Number.isInteger(year) || year < 2024 || year > 2100) return null;
  if (![1, 2, 3, 4].includes(quarterNum)) return null;
  return { year, quarter: quarterNum as 1 | 2 | 3 | 4, label: `${year} Q${quarterNum}` };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string; quarter: string }> },
) {
  const { year, quarter: q } = await params;
  const quarter = parseQuarter(year, q);
  if (!quarter) notFound();

  const url = new URL(req.url);
  const isDownload = url.searchParams.get('download') === '1';

  const [eviction, coalitionSnapshot, governanceForQuarter] = await Promise.all([
    listQuarterlyEvictionAggregates([quarter]),
    getCoalitionAggregate(90),
    getGovernanceCountsForQuarter(quarter),
  ]);

  const markdown = renderTransparencyReport({
    quarter,
    evictionForQuarter: eviction[0],
    coalitionSnapshot,
    governanceForQuarter,
    generatedAt: new Date(),
  });

  const filename = `daviess-coalition-${quarter.year}-Q${quarter.quarter}.md`;
  const headers = new Headers({
    'content-type': 'text/markdown; charset=utf-8',
  });
  if (isDownload) {
    headers.set('content-disposition', `attachment; filename="${filename}"`);
  }
  return new Response(markdown, { status: 200, headers });
}
