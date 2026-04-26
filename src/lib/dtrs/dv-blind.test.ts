import { describe, expect, it } from 'vitest';
import { REDACTED_PLACEHOLDER, redactAddress, viewerCanSeeDvAddresses } from './dv-blind';

describe('viewerCanSeeDvAddresses', () => {
  it('attorney + caseworker can see the un-redacted address', () => {
    expect(viewerCanSeeDvAddresses('attorney')).toBe(true);
    expect(viewerCanSeeDvAddresses('caseworker')).toBe(true);
  });

  it('shelter staff and ed coordinator cannot', () => {
    expect(viewerCanSeeDvAddresses('shelter_staff')).toBe(false);
    expect(viewerCanSeeDvAddresses('ed_coordinator')).toBe(false);
  });

  it('admin cannot — administrative access is not the same as case-bound need', () => {
    expect(viewerCanSeeDvAddresses('admin')).toBe(false);
  });

  it('pending users cannot', () => {
    expect(viewerCanSeeDvAddresses('pending')).toBe(false);
  });
});

describe('redactAddress', () => {
  it('passes through when redact=false', () => {
    const before = { addressLine1: '123 Main St', city: 'Owensboro', state: 'KY' };
    expect(redactAddress(before, false)).toEqual(before);
  });

  it('replaces structured address fields when redact=true', () => {
    const before = {
      addressLine1: '123 Main St',
      city: 'Owensboro',
      state: 'KY',
      postalCode: '42301',
    };
    const after = redactAddress(before, true);
    expect(after.addressLine1).toBe(REDACTED_PLACEHOLDER);
    expect(after.city).toBeNull();
    expect(after.state).toBeNull();
    expect(after.postalCode).toBeNull();
  });

  it('replaces eviction-filing defendant_address when redact=true', () => {
    const before = { defendantAddress: '123 Main St', plaintiff: 'Mock LLC' };
    const after = redactAddress(before, true);
    expect(after.defendantAddress).toBe(REDACTED_PLACEHOLDER);
    expect(after.plaintiff).toBe('Mock LLC');
  });

  it('does not touch non-address fields', () => {
    const before = { addressLine1: '123 Main St', name: 'Anywhere Shelter' } as {
      addressLine1?: string | null;
      name: string;
    };
    const after = redactAddress(before, true);
    expect(after.name).toBe('Anywhere Shelter');
  });

  it('returns the input object reference when redact=false (no-clone)', () => {
    const before = { addressLine1: '123 Main St' };
    expect(redactAddress(before, false)).toBe(before);
  });
});
