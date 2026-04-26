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
          <p className="font-medium">Pre-launch checklist.</p>
          <p className="mt-1 text-muted-foreground">
            Webhook is built and the pipeline runs against live shelter data. To accept real client
            traffic: set <code className="font-mono">TWILIO_AUTH_TOKEN</code>, point a Twilio number
            at <code className="font-mono">/api/webhooks/twilio/sms</code>, and complete the
            HIPAA-eligible Twilio account migration (ESUC-004) before any real callers are invited.
            Until then, this playground is the only entry point.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
