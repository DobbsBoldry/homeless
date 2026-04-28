/**
 * PRVN-001 — first-time-homeless classifier tests.
 *
 * Pure function. The classifier reads a chronological encounter
 * sequence for one patient and identifies the transition point — the
 * earliest encounter where housing flipped from "housed / unknown" to
 * "shelter / unsheltered". The alert use case (caseworker outreach
 * before discharge) fires when that transition is the most recent
 * encounter — i.e. the patient is being discharged into homelessness
 * for the first time on coalition record.
 */

import { describe, expect, it } from 'vitest';
import {
  classifyFirstTimeHomeless,
  type EncounterForClassification,
  HOMELESS_HOUSING_STATUSES,
} from './first-time-homeless';

const enc = (
  id: string,
  arrivedAt: string,
  housingStatus: EncounterForClassification['housingStatus'],
): EncounterForClassification => ({ id, arrivedAt: new Date(arrivedAt), housingStatus });

describe('classifyFirstTimeHomeless', () => {
  it('returns null transition when patient was never housing-flagged', () => {
    const r = classifyFirstTimeHomeless([
      enc('e1', '2026-01-01', 'housed'),
      enc('e2', '2026-02-01', 'housed'),
      enc('e3', '2026-03-01', 'unknown'),
    ]);
    expect(r.transitionEncounterId).toBeNull();
    expect(r.isAlertCandidate).toBe(false);
  });

  it('flags first-time-homeless when transition is the most recent encounter', () => {
    const r = classifyFirstTimeHomeless([
      enc('e1', '2026-01-01', 'housed'),
      enc('e2', '2026-02-01', 'housed'),
      enc('e3', '2026-03-01', 'unsheltered'),
    ]);
    expect(r.transitionEncounterId).toBe('e3');
    expect(r.encountersBefore).toBe(2);
    expect(r.isAlertCandidate).toBe(true);
  });

  it('does NOT flag alert when transition is an OLDER encounter (no longer first-time)', () => {
    const r = classifyFirstTimeHomeless([
      enc('e1', '2026-01-01', 'housed'),
      enc('e2', '2026-02-01', 'unsheltered'),
      enc('e3', '2026-03-01', 'shelter'),
    ]);
    // Transition was e2; e3 is also homeless but no longer the FIRST time.
    expect(r.transitionEncounterId).toBe('e2');
    expect(r.isAlertCandidate).toBe(false);
  });

  it('treats shelter and unsheltered both as homeless', () => {
    const r = classifyFirstTimeHomeless([
      enc('e1', '2026-01-01', 'doubled_up'),
      enc('e2', '2026-02-01', 'shelter'),
    ]);
    expect(r.transitionEncounterId).toBe('e2');
    expect(r.isAlertCandidate).toBe(true);
  });

  it('treats doubled_up as NOT homeless (first-time-homeless is the unsheltered/shelter step)', () => {
    const r = classifyFirstTimeHomeless([
      enc('e1', '2026-01-01', 'housed'),
      enc('e2', '2026-02-01', 'doubled_up'),
      enc('e3', '2026-03-01', 'doubled_up'),
    ]);
    expect(r.transitionEncounterId).toBeNull();
    expect(r.isAlertCandidate).toBe(false);
  });

  it('first encounter unsheltered → already-homeless on first visit; no alert (no prior history)', () => {
    // Without prior history, we can't know if this is truly first-time.
    // The conservative call: do not alert — the patient may be chronically
    // homeless. A dedicated story can refine if needed.
    const r = classifyFirstTimeHomeless([enc('e1', '2026-01-01', 'unsheltered')]);
    expect(r.transitionEncounterId).toBe('e1');
    expect(r.encountersBefore).toBe(0);
    expect(r.isAlertCandidate).toBe(false);
  });

  it('handles unsorted input by sorting chronologically', () => {
    const r = classifyFirstTimeHomeless([
      enc('e3', '2026-03-01', 'unsheltered'),
      enc('e1', '2026-01-01', 'housed'),
      enc('e2', '2026-02-01', 'housed'),
    ]);
    expect(r.transitionEncounterId).toBe('e3');
    expect(r.isAlertCandidate).toBe(true);
  });

  it('returns null on empty input (defensive)', () => {
    const r = classifyFirstTimeHomeless([]);
    expect(r.transitionEncounterId).toBeNull();
    expect(r.encountersBefore).toBe(0);
    expect(r.isAlertCandidate).toBe(false);
  });

  it('handles patient bouncing back to housed and then homeless again', () => {
    // First time was e2; e4 is a re-entry, not first-time.
    const r = classifyFirstTimeHomeless([
      enc('e1', '2026-01-01', 'housed'),
      enc('e2', '2026-02-01', 'shelter'),
      enc('e3', '2026-03-01', 'housed'),
      enc('e4', '2026-04-01', 'unsheltered'),
    ]);
    expect(r.transitionEncounterId).toBe('e2');
    expect(r.isAlertCandidate).toBe(false);
  });

  it('exposes HOMELESS_HOUSING_STATUSES as a stable controlled vocab', () => {
    expect(HOMELESS_HOUSING_STATUSES).toContain('shelter');
    expect(HOMELESS_HOUSING_STATUSES).toContain('unsheltered');
    expect(HOMELESS_HOUSING_STATUSES).not.toContain('doubled_up');
    expect(HOMELESS_HOUSING_STATUSES).not.toContain('housed');
  });
});
