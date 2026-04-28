'use client';

import { useId, useState, useTransition } from 'react';
import { submitFaithAggregateAction } from '@/app/actions/faith-aggregate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Deep import: 'use client' files are exempt from the barrel rule (ADR 0001 / FND-040b).
// The barrel re-exports server-only code that would break in the client bundle.
import {
  applySuppression,
  FAITH_BREAKOUT_DIMENSIONS,
  FAITH_METRIC_KEYS,
} from '@/lib/dtrs/faith-aggregate';

type MinistryOption = {
  id: string;
  name: string;
  minCellSize: number;
};

type PeriodKind = 'week' | 'month' | 'quarter';

/**
 * Checks whether a raw string value would be suppressed at the given threshold.
 * Returns true if the value is a valid non-negative integer below the threshold.
 * Returns false if the field is empty (not reported), invalid, or passes the threshold.
 */
function wouldBeSupressed(raw: string, threshold: number): boolean {
  if (raw.trim() === '') return false;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return false;
  try {
    return applySuppression(n, threshold).suppressed;
  } catch {
    return false;
  }
}

function SuppressionBadge({ suppressed }: { suppressed: boolean }) {
  if (!suppressed) return null;
  return (
    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
      would be suppressed
    </span>
  );
}

export function FaithAggregateIntakeForm({ ministries }: { ministries: MinistryOption[] }) {
  const formId = useId();
  const [selectedMinistryId, setSelectedMinistryId] = useState(ministries[0]?.id ?? '');
  const [periodKind, setPeriodKind] = useState<PeriodKind>('month');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');

  // metric_key → raw string value entered by user
  const [metricValues, setMetricValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FAITH_METRIC_KEYS.map((k) => [k, ''])),
  );
  // `${dim}_${bucket}` → raw string value
  const [breakoutValues, setBreakoutValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [dim, buckets] of Object.entries(FAITH_BREAKOUT_DIMENSIONS)) {
      for (const bucket of buckets) {
        init[`${dim}_${bucket}`] = '';
      }
    }
    return init;
  });

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { ok: true; submissionId: string; suppressedCount: number }
    | { ok: false; error: string }
    | null
  >(null);

  const selectedMinistry = ministries.find((m) => m.id === selectedMinistryId);
  const threshold = selectedMinistry?.minCellSize ?? 10;

  const resetForm = () => {
    setPeriodStart('');
    setPeriodEnd('');
    setNotes('');
    setMetricValues(Object.fromEntries(FAITH_METRIC_KEYS.map((k) => [k, ''])));
    setBreakoutValues(() => {
      const init: Record<string, string> = {};
      for (const [dim, buckets] of Object.entries(FAITH_BREAKOUT_DIMENSIONS)) {
        for (const bucket of buckets) init[`${dim}_${bucket}`] = '';
      }
      return init;
    });
    setResult(null);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);

    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const r = await submitFaithAggregateAction(fd);
      setResult(r);
      if (r.ok) resetForm();
    });
  };

  if (result?.ok) {
    const { suppressedCount } = result;
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">Submission recorded.</p>
        {suppressedCount > 0 && (
          <p className="mt-1 text-muted-foreground">
            {suppressedCount} cell{suppressedCount === 1 ? '' : 's'} suppressed at the
            ministry&apos;s threshold.
          </p>
        )}
        <Button type="button" variant="outline" className="mt-3" onClick={() => setResult(null)}>
          Enter another submission
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Ministry */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-ministry`}>Ministry</Label>
        <select
          id={`${formId}-ministry`}
          name="ministryId"
          value={selectedMinistryId}
          onChange={(e) => setSelectedMinistryId(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ministries.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} (min cell size: {m.minCellSize})
            </option>
          ))}
        </select>
      </div>

      {/* Period kind */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Period kind</legend>
        <div className="flex gap-4">
          {(['week', 'month', 'quarter'] as PeriodKind[]).map((k) => (
            <label key={k} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="periodKind"
                value={k}
                checked={periodKind === k}
                onChange={() => setPeriodKind(k)}
                disabled={pending}
                className="h-4 w-4"
              />
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Period dates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${formId}-start`}>Period start</Label>
          <Input
            id={`${formId}-start`}
            name="periodStart"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${formId}-end`}>Period end</Label>
          <Input
            id={`${formId}-end`}
            name="periodEnd"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            required
            disabled={pending}
          />
        </div>
      </div>

      {/* Metrics */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Metrics{' '}
          <span className="font-normal text-muted-foreground">
            (leave blank = not reported; 0 = explicitly zero)
          </span>
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {FAITH_METRIC_KEYS.map((key) => {
            const inputId = `${formId}-metric-${key}`;
            const raw = metricValues[key] ?? '';
            const suppressed = wouldBeSupressed(raw, threshold);
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center">
                  <Label htmlFor={inputId} className="text-xs">
                    {key.replace(/_/g, ' ')}
                  </Label>
                  <SuppressionBadge suppressed={suppressed} />
                </div>
                <Input
                  id={inputId}
                  name={`metric_${key}`}
                  type="number"
                  min="0"
                  step="1"
                  value={raw}
                  onChange={(e) => setMetricValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  disabled={pending}
                  placeholder=""
                  className="text-sm"
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Breakouts */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">
          Demographic breakouts{' '}
          <span className="font-normal text-muted-foreground">
            (leave blank = not reported; 0 = explicitly zero)
          </span>
        </h2>
        {(
          Object.entries(FAITH_BREAKOUT_DIMENSIONS) as [
            keyof typeof FAITH_BREAKOUT_DIMENSIONS,
            readonly string[],
          ][]
        ).map(([dim, buckets]) => (
          <div key={dim} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {dim.replace(/_/g, ' ')}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {buckets.map((bucket) => {
                const fieldKey = `${dim}_${bucket}`;
                const inputId = `${formId}-breakout-${fieldKey}`;
                const raw = breakoutValues[fieldKey] ?? '';
                const suppressed = wouldBeSupressed(raw, threshold);
                return (
                  <div key={bucket} className="space-y-1">
                    <div className="flex items-center">
                      <Label htmlFor={inputId} className="text-xs">
                        {bucket.replace(/_/g, ' ')}
                      </Label>
                      <SuppressionBadge suppressed={suppressed} />
                    </div>
                    <Input
                      id={inputId}
                      name={`breakout_${dim}_${bucket}`}
                      type="number"
                      min="0"
                      step="1"
                      value={raw}
                      onChange={(e) =>
                        setBreakoutValues((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                      }
                      disabled={pending}
                      placeholder=""
                      className="text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-notes`}>
          Notes{' '}
          <span className="font-normal text-muted-foreground text-xs">
            (optional — no individual names or identifiers)
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
          placeholder="Optional context about this reporting period (no individual identifiers)"
        />
      </div>

      {result && !result.ok ? <p className="text-sm text-destructive">{result.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit aggregate data'}
        </Button>
      </div>
    </form>
  );
}
