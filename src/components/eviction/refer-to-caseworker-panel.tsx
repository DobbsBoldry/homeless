'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { referFilingToCaseworkerAction } from '@/app/actions/eviction';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function ReferToCaseworkerPanel({ filingId }: { filingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await referFilingToCaseworkerAction(filingId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/app/clients/intakes/${r.intakeId}`);
    });
  };

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          <p className="font-medium">Refer this tenant to the caseworker queue</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Drops a pre-filled intake into the queue with a templated referral note. KLA still
            handles the legal side; the caseworker picks up benefits, care plan, shelter risk, and
            anything else the coalition can offer.
          </p>
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
        <Button onClick={onClick} disabled={pending} size="sm" className="shrink-0">
          {pending ? 'Referring…' : 'Refer to caseworker →'}
        </Button>
      </CardContent>
    </Card>
  );
}
