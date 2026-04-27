import Link from 'next/link';
import { EdTriagePanel } from '@/components/esuc/ed-triage-panel';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function EdTriagePage() {
  await requireRole(['ed_coordinator', 'admin']);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/care/queue" className="text-muted-foreground hover:underline">
          ← Back to care queue
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">ED morning triage</h1>
        <p className="text-sm text-muted-foreground">
          Claude reads the super-utilizer queue and picks the 3-5 patients you should focus on
          first. Action-blocked goes first; stable patients with active plans drop out. Re-run any
          time the queue changes.
        </p>
      </header>

      <EdTriagePanel />

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">Triage aid, not a clinical decision.</p>
          <p className="mt-1 text-muted-foreground">
            Patient identifiers are opaque (SYN-PAT-... synthetic, hashed Epic ids post-BAA). Claude
            sees no PHI — just visit count, housing status, last chief complaint, plan status. Your
            judgment on next steps; the AI just orders the queue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
