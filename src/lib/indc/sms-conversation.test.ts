import { describe, expect, it } from 'vitest';
import { isLocationSkip, normalizeLocation } from './sms-conversation';

describe('isLocationSkip', () => {
  it.each([
    'ANYWHERE',
    'anywhere',
    'Any',
    'SKIP',
    'whatever',
    'NEAR',
  ])('recognizes %s as skip', (token) => {
    expect(isLocationSkip(token)).toBe(true);
  });

  it('looks at the first token only', () => {
    expect(isLocationSkip('ANYWHERE downtown')).toBe(true);
  });

  it('rejects normal location text', () => {
    expect(isLocationSkip('downtown')).toBe(false);
    expect(isLocationSkip('42301')).toBe(false);
    expect(isLocationSkip('')).toBe(false);
  });
});

describe('normalizeLocation', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeLocation('  downtown   owensboro  ')).toBe('downtown owensboro');
  });

  it('caps to 80 chars', () => {
    expect(normalizeLocation('a'.repeat(200)).length).toBe(80);
  });
});
