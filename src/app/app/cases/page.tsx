import { EmptyPage } from '@/components/app-shell/empty-page';
import { requireRole } from '@/lib/auth';

export default async function CasesPage() {
  await requireRole(['attorney', 'caseworker', 'admin']);
  return (
    <EmptyPage title="Cases" ships="Phase 1 (EVDT epic — eviction-defense triage)">
      Cases will surface eviction filings, court dates, response packets, and case-status updates
      for attorneys and caseworkers.
    </EmptyPage>
  );
}
