import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listEncountersForPatient } from '@/db/queries/ed-encounters';
import { requireRole } from '@/lib/auth';

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['ed_coordinator', 'admin']);
  const { id: patientId } = await params;

  // Cheap shape check: synthetic ids are SYN-PAT-*, real (post-BAA) will be
  // a hashed value. Either way they should be ≥ 6 chars of safe characters.
  if (!/^[A-Za-z0-9_-]{6,}$/.test(patientId)) notFound();

  const encounters = await listEncountersForPatient(patientId);
  if (encounters.length === 0) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="text-xs">
        <Link href="/app/care/queue" className="text-muted-foreground hover:underline">
          ← Back to care queue
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Patient</h1>
        <p className="text-sm text-muted-foreground">
          Opaque identifier <span className="font-mono text-xs">{patientId}</span> —{' '}
          {encounters.length} ED encounter{encounters.length === 1 ? '' : 's'} on file.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Encounter history</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {encounters.map((e) => (
              <li key={e.id} className="rounded-md border border-border bg-card p-3">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{e.chiefComplaint}</p>
                  <span className="text-xs text-muted-foreground">{fmtDate(e.arrivedAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Disposition: <span className="font-mono">{e.disposition}</span> · Housing:{' '}
                  <span className="font-mono">{e.housingStatus}</span>
                  {e.chargeCents != null ? ` · Charge: $${(e.chargeCents / 100).toFixed(0)}` : ''}
                </p>
                {e.notes ? <p className="mt-1 text-sm">{e.notes}</p> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Care plan</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          AI-assisted care plan generation lands in ESUC-011.
        </CardContent>
      </Card>
    </div>
  );
}
