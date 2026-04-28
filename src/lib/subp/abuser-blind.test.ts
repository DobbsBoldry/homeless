/**
 * Tests for the abuser-blind authorization middleware (ADR 0007).
 *
 * The most security-critical tests in this codebase. Negative cases are
 * load-bearing — when this gate gets it wrong, an abuser obtains a
 * survivor's location through a coalition data leak. Treat every "denied"
 * test as a regression alarm.
 */

import { describe, expect, it } from 'vitest';
import {
  AbuserBlindDeniedError,
  type AdvocateAuthInput,
  isAuthorizedReader,
  requireSurvivorReader,
  type SurvivorRow,
} from './abuser-blind';

const advocateAlice: AdvocateAuthInput = { id: 'user-alice', role: 'caseworker' };
const advocateBob: AdvocateAuthInput = { id: 'user-bob', role: 'caseworker' };
const adminAlex: AdvocateAuthInput = { id: 'user-alex', role: 'admin' };
const attorneyAva: AdvocateAuthInput = { id: 'user-ava', role: 'attorney' };

const survivorAssignedAlice: SurvivorRow = {
  id: 'survivor-001',
  assignedAdvocateUserId: 'user-alice',
};
const survivorUnassigned: SurvivorRow = {
  id: 'survivor-002',
  assignedAdvocateUserId: null,
};

describe('isAuthorizedReader', () => {
  it('allows the assigned advocate', () => {
    const r = isAuthorizedReader(advocateAlice, survivorAssignedAlice);
    expect(r.allowed).toBe(true);
  });

  it('allows admin even when not assigned', () => {
    const r = isAuthorizedReader(adminAlex, survivorAssignedAlice);
    expect(r.allowed).toBe(true);
  });

  it('allows admin on unassigned survivors (admin-only triage window)', () => {
    const r = isAuthorizedReader(adminAlex, survivorUnassigned);
    expect(r.allowed).toBe(true);
  });

  it('DENIES a caseworker who is NOT the assigned advocate', () => {
    const r = isAuthorizedReader(advocateBob, survivorAssignedAlice);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('not_assigned_advocate');
  });

  it('DENIES a caseworker on an unassigned survivor (no admin override)', () => {
    const r = isAuthorizedReader(advocateAlice, survivorUnassigned);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('survivor_unassigned');
  });

  it('DENIES an attorney even with assignment match (no ROI workflow yet)', () => {
    // Attorneys may receive ROI-based access in a future story; until then, deny.
    const survivorAssignedAttorney = {
      ...survivorAssignedAlice,
      assignedAdvocateUserId: 'user-ava',
    };
    const r = isAuthorizedReader(attorneyAva, survivorAssignedAttorney);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('role_not_authorized');
  });

  it('DENIES a caseworker viewer with empty/missing id (defensive)', () => {
    const r = isAuthorizedReader({ id: '', role: 'caseworker' }, survivorAssignedAlice);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('viewer_id_missing');
  });

  it('DENIES across all role values that are not admin/caseworker', () => {
    // Exhaustive over the union; if a new role lands without thinking through
    // DV access, this test fails at compile time (assignment to UserRole).
    for (const role of ['attorney'] as const) {
      const r = isAuthorizedReader({ id: 'u', role }, survivorAssignedAlice);
      expect(r.allowed).toBe(false);
    }
  });
});

describe('requireSurvivorReader', () => {
  it('returns silently when authorized (assigned advocate)', () => {
    expect(() => requireSurvivorReader(advocateAlice, survivorAssignedAlice)).not.toThrow();
  });

  it('returns silently when authorized (admin)', () => {
    expect(() => requireSurvivorReader(adminAlex, survivorUnassigned)).not.toThrow();
  });

  it('throws AbuserBlindDeniedError on unassigned-caseworker mismatch', () => {
    expect(() => requireSurvivorReader(advocateBob, survivorAssignedAlice)).toThrow(
      AbuserBlindDeniedError,
    );
  });

  it('error carries the structured reason', () => {
    try {
      requireSurvivorReader(attorneyAva, survivorAssignedAlice);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AbuserBlindDeniedError);
      if (err instanceof AbuserBlindDeniedError) {
        expect(err.reason).toBe('role_not_authorized');
      }
    }
  });

  it('error message does NOT echo survivor id (no enumeration)', () => {
    // Per ADR 0007 § Decision rule 5, error messages must not surface
    // the survivor id — that turns auth-failure into an enumeration oracle.
    try {
      requireSurvivorReader(advocateBob, survivorAssignedAlice);
    } catch (err) {
      if (err instanceof AbuserBlindDeniedError) {
        expect(err.message).not.toContain(survivorAssignedAlice.id);
      }
    }
  });
});
