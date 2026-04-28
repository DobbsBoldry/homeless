'use client';

import { useState, useTransition } from 'react';
import {
  draftMedicaidExtensionAction,
  recordDecisionAction,
  submitMedicaidExtensionAction,
  withdrawMedicaidExtensionAction,
} from '@/app/actions/medicaid-extension';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MedicaidExtensionPayload } from '@/db/schema/medicaid-extension-applications';
// Deep import: 'use client' files are exempt from the barrel rule.
import { EMPLOYMENT_STATUS_OPTIONS, STUDENT_STATUS_OPTIONS } from '@/lib/subp/medicaid-extension';

interface ApplicationView {
  id: string;
  status: string;
  payload: MedicaidExtensionPayload;
  kynectReference: string | null;
  draftedAt: string;
  submittedAt: string | null;
  decisionAt: string | null;
  decisionReason: string | null;
  withdrawnAt: string | null;
}

interface Props {
  youthId: string;
  youthName: string;
  dcbsCaseId: string;
  applications: ApplicationView[];
}

const STATUS_BADGE: Record<string, string> = {
  drafted: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  denied: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  withdrawn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
};

export function MedicaidExtensionPanel({ youthId, youthName, dcbsCaseId, applications }: Props) {
  const latest = applications[0];
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDraftForm, setShowDraftForm] = useState(applications.length === 0);

  const onDraft = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await draftMedicaidExtensionAction(youthId, fd);
      if (!r.ok) setError(r.error);
      else setShowDraftForm(false);
    });
  };

  const onSubmit = (applicationId: string) => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      // Synthetic kynect reference for the seed.
      fd.set('kynect_reference', `KYNECT-SYNTH-${dcbsCaseId}`);
      const r = await submitMedicaidExtensionAction(applicationId, fd);
      if (!r.ok) setError(r.error);
    });
  };

  const onDecide = (applicationId: string, outcome: 'approved' | 'denied') => {
    setError(null);
    const reason = window.prompt(
      `Reason for ${outcome === 'approved' ? 'approval' : 'denial'} (optional)?`,
      '',
    );
    startTransition(async () => {
      const fd = new FormData();
      if (reason) fd.set('decision_reason', reason);
      const r = await recordDecisionAction(applicationId, outcome, fd);
      if (!r.ok) setError(r.error);
    });
  };

  const onWithdraw = (applicationId: string) => {
    setError(null);
    const reason = window.prompt('Reason for withdrawal?', '');
    if (reason === null) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('withdraw_reason', reason);
      const r = await withdrawMedicaidExtensionAction(applicationId, fd);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold">
          {latest ? 'Latest application' : 'No application on file'}
        </h2>

        {latest ? (
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[latest.status] ?? ''}`}
              >
                {latest.status}
              </span>
              <span className="text-xs text-muted-foreground">
                drafted {new Date(latest.draftedAt).toLocaleString()}
              </span>
            </div>

            {latest.kynectReference && (
              <p className="text-xs">
                kynect: <code className="font-mono">{latest.kynectReference}</code>
              </p>
            )}

            {latest.submittedAt && (
              <p className="text-xs text-muted-foreground">
                submitted {new Date(latest.submittedAt).toLocaleString()}
              </p>
            )}

            {latest.decisionAt && (
              <p className="text-xs">
                <span className="font-medium">decision:</span>{' '}
                {new Date(latest.decisionAt).toLocaleDateString()}
                {latest.decisionReason && ` — ${latest.decisionReason}`}
              </p>
            )}

            {latest.withdrawnAt && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                withdrawn {new Date(latest.withdrawnAt).toLocaleDateString()}
                {latest.decisionReason && ` — ${latest.decisionReason}`}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {latest.status === 'drafted' && (
                <>
                  <Button type="button" onClick={() => onSubmit(latest.id)} disabled={pending}>
                    Submit to kynect
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onWithdraw(latest.id)}
                    disabled={pending}
                  >
                    Withdraw draft
                  </Button>
                </>
              )}
              {latest.status === 'submitted' && (
                <>
                  <Button
                    type="button"
                    onClick={() => onDecide(latest.id, 'approved')}
                    disabled={pending}
                  >
                    Record approval
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onDecide(latest.id, 'denied')}
                    disabled={pending}
                  >
                    Record denial
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onWithdraw(latest.id)}
                    disabled={pending}
                  >
                    Withdraw
                  </Button>
                </>
              )}
              {(latest.status === 'denied' || latest.status === 'approved') && !showDraftForm && (
                <Button type="button" variant="outline" onClick={() => setShowDraftForm(true)}>
                  Start a new application
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Draft an application below to start the TEAMKY extension process for {youthName}.
          </p>
        )}
      </section>

      {showDraftForm && (
        <section className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Draft a new application</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pre-filled where possible from the foster_youth record. Caseworker confirms eligibility
            answers; submit goes to kynect.
          </p>
          <form onSubmit={onDraft} className="mt-4 space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">In foster care in KY at 18? *</legend>
              <div className="flex gap-4 text-sm">
                {(['true', 'false'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="in_foster_care_at_18"
                      value={v}
                      defaultChecked={v === 'true'}
                      disabled={pending}
                    />
                    {v === 'true' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Student status</Label>
                <select
                  name="student_status"
                  defaultValue="unknown"
                  disabled={pending}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STUDENT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Employment status</Label>
                <select
                  name="employment_status"
                  defaultValue="unknown"
                  disabled={pending}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {EMPLOYMENT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="addr">Current address (synthetic) *</Label>
              <Input
                id="addr"
                name="current_address_synthetic"
                type="text"
                required
                disabled={pending}
                placeholder="e.g. 123 Synthetic Lane, Owensboro, KY"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Notes (no PHI)</Label>
              <textarea
                id="notes"
                name="caseworker_notes"
                rows={3}
                disabled={pending}
                maxLength={2000}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Optional caseworker context"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save draft'}
              </Button>
              {applications.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDraftForm(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {applications.length > 1 && (
        <section className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">
            Earlier applications ({applications.length - 1})
          </h2>
          <ul className="mt-3 space-y-1 text-xs">
            {applications.slice(1).map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-medium ${STATUS_BADGE[a.status] ?? ''}`}
                >
                  {a.status}
                </span>
                <span className="text-muted-foreground">
                  drafted {new Date(a.draftedAt).toLocaleDateString()}
                </span>
                {a.decisionReason && (
                  <span className="text-muted-foreground">— {a.decisionReason}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
