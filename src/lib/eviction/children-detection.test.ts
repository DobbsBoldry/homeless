import { describe, expect, it } from 'vitest';
import { detectChildrenSignal } from './children-detection';

describe('detectChildrenSignal', () => {
  describe('high confidence', () => {
    it('explicit "minor children" language', () => {
      const r = detectChildrenSignal('Defendant resides at the property with two minor children.');
      expect(r.detected).toBe(true);
      expect(r.confidence).toBe('high');
      expect(r.evidence).toMatch(/two minor children/);
    });

    it('singular "minor child"', () => {
      const r = detectChildrenSignal('Tenant has one minor child living in the unit.');
      expect(r.confidence).toBe('high');
    });

    it('"with his daughters" occupancy phrasing', () => {
      const r = detectChildrenSignal(
        'Defendant occupies the premises with his two daughters and a roommate.',
      );
      expect(r.confidence).toBe('high');
    });

    it('household-includes-children phrasing', () => {
      const r = detectChildrenSignal('The household includes children of school age.');
      expect(r.confidence).toBe('high');
    });

    it('"under the age of 18"', () => {
      const r = detectChildrenSignal(
        'Two of the occupants are under the age of 18 per the lease addendum.',
      );
      expect(r.confidence).toBe('high');
    });
  });

  describe('medium confidence', () => {
    it('defendant-lives-with-children phrasing', () => {
      const r = detectChildrenSignal('Defendant lives at the unit with three kids.');
      expect(r.confidence).toBe('medium');
    });

    it('"family with children"', () => {
      const r = detectChildrenSignal('This is a family with children in the home.');
      // The phrase "family with children" matches the medium pattern
      expect(r.detected).toBe(true);
      expect(['medium', 'high']).toContain(r.confidence);
    });

    it('numeric phrasing "2 kids in the home"', () => {
      const r = detectChildrenSignal('There are 2 kids in the home according to neighbor.');
      expect(r.detected).toBe(true);
      expect(['medium', 'high']).toContain(r.confidence);
    });
  });

  describe('low confidence', () => {
    it('bare child noun without context', () => {
      const r = detectChildrenSignal('Notes mention a son visiting on weekends.');
      expect(r.detected).toBe(true);
      expect(r.confidence).toBe('low');
    });
  });

  describe('negations override everything', () => {
    it('"no minor children"', () => {
      const r = detectChildrenSignal('Defendant has no minor children in the household.');
      expect(r.detected).toBe(false);
      expect(r.confidence).toBe('none');
    });

    it('"no children in the household"', () => {
      const r = detectChildrenSignal('Confirmed no children in the household at service.');
      expect(r.detected).toBe(false);
    });

    it('"defendant reports no children"', () => {
      const r = detectChildrenSignal('Defendant reports no children present.');
      expect(r.detected).toBe(false);
    });
  });

  describe('false-positive guardrails', () => {
    it('"child support" alone does not trigger', () => {
      const r = detectChildrenSignal('Defendant has child support obligations of $400/month.');
      expect(r.detected).toBe(false);
    });

    it('"child support" + actual children-in-home language still detects', () => {
      const r = detectChildrenSignal(
        'Defendant pays child support and lives with two minor children at the unit.',
      );
      expect(r.detected).toBe(true);
      expect(r.confidence).toBe('high');
    });

    it('"childcare expense" alone does not trigger', () => {
      const r = detectChildrenSignal('Childcare expense is $200/week per defendant.');
      expect(r.detected).toBe(false);
    });
  });

  describe('empty / null input', () => {
    it('null returns none', () => {
      expect(detectChildrenSignal(null).detected).toBe(false);
    });

    it('empty string returns none', () => {
      expect(detectChildrenSignal('').detected).toBe(false);
    });

    it('whitespace returns none', () => {
      expect(detectChildrenSignal('   \n  ').detected).toBe(false);
    });
  });

  describe('evidence snippet', () => {
    it('returns a short window around the match', () => {
      const r = detectChildrenSignal(
        'Long preamble text that goes on and on. Defendant lives at the unit with two minor children. Then more text after.',
      );
      expect(r.detected).toBe(true);
      expect(r.evidence).toMatch(/two minor children/);
      expect(r.evidence?.length ?? 0).toBeLessThan(120);
    });
  });
});
