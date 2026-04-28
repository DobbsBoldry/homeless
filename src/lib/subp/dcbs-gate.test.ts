/**
 * SUBP-001 — DCBS gate tests.
 *
 * Mocks `getActiveAgreementByKind` from the partner-agreements query layer
 * and asserts the four gate decisions: allow / deny-no-dsa /
 * deny-wrong-agency / deny-not-authorized.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DcbsGateDeniedError,
  checkDcbsGate,
  requireDcbsIndividualRecords,
} from './dcbs-gate';

const getActiveAgreementByKind = vi.fn();

vi.mock('@/db/queries/partner-agreements', () => ({
  getActiveAgreementByKind: (...args: unknown[]) => getActiveAgreementByKind(...args),
}));

const validDcbsAgreement = {
  id: 'agreement-uuid-001',
  partnerOrgId: 'dcbs-uuid-001',
  kind: 'dsa',
  status: 'active',
  terms: {
    kind: 'dsa',
    agency: 'dcbs',
    scope: ['foster_aging_out_roster'],
    agency_legal_name: 'KY CHFS / DCBS',
    state_contact: { name: 'R', title: 'T', email: 'r@ky.gov' },
    population_focus: 'foster_aging_out',
    individual_records_authorized: true,
    data_destruction_due: 'on_termination',
  },
};

beforeEach(() => {
  getActiveAgreementByKind.mockReset();
});

describe('checkDcbsGate', () => {
  it('allows when an active DCBS DSA exists with individual_records_authorized=true', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce(validDcbsAgreement);
    const decision = await checkDcbsGate('dcbs-uuid-001');
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.agreementId).toBe('agreement-uuid-001');
      expect(decision.terms.agency).toBe('dcbs');
    }
  });

  it('denies with no_active_dsa when no agreement exists', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce(null);
    const decision = await checkDcbsGate('dcbs-uuid-001');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('no_active_dsa');
  });

  it('denies with wrong_agency when terms.agency is not dcbs', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validDcbsAgreement,
      terms: { ...validDcbsAgreement.terms, agency: 'ky_doc' },
    });
    const decision = await checkDcbsGate('dcbs-uuid-001');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('wrong_agency');
  });

  it('denies with wrong_agency when terms.kind is not dsa', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validDcbsAgreement,
      terms: { ...validDcbsAgreement.terms, kind: 'mou' },
    });
    const decision = await checkDcbsGate('dcbs-uuid-001');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('wrong_agency');
  });

  it('denies with individual_records_not_authorized when flag is false', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validDcbsAgreement,
      terms: { ...validDcbsAgreement.terms, individual_records_authorized: false },
    });
    const decision = await checkDcbsGate('dcbs-uuid-001');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('individual_records_not_authorized');
  });
});

describe('requireDcbsIndividualRecords', () => {
  it('returns the agreement on allow', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce(validDcbsAgreement);
    const result = await requireDcbsIndividualRecords('dcbs-uuid-001');
    expect(result.agreementId).toBe('agreement-uuid-001');
  });

  it('throws DcbsGateDeniedError on no_active_dsa', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce(null);
    await expect(requireDcbsIndividualRecords('dcbs-uuid-001')).rejects.toThrow(
      DcbsGateDeniedError,
    );
    await expect(requireDcbsIndividualRecords('dcbs-uuid-001')).rejects.toThrow(
      /no active Data-Sharing Agreement/i,
    );
  });

  it('throws with reason=wrong_agency', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validDcbsAgreement,
      terms: { ...validDcbsAgreement.terms, agency: 'ky_doc' },
    });
    try {
      await requireDcbsIndividualRecords('dcbs-uuid-001');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DcbsGateDeniedError);
      if (err instanceof DcbsGateDeniedError) expect(err.reason).toBe('wrong_agency');
    }
  });

  it('throws with reason=individual_records_not_authorized', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validDcbsAgreement,
      terms: { ...validDcbsAgreement.terms, individual_records_authorized: false },
    });
    try {
      await requireDcbsIndividualRecords('dcbs-uuid-001');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DcbsGateDeniedError);
      if (err instanceof DcbsGateDeniedError) {
        expect(err.reason).toBe('individual_records_not_authorized');
      }
    }
  });
});
