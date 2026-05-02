'use client';

import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { recordKyDocDsaAgreementAction } from '@/app/actions/partner-agreements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Deep imports: 'use client' files are exempt from the barrel rule (ADR 0001 / FND-040b).
import {
  KY_DOC_DSA_SCOPE_OPTIONS,
  KY_DOC_PRE_RELEASE_WINDOW_DEFAULT_DAYS,
  KY_DOC_PRE_RELEASE_WINDOW_MAX_DAYS,
  KY_DOC_PRE_RELEASE_WINDOW_MIN_DAYS,
} from '@/lib/dtrs/partner-agreements';

type GovernmentOption = {
  id: string;
  name: string;
};

type ActiveAgreement = {
  id: string;
  effectiveDate: string | null;
  status: string;
};

type Props = {
  partners: GovernmentOption[];
  /** Map of partnerOrgId → active KY DOC DSA agreement (if one exists). */
  activeAgreements: Record<string, ActiveAgreement | undefined>;
};

const DESTRUCTION_OPTIONS = [
  {
    value: 'on_termination',
    label: 'Upon agreement termination (recommended for pre-release records)',
  },
  { value: 'after_3_years', label: 'After 3 years of program completion' },
  { value: 'after_5_years', label: 'After 5 years of program completion' },
] as const;

const DEFAULT_AGENCY_LEGAL_NAME = 'Kentucky Department of Corrections';

export function KyDocDsaAgreementForm({ partners, activeAgreements }: Props) {
  const formId = useId();

  const [selectedPartnerId, setSelectedPartnerId] = useState(partners[0]?.id ?? '');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [signedByPartner, setSignedByPartner] = useState('');
  const [agencyLegalName, setAgencyLegalName] = useState(DEFAULT_AGENCY_LEGAL_NAME);
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedScope, setSelectedScope] = useState<Set<string>>(new Set());
  const [windowDays, setWindowDays] = useState<string>(
    String(KY_DOC_PRE_RELEASE_WINDOW_DEFAULT_DAYS),
  );
  const [individualAuth, setIndividualAuth] = useState<'true' | 'false'>('true');
  const [attested, setAttested] = useState(false);
  const [dataDestruction, setDataDestruction] = useState<string>('on_termination');
  const [notes, setNotes] = useState('');

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: true; agreementId: string } | { ok: false; error: string } | null
  >(null);

  const existingAgreement = selectedPartnerId ? activeAgreements[selectedPartnerId] : undefined;

  const toggleScope = (value: string) => {
    setSelectedScope((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const resetForm = () => {
    setEffectiveDate('');
    setEndDate('');
    setSignedByPartner('');
    setContactName('');
    setContactTitle('');
    setContactEmail('');
    setContactPhone('');
    setSelectedScope(new Set());
    setWindowDays(String(KY_DOC_PRE_RELEASE_WINDOW_DEFAULT_DAYS));
    setIndividualAuth('true');
    setAttested(false);
    setDataDestruction('on_termination');
    setNotes('');
    setResult(null);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await recordKyDocDsaAgreementAction(fd);
      setResult(r);
      if (r.ok) resetForm();
    });
  };

  if (result?.ok) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">KY DOC DSA recorded.</p>
        <p className="mt-1 text-muted-foreground">
          Agreement ID: <code className="font-mono text-xs">{result.agreementId}</code>
        </p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setResult(null)}>
            Record another
          </Button>
          <Link
            href="/app/admin/agreements/kydoc"
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
        <Label htmlFor={`${formId}-partner`}>KY DOC partner</Label>
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
              {p.name}
            </option>
          ))}
        </select>
        {existingAgreement && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This partner already has an active KY DOC DSA (effective:{' '}
            {existingAgreement.effectiveDate ?? 'open'}). Recording a new agreement will not
            automatically supersede it — update the old agreement status separately.
          </p>
        )}
      </div>

      {/* Template preview link */}
      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
        <p className="text-muted-foreground">
          Before recording, KY DOC should review the{' '}
          <Link
            href="/agreements/kydoc/template"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            KY DOC DSA template
          </Link>
          . The template version recorded here is{' '}
          <code className="font-mono text-xs">kydoc-dsa-v1</code>.
        </p>
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
          Signed by (KY DOC){' '}
          <span className="font-normal text-muted-foreground text-xs">(name + title)</span>
        </Label>
        <Input
          id={`${formId}-signed-by`}
          name="signedByPartner"
          type="text"
          value={signedByPartner}
          onChange={(e) => setSignedByPartner(e.target.value)}
          placeholder="e.g. Cookie Crews, Commissioner"
          disabled={pending}
        />
      </div>

      {/* Agency legal name */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-legal-name`}>Agency legal name *</Label>
        <Input
          id={`${formId}-legal-name`}
          name="agency_legal_name"
          type="text"
          value={agencyLegalName}
          onChange={(e) => setAgencyLegalName(e.target.value)}
          required
          disabled={pending}
        />
      </div>

      {/* Agency contact */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">KY DOC contact</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${formId}-contact-name`}>Name *</Label>
            <Input
              id={`${formId}-contact-name`}
              name="state_contact_name"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required
              disabled={pending}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-contact-title`}>Title *</Label>
            <Input
              id={`${formId}-contact-title`}
              name="state_contact_title"
              type="text"
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
              required
              disabled={pending}
              placeholder="e.g. Reentry Services Branch Manager"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-contact-email`}>Email *</Label>
            <Input
              id={`${formId}-contact-email`}
              name="state_contact_email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              disabled={pending}
              placeholder="reentry@ky.gov"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-contact-phone`}>
              Phone <span className="font-normal text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id={`${formId}-contact-phone`}
              name="state_contact_phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              disabled={pending}
              placeholder="(502) 564-4726"
            />
          </div>
        </div>
      </fieldset>

      {/* Scope checkboxes */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">
          Data scope *{' '}
          <span className="font-normal text-muted-foreground text-xs">
            (select all that apply — at least one required)
          </span>
        </legend>
        <div className="space-y-2">
          {KY_DOC_DSA_SCOPE_OPTIONS.map((opt) => {
            const inputId = `${formId}-scope-${opt.value}`;
            return (
              <label key={opt.value} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  id={inputId}
                  name={`scope_${opt.value}`}
                  value="on"
                  checked={selectedScope.has(opt.value)}
                  onChange={() => toggleScope(opt.value)}
                  disabled={pending}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Pre-release window */}
      <fieldset className="space-y-2 rounded-md border border-border bg-muted/10 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">Pre-release window</legend>
        <p className="text-xs text-muted-foreground">
          Number of days before projected release that KY DOC may share an individual&apos;s record.
          SUBP-005&apos;s ingest middleware reads this as the contract-of-record (ADR 0009 §
          Decision.3). Default {KY_DOC_PRE_RELEASE_WINDOW_DEFAULT_DAYS} days; range{' '}
          {KY_DOC_PRE_RELEASE_WINDOW_MIN_DAYS}–{KY_DOC_PRE_RELEASE_WINDOW_MAX_DAYS}.
        </p>
        <div className="flex items-center gap-2">
          <Input
            id={`${formId}-window`}
            name="pre_release_window_days"
            type="number"
            min={KY_DOC_PRE_RELEASE_WINDOW_MIN_DAYS}
            max={KY_DOC_PRE_RELEASE_WINDOW_MAX_DAYS}
            step={1}
            value={windowDays}
            onChange={(e) => setWindowDays(e.target.value)}
            disabled={pending}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      </fieldset>

      {/* Individual records authorization */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Individual-records authorization *</legend>
        <p className="text-xs text-muted-foreground">
          Mirrors DCBS pattern. SUBP-005 reads this flag before enabling per-individual views; if
          false, the agreement is informational only and no individual records may be persisted.
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="individual_records_authorized"
              value="true"
              checked={individualAuth === 'true'}
              onChange={() => setIndividualAuth('true')}
              disabled={pending}
              className="h-4 w-4"
            />
            Authorized — KY DOC has executed authorization for individual-record sharing
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="individual_records_authorized"
              value="false"
              checked={individualAuth === 'false'}
              onChange={() => setIndividualAuth('false')}
              disabled={pending}
              className="h-4 w-4"
            />
            Not authorized — informational agreement only
          </label>
        </div>
      </fieldset>

      {/* No-recidivism-prediction attestation */}
      <fieldset className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
        <legend className="px-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
          Required attestation
        </legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="no_recidivism_prediction_attestation"
            value="true"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4"
            required
          />
          <span>
            I attest that the Coalition will not use this data for actuarial recidivism scoring,
            risk-of-reoffense modeling, or any law-enforcement / parole / probation surveillance
            purpose, as required by ADR 0009 and the Second Chance Act framework. I have authority
            to record this KY DOC DSA on behalf of the coalition.
          </span>
        </label>
      </fieldset>

      {/* Data destruction policy */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Data destruction policy *</legend>
        <div className="space-y-2">
          {DESTRUCTION_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="data_destruction_due"
                value={opt.value}
                checked={dataDestruction === opt.value}
                onChange={() => setDataDestruction(opt.value)}
                disabled={pending}
                className="h-4 w-4"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-notes`}>
          Notes{' '}
          <span className="font-normal text-muted-foreground text-xs">
            (optional — no individual identifiers)
          </span>
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
          placeholder="Optional context about this agreement"
        />
      </div>

      {result && !result.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !attested}>
          {pending ? 'Recording…' : 'Record KY DOC DSA'}
        </Button>
        <Link
          href="/app/admin/agreements/kydoc"
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
