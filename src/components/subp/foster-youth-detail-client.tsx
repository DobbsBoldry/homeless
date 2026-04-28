'use client';

import { useState, useTransition } from 'react';
import {
  acknowledgeAlertAction,
  updateSupportsInPlaceAction,
} from '@/app/actions/foster-aging-out';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { SupportsInPlace } from '@/db/schema/foster-youth';
// Deep import: 'use client' files are exempt from the barrel rule (ADR 0001 / FND-040b).
import {
  EDUCATION_OPTIONS,
  EMPLOYMENT_OPTIONS,
  HOUSING_PLAN_OPTIONS,
  MEDICAID_OPTIONS,
} from '@/lib/subp/supports-in-place';

interface AlertView {
  id: string;
  milestone: string;
  firedAt: string;
  acknowledgedAt: string | null;
}

interface Props {
  youthId: string;
  supportsInPlace: SupportsInPlace;
  alerts: AlertView[];
}

export function FosterYouthDetailClient({ youthId, supportsInPlace, alerts }: Props) {
  const [supports, setSupports] = useState<SupportsInPlace>(supportsInPlace);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmitSupports = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateSupportsInPlaceAction(youthId, fd);
      if (r.ok) {
        setSavedAt(new Date());
      } else {
        setError(r.error);
      }
    });
  };

  const ackAlert = (alertId: string) => {
    startTransition(async () => {
      const r = await acknowledgeAlertAction(alertId);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <>
      <section className="rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold">Supports in place</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Mirrors the four Chafee independent-living planning categories.
        </p>
        <form onSubmit={onSubmitSupports} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Housing plan</Label>
            <select
              name="housing_plan"
              value={supports.housing_plan}
              onChange={(e) =>
                setSupports({
                  ...supports,
                  housing_plan: e.target.value as SupportsInPlace['housing_plan'],
                })
              }
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {HOUSING_PLAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Medicaid extension (TEAMKY)</Label>
            <select
              name="medicaid_extension"
              value={supports.medicaid_extension}
              onChange={(e) =>
                setSupports({
                  ...supports,
                  medicaid_extension: e.target.value as SupportsInPlace['medicaid_extension'],
                })
              }
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MEDICAID_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Education plan</Label>
            <select
              name="education_plan"
              value={supports.education_plan}
              onChange={(e) =>
                setSupports({
                  ...supports,
                  education_plan: e.target.value as SupportsInPlace['education_plan'],
                })
              }
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {EDUCATION_OPTIONS.map((o) => (
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
                  employment_plan: e.target.value as SupportsInPlace['employment_plan'],
                })
              }
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {EMPLOYMENT_OPTIONS.map((o) => (
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

      <section className="rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold">Milestone alerts</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No alerts fired yet — the nightly milestone scan will populate this.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border bg-muted/10 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-mono uppercase text-xs">{a.milestone}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    fired {new Date(a.firedAt).toLocaleString()}
                  </span>
                </div>
                {a.acknowledgedAt ? (
                  <span className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400">
                    ack {new Date(a.acknowledgedAt).toLocaleDateString()}
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => ackAlert(a.id)}
                  >
                    Acknowledge
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
