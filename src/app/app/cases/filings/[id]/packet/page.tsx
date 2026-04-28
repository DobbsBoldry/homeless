import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PacketReviewPanel } from '@/components/eviction/packet-review-panel';
import { getFilingById } from '@/db/queries/eviction-filings';
import { requireKlaAttorney } from '@/lib/auth';
import { getResponsePacket } from '@/lib/eviction';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PacketPage({ params }: { params: Promise<{ id: string }> }) {
  await requireKlaAttorney();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const filing = await getFilingById(id);
  if (!filing) notFound();

  const packet = await getResponsePacket(filing.id);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="text-xs">
        <Link href={`/app/cases/filings/${id}`} className="text-muted-foreground hover:underline">
          ← Back to case detail
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Response packet</h1>
        <p className="text-sm text-muted-foreground">
          Case <span className="font-mono">{filing.caseNumber}</span> · {filing.plaintiff} v.{' '}
          {filing.defendantFirstName} {filing.defendantLastName}
        </p>
      </header>
      <PacketReviewPanel filing={filing} packet={packet} />
    </div>
  );
}
