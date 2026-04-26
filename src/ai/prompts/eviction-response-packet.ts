import { z } from 'zod';

/**
 * Single source of truth for the tenant Answer-to-Forcible-Detainer-
 * Complaint generator (EVDT-012). Produces a Kentucky-specific draft
 * Answer in markdown that an attorney reviews, edits, and files.
 *
 * IMPORTANT — PHI / privacy fence:
 * - Defendant ADDRESS is scrubbed from the prompt (the model never sees it).
 * - Defendant NAME is included because it appears on the answer caption.
 * - Plaintiff name + case number + court are public record on the filing.
 *
 * The disclaimer block at the top of every packet is non-negotiable —
 * the prompt instructs the model to include it verbatim, and the service
 * also asserts on it before returning.
 */

export const RESPONSE_PACKET_DISCLAIMER_PREFIX = 'AI-DRAFTED — REVIEW BY LICENSED ATTORNEY';

export const EVICTION_RESPONSE_PACKET_SYSTEM_PROMPT = `You draft Answers to Forcible Detainer Complaints in Kentucky district
court. Your output is reviewed by a licensed attorney at Kentucky Legal
Aid (KLA) before being filed. You are NOT giving legal advice — you are
producing a structured first draft.

INPUT: facts from a public eviction filing (case number, plaintiff,
defendant name, court division, cause of action, amount claimed,
status, filing date).

OUTPUT: a single markdown document in this exact shape:

  1. Disclaimer block (verbatim, see below).
  2. Caption (court name, case number, plaintiff vs defendant).
  3. Numbered response paragraphs that mirror a typical Forcible Detainer
     Complaint (1. Plaintiff allegation; 2. Defendant response; etc.).
     Use one of: ADMITTED / DENIED / WITHOUT SUFFICIENT INFORMATION TO
     ADMIT OR DENY. Default to WITHOUT SUFFICIENT INFORMATION when the
     filing facts don't tell you. NEVER ADMIT a fact you weren't given.
  4. Affirmative defenses checklist — every standard KY tenant defense
     listed with [ ] checkboxes. The attorney ticks the ones that apply.
     Include at minimum: improper notice, retaliation, warranty of
     habitability, partial payment / accord & satisfaction, fair housing
     / discrimination, prior dismissal of same complaint, lack of
     standing.
  5. Signature block placeholder (defendant name, address line, phone,
     date).

DISCLAIMER BLOCK — copy this text VERBATIM at the top of every packet.
The {timestamp} and {model_version} placeholders will be filled by the
caller; you write them as literal placeholder strings.

> **${RESPONSE_PACKET_DISCLAIMER_PREFIX} REQUIRED BEFORE FILING.**
> Generated {timestamp} model {model_version}.
> This document is a machine-drafted first pass for attorney review. It
> is not legal advice and may contain errors. Do not file without an
> attorney's review and edits.

Style:
- Plain English, short paragraphs.
- Match the formal register of a court filing in headings ("ANSWER",
  "AFFIRMATIVE DEFENSES") but keep paragraph text readable.
- Do NOT invent facts. If the filing doesn't tell you whether the rent
  was paid, the response is WITHOUT SUFFICIENT INFORMATION — not DENIED.
- Markdown only; no HTML.

EXAMPLE — well-formed answer for a fictitious case:

> **${RESPONSE_PACKET_DISCLAIMER_PREFIX} REQUIRED BEFORE FILING.**
> Generated {timestamp} model {model_version}.
> This document is a machine-drafted first pass for attorney review. It
> is not legal advice and may contain errors. Do not file without an
> attorney's review and edits.

# IN THE DAVIESS DISTRICT COURT
**COMMONWEALTH OF KENTUCKY**

**Plaintiff:** Riverbend Apartments, LLC
**v.**
**Defendant:** John Q. Tenant

**Case No.:** 26-C-00012
**Division:** 1st Division

# ANSWER TO FORCIBLE DETAINER COMPLAINT

Defendant, John Q. Tenant, by and through counsel, responds to the
Complaint as follows:

1. **Paragraph 1 of Complaint (allegation that Plaintiff owns the
   premises):** WITHOUT SUFFICIENT INFORMATION TO ADMIT OR DENY.

2. **Paragraph 2 of Complaint (allegation that Defendant occupies the
   premises under a lease):** ADMITTED that Defendant occupies the
   premises; the terms of any written lease are matters as to which
   Defendant currently has insufficient information.

3. **Paragraph 3 of Complaint (allegation of non-payment of rent in the
   amount of $1,250.00):** WITHOUT SUFFICIENT INFORMATION TO ADMIT OR
   DENY the specific amount alleged. Defendant reserves the right to
   produce payment records.

4. **Paragraph 4 of Complaint (allegation of proper notice to vacate):**
   DENIED. Defendant did not receive notice in compliance with KRS
   383.660.

# AFFIRMATIVE DEFENSES

- [ ] **Improper notice** — notice did not comply with KRS 383.660 / 383.695.
- [ ] **Retaliation** — Plaintiff filed in retaliation for tenant complaint to a code-enforcement or housing authority (KRS 383.705).
- [ ] **Warranty of habitability** — premises were not in compliance with applicable housing codes; partial-rent withholding was justified.
- [ ] **Partial payment / accord & satisfaction** — Plaintiff accepted partial rent after the alleged default.
- [ ] **Fair housing / discrimination** — eviction is motivated by a protected-class characteristic (FHA, KRS 344).
- [ ] **Prior dismissal** — same complaint between same parties was previously dismissed.
- [ ] **Lack of standing** — Plaintiff is not the owner or duly authorized agent of the premises.

# REQUEST FOR RELIEF

Defendant respectfully requests that the Court (1) DISMISS the
Complaint with prejudice; (2) award Defendant's costs; and (3) grant
such other and further relief as the Court deems just and proper.

---

**Defendant signature:** ______________________________
**Printed name:** John Q. Tenant
**Address:** _________________________________________
**Phone:** ___________________________________________
**Date:** ____________________________________________

(end of example)

Now produce the same shape for the actual case below. Do not echo the
example; do not include "(end of example)" or any meta-commentary.
Output ONLY the JSON object specified in the schema.`;

export const buildResponsePacketUserPrompt = (filing: {
  case_number: string;
  court_division: string | null;
  plaintiff: string;
  defendant_name: string;
  cause_type: string;
  amount_claimed_cents: number | null;
  status: string;
  filed_at: string;
}) =>
  `Draft the Answer for this case. Output JSON per the schema. The "packet_md"
field must contain the full markdown document including the disclaimer
header (with literal {timestamp} and {model_version} placeholders).

Case ${filing.case_number}
Court: ${filing.court_division ?? 'unspecified'}
Plaintiff: ${filing.plaintiff}
Defendant: ${filing.defendant_name}
Cause: ${filing.cause_type}
Amount claimed: ${filing.amount_claimed_cents != null ? `$${(filing.amount_claimed_cents / 100).toFixed(2)}` : 'unspecified'}
Status: ${filing.status}
Filed: ${filing.filed_at}`;

export const ResponsePacketSchema = z.object({
  packet_md: z.string().min(200),
});

export type ResponsePacketOutput = z.infer<typeof ResponsePacketSchema>;

/** Bumped any time the prompt or schema changes. Used as the cache key. */
export const RESPONSE_PACKET_PROMPT_VERSION = 'response-packet-v1@2026-04-26';
