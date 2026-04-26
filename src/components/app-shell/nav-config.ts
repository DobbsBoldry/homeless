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
  { label: 'Settings', href: '/app/settings', roles: 'all' },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === 'all' || item.roles.includes(role));
}
