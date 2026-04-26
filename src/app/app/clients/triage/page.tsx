import { TriageTierTool } from '@/components/cwt/triage-tier';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function TriageTierPage() {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Triage tier</h1>
        <p className="text-sm text-muted-foreground">
          Quick rule-based recommendation for a household's housing-stability potential. Each
          factor's weight is shown so you can argue with the result rather than just accept it.
          Nothing is saved.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Household details</CardTitle>
        </CardHeader>
        <CardContent>
          <TriageTierTool />
        </CardContent>
      </Card>
    </div>
  );
}
