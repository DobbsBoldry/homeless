import Link from 'next/link';
import { CommsAdvisoryForm } from '@/components/coalition/comms-advisory-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function NewCommsAdvisoryPage() {
  await requireRole(['admin', 'attorney', 'caseworker', 'ed_coordinator', 'shelter_staff']);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/coalition/comms" className="text-muted-foreground hover:underline">
          ← Back to communications
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">New advisory</h1>
        <p className="text-sm text-muted-foreground">
          Post a comms advisory now. The body field is pre-filled with the standard template (agreed
          statement, key facts, what NOT to say, press contact rule). Edit freely.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advisory details</CardTitle>
        </CardHeader>
        <CardContent>
          <CommsAdvisoryForm />
        </CardContent>
      </Card>
    </div>
  );
}
