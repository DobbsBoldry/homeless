import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Daviess Coalition Platform</h1>
        <p className="text-lg text-muted-foreground">
          AI-powered tooling to address homelessness in Daviess County, Kentucky — eviction defense,
          ED super-utilizer care coordination, caseworker tools, and an SMS companion for unhoused
          individuals.
        </p>
      </div>

      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>Phase 0 — Foundation</CardTitle>
          <CardDescription>This is a scaffold. Real surfaces ship in Phase 1.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button>Get started</Button>
          <Button variant="outline">View backlog</Button>
        </CardContent>
      </Card>
    </main>
  );
}
