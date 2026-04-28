'use client';

import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { recordOasisDsaAgreementAction } from '@/app/actions/partner-agreements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Deep imports: 'use client' files are exempt from the barrel rule (ADR 0001 / FND-040b).
import {
  OASIS_DEFAULT_REDACTION_POLICY,
  OASIS_DSA_SCOPE_OPTIONS,
  OASIS_REDACTABLE_FIELDS,
  type OasisRedactableField,
  type OasisRedactionPolicy,
  type OasisRedactionTreatment,
} from '@/lib/dtrs/partner-agreements';

type ShelterOption = {
  id: string;
  name: string;
};

type ActiveAgreement = {
  id: string;
  effectiveDate: string | null;
  status: string;
};

type Props = {
  shelters: ShelterOption[];
  /** Map of partnerOrgId → active OASIS DSA agreement (if one exists). */
  activeAgreements: Record<string, ActiveAgreement | undefined>;
};

const DESTRUCTION_OPTIONS = [
  { value: 'on_termination', label: 'Upon agreement termination (recommended for DV data)' },
  { value: 'after_3_years', label: 'After 3 years of program completion' },
  { value: 'after_5_years', label: 'After 5 years of program completion' },
] as const;

const REDACTION_OPTIONS: ReadonlyArray<{ value: OasisRedactionTreatment; label: string }> = [
  { value: 'suppress', label: 'Suppress (never transmit)' },
  { value: 'aggregate_only', label: 'Aggregate only (counts, never per-record)' },
  { value: 'share', label: 'Share (transmit to authorized readers)' },
];

const REDACTION_FIELD_LABELS: Record<OasisRedactableField, string> = {
  current_address: 'Current address',
  current_employer: 'Current employer',
  child_school_id: 'Child school enrollment',
  risk_tier: 'Risk tier (Campbell DA-scale band)',
  enrolled_at: 'Enrollment timestamp',
  assigned_advocate_id: 'Assigned advocate (id only, never name)',
};

const DEFAULT_AGENCY_LEGAL_NAME = 'Owensboro Area Shelter and Information Services, Inc.';

export function OasisDsaAgreementForm({ shelters, activeAgreements }: Props) {
  const formId = useId();

  const [selectedShelterId, setSelectedShelterId] = useState(shelters[0]?.id ?? '');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [signedByPartner, setSignedByPartner] = useState('');
  const [agencyLegalName, setAgencyLegalName] = useState(DEFAULT_AGENCY_LEGAL_NAME);
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedScope, setSelectedScope] = useState<Set<string>>(new Set());
  const [redactionPolicy, setRedactionPolicy] = useState<OasisRedactionPolicy>(
    OASIS_DEFAULT_REDACTION_POLICY,
  );
  const [attested, setAttested] = useState(false);
  const [dataDestruction, setDataDestruction] = useState<string>('on_termination');
  const [notes, setNotes] = useState('');

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: true; agreementId: string } | { ok: false; error: string } | null
  >(null);

  const existingAgreement = selectedShelterId ? activeAgreements[selectedShelterId] : undefined;

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

  const setRedaction = (field: OasisRedactableField, treatment: OasisRedactionTreatment) => {
    setRedactionPolicy((prev) => ({ ...prev, [field]: treatment }));
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
    setRedactionPolicy(OASIS_DEFAULT_REDACTION_POLICY);
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
      const r = await recordOasisDsaAgreementAction(fd);
      setResult(r);
      if (r.ok) resetForm();
    });
  };

  if (result?.ok) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">OASIS DSA recorded.</p>
        <p className="mt-1 text-muted-foreground">
          Agreement ID: <code className="font-mono text-xs">{result.agreementId}</code>
        </p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setResult(null)}>
            Record another
          </Button>
          <Link
            href="/app/admin/agreements/oasis"
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
      {/* Shelter selector */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-shelter`}>OASIS partner</Label>
        <select
          id={`${formId}-shelter`}
          name="partnerOrgId"
          value={selectedShelterId}
          onChange={(e) => {
            setSelectedShelterId(e.target.value);
            setResult(null);
          }}
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {shelters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {existingAgreement && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This partner already has an active DSA (effective:{' '}
            {existingAgreement.effectiveDate ?? 'open'}). Recording a new agreement will not
            automatically supersede it — update the old agreement status separately.
          </p>
        )}
      </div>

      {/* Template preview link */}
      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
        <p className="text-muted-foreground">
          Before recording, OASIS should review the{' '}
          <Link
            href="/agreements/oasis/template"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            OASIS DSA template
          </Link>
          . The template version recorded here is{' '}
          <code className="font-mono text-xs">oasis-dsa-v1</code>.
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
          Signed by (OASIS){' '}
          <span className="font-normal text-muted-foreground text-xs">(name + title)</span>
        </Label>
        <Input
          id={`${formId}-signed-by`}
          name="signedByPartner"
          type="text"
          value={signedByPartner}
          onChange={(e) => setSignedByPartner(e.target.value)}
          placeholder="e.g. Avery Hart, OASIS Executive Director"
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
        <legend className="text-sm font-medium">OASIS contact</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${formId}-contact-name`}>Name *</Label>
            <Input
              id={`${formId}-contact-name`}
              name="agency_contact_name"
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
              name="agency_contact_title"
              type="text"
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
              required
              disabled={pending}
              placeholder="e.g. Executive Director"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-contact-email`}>Email *</Label>
            <Input
              id={`${formId}-contact-email`}
              name="agency_contact_email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              disabled={pending}
              placeholder="contact@oasisshelter.org"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-contact-phone`}>
              Phone <span className="font-normal text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id={`${formId}-contact-phone`}
              name="agency_contact_phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              disabled={pending}
              placeholder="(270) 685-0260"
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
          {OASIS_DSA_SCOPE_OPTIONS.map((opt) => {
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

      {/* Abuser-blind redaction policy */}
      <fieldset className="space-y-3 rounded-md border border-border bg-muted/10 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Abuser-blind redaction policy
        </legend>
        <p className="text-xs text-muted-foreground">
          For each field, choose how OASIS will share it with the coalition. The defaults are
          abuser-blind — any field that could leak survivor location is suppressed. Relax a field
          only with explicit OASIS authorization. SUBP-004 reads this policy as the contract-of-
          record (ADR 0007 § 3.2).
        </p>
        <div className="space-y-3">
          {OASIS_REDACTABLE_FIELDS.map((field) => {
            const groupId = `${formId}-redaction-${field}`;
            return (
              <div key={field} className="space-y-1">
                <p className="text-sm font-medium">{REDACTION_FIELD_LABELS[field]}</p>
                <div className="flex flex-wrap gap-3">
                  {REDACTION_OPTIONS.map((opt) => {
                    const inputId = `${groupId}-${opt.value}`;
                    return (
                      <label
                        key={opt.value}
                        htmlFor={inputId}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <input
                          type="radio"
                          id={inputId}
                          name={`redaction_${field}`}
                          value={opt.value}
                          checked={redactionPolicy[field] === opt.value}
                          onChange={() => setRedaction(field, opt.value)}
                          disabled={pending}
                          className="h-3.5 w-3.5"
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Abuser-blind attestation */}
      <fieldset className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
        <legend className="px-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
          Required attestation
        </legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="abuser_blind_attestation"
            value="true"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4"
            required
          />
          <span>
            I attest that this redaction policy enforces abuser-blind discipline as required by ADR
            0007 and KRS 209A. I have authority to record this OASIS DSA on behalf of the coalition.
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
            (optional — no survivor identifiers)
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
          {pending ? 'Recording…' : 'Record OASIS DSA'}
        </Button>
        <Link
          href="/app/admin/agreements/oasis"
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
