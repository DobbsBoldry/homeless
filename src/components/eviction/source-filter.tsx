import Link from 'next/link';
import type { EvictionFilingSource } from '@/db/schema/enums';

const PILLS: Array<{ label: string; value?: EvictionFilingSource }> = [
  { label: 'All', value: undefined },
  { label: 'Synthetic', value: 'synthetic' },
  { label: 'CourtNet', value: 'courtnet' },
  { label: 'Manual', value: 'manual' },
];

export function SourceFilter({ selected }: { selected?: EvictionFilingSource }) {
  return (
    <nav className="flex gap-2" aria-label="Filter by source">
      {PILLS.map((p) => {
        const active = p.value === selected;
        const href = p.value ? `/app/cases/filings?source=${p.value}` : '/app/cases/filings';
        return (
          <Link
            key={p.label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
