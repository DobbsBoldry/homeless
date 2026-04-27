import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DocumentExtractButton } from '@/components/cwt/document-extract-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClientDocumentById } from '@/db/queries/client-documents';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

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

export default async function ClientDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const doc = await getClientDocumentById(id);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients/documents" className="text-muted-foreground hover:underline">
          ← Back to documents
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">{doc.label}</h1>
        <p className="text-sm text-muted-foreground">
          {KIND_LABEL[doc.kind] ?? doc.kind} · uploaded {fmtTime(doc.createdAt)} · status{' '}
          <strong>{doc.status}</strong>
          {doc.syntheticPersonRef ? <> · ref {doc.syntheticPersonRef}</> : null}
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-baseline justify-between gap-2">
          <CardTitle className="text-base">Extracted fields</CardTitle>
          {doc.status !== 'extracted' ? (
            <DocumentExtractButton
              id={doc.id}
              label={doc.status === 'failed' ? 'Retry extraction' : 'Run extraction'}
            />
          ) : (
            <DocumentExtractButton id={doc.id} label="Re-run extraction" />
          )}
        </CardHeader>
        <CardContent>
          {doc.status === 'extracting' ? (
            <p className="text-sm text-muted-foreground">Extraction in progress…</p>
          ) : doc.status === 'failed' ? (
            <p className="text-sm text-destructive">
              Extraction failed. Click <strong>Retry extraction</strong> above. If it keeps failing,
              check the document body for OCR garbage.
            </p>
          ) : doc.extractedFields ? (
            <>
              <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
                {JSON.stringify(doc.extractedFields, null, 2)}
              </pre>
              {doc.extractionNotes ? (
                <p className="mt-2 text-xs italic text-muted-foreground">
                  AI notes: "{doc.extractionNotes}"
                </p>
              ) : null}
              {doc.extractionModel ? (
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  model: {doc.extractionModel}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not extracted yet. Click <strong>Run extraction</strong> above.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Document body</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">
            {doc.contentMd}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">AI extraction reminder.</p>
          <p className="mt-1 text-muted-foreground">
            Verify every field before using it for benefits applications or court filings. The AI
            confidently invents plausible values for unreadable text; null and a note in
            <code className="font-mono"> notes</code> is the correct behavior, but it doesn't always
            hit it. Human review is the source of truth.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
