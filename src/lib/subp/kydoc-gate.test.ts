/**
 * SUBP-005 — KY DOC gate tests.
 *
 * Mocks `getActiveAgreementByKind` from the partner-agreements query layer
 * and asserts the five gate decisions: allow / deny-no-dsa /
 * deny-wrong-agency / deny-not-authorized / deny-attestation-missing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkKyDocGate, KyDocGateDeniedError, requireKyDocIndividualRecords } from './kydoc-gate';

const getActiveAgreementByKind = vi.fn();

vi.mock('@/db/queries/partner-agreements', () => ({
  getActiveAgreementByKind: (...args: unknown[]) => getActiveAgreementByKind(...args),
}));

const validKyDocAgreement = {
  id: 'agreement-uuid-002',
  partnerOrgId: 'kydoc-uuid-001',
  kind: 'dsa',
  status: 'active',
  terms: {
    kind: 'dsa',
    agency: 'ky_doc',
    scope: ['pre_release_roster'],
    agency_legal_name: 'Kentucky Department of Corrections',
    state_contact: { name: 'R', title: 'T', email: 'r@ky.gov' },
    population_focus: 'pre_release',
    pre_release_window_days: 60,
    individual_records_authorized: true,
    no_recidivism_prediction_attestation: true,
    data_destruction_due: 'on_termination',
  },
};

beforeEach(() => {
  getActiveAgreementByKind.mockReset();
});

describe('checkKyDocGate', () => {
  it('allows when an active KY DOC DSA exists with both authorizations', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce(validKyDocAgreement);
    const decision = await checkKyDocGate('kydoc-uuid-001');
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.agreementId).toBe('agreement-uuid-002');
      expect(decision.terms.agency).toBe('ky_doc');
      expect(decision.terms.pre_release_window_days).toBe(60);
    }
  });

  it('denies with no_active_dsa when no agreement exists', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce(null);
    const decision = await checkKyDocGate('kydoc-uuid-001');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('no_active_dsa');
  });

  it('denies with wrong_agency when terms.agency is not ky_doc', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validKyDocAgreement,
      terms: { ...validKyDocAgreement.terms, agency: 'dcbs' },
    });
    const decision = await checkKyDocGate('kydoc-uuid-001');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('wrong_agency');
  });

  it('denies with wrong_agency when terms.kind is not dsa', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validKyDocAgreement,
      terms: { ...validKyDocAgreement.terms, kind: 'mou' },
    });
    const decision = await checkKyDocGate('kydoc-uuid-001');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('wrong_agency');
  });

  it('denies with individual_records_not_authorized when flag is false', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validKyDocAgreement,
      terms: { ...validKyDocAgreement.terms, individual_records_authorized: false },
    });
    const decision = await checkKyDocGate('kydoc-uuid-001');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('individual_records_not_authorized');
  });

  it('denies with no_recidivism_prediction_not_attested when flag is false', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validKyDocAgreement,
      terms: { ...validKyDocAgreement.terms, no_recidivism_prediction_attestation: false },
    });
    const decision = await checkKyDocGate('kydoc-uuid-001');
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('no_recidivism_prediction_not_attested');
  });
});

describe('requireKyDocIndividualRecords', () => {
  it('returns the agreement on allow', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce(validKyDocAgreement);
    const result = await requireKyDocIndividualRecords('kydoc-uuid-001');
    expect(result.agreementId).toBe('agreement-uuid-002');
    expect(result.terms.pre_release_window_days).toBe(60);
  });

  it('throws KyDocGateDeniedError on no_active_dsa', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce(null);
    await expect(requireKyDocIndividualRecords('kydoc-uuid-001')).rejects.toThrow(
      KyDocGateDeniedError,
    );
    await expect(requireKyDocIndividualRecords('kydoc-uuid-001')).rejects.toThrow(
      /no active Data-Sharing Agreement/i,
    );
  });

  it('throws with reason=wrong_agency', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validKyDocAgreement,
      terms: { ...validKyDocAgreement.terms, agency: 'dcbs' },
    });
    try {
      await requireKyDocIndividualRecords('kydoc-uuid-001');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(KyDocGateDeniedError);
      if (err instanceof KyDocGateDeniedError) expect(err.reason).toBe('wrong_agency');
    }
  });

  it('throws with reason=individual_records_not_authorized', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validKyDocAgreement,
      terms: { ...validKyDocAgreement.terms, individual_records_authorized: false },
    });
    try {
      await requireKyDocIndividualRecords('kydoc-uuid-001');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(KyDocGateDeniedError);
      if (err instanceof KyDocGateDeniedError) {
        expect(err.reason).toBe('individual_records_not_authorized');
      }
    }
  });

  it('throws with reason=no_recidivism_prediction_not_attested when attestation missing', async () => {
    getActiveAgreementByKind.mockResolvedValueOnce({
      ...validKyDocAgreement,
      terms: { ...validKyDocAgreement.terms, no_recidivism_prediction_attestation: false },
    });
    try {
      await requireKyDocIndividualRecords('kydoc-uuid-001');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(KyDocGateDeniedError);
      if (err instanceof KyDocGateDeniedError) {
        expect(err.reason).toBe('no_recidivism_prediction_not_attested');
      }
    }
  });
});
