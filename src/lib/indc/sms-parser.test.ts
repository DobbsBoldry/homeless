import { describe, expect, it } from 'vitest';
import { parseSmsCommand } from './sms-parser';

describe('parseSmsCommand', () => {
  it('treats bare BED as a request for any open bed', () => {
    expect(parseSmsCommand('BED')).toEqual({ kind: 'bed', filter: { minFreeBeds: 1 } });
  });

  it('handles lowercase + leading whitespace', () => {
    expect(parseSmsCommand('   bed family ')).toEqual({
      kind: 'bed',
      filter: { minFreeBeds: 1, population: 'families' },
    });
  });

  it('stacks population + pet + sud modifiers', () => {
    expect(parseSmsCommand('BED WOMEN PET SUD')).toEqual({
      kind: 'bed',
      filter: { minFreeBeds: 1, population: 'women', petFriendly: true, sudFriendly: true },
    });
  });

  it('accepts BEDS and SHELTER as synonyms', () => {
    expect(parseSmsCommand('BEDS').kind).toBe('bed');
    expect(parseSmsCommand('SHELTER').kind).toBe('bed');
  });

  it('first population token wins when conflicting', () => {
    expect(parseSmsCommand('BED MEN WOMEN')).toEqual({
      kind: 'bed',
      filter: { minFreeBeds: 1, population: 'men' },
    });
  });

  it('ignores unknown modifier tokens but stays a BED command', () => {
    const result = parseSmsCommand('BED ASAP PLEASE');
    expect(result).toEqual({ kind: 'bed', filter: { minFreeBeds: 1 } });
  });

  it('recognizes STOP variants (CANCEL routed to release instead)', () => {
    expect(parseSmsCommand('STOP').kind).toBe('stop');
    expect(parseSmsCommand('UNSUBSCRIBE').kind).toBe('stop');
    expect(parseSmsCommand('quit').kind).toBe('stop');
  });

  it('recognizes HELP variants', () => {
    expect(parseSmsCommand('HELP').kind).toBe('help');
    expect(parseSmsCommand('?').kind).toBe('help');
  });

  it('recognizes shorthand info commands', () => {
    expect(parseSmsCommand('FOOD').kind).toBe('food');
    expect(parseSmsCommand('hungry').kind).toBe('food');
    expect(parseSmsCommand('STORY').kind).toBe('story');
    expect(parseSmsCommand('about').kind).toBe('story');
  });

  it('parses HOLD with numeric arg into 0-indexed resultIndex', () => {
    expect(parseSmsCommand('HOLD 1')).toEqual({ kind: 'hold', resultIndex: 0 });
    expect(parseSmsCommand('HOLD 3')).toEqual({ kind: 'hold', resultIndex: 2 });
    expect(parseSmsCommand('hold #2')).toEqual({ kind: 'hold', resultIndex: 1 });
  });

  it('defaults bare HOLD to slot 1', () => {
    expect(parseSmsCommand('HOLD')).toEqual({ kind: 'hold', resultIndex: 0 });
    expect(parseSmsCommand('RESERVE')).toEqual({ kind: 'hold', resultIndex: 0 });
  });

  it('routes RELEASE / CANCEL / NEVERMIND to release', () => {
    expect(parseSmsCommand('RELEASE').kind).toBe('release');
    expect(parseSmsCommand('cancel').kind).toBe('release');
    expect(parseSmsCommand('Nevermind').kind).toBe('release');
  });

  it('returns unknown for empty / unrecognized input', () => {
    expect(parseSmsCommand('').kind).toBe('unknown');
    expect(parseSmsCommand('hello there').kind).toBe('unknown');
  });
});
