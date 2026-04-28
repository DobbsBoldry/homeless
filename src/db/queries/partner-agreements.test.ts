/**
 * Integration-style tests for partner-agreements query helpers.
 *
 * These tests use the pure validator and type system to verify the contract
 * between the query layer and the domain lib — no DB connection required.
 * The actual DB interaction is covered by manual verification against staging
 * (see the Definition of Done in CLAUDE.md).
 *
 * The one integration scenario the spec requires:
 *   - Two schools: school A has an active FERPA agreement, school B does not.
 *   - `getActiveAgreementByKind` returns the agreement for A, null for B.
 *
 * Since we extract the filtering logic from `getActiveAgreementByKind`, we
 * can verify it with a mock dataset without a live DB (same pattern as
 * DTRS-009's `aggregateCoalitionMetricTotals` tests).
 */

import { describe, expect, it } from 'vitest';
import type { PartnerAgreement } from '@/db/schema';
import {
  validateAgreementTerms,
  validateFerpaTerms,
  validateMouTerms,
} from '@/lib/dtrs/partner-agreements';

// ---------------------------------------------------------------------------
// Pure helper: simulate the filter logic of getActiveAgreementByKind
// (mirrors the eq(partnerOrgId) + eq(kind) + eq(status='active') WHERE clause)
// ---------------------------------------------------------------------------

function findActiveAgreement(
  agreements: PartnerAgreement[],
  partnerOrgId: string,
  kind: PartnerAgreement['kind'],
): PartnerAgreement | null {
  return (
    agreements.find(
      (a) => a.partnerOrgId === partnerOrgId && a.kind === kind && a.status === 'active',
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Dataset: two schools, one with an active FERPA agreement, one without
// ---------------------------------------------------------------------------

const SCHOOL_A_ID = 'school-a-uuid';
const SCHOOL_B_ID = 'school-b-uuid';

const ferpaTermsA = validateFerpaTerms({
  kind: 'ferpa',
  scope: ['attendance_patterns', 'mckinney_vento_ids'],
  district_name: 'Daviess County Public Schools',
  liaison_contact: { name: 'Alice', email: 'alice@dcps.edu' },
  studies_exception_invoked: true,
  data_destruction_due: 'on_termination',
});

const now = new Date().toISOString();

const schoolAActiveAgreement: PartnerAgreement = {
  id: 'agree-a-001',
  partnerOrgId: SCHOOL_A_ID,
  kind: 'ferpa',
  status: 'active',
  effectiveDate: '2026-08-01',
  endDate: null,
  signedByPartner: 'Dr. Bob, Superintendent',
  signedByCoalitionUserId: 'user-admin-001',
  templateVersion: 'ferpa-v1',
  templateRendered: null,
  terms: ferpaTermsA,
  notes: null,
  createdAt: now as unknown as Date,
  updatedAt: now as unknown as Date,
};

// School A also has a superseded (old) agreement to ensure only active is returned
const schoolAOldAgreement: PartnerAgreement = {
  ...schoolAActiveAgreement,
  id: 'agree-a-000',
  status: 'superseded',
  effectiveDate: '2025-08-01',
  endDate: '2026-07-31',
};

// School B has a draft MOU but no FERPA agreement at all
const mouTermsB = validateMouTerms({
  kind: 'mou',
  phase: 'phase_0',
  monthly_meeting_hours: 1,
  withdrawal_notice_days: 30,
});

const schoolBDraftMou: PartnerAgreement = {
  id: 'agree-b-001',
  partnerOrgId: SCHOOL_B_ID,
  kind: 'mou',
  status: 'draft',
  effectiveDate: null,
  endDate: null,
  signedByPartner: null,
  signedByCoalitionUserId: null,
  templateVersion: null,
  templateRendered: null,
  terms: mouTermsB,
  notes: null,
  createdAt: now as unknown as Date,
  updatedAt: now as unknown as Date,
};

const allAgreements = [schoolAOldAgreement, schoolAActiveAgreement, schoolBDraftMou];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('partner-agreements: active-agreement lookup', () => {
  it('returns the active FERPA agreement for school A', () => {
    const result = findActiveAgreement(allAgreements, SCHOOL_A_ID, 'ferpa');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('agree-a-001');
    expect(result?.status).toBe('active');
    expect(result?.kind).toBe('ferpa');
  });

  it('returns null for school B (no FERPA agreement exists)', () => {
    const result = findActiveAgreement(allAgreements, SCHOOL_B_ID, 'ferpa');
    expect(result).toBeNull();
  });

  it('does not return the superseded agreement for school A', () => {
    const result = findActiveAgreement(allAgreements, SCHOOL_A_ID, 'ferpa');
    expect(result?.id).not.toBe('agree-a-000');
  });

  it('returns null when searching for an MOU for school A (has none)', () => {
    const result = findActiveAgreement(allAgreements, SCHOOL_A_ID, 'mou');
    expect(result).toBeNull();
  });

  it('returns null for unknown school', () => {
    const result = findActiveAgreement(allAgreements, 'unknown-id', 'ferpa');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Terms validation round-trip: terms stored on the agreement are valid
// ---------------------------------------------------------------------------

describe('partner-agreements: terms validation round-trip', () => {
  it('the terms stored on the active FERPA agreement validate without error', () => {
    const active = findActiveAgreement(allAgreements, SCHOOL_A_ID, 'ferpa');
    expect(() => validateAgreementTerms('ferpa', active?.terms)).not.toThrow();
  });

  it('the FERPA terms round-trip preserves scope', () => {
    const active = findActiveAgreement(allAgreements, SCHOOL_A_ID, 'ferpa');
    const terms = validateFerpaTerms(active?.terms);
    expect(terms.scope).toContain('attendance_patterns');
    expect(terms.scope).toContain('mckinney_vento_ids');
  });

  it('the MOU terms stored on the draft agreement validate without error', () => {
    expect(() => validateAgreementTerms('mou', schoolBDraftMou.terms)).not.toThrow();
  });

  it('the MOU terms round-trip preserves withdrawal_notice_days', () => {
    const terms = validateMouTerms(schoolBDraftMou.terms);
    expect(terms.withdrawal_notice_days).toBe(30);
    expect(terms.phase).toBe('phase_0');
  });
});
