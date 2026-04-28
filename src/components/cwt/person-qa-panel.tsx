'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { askPersonQuestionAction } from '@/app/actions/person-qa';
import { Button } from '@/components/ui/button';
import type { PersonQATurn } from '@/lib/cwt';

type LocalTurn = PersonQATurn & { id: string };

let turnCounter = 0;
const nextTurnId = () => {
  turnCounter += 1;
  return `t${turnCounter}`;
};

const SUGGESTIONS = [
  "What's the pattern across the partners they've touched?",
  'Anything I should worry about?',
  'What questions should I ask at our next meeting?',
];

export function PersonQAPanel({ syntheticPersonRef }: { syntheticPersonRef: string }) {
  const inputId = useId();
  const [history, setHistory] = useState<LocalTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const ask = (question: string) => {
    const q = question.trim();
    if (q.length === 0 || pending) return;
    setError(null);
    const userTurn: LocalTurn = { id: nextTurnId(), role: 'user', content: q };
    const next = [...history, userTurn];
    setHistory(next);
    setDraft('');
    const wireHistory: PersonQATurn[] = next.map((t) => ({ role: t.role, content: t.content }));
    startTransition(async () => {
      const r = await askPersonQuestionAction(syntheticPersonRef, wireHistory);
      if (!r.ok) {
        setError(r.error);
        setHistory(history);
        setDraft(q);
        return;
      }
      const assistantTurn: LocalTurn = {
        id: nextTurnId(),
        role: 'assistant',
        content: r.answer,
      };
      setHistory([...next, assistantTurn]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    ask(draft);
  };

  const onReset = () => {
    setHistory([]);
    setDraft('');
    setError(null);
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Multi-turn within this session. Claude sees only the structured profile — service events,
          consents, intake extractions, documents. Not clinical advice.
        </p>
        {history.length > 0 ? (
          <Button onClick={onReset} variant="ghost" size="sm" disabled={pending}>
            Clear
          </Button>
        ) : null}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button
              key={s}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal py-1 text-xs"
              disabled={pending}
              onClick={() => ask(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="max-h-[28rem] space-y-3 overflow-y-auto rounded-md border border-border bg-muted/20 p-3"
        >
          {history.map((t) => (
            <div
              key={t.id}
              className={
                t.role === 'user'
                  ? 'rounded-md bg-primary/10 p-2 text-sm'
                  : 'rounded-md bg-card p-2 text-sm'
              }
            >
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t.role === 'user' ? 'You' : 'Claude'}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{t.content}</p>
            </div>
          ))}
          {pending ? (
            <div className="rounded-md bg-card p-2 text-sm text-muted-foreground">
              <div className="mb-1 text-[10px] uppercase tracking-wide">Claude</div>
              <p className="italic">Thinking…</p>
            </div>
          ) : null}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Ask a question about this person
        </label>
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a follow-up…"
          disabled={pending}
          maxLength={1500}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" size="sm" disabled={pending || draft.trim().length === 0}>
          {pending ? 'Asking…' : 'Ask'}
        </Button>
      </form>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
