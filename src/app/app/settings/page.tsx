import { EmptyPage } from '@/components/app-shell/empty-page';
import { requireUser } from '@/lib/auth';

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <EmptyPage title="Settings" ships="Phase 1 (FND-008 — partner orgs + role management)">
      <ul className="space-y-1 text-muted-foreground">
        <li>
          Email: <code className="font-mono">{user.email}</code>
        </li>
        <li>
          Role: <code className="font-mono">{user.role}</code>
        </li>
        <li>
          Member since:{' '}
          <code className="font-mono">{user.createdAt.toISOString().slice(0, 10)}</code>
        </li>
      </ul>
    </EmptyPage>
  );
}
