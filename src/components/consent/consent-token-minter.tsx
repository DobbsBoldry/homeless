'use client';

import { useId, useState, useTransition } from 'react';
import { mintConsentTokenAction } from '@/app/actions/consent-tokens';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fmtClock = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

export function ConsentTokenMinter() {
  const refId = useId();
  const noteId = useId();
  const [ref, setRef] = useState('SYN-PERSON-001');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; expiresAt: Date } | null>(null);
  const [pending, startTransition] = useTransition();

  const onMint = () => {
    setError(null);
    startTransition(async () => {
      const r = await mintConsentTokenAction(ref.trim(), note || undefined);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult({ url: r.url, expiresAt: r.expiresAt });
    });
  };

  const fullUrl = result
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${result.url}`
    : null;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={refId}>Synthetic person ref</Label>
        <Input
          id={refId}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="SYN-PERSON-001"
          disabled={pending}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={noteId}>Note (optional)</Label>
        <Input
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='e.g. "shared at intake on 2026-04-26"'
          maxLength={120}
          disabled={pending}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" disabled={pending || ref.trim().length === 0} onClick={onMint}>
        {pending ? 'Minting…' : 'Mint 24h link'}
      </Button>

      {result && fullUrl ? (
        <div className="space-y-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">Link minted</p>
          <p className="break-all font-mono text-xs">{fullUrl}</p>
          <p className="text-xs text-muted-foreground">Expires {fmtClock(result.expiresAt)}.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigator.clipboard?.writeText(fullUrl)}
          >
            Copy
          </Button>
        </div>
      ) : null}
    </div>
  );
}
