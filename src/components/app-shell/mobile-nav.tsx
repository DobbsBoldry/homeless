'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { NavItem } from './nav-config';
import { Sidebar } from './sidebar';

export function MobileNav({ items, brand }: { items: NavItem[]; brand: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        ☰
      </Button>

      {open && (
        <div
          id="mobile-nav-drawer"
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Primary navigation"
        >
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 h-full w-full bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-72 max-w-[80vw] bg-sidebar shadow-xl">
            <Sidebar items={items} brand={brand} />
          </div>
        </div>
      )}
    </>
  );
}
