'use client';

import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { recordFerpaAgreementAction } from '@/app/actions/partner-agreements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Deep import: 'use client' files are exempt from the barrel rule (ADR 0001 / FND-040b).
// The barrel re-exports server-only code that would break in the client bundle.
import { FERPA_SCOPE_OPTIONS } from '@/lib/dtrs/partner-agreements';

type SchoolOption = {
  id: string;
  name: string;
};

type ActiveAgreement = {
  id: string;
  effectiveDate: string | null;
  status: string;
};

type Props = {
  schools: SchoolOption[];
  /** Map of partnerOrgId → active FERPA agreement (if one exists). */
  activeAgreements: Record<string, ActiveAgreement | undefined>;
};

const DESTRUCTION_OPTIONS = [
  { value: 'on_termination', label: 'Upon agreement termination' },
  { value: 'after_5_years', label: 'After 5 years of program completion' },
  { value: 'never_required', label: 'Not contractually required (not recommended)' },
] as const;

export function FerpaAgreementForm({ schools, activeAgreements }: Props) {
  const formId = useId();

  const [selectedSchoolId, setSelectedSchoolId] = useState(schools[0]?.id ?? '');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [signedByPartner, setSignedByPartner] = useState('');
  const [districtName, setDistrictName] = useState(schools[0]?.name ?? '');
  const [liaisonName, setLiaisonName] = useState('');
  const [liaisonEmail, setLiaisonEmail] = useState('');
  const [liaisonPhone, setLiaisonPhone] = useState('');
  const [selectedScope, setSelectedScope] = useState<Set<string>>(new Set());
  const [studiesException, setStudiesException] = useState<'true' | 'false'>('true');
  const [dataDestruction, setDataDestruction] = useState<string>('on_termination');
  const [notes, setNotes] = useState('');

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: true; agreementId: string } | { ok: false; error: string } | null
  >(null);

  const existingAgreement = selectedSchoolId ? activeAgreements[selectedSchoolId] : undefined;

  const handleSchoolChange = (id: string) => {
    setSelectedSchoolId(id);
    const school = schools.find((s) => s.id === id);
    setDistrictName(school?.name ?? '');
    setResult(null);
  };

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
    setLiaisonName('');
    setLiaisonEmail('');
    setLiaisonPhone('');
    setSelectedScope(new Set());
    setStudiesException('true');
    setDataDestruction('on_termination');
    setNotes('');
    setResult(null);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    const fd = new FormData(e.currentTarget);
    // FormData from a controlled React form only includes checked checkboxes —
    // no manual deletion needed. The checked state is driven by selectedScope
    // via the `checked` prop, so unchecked boxes are never serialized.
    startTransition(async () => {
      const r = await recordFerpaAgreementAction(fd);
      setResult(r);
      if (r.ok) resetForm();
    });
  };

  if (result?.ok) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">
          FERPA agreement recorded.
        </p>
        <p className="mt-1 text-muted-foreground">
          Agreement ID: <code className="font-mono text-xs">{result.agreementId}</code>
        </p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setResult(null)}>
            Record another
          </Button>
          <Link
            href="/app/admin/agreements/ferpa"
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
      {/* School district selector */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-school`}>School district</Label>
        <select
          id={`${formId}-school`}
          name="partnerOrgId"
          value={selectedSchoolId}
          onChange={(e) => handleSchoolChange(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {existingAgreement && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This district already has an active FERPA agreement (effective:{' '}
            {existingAgreement.effectiveDate ?? 'open'}). Recording a new agreement will not
            automatically supersede it — update the old agreement status separately.
          </p>
        )}
      </div>

      {/* Template preview link */}
      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
        <p className="text-muted-foreground">
          Before recording, the district should review the{' '}
          <Link
            href="/agreements/ferpa/template"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            FERPA agreement template
          </Link>
          . The template version recorded here is{' '}
          <code className="font-mono text-xs">ferpa-v1</code>.
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
          Signed by (partner){' '}
          <span className="font-normal text-muted-foreground text-xs">(name + role)</span>
        </Label>
        <Input
          id={`${formId}-signed-by`}
          name="signedByPartner"
          type="text"
          value={signedByPartner}
          onChange={(e) => setSignedByPartner(e.target.value)}
          placeholder="e.g. Jane Smith, Superintendent"
          disabled={pending}
        />
      </div>

      {/* District name (editable — may differ from partner org name) */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-district`}>District legal name *</Label>
        <Input
          id={`${formId}-district`}
          name="district_name"
          type="text"
          value={districtName}
          onChange={(e) => setDistrictName(e.target.value)}
          required
          disabled={pending}
          placeholder="e.g. Daviess County Public Schools"
        />
        <p className="text-xs text-muted-foreground">
          Pre-filled from the partner org name. Edit to match the district&apos;s official legal
          name.
        </p>
      </div>

      {/* Liaison contact */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">District FERPA liaison contact</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${formId}-liaison-name`}>Name *</Label>
            <Input
              id={`${formId}-liaison-name`}
              name="liaison_name"
              type="text"
              value={liaisonName}
              onChange={(e) => setLiaisonName(e.target.value)}
              required
              disabled={pending}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-liaison-email`}>Email *</Label>
            <Input
              id={`${formId}-liaison-email`}
              name="liaison_email"
              type="email"
              value={liaisonEmail}
              onChange={(e) => setLiaisonEmail(e.target.value)}
              required
              disabled={pending}
              placeholder="liaison@district.kyschools.us"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-liaison-phone`}>
              Phone <span className="font-normal text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id={`${formId}-liaison-phone`}
              name="liaison_phone"
              type="tel"
              value={liaisonPhone}
              onChange={(e) => setLiaisonPhone(e.target.value)}
              disabled={pending}
              placeholder="(270) 555-0100"
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
          {FERPA_SCOPE_OPTIONS.map((opt) => {
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

      {/* Studies exception toggle */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">FERPA § 99.31(a)(6) studies exception *</legend>
        <p className="text-xs text-muted-foreground">
          Required for automated data transfers. Invokes the &quot;studies conducted for educational
          agencies&quot; exception. If unsure, select Yes.
        </p>
        <div className="flex gap-4">
          {(['true', 'false'] as const).map((val) => (
            <label key={val} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="studies_exception"
                value={val}
                checked={studiesException === val}
                onChange={() => setStudiesException(val)}
                disabled={pending}
                className="h-4 w-4"
              />
              {val === 'true'
                ? 'Yes — studies exception invoked'
                : 'No — directory information only'}
            </label>
          ))}
        </div>
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
            (optional — no individual student identifiers)
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
          {pending ? 'Recording…' : 'Record FERPA agreement'}
        </Button>
        <Link
          href="/app/admin/agreements/ferpa"
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
