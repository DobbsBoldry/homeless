import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="font-serif text-3xl font-bold text-primary">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Welcome, {user.firstName ?? user.email}.</p>

      <Card className="mt-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Phase 0 — Foundation</CardTitle>
          <CardDescription>
            Signed in as <code className="font-mono">{user.email}</code> · role{' '}
            <code className="font-mono">{user.role}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Real role-aware surfaces ship in Phase 1 — eviction defense, super-utilizer care, and
          caseworker tools. Use the sidebar to explore the placeholder shells.
        </CardContent>
      </Card>
    </div>
  );
}
