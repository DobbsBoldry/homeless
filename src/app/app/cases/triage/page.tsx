import Link from 'next/link';
import { AttorneyTriagePanel } from '@/components/eviction/attorney-triage-panel';
import { Card, CardContent } from '@/components/ui/card';
import { requireKlaAttorney } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AttorneyTriagePage() {
  await requireKlaAttorney();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/cases/filings" className="text-muted-foreground hover:underline">
          ← Back to docket
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Morning triage</h1>
        <p className="text-sm text-muted-foreground">
          Claude reads every open case from the last 30 days and tells you the 3-5 to focus on
          first. Time pressure beats risk score; action-blocking gaps go first; already-handled
          cases drop out. Re-run any time the docket changes.
        </p>
      </header>

      <AttorneyTriagePanel />

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">This is a planning aid, not a decision.</p>
          <p className="mt-1 text-muted-foreground">
            The AI ranks based on the structured facts the platform has — risk score, packet state,
            outcome state. It doesn't see attorney notes, client phone calls, or anything you
            haven't recorded. Trust your read of the docket over the AI's.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
