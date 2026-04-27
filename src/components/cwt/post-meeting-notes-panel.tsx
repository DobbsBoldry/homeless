'use client';

import { useId, useState, useTransition } from 'react';
import {
  type StructurePostMeetingNotesResult,
  structurePostMeetingNotesAction,
} from '@/app/actions/post-meeting-notes';
import { Button } from '@/components/ui/button';

type SuccessOutput = Extract<StructurePostMeetingNotesResult, { ok: true }>['output'];

export function PostMeetingNotesPanel({ syntheticPersonRef }: { syntheticPersonRef: string }) {
  const notesId = useId();
  const [raw, setRaw] = useState('');
  const [output, setOutput] = useState<SuccessOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const onStructure = () => {
    setError(null);
    setCopied(false);
    if (raw.trim().length < 20) {
      setError('Type at least a few sentences before structuring.');
      return;
    }
    startTransition(async () => {
      const r = await structurePostMeetingNotesAction(syntheticPersonRef, raw);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOutput(r.output);
    });
  };

  const onCopy = async () => {
    if (!output) return;
    const lines = [
      `Summary: ${output.summary}`,
      '',
      output.next_steps.length > 0 ? 'Next steps:' : '',
      ...output.next_steps.map((s) => `- ${s}`),
      output.watch_fors.length > 0 ? '\nWatch for:' : '',
      ...output.watch_fors.map((s) => `- ${s}`),
      output.followup_question ? `\nNext meeting: ${output.followup_question}` : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select the text manually.');
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Just finished a meeting? Type or dictate raw notes below — Claude restructures them into a
        summary, next steps, watch-fors, and one open question for next time. You copy into your
        real case-management tool.
      </p>

      <div className="space-y-1">
        <label htmlFor={notesId} className="text-xs font-medium">
          Raw notes
        </label>
        <textarea
          id={notesId}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          placeholder="Met w/ client at 2pm. Said landlord shut off heat last week, has 3 kids u/12. Hasn't paid Apr rent. Going to call KCAA Tuesday. Want to follow up re KCHIP for kids — she thought they were already on it but Sarah from St Ben said no. Verify."
          maxLength={10_000}
          disabled={pending}
          className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs leading-relaxed"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onStructure} disabled={pending} size="sm">
          {pending ? 'Structuring…' : output ? 'Re-structure' : 'Structure notes'}
        </Button>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>

      {output ? (
        <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3">
          <Section label="Summary">
            <p className="text-sm leading-relaxed">{output.summary}</p>
          </Section>

          <Section label={`Next steps (${output.next_steps.length})`}>
            {output.next_steps.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nothing in the notes mentions a commitment.
              </p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {output.next_steps.map((s) => (
                  <li key={s} className="leading-relaxed">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {output.watch_fors.length > 0 ? (
            <Section label={`Watch for (${output.watch_fors.length})`}>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {output.watch_fors.map((s) => (
                  <li key={s} className="leading-relaxed">
                    {s}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {output.followup_question ? (
            <Section label="For next meeting">
              <p className="text-sm leading-relaxed">{output.followup_question}</p>
            </Section>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <Button type="button" size="sm" variant="outline" onClick={onCopy}>
              {copied ? 'Copied ✓' : 'Copy structured notes'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
