'use client';

import { useState, useTransition } from 'react';
import { postSteeringMeetingAction } from '@/app/actions/steering-meetings';
import { Button } from '@/components/ui/button';

export function SteeringPostButton({ meetingId }: { meetingId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onPost = () => {
    setError(null);
    if (
      !confirm(
        'Post these minutes? Posting is one-way — revisions add a note rather than replacing.',
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await postSteeringMeetingAction(meetingId);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" disabled={pending} onClick={onPost}>
        {pending ? 'Posting…' : 'Post minutes'}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
