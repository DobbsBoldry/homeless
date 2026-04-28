'use client';

import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { recordMouAgreementAction } from '@/app/actions/partner-agreements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PartnerOption = {
  id: string;
  name: string;
  type: string;
};

type ActiveAgreement = {
  id: string;
  effectiveDate: string | null;
  endDate: string | null;
  status: string;
};

type Props = {
  partners: PartnerOption[];
  activeAgreements: Record<string, ActiveAgreement | undefined>;
};

const PHASE_OPTIONS = [
  { value: 'phase_0' as const, label: 'Phase 0 — initial discovery / scoping' },
  { value: 'phase_1' as const, label: 'Phase 1 — pilot operations' },
  { value: 'standing' as const, label: 'Standing — ongoing partnership' },
];

export function MouAgreementForm({ partners, activeAgreements }: Props) {
  const formId = useId();

  const [selectedPartnerId, setSelectedPartnerId] = useState(partners[0]?.id ?? '');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [signedByPartner, setSignedByPartner] = useState('');
  const [phase, setPhase] = useState<string>('phase_0');
  const [meetingHours, setMeetingHours] = useState('');
  const [withdrawalDays, setWithdrawalDays] = useState('30');
  const [notes, setNotes] = useState('');

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: true; agreementId: string } | { ok: false; error: string } | null
  >(null);

  const existingAgreement = selectedPartnerId ? activeAgreements[selectedPartnerId] : undefined;

  const resetForm = () => {
    setEffectiveDate('');
    setEndDate('');
    setSignedByPartner('');
    setPhase('phase_0');
    setMeetingHours('');
    setWithdrawalDays('30');
    setNotes('');
    setResult(null);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await recordMouAgreementAction(fd);
      setResult(r);
      if (r.ok) resetForm();
    });
  };

  if (result?.ok) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">MOU recorded.</p>
        <p className="mt-1 text-muted-foreground">
          Agreement ID: <code className="font-mono text-xs">{result.agreementId}</code>
        </p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setResult(null)}>
            Record another
          </Button>
          <Link
            href="/app/admin/agreements/mou"
            className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
          >
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Partner selector */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-partner`}>Partner</Label>
        <select
          id={`${formId}-partner`}
          name="partnerOrgId"
          value={selectedPartnerId}
          onChange={(e) => {
            setSelectedPartnerId(e.target.value);
            setResult(null);
          }}
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.type.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        {existingAgreement && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This partner already has an active MOU (effective:{' '}
            {existingAgreement.effectiveDate ?? 'open'}
            {existingAgreement.endDate ? ` → ${existingAgreement.endDate}` : ''}). Recording a new
            one will not automatically supersede it.
          </p>
        )}
      </div>

      {/* Dates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${formId}-effective`}>Effective date *</Label>
          <Input
            id={`${formId}-effective`}
            name="effectiveDate"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${formId}-end`}>
            End date{' '}
            <span className="font-normal text-muted-foreground text-xs">
              (optional — open-ended if blank)
            </span>
          </Label>
          <Input
            id={`${formId}-end`}
            name="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      {/* Signed by partner */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-signed-by`}>
          Signed by (partner){' '}
          <span className="font-normal text-muted-foreground text-xs">(name + role)</span>
        </Label>
        <Input
          id={`${formId}-signed-by`}
          name="signedByPartner"
          type="text"
          value={signedByPartner}
          onChange={(e) => setSignedByPartner(e.target.value)}
          placeholder="e.g. Pat Smith, Executive Director"
          disabled={pending}
        />
      </div>

      {/* Phase */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Phase *</legend>
        <div className="space-y-1">
          {PHASE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="phase"
                value={opt.value}
                checked={phase === opt.value}
                onChange={() => setPhase(opt.value)}
                disabled={pending}
                className="h-4 w-4"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Coordination commitments */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${formId}-hours`}>
            Monthly meeting hours{' '}
            <span className="font-normal text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id={`${formId}-hours`}
            name="monthly_meeting_hours"
            type="number"
            min={0}
            step="0.5"
            value={meetingHours}
            onChange={(e) => setMeetingHours(e.target.value)}
            placeholder="e.g. 2"
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${formId}-notice`}>Withdrawal notice days *</Label>
          <Input
            id={`${formId}-notice`}
            name="withdrawal_notice_days"
            type="number"
            min={0}
            step={1}
            value={withdrawalDays}
            onChange={(e) => setWithdrawalDays(e.target.value)}
            required
            disabled={pending}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-notes`}>
          Notes <span className="font-normal text-muted-foreground text-xs">(optional)</span>
        </Label>
        <textarea
          id={`${formId}-notes`}
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
          maxLength={2000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Optional context"
        />
      </div>

      {result && !result.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Recording…' : 'Record MOU'}
        </Button>
        <Link
          href="/app/admin/agreements/mou"
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
