'use client';

import { useState, useTransition } from 'react';
import { markFagEntryPaidAction } from '@/app/actions/fag';
import { Button } from '@/components/ui/button';

export function FagMarkPaidButton({ entryId }: { entryId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await markFagEntryPaidAction(entryId);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onClick}>
        {pending ? 'Marking…' : 'Mark paid'}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
