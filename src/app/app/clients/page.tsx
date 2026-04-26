import { EmptyPage } from '@/components/app-shell/empty-page';
import { requireRole } from '@/lib/auth';

export default async function ClientsPage() {
  await requireRole(['caseworker', 'ed_coordinator', 'shelter_staff', 'admin']);
  return (
    <EmptyPage
      title="Clients"
      ships="Phase 1 (CWT and ESUC epics — caseworker tools, ED super-utilizer)"
    >
      Clients will be the unified person record across eviction defense, ED care coordination, and
      shelter-bed routing — gated behind PHI consent + BAA.
    </EmptyPage>
  );
}
