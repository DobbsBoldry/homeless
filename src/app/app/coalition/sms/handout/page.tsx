import { PrintButton } from '@/components/coordination/print-button';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * INDC-008 — printable one-pager staff hand to clients. Designed
 * for letter-paper / 4×6 reprinting. Avoids the app shell so the
 * page prints clean.
 */
export default async function SmsHandoutPage() {
  await requireRole(['admin', 'shelter_staff', 'caseworker', 'ed_coordinator']);
  // The actual SMS shortcode / number is configured per environment;
  // staff printing this should override [SHORTCODE] before laminating.
  // Phase 1: Twilio long-code; Phase 2 (post-BAA): coalition shortcode.
  const shortcode = process.env.NEXT_PUBLIC_INDC_SMS_NUMBER ?? '[number TBD]';

  return (
    <div className="mx-auto max-w-2xl p-8 print:p-0">
      <div className="space-y-6 rounded-lg border border-border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Daviess County Homeless Coalition
          </p>
          <h1 className="font-serif text-3xl font-bold">Find a bed by text.</h1>
          <p className="text-stone-700">Free. Confidential. Local partners. No app to install.</p>
        </header>

        <section>
          <p className="text-sm">Text the word below to:</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{shortcode}</p>
        </section>

        <section className="space-y-3 rounded-md bg-stone-50 p-4">
          <h2 className="font-serif text-lg font-semibold">Quick commands</h2>
          <table className="w-full text-sm">
            <tbody className="[&_td]:py-1 [&_td:first-child]:font-mono [&_td:first-child]:font-semibold [&_td:first-child]:pr-3">
              <tr>
                <td>BED</td>
                <td>find an open shelter bed</td>
              </tr>
              <tr>
                <td>BED FAMILY</td>
                <td>only family-accepting shelters</td>
              </tr>
              <tr>
                <td>BED PET</td>
                <td>only pet-friendly shelters</td>
              </tr>
              <tr>
                <td>BED MEN / WOMEN</td>
                <td>filter by population</td>
              </tr>
              <tr>
                <td>BED SUD</td>
                <td>recovery / SUD-friendly</td>
              </tr>
              <tr>
                <td>HOLD 1</td>
                <td>hold the first bed for 90 minutes</td>
              </tr>
              <tr>
                <td>RELEASE</td>
                <td>cancel a hold you placed</td>
              </tr>
              <tr>
                <td>FOOD</td>
                <td>nearby food pantry numbers</td>
              </tr>
              <tr>
                <td>STORY</td>
                <td>about this service</td>
              </tr>
              <tr>
                <td>HELP</td>
                <td>show this list again</td>
              </tr>
              <tr>
                <td>STOP</td>
                <td>opt out of texts</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="font-serif text-lg font-semibold">How it works</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Text <span className="font-mono font-semibold">BED</span> (or BED FAMILY / BED PET).
            </li>
            <li>Reply with a neighborhood, intersection, or ZIP — or ANYWHERE.</li>
            <li>You'll get up to 3 shelters with current open beds and phone numbers.</li>
            <li>Reply HOLD &lt;#&gt; to hold the bed for 90 minutes while you walk over.</li>
          </ol>
        </section>

        <section className="space-y-1 text-xs text-stone-700">
          <p>
            <strong>Privacy.</strong> The coalition stores the messages and your phone number during
            the pilot to make the service work. We don't share your number with shelters unless you
            ask us to.
          </p>
          <p>
            <strong>Need a person?</strong> Call <span className="font-mono">211</span> for live
            referrals 24/7.
          </p>
        </section>
      </div>

      <div className="mt-4 space-y-2 print:hidden">
        <PrintButton />
        <p className="text-xs text-muted-foreground">
          Print this on letter paper, or trim down to a quarter-sheet. Replace
          <code className="font-mono"> [number TBD]</code> with the real Twilio number once it's
          provisioned (set <code className="font-mono">NEXT_PUBLIC_INDC_SMS_NUMBER</code>).
        </p>
      </div>
    </div>
  );
}
