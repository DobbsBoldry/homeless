'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Preset = { label: string; params: Record<string, string> };

const PRESETS: Preset[] = [
  { label: 'Open beds now', params: { minFree: '1' } },
  { label: 'Men', params: { population: 'men' } },
  { label: 'Women', params: { population: 'women' } },
  { label: 'Families', params: { population: 'families' } },
  { label: 'Pet-friendly + family', params: { population: 'families', pet: '1' } },
  { label: 'SUD-OK', params: { sud: '1' } },
];

export function BedBoardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const queryId = useId();

  const setParams = (next: Record<string, string | null>) => {
    const usp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') usp.delete(k);
      else usp.set(k, v);
    }
    const qs = usp.toString();
    startTransition(() => {
      router.push(qs ? `/app/coalition/beds?${qs}` : '/app/coalition/beds');
    });
  };

  const applyPreset = (preset: Preset) => {
    // Clear existing scoped params, then set the preset's.
    setParams({
      population: null,
      pet: null,
      sud: null,
      minFree: null,
      ...preset.params,
    });
  };

  const clearAll = () => {
    startTransition(() => router.push('/app/coalition/beds'));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get('q') ?? '').trim();
    setParams({ q: q || null });
  };

  const hasAny = searchParams.toString().length > 0;

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex gap-2">
        <Label htmlFor={queryId} className="sr-only">
          Search shelters
        </Label>
        <Input
          id={queryId}
          name="q"
          defaultValue={searchParams.get('q') ?? ''}
          placeholder="Search shelter or partner name…"
          maxLength={64}
          disabled={pending}
        />
        <Button type="submit" variant="outline" disabled={pending}>
          Search
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = Object.entries(p.params).every(([k, v]) => searchParams.get(k) === v);
          return (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              disabled={pending}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </Button>
          );
        })}
        {hasAny ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={clearAll}
            className="text-muted-foreground"
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
