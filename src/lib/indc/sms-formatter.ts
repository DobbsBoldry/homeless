import type { BedFilter } from '@/lib/coordination';
import type { BedFinderResult } from './bed-finder';
import type { BedSummary } from './bed-summary';

/**
 * SMS replies cap at 320 chars (two GSM segments — keeps cost predictable
 * and avoids carrier-side concatenation surprises). The formatter trims
 * matches until the body fits.
 */
export const SMS_MAX_LEN = 320;

const HELP_REPLY =
  'Coalition bed-finder. BED (+ MEN/WOMEN/FAMILY/PET/SUD) for an open bed. HOLD <#> to hold. STATUS for the coalition-wide board. FOOD for pantries. STOP to opt out.';

const STOP_REPLY = "You're opted out. Reply START to opt back in.";

const UNKNOWN_REPLY =
  "Sorry, didn't catch that. Reply BED for an open shelter bed, or HELP for options.";

const NO_MATCH_REPLY =
  'No open beds match right now. Try BED for any open bed, or call 211 for live help.';

const FOOD_REPLY =
  'Food in Daviess Co: Catholic Charities Feeding Our Friends 270-683-1545. St Benedicts day meals 270-686-8410. Boulware Mission daily meals 270-683-1505. Call 211 for current hours.';

const STORY_REPLY =
  'This is the Daviess coalition bed-finder. Free, confidential, run with local partners. Texts go to staff during pilot; only HELP/STOP messages and bed counts are kept. Reply BED to start.';

const NO_HOLD_CONTEXT_REPLY =
  'No recent bed list to hold against. Reply BED first, then HOLD <#> against the list we send back.';

const NO_ACTIVE_HOLD_REPLY = 'No active hold to release. Reply BED to look for a new bed.';

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

const LOCATION_PROMPT =
  'Where are you near? Reply with a neighborhood, intersection, or ZIP — or ANYWHERE for any open bed.';

/**
 * The "where are you?" prompt shown after the first BED message
 * (INDC-004). Stays well under SMS_MAX_LEN.
 */
export function smsLocationPrompt(): string {
  return LOCATION_PROMPT;
}

/**
 * Format a list of bed-finder results as a body that fits in
 * `SMS_MAX_LEN`. Drops trailing matches if they don't fit. The optional
 * `nearLocation` is appended to the header when provided so the user
 * sees the location they gave reflected back.
 */
export function formatBedResults(
  results: BedFinderResult[],
  filter: BedFilter,
  nearLocation?: string | null,
): string {
  if (results.length === 0) return NO_MATCH_REPLY;

  const near = nearLocation ? ` near ${nearLocation}` : '';
  const header = `Open beds${describeFilter(filter)}${near}:`;
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
    const phone = top.shelter.contactPhone ? ` ${top.shelter.contactPhone}` : '';
    return `${top.shelter.name}: ${top.freeBeds} free.${phone}`.slice(0, SMS_MAX_LEN);
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

export function smsFood(): string {
  return FOOD_REPLY;
}

export function smsStory(): string {
  return STORY_REPLY;
}

export function smsNoHoldContext(): string {
  return NO_HOLD_CONTEXT_REPLY;
}

export function smsNoActiveHold(): string {
  return NO_ACTIVE_HOLD_REPLY;
}

const fmtClock = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(d));

/**
 * Inline confirmation for a hold a caller just placed via SMS. Includes
 * the shelter name, expiry clock, and a one-tap call link. The caller
 * can text RELEASE to undo.
 */
export function smsHoldConfirmed(
  shelterName: string,
  phone: string | null,
  expiresAt: Date,
): string {
  const callPart = phone ? ` Call ${phone} or` : '';
  return `Bed held at ${shelterName} until ${fmtClock(expiresAt)}.${callPart} walk in to take it. Reply RELEASE to cancel.`.slice(
    0,
    SMS_MAX_LEN,
  );
}

export function smsHoldReleased(shelterName: string): string {
  return `Hold at ${shelterName} released. Reply BED to look for another open bed.`.slice(
    0,
    SMS_MAX_LEN,
  );
}

export function smsHoldFailed(reason: string): string {
  // Reason copy should already be user-safe — we cap to MAX_LEN as a
  // defense against an unexpectedly long server message.
  return `Couldn't hold a bed: ${reason} Reply BED to try again.`.slice(0, SMS_MAX_LEN);
}

/**
 * One-shot coalition bed dashboard for 211 dispatchers and caseworkers
 * (COOR-006). Designed to fit in a single SMS, so it's a flat sentence
 * with the most-asked dimensions (population + pet + SUD) and a hint
 * that the dispatcher can drill in by replying BED with a filter.
 *
 * Empty / all-full coalitions get a different copy that doesn't dangle
 * the "reply BED for detail" CTA pointlessly.
 */
export function smsBedSummary(s: BedSummary): string {
  if (s.shelterCount === 0) {
    return 'No active shelters listed in the coalition right now.';
  }
  if (s.totalFree === 0) {
    return `All ${s.shelterCount} coalition shelters are full right now. Try BED later, or call 211 for live help.`.slice(
      0,
      SMS_MAX_LEN,
    );
  }
  const fullFrag = s.fullCount > 0 ? `, ${s.fullCount} full` : '';
  const head = `Daviess shelters: ${s.totalFree} free across ${s.shelterCount} sites${fullFrag}.`;
  const slices = `Men ${s.free.men}. Women ${s.free.women}. Families ${s.free.families}. Pet ${s.free.petFriendly}. SUD ${s.free.sudFriendly}.`;
  const tail = ' Reply BED <filter> for the list.';
  const reply = `${head} ${slices}${tail}`;
  return reply.slice(0, SMS_MAX_LEN);
}
