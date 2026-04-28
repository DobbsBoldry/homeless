'use client';

import { useId, useState, useTransition } from 'react';
import { submitSchoolReferralAction } from '@/app/actions/school-referrals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Deep imports: 'use client' files are exempt from the barrel rule (ADR 0001 / FND-040b).
// The barrel re-exports server-only code that would break in the client bundle.
import {
  CURRENT_FERPA_ELIGIBLE_STUDENT_CONSENT_VERSION,
  CURRENT_FERPA_PARENTAL_CONSENT_VERSION,
  FERPA_ELIGIBLE_STUDENT_CONSENT_V1,
  FERPA_PARENTAL_CONSENT_V1,
} from '@/lib/dtrs/ferpa-consent-text';
import { SCHOOL_REFERRAL_SERVICES } from '@/lib/dtrs/school-referral-vocabulary';

type SchoolPartnerOrg = {
  id: string;
  name: string;
};

type BasisValue = 'mckinney_vento_authorization' | 'parental_consent' | 'eligible_student_consent';

export function SchoolReferralIntakeForm({ orgs }: { orgs: SchoolPartnerOrg[] }) {
  const formId = useId();

  const [partnerOrgId, setPartnerOrgId] = useState(orgs[0]?.id ?? '');
  const [basis, setBasis] = useState<BasisValue>('mckinney_vento_authorization');
  const [studentFirstInitial, setStudentFirstInitial] = useState('');
  const [studentAge, setStudentAge] = useState('');
  const [studentGradeBand, setStudentGradeBand] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [housingSituation, setHousingSituation] = useState('');
  const [servicesRequested, setServicesRequested] = useState<Set<string>>(new Set());
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');

  // Basis-specific fields
  const [mvAttested, setMvAttested] = useState(false);
  const [consentSignedAt, setConsentSignedAt] = useState('');
  const [consentSignedMethod, setConsentSignedMethod] = useState('');

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: true; referralId: string } | { ok: false; error: string } | null
  >(null);

  const toggleService = (svc: string) => {
    setServicesRequested((prev) => {
      const next = new Set(prev);
      if (next.has(svc)) next.delete(svc);
      else next.add(svc);
      return next;
    });
  };

  const resetForm = () => {
    setStudentFirstInitial('');
    setStudentAge('');
    setStudentGradeBand('');
    setGuardianName('');
    setGuardianContact('');
    setHousingSituation('');
    setServicesRequested(new Set());
    setUrgency('medium');
    setNotes('');
    setMvAttested(false);
    setConsentSignedAt('');
    setConsentSignedMethod('');
    setResult(null);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);

    const fd = new FormData(e.currentTarget);
    // Append multi-value services_requested (checkboxes don't auto-append when unchecked)
    fd.delete('servicesRequested');
    for (const svc of servicesRequested) fd.append('servicesRequested', svc);

    startTransition(async () => {
      const r = await submitSchoolReferralAction(fd);
      setResult(r);
      if (r.ok) resetForm();
    });
  };

  if (result?.ok) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">Referral received.</p>
        <p className="mt-1 text-muted-foreground">
          A caseworker will follow up with the family within 1–2 business days. Referral ID:{' '}
          <code className="font-mono text-xs">{result.referralId}</code>
        </p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => setResult(null)}>
          Submit another referral
        </Button>
      </div>
    );
  }

  const consentVersion =
    basis === 'parental_consent'
      ? CURRENT_FERPA_PARENTAL_CONSENT_VERSION
      : CURRENT_FERPA_ELIGIBLE_STUDENT_CONSENT_VERSION;

  const consentText =
    basis === 'parental_consent' ? FERPA_PARENTAL_CONSENT_V1 : FERPA_ELIGIBLE_STUDENT_CONSENT_V1;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* School org selector */}
      {orgs.length > 1 && (
        <div className="space-y-1">
          <Label htmlFor={`${formId}-org`}>School district</Label>
          <select
            id={`${formId}-org`}
            name="partnerOrgId"
            value={partnerOrgId}
            onChange={(e) => setPartnerOrgId(e.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {orgs.length === 1 && <input type="hidden" name="partnerOrgId" value={partnerOrgId} />}

      {/* Authorization basis */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Authorization basis</legend>
        <div className="space-y-2">
          {(
            [
              [
                'mckinney_vento_authorization',
                'McKinney-Vento authorization (student experiencing homelessness — housing-related services)',
              ],
              ['parental_consent', 'Parental / guardian consent'],
              ['eligible_student_consent', 'Eligible student consent (student is 18+)'],
            ] as [BasisValue, string][]
          ).map(([value, label]) => (
            <label key={value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="basis"
                value={value}
                checked={basis === value}
                onChange={() => setBasis(value)}
                disabled={pending}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Basis-specific conditional UI */}
      {basis === 'mckinney_vento_authorization' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/10">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="mvAttestationChecked"
              value="true"
              checked={mvAttested}
              onChange={(e) => setMvAttested(e.target.checked)}
              disabled={pending}
              className="mt-0.5 h-4 w-4 shrink-0"
              required
            />
            <span>
              I attest that this referral falls under McKinney-Vento authorization for
              housing-related services, that the student is currently experiencing homelessness or
              housing instability, and that I am sharing only the minimum information necessary to
              facilitate access to services.
            </span>
          </label>
        </div>
      )}

      {(basis === 'parental_consent' || basis === 'eligible_student_consent') && (
        <div className="space-y-4 rounded-md border border-border p-3">
          {/* Show consent text as read-only reference */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Consent text shown to {basis === 'parental_consent' ? 'parent/guardian' : 'student'}{' '}
              <span className="normal-case font-normal">(version: {consentVersion})</span>
            </p>
            <p className="text-sm text-muted-foreground italic border-l-2 border-border pl-3">
              {consentText.body}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${formId}-consent-date`}>Date consent collected</Label>
              <Input
                id={`${formId}-consent-date`}
                name="consentSignedAt"
                type="date"
                value={consentSignedAt}
                onChange={(e) => setConsentSignedAt(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${formId}-signed-method`}>How was consent collected?</Label>
              <select
                id={`${formId}-signed-method`}
                name="consentSignedMethod"
                value={consentSignedMethod}
                onChange={(e) => setConsentSignedMethod(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select method…</option>
                <option value="in_person">In person</option>
                <option value="phone">Phone</option>
                <option value="web_form">Web form</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Student info */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">
          Student information{' '}
          <span className="font-normal text-muted-foreground text-xs">
            (first initial only — FERPA minimum-necessary)
          </span>
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor={`${formId}-initial`}>First initial</Label>
            <Input
              id={`${formId}-initial`}
              name="studentFirstInitial"
              type="text"
              maxLength={1}
              placeholder="A"
              value={studentFirstInitial}
              onChange={(e) => setStudentFirstInitial(e.target.value.toUpperCase())}
              disabled={pending}
              required
              className="uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${formId}-age`}>
              Age <span className="font-normal text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id={`${formId}-age`}
              name="studentAge"
              type="number"
              min={3}
              max={21}
              step={1}
              value={studentAge}
              onChange={(e) => setStudentAge(e.target.value)}
              disabled={pending}
              placeholder=""
            />
          </div>

          <div className="space-y-1">
            <Label>
              Grade band{' '}
              <span className="font-normal text-muted-foreground text-xs">(optional)</span>
            </Label>
            <div className="flex flex-col gap-1">
              {(['elementary', 'middle', 'high'] as const).map((band) => (
                <label key={band} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="studentGradeBand"
                    value={band}
                    checked={studentGradeBand === band}
                    onChange={() => setStudentGradeBand(band)}
                    disabled={pending}
                    className="h-4 w-4"
                  />
                  {band.charAt(0).toUpperCase() + band.slice(1)}
                </label>
              ))}
              {studentGradeBand && (
                <button
                  type="button"
                  className="self-start text-xs text-muted-foreground underline"
                  onClick={() => setStudentGradeBand('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Guardian info */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Guardian / parent contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${formId}-guardian-name`}>Name</Label>
            <Input
              id={`${formId}-guardian-name`}
              name="guardianName"
              type="text"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              disabled={pending}
              required
              placeholder="Full name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-guardian-contact`}>Phone or email</Label>
            <Input
              id={`${formId}-guardian-contact`}
              name="guardianContact"
              type="text"
              value={guardianContact}
              onChange={(e) => setGuardianContact(e.target.value)}
              disabled={pending}
              required
              placeholder="270-555-0100 or email@example.com"
            />
          </div>
        </div>
      </section>

      {/* Housing situation */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-housing`}>Housing situation</Label>
        <textarea
          id={`${formId}-housing`}
          name="housingSituation"
          rows={3}
          value={housingSituation}
          onChange={(e) => setHousingSituation(e.target.value)}
          disabled={pending}
          required
          maxLength={2000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Brief description of current housing situation (no last name, DOB, or other personally identifiable details beyond what is minimum-necessary)"
        />
      </div>

      {/* Services requested */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Services requested</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {SCHOOL_REFERRAL_SERVICES.map((svc) => (
            <label key={svc} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={svc}
                checked={servicesRequested.has(svc)}
                onChange={() => toggleService(svc)}
                disabled={pending}
                className="h-4 w-4"
              />
              {svc.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </section>

      {/* Urgency */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Urgency</legend>
        <div className="flex gap-4">
          {(['low', 'medium', 'high'] as const).map((u) => (
            <label key={u} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="urgency"
                value={u}
                checked={urgency === u}
                onChange={() => setUrgency(u)}
                disabled={pending}
                className="h-4 w-4"
              />
              {u.charAt(0).toUpperCase() + u.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>

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
          placeholder="Optional context (no individual names or identifiers beyond what is minimum-necessary)"
        />
      </div>

      {result && !result.ok && (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit referral'}
        </Button>
      </div>
    </form>
  );
}
