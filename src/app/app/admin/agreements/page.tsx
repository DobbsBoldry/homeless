import Link from 'next/link';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const AGREEMENTS = [
  {
    label: 'OASIS DSA',
    href: '/app/admin/agreements/oasis',
    description:
      'Data-sharing agreement with OASIS shelter for the DV survivor pathway (abuser-blind disclosure, § 40002 VAWA).',
  },
  {
    label: 'DCBS DSA',
    href: '/app/admin/agreements/dcbs',
    description:
      'Data-sharing agreement with the Cabinet for Health & Family Services for foster aging-out and TEAMKY referrals.',
  },
  {
    label: 'School FERPA',
    href: '/app/admin/agreements/ferpa',
    description:
      'Partner agreements with school districts under FERPA § 99.31 / McKinney-Vento for liaison referrals.',
  },
  {
    label: 'MOU',
    href: '/app/admin/agreements/mou',
    description:
      'General coalition memoranda of understanding (Steering Committee, faith-aggregate intake, ED super-utilizer pilot).',
  },
];

export default async function AgreementsHubPage() {
  await requireRole(['admin']);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Partner agreements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record, renew, and monitor expiration of the four agreement kinds that gate cross-partner
          data flow on the platform.
        </p>
      </header>
      <ul className="space-y-3">
        {AGREEMENTS.map((a) => (
          <li
            key={a.href}
            className="rounded-md border border-border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <Link href={a.href} className="block">
              <div className="font-semibold text-primary">{a.label} →</div>
              <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
