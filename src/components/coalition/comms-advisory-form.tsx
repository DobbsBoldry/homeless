'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { postCommsAdvisoryAction } from '@/app/actions/comms-advisories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BODY_TEMPLATE = `## Agreed statement
(Single sentence the coalition agrees to repeat. Keep it short and human.)

## Key facts
-

## What NOT to say
- Don't speculate on cause / blame.
- Don't share names of individuals involved.

## Press contacts only
Refer reporters to the spokesperson named above.
`;

export function CommsAdvisoryForm() {
  const router = useRouter();
  const titleId = useId();
  const bodyId = useId();
  const nameId = useId();
  const contactId = useId();
  const [title, setTitle] = useState('');
  const [bodyMd, setBodyMd] = useState(BODY_TEMPLATE);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await postCommsAdvisoryAction({
        title,
        bodyMd,
        spokespersonName: name,
        spokespersonContact: contact || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push('/app/coalition/comms');
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor={titleId}>Title (incident name / one-line summary)</Label>
        <Input
          id={titleId}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. "Fatal exposure death — Owensboro, 2026-04-26"'
          disabled={pending}
          required
          maxLength={120}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={nameId}>Designated spokesperson</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Bo Thompson, Coalition Lead"'
            disabled={pending}
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={contactId}>Spokesperson contact (optional)</Label>
          <Input
            id={contactId}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="phone or email"
            disabled={pending}
            maxLength={80}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={bodyId}>Statement + talking points (Markdown)</Label>
        <textarea
          id={bodyId}
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          rows={14}
          disabled={pending}
          required
          maxLength={4000}
          className="w-full rounded-md border border-input bg-background p-2 text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Posting this advisory ends any currently-active one. Every signed-in user will see a
          banner pointing to this page until you end it.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Posting…' : 'Post advisory'}
      </Button>
    </form>
  );
}
