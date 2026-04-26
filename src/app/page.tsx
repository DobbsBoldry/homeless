import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 p-8">
      <div className="text-center space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Daviess County, Kentucky
        </p>
        <h1 className="font-serif text-4xl font-bold tracking-tight">Daviess Coalition Platform</h1>
        <p className="text-lg text-muted-foreground">
          AI-powered tooling for the county homelessness-response coalition — eviction defense, ED
          super-utilizer care coordination, caseworker tools, and an SMS bed-finder for unhoused
          individuals.
        </p>
      </div>

      <div className="grid w-full gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>For coalition partners</CardTitle>
            <CardDescription>
              Sign in for attorney, caseworker, ED coordinator, shelter staff, or admin tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            {userId ? (
              <Link href="/app/dashboard">
                <Button>Open dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button>Sign in</Button>
                </Link>
                <Link href="/sign-up">
                  <Button variant="outline">Create account</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>For everyone else</CardTitle>
            <CardDescription>
              Quarterly outcomes, governance counts, and what the coalition has done so far.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/outcomes">
              <Button variant="outline">View outcomes →</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
