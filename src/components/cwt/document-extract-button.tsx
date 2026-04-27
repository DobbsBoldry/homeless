'use client';

import { useState, useTransition } from 'react';
import { extractClientDocumentAction } from '@/app/actions/client-documents';
import { Button } from '@/components/ui/button';

export function DocumentExtractButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await extractClientDocumentAction(id);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" disabled={pending} onClick={onClick}>
        {pending ? 'Extracting…' : label}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
