'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from './nav-config';

export function Sidebar({ items, brand }: { items: NavItem[]; brand: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="flex h-full flex-col gap-2 border-r border-sidebar-border bg-sidebar p-4"
    >
      <div className="px-2 pb-4">
        <div className="font-serif text-lg font-bold text-primary leading-none">{brand}</div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-sidebar-foreground/70">
          Coalition Platform
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/app' && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
