'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { NavItem } from './nav-config';
import { Sidebar } from './sidebar';

/**
 * Mobile-only navigation drawer. Built on shadcn Sheet (Base UI Dialog) so
 * focus trap, focus restore, ESC-close, click-outside-close, and `inert`
 * siblings are handled by the primitive — no hand-rolled keyboard plumbing.
 *
 * Auto-closes on route change because each nav <Link> click triggers a
 * client-side navigation, which Base UI Dialog ignores; we use `controlled`
 * state and clear it from the parent of each link via the global onClick.
 */
export function MobileNav({ items, brand }: { items: NavItem[]; brand: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="sm" aria-label="Open navigation" className="md:hidden">
            ☰
          </Button>
        }
      />
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Primary navigation</SheetTitle>
          <SheetDescription>Choose a section to navigate to.</SheetDescription>
        </SheetHeader>
        <div onClickCapture={() => setOpen(false)}>
          <Sidebar items={items} brand={brand} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
