import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { IntakeProfile } from '@/ai/prompts/intake-extraction';
import { IntakeExtractButton } from '@/components/cwt/intake-extract-button';
import { IntakeProfileDisplay } from '@/components/cwt/intake-profile-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClientIntakeById } from '@/db/queries/client-intakes';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

const fmtDuration = (s: number | null) => {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export default async function IntakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const intake = await getClientIntakeById(id);
  if (!intake) notFound();

  const profile = intake.extractedProfile as IntakeProfile | null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients/intakes" className="text-muted-foreground hover:underline">
          ← Back to intakes
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">{intake.label}</h1>
        <p className="text-sm text-muted-foreground">
          Recorded {fmtTime(intake.createdAt)} · {fmtDuration(intake.audioDurationSec)} duration ·
          status <strong>{intake.status}</strong>
          {intake.syntheticPersonRef ? <> · ref {intake.syntheticPersonRef}</> : null}
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-baseline justify-between gap-2">
          <CardTitle className="text-base">Extracted profile</CardTitle>
          {intake.status !== 'extracted' || profile === null ? (
            <IntakeExtractButton
              id={intake.id}
              label={intake.status === 'failed' ? 'Retry extraction' : 'Run extraction'}
            />
          ) : (
            <IntakeExtractButton id={intake.id} label="Re-run extraction" />
          )}
        </CardHeader>
        <CardContent>
          {intake.status === 'extracting' ? (
            <p className="text-sm text-muted-foreground">Extraction in progress…</p>
          ) : intake.status === 'failed' ? (
            <p className="text-sm text-destructive">
              Extraction failed. Click <strong>Retry extraction</strong> above; if it keeps failing,
              edit the transcript for clarity and try again.
            </p>
          ) : profile ? (
            <IntakeProfileDisplay profile={profile} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Not extracted yet. Click <strong>Run extraction</strong> above.
            </p>
          )}
          {intake.extractionModel ? (
            <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
              model: {intake.extractionModel}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {intake.status === 'extracted' && profile ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">Next step: benefits eligibility</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open the screener with household size, kids, and presenting issue prefilled from
                this intake. You'll still see — and can edit — every field before quoting numbers.
              </p>
            </div>
            <Link
              href={`/app/clients/screener?fromIntake=${intake.id}`}
              className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Run benefits screener →
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[40rem] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">
            {intake.transcriptMd}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">AI extraction reminder.</p>
          <p className="mt-1 text-muted-foreground">
            Verify every field with the client before using it for benefits applications, court
            filings, or triage decisions. The "Caseworker — read this first" panel surfaces the AI's
            own uncertainty; don't ignore it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
