import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listClientIntakes } from '@/db/queries/client-intakes';
import type { ClientIntakeStatus } from '@/db/schema/enums';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

const fmtDuration = (s: number | null) => {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

const STATUS_BADGE: Record<ClientIntakeStatus, string> = {
  recording: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  transcribed: 'bg-secondary text-secondary-foreground',
  extracting: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  extracted: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
  failed: 'bg-destructive/15 text-destructive',
};

export default async function ClientIntakesPage() {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);
  const intakes = await listClientIntakes(50);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Voice intakes</h1>
          <p className="text-sm text-muted-foreground">
            Record (or paste) an intake conversation; Claude extracts a structured profile the
            case-management UI can show at a glance. Audio never leaves the laptop — only the
            transcript is stored.
          </p>
        </div>
        <Link href="/app/clients/intakes/new">
          <Button>New intake</Button>
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All intakes</CardTitle>
        </CardHeader>
        <CardContent>
          {intakes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No intakes yet. Click <strong>New intake</strong> to record one.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {intakes.map((i) => (
                <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <Link
                    href={`/app/clients/intakes/${i.id}`}
                    className="font-medium hover:underline"
                  >
                    {i.label}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {fmtTime(i.createdAt)} · {fmtDuration(i.audioDurationSec)} duration
                    {i.syntheticPersonRef ? ` · ${i.syntheticPersonRef}` : ''}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[i.status]}`}>
                    {i.status}
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
