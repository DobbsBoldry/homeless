'use client';

import { useId, useState, useTransition } from 'react';
import { grantConsentAction } from '@/app/actions/consent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConsentType } from '@/db/schema/enums';
import { type ConsentCopy, DATA_CLASSES } from '@/lib/dtrs/consent-text';

/**
 * Plain-language consent form (DTRS-002). Reading-level target: grade 6.
 * Every label is in `consent-text.ts` so the wording can be reviewed in
 * lived-experience advisor sessions (DTRS-005) without code changes.
 */
export function ConsentForm({
  subjectExternalId,
  consentType,
  copy,
  accessToken,
}: {
  subjectExternalId: string;
  consentType: ConsentType;
  copy: ConsentCopy;
  /** Forwarded to the server action — the action is the auth boundary. */
  accessToken?: string | null;
}) {
  const sigId = useId();
  const [signature, setSignature] = useState('');
  const [checked, setChecked] = useState<Set<string>>(() => new Set(DATA_CLASSES.map((d) => d.id)));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (signature.trim().length === 0) {
      setError('Please type your name on the line below.');
      return;
    }
    if (checked.size === 0) {
      setError('Pick at least one kind of info to share.');
      return;
    }
    startTransition(async () => {
      const r = await grantConsentAction({
        subjectExternalId,
        consentType,
        grantedVia: 'web_form',
        signatureText: signature,
        scopeDataClasses: Array.from(checked),
        accessToken: accessToken ?? null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">Saved.</p>
        <p className="mt-1">
          Thank you, {signature.trim()}. You can change these settings any time at this same link,
          or by replying STOP to any text we send you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <header>
        <h2 className="font-serif text-2xl font-semibold">{copy.title}</h2>
        <p className="mt-2 text-base">{copy.intro}</p>
      </header>

      <div className="rounded-md border border-border bg-muted/20 p-4 text-sm">
        <ul className="list-disc space-y-1 pl-5">
          {copy.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What can we share?</legend>
        <p className="text-xs text-muted-foreground">
          Uncheck anything you do not want shared. You can change this later.
        </p>
        <div className="space-y-1">
          {DATA_CLASSES.map((d) => {
            const id = `data-class-${d.id}`;
            return (
              <label
                key={d.id}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted/40"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked.has(d.id)}
                  onChange={() => toggle(d.id)}
                  disabled={pending}
                  className="h-4 w-4"
                />
                <span>{d.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor={sigId}>Your name (this counts as your signature)</Label>
        <Input
          id={sigId}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="e.g. Sarah J"
          maxLength={80}
          disabled={pending}
        />
      </div>

      <p className="text-xs text-muted-foreground">{copy.footer}</p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'I agree'}
        </Button>
      </div>
    </form>
  );
}
