/**
 * Public VA HUD-VASH Data-Sharing Agreement template page — no auth required.
 * Template version: vahudvash-dsa-v1
 *
 * Both the local VAMC HUD-VASH program and the local Public Housing Authority
 * review this page before signing. The signed copy is recorded in the
 * coalition's partner-agreements registry per ADR 0004; the privacy contract
 * enforced is documented in ADR 0010.
 *
 * NOT a legal instrument — this is a starting point that counsel, the VA
 * Privacy Office, and the local PHA's legal staff will review and may amend.
 * Fields marked [TBD] require partner-specific detail before execution.
 */

export const dynamic = 'force-static';

export default function VaHudVashDsaTemplatePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12 print:py-4">
      {/* Header */}
      <header className="mb-8 border-b pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Template Version: vahudvash-dsa-v1 &bull; Daviess County Homeless Coalition
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold">
          Data-Sharing Agreement
          <br />
          (HUD-VASH Veteran Pathway)
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Among the Daviess County Homeless Coalition (&ldquo;Coalition&rdquo;), the U.S. Department
          of Veterans Affairs Medical Center HUD-VASH program (&ldquo;VAMC&rdquo;), and the local
          Public Housing Authority (&ldquo;PHA&rdquo;)
        </p>
      </header>

      <article className="prose prose-sm max-w-none dark:prose-invert space-y-6 text-sm leading-relaxed">
        {/* Section 1 — Recitals */}
        <section>
          <h2 className="text-base font-semibold">1. Recitals</h2>
          <p>
            <strong>1.1 Coalition purpose.</strong> The Daviess County Homeless Coalition
            (&ldquo;Coalition&rdquo;) is a county-level coordinating body working to prevent and end
            homelessness in Daviess County, Kentucky.
          </p>
          <p>
            <strong>1.2 VAMC mission.</strong> The local VA Medical Center operates HUD-VASH (
            <strong>HUD-Veterans Affairs Supportive Housing</strong>) under{' '}
            <strong>42 U.S.C. § 11403</strong> and provides clinical case management, mental-health
            and substance-use treatment, and primary care to enrolled veterans, governed by{' '}
            <strong>38 U.S.C. § 7332</strong>, <strong>38 CFR Part 1</strong>, and HIPAA (
            <strong>45 CFR Part 164</strong>).
          </p>
          <p>
            <strong>1.3 PHA role.</strong> The local Public Housing Authority administers the
            HUD-VASH housing-choice voucher allocation. PHA voucher administration is governed by{' '}
            <strong>24 CFR Part 982</strong> and HUD&apos;s HUD-VASH operating requirements.
          </p>
          <p>
            <strong>1.4 Pathway purpose.</strong> Veterans engaged with HUD-VASH face a clock: HUD
            vouchers are typically valid for 60 days from issuance, with a discretionary 60-day
            extension. Lease-up requires landlord engagement, application support, and ancillary
            benefits coordination — the operational window where Coalition support meaningfully
            improves outcomes. This Agreement structures the limited data flow necessary to
            coordinate housing-search and lease-stabilization services across that window.
          </p>
          <p>
            <strong>1.5 No service-denial prediction.</strong> The Coalition&apos;s purpose is to
            help every voucher-holding veteran succeed at lease-up. The Coalition shall{' '}
            <strong>not</strong> use, derive, or permit the derivation of voucher-failure scoring,
            deprioritization analytics, or any predictive scoring that classifies veterans on
            probability of voucher loss using the data shared under this Agreement. The Coalition
            shall not provide any data shared under this Agreement to insurers, employer
            background-check vendors, or any third party for the purpose of denying or limiting
            services to the veteran. This commitment is non-negotiable.
          </p>
          <p>
            <strong>1.6 MH/SUD scope boundary.</strong> Mental-health and substance-use treatment
            content (diagnosis codes, treatment plan content, session notes, medication lists) is
            governed by 38 U.S.C. § 7332 and 42 U.S.C. § 290dd-2 (Part 2). Such content is{' '}
            <strong>out of scope</strong> for this Agreement. The Coalition may receive only the
            fact of an active treatment relationship (continuity-status enum) and the VA case
            manager&apos;s contact information for warm handoff. Expansion to QSOA-protected content
            requires a separate Qualified Service Organization Agreement under 42 CFR Part 2.
          </p>
          <p>
            <strong>1.7 Voluntary participation.</strong> This Agreement is voluntary. Any party may
            withdraw with thirty (30) days written notice (see § 9). Withdrawal does not affect
            services already initiated for an individual and does not relieve the Coalition of its
            data destruction obligations under § 5.
          </p>
        </section>

        {/* Section 2 — Data scope */}
        <section>
          <h2 className="text-base font-semibold">2. Data Scope</h2>
          <p>
            VAMC and PHA may share with the Coalition the following categories of records, limited
            to veterans who (a) are enrolled in HUD-VASH, (b) have a Daviess County voucher or
            search area, and (c) are within the voucher-search window specified in Schedule A:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Voucher-status roster.</strong> Identifiers (PHA case number, DOB, voucher
              issuance date, voucher status: eligible / vouchered / searching / leased / expiring),
              sufficient to enable warm-handoff coordination.
            </li>
            <li>
              <strong>Eligibility changes.</strong> Updates when service-connection ratings shift,
              when income changes affect HUD-VASH continued eligibility, or when voucher status
              transitions.
            </li>
            <li>
              <strong>Supports-in-place.</strong> VA-side supports: case-management engagement
              status, treatment-continuity status (status_only — no diagnostic content),
              primary-care continuity, and the assigned VA case manager&apos;s contact for warm
              handoff.
            </li>
            <li>
              <strong>Adjacent-program eligibility.</strong> Eligibility flags for adjacent programs
              the Coalition coordinates (SSVF, Veterans Treatment Court, HCHV grant programs).
            </li>
          </ul>
          <p>
            The specific data classes covered by this Agreement are identified in the attached
            Schedule A, which is incorporated by reference. [TBD — VAMC, PHA, and Coalition complete
            Schedule A before execution.]
          </p>
          <p>
            VAMC shall <strong>not</strong> share substance-use-treatment records (42 CFR Part 2),
            mental-health diagnostic detail, treatment plan content, session notes, medication
            lists, communications-with-counsel records, or any data not explicitly listed in
            Schedule A without a separate written amendment to this Agreement. PHA shall not share
            third-party household income detail beyond what is necessary to confirm continued HUD-
            VASH eligibility.
          </p>
        </section>

        {/* Section 3 — Voucher window */}
        <section>
          <h2 className="text-base font-semibold">3. Voucher-Search Window (Bounded Data Flow)</h2>
          <p>
            <strong>3.1 Window as contract.</strong> The Coalition shall receive data only for
            veterans whose voucher issuance date plus the window covers the present date. The
            default window is one hundred twenty (120) days; the agreed window may range between
            sixty (60) and two hundred forty (240) days as Schedule A specifies. Records that age
            out of the window without a successful warm handoff or lease-up are deleted from
            Coalition systems within seven (7) days of expiration.
          </p>
          <p>
            <strong>3.2 Software enforcement.</strong> The Coalition&apos;s ingest middleware reads
            Schedule A&apos;s window length as the contract-of-record. VAMC and PHA may verify
            enforcement by inspecting the agreement record in the Coalition&apos;s registry and the
            audit log of the daily window-expiration job.
          </p>
          <p>
            <strong>3.3 Window amendments.</strong> Any change to the voucher-search window length
            is a contract amendment and requires written authorization from all parties. The
            Coalition shall not extend the window administratively.
          </p>
        </section>

        {/* Section 4 — Data security */}
        <section>
          <h2 className="text-base font-semibold">4. Data Security and Access Controls</h2>
          <p>
            <strong>4.1 Authorized readers.</strong> The Coalition shall restrict access to veteran
            records to assigned veteran-pathway caseworkers, supervising caseworkers, and admins on
            a strict need-to-know basis. The list of authorized readers is maintained by the
            Coalition&apos;s data steward and provided to VAMC and PHA upon request.
          </p>
          <p>
            <strong>4.2 No re-disclosure to insurers, employers, or for service-denial.</strong> The
            Coalition shall not disclose veteran records, derived analytics, or even
            confirmation-of-existence to insurers, employer background-check vendors, eligibility-
            screening systems, or any party requesting data for the purpose of denying or limiting
            services to the veteran. This includes informal requests; data sharing for
            service-eligibility scoring is outside the scope of this Agreement.
          </p>
          <p>
            <strong>4.3 Audit logging.</strong> Every read of an individual&apos;s veteran record is
            audit-logged. The audit table is the source of truth for the cooperation obligation in §
            6.3.
          </p>
          <p>
            <strong>4.4 Breach notification.</strong> Any unauthorized access, disclosure, or loss
            of veteran records must be reported to the VA Privacy Officer within seventy-two (72)
            hours of discovery and to the HUD field office within five (5) business days, with a
            written incident report within seven (7) days and immediate suspension of the data flow
            pending review.
          </p>
        </section>

        {/* Section 5 — Data destruction */}
        <section>
          <h2 className="text-base font-semibold">5. Data Retention and Destruction</h2>
          <p>
            <strong>5.1 Default retention.</strong> Records that age out of the voucher-search
            window without a successful warm handoff or lease-up are deleted within seven (7) days.
            Records of veterans who are successfully housed are retained per Schedule A&apos;s data
            destruction policy: destruction upon agreement termination is the default; longer
            retention windows (3 years, 5 years) are available only with explicit written
            justification and joint VAMC + PHA approval.
          </p>
          <p>
            <strong>5.2 Destruction on termination.</strong> Upon termination, the Coalition shall
            securely destroy or return all veteran records (including backup copies) within thirty
            (30) days. &ldquo;Destruction&rdquo; means irreversible deletion from all systems and
            media holding the records.
          </p>
          <p>
            <strong>5.3 Certification.</strong> The Coalition shall provide VAMC and PHA with
            written certification of destruction. Either party may inspect destruction logs upon
            reasonable notice.
          </p>
        </section>

        {/* Section 6 — Coordination and reporting */}
        <section>
          <h2 className="text-base font-semibold">6. Coordination and Reporting</h2>
          <p>
            <strong>6.1 Joint case-coordination.</strong> The Coalition, VAMC, and PHA shall
            coordinate at a cadence agreed upon in Schedule B (default: monthly). The agenda shall
            include progress on lease-ups, voucher-expiration risks, and any data-flow questions.
          </p>
          <p>
            <strong>6.2 Aggregate reporting.</strong> The Coalition shall provide VAMC and PHA with
            quarterly aggregate reports on outcomes for the cohort: number of veterans successfully
            leased within the voucher-search window, time-to-lease distribution, and
            voucher-expiration rates. <strong>No</strong> service-denial scoring, deprioritization
            recommendations, or insurer-bound metrics shall be derived or reported under this
            Agreement; that is the explicit prohibition in § 1.5.
          </p>
          <p>
            <strong>6.3 Audit cooperation.</strong> The Coalition shall, upon reasonable notice,
            provide VAMC and PHA with access to audit logs and access-control records for the
            purpose of verifying compliance with this Agreement.
          </p>
        </section>

        {/* Section 7 — Term */}
        <section>
          <h2 className="text-base font-semibold">7. Term</h2>
          <p>
            This Agreement is effective on the date last signed below and continues until the
            earlier of (a) the end date specified in Schedule A, (b) termination under § 9, or (c)
            written mutual agreement to terminate.
          </p>
        </section>

        {/* Section 8 — Amendments */}
        <section>
          <h2 className="text-base font-semibold">8. Amendments</h2>
          <p>
            Any amendment to this Agreement, including changes to Schedule A or to the voucher-
            search window under § 3, must be in writing and signed by authorized representatives of
            all three parties. The Coalition will publish a new template version for material
            amendments; the signed copy recorded in the Coalition&apos;s registry is the
            authoritative instrument.
          </p>
        </section>

        {/* Section 9 — Withdrawal */}
        <section>
          <h2 className="text-base font-semibold">9. Withdrawal</h2>
          <p>
            Any party may terminate this Agreement at any time by providing thirty (30) days written
            notice to the other parties. Notice may be delivered by email to the contacts identified
            in Schedule B. Upon termination, the Coalition&apos;s data destruction obligations under
            § 5 take effect immediately. VAMC or PHA may suspend data flow at any time without
            notice if compliance is in question; suspension is not termination.
          </p>
        </section>

        {/* Section 10 — Governing law */}
        <section>
          <h2 className="text-base font-semibold">10. Governing Law</h2>
          <p>
            This Agreement is governed by federal law, including <strong>38 U.S.C. § 7332</strong>{' '}
            (VA confidentiality), <strong>42 U.S.C. § 11403</strong> (HUD-VASH authorization),{' '}
            <strong>42 U.S.C. § 290dd-2</strong> and <strong>42 CFR Part 2</strong> (federal SUD
            confidentiality), HIPAA (<strong>45 CFR Part 164</strong>),{' '}
            <strong>24 CFR Part 982</strong> (HUD voucher administration), and applicable Kentucky
            law. Any dispute arising under this Agreement shall be resolved through good-faith
            negotiation among the Coalition&apos;s data steward, the VAMC HUD-VASH coordinator, and
            the PHA HCV director before seeking other remedies.
          </p>
        </section>

        {/* Signatory blocks */}
        <section className="mt-8">
          <h2 className="text-base font-semibold">Signatories</h2>
          <div className="mt-4 grid gap-8 sm:grid-cols-3">
            <div className="space-y-4">
              <p className="font-medium">
                Daviess County
                <br />
                Homeless Coalition
              </p>
              <div className="space-y-2">
                <div className="border-b border-foreground/30 pb-0.5">
                  <p className="mt-4 text-xs text-muted-foreground">Authorized signature</p>
                </div>
                <div className="border-b border-foreground/30 pb-0.5">
                  <p className="mt-4 text-xs text-muted-foreground">Printed name &amp; title</p>
                </div>
                <div className="border-b border-foreground/30 pb-0.5">
                  <p className="mt-4 text-xs text-muted-foreground">Date</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <p className="font-medium">
                VA Medical Center
                <br />
                HUD-VASH Program (VAMC)
              </p>
              <div className="space-y-2">
                <div className="border-b border-foreground/30 pb-0.5">
                  <p className="mt-4 text-xs text-muted-foreground">Authorized signature</p>
                </div>
                <div className="border-b border-foreground/30 pb-0.5">
                  <p className="mt-4 text-xs text-muted-foreground">Printed name &amp; title</p>
                </div>
                <div className="border-b border-foreground/30 pb-0.5">
                  <p className="mt-4 text-xs text-muted-foreground">Date</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <p className="font-medium">
                Local Public
                <br />
                Housing Authority (PHA)
              </p>
              <div className="space-y-2">
                <div className="border-b border-foreground/30 pb-0.5">
                  <p className="mt-4 text-xs text-muted-foreground">Authorized signature</p>
                </div>
                <div className="border-b border-foreground/30 pb-0.5">
                  <p className="mt-4 text-xs text-muted-foreground">Printed name &amp; title</p>
                </div>
                <div className="border-b border-foreground/30 pb-0.5">
                  <p className="mt-4 text-xs text-muted-foreground">Date</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Schedule placeholders */}
        <section className="mt-6">
          <h2 className="text-base font-semibold">Schedule A — Data Classes &amp; Window</h2>
          <p className="text-muted-foreground italic">
            [TBD — to be completed by VAMC, PHA, and Coalition before execution. Enumerate the
            specific data elements, file format, transmission method, frequency, the voucher- search
            window length (60–240 days; default 120), and the agreed retention period.]
          </p>
        </section>

        <section className="mt-4">
          <h2 className="text-base font-semibold">Schedule B — Contacts</h2>
          <p className="text-muted-foreground italic">
            [TBD — list Coalition data steward, VAMC HUD-VASH coordinator, and PHA HCV director (or
            designees) names, emails, and phone numbers. Include after-hours emergency contact for
            breach notification under § 4.4.]
          </p>
        </section>
      </article>

      {/* Footer note */}
      <footer className="mt-10 border-t pt-6 text-xs text-muted-foreground">
        <p>
          This page is the public template (version{' '}
          <code className="font-mono">vahudvash-dsa-v1</code>). The signed copy is recorded in the
          coalition&apos;s partner-agreements registry per <strong>ADR 0004</strong>; the privacy
          contract this agreement enforces is documented in <strong>ADR 0010</strong>. This template
          is a starting point — VAMC, PHA, and Coalition should review it with counsel before
          execution. Fields marked [TBD] require partner-specific detail.
        </p>
        <p className="mt-2">
          References: 38 U.S.C. § 7332 (VA confidentiality); 42 U.S.C. § 11403 (HUD-VASH); 42 U.S.C.
          § 290dd-2 + 42 CFR Part 2 (federal SUD confidentiality); HIPAA (45 CFR Part 164); 24 CFR
          Part 982 (HUD vouchers); 38 CFR Part 1 (VA records confidentiality).
        </p>
      </footer>
    </div>
  );
}
