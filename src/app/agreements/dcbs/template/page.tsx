/**
 * Public DCBS Data-Sharing Agreement template page — no auth required.
 * Template version: dcbs-dsa-v1
 *
 * Agencies review this page before signing. The signed copy is recorded
 * in the coalition's partner-agreements registry per ADR 0004.
 *
 * NOT a legal instrument — this is a starting point that counsel and the
 * Cabinet will review and may amend. Fields marked [TBD] require agency-
 * specific detail to be attached before execution.
 */

export const dynamic = 'force-static';

export default function DcbsDsaTemplatePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12 print:py-4">
      {/* Header */}
      <header className="mb-8 border-b pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Template Version: dcbs-dsa-v1 &bull; Daviess County Homeless Coalition
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold">
          Data-Sharing Agreement
          <br />
          (Foster Aging-Out Pathway)
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Between the Daviess County Homeless Coalition (&ldquo;Coalition&rdquo;) and the Kentucky
          Cabinet for Health and Family Services, Department for Community Based Services
          (&ldquo;DCBS&rdquo;)
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
            <strong>1.2 DCBS responsibility.</strong> DCBS is the legal custodian of children and
            youth in foster care under KRS Chapter 620 et seq. and bears continuing obligations
            toward youth who age out of foster care, including coordination of independent-living
            supports under the federal John H. Chafee Foster Care Program for Successful Transition
            to Adulthood (42 U.S.C. § 677).
          </p>
          <p>
            <strong>1.3 Aging-out crisis.</strong> Youth aging out of foster care at age 18 face
            elevated risk of homelessness in the months immediately following discharge. The
            Coalition coordinates housing-stability services, TEAMKY Former Foster Youth Medicaid
            extension navigation, and wraparound supports to mitigate this risk.
          </p>
          <p>
            <strong>1.4 Statutory basis.</strong> This Agreement is structured under the Family
            First Prevention Services Act (Pub. L. 115-123) and Kentucky&apos;s Chafee program
            implementation. DCBS, as legal guardian, may share individually identifying information
            about youth in its custody with downstream service providers when the disclosure is
            necessary to facilitate the youth&apos;s transition to stable adulthood.
          </p>
          <p>
            <strong>1.5 Voluntary participation.</strong> This Agreement is voluntary. Either party
            may withdraw with thirty (30) days written notice (see § 9). Withdrawal does not affect
            services already initiated for an individual youth.
          </p>
        </section>

        {/* Section 2 — Data scope */}
        <section>
          <h2 className="text-base font-semibold">2. Data Scope</h2>
          <p>
            DCBS may share with the Coalition the following categories of records, limited to youth
            in DCBS custody who are within eighteen (18) months of their eighteenth birthday or who
            have aged out within the prior twelve (12) months:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Foster aging-out roster.</strong> Identifying information (legal name, date of
              birth, DCBS case number) for youth approaching age-out, sufficient to enable Coalition
              outreach in coordination with the assigned DCBS worker.
            </li>
            <li>
              <strong>Placement history.</strong> Current placement type and a summary of placement
              changes, sufficient to inform housing-stability planning.
            </li>
            <li>
              <strong>Supports-in-place status.</strong> Whether each youth has documented housing
              plans, Medicaid extension applications in progress, education plans (high-school
              completion, post-secondary enrollment), and employment plans.
            </li>
            <li>
              <strong>TEAMKY Medicaid extension eligibility.</strong> Eligibility flags and status
              sufficient to support the Coalition in helping youth file the Former Foster Youth
              Medicaid extension under 42 U.S.C. § 1396a(a)(10)(A)(i)(IX).
            </li>
          </ul>
          <p>
            The specific data classes covered by this Agreement are identified in the attached
            Schedule A, which is incorporated by reference. [TBD — DCBS and Coalition complete
            Schedule A before execution.]
          </p>
          <p>
            DCBS shall <strong>not</strong> share substance-use treatment records (42 CFR Part 2),
            mental-health diagnostic detail, or any data not explicitly listed in Schedule A without
            a separate written amendment to this Agreement.
          </p>
        </section>

        {/* Section 3 — Authority and population focus */}
        <section>
          <h2 className="text-base font-semibold">3. Authority and Population Focus</h2>
          <p>
            <strong>3.1 Population focus.</strong> Sprint 10 of this Agreement covers the{' '}
            <strong>foster aging-out</strong> population only. Expansion to additional DCBS
            populations (e.g. youth with active dependency cases under age 16, kinship placements)
            requires a written amendment.
          </p>
          <p>
            <strong>3.2 Individual records authorized.</strong> DCBS, as legal guardian under KRS
            620.140, authorizes the Coalition to receive individually identifying records for the
            population in § 3.1. The Coalition shall treat these records under the access controls
            in § 4.
          </p>
          <p>
            <strong>3.3 Coalition&apos;s role.</strong> The Coalition acts as a downstream service
            coordinator on behalf of DCBS. The Coalition does not direct services for youth; the
            assigned DCBS worker retains case-management authority. The Coalition shares observed
            outcomes back to DCBS through scheduled coordination meetings.
          </p>
          <p>
            <strong>3.4 No re-disclosure.</strong> The Coalition shall not re-disclose individually
            identifiable youth records to any third party (including coalition partners not bound by
            this Agreement) without separate written authorization from DCBS, except as required by
            law or for emergency response under KRS 620.030.
          </p>
        </section>

        {/* Section 4 — Data security */}
        <section>
          <h2 className="text-base font-semibold">4. Data Security and Access Controls</h2>
          <p>
            <strong>4.1 Access controls.</strong> The Coalition shall restrict access to youth
            records to authorized Coalition staff on a need-to-know basis. A list of authorized
            personnel shall be maintained and updated within ten (10) business days of any staffing
            change, and shared with DCBS upon request.
          </p>
          <p>
            <strong>4.2 Technical safeguards.</strong> The Coalition shall store shared records in a
            password-protected, access-controlled system with audit logging. Records shall not be
            stored on personal devices or unencrypted media. The system shall comply with the
            Kentucky Cabinet for Health and Family Services data-handling standards as published
            from time to time.
          </p>
          <p>
            <strong>4.3 Breach notification.</strong> In the event of any unauthorized access,
            disclosure, or loss of youth records, the Coalition shall notify the DCBS contact
            identified in Schedule B within twenty-four (24) hours of discovery, with a written
            incident report within seventy-two (72) hours.
          </p>
        </section>

        {/* Section 5 — Data destruction */}
        <section>
          <h2 className="text-base font-semibold">5. Data Retention and Destruction</h2>
          <p>
            <strong>5.1 Retention limit.</strong> The Coalition shall retain youth records shared
            under this Agreement only as long as necessary to fulfill the purposes described in §
            3.3, with a default retention period defined in Schedule A.
          </p>
          <p>
            <strong>5.2 Destruction on termination.</strong> Unless otherwise specified in Schedule
            A, the Coalition shall securely destroy or return all youth records (including backup
            copies) within the deadline elected at execution (&ldquo;Upon termination&rdquo;,
            &ldquo;After 3 years&rdquo;, or &ldquo;After 5 years&rdquo;). &ldquo;Destruction&rdquo;
            means irreversible deletion from all systems and media holding the records.
          </p>
          <p>
            <strong>5.3 Certification.</strong> Upon request, the Coalition shall provide DCBS with
            written certification that destruction has been completed.
          </p>
        </section>

        {/* Section 6 — Coordination and reporting */}
        <section>
          <h2 className="text-base font-semibold">6. Coordination and Reporting</h2>
          <p>
            <strong>6.1 Joint case-coordination meetings.</strong> The Coalition and the assigned
            DCBS worker shall coordinate at a cadence agreed upon in Schedule B (default: monthly).
            The agenda shall include progress on supports-in-place for each youth and any emerging
            risks.
          </p>
          <p>
            <strong>6.2 Aggregate reporting.</strong> The Coalition shall provide DCBS with
            quarterly aggregate reports on outcomes for the cohort: number of youth successfully
            connected to housing, Medicaid extension filing rates, and connection-to-service times.
            No individually identifying information shall be included in publicly published versions
            of these reports.
          </p>
          <p>
            <strong>6.3 Audit cooperation.</strong> The Coalition shall, upon reasonable notice,
            provide DCBS with access to its audit logs and access-control records for the purpose of
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
            Any amendment to this Agreement, including changes to Schedule A or expansions of the
            population focus under § 3.1, must be in writing and signed by authorized
            representatives of both parties. The Coalition will publish a new template version for
            material amendments; the signed copy recorded in the Coalition&apos;s registry is the
            authoritative instrument.
          </p>
        </section>

        {/* Section 9 — Withdrawal */}
        <section>
          <h2 className="text-base font-semibold">9. Withdrawal</h2>
          <p>
            Either party may terminate this Agreement at any time by providing thirty (30) days
            written notice to the other party. Notice may be delivered by email to the contacts
            identified in Schedule B. Upon termination, the Coalition&apos;s data destruction
            obligations under § 5 take effect.
          </p>
        </section>

        {/* Section 10 — Governing law */}
        <section>
          <h2 className="text-base font-semibold">10. Governing Law</h2>
          <p>
            This Agreement is governed by federal law (Chafee program; Family First Prevention
            Services Act) and the laws of the Commonwealth of Kentucky (KRS Chapter 620). Any
            dispute arising under this Agreement shall be resolved through good-faith negotiation
            between the Coalition and the appropriate DCBS Service Region Administrator before
            seeking other remedies.
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
                Kentucky Cabinet for Health and Family Services
                <br />
                Department for Community Based Services
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
          <h2 className="text-base font-semibold">Schedule A — Data Classes</h2>
          <p className="text-muted-foreground italic">
            [TBD — to be completed by DCBS and Coalition before execution. Enumerate the specific
            data elements, file format, transmission method, frequency, and retention period.]
          </p>
        </section>

        <section className="mt-4">
          <h2 className="text-base font-semibold">Schedule B — Contacts</h2>
          <p className="text-muted-foreground italic">
            [TBD — list Coalition data steward and DCBS Service Region Administrator names, emails,
            and phone numbers. Include after-hours emergency contact for breach notification under §
            4.3.]
          </p>
        </section>
      </article>

      {/* Footer note */}
      <footer className="mt-10 border-t pt-6 text-xs text-muted-foreground">
        <p>
          This page is the public template (version <code className="font-mono">dcbs-dsa-v1</code>).
          The signed copy is recorded in the coalition&apos;s partner-agreements registry per{' '}
          <strong>ADR 0004</strong>; the privacy contract this agreement enforces is documented in{' '}
          <strong>ADR 0006</strong>. This template is a starting point — DCBS and Coalition should
          review it with counsel before execution. Fields marked [TBD] require agency-specific
          detail.
        </p>
        <p className="mt-2">
          References: John H. Chafee Foster Care Program for Successful Transition to Adulthood, 42
          U.S.C. § 677. Family First Prevention Services Act, Pub. L. 115-123. KRS Chapter 620
          (Kentucky dependency, neglect, and abuse). 42 U.S.C. § 1396a(a)(10)(A)(i)(IX) (Former
          Foster Youth Medicaid extension to age 26).
        </p>
      </footer>
    </div>
  );
}
