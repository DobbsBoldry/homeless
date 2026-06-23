'use client';

import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { recordVaHudVashDsaAgreementAction } from '@/app/actions/partner-agreements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Deep imports: 'use client' files are exempt from the barrel rule (ADR 0001 / FND-040b).
import {
  VA_HUDVASH_DSA_SCOPE_OPTIONS,
  VA_HUDVASH_VOUCHER_WINDOW_DEFAULT_DAYS,
  VA_HUDVASH_VOUCHER_WINDOW_MAX_DAYS,
  VA_HUDVASH_VOUCHER_WINDOW_MIN_DAYS,
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
  /** Map of partnerOrgId → active VA HUD-VASH DSA agreement (if one exists). */
  activeAgreements: Record<string, ActiveAgreement | undefined>;
};

const DESTRUCTION_OPTIONS = [
  {
    value: 'on_termination',
    label: 'Upon agreement termination (recommended for veteran records)',
  },
  { value: 'after_3_years', label: 'After 3 years of program completion' },
  { value: 'after_5_years', label: 'After 5 years of program completion' },
] as const;

const DEFAULT_VAMC_LEGAL_NAME =
  'U.S. Department of Veterans Affairs — VA Medical Center HUD-VASH Program';

export function VaHudVashDsaAgreementForm({ partners, activeAgreements }: Props) {
  const formId = useId();

  const [selectedPartnerId, setSelectedPartnerId] = useState(partners[0]?.id ?? '');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [signedByPartner, setSignedByPartner] = useState('');

  const [vamcLegalName, setVamcLegalName] = useState(DEFAULT_VAMC_LEGAL_NAME);
  const [vamcContactName, setVamcContactName] = useState('');
  const [vamcContactTitle, setVamcContactTitle] = useState('');
  const [vamcContactEmail, setVamcContactEmail] = useState('');
  const [vamcContactPhone, setVamcContactPhone] = useState('');

  const [phaLegalName, setPhaLegalName] = useState('');
  const [phaContactName, setPhaContactName] = useState('');
  const [phaContactTitle, setPhaContactTitle] = useState('');
  const [phaContactEmail, setPhaContactEmail] = useState('');
  const [phaContactPhone, setPhaContactPhone] = useState('');

  const [selectedScope, setSelectedScope] = useState<Set<string>>(new Set());
  const [windowDays, setWindowDays] = useState<string>(
    String(VA_HUDVASH_VOUCHER_WINDOW_DEFAULT_DAYS),
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
    setVamcContactName('');
    setVamcContactTitle('');
    setVamcContactEmail('');
    setVamcContactPhone('');
    setPhaLegalName('');
    setPhaContactName('');
    setPhaContactTitle('');
    setPhaContactEmail('');
    setPhaContactPhone('');
    setSelectedScope(new Set());
    setWindowDays(String(VA_HUDVASH_VOUCHER_WINDOW_DEFAULT_DAYS));
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
      const r = await recordVaHudVashDsaAgreementAction(fd);
      setResult(r);
      if (r.ok) resetForm();
    });
  };

  if (result?.ok) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">
          VA HUD-VASH DSA recorded.
        </p>
        <p className="mt-1 text-muted-foreground">
          Agreement ID: <code className="font-mono text-xs">{result.agreementId}</code>
        </p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setResult(null)}>
            Record another
          </Button>
          <Link
            href="/app/admin/agreements/vahudvash"
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
        <Label htmlFor={`${formId}-partner`}>VA HUD-VASH partner</Label>
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
            This partner already has an active VA HUD-VASH DSA (effective:{' '}
            {existingAgreement.effectiveDate ?? 'open'}). Recording a new agreement will not
            automatically supersede it — update the old agreement status separately.
          </p>
        )}
      </div>

      {/* Template preview link */}
      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
        <p className="text-muted-foreground">
          Before recording, both VA HUD-VASH and the local PHA should review the{' '}
          <Link
            href="/agreements/vahudvash/template"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            VA HUD-VASH DSA template
          </Link>
          . The template version recorded here is{' '}
          <code className="font-mono text-xs">vahudvash-dsa-v1</code>.
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
          Signed by{' '}
          <span className="font-normal text-muted-foreground text-xs">
            (joint VAMC + PHA signatories)
          </span>
        </Label>
        <Input
          id={`${formId}-signed-by`}
          name="signedByPartner"
          type="text"
          value={signedByPartner}
          onChange={(e) => setSignedByPartner(e.target.value)}
          placeholder="e.g. VAMC Director + PHA Executive Director"
          disabled={pending}
        />
      </div>

      {/* VAMC fields */}
      <fieldset className="space-y-3 rounded-md border border-border bg-muted/10 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          VA Medical Center (HUD-VASH program)
        </legend>
        <div className="space-y-1">
          <Label htmlFor={`${formId}-vamc-legal`}>VAMC legal name *</Label>
          <Input
            id={`${formId}-vamc-legal`}
            name="vamc_legal_name"
            type="text"
            value={vamcLegalName}
            onChange={(e) => setVamcLegalName(e.target.value)}
            required
            disabled={pending}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${formId}-vamc-name`}>Contact name *</Label>
            <Input
              id={`${formId}-vamc-name`}
              name="vamc_contact_name"
              type="text"
              value={vamcContactName}
              onChange={(e) => setVamcContactName(e.target.value)}
              required
              disabled={pending}
              placeholder="HUD-VASH coordinator"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-vamc-title`}>Contact title *</Label>
            <Input
              id={`${formId}-vamc-title`}
              name="vamc_contact_title"
              type="text"
              value={vamcContactTitle}
              onChange={(e) => setVamcContactTitle(e.target.value)}
              required
              disabled={pending}
              placeholder="e.g. HUD-VASH Coordinator, Louisville VAMC"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-vamc-email`}>Contact email *</Label>
            <Input
              id={`${formId}-vamc-email`}
              name="vamc_contact_email"
              type="email"
              value={vamcContactEmail}
              onChange={(e) => setVamcContactEmail(e.target.value)}
              required
              disabled={pending}
              placeholder="hudvash@va.gov"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-vamc-phone`}>
              Phone <span className="font-normal text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id={`${formId}-vamc-phone`}
              name="vamc_contact_phone"
              type="tel"
              value={vamcContactPhone}
              onChange={(e) => setVamcContactPhone(e.target.value)}
              disabled={pending}
              placeholder="(502) 287-4000"
            />
          </div>
        </div>
      </fieldset>

      {/* PHA fields */}
      <fieldset className="space-y-3 rounded-md border border-border bg-muted/10 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Local Public Housing Authority (voucher allocation)
        </legend>
        <div className="space-y-1">
          <Label htmlFor={`${formId}-pha-legal`}>PHA legal name *</Label>
          <Input
            id={`${formId}-pha-legal`}
            name="pha_legal_name"
            type="text"
            value={phaLegalName}
            onChange={(e) => setPhaLegalName(e.target.value)}
            required
            disabled={pending}
            placeholder="e.g. Owensboro Housing Authority"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${formId}-pha-name`}>Contact name *</Label>
            <Input
              id={`${formId}-pha-name`}
              name="pha_contact_name"
              type="text"
              value={phaContactName}
              onChange={(e) => setPhaContactName(e.target.value)}
              required
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-pha-title`}>Contact title *</Label>
            <Input
              id={`${formId}-pha-title`}
              name="pha_contact_title"
              type="text"
              value={phaContactTitle}
              onChange={(e) => setPhaContactTitle(e.target.value)}
              required
              disabled={pending}
              placeholder="e.g. HCV Director"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-pha-email`}>Contact email *</Label>
            <Input
              id={`${formId}-pha-email`}
              name="pha_contact_email"
              type="email"
              value={phaContactEmail}
              onChange={(e) => setPhaContactEmail(e.target.value)}
              required
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-pha-phone`}>
              Phone <span className="font-normal text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id={`${formId}-pha-phone`}
              name="pha_contact_phone"
              type="tel"
              value={phaContactPhone}
              onChange={(e) => setPhaContactPhone(e.target.value)}
              disabled={pending}
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
          {VA_HUDVASH_DSA_SCOPE_OPTIONS.map((opt) => {
            const inputId = `${formId}-scope-${opt.value}`;
            return (
              <label key={opt.value} htmlFor={inputId} className="flex items-start gap-2 text-sm">
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
        <p className="text-xs text-muted-foreground">
          MH/SUD diagnosis content, treatment plans, session notes, and medication lists are
          <strong> intentionally absent</strong> from this scope. v1 only permits the <em>fact</em>{' '}
          of an active treatment relationship (status_only). Expanding to QSOA-protected content
          requires a separate agreement and ADR (see ADR 0010).
        </p>
      </fieldset>

      {/* Voucher-search window */}
      <fieldset className="space-y-2 rounded-md border border-border bg-muted/10 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Voucher-search window
        </legend>
        <p className="text-xs text-muted-foreground">
          Number of days after voucher issuance during which VA HUD-VASH may share an individual
          veteran&apos;s record. SUBP-006&apos;s ingest middleware reads this as the contract-of-
          record (ADR 0010 § Decision.3). Default {VA_HUDVASH_VOUCHER_WINDOW_DEFAULT_DAYS} days;
          range {VA_HUDVASH_VOUCHER_WINDOW_MIN_DAYS}–{VA_HUDVASH_VOUCHER_WINDOW_MAX_DAYS}.
        </p>
        <div className="flex items-center gap-2">
          <Input
            id={`${formId}-window`}
            name="voucher_search_window_days"
            type="number"
            min={VA_HUDVASH_VOUCHER_WINDOW_MIN_DAYS}
            max={VA_HUDVASH_VOUCHER_WINDOW_MAX_DAYS}
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
          Mirrors KY DOC pattern. SUBP-006 reads this flag before enabling per-individual views; if
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
            Authorized — joint VAMC + PHA have executed authorization for individual-record sharing
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

      {/* Locked treatment_scope reminder + hidden field */}
      <input type="hidden" name="treatment_scope" value="status_only" />
      <fieldset className="space-y-2 rounded-md border border-sky-500/40 bg-sky-500/5 p-4">
        <legend className="px-1 text-sm font-semibold text-sky-700 dark:text-sky-400">
          MH/SUD scope boundary (locked at v1)
        </legend>
        <p className="text-xs text-muted-foreground">
          The <code className="font-mono text-xs">treatment_scope</code> field is locked to{' '}
          <code className="font-mono text-xs">status_only</code> at v1: only the <em>fact</em> of an
          active treatment relationship may flow (continuity-status enum + VA case-manager contact
          for warm handoff). Diagnosis codes, treatment plan content, session notes, and medication
          lists remain with the VA case manager. Expanding requires a separate QSOA + ADR.
        </p>
      </fieldset>

      {/* No-service-denial-prediction attestation */}
      <fieldset className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
        <legend className="px-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
          Required attestation
        </legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="no_service_denial_prediction_attestation"
            value="true"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4"
            required
          />
          <span>
            I attest that the Coalition will not use this data to predict voucher-failure,
            deprioritize veteran cases, or feed any service-denial determination by insurers,
            employers, eligibility-screening vendors, or any third party, as required by ADR 0010
            and the VA HUD-VASH framework. I have authority to record this DSA on behalf of the
            coalition.
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
          {pending ? 'Recording…' : 'Record VA HUD-VASH DSA'}
        </Button>
        <Link
          href="/app/admin/agreements/vahudvash"
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
