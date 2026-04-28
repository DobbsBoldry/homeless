/**
 * Public OASIS Data-Sharing Agreement template page — no auth required.
 * Template version: oasis-dsa-v1
 *
 * OASIS reviews this page before signing. The signed copy is recorded
 * in the coalition's partner-agreements registry per ADR 0004; the
 * privacy contract enforced is documented in ADR 0007.
 *
 * NOT a legal instrument — this is a starting point that counsel and
 * OASIS will review and may amend. Fields marked [TBD] require partner-
 * specific detail before execution.
 */

export const dynamic = 'force-static';

export default function OasisDsaTemplatePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12 print:py-4">
      {/* Header */}
      <header className="mb-8 border-b pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Template Version: oasis-dsa-v1 &bull; Daviess County Homeless Coalition
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold">
          Data-Sharing Agreement
          <br />
          (DV Survivor Pathway)
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Between the Daviess County Homeless Coalition (&ldquo;Coalition&rdquo;) and Owensboro Area
          Shelter and Information Services, Inc. (&ldquo;OASIS&rdquo;)
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
            <strong>1.2 OASIS mission.</strong> OASIS provides confidential shelter, advocacy, and
            support services to victims of domestic violence and sexual assault throughout western
            Kentucky. OASIS&apos;s services and survivor records are protected under{' '}
            <strong>KRS 209A</strong> (Kentucky&apos;s domestic-violence-victims-services
            confidentiality statute) and the federal Violence Against Women Act.
          </p>
          <p>
            <strong>1.3 Pathway purpose.</strong> Survivors of domestic violence face elevated risk
            of homelessness when fleeing abusers, especially when the abuser controls housing,
            finances, or transportation. The Coalition coordinates housing-stability services and
            downstream legal / employment / childcare referrals; OASIS coordinates shelter, safety
            planning, and advocacy. This Agreement structures the limited data flow necessary to
            coordinate those services without compromising survivor safety.
          </p>
          <p>
            <strong>1.4 Abuser-blind discipline.</strong> Both parties acknowledge that the single
            most consequential threat to a survivor&apos;s safety is an abuser obtaining the
            survivor&apos;s current location through any data leak — direct, indirect, or
            inferential. This Agreement encodes abuser-blind discipline at the contract layer: the
            redaction policy in § 3 binds the Coalition&apos;s software to suppress any field that
            could leak survivor location, and the Coalition&apos;s middleware reads this policy as
            the contract-of-record. This is non-negotiable and is the cornerstone of the Agreement.
          </p>
          <p>
            <strong>1.5 Voluntary participation.</strong> This Agreement is voluntary. Either party
            may withdraw with thirty (30) days written notice (see § 9). Withdrawal does not affect
            services already initiated for an individual survivor and does not relieve the Coalition
            of its data destruction obligations under § 5.
          </p>
        </section>

        {/* Section 2 — Data scope */}
        <section>
          <h2 className="text-base font-semibold">2. Data Scope</h2>
          <p>
            OASIS may share with the Coalition the following categories of records, limited to
            survivors who have given express, informed, signed consent for cross-agency coordination
            per OASIS&apos;s standard release-of-information process:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Survivor intake roster.</strong> The fact of a survivor&apos;s active
              enrollment with OASIS plus a non-locating risk-tier band (Campbell DA-scale or
              equivalent), sufficient to enable Coalition prioritization without conveying any
              location-identifying detail.
            </li>
            <li>
              <strong>Safety-plan status.</strong> Whether a written safety plan is on file and when
              it was last updated. <strong>The contents of safety plans are never shared.</strong>
            </li>
            <li>
              <strong>Service-referral history.</strong> Categories of referrals OASIS has issued
              (legal, housing, childcare, employment, mental-health) and their date-bands.
              Identifying details of receiving providers may be redacted per § 3.
            </li>
            <li>
              <strong>Risk-tier-only fallback.</strong> When abuser-blind discipline cannot be
              guaranteed for full per-record sharing, OASIS may share only an aggregate count and
              the highest-tier band present in the cohort.
            </li>
          </ul>
          <p>
            The specific data classes covered by this Agreement are identified in the attached
            Schedule A, which is incorporated by reference. [TBD — OASIS and Coalition complete
            Schedule A before execution.]
          </p>
          <p>
            OASIS shall <strong>not</strong> share substance-use treatment records (42 CFR Part 2),
            mental-health diagnostic detail, communications-with-counsel records, the contents of
            safety plans, or any data not explicitly listed in Schedule A without a separate written
            amendment to this Agreement.
          </p>
        </section>

        {/* Section 3 — Abuser-blind redaction policy */}
        <section>
          <h2 className="text-base font-semibold">3. Abuser-Blind Redaction Policy</h2>
          <p>
            <strong>3.1 Policy as contract.</strong> The redaction policy executed alongside this
            Agreement is itself a contractual instrument. Each enumerated field is classified as one
            of:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Suppress</strong> — never transmitted to the Coalition under any circumstance.
            </li>
            <li>
              <strong>Aggregate only</strong> — included in cohort counts; never shared
              per-survivor.
            </li>
            <li>
              <strong>Share</strong> — transmitted to authorized Coalition readers per § 4.
            </li>
          </ul>
          <p>
            <strong>3.2 Default policy (abuser-blind by default).</strong> Unless modified in
            writing, the following fields are <strong>suppressed</strong>: current address, current
            employer, child school enrollment. The following are <strong>shareable</strong> as
            identifiers of records (not identifiers of locations): risk-tier band, enrollment
            timestamp, assigned-advocate identifier (id only — never name).
          </p>
          <p>
            <strong>3.3 Amendments to the policy.</strong> Any change to a field&apos;s treatment
            requires a written amendment signed by both parties. Adding a new redactable field also
            requires written amendment. The Coalition&apos;s software reads the policy as the source
            of truth; misalignment between the signed policy and the software&apos;s behavior is a
            contractual breach.
          </p>
          <p>
            <strong>3.4 Re-disclosure.</strong> The Coalition shall not re-disclose individually
            identifiable survivor records to any third party without separate written authorization
            from OASIS, except as required by law. In any disclosure compelled by law, the Coalition
            shall notify OASIS within twenty-four (24) hours unless the notification itself is
            prohibited.
          </p>
        </section>

        {/* Section 4 — Data security */}
        <section>
          <h2 className="text-base font-semibold">4. Data Security and Access Controls</h2>
          <p>
            <strong>4.1 Authorized readers.</strong> The Coalition shall restrict access to survivor
            records to assigned advocates, supervising advocates, and admins on a strict
            need-to-know basis. The list of authorized readers is maintained by the Coalition&apos;s
            data steward and provided to OASIS upon request.
          </p>
          <p>
            <strong>4.2 No enumeration.</strong> The Coalition&apos;s surfaces shall not disclose,
            even to authorized readers, the existence of a survivor record by name-based or
            identifier-guess query (no &ldquo;does this person have an OASIS referral?&rdquo;
            lookups). Records are accessible only via authenticated, role- authorized routes;
            cross-domain joins that would correlate survivor identity with non-survivor records are
            blocked at the policy gate (`src/lib/dtrs/data-access.ts`).
          </p>
          <p>
            <strong>4.3 Audit logging.</strong> Every read of a survivor record is audit-logged. The
            audit table is the source of truth for the cooperation obligation in § 6.3.
          </p>
          <p>
            <strong>4.4 Breach notification.</strong> Any unauthorized access, disclosure, or loss
            of survivor records — including any incident in which an abuser is reasonably suspected
            to have obtained survivor information through Coalition systems — must be reported to
            OASIS within twenty-four (24) hours of discovery, with a written incident report within
            seventy-two (72) hours and immediate suspension of the data flow pending review.
          </p>
        </section>

        {/* Section 5 — Data destruction */}
        <section>
          <h2 className="text-base font-semibold">5. Data Retention and Destruction</h2>
          <p>
            <strong>5.1 Default retention.</strong> Per KRS 209A best practice, the default
            retention is <strong>destruction upon agreement termination</strong>. Longer retention
            windows (3 years, 5 years) are available only with explicit written justification and
            OASIS approval.
          </p>
          <p>
            <strong>5.2 Destruction on termination.</strong> Upon termination, the Coalition shall
            securely destroy or return all survivor records (including backup copies) within thirty
            (30) days. &ldquo;Destruction&rdquo; means irreversible deletion from all systems and
            media holding the records.
          </p>
          <p>
            <strong>5.3 Certification.</strong> The Coalition shall provide OASIS with written
            certification of destruction. OASIS may inspect destruction logs upon reasonable notice.
          </p>
        </section>

        {/* Section 6 — Coordination and reporting */}
        <section>
          <h2 className="text-base font-semibold">6. Coordination and Reporting</h2>
          <p>
            <strong>6.1 Joint case-coordination.</strong> The Coalition and OASIS shall coordinate
            at a cadence agreed upon in Schedule B (default: every two weeks). The agenda shall
            include progress on referrals, emerging risks, and any redaction-policy questions.
            Coordination meetings shall not include any survivor identifying detail beyond what § 3
            permits.
          </p>
          <p>
            <strong>6.2 Aggregate reporting.</strong> The Coalition shall provide OASIS with
            quarterly aggregate reports on outcomes for the cohort: number of survivors successfully
            connected to housing, referral-to-service times, and aggregate risk-tier movement. No
            individually identifying information shall be included in publicly published versions.
          </p>
          <p>
            <strong>6.3 Audit cooperation.</strong> The Coalition shall, upon reasonable notice,
            provide OASIS with access to audit logs and access-control records for the purpose of
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
            Any amendment to this Agreement, including changes to Schedule A or to the redaction
            policy under § 3, must be in writing and signed by authorized representatives of both
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
            obligations under § 5 take effect immediately. OASIS may suspend data flow at any time
            without notice if abuser-blind compliance is in question; suspension is not termination.
          </p>
        </section>

        {/* Section 10 — Governing law */}
        <section>
          <h2 className="text-base font-semibold">10. Governing Law</h2>
          <p>
            This Agreement is governed by the laws of the Commonwealth of Kentucky, including{' '}
            <strong>KRS 209A</strong> (DV-victims-services confidentiality), and applicable federal
            law (Violence Against Women Act, 34 U.S.C. § 12291 et seq.). Any dispute arising under
            this Agreement shall be resolved through good-faith negotiation between the
            Coalition&apos;s data steward and OASIS&apos;s Executive Director before seeking other
            remedies.
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
                Owensboro Area Shelter and
                <br />
                Information Services, Inc. (OASIS)
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
            [TBD — to be completed by OASIS and Coalition before execution. Enumerate the specific
            data elements, file format, transmission method, frequency, retention period, and the
            executed redaction policy per § 3.]
          </p>
        </section>

        <section className="mt-4">
          <h2 className="text-base font-semibold">Schedule B — Contacts</h2>
          <p className="text-muted-foreground italic">
            [TBD — list Coalition data steward and OASIS Executive Director (or designee) names,
            emails, and phone numbers. Include after-hours emergency contact for breach notification
            under § 4.4.]
          </p>
        </section>
      </article>

      {/* Footer note */}
      <footer className="mt-10 border-t pt-6 text-xs text-muted-foreground">
        <p>
          This page is the public template (version <code className="font-mono">oasis-dsa-v1</code>
          ). The signed copy is recorded in the coalition&apos;s partner-agreements registry per{' '}
          <strong>ADR 0004</strong>; the privacy contract this agreement enforces is documented in{' '}
          <strong>ADR 0007</strong>. This template is a starting point — OASIS and Coalition should
          review it with counsel before execution. Fields marked [TBD] require partner-specific
          detail.
        </p>
        <p className="mt-2">
          References: KRS 209A (Kentucky Domestic Violence Victims Services confidentiality);
          Violence Against Women Act, 34 U.S.C. § 12291 et seq.; Campbell, J.C. (2003) Danger
          Assessment, Johns Hopkins School of Nursing (risk-tier framework).
        </p>
      </footer>
    </div>
  );
}
