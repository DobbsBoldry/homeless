'use client';

import { useState, useTransition } from 'react';
import { simulateInboundSmsAction } from '@/app/actions/sms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SMS_MAX_LEN } from '@/lib/indc/sms-formatter';

const PRESETS = ['BED', 'BED FAMILY', 'BED PET', 'BED MEN', 'BED WOMEN SUD', 'HELP', 'STOP'];

type Sample = {
  request: string;
  reply: string;
  intent: string;
  at: Date;
};

export function SmsPlayground() {
  const [body, setBody] = useState('BED');
  const [history, setHistory] = useState<Sample[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (text: string) => {
    setError(null);
    startTransition(async () => {
      const r = await simulateInboundSmsAction(text);
      if (!r.ok) {
        setError('Simulation failed.');
        return;
      }
      setHistory((prev) =>
        [{ request: text, reply: r.reply, intent: r.intent, at: new Date() }, ...prev].slice(0, 10),
      );
    });
  };

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) submit(body);
        }}
        className="flex gap-2"
      >
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message a caller would send"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !body.trim()}>
          {pending ? 'Sending…' : 'Send'}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setBody(p);
              submit(p);
            }}
          >
            {p}
          </Button>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {history.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Send a message above to preview the reply. Up to 10 most-recent are kept here.
        </p>
      ) : (
        <ul className="space-y-2">
          {history.map((h) => (
            <li
              key={h.at.toISOString()}
              className="rounded-md border border-border bg-card p-3 text-sm"
            >
              <p className="font-mono text-xs text-muted-foreground">
                {h.intent} · {h.reply.length} / {SMS_MAX_LEN} chars
              </p>
              <p className="mt-1">
                <span className="text-muted-foreground">→ </span>
                <span className="font-mono text-xs">{h.request}</span>
              </p>
              <p className="mt-1">
                <span className="text-muted-foreground">← </span>
                <span>{h.reply}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
