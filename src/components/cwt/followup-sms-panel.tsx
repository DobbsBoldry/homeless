'use client';

import { useId, useState, useTransition } from 'react';
import { generateFollowupSmsAction } from '@/app/actions/followup-sms';
import { Button } from '@/components/ui/button';

const PRESET_PURPOSES = [
  { label: 'Appointment reminder', value: 'Remind them about their upcoming appointment.' },
  { label: 'Check-in', value: "Just checking in — no specific ask, see how they're doing." },
  {
    label: 'Doc reminder',
    value: 'Remind them to bring the documents we discussed at the last meeting.',
  },
];

const SMS_SOFT_LIMIT = 320;

export function FollowupSmsPanel({ syntheticPersonRef }: { syntheticPersonRef: string }) {
  const purposeId = useId();
  const draftId = useId();
  const [purpose, setPurpose] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const onGenerate = (purposeOverride?: string) => {
    const effective = (purposeOverride ?? purpose).trim();
    if (effective.length === 0) {
      setError('Tell Claude what the message is about.');
      return;
    }
    if (purposeOverride !== undefined) setPurpose(effective);
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const r = await generateFollowupSmsAction(syntheticPersonRef, effective);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDraft(r.text);
    });
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select the text manually.');
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Type what the message should be about. Claude drafts a 1-2 sentence SMS using the same
        coalition activity the briefing sees. You edit it, paste into your real SMS tool, send.
      </p>

      <div className="flex flex-wrap gap-2">
        {PRESET_PURPOSES.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onGenerate(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="space-y-1">
        <label htmlFor={purposeId} className="text-xs font-medium">
          Or describe the purpose in your own words
        </label>
        <input
          id={purposeId}
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder='e.g. "Remind about Friday 2pm, bring SNAP recert papers"'
          maxLength={500}
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => onGenerate()} disabled={pending} size="sm">
          {pending ? 'Drafting…' : draft ? 'Re-draft' : 'Draft SMS'}
        </Button>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>

      {draft ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
          <label htmlFor={draftId} className="text-xs font-medium">
            Draft (edit before sending)
          </label>
          <textarea
            id={draftId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background p-2 text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Button type="button" size="sm" variant="outline" onClick={onCopy}>
              {copied ? 'Copied ✓' : 'Copy to clipboard'}
            </Button>
            <span>
              {draft.length} chars{' '}
              {draft.length > SMS_SOFT_LIMIT ? (
                <span className="text-amber-600 dark:text-amber-400">
                  · over {SMS_SOFT_LIMIT}-char soft limit
                </span>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
