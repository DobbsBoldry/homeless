'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import {
  extractClientDocumentAction,
  saveClientDocumentAction,
} from '@/app/actions/client-documents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ClientDocumentKind } from '@/db/schema/enums';

const KINDS: Array<{ id: ClientDocumentKind; label: string }> = [
  { id: 'photo_id', label: 'Photo ID (KY ID, driver license)' },
  { id: 'ssn_card', label: 'Social Security card' },
  { id: 'birth_certificate', label: 'Birth certificate' },
  { id: 'dd_214', label: 'DD-214 (military discharge)' },
  { id: 'lease', label: 'Lease' },
  { id: 'paystub', label: 'Paystub' },
  { id: 'court_record', label: 'Court record' },
  { id: 'other', label: 'Other' },
];

export function DocumentUploadForm() {
  const router = useRouter();
  const labelId = useId();
  const kindId = useId();
  const refId = useId();
  const bodyId = useId();
  const [kind, setKind] = useState<ClientDocumentKind>('photo_id');
  const [label, setLabel] = useState('');
  const [refValue, setRef] = useState('');
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const saved = await saveClientDocumentAction({
        kind,
        label,
        contentMd: body,
        syntheticPersonRef: refValue.trim() || null,
      });
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      // Kick off extraction immediately. Failure here doesn't block —
      // the user lands on the detail page either way and can retry.
      const extracted = await extractClientDocumentAction(saved.id);
      if (!extracted.ok) {
        // Soft error — show on the next page rather than blocking.
        console.warn('[document-upload] extraction failed:', extracted.error);
      }
      router.push(`/app/clients/documents/${saved.id}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={kindId}>Kind</Label>
          <select
            id={kindId}
            value={kind}
            onChange={(e) => setKind(e.target.value as ClientDocumentKind)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={labelId}>Label</Label>
          <Input
            id={labelId}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`e.g. "Sarah's KY ID"`}
            disabled={pending}
            required
            maxLength={80}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={refId}>Synthetic person ref (optional)</Label>
        <Input
          id={refId}
          value={refValue}
          onChange={(e) => setRef(e.target.value)}
          placeholder="SYN-PERSON-001"
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          Link this document to a coalition-wide opaque identifier. Leave blank if you don't have
          one yet.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor={bodyId}>Document body</Label>
        <textarea
          id={bodyId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          disabled={pending}
          required
          minLength={20}
          maxLength={50000}
          placeholder="Paste the document text here. The AI extracts structured fields automatically."
          className="w-full rounded-md border border-input bg-background p-2 text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Phase-1 scope: text-only. Real PDF / photo upload waits for the post-BAA storage migration
          (ESUC-002). Today, paste OCR'd text or transcribe key fields by hand.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving + extracting…' : 'Save & extract'}
      </Button>
    </form>
  );
}
