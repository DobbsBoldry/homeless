import { UsersTable } from '@/components/admin/users-table';
import { listUsersForAdmin } from '@/db/queries/users';
import { requireRole } from '@/lib/auth';

export default async function AdminUsersPage() {
  const me = await requireRole(['admin']);
  const rows = await listUsersForAdmin();

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Users</h1>
        <p className="text-sm text-muted-foreground">
          Promote a user to KLA attorney (sets role + adds membership in one step) or demote back to
          pending. Every change is recorded in the audit log.
        </p>
      </header>
      <UsersTable rows={rows} currentUserId={me.id} />
    </div>
  );
}
