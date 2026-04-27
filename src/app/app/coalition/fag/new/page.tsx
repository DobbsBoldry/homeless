import Link from 'next/link';
import { FagMemberForm } from '@/components/coalition/fag-member-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function NewFagMemberPage() {
  await requireRole(['admin']);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/coalition/fag" className="text-muted-foreground hover:underline">
          ← Back to FAG
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Add advisor</h1>
        <p className="text-sm text-muted-foreground">
          Real contact info goes here; it doesn't leave this admin surface. Default $100/hr per
          coalition policy — edit if a specific arrangement applies.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advisor details</CardTitle>
        </CardHeader>
        <CardContent>
          <FagMemberForm />
        </CardContent>
      </Card>
    </div>
  );
}
