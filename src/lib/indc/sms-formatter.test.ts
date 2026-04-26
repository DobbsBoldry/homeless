import { describe, expect, it } from 'vitest';
import type { ShelterWithOrg } from '@/db/queries/shelters';
import type { BedFinderResult } from './bed-finder';
import {
  formatBedResults,
  SMS_MAX_LEN,
  smsFood,
  smsHelp,
  smsHoldConfirmed,
  smsHoldFailed,
  smsHoldReleased,
  smsLocationPrompt,
  smsNoActiveHold,
  smsNoHoldContext,
  smsStop,
  smsStory,
  smsUnknown,
} from './sms-formatter';

const shelter = (name: string, phone: string | null = '+1-270-555-0100'): ShelterWithOrg => ({
  id: name,
  partnerOrgId: 'org1',
  name,
  slug: name.toLowerCase(),
  addressLine1: null,
  city: 'Owensboro',
  state: 'KY',
  postalCode: null,
  contactPhone: phone,
  capacity: 20,
  currentOccupancy: 5,
  acceptsMen: true,
  acceptsWomen: true,
  acceptsFamilies: false,
  petFriendly: false,
  sudFriendly: false,
  active: true,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  partnerOrg: { id: 'org1', name: 'Org', slug: 'org' },
});

const result = (name: string, free: number): BedFinderResult => ({
  shelter: shelter(name),
  freeBeds: free,
});

describe('formatBedResults', () => {
  it('renders the no-match copy for empty results', () => {
    const r = formatBedResults([], {});
    expect(r).toContain('No open beds');
    expect(r.length).toBeLessThanOrEqual(SMS_MAX_LEN);
  });

  it('describes the active filter in the header', () => {
    const r = formatBedResults([result('Boulware', 5)], {
      population: 'families',
      petFriendly: true,
    });
    expect(r).toMatch(/families/);
    expect(r).toMatch(/pet-friendly/);
  });

  it('renders multiple results pluralized', () => {
    const r = formatBedResults([result('Boulware', 1), result('St Benedicts', 7)], {});
    expect(r).toMatch(/Boulware — 1 bed/);
    expect(r).toMatch(/St Benedicts — 7 beds/);
  });

  it('stays within SMS_MAX_LEN', () => {
    const many = Array.from({ length: 10 }, (_, i) => result(`Shelter ${i}`, 9 - i));
    const r = formatBedResults(many, {});
    expect(r.length).toBeLessThanOrEqual(SMS_MAX_LEN);
  });

  it('includes hold + help footer', () => {
    const r = formatBedResults([result('Boulware', 5)], {});
    expect(r).toContain('HOLD');
    expect(r).toContain('HELP');
  });
});

describe('canned replies', () => {
  it('all stay within SMS_MAX_LEN', () => {
    for (const reply of [
      smsHelp(),
      smsStop(),
      smsUnknown(),
      smsLocationPrompt(),
      smsFood(),
      smsStory(),
      smsNoActiveHold(),
      smsNoHoldContext(),
    ]) {
      expect(reply.length).toBeLessThanOrEqual(SMS_MAX_LEN);
    }
  });

  it('location prompt mentions ANYWHERE escape hatch', () => {
    expect(smsLocationPrompt()).toMatch(/ANYWHERE/);
  });

  it('food reply names actual coalition partners', () => {
    expect(smsFood()).toMatch(/Catholic Charities/);
    expect(smsFood()).toMatch(/Boulware/);
  });
});

describe('hold reply formatters', () => {
  it('confirms a hold with shelter name + clock + phone', () => {
    const expires = new Date('2026-04-26T15:30:00Z');
    const reply = smsHoldConfirmed('Boulware Mission', '+1-270-683-1505', expires);
    expect(reply).toContain('Boulware Mission');
    expect(reply).toContain('270-683-1505');
    expect(reply).toMatch(/RELEASE/);
    expect(reply.length).toBeLessThanOrEqual(SMS_MAX_LEN);
  });

  it('drops phone fragment cleanly when shelter has no phone', () => {
    const reply = smsHoldConfirmed('Anon Shelter', null, new Date());
    expect(reply).not.toMatch(/Call/);
  });

  it('hold-released reply names the shelter', () => {
    expect(smsHoldReleased('Daniel Pitino')).toContain('Daniel Pitino');
  });

  it('hold-failed reply ≤ SMS_MAX_LEN even with long reason', () => {
    const reply = smsHoldFailed('a'.repeat(400));
    expect(reply.length).toBeLessThanOrEqual(SMS_MAX_LEN);
  });
});

describe('formatBedResults — location label', () => {
  it('includes "near <loc>" in the header when supplied', () => {
    const r = formatBedResults([result('Boulware', 5)], {}, '42301');
    expect(r).toMatch(/near 42301/);
  });

  it('skips "near" label when null', () => {
    const r = formatBedResults([result('Boulware', 5)], {}, null);
    expect(r).not.toMatch(/near/);
  });
});
