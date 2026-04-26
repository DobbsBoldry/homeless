'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const fmtTime = (d: Date) => new Intl.DateTimeFormat('en-US', { timeStyle: 'medium' }).format(d);

/**
 * Polls `router.refresh()` every `intervalMs` so a server component
 * page picks up the latest DB state without a manual reload. Pauses
 * automatically when the tab is hidden — staff often park this on a
 * back monitor and we don't want to hammer the DB for invisible tabs.
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());

  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      router.refresh();
      setLastRefreshed(new Date());
    };
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);

  return (
    <span className="text-xs text-muted-foreground">
      Auto-refreshing every {Math.round(intervalMs / 1000)}s · last {fmtTime(lastRefreshed)}
    </span>
  );
}
