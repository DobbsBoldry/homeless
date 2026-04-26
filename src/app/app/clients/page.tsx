import { EmptyPage } from '@/components/app-shell/empty-page';

export default function ClientsPage() {
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
