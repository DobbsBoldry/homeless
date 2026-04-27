import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listClientDocuments } from '@/db/queries/client-documents';
import type { ClientDocumentStatus } from '@/db/schema/enums';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

const STATUS_BADGE: Record<ClientDocumentStatus, string> = {
  uploaded: 'bg-muted text-muted-foreground',
  extracting: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  extracted: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
  failed: 'bg-destructive/15 text-destructive',
};

const KIND_LABEL: Record<string, string> = {
  photo_id: 'Photo ID',
  ssn_card: 'SSN card',
  birth_certificate: 'Birth certificate',
  dd_214: 'DD-214',
  lease: 'Lease',
  paystub: 'Paystub',
  court_record: 'Court record',
  other: 'Other',
};

export default async function ClientDocumentsPage() {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);
  const docs = await listClientDocuments(50);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Client documents</h1>
          <p className="text-sm text-muted-foreground">
            Pasted document text + AI-extracted structured fields. Phase-1 scope is text-only; real
            PDF / photo upload waits for the post-BAA storage migration.
          </p>
        </div>
        <Link href="/app/clients/documents/new">
          <Button>Add document</Button>
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All documents</CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents yet. Click <strong>Add document</strong> to start.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <Link
                    href={`/app/clients/documents/${d.id}`}
                    className="font-medium hover:underline"
                  >
                    {d.label}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {KIND_LABEL[d.kind] ?? d.kind} · {fmtTime(d.createdAt)}
                    {d.syntheticPersonRef ? ` · ${d.syntheticPersonRef}` : ''}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[d.status]}`}>
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
