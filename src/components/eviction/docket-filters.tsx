import Link from 'next/link';
import type { EvictionCauseType, EvictionFilingStatus } from '@/db/schema/enums';

const STATUSES: EvictionFilingStatus[] = ['filed', 'served', 'judgment', 'dismissed', 'sealed'];
const CAUSES: EvictionCauseType[] = ['non_payment', 'lease_violation', 'holdover', 'other'];

const causeLabel: Record<EvictionCauseType, string> = {
  non_payment: 'Non-payment',
  lease_violation: 'Lease violation',
  holdover: 'Holdover',
  other: 'Other',
};

export interface DocketFilterValues {
  search?: string;
  status?: EvictionFilingStatus;
  cause?: EvictionCauseType;
  minScore?: number;
}

const isFiltered = (v: DocketFilterValues) =>
  Boolean(v.search || v.status || v.cause || typeof v.minScore === 'number');

export function DocketFilters({ values }: { values: DocketFilterValues }) {
  return (
    <form
      action="/app/cases/queue"
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-3 text-sm"
      aria-label="Filter docket"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Search</span>
        <input
          name="search"
          type="search"
          defaultValue={values.search ?? ''}
          placeholder="Case # or plaintiff…"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Search by case number or plaintiff"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
        <select
          name="status"
          defaultValue={values.status ?? ''}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Any</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Cause</span>
        <select
          name="cause"
          defaultValue={values.cause ?? ''}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Any</option>
          {CAUSES.map((c) => (
            <option key={c} value={c}>
              {causeLabel[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Min score</span>
        <input
          name="min_score"
          type="number"
          min={0}
          max={100}
          defaultValue={values.minScore ?? ''}
          placeholder="0–100"
          className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        {isFiltered(values) ? (
          <Link href="/app/cases/queue" className="text-xs text-muted-foreground hover:underline">
            Reset
          </Link>
        ) : null}
      </div>
    </form>
  );
}
