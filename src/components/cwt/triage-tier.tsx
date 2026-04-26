'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import { recordTriageOverrideAction } from '@/app/actions/triage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { recommendTriageTier, type TriageInputs, type TriageTier } from '@/lib/cwt/triage';

const TIER_BADGE: Record<TriageTier, string> = {
  high: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  low: 'bg-destructive/15 text-destructive',
};

const TIER_LABEL: Record<TriageTier, string> = {
  high: 'High potential',
  medium: 'Medium potential',
  low: 'High intensity needed',
};

const FIELDS: Array<{ k: keyof TriageInputs; label: string; type: 'bool' | 'count' }> = [
  {
    k: 'hasStableIncome',
    label: 'Stable income source (job, SSI, retirement, etc.)',
    type: 'bool',
  },
  { k: 'hasVoucher', label: 'Active rental-assistance voucher', type: 'bool' },
  { k: 'isEmployed', label: 'Currently employed (any hours)', type: 'bool' },
  { k: 'hasCaseworkerRelationship', label: 'Existing caseworker relationship', type: 'bool' },
  { k: 'inSudTreatment', label: 'Engaged in SUD treatment (when relevant)', type: 'bool' },
  { k: 'inMentalHealthTreatment', label: 'Engaged in mental-health treatment', type: 'bool' },
  { k: 'recentEvictionCount', label: 'Evictions in last 24 months', type: 'count' },
  { k: 'daysUnsheltered', label: 'Days unsheltered in last 12 months', type: 'count' },
  { k: 'hasChildrenUnder18', label: 'Children under 18 in household', type: 'bool' },
  { k: 'isDvSurvivor', label: 'DV survivor (routing only — no scoring impact)', type: 'bool' },
  { k: 'hasId', label: 'Has photo ID', type: 'bool' },
  { k: 'hasSsn', label: 'Has Social Security card', type: 'bool' },
  { k: 'hasBirthCert', label: 'Has birth certificate', type: 'bool' },
];

const blankInputs = (): TriageInputs => ({
  hasStableIncome: false,
  hasVoucher: false,
  isEmployed: false,
  hasCaseworkerRelationship: false,
  inSudTreatment: false,
  inMentalHealthTreatment: false,
  recentEvictionCount: 0,
  daysUnsheltered: 0,
  hasChildrenUnder18: false,
  isDvSurvivor: false,
  hasId: false,
  hasSsn: false,
  hasBirthCert: false,
});

export function TriageTierTool() {
  const [inputs, setInputs] = useState<TriageInputs>(() => blankInputs());
  const result = useMemo(() => recommendTriageTier(inputs), [inputs]);
  const [chosen, setChosen] = useState<TriageTier | null>(null);
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [recordError, setRecordError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<{ at: Date; isOverride: boolean } | null>(null);
  const reasonId = useId();

  const submit = (chosenTier: TriageTier) => {
    setRecordError(null);
    setChosen(chosenTier);
    const isOverride = chosenTier !== result.tier;
    if (isOverride && reason.trim().length === 0) {
      setRecordError('Please write a brief reason for the override.');
      return;
    }
    startTransition(async () => {
      const r = await recordTriageOverrideAction(inputs, chosenTier, reason || null);
      if (!r.ok) {
        setRecordError(r.error);
        return;
      }
      setSavedAt({ at: new Date(), isOverride: r.isOverride });
      setReason('');
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold">Stability factors</h2>
        <ul className="space-y-1">
          {FIELDS.map(({ k, label, type }) => (
            <li key={k} className="rounded p-1.5 hover:bg-muted/40">
              {type === 'bool' ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(inputs[k])}
                    onChange={(e) =>
                      setInputs((prev) => ({ ...prev, [k]: e.target.checked }) as TriageInputs)
                    }
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ) : (
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span>{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={inputs[k] as number}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setInputs(
                        (prev) =>
                          ({ ...prev, [k]: Number.isInteger(n) && n >= 0 ? n : 0 }) as TriageInputs,
                      );
                    }}
                    className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => setInputs(blankInputs())}>
          Reset
        </Button>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-lg font-semibold">Recommendation</h2>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${TIER_BADGE[result.tier]}`}>
            {TIER_LABEL[result.tier]}
          </span>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
          <p className="text-3xl font-semibold">{result.score} / 100</p>
          <p className="mt-3 text-sm">{result.recommendation}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Factors</p>
          <ul className="mt-1 space-y-1 text-sm">
            {result.factors.length === 0 ? (
              <li className="text-muted-foreground">No factors triggered yet.</li>
            ) : (
              result.factors.map((f) => (
                <li key={f.label} className="flex items-baseline justify-between gap-2">
                  <span>{f.label}</span>
                  <span
                    className={`font-mono text-xs ${
                      f.delta > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : f.delta < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {f.delta > 0 ? `+${f.delta}` : f.delta}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <p className="font-medium">Rule-based v1.</p>
          <p className="mt-1 text-muted-foreground">
            Tier comes from a transparent additive score. Phase 2 replaces this with an ML model
            trained on labeled outcomes from the pilot. Confirm or override below — both go into the
            audit trail and become training data.
          </p>
        </div>

        <div className="space-y-3 rounded-md border border-border bg-card p-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Record your decision
          </p>
          {savedAt ? (
            <p className="text-emerald-700 dark:text-emerald-400">
              {savedAt.isOverride ? 'Override' : 'Confirmation'} saved at{' '}
              {new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(savedAt.at)}.
            </p>
          ) : null}
          <div>
            <Label htmlFor={reasonId} className="text-xs uppercase tracking-wide">
              Reason (required when overriding)
            </Label>
            <Input
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={280}
              placeholder="e.g. recent eviction not in record yet"
              disabled={pending}
            />
          </div>
          {recordError ? <p className="text-xs text-destructive">{recordError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={chosen === result.tier ? 'default' : 'outline'}
              disabled={pending}
              onClick={() => submit(result.tier)}
            >
              Confirm {TIER_LABEL[result.tier]}
            </Button>
            {(['high', 'medium', 'low'] as const)
              .filter((t) => t !== result.tier)
              .map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => submit(t)}
                >
                  Override → {TIER_LABEL[t]}
                </Button>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
