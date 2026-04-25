import { UserButton } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-background p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <UserButton />
      </header>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome, {user.firstName ?? user.email}</CardTitle>
          <CardDescription>
            Signed in as <code className="font-mono">{user.email}</code> · role{' '}
            <code className="font-mono">{user.role}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Phase 0 placeholder. Real role-aware surfaces ship in Phase 1 (eviction defense,
          super-utilizer care, caseworker tools).
        </CardContent>
      </Card>
    </main>
  );
}
