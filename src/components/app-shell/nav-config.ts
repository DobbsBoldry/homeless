import type { UserRole } from '@/db/schema/enums';

export type NavItem = {
  label: string;
  href: string;
  roles: UserRole[] | 'all';
};

/**
 * Top-level nav items for the protected app shell.
 * `roles: 'all'` shows the item to every signed-in user.
 * Add a domain item here when its surface ships in Phase 1+.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/app/dashboard', roles: 'all' },
  {
    label: 'Daily queue',
    href: '/app/cases/queue',
    // KLA-only by membership; the page itself enforces requireKlaAttorney().
    // Sidebar shows it to all attorneys; non-KLA attorneys would 404 on click.
    roles: ['attorney'],
  },
  {
    label: 'Care queue',
    href: '/app/care/queue',
    roles: ['ed_coordinator', 'admin'],
  },
  {
    label: 'Filings',
    href: '/app/cases/filings',
    roles: ['attorney', 'caseworker', 'admin'],
  },
  {
    label: 'Cases',
    href: '/app/cases',
    roles: ['attorney', 'caseworker', 'admin'],
  },
  {
    label: 'Clients',
    href: '/app/clients',
    roles: ['caseworker', 'ed_coordinator', 'shelter_staff', 'admin'],
  },
  {
    label: 'Outcomes',
    href: '/app/metrics',
    roles: ['attorney', 'admin'],
  },
  { label: 'Coalition', href: '/app/coalition', roles: 'all' },
  {
    label: 'Coordination',
    href: '/app/coalition/coordination',
    roles: ['attorney', 'caseworker', 'ed_coordinator', 'shelter_staff', 'admin'],
  },
  { label: 'Settings', href: '/app/settings', roles: 'all' },
  { label: 'Admin · Users', href: '/app/admin/users', roles: ['admin'] },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === 'all' || item.roles.includes(role));
}
