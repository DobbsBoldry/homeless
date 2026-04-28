/**
 * Public FERPA agreement template page — no auth required.
 * Template version: ferpa-v1
 *
 * Districts review this page before signing. The signed copy is recorded
 * in the coalition's partner-agreements registry per ADR 0004.
 *
 * NOT a legal instrument — this is a starting point that counsel and the
 * district will review and may amend. Fields marked [TBD] require district-
 * specific detail to be attached before execution.
 */

export const dynamic = 'force-static';

export default function FerpaTemplatePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12 print:py-4">
      {/* Header */}
      <header className="mb-8 border-b pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Template Version: ferpa-v1 &bull; Daviess County Homeless Coalition
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold">
          Family Educational Rights and Privacy Act (FERPA)
          <br />
          Data-Sharing Agreement
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Between the Daviess County Homeless Coalition (&ldquo;Coalition&rdquo;) and [DISTRICT
          NAME] (&ldquo;District&rdquo;)
        </p>
      </header>

      <article className="prose prose-sm max-w-none dark:prose-invert space-y-6 text-sm leading-relaxed">
        {/* Section 1 — Recitals */}
        <section>
          <h2 className="text-base font-semibold">1. Recitals</h2>
          <p>
            <strong>1.1 Coalition purpose.</strong> The Daviess County Homeless Coalition
            (&ldquo;Coalition&rdquo;) is a county-level coordinating body working to prevent and end
            homelessness in Daviess County, Kentucky. The Coalition provides eviction defense
            coordination, emergency shelter navigation, and wraparound caseworker support to
            individuals and families experiencing housing instability.
          </p>
          <p>
            <strong>1.2 McKinney-Vento Act.</strong> The McKinney-Vento Homeless Assistance Act (42
            U.S.C. § 11431 et seq.) requires local educational agencies (&ldquo;LEAs&rdquo;) to
            identify homeless children and youth and ensure their access to public education. The
            Coalition supports the District&apos;s McKinney-Vento obligations by coordinating
            housing-stability services for enrolled students and their families.
          </p>
          <p>
            <strong>1.3 FERPA framework.</strong> The Family Educational Rights and Privacy Act (20
            U.S.C. § 1232g; 34 C.F.R. Part 99) restricts the disclosure of personally identifiable
            information from students&apos; education records without prior written parental
            consent, subject to enumerated exceptions. This Agreement is structured under the
            &ldquo;studies exception&rdquo; at 34 C.F.R. § 99.31(a)(6), which permits disclosure to
            organizations conducting studies for, or on behalf of, educational agencies to improve
            instruction, provided the study is conducted in a manner that does not permit personal
            identification of parents or students by persons other than the agency or organization
            and that information is destroyed when no longer needed.
          </p>
          <p>
            <strong>1.4 Voluntary participation.</strong> This Agreement is voluntary. The District
            may withdraw at any time with thirty (30) days written notice to the Coalition (see §
            9). Withdrawal does not affect services already provided to enrolled families.
          </p>
        </section>

        {/* Section 2 — Data scope */}
        <section>
          <h2 className="text-base font-semibold">2. Data Scope</h2>
          <p>
            The District may share with the Coalition the following categories of student education
            records, limited to students the District has identified as homeless or at imminent risk
            of homelessness under McKinney-Vento:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Attendance patterns.</strong> Chronic-absence flags and absence-rate data
              sufficient to identify students at risk of losing stable housing due to educational
              disruption.
            </li>
            <li>
              <strong>Address / school-of-origin changes.</strong> Records of address changes and
              school-of-origin designations that indicate residential instability.
            </li>
            <li>
              <strong>McKinney-Vento identification status.</strong> The student&apos;s current
              McKinney-Vento eligibility determination, including primary nighttime residence
              category (per 42 U.S.C. § 11434a(2)) as reported to the state.
            </li>
            <li>
              <strong>Transportation assistance requests.</strong> Requests for and status of
              McKinney-Vento transportation assistance.
            </li>
          </ul>
          <p>
            The specific data classes covered by this Agreement are identified in the attached
            Schedule A (data classes schedule), which is incorporated by reference. [TBD — District
            and Coalition complete Schedule A before execution.]
          </p>
          <p>
            The District shall <strong>not</strong> share Special Education records (IDEA),
            disciplinary records, or any data not explicitly listed in Schedule A without a separate
            written amendment to this Agreement.
          </p>
        </section>

        {/* Section 3 — Studies exception */}
        <section>
          <h2 className="text-base font-semibold">3. FERPA Studies Exception (§ 99.31(a)(6))</h2>
          <p>
            <strong>3.1 Basis.</strong> Disclosures under this Agreement are made pursuant to 34
            C.F.R. § 99.31(a)(6) (&ldquo;studies exception&rdquo;), which authorizes disclosure to
            an organization conducting studies on behalf of the District to (a) develop, validate,
            or administer predictive tests; (b) administer student aid programs; or (c) improve
            instruction.
          </p>
          <p>
            <strong>3.2 Coalition&apos;s role.</strong> The Coalition conducts housing-stability
            coordination on behalf of the District to improve educational outcomes for
            McKinney-Vento students. Data shared under this Agreement is used solely to (a) identify
            students who may benefit from Coalition wraparound services, (b) coordinate service
            referrals with the District&apos;s McKinney-Vento liaison, and (c) evaluate the
            effectiveness of housing-stability interventions on attendance and enrollment.
          </p>
          <p>
            <strong>3.3 Non-identification.</strong> The Coalition shall not disclose student
            education records received under this Agreement to any person other than Coalition staff
            who require access to fulfill the purposes stated in § 3.2. The Coalition shall maintain
            technical and administrative controls to prevent re-identification of students in any
            published report or aggregate.
          </p>
          <p>
            <strong>3.4 No re-disclosure.</strong> The Coalition shall not re-disclose individually
            identifiable student education records to any third party without separate written
            authorization from the District, except as required by law.
          </p>
        </section>

        {/* Section 4 — Data security */}
        <section>
          <h2 className="text-base font-semibold">4. Data Security and Access Controls</h2>
          <p>
            <strong>4.1 Access controls.</strong> The Coalition shall restrict access to student
            education records shared under this Agreement to authorized Coalition staff on a
            need-to-know basis. A list of authorized personnel shall be maintained and updated
            within ten (10) business days of any staffing change.
          </p>
          <p>
            <strong>4.2 Technical safeguards.</strong> The Coalition shall store shared student
            records in a password-protected, access-controlled system with audit logging. Records
            shall not be stored on personal devices or unencrypted media.
          </p>
          <p>
            <strong>4.3 Breach notification.</strong> In the event of any unauthorized access,
            disclosure, or loss of student records, the Coalition shall notify the District&apos;s
            FERPA liaison within forty-eight (48) hours of discovery.
          </p>
        </section>

        {/* Section 5 — Data destruction */}
        <section>
          <h2 className="text-base font-semibold">5. Data Retention and Destruction</h2>
          <p>
            <strong>5.1 Retention limit.</strong> The Coalition shall retain student education
            records shared under this Agreement only as long as necessary to fulfill the purposes
            described in § 3.2.
          </p>
          <p>
            <strong>5.2 Destruction on termination.</strong> Unless otherwise specified in Schedule
            A, the Coalition shall securely destroy or return all student education records
            (including backup copies) within thirty (30) days of Agreement termination.
            &ldquo;Destruction&rdquo; means irreversible deletion from all systems and media holding
            the records.
          </p>
          <p>
            <strong>5.3 Certification.</strong> Upon request, the Coalition shall provide the
            District with written certification that destruction has been completed.
          </p>
        </section>

        {/* Section 6 — Disclosure log / FERPA § 99.32 */}
        <section>
          <h2 className="text-base font-semibold">6. Disclosure Log (FERPA § 99.32)</h2>
          <p>
            <strong>6.1 District obligation.</strong> The District shall maintain a record of each
            disclosure made to the Coalition under this Agreement as required by 34 C.F.R. § 99.32.
            The record must include the parties to whom the disclosure was made and the legitimate
            interest in the disclosure.
          </p>
          <p>
            <strong>6.2 Coalition cooperation.</strong> The Coalition shall, upon request, provide
            the District with a log of any secondary access events that may be relevant to the
            District&apos;s § 99.32 record. This obligation survives Agreement termination.
          </p>
          <p>
            <strong>6.3 Parental inspection.</strong> Parents and eligible students may inspect the
            District&apos;s § 99.32 disclosure record. The District shall inform parents of this
            right in its annual FERPA notice.
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
            Any amendment to this Agreement, including changes to Schedule A, must be in writing and
            signed by authorized representatives of both parties. The Coalition will publish a new
            template version for material amendments; the signed copy recorded in the
            Coalition&apos;s registry is the authoritative instrument.
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
            This Agreement is governed by federal law (FERPA, McKinney-Vento) and the laws of the
            Commonwealth of Kentucky. Any dispute arising under this Agreement shall be resolved
            through good-faith negotiation before seeking other remedies.
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
              <p className="font-medium">[District Name]</p>
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
            [TBD — to be completed by District and Coalition before execution. Enumerate the
            specific data elements, file format, transmission method, and frequency.]
          </p>
        </section>

        <section className="mt-4">
          <h2 className="text-base font-semibold">Schedule B — Contacts</h2>
          <p className="text-muted-foreground italic">
            [TBD — list Coalition data steward and District FERPA liaison names, emails, and phone
            numbers.]
          </p>
        </section>
      </article>

      {/* Footer note */}
      <footer className="mt-10 border-t pt-6 text-xs text-muted-foreground">
        <p>
          This page is the public template (version <code className="font-mono">ferpa-v1</code>).
          The signed copy is recorded in the coalition&apos;s partner-agreements registry per{' '}
          <strong>ADR 0004</strong>. This template is a starting point — the District and Coalition
          should review it with counsel before execution. Fields marked [TBD] require
          district-specific detail.
        </p>
        <p className="mt-2">
          References: FERPA, 20 U.S.C. § 1232g; 34 C.F.R. Part 99 (especially § 99.31(a)(6) studies
          exception and § 99.32 disclosure log). McKinney-Vento Homeless Assistance Act, 42 U.S.C.
          §§ 11431–11435.
        </p>
      </footer>
    </div>
  );
}
