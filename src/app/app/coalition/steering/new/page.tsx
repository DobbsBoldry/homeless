import Link from 'next/link';
import { SteeringMeetingForm } from '@/components/coalition/steering-meeting-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = ['admin', 'attorney', 'caseworker', 'ed_coordinator', 'shelter_staff'] as const;

export default async function NewSteeringMeetingPage() {
  await requireRole(STAFF_ROLES);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/coalition/steering" className="text-muted-foreground hover:underline">
          ← Back to meetings
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">New meeting</h1>
        <p className="text-sm text-muted-foreground">
          Capture today's Steering Committee meeting. The agenda field comes pre-filled with the
          standard pillar template — edit freely.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meeting details</CardTitle>
        </CardHeader>
        <CardContent>
          <SteeringMeetingForm />
        </CardContent>
      </Card>
    </div>
  );
}
