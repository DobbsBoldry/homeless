import { describe, expect, it } from 'vitest';
import { scrubClinicalNote } from './scrub';

/**
 * #247 ESUC de-id eval. Every entry is a realistic-but-synthetic clinical
 * note fragment containing a known leak vector. The test asserts:
 *   - The leak token (`leak`) is removed from the output
 *   - The expected redaction marker is present
 *
 * If a future regression in the scrubber misses any of these, the build
 * fails loudly. New leak vectors get a new entry — that's how this file
 * grows over time.
 */

type LeakCase = {
  name: string;
  input: string;
  /** Substring that MUST be gone from the output. */
  leak: string;
  /** [REDACTED-*] marker that MUST be present in the output. */
  expectedMarker: string;
};

const LEAK_VECTORS: LeakCase[] = [
  // 1-3. The classics from the original stub.
  {
    name: 'phone (parens, dash)',
    input: 'Call back at (502) 555-1234 if pain returns.',
    leak: '555-1234',
    expectedMarker: '[REDACTED-PHONE]',
  },
  {
    name: 'phone (continuous digits)',
    input: 'Patient cell 5025551234.',
    leak: '5025551234',
    expectedMarker: '[REDACTED-PHONE]',
  },
  {
    name: 'email',
    input: 'Discharge summary sent to jane.doe@hospital.org.',
    leak: 'jane.doe@hospital.org',
    expectedMarker: '[REDACTED-EMAIL]',
  },
  {
    name: 'ssn',
    input: 'SSN on file: 123-45-6789.',
    leak: '123-45-6789',
    expectedMarker: '[REDACTED-SSN]',
  },

  // 4-5. Honorifics — covered by the old stub but tightened.
  {
    name: 'honorific Dr.',
    input: 'Patient discussed history with Dr. Smith.',
    leak: 'Smith',
    expectedMarker: '[REDACTED-NAME]',
  },
  {
    name: 'honorific without dot',
    input: 'Mrs Jones reports improving symptoms.',
    leak: 'Jones',
    expectedMarker: '[REDACTED-NAME]',
  },

  // 6-8. Family-relationship + name (named in the issue).
  {
    name: 'family — daughter present',
    input: 'On exam: alert, oriented x3. Daughter Mary present at bedside.',
    leak: 'Mary',
    expectedMarker: '[REDACTED-FAMILY-NAME]',
  },
  {
    name: 'family — son with two-part name',
    input: 'Per son Jonathan Doe, patient lives independently.',
    leak: 'Jonathan Doe',
    expectedMarker: '[REDACTED-FAMILY-NAME]',
  },
  {
    name: 'family — wife',
    input: 'Wife Patricia confirms the medication list.',
    leak: 'Patricia',
    expectedMarker: '[REDACTED-FAMILY-NAME]',
  },

  // 9-10. Honorific-less provider names (named in the issue).
  {
    name: 'provider — signed off by',
    input: 'Plan signed off by Patel.',
    leak: 'Patel',
    expectedMarker: '[REDACTED-PROVIDER]',
  },
  {
    name: 'provider — attending',
    input: 'Attending Williams ordered CBC and BMP.',
    leak: 'Williams',
    expectedMarker: '[REDACTED-PROVIDER]',
  },

  // 11-12. Address fragments and full street addresses.
  {
    name: 'address fragment — living at',
    input: 'Currently living at 123 Main, sleeping on couch.',
    leak: '123 Main',
    expectedMarker: '[REDACTED-ADDRESS]',
  },
  {
    name: 'street address with suffix',
    input: 'Discharged to 456 Frederica St.',
    leak: '456 Frederica St',
    expectedMarker: '[REDACTED-ADDRESS]',
  },

  // 13. MRN-shaped strings.
  {
    name: 'MRN explicit label',
    input: 'MRN: 1234567 — duplicate of prior visit.',
    leak: '1234567',
    expectedMarker: '[REDACTED-MRN]',
  },

  // 14-15. Specific dates (ISO and US formats).
  {
    name: 'ISO date',
    input: 'Last hospitalization 2024-03-15 for similar complaint.',
    leak: '2024-03-15',
    expectedMarker: '[REDACTED-DATE]',
  },
  {
    name: 'US date',
    input: 'Patient seen 3/15/2024 in clinic.',
    leak: '3/15/2024',
    expectedMarker: '[REDACTED-DATE]',
  },

  // 16. Realistic combined note — every leak vector at once.
  {
    name: 'combined — multi-vector reidentifying note',
    input:
      'Patient seen 2024-03-15 by Dr. Smith. Daughter Mary present. ' +
      'Currently living at 789 Walnut Ave. Phone 502-555-1234, ' +
      'email m.smith@example.com. MRN: 9876543. SSN 111-22-3333.',
    // Just assert one token from each vector is gone.
    leak: 'Smith',
    expectedMarker: '[REDACTED-NAME]',
  },
];

describe('scrubClinicalNote — leak-vector eval', () => {
  for (const c of LEAK_VECTORS) {
    it(`redacts: ${c.name}`, () => {
      const out = scrubClinicalNote(c.input);
      expect(out, `case "${c.name}" returned null`).not.toBeNull();
      expect(out, `leak token "${c.leak}" survived in output: ${out}`).not.toContain(c.leak);
      expect(out, `expected marker "${c.expectedMarker}" missing in output: ${out}`).toContain(
        c.expectedMarker,
      );
    });
  }

  it('the combined case strips every named leak', () => {
    // Re-run the multi-vector case against ALL the markers, not just one.
    const c = LEAK_VECTORS[LEAK_VECTORS.length - 1];
    const out = scrubClinicalNote(c.input)!;
    for (const tok of [
      'Smith',
      'Mary',
      '789 Walnut Ave',
      '502-555-1234',
      'm.smith@example.com',
      '9876543',
      '111-22-3333',
      '2024-03-15',
    ]) {
      expect(out, `leak "${tok}" survived in combined case: ${out}`).not.toContain(tok);
    }
  });
});

describe('scrubClinicalNote — edge cases', () => {
  it('returns null for null input', () => {
    expect(scrubClinicalNote(null)).toBeNull();
  });

  it('returns empty string for empty input', () => {
    expect(scrubClinicalNote('')).toBe('');
  });

  it('is idempotent — scrubbing already-scrubbed text is a no-op', () => {
    const once = scrubClinicalNote('Dr. Smith and daughter Mary at 123 Main St.');
    const twice = scrubClinicalNote(once);
    expect(twice).toBe(once);
  });

  it('preserves clinical content that is not PII', () => {
    const note = 'Diagnosis: COPD exacerbation. Started on prednisone 40mg PO QD x5d.';
    expect(scrubClinicalNote(note)).toBe(note);
  });

  it('handles a long realistic note without crashing', () => {
    const note = `
      CHIEF COMPLAINT: Chest pain.
      HPI: 58yo M presents with left-sided chest pain x 2 hours.
      PMH: HTN, T2DM. PSH: appendectomy 2010.
      MEDS: lisinopril 20mg daily, metformin 1000mg BID.
      VITALS: BP 142/89, HR 88, RR 16, SpO2 97% RA.
      EXAM: alert, oriented x3. Lungs CTAB. Heart RRR.
      PLAN: ECG, troponin, CXR. Admit to obs.
    `;
    expect(() => scrubClinicalNote(note)).not.toThrow();
  });
});
