'use client';

import { useState, useTransition } from 'react';
import { endCommsAdvisoryAction } from '@/app/actions/comms-advisories';
import { Button } from '@/components/ui/button';

export function CommsAdvisoryEndButton({ advisoryId }: { advisoryId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    if (!confirm('End this advisory? The banner will disappear coalition-wide.')) return;
    startTransition(async () => {
      const r = await endCommsAdvisoryAction(advisoryId);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onClick}>
        {pending ? 'Ending…' : 'End advisory'}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
