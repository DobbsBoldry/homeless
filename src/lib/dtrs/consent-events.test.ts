import { describe, expect, it } from 'vitest';
import { type ConsentEventInput, labelConsentEvents } from './consent-events';

const at = (iso: string) => new Date(iso);

describe('labelConsentEvents', () => {
  it('labels the first grant "Granted" and a later grant "Re-granted"', () => {
    const events: ConsentEventInput[] = [
      { eventType: 'granted', eventAt: at('2026-01-01T10:00:00Z') },
      { eventType: 'revoked', eventAt: at('2026-02-01T10:00:00Z') },
      { eventType: 'granted', eventAt: at('2026-03-01T10:00:00Z') },
    ];
    const out = labelConsentEvents(events);
    expect(out.map((e) => e.label)).toEqual(['Granted', 'Revoked', 'Re-granted']);
  });

  it('orders events chronologically regardless of input order', () => {
    const events: ConsentEventInput[] = [
      { eventType: 'granted', eventAt: at('2026-03-01T10:00:00Z') },
      { eventType: 'granted', eventAt: at('2026-01-01T10:00:00Z') },
      { eventType: 'revoked', eventAt: at('2026-02-01T10:00:00Z') },
    ];
    const out = labelConsentEvents(events);
    expect(out.map((e) => e.eventAt.toISOString())).toEqual([
      '2026-01-01T10:00:00.000Z',
      '2026-02-01T10:00:00.000Z',
      '2026-03-01T10:00:00.000Z',
    ]);
    expect(out.map((e) => e.label)).toEqual(['Granted', 'Revoked', 'Re-granted']);
  });

  it('labels every grant after the first as "Re-granted"', () => {
    const events: ConsentEventInput[] = [
      { eventType: 'granted', eventAt: at('2026-01-01T00:00:00Z') },
      { eventType: 'revoked', eventAt: at('2026-01-02T00:00:00Z') },
      { eventType: 'granted', eventAt: at('2026-01-03T00:00:00Z') },
      { eventType: 'revoked', eventAt: at('2026-01-04T00:00:00Z') },
      { eventType: 'granted', eventAt: at('2026-01-05T00:00:00Z') },
    ];
    expect(labelConsentEvents(events).map((e) => e.label)).toEqual([
      'Granted',
      'Revoked',
      'Re-granted',
      'Revoked',
      'Re-granted',
    ]);
  });

  it('handles a single grant', () => {
    const out = labelConsentEvents([{ eventType: 'granted', eventAt: at('2026-01-01T00:00:00Z') }]);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('Granted');
  });

  it('returns an empty array for no events and does not mutate the input', () => {
    const input: ConsentEventInput[] = [];
    expect(labelConsentEvents(input)).toEqual([]);
    expect(input).toEqual([]);
  });

  it('does not mutate the caller-supplied array order', () => {
    const input: ConsentEventInput[] = [
      { eventType: 'granted', eventAt: at('2026-03-01T00:00:00Z') },
      { eventType: 'granted', eventAt: at('2026-01-01T00:00:00Z') },
    ];
    labelConsentEvents(input);
    expect(input[0].eventAt.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });
});
