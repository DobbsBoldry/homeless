/**
 * Public KY DOC Data-Sharing Agreement template page — no auth required.
 * Template version: kydoc-dsa-v1
 *
 * KY DOC reviews this page before signing. The signed copy is recorded in the
 * coalition's partner-agreements registry per ADR 0004; the privacy contract
 * enforced is documented in ADR 0009.
 *
 * NOT a legal instrument — this is a starting point that counsel and KY DOC's
 * legal office will review and may amend. Fields marked [TBD] require partner-
 * specific detail before execution.
 */

export const dynamic = 'force-static';

export default function KyDocDsaTemplatePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12 print:py-4">
      {/* Header */}
      <header className="mb-8 border-b pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Template Version: kydoc-dsa-v1 &bull; Daviess County Homeless Coalition
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold">
          Data-Sharing Agreement
          <br />
          (Reentry Pathway)
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Between the Daviess County Homeless Coalition (&ldquo;Coalition&rdquo;) and the Kentucky
          Department of Corrections (&ldquo;KY DOC&rdquo;)
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
            <strong>1.2 KY DOC mission.</strong> The Kentucky Department of Corrections operates
            adult correctional institutions, supervises probation and parole, and coordinates
            reentry services under <strong>KRS Chapter 197</strong>. KY DOC&apos;s Reentry Services
            Branch supports the federal Second Chance Act framework (42 U.S.C. § 17501 et seq.) and
            the Kentucky Reentry Council mandate.
          </p>
          <p>
            <strong>1.3 Pathway purpose.</strong> Roughly half of all individuals released from
            state correctional institutions return to homelessness within their first year, and
            return to incarceration is significantly more likely for those who do. The Coalition
            coordinates housing-stability services, healthcare reactivation (Medicaid resumption),
            employment supports, and family-connection coordination; KY DOC coordinates pre-release
            planning, transition home placement, and warm handoff. This Agreement structures the
            limited data flow necessary to coordinate those services in the period before release —
            the operational window where coordination is possible.
          </p>
          <p>
            <strong>1.4 No recidivism prediction.</strong> The Coalition&apos;s purpose is to help a
            person succeed at reentry. The Coalition shall <strong>not</strong> use, derive, or
            permit the derivation of actuarial recidivism scoring, risk-of-reoffense modeling, or
            any predictive analytics that classify individuals on probability of reoffending using
            the data shared under this Agreement. This commitment is non-negotiable and is
            independent of the Coalition&apos;s general analytics work; reentry data is fenced from
            recidivism analytics by software policy and contract.
          </p>
          <p>
            <strong>1.5 Voluntary participation.</strong> This Agreement is voluntary. Either party
            may withdraw with thirty (30) days written notice (see § 9). Withdrawal does not affect
            services already initiated for an individual and does not relieve the Coalition of its
            data destruction obligations under § 5.
          </p>
        </section>

        {/* Section 2 — Data scope */}
        <section>
          <h2 className="text-base font-semibold">2. Data Scope</h2>
          <p>
            KY DOC may share with the Coalition the following categories of records, limited to
            individuals who (a) are currently in KY DOC custody, (b) have a Daviess County address
            of record or have designated Daviess County as their reentry destination, and (c) have a
            projected release date within the pre-release window specified in Schedule A:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Pre-release roster.</strong> Identifiers (KY DOC inmate ID, DOB, projected
              release date, designated reentry destination), sufficient to enable warm handoff
              coordination.
            </li>
            <li>
              <strong>Release-date changes.</strong> Updates when projected release dates shift
              (transfers, parole grants, sentence expirations, expungements).
            </li>
            <li>
              <strong>Supports-in-place.</strong> KY DOC&apos;s pre-release plan: housing intent,
              employment plan, healthcare resumption (Medicaid restoration status), substance-use
              treatment continuity, family-connection plan.
            </li>
            <li>
              <strong>Reentry-program eligibility.</strong> Eligibility flags for reentry programs
              the Coalition coordinates (housing voucher cohorts, Medicaid resumption queues,
              treatment-program slots).
            </li>
          </ul>
          <p>
            The specific data classes covered by this Agreement are identified in the attached
            Schedule A, which is incorporated by reference. [TBD — KY DOC and Coalition complete
            Schedule A before execution.]
          </p>
          <p>
            KY DOC shall <strong>not</strong> share substance-use-treatment records (42 CFR Part 2),
            mental-health diagnostic detail, communications-with-counsel records, victim-impact
            statements, prior-offense narrative detail, or any data not explicitly listed in
            Schedule A without a separate written amendment to this Agreement.
          </p>
        </section>

        {/* Section 3 — Pre-release window */}
        <section>
          <h2 className="text-base font-semibold">3. Pre-Release Window (Bounded Data Flow)</h2>
          <p>
            <strong>3.1 Window as contract.</strong> The Coalition shall receive data only for
            individuals whose projected release date falls within the pre-release window specified
            in Schedule A. The default window is sixty (60) days; the agreed window may range
            between thirty (30) and one hundred eighty (180) days as Schedule A specifies. Records
            that age out of the window without a successful warm handoff are deleted from Coalition
            systems within seven (7) days of expiration.
          </p>
          <p>
            <strong>3.2 Software enforcement.</strong> The Coalition&apos;s ingest middleware reads
            Schedule A&apos;s window length as the contract-of-record. KY DOC may verify enforcement
            by inspecting the agreement record in the Coalition&apos;s registry and the audit log of
            the daily window-expiration job.
          </p>
          <p>
            <strong>3.3 Window amendments.</strong> Any change to the pre-release window length is a
            contract amendment and requires written authorization from both parties. The Coalition
            shall not extend the window administratively.
          </p>
        </section>

        {/* Section 4 — Data security */}
        <section>
          <h2 className="text-base font-semibold">4. Data Security and Access Controls</h2>
          <p>
            <strong>4.1 Authorized readers.</strong> The Coalition shall restrict access to
            pre-release records to assigned reentry caseworkers, supervising caseworkers, and admins
            on a strict need-to-know basis. The list of authorized readers is maintained by the
            Coalition&apos;s data steward and provided to KY DOC upon request.
          </p>
          <p>
            <strong>4.2 No re-disclosure to law enforcement.</strong> The Coalition shall not
            disclose pre-release records, derived analytics, or even confirmation-of-existence to
            law enforcement, parole, probation, or the courts except (a) under a valid court order
            that the Coalition&apos;s counsel has reviewed, or (b) under separate written
            authorization from KY DOC. This includes informal requests; data sharing for
            surveillance purposes is outside the scope of this Agreement.
          </p>
          <p>
            <strong>4.3 Audit logging.</strong> Every read of an individual&apos;s pre-release
            record is audit-logged. The audit table is the source of truth for the cooperation
            obligation in § 6.3.
          </p>
          <p>
            <strong>4.4 Breach notification.</strong> Any unauthorized access, disclosure, or loss
            of pre-release records must be reported to KY DOC within seventy-two (72) hours of
            discovery, with a written incident report within seven (7) days and immediate suspension
            of the data flow pending review.
          </p>
        </section>

        {/* Section 5 — Data destruction */}
        <section>
          <h2 className="text-base font-semibold">5. Data Retention and Destruction</h2>
          <p>
            <strong>5.1 Default retention.</strong> Records that age out of the pre-release window
            without a successful warm handoff are deleted within seven (7) days. Records of
            individuals who are successfully handed off are retained per Schedule A&apos;s data
            destruction policy: destruction upon agreement termination is the default; longer
            retention windows (3 years, 5 years) are available only with explicit written
            justification and KY DOC approval.
          </p>
          <p>
            <strong>5.2 Destruction on termination.</strong> Upon termination, the Coalition shall
            securely destroy or return all pre-release records (including backup copies) within
            thirty (30) days. &ldquo;Destruction&rdquo; means irreversible deletion from all systems
            and media holding the records.
          </p>
          <p>
            <strong>5.3 Certification.</strong> The Coalition shall provide KY DOC with written
            certification of destruction. KY DOC may inspect destruction logs upon reasonable
            notice.
          </p>
        </section>

        {/* Section 6 — Coordination and reporting */}
        <section>
          <h2 className="text-base font-semibold">6. Coordination and Reporting</h2>
          <p>
            <strong>6.1 Joint case-coordination.</strong> The Coalition and KY DOC shall coordinate
            at a cadence agreed upon in Schedule B (default: monthly). The agenda shall include
            progress on warm handoffs, emerging risks, and any data-flow questions.
          </p>
          <p>
            <strong>6.2 Aggregate reporting.</strong> The Coalition shall provide KY DOC with
            quarterly aggregate reports on outcomes for the cohort: number of individuals
            successfully connected to housing on day-of-release, Medicaid-resumption rates, and
            employment-engagement rates. <strong>No</strong> recidivism / re-incarceration metrics
            shall be derived or reported under this Agreement; that is the explicit prohibition in §
            1.4.
          </p>
          <p>
            <strong>6.3 Audit cooperation.</strong> The Coalition shall, upon reasonable notice,
            provide KY DOC with access to audit logs and access-control records for the purpose of
            verifying compliance with this Agreement.
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
            Any amendment to this Agreement, including changes to Schedule A or to the pre-release
            window under § 3, must be in writing and signed by authorized representatives of both
            parties. The Coalition will publish a new template version for material amendments; the
            signed copy recorded in the Coalition&apos;s registry is the authoritative instrument.
          </p>
        </section>

        {/* Section 9 — Withdrawal */}
        <section>
          <h2 className="text-base font-semibold">9. Withdrawal</h2>
          <p>
            Either party may terminate this Agreement at any time by providing thirty (30) days
            written notice to the other party. Notice may be delivered by email to the contacts
            identified in Schedule B. Upon termination, the Coalition&apos;s data destruction
            obligations under § 5 take effect immediately. KY DOC may suspend data flow at any time
            without notice if compliance is in question; suspension is not termination.
          </p>
        </section>

        {/* Section 10 — Governing law */}
        <section>
          <h2 className="text-base font-semibold">10. Governing Law</h2>
          <p>
            This Agreement is governed by the laws of the Commonwealth of Kentucky, including{' '}
            <strong>KRS Chapter 197</strong> (Department of Corrections) and{' '}
            <strong>KRS Chapter 439</strong> (probation and parole), and applicable federal law
            (Second Chance Act, 42 U.S.C. § 17501 et seq.). Any dispute arising under this Agreement
            shall be resolved through good-faith negotiation between the Coalition&apos;s data
            steward and KY DOC&apos;s Reentry Services Branch Manager before seeking other remedies.
          </p>
        </section>

        {/* Signatory blocks */}
        <section className="mt-8">
          <h2 className="text-base font-semibold">Signatories</h2>
          <div className="mt-4 grid gap-8 sm:grid-cols-2">
            <div className="space-y-4">
              <p className="font-medium">Daviess County Homeless Coalition</p>
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
                Kentucky Department of
                <br />
                Corrections (KY DOC)
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
            [TBD — to be completed by KY DOC and Coalition before execution. Enumerate the specific
            data elements, file format, transmission method, frequency, the pre-release window
            length (30–180 days; default 60), and the agreed retention period.]
          </p>
        </section>

        <section className="mt-4">
          <h2 className="text-base font-semibold">Schedule B — Contacts</h2>
          <p className="text-muted-foreground italic">
            [TBD — list Coalition data steward and KY DOC Reentry Services Branch Manager (or
            designee) names, emails, and phone numbers. Include after-hours emergency contact for
            breach notification under § 4.4.]
          </p>
        </section>
      </article>

      {/* Footer note */}
      <footer className="mt-10 border-t pt-6 text-xs text-muted-foreground">
        <p>
          This page is the public template (version <code className="font-mono">kydoc-dsa-v1</code>
          ). The signed copy is recorded in the coalition&apos;s partner-agreements registry per{' '}
          <strong>ADR 0004</strong>; the privacy contract this agreement enforces is documented in{' '}
          <strong>ADR 0009</strong>. This template is a starting point — KY DOC and Coalition should
          review it with counsel before execution. Fields marked [TBD] require partner- specific
          detail.
        </p>
        <p className="mt-2">
          References: KRS Chapter 197 (Department of Corrections); KRS Chapter 439 (Probation and
          Parole); Second Chance Act, 42 U.S.C. § 17501 et seq.; Kentucky Reentry Council mandate.
        </p>
      </footer>
    </div>
  );
}
