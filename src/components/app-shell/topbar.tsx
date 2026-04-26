'use client';

import { UserButton } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { ThemeToggle } from './theme-toggle';

export function Topbar({ menuButton }: { menuButton?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-2">
        {menuButton}
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {/* TODO: org switcher placeholder — wired in Phase 1 (multi-org coalition) */}
          Daviess County, KY
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserButton />
      </div>
    </header>
  );
}
