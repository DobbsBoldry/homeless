import Link from 'next/link';
import { DocumentUploadForm } from '@/components/cwt/document-upload-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function NewClientDocumentPage() {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients/documents" className="text-muted-foreground hover:underline">
          ← Back to documents
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Add document</h1>
        <p className="text-sm text-muted-foreground">
          Paste the text of a document; the AI extracts structured fields the case-management UI can
          show at a glance.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Document details</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploadForm />
        </CardContent>
      </Card>
    </div>
  );
}
