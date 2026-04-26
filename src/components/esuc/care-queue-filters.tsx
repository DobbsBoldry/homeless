import Link from 'next/link';
import type { HousingStatus } from '@/db/schema/enums';

// Only the housing-instability statuses appear in the strict
// super-utilizer flag list (`housed` and `unknown` are excluded by
// design — see HOUSING_INSTABILITY_FLAGS in super-utilizer-ranking.ts).
// We don't expose them as filter chips because toggling them would
// always produce zero results.
const HOUSING_OPTIONS: HousingStatus[] = ['shelter', 'unsheltered', 'doubled_up'];

export interface CareQueueFilterValues {
  minVisits?: number;
  housingStatuses?: HousingStatus[];
}

const isFiltered = (v: CareQueueFilterValues) =>
  Boolean(typeof v.minVisits === 'number' || (v.housingStatuses && v.housingStatuses.length > 0));

export function CareQueueFilters({ values }: { values: CareQueueFilterValues }) {
  const checked = new Set(values.housingStatuses ?? []);
  return (
    <form
      action="/app/care/queue"
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-3 text-sm"
      aria-label="Filter care queue"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Min visits</span>
        <input
          name="min_visits"
          type="number"
          min={1}
          max={50}
          defaultValue={values.minVisits ?? ''}
          placeholder="3"
          className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm"
        />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs uppercase tracking-wide text-muted-foreground">
          Housing status
        </legend>
        <div className="flex flex-wrap gap-2">
          {HOUSING_OPTIONS.map((s) => (
            <label
              key={s}
              className="flex items-center gap-1 text-xs rounded-full border border-border px-2 py-1 hover:bg-muted"
            >
              <input
                type="checkbox"
                name="housing_status"
                value={s}
                defaultChecked={checked.has(s)}
                className="accent-primary"
              />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        {isFiltered(values) ? (
          <Link href="/app/care/queue" className="text-xs text-muted-foreground hover:underline">
            Reset
          </Link>
        ) : null}
      </div>
    </form>
  );
}
