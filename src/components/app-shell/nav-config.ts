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
    label: 'First-time homeless',
    href: '/app/care/first-time-homeless',
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
    label: 'Benefits screener',
    href: '/app/clients/screener',
    roles: ['caseworker', 'shelter_staff', 'admin'],
  },
  {
    label: 'Triage tier',
    href: '/app/clients/triage',
    roles: ['caseworker', 'shelter_staff', 'admin'],
  },
  {
    label: 'Consent link',
    href: '/app/clients/consent-link',
    roles: ['caseworker', 'shelter_staff', 'admin'],
  },
  {
    label: 'Documents',
    href: '/app/clients/documents',
    roles: ['caseworker', 'shelter_staff', 'admin'],
  },
  {
    label: 'Voice intakes',
    href: '/app/clients/intakes',
    roles: ['caseworker', 'shelter_staff', 'admin'],
  },
  {
    label: 'Families with children',
    href: '/app/clients/families',
    roles: ['caseworker', 'admin'],
  },
  {
    label: 'Foster aging-out',
    href: '/app/clients/foster-aging-out',
    roles: ['caseworker', 'admin'],
  },
  {
    label: 'DV survivors',
    href: '/app/clients/dv-survivors',
    roles: ['caseworker', 'admin'],
  },
  {
    label: 'Reentry',
    href: '/app/clients/reentry',
    roles: ['caseworker', 'admin'],
  },
  {
    label: 'Veterans',
    href: '/app/clients/veterans',
    roles: ['caseworker', 'admin'],
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
  {
    label: 'Steering Committee',
    href: '/app/coalition/steering',
    roles: ['attorney', 'caseworker', 'ed_coordinator', 'shelter_staff', 'admin'],
  },
  {
    label: 'Communications',
    href: '/app/coalition/comms',
    roles: ['attorney', 'caseworker', 'ed_coordinator', 'shelter_staff', 'admin'],
  },
  {
    label: 'Frontline Advisory Group',
    href: '/app/coalition/fag',
    roles: ['admin'],
  },
  {
    label: 'Outreach priorities',
    href: '/app/coalition/outreach-priorities',
    roles: ['caseworker', 'admin'],
  },
  {
    label: 'Bed availability',
    href: '/app/coalition/beds',
    roles: ['attorney', 'caseworker', 'ed_coordinator', 'shelter_staff', 'admin'],
  },
  {
    label: 'Update beds',
    href: '/app/coalition/beds/update',
    roles: ['shelter_staff', 'admin'],
  },
  {
    label: 'SMS bed-finder',
    href: '/app/coalition/sms',
    roles: ['admin', 'shelter_staff', 'caseworker', 'ed_coordinator'],
  },
  {
    label: 'SMS metrics',
    href: '/app/coalition/sms/metrics',
    roles: ['admin'],
  },
  {
    label: 'SMS handout',
    href: '/app/coalition/sms/handout',
    roles: ['admin', 'shelter_staff', 'caseworker', 'ed_coordinator'],
  },
  { label: 'Settings', href: '/app/settings', roles: 'all' },
  { label: 'Admin · Users', href: '/app/admin/users', roles: ['admin'] },
  { label: 'Admin · Audit log', href: '/app/admin/audit', roles: ['admin'] },
  { label: 'Admin · Triage overrides', href: '/app/admin/triage-overrides', roles: ['admin'] },
  { label: 'Admin · Agreements', href: '/app/admin/agreements', roles: ['admin'] },
  { label: 'Admin · HUD-VASH vouchers', href: '/app/admin/vouchers', roles: ['admin'] },
  { label: 'Admin · Academic partners', href: '/app/admin/academic-partners', roles: ['admin'] },
  { label: 'Admin · Faith aggregate', href: '/app/admin/faith-aggregate', roles: ['admin'] },
  {
    label: 'Admin · Faith insights',
    href: '/app/admin/faith-aggregate/insights',
    roles: ['admin'],
  },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === 'all' || item.roles.includes(role));
}
