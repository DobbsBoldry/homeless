import Link from 'next/link';
import { getActiveCommsAdvisory } from '@/db/queries/comms-advisories';

/**
 * App-wide banner that surfaces the currently-active comms advisory
 * (OPRT-010). Renders nothing when no advisory is active. Server
 * component — fresh on every page render so a newly-posted advisory
 * appears immediately.
 */
export async function CommsAdvisoryBanner() {
  const active = await getActiveCommsAdvisory();
  if (!active) return null;

  return (
    <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="font-semibold text-destructive">Comms advisory active:</span>{' '}
          <span>{active.title}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            spokesperson: {active.spokespersonName}
          </span>
        </p>
        <Link
          href="/app/coalition/comms"
          className="text-xs text-destructive underline hover:text-destructive/80"
        >
          See statement →
        </Link>
      </div>
    </div>
  );
}
