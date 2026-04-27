'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { referPatientToCaseworkerAction } from '@/app/actions/care';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function ReferPatientToCaseworkerPanel({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await referPatientToCaseworkerAction(patientId);
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
          <p className="font-medium">Refer this patient to the caseworker queue</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Drops a pre-filled intake into the queue with a templated note summarizing the ED
            pattern. Coordinator still owns the medical side; the caseworker picks up benefits,
            housing path, and partner coordination.
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
