import Link from 'next/link';
import { MorningTriagePanel } from '@/components/cwt/morning-triage-panel';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function CaseworkerMorningTriagePage() {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients" className="text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Morning triage</h1>
        <p className="text-sm text-muted-foreground">
          Claude reads recent extracted intakes and people who touched ≥2 partners in the last two
          weeks, picks the 3-5 you should focus on first. DV-flagged goes first; urgent intakes
          before 30-day-urgent; cross-partner patterns where the platform earns its keep.
        </p>
      </header>

      <MorningTriagePanel />

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">Triage aid, not a decision.</p>
          <p className="mt-1 text-muted-foreground">
            The AI ranks based on what's recorded — extracted intake fields, partner event counts.
            It doesn't see your conversations, your gut feel, or anything you haven't recorded.
            Trust your read of the queue over the AI's.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
