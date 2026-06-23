/**
 * COOR-012 — handoff state machine + governance gate tests.
 *
 * Covers:
 *   - validateRequestedScope (pure)
 *   - computeExpiresAt (pure)
 *   - nextStatus (pure)
 *   - assertHandoffPermitted (mocked DB)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertHandoffPermitted,
  computeExpiresAt,
  DEFAULT_HANDOFF_TTL_DAYS,
  HandoffGateDeniedError,
  nextStatus,
  validateRequestedScope,
} from './handoff';

const loadOrgGateState = vi.fn();

vi.mock('@/db/queries/case-handoffs', () => ({
  loadOrgGateState: (...args: unknown[]) => loadOrgGateState(...args),
}));

beforeEach(() => {
  loadOrgGateState.mockReset();
});

describe('validateRequestedScope', () => {
  it('returns the unique scope kinds in array order', () => {
    expect(validateRequestedScope(['intakes', 'case_notes'])).toEqual(['intakes', 'case_notes']);
  });

  it('dedupes repeats', () => {
    expect(validateRequestedScope(['intakes', 'intakes', 'case_notes'])).toEqual([
      'intakes',
      'case_notes',
    ]);
  });

  it('throws empty_scope on empty array', () => {
    try {
      validateRequestedScope([]);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HandoffGateDeniedError);
      expect((err as HandoffGateDeniedError).reason).toBe('empty_scope');
    }
  });

  it('throws invalid_scope_kind on unknown kind', () => {
    try {
      validateRequestedScope(['intakes', 'medical_records']);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HandoffGateDeniedError);
      expect((err as HandoffGateDeniedError).reason).toBe('invalid_scope_kind');
    }
  });

  it('rejects the dropped triage_overrides kind', () => {
    // triage_overrides is intentionally NOT a scope kind because the table
    // has no synthetic_person_ref column. Belt-and-suspenders check.
    try {
      validateRequestedScope(['triage_overrides']);
      expect.fail('expected throw');
    } catch (err) {
      expect((err as HandoffGateDeniedError).reason).toBe('invalid_scope_kind');
    }
  });
});

describe('computeExpiresAt', () => {
  it('adds the default 30 days to now', () => {
    const now = new Date('2026-05-04T12:00:00Z');
    const out = computeExpiresAt(now);
    expect(out.toISOString()).toBe('2026-06-03T12:00:00.000Z');
    expect(DEFAULT_HANDOFF_TTL_DAYS).toBe(30);
  });

  it('honors a custom TTL', () => {
    const now = new Date('2026-05-04T12:00:00Z');
    expect(computeExpiresAt(now, 7).toISOString()).toBe('2026-05-11T12:00:00.000Z');
  });

  it('does not mutate the input', () => {
    const now = new Date('2026-05-04T12:00:00Z');
    computeExpiresAt(now);
    expect(now.toISOString()).toBe('2026-05-04T12:00:00.000Z');
  });
});

describe('nextStatus', () => {
  it('pending_consent → pending_acceptance on consent_recorded', () => {
    expect(nextStatus('pending_consent', 'consent_recorded')).toBe('pending_acceptance');
  });

  it('pending_acceptance → accepted on accept', () => {
    expect(nextStatus('pending_acceptance', 'accept')).toBe('accepted');
  });

  it('accept event is rejected outside pending_acceptance', () => {
    expect(nextStatus('pending_consent', 'accept')).toBeNull();
    expect(nextStatus('accepted', 'accept')).toBeNull();
    expect(nextStatus('declined', 'accept')).toBeNull();
  });

  it('decline + revoke + expire allowed in either pre-acceptance state', () => {
    for (const event of ['decline', 'revoke', 'expire'] as const) {
      expect(nextStatus('pending_consent', event)).not.toBeNull();
      expect(nextStatus('pending_acceptance', event)).not.toBeNull();
    }
  });

  it('terminal states reject all events', () => {
    for (const status of ['accepted', 'declined', 'revoked', 'expired'] as const) {
      for (const event of ['consent_recorded', 'accept', 'decline', 'revoke', 'expire'] as const) {
        expect(nextStatus(status, event)).toBeNull();
      }
    }
  });
});

describe('assertHandoffPermitted', () => {
  const activeOrg = { id: 'org-a', active: true, hasActiveAgreement: true };

  it('allows when both orgs are active and have an agreement', async () => {
    loadOrgGateState
      .mockResolvedValueOnce({ ...activeOrg, id: 'org-from' })
      .mockResolvedValueOnce({ ...activeOrg, id: 'org-to' });

    await expect(assertHandoffPermitted('org-from', 'org-to')).resolves.toBeUndefined();
  });

  it('rejects same-org handoffs without hitting the DB', async () => {
    try {
      await assertHandoffPermitted('org-a', 'org-a');
      expect.fail('expected throw');
    } catch (err) {
      expect((err as HandoffGateDeniedError).reason).toBe('same_org');
    }
    expect(loadOrgGateState).not.toHaveBeenCalled();
  });

  it('rejects unknown_from_org when initiator org missing', async () => {
    loadOrgGateState
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...activeOrg, id: 'org-to' });
    try {
      await assertHandoffPermitted('org-missing', 'org-to');
      expect.fail('expected throw');
    } catch (err) {
      expect((err as HandoffGateDeniedError).reason).toBe('unknown_from_org');
    }
  });

  it('rejects unknown_to_org when receiver org missing', async () => {
    loadOrgGateState
      .mockResolvedValueOnce({ ...activeOrg, id: 'org-from' })
      .mockResolvedValueOnce(null);
    try {
      await assertHandoffPermitted('org-from', 'org-missing');
      expect.fail('expected throw');
    } catch (err) {
      expect((err as HandoffGateDeniedError).reason).toBe('unknown_to_org');
    }
  });

  it('rejects from_org_inactive when initiator is deactivated', async () => {
    loadOrgGateState
      .mockResolvedValueOnce({ id: 'org-from', active: false, hasActiveAgreement: true })
      .mockResolvedValueOnce({ ...activeOrg, id: 'org-to' });
    try {
      await assertHandoffPermitted('org-from', 'org-to');
      expect.fail('expected throw');
    } catch (err) {
      expect((err as HandoffGateDeniedError).reason).toBe('from_org_inactive');
    }
  });

  it('rejects to_org_inactive when receiver is deactivated', async () => {
    loadOrgGateState
      .mockResolvedValueOnce({ ...activeOrg, id: 'org-from' })
      .mockResolvedValueOnce({ id: 'org-to', active: false, hasActiveAgreement: true });
    try {
      await assertHandoffPermitted('org-from', 'org-to');
      expect.fail('expected throw');
    } catch (err) {
      expect((err as HandoffGateDeniedError).reason).toBe('to_org_inactive');
    }
  });

  it('rejects from_org_no_active_agreement when initiator lacks an agreement', async () => {
    loadOrgGateState
      .mockResolvedValueOnce({ id: 'org-from', active: true, hasActiveAgreement: false })
      .mockResolvedValueOnce({ ...activeOrg, id: 'org-to' });
    try {
      await assertHandoffPermitted('org-from', 'org-to');
      expect.fail('expected throw');
    } catch (err) {
      expect((err as HandoffGateDeniedError).reason).toBe('from_org_no_active_agreement');
    }
  });

  it('rejects to_org_no_active_agreement when receiver lacks an agreement', async () => {
    loadOrgGateState
      .mockResolvedValueOnce({ ...activeOrg, id: 'org-from' })
      .mockResolvedValueOnce({ id: 'org-to', active: true, hasActiveAgreement: false });
    try {
      await assertHandoffPermitted('org-from', 'org-to');
      expect.fail('expected throw');
    } catch (err) {
      expect((err as HandoffGateDeniedError).reason).toBe('to_org_no_active_agreement');
    }
  });
});
