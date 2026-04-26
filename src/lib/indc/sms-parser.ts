import type { BedFilter } from '@/lib/coordination/bed-availability';

/**
 * Inbound SMS commands the bed-finder understands. Every command maps
 * to a single intent; modifiers stack inside `BED ...`. Examples:
 *   BED                → find any open bed
 *   BED FAMILY         → family-accepting + open
 *   BED PET            → pet-friendly + open
 *   BED MEN PET        → men + pet-friendly + open
 *   BED WOMEN SUD      → women + SUD-friendly + open
 *   HELP               → help text
 *   STOP / END / QUIT  → opt-out (Twilio handles delivery; we still log it)
 */
export type ParsedSmsCommand =
  | { kind: 'bed'; filter: BedFilter }
  | { kind: 'help' }
  | { kind: 'stop' }
  | { kind: 'unknown'; raw: string };

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const HELP_WORDS = new Set(['HELP', 'INFO', '?']);

const POPULATION_TOKENS: Record<string, NonNullable<BedFilter['population']>> = {
  MEN: 'men',
  MAN: 'men',
  MALE: 'men',
  WOMEN: 'women',
  WOMAN: 'women',
  FEMALE: 'women',
  FAMILY: 'families',
  FAMILIES: 'families',
  KIDS: 'families',
  CHILDREN: 'families',
};

const PET_TOKENS = new Set(['PET', 'PETS', 'DOG', 'CAT', 'PETFRIENDLY']);
const SUD_TOKENS = new Set(['SUD', 'SOBER', 'RECOVERY', 'DRUGS', 'CLEAN']);

export function parseSmsCommand(raw: string): ParsedSmsCommand {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'unknown', raw };

  const tokens = trimmed.toUpperCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { kind: 'unknown', raw };

  const head = tokens[0];

  if (STOP_WORDS.has(head)) return { kind: 'stop' };
  if (HELP_WORDS.has(head)) return { kind: 'help' };

  if (head === 'BED' || head === 'BEDS' || head === 'SHELTER') {
    const filter: BedFilter = { minFreeBeds: 1 };
    for (const t of tokens.slice(1)) {
      const pop = POPULATION_TOKENS[t];
      if (pop && !filter.population) {
        filter.population = pop;
        continue;
      }
      if (PET_TOKENS.has(t)) {
        filter.petFriendly = true;
        continue;
      }
      if (SUD_TOKENS.has(t)) {
        filter.sudFriendly = true;
      }
      // Unknown modifiers are ignored — we still treat the message as
      // a BED request rather than rejecting on a typo.
    }
    return { kind: 'bed', filter };
  }

  return { kind: 'unknown', raw };
}
