import type { BedFilter } from '@/lib/coordination/bed-availability';
import type { BedFinderResult } from './bed-finder';

/**
 * SMS replies cap at 320 chars (two GSM segments — keeps cost predictable
 * and avoids carrier-side concatenation surprises). The formatter trims
 * matches until the body fits.
 */
export const SMS_MAX_LEN = 320;

const HELP_REPLY =
  'Coalition bed-finder. Reply BED for an open shelter bed. Add MEN, WOMEN, FAMILY, PET, or SUD to filter (e.g. BED FAMILY PET). HELP repeats this. STOP to opt out.';

const STOP_REPLY = "You're opted out. Reply START to opt back in.";

const UNKNOWN_REPLY =
  "Sorry, didn't catch that. Reply BED for an open shelter bed, or HELP for options.";

const NO_MATCH_REPLY =
  'No open beds match right now. Try BED for any open bed, or call 211 for live help.';

function describeFilter(filter: BedFilter): string {
  const parts: string[] = [];
  if (filter.population === 'men') parts.push('men');
  if (filter.population === 'women') parts.push('women');
  if (filter.population === 'families') parts.push('families');
  if (filter.petFriendly) parts.push('pet-friendly');
  if (filter.sudFriendly) parts.push('SUD-OK');
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function formatShelterLine(idx: number, r: BedFinderResult): string {
  const phone = r.shelter.contactPhone ? ` ${r.shelter.contactPhone}` : '';
  const free = r.freeBeds === 1 ? '1 bed' : `${r.freeBeds} beds`;
  return `${idx}. ${r.shelter.name} — ${free}.${phone}`;
}

/**
 * Format a list of bed-finder results as a body that fits in
 * `SMS_MAX_LEN`. Drops trailing matches if they don't fit.
 */
export function formatBedResults(results: BedFinderResult[], filter: BedFilter): string {
  if (results.length === 0) return NO_MATCH_REPLY;

  const header = `Open beds${describeFilter(filter)}:`;
  const footer = ' Reply HOLD <#> to hold, HELP for options.';
  const fixed = `${header}${footer}`;
  const budget = SMS_MAX_LEN - fixed.length;

  const lines: string[] = [];
  let used = 0;
  for (let i = 0; i < results.length; i++) {
    const line = formatShelterLine(i + 1, results[i]);
    // +1 for the leading space we'll join with.
    if (used + line.length + 1 > budget) break;
    lines.push(line);
    used += line.length + 1;
  }

  if (lines.length === 0) {
    // Even one line didn't fit. Bail to a tiny fallback.
    const top = results[0];
    return `${top.shelter.name}: ${top.freeBeds} free.${top.shelter.contactPhone ? ` ${top.shelter.contactPhone}` : ''}`.slice(
      0,
      SMS_MAX_LEN,
    );
  }

  return `${header} ${lines.join(' ')}${footer}`;
}

export function smsHelp(): string {
  return HELP_REPLY;
}

export function smsStop(): string {
  return STOP_REPLY;
}

export function smsUnknown(): string {
  return UNKNOWN_REPLY;
}
