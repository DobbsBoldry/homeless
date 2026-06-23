import { PartnerInviteAdmin } from '@/components/dtrs/partner-invite-admin';
import { listAcademicPartners, listPartnerInvitations } from '@/db/queries/partner-invitations';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AcademicPartnersAdminPage() {
  await requireRole(['admin']);
  const [invitations, partners] = await Promise.all([
    listPartnerInvitations(),
    listAcademicPartners(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Academic partners</h1>
        <p className="text-sm text-muted-foreground">
          Invite external academic partners (DTRS-014a-1). The <code>academic_partner</code> role is
          read-only and reaches only aggregate, de-identified surfaces — every individual-record
          route denies it. Invitations are single-use and expire after 7 days; revoking an invite or
          a partner's role takes effect immediately.
        </p>
      </header>
      <PartnerInviteAdmin
        invitations={invitations.map((i) => ({
          id: i.id,
          invitedEmail: i.invitedEmail,
          expiresAt: i.expiresAt.toISOString(),
          redeemedAt: i.redeemedAt ? i.redeemedAt.toISOString() : null,
          revokedAt: i.revokedAt ? i.revokedAt.toISOString() : null,
        }))}
        partners={partners.map((p) => ({ id: p.id, email: p.email }))}
      />
    </div>
  );
}
