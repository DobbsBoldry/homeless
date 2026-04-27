import Link from 'next/link';
import type { IntakeProfile } from '@/ai/prompts/intake-extraction';
import { Card, CardContent } from '@/components/ui/card';
import type { ClientIntake } from '@/db/schema/client-intakes';

const statusLabel: Record<ClientIntake['status'], string> = {
  recording: 'recording in progress',
  transcribed: 'transcribed (waiting on extraction)',
  extracting: 'extraction in progress',
  extracted: 'extracted',
  failed: 'extraction failed',
};

const fmtDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

export function LinkedIntakePanel({ intake }: { intake: ClientIntake }) {
  const profile = intake.extractedProfile as IntakeProfile | null;
  const presenting = profile?.presenting_issue ?? null;
  const urgency = profile?.urgency ?? null;

  return (
    <Card className="border-emerald-500/40 bg-emerald-500/5">
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium">Referred to caseworker queue ✓</p>
          <span className="text-xs text-muted-foreground">{fmtDateTime(intake.createdAt)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Intake status: <strong>{statusLabel[intake.status]}</strong>
          {intake.syntheticPersonRef ? (
            <>
              {' '}
              · Person ref:{' '}
              <Link
                href={`/app/clients/person/${intake.syntheticPersonRef}`}
                className="font-mono text-primary hover:underline"
              >
                {intake.syntheticPersonRef}
              </Link>
            </>
          ) : null}
        </p>
        {presenting ? (
          <p className="text-sm">
            <strong>Presenting:</strong> {presenting}
            {urgency ? (
              <span className="ml-2 text-xs text-muted-foreground">({urgency})</span>
            ) : null}
          </p>
        ) : null}
        <Link
          href={`/app/clients/intakes/${intake.id}`}
          className="inline-block text-xs text-primary hover:underline"
        >
          Open intake →
        </Link>
      </CardContent>
    </Card>
  );
}
