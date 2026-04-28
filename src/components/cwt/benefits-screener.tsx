'use client';

import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type EligibilityMatch,
  fplPercent,
  type Household,
  screenHousehold,
  totalLikelyMonthlyCents,
} from '@/lib/cwt';

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);

const STATUS_BADGE: Record<EligibilityMatch['status'], string> = {
  likely: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
  maybe: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  ineligible: 'bg-muted text-muted-foreground',
};

export type PrefillSource = {
  /** Field keys that came from an upstream source (intake, etc.) — surface a small badge. */
  fields: ReadonlyArray<keyof Household>;
  /** Short label shown next to each prefilled field, e.g. "from intake". */
  label: string;
};

const DEFAULT_HOUSEHOLD: Household = {
  monthlyIncomeCents: 100_000,
  householdSize: 1,
  hasChildrenUnder18: false,
  hasPregnantMember: false,
  isVeteran: false,
  isDisabled: false,
  ageOldest: 35,
  kyResident: true,
  citizenOrQualified: true,
};

export function BenefitsScreener({
  initialHousehold,
  prefillSource,
  contextNote,
}: {
  initialHousehold?: Partial<Household>;
  prefillSource?: PrefillSource;
  /** Free-form note shown above the form (e.g. the intake's income_summary). */
  contextNote?: string | null;
} = {}) {
  const incomeId = useId();
  const sizeId = useId();
  const [household, setHousehold] = useState<Household>({
    ...DEFAULT_HOUSEHOLD,
    ...initialHousehold,
  });
  const prefillKeys = new Set(prefillSource?.fields ?? []);
  const prefillLabel = prefillSource?.label ?? 'prefilled';

  const results = useMemo(() => screenHousehold(household), [household]);
  const totalLikely = useMemo(() => totalLikelyMonthlyCents(results), [results]);
  const fplPct = useMemo(
    () => fplPercent(household.monthlyIncomeCents, household.householdSize),
    [household.monthlyIncomeCents, household.householdSize],
  );

  const set =
    <K extends keyof Household>(key: K) =>
    (value: Household[K]) => {
      setHousehold((prev) => ({ ...prev, [key]: value }));
    };

  const PrefillBadge = ({ k }: { k: keyof Household }) =>
    prefillKeys.has(k) ? (
      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
        {prefillLabel}
      </span>
    ) : null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-4">
        <h2 className="font-serif text-lg font-semibold">Household</h2>

        {contextNote ? (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
            <p className="font-medium uppercase tracking-wide text-primary">
              From the intake transcript
            </p>
            <p className="mt-1 text-muted-foreground">{contextNote}</p>
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor={incomeId}>
            Monthly income (gross, before deductions)
            <PrefillBadge k="monthlyIncomeCents" />
          </Label>
          <Input
            id={incomeId}
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            value={Math.round(household.monthlyIncomeCents / 100)}
            onChange={(e) => {
              const dollars = Number.parseInt(e.target.value, 10);
              set('monthlyIncomeCents')(Number.isFinite(dollars) ? Math.max(0, dollars) * 100 : 0);
            }}
          />
          <p className="text-xs text-muted-foreground">{fplPct}% of the federal poverty line</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor={sizeId}>
            Household size
            <PrefillBadge k="householdSize" />
          </Label>
          <Input
            id={sizeId}
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={household.householdSize}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isInteger(n) && n >= 1 && n <= 20) set('householdSize')(n);
            }}
          />
        </div>

        <div className="space-y-1">
          <Label>Age of the oldest member</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={household.ageOldest ?? ''}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              set('ageOldest')(Number.isInteger(n) ? n : null);
            }}
          />
        </div>

        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Situation</legend>
          {[
            { k: 'hasChildrenUnder18', label: 'Children under 18 in household' },
            { k: 'hasPregnantMember', label: 'Pregnant member' },
            { k: 'isVeteran', label: 'Veteran' },
            { k: 'isDisabled', label: 'Disabled or qualifying medical condition' },
            { k: 'kyResident', label: 'Kentucky resident' },
            {
              k: 'citizenOrQualified',
              label: 'US citizen OR qualified non-citizen (LPR 5+ yrs, refugee, etc.)',
            },
          ].map(({ k, label }) => (
            <label
              key={k}
              className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-muted/40"
            >
              <input
                type="checkbox"
                checked={Boolean(household[k as keyof Household])}
                onChange={(e) => {
                  setHousehold((prev) => ({ ...prev, [k]: e.target.checked }));
                }}
                className="h-4 w-4"
              />
              {label}
              <PrefillBadge k={k as keyof Household} />
            </label>
          ))}
        </fieldset>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setHousehold({ ...DEFAULT_HOUSEHOLD })}
        >
          Reset
        </Button>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-lg font-semibold">Likely benefits</h2>
          {totalLikely > 0 ? (
            <p className="text-sm">
              Estimated <strong>{fmtMoney(totalLikely)}/mo</strong>
            </p>
          ) : null}
        </div>
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.programId} className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{r.programName}</p>
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[r.status]}`}>
                  {r.status}
                </span>
              </div>
              {r.estimatedMonthlyCents !== null ? (
                <p className="mt-1 text-base font-semibold">
                  ~{fmtMoney(r.estimatedMonthlyCents)}/mo
                </p>
              ) : null}
              <p className="mt-1 text-muted-foreground">{r.reason}</p>
              {r.status !== 'ineligible' ? (
                <p className="mt-2 text-xs">{r.applicationPath}</p>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <p className="font-medium">[SAMPLE] estimates only.</p>
          <p className="mt-1 text-muted-foreground">
            Income thresholds and benefit amounts are based on 2024 federal poverty figures and
            published KY program rules. Actual benefits depend on disregards, deductions, household
            composition, and current funding. Use these as a starting point — verify with the
            program before quoting an amount to a client.
          </p>
        </div>
      </section>
    </div>
  );
}
