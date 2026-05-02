'use client';

import { useState, useTransition } from 'react';
import {
  markHandoffCompleteAction,
  updatePreReleaseSupportsAction,
} from '@/app/actions/pre-release';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { PreReleaseSupports } from '@/db/schema/pre-release-subjects';
// Deep import: 'use client' files are exempt from the barrel rule (ADR 0001 / FND-040b).
import {
  EMPLOYMENT_PLAN_OPTIONS,
  FAMILY_CONNECTION_OPTIONS,
  HOUSING_INTENT_OPTIONS,
  MEDICAID_STATUS_OPTIONS,
  TREATMENT_CONTINUITY_OPTIONS,
} from '@/lib/subp/pre-release-supports';

interface Props {
  subjectId: string;
  supportsInPlace: PreReleaseSupports;
  alreadyHandedOff: boolean;
}

export function PreReleaseDetailClient({ subjectId, supportsInPlace, alreadyHandedOff }: Props) {
  const [supports, setSupports] = useState<PreReleaseSupports>(supportsInPlace);
  const [handedOff, setHandedOff] = useState(alreadyHandedOff);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmitSupports = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updatePreReleaseSupportsAction(subjectId, fd);
      if (r.ok) {
        setSavedAt(new Date());
      } else {
        setError(r.error);
      }
    });
  };

  const confirmHandoff = () => {
    if (
      !confirm(
        'Confirm warm handoff is complete? This exempts the subject from the daily window-expiration sweep.',
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await markHandoffCompleteAction(subjectId);
      if (r.ok) {
        setHandedOff(true);
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <>
      <section className="rounded-md border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Warm handoff</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Mark when the subject has been successfully handed off to housing / Medicaid /
              employment supports on or near release day. Once marked, the subject is exempt from
              the daily window-expiration sweep (ADR 0009 § 5.1).
            </p>
          </div>
          {handedOff ? (
            <span className="rounded bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
              Handed off
            </span>
          ) : (
            <Button type="button" disabled={pending} onClick={confirmHandoff}>
              {pending ? 'Marking…' : 'Mark handoff complete'}
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold">Supports in place</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          KY DOC&apos;s pre-release plan plus Coalition coordination updates. Notably absent: prior
          offenses, sentence length, disciplinary history (out of scope per ADR 0009 § 2).
        </p>
        <form onSubmit={onSubmitSupports} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Housing intent</Label>
            <select
              name="housing_intent"
              value={supports.housing_intent}
              onChange={(e) =>
                setSupports({
                  ...supports,
                  housing_intent: e.target.value as PreReleaseSupports['housing_intent'],
                })
              }
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {HOUSING_INTENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Employment plan</Label>
            <select
              name="employment_plan"
              value={supports.employment_plan}
              onChange={(e) =>
                setSupports({
                  ...supports,
                  employment_plan: e.target.value as PreReleaseSupports['employment_plan'],
                })
              }
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {EMPLOYMENT_PLAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Medicaid status</Label>
            <select
              name="medicaid_status"
              value={supports.medicaid_status}
              onChange={(e) =>
                setSupports({
                  ...supports,
                  medicaid_status: e.target.value as PreReleaseSupports['medicaid_status'],
                })
              }
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MEDICAID_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Treatment continuity</Label>
            <select
              name="treatment_continuity"
              value={supports.treatment_continuity}
              onChange={(e) =>
                setSupports({
                  ...supports,
                  treatment_continuity: e.target
                    .value as PreReleaseSupports['treatment_continuity'],
                })
              }
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TREATMENT_CONTINUITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Family connection</Label>
            <select
              name="family_connection"
              value={supports.family_connection}
              onChange={(e) =>
                setSupports({
                  ...supports,
                  family_connection: e.target.value as PreReleaseSupports['family_connection'],
                })
              }
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {FAMILY_CONNECTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save supports'}
            </Button>
            {savedAt && (
              <span className="text-xs text-muted-foreground">
                Saved at {savedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
        </form>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
