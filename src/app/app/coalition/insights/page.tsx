import Link from 'next/link';
import { CoalitionInsightsPanel } from '@/components/coalition/coalition-insights-panel';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function CoalitionInsightsPage() {
  await requireRole(['admin', 'attorney']);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/coalition" className="text-muted-foreground hover:underline">
          ← Back to coalition
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Coalition insights</h1>
        <p className="text-sm text-muted-foreground">
          A weekly read for the coordinator and steering committee. Volume signal, the most
          coalition-relevant pattern, and 1-2 questions worth raising at the next meeting.
        </p>
      </header>

      <CoalitionInsightsPanel />

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">This is a coordinator's view, not a per-person view.</p>
          <p className="mt-1 text-muted-foreground">
            Synthetic person refs are intentionally left out of the brief — for per-person detail,
            jump to the unified person view from the cross-org coordination page. The numbers here
            are fence-clean: counts, top patterns, no identities.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
