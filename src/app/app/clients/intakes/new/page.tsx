import Link from 'next/link';
import { IntakeRecorder } from '@/components/cwt/intake-recorder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function NewIntakePage() {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients/intakes" className="text-muted-foreground hover:underline">
          ← Back to intakes
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">New intake</h1>
        <p className="text-sm text-muted-foreground">
          Press <strong>Start recording</strong>, have the conversation, press <strong>Stop</strong>
          , edit the transcript if needed, and click <strong>Save & extract</strong>. Claude pulls
          the structured profile in a few seconds.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record + transcribe</CardTitle>
        </CardHeader>
        <CardContent>
          <IntakeRecorder />
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs text-muted-foreground">
          <strong>Privacy.</strong> Audio is captured by the browser and transcribed locally via the
          Web Speech API — no upload to a server, no recording stored. Only the transcript (which
          the caseworker can edit before saving) is persisted, alongside the AI-extracted profile.
        </CardContent>
      </Card>
    </div>
  );
}
