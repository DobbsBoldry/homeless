'use client';

import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { recordDcbsDsaAgreementAction } from '@/app/actions/partner-agreements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Deep import: 'use client' files are exempt from the barrel rule (ADR 0001 / FND-040b).
import { DCBS_DSA_SCOPE_OPTIONS } from '@/lib/dtrs/partner-agreements';

type AgencyOption = {
  id: string;
  name: string;
};

type ActiveAgreement = {
  id: string;
  effectiveDate: string | null;
  status: string;
};

type Props = {
  agencies: AgencyOption[];
  /** Map of partnerOrgId → active DSA agreement (if one exists). */
  activeAgreements: Record<string, ActiveAgreement | undefined>;
};

const DESTRUCTION_OPTIONS = [
  { value: 'on_termination', label: 'Upon agreement termination' },
  { value: 'after_3_years', label: 'After 3 years of program completion' },
  { value: 'after_5_years', label: 'After 5 years of program completion' },
] as const;

const DEFAULT_AGENCY_LEGAL_NAME =
  'Kentucky Cabinet for Health and Family Services, Department for Community Based Services';

export function DcbsDsaAgreementForm({ agencies, activeAgreements }: Props) {
  const formId = useId();

  const [selectedAgencyId, setSelectedAgencyId] = useState(agencies[0]?.id ?? '');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [signedByPartner, setSignedByPartner] = useState('');
  const [agencyLegalName, setAgencyLegalName] = useState(DEFAULT_AGENCY_LEGAL_NAME);
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedScope, setSelectedScope] = useState<Set<string>>(new Set());
  const [individualAuth, setIndividualAuth] = useState<'true' | 'false'>('true');
  const [dataDestruction, setDataDestruction] = useState<string>('on_termination');
  const [notes, setNotes] = useState('');

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: true; agreementId: string } | { ok: false; error: string } | null
  >(null);

  const existingAgreement = selectedAgencyId ? activeAgreements[selectedAgencyId] : undefined;

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
    setIndividualAuth('true');
    setDataDestruction('on_termination');
    setNotes('');
    setResult(null);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await recordDcbsDsaAgreementAction(fd);
      setResult(r);
      if (r.ok) resetForm();
    });
  };

  if (result?.ok) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">DCBS DSA recorded.</p>
        <p className="mt-1 text-muted-foreground">
          Agreement ID: <code className="font-mono text-xs">{result.agreementId}</code>
        </p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setResult(null)}>
            Record another
          </Button>
          <Link
            href="/app/admin/agreements/dcbs"
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
      {/* Agency selector */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-agency`}>DCBS office</Label>
        <select
          id={`${formId}-agency`}
          name="partnerOrgId"
          value={selectedAgencyId}
          onChange={(e) => {
            setSelectedAgencyId(e.target.value);
            setResult(null);
          }}
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {existingAgreement && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This agency already has an active DSA (effective:{' '}
            {existingAgreement.effectiveDate ?? 'open'}). Recording a new agreement will not
            automatically supersede it — update the old agreement status separately.
          </p>
        )}
      </div>

      {/* Template preview link */}
      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
        <p className="text-muted-foreground">
          Before recording, the agency should review the{' '}
          <Link
            href="/agreements/dcbs/template"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            DCBS DSA template
          </Link>
          . The template version recorded here is{' '}
          <code className="font-mono text-xs">dcbs-dsa-v1</code>.
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
          Signed by (DCBS){' '}
          <span className="font-normal text-muted-foreground text-xs">(name + title)</span>
        </Label>
        <Input
          id={`${formId}-signed-by`}
          name="signedByPartner"
          type="text"
          value={signedByPartner}
          onChange={(e) => setSignedByPartner(e.target.value)}
          placeholder="e.g. Robin Davis, DCBS Service Region Administrator"
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
        <p className="text-xs text-muted-foreground">
          Pre-filled with the standard CHFS / DCBS designation. Edit if a regional office signs.
        </p>
      </div>

      {/* State contact */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">DCBS contact</legend>
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
              placeholder="e.g. Regional Program Administrator"
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
              placeholder="contact@ky.gov"
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
              placeholder="(502) 564-0000"
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
          {DCBS_DSA_SCOPE_OPTIONS.map((opt) => {
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

      {/* Individual records authorization */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Individual-record sharing authorized? *</legend>
        <p className="text-xs text-muted-foreground">
          Required <strong>Yes</strong> for the foster aging-out pathway (SUBP-001/002 read this
          flag before enabling per-youth views). Select <strong>No</strong> only if the agreement is
          informational/aggregate-only at this stage.
        </p>
        <div className="flex gap-4">
          {(['true', 'false'] as const).map((val) => (
            <label key={val} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="individual_records_authorized"
                value={val}
                checked={individualAuth === val}
                onChange={() => setIndividualAuth(val)}
                disabled={pending}
                className="h-4 w-4"
              />
              {val === 'true'
                ? 'Yes — individual records authorized'
                : 'No — aggregate / informational only'}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Population focus (locked) */}
      <input type="hidden" name="population_focus" value="foster_aging_out" />
      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
        <p className="text-muted-foreground">
          Population focus: <strong>Foster aging-out</strong> (Sprint 10 scope; locked). Future
          amendments may expand to additional DCBS populations.
        </p>
      </div>

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
            (optional — no individual youth identifiers)
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
        <Button type="submit" disabled={pending}>
          {pending ? 'Recording…' : 'Record DCBS DSA'}
        </Button>
        <Link
          href="/app/admin/agreements/dcbs"
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
