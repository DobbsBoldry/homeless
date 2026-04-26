import { SmsPlayground } from '@/components/coordination/sms-playground';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SmsPlaygroundPage() {
  await requireRole(['admin', 'shelter_staff', 'caseworker', 'ed_coordinator']);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">SMS bed-finder</h1>
        <p className="text-sm text-muted-foreground">
          Simulate inbound SMS to preview what a caller would see. The same pipeline runs against
          live Twilio traffic at <code className="font-mono">/api/webhooks/twilio/sms</code>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Try a message</CardTitle>
        </CardHeader>
        <CardContent>
          <SmsPlayground />
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">Phase-1 stub.</p>
          <p className="mt-1 text-muted-foreground">
            Replies use seeded shelter data. The webhook is wired up but does nothing in production
            until <code className="font-mono">TWILIO_AUTH_TOKEN</code> is set and a Twilio number is
            pointed at the route. Enable this for real client traffic only after the HIPAA-eligible
            Twilio account migration (ESUC-004).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
