'use client';

import { useId, useState, useTransition } from 'react';
import { draftCaseNoteAction, saveCaseNoteEditAction } from '@/app/actions/client-case-notes';
import { Button } from '@/components/ui/button';
import type { ClientCaseNote } from '@/db/schema/client-case-notes';

const fmtDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

/**
 * Build a per-thread version chain from a flat list of notes (newest
 * first). Each chain is rooted at a note with no parent, ordered
 * oldest→newest by createdAt. The render order is roots-by-newest-leaf
 * so the most-recently-edited thread floats to the top.
 */
function chainNotes(notes: ClientCaseNote[]): ClientCaseNote[][] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string, ClientCaseNote[]>();
  for (const n of notes) {
    if (n.parentNoteId) {
      const arr = childrenByParent.get(n.parentNoteId) ?? [];
      arr.push(n);
      childrenByParent.set(n.parentNoteId, arr);
    }
  }
  const roots = notes.filter((n) => !n.parentNoteId || !byId.has(n.parentNoteId));
  const chains: ClientCaseNote[][] = [];
  for (const root of roots) {
    const chain: ClientCaseNote[] = [root];
    let cur = root;
    while (true) {
      const kids = childrenByParent.get(cur.id);
      if (!kids || kids.length === 0) break;
      // Within a chain we expect a single child per node (linear edits).
      // If branching ever happens, take the most recent — branches are
      // recoverable via raw query but the UI doesn't render them.
      kids.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      const next = kids[0];
      chain.push(next);
      cur = next;
    }
    chains.push(chain);
  }
  // Newest-leaf first
  chains.sort(
    (a, b) => +new Date(b[b.length - 1].createdAt) - +new Date(a[a.length - 1].createdAt),
  );
  return chains;
}

export function CaseNotesPanel({
  syntheticPersonRef,
  initialNotes,
}: {
  syntheticPersonRef: string;
  initialNotes: ClientCaseNote[];
}) {
  const [notes, setNotes] = useState<ClientCaseNote[]>(initialNotes);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const editId = useId();

  const onDraft = () => {
    setError(null);
    startTransition(async () => {
      const r = await draftCaseNoteAction(syntheticPersonRef);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setNotes((prev) => [r.note, ...prev]);
      setEditingId(r.note.id);
      setEditDraft(r.note.bodyMd);
    });
  };

  const startEdit = (note: ClientCaseNote) => {
    setEditingId(note.id);
    setEditDraft(note.bodyMd);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
    setError(null);
  };

  const saveEdit = (parentId: string) => {
    setError(null);
    startTransition(async () => {
      const r = await saveCaseNoteEditAction(parentId, editDraft);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setNotes((prev) => [r.note, ...prev]);
      setEditingId(null);
      setEditDraft('');
    });
  };

  const chains = chainNotes(notes);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Draft a case note from the structured profile (latest extracted intake + recent service
        events). Edits land as new versions — the AI vs. human authorship trail is auditable.
      </p>

      <div className="flex items-center gap-3">
        <Button onClick={onDraft} disabled={pending} size="sm">
          {pending && editingId === null ? 'Drafting…' : 'Draft case note'}
        </Button>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>

      {chains.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No case notes for this person yet.</p>
      ) : (
        <div className="space-y-4">
          {chains.map((chain) => {
            const latest = chain[chain.length - 1];
            const isEditing = editingId === latest.id;
            return (
              <div key={chain[0].id} className="rounded-md border border-border bg-card p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      v{chain.length}
                    </span>
                    {latest.draftedByAi ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                        AI-drafted
                      </span>
                    ) : (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        edited
                      </span>
                    )}
                    <span className="text-muted-foreground">{fmtDateTime(latest.createdAt)}</span>
                  </div>
                  {!isEditing ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => startEdit(latest)}
                    >
                      Edit
                    </Button>
                  ) : null}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <label htmlFor={editId} className="sr-only">
                      Edit case note
                    </label>
                    <textarea
                      id={editId}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={14}
                      maxLength={20_000}
                      className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs leading-relaxed"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => saveEdit(latest.id)}
                      >
                        {pending ? 'Saving…' : `Save edit (creates v${chain.length + 1})`}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {editDraft.length} chars
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{latest.bodyMd}</p>
                )}

                {chain.length > 1 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                      Version history ({chain.length} versions)
                    </summary>
                    <ol className="mt-2 space-y-2 pl-4 text-xs">
                      {chain.map((v, i) => (
                        <li key={v.id} className="border-l border-border pl-3">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            v{i + 1} · {v.draftedByAi ? 'AI-drafted' : 'edited'} ·{' '}
                            {fmtDateTime(v.createdAt)}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{v.bodyMd}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
