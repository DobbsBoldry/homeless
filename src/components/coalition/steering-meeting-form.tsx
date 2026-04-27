'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { saveSteeringMeetingAction } from '@/app/actions/steering-meetings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AGENDA_TEMPLATE = `## Roll call

## Updates from each pillar
- Eviction defense (KLA Owensboro)
- ED super-utilizer care (OH)
- Shelter coordination (Boulware / St. Benedict's / Pitino)
- SMS bed-finder (volume + friction signals)

## Decisions
(captured in Decisions section below)

## Action items
(captured in Action items section below)
`;

type Attendee = { name: string; affiliation?: string };

export function SteeringMeetingForm({
  initial,
}: {
  initial?: {
    id: string;
    title: string;
    heldOn: string;
    attendees: Attendee[];
    agendaMd: string;
    decisionsMd: string;
    actionItemsMd: string;
  };
}) {
  const router = useRouter();
  const titleId = useId();
  const dateId = useId();
  const attendeesId = useId();
  const agendaId = useId();
  const decisionsId = useId();
  const actionsId = useId();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [heldOn, setHeldOn] = useState(initial?.heldOn ?? new Date().toISOString().slice(0, 10));
  const [attendeesText, setAttendeesText] = useState(
    initial
      ? initial.attendees
          .map((a) => (a.affiliation ? `${a.name} (${a.affiliation})` : a.name))
          .join('\n')
      : '',
  );
  const [agendaMd, setAgendaMd] = useState(initial?.agendaMd ?? AGENDA_TEMPLATE);
  const [decisionsMd, setDecisionsMd] = useState(initial?.decisionsMd ?? '');
  const [actionItemsMd, setActionItemsMd] = useState(initial?.actionItemsMd ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const attendees = attendeesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map<Attendee>((line) => {
        const m = line.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        return m ? { name: m[1].trim(), affiliation: m[2].trim() } : { name: line };
      });

    startTransition(async () => {
      const r = await saveSteeringMeetingAction({
        id: initial?.id,
        title,
        heldOn,
        attendees,
        agendaMd,
        decisionsMd,
        actionItemsMd,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/app/coalition/steering/${r.id}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={titleId}>Title</Label>
          <Input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="2026 Q2 Steering Committee"
            disabled={pending}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={dateId}>Date held</Label>
          <Input
            id={dateId}
            type="date"
            value={heldOn}
            onChange={(e) => setHeldOn(e.target.value)}
            disabled={pending}
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={attendeesId}>Attendees (one per line; "Name (Affiliation)")</Label>
        <textarea
          id={attendeesId}
          value={attendeesText}
          onChange={(e) => setAttendeesText(e.target.value)}
          rows={4}
          disabled={pending}
          placeholder={'Bo Thompson (Coalition lead)\nJane Doe (KLA Owensboro)'}
          className="w-full rounded-md border border-input bg-background p-2 text-sm font-mono"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={agendaId}>Agenda (Markdown)</Label>
        <textarea
          id={agendaId}
          value={agendaMd}
          onChange={(e) => setAgendaMd(e.target.value)}
          rows={10}
          disabled={pending}
          className="w-full rounded-md border border-input bg-background p-2 text-sm font-mono"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={decisionsId}>Decisions (Markdown)</Label>
        <textarea
          id={decisionsId}
          value={decisionsMd}
          onChange={(e) => setDecisionsMd(e.target.value)}
          rows={6}
          disabled={pending}
          placeholder={'- Approved $X for Y (vote: 5-0)'}
          className="w-full rounded-md border border-input bg-background p-2 text-sm font-mono"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={actionsId}>Action items (Markdown)</Label>
        <textarea
          id={actionsId}
          value={actionItemsMd}
          onChange={(e) => setActionItemsMd(e.target.value)}
          rows={6}
          disabled={pending}
          placeholder={'- [ ] Bo: schedule advisor session by 2026-05-10'}
          className="w-full rounded-md border border-input bg-background p-2 text-sm font-mono"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : initial ? 'Save changes' : 'Save meeting'}
        </Button>
      </div>
    </form>
  );
}
