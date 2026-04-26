import { describe, expect, it } from 'vitest';
import type { EvictionFiling } from '@/db/schema/eviction-filings';
import { renderPacketPdf } from './packet-pdf';

const filing: EvictionFiling = {
  id: '00000000-0000-0000-0000-000000000001',
  caseNumber: 'SYN-26-CI-00099',
  filedAt: new Date('2026-04-20T10:00:00-05:00'),
  courtDivision: '1st Division',
  plaintiff: 'Test Apartments LLC',
  defendantFirstName: 'Marcus',
  defendantLastName: 'Synthwell',
  defendantAddress: '123 Synth St',
  causeType: 'non_payment',
  amountClaimedCents: 145000,
  status: 'filed',
  source: 'synthetic',
  rawJson: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const samplePacket = `> **AI-DRAFTED — REVIEW BY LICENSED ATTORNEY REQUIRED BEFORE FILING.**
> Generated 2026-04-26T00:00:00.000Z model response-packet-v1@2026-04-26.
> This document is a machine-drafted first pass for attorney review. It is not legal advice and may contain errors. Do not file without an attorney's review and edits.

# IN THE DAVIESS DISTRICT COURT

**Plaintiff:** Test Apartments LLC
**Defendant:** Marcus Synthwell
**Case No.:** SYN-26-CI-00099

# ANSWER TO FORCIBLE DETAINER COMPLAINT

1. **Paragraph 1 (ownership):** WITHOUT SUFFICIENT INFORMATION TO ADMIT OR DENY.
2. **Paragraph 2 (occupancy):** ADMITTED.
3. **Paragraph 3 (non-payment of $1,450):** WITHOUT SUFFICIENT INFORMATION.

# AFFIRMATIVE DEFENSES

- [ ] Improper notice
- [ ] Retaliation
- [ ] Warranty of habitability
- [ ] Partial payment / accord & satisfaction
- [ ] Fair housing / discrimination

---

**Defendant signature:** ______________________________
`;

describe('renderPacketPdf', () => {
  it('produces a non-empty PDF buffer with the PDF magic header', async () => {
    const bytes = await renderPacketPdf({ packetMd: samplePacket, filing });
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // PDF files start with `%PDF-`
    const header = bytes.subarray(0, 5).toString('utf8');
    expect(header).toBe('%PDF-');
    // And end with `%%EOF` (typically the last 6-7 bytes including newline)
    const tail = bytes.subarray(-20).toString('utf8');
    expect(tail.includes('%%EOF')).toBe(true);
  });

  it('embeds the case number in the PDF metadata', async () => {
    const bytes = await renderPacketPdf({ packetMd: samplePacket, filing });
    // Title is in the doc info dict — appears as plain text in the binary
    expect(bytes.includes(Buffer.from(filing.caseNumber, 'utf8'))).toBe(true);
  });
});
